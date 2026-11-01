import { fetch } from 'sdk';

const SARVAM_ENDPOINT = 'https://api.sarvam.ai/v2/chat/completions';
const MODEL = 'sarvam-105b';
const MAX_OUTPUT_CHARS = 30000;
const DRAFT_STEP_CHARS = 140;

function parseSseEvent(eventText) {
  const data = eventText
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  if (!data || data === '[DONE]') return null;
  try { return JSON.parse(data); } catch { return null; }
}

function extractDelta(event) {
  const delta = event?.choices?.[0]?.delta;
  return typeof delta?.content === 'string' ? delta.content : '';
}

export async function streamSarvamReply({ apiKey, messages, onDraft }) {
  const response = await fetch(SARVAM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    try { await response.text(); } catch {}
    const error = new Error('Sarvam request failed');
    error.status = status;
    throw error;
  }

  if (!response.body) throw new Error('Sarvam returned no streaming response body');

  let buffer = '';
  let answer = '';
  let nextDraftAt = DRAFT_STEP_CHARS;
  let draftAvailable = true;

  async function consumeEvent(eventText) {
    const event = parseSseEvent(eventText);
    if (!event) return;

    const delta = extractDelta(event);
    if (!delta || answer.length >= MAX_OUTPUT_CHARS) return;

    answer = (answer + delta).slice(0, MAX_OUTPUT_CHARS);

    if (draftAvailable && answer.length >= nextDraftAt) {
      nextDraftAt = answer.length + DRAFT_STEP_CHARS;
      try {
        await onDraft(answer);
      } catch (error) {
        draftAvailable = false;
        console.warn('Rich draft update failed; continuing without further previews:', {
          message: error?.description || error?.message || 'draft update failed',
        });
      }
    }
  }

  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true }).replace(/\\r\\n/g, '\\n');

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const eventText = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      await consumeEvent(eventText);
    }

    if (answer.length >= MAX_OUTPUT_CHARS) break;
  }

  buffer += decoder.decode();
  if (buffer.trim()) await consumeEvent(buffer);

  if (!answer.trim()) throw new Error('Sarvam completed without a text response');
  return answer.trim();
}
