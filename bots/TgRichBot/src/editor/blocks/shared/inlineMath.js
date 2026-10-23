import katex from 'katex'

/** Renders LaTeX to HTML for live preview — inline (not display) mode, matching how it sits inside running text. */
export function renderInlineMathHtml(expression) {
  try {
    return katex.renderToString(expression, { throwOnError: false, displayMode: false })
  } catch {
    return expression
  }
}