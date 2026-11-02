import { fetch } from 'sdk';

const SARVAM_ENDPOINT = 'https://api.sarvam.ai/v2/chat/completions';
const MODEL = 'sarvam-105b';
const MAX_OUTPUT_BYTES = 28000;
const textEncoder = new TextEncoder();
const DRAFT_STEP_CHARS = 400;
const DRAFT_REFRESH_MS = 10000;

function parseSseEvent(eventText) {
  const lines = eventText.split(/\r?\n/);
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');
  if (!data) return null;
  if (data.trim() === '[DONE]') return { __streamDone: true };
  try {
    return JSON.parse(data);
  } catch {
    const error = new Error('Sarvam returned an unreadable streaming event.');
    error.code = 'invalid_sse_event';
    error.providerMessage = data.slice(0, 1200);
    throw error;
  }
}

function addToolCallDelta(calls, deltaCalls) {
  for (const item of deltaCalls || []) {
    const index = Number.isInteger(item?.index) ? item.index : 0;
    const current = calls[index] || {
      id: '',
      type: 'function',
      function: { name: '', arguments: '' },
    };
    if (typeof item.id === 'string') current.id = item.id;
    if (typeof item.type === 'string') current.type = item.type;
    if (typeof item.function?.name === 'string') current.function.name += item.function.name;
    if (typeof item.function?.arguments === 'string') current.function.arguments += item.function.arguments;
    calls[index] = current;
  }
}

function extractText(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map((part) => {
    if (typeof part === 'string') return part;
    if (typeof part?.text === 'string') return part.text;
    if (typeof part?.content === 'string') return part.content;
    return '';
  }).join('');
}

function extractChoiceText(choice) {
  const delta = choice?.delta || {};
  const deltaText = extractText(delta.content);
  if (deltaText) return deltaText;

  // Compatibility with providers that emit a complete message or legacy text
  // field in a streamed choice instead of delta.content.
  const messageText = extractText(choice?.message?.content);
  if (messageText) return messageText;
  if (typeof choice?.text === 'string') return choice.text;
  return '';
}

export async function streamSarvamCompletion({
  apiKey,
  messages,
  tools = null,
  onDraft = async () => {},
  onKeepAlive = async () => {},
  isStopped = async () => false,
}) {
  const request = {
    model: MODEL,
    messages,
    stream: true,
    temperature: 0.35,
    max_tokens: 4096,
  };
  if (tools?.length) {
    request.tools = tools;
    request.tool_choice = 'auto';
    request.parallel_tool_calls = false;
  }

  const response = await fetch(SARVAM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = new Error('Sarvam request failed.');
    error.status = response.status;
    try {
      const rawBody = await response.text();
      let body = null;
      try { body = JSON.parse(rawBody); } catch {}
      error.code = body?.error?.code || body?.code || null;
      error.providerMessage = body?.error?.message || body?.message
        || (rawBody ? rawBody.slice(0, 1200) : null);
      error.requestId = body?.error?.request_id || body?.request_id
        || response.headers?.get?.('x-request-id') || null;
      error.retryAfter = response.headers?.get?.('retry-after') || null;
    } catch (readError) {
      error.bodyReadError = readError?.message || 'Could not read the provider error body.';
    }
    throw error;
  }
  if (!response.body) {
    const error = new Error('Sarvam returned no streaming response body.');
    error.code = 'empty_stream_body';
    error.status = response.status;
    throw error;
  }

  let buffer = '';
  let answer = '';
  let answerBytes = 0;
  let nextDraftAt = 1;
  let draftAvailable = true;
  let finishReason = null;
  let lastDraftAt = Date.now();
  let eventCount = 0;
  let choiceCount = 0;
  let sawDone = false;
  const toolCalls = [];

  async function appendText(text) {
    if (!text || answerBytes >= MAX_OUTPUT_BYTES) return;
    let accepted = '';
    for (const character of text) {
      const characterBytes = textEncoder.encode(character).length;
      if (answerBytes + characterBytes > MAX_OUTPUT_BYTES) break;
      accepted += character;
      answerBytes += characterBytes;
    }
    answer += accepted;
    if (draftAvailable && accepted && (
      answer.length >= nextDraftAt
      || Date.now() - lastDraftAt >= DRAFT_REFRESH_MS
    )) {
      nextDraftAt = answer.length + DRAFT_STEP_CHARS;
      lastDraftAt = Date.now();
      try {
        await onDraft(answer);
      } catch (error) {
        draftAvailable = false;
        console.warn('Rich draft update failed; continuing without further previews:', {
          message: error?.description || error?.message || 'draft unavailable',
        });
      }
    }
  }

  async function consumeEvent(eventText) {
    const event = parseSseEvent(eventText);
    if (!event) return;
    eventCount += 1;
    if (event.__streamDone) {
      sawDone = true;
      return;
    }
    if (event.error) {
      const error = new Error('Sarvam reported a streaming error.');
      error.code = event.error?.code || 'stream_error';
      error.status = Number(event.error?.status) || null;
      error.providerMessage = event.error?.message || event.error?.detail
        || 'Sarvam reported an error inside the SSE stream.';
      error.requestId = event.error?.request_id || event.error?.requestId || null;
      throw error;
    }

    // Some compatible streams place final text outside choices. Support these
    // explicit text fields without treating metadata/usage as user-visible text.
    if (typeof event.output_text === 'string') await appendText(event.output_text);
    if (typeof event.response?.output_text === 'string') await appendText(event.response.output_text);

    const choices = Array.isArray(event.choices) ? event.choices : [];
    choiceCount += choices.length;
    for (const choice of choices) {
      await appendText(extractChoiceText(choice));
      const delta = choice?.delta || {};
      if (Array.isArray(delta.tool_calls)) addToolCallDelta(toolCalls, delta.tool_calls);
      if (typeof choice?.finish_reason === 'string') finishReason = choice.finish_reason;
    }
  }

  const decoder = new TextDecoder();
  let stopped = false;
  let streamFailure = null;
  try {
    for await (const chunk of response.body) {
      try {
        if (await isStopped()) {
          stopped = true;
          break;
        }
      } catch {
        // A transient DB read failure must not discard the in-flight answer.
      }

      buffer += decoder.decode(chunk, { stream: true });
      // Normalize complete CRLF sequences after appending, so a CRLF split
      // across network chunks cannot corrupt the SSE frame boundary.
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        await consumeEvent(frame);
      }

      if (draftAvailable && Date.now() - lastDraftAt >= DRAFT_REFRESH_MS) {
        lastDraftAt = Date.now();
        try {
          await onKeepAlive();
        } catch (error) {
          draftAvailable = false;
          console.warn('Rich draft keep-alive failed; continuing without further previews:', {
            message: error?.description || error?.message || 'draft unavailable',
          });
        }
      }
      if (answerBytes >= MAX_OUTPUT_BYTES) break;
    }
  } catch (cause) {
    streamFailure = cause;
    console.error('Sarvam SSE response body failed while streaming:', {
      name: cause?.name || null,
      code: cause?.code || null,
      message: cause?.message || 'stream body read failed',
      receivedBytes: answerBytes,
      receivedCharacters: answer.length,
      eventCount,
      choiceCount,
      finishReason,
      sawDone,
    });
  }

  buffer += decoder.decode();
  buffer = buffer.replace(/\r\n/g, '\n');
  if (!streamFailure && !stopped && buffer.trim()) await consumeEvent(buffer);
  if (stopped) return { stopped: true, content: answer, toolCalls: [], finishReason: 'stopped' };

  if (streamFailure && !answer.trim() && !toolCalls.length) {
    if (streamFailure.status || streamFailure.providerMessage) throw streamFailure;
    const error = new Error(streamFailure?.message || 'The Sarvam SSE connection closed before any response content arrived.');
    error.name = streamFailure?.name || 'StreamTransportError';
    error.code = streamFailure?.code || 'stream_transport_error';
    error.status = 0;
    error.cause = streamFailure;
    error.providerMessage = 'The HTTP request was accepted, but the streaming response connection failed before content arrived.';
    error.requestId = response.headers?.get?.('x-request-id') || null;
    throw error;
  }

  const completedToolCalls = toolCalls.filter((call) => call.id && call.function.name);
  if (!answer.trim() && !completedToolCalls.length) {
    const error = new Error('Sarvam returned a successful HTTP response but the stream contained no usable text or tool call.');
    error.code = 'empty_stream_response';
    error.status = response.status;
    error.providerMessage = 'No text or tool-call payload was found in the streamed response. '
      + 'Events: ' + eventCount + '; choices: ' + choiceCount
      + '; finish_reason: ' + (finishReason || 'not received')
      + '; done_marker: ' + (sawDone ? 'received' : 'not received') + '.';
    error.requestId = response.headers?.get?.('x-request-id') || null;
    throw error;
  }

  return {
    stopped: false,
    content: answer.trim(),
    toolCalls: completedToolCalls,
    finishReason,
    incomplete: !finishReason || finishReason === 'length' || answerBytes >= MAX_OUTPUT_BYTES || Boolean(streamFailure),
    streamError: streamFailure ? {
      code: streamFailure?.code || 'stream_transport_error',
      status: streamFailure?.status || null,
      providerMessage: streamFailure?.providerMessage || null,
      requestId: streamFailure?.requestId || null,
      message: streamFailure?.message || 'The streaming connection ended unexpectedly.',
      name: streamFailure?.name || null,
    } : null,
  };
}
