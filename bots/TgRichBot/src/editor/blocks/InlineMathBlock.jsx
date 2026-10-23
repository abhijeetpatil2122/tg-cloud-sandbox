import React, { useMemo } from 'react'
import katex from 'katex'
import { useDocument } from '../../store/DocumentContext.jsx'

function renderInline(expression) {
  if (!expression.trim()) return { html: '', error: null }
  try {
    return { html: katex.renderToString(expression, { throwOnError: true, displayMode: false }), error: null }
  } catch (err) {
    return { html: '', error: err.message }
  }
}

// "Inline math" is a different *placement* of the same math expression, not
// a text-formatting mark: a standalone Math block renders centered like a
// display equation, while this one sits in a normal left-aligned paragraph
// as one line of text (scrolling sideways if it's long). See the BLOCK.INLINE_MATH
// case in richMessageBuilder.js for how it's sent.
export default function InlineMathBlock({ block }) {
  const { updateBlock } = useDocument()
  const { html, error } = useMemo(() => renderInline(block.expression), [block.expression])

  return (
    <div className="inline-math-block">
      <input
        value={block.expression}
        placeholder="LaTeX, e.g. E = mc^2"
        spellCheck={false}
        onChange={(e) => updateBlock(block.id, { expression: e.target.value }, { coalesceKey: `imath:${block.id}` })}
      />
      {html && <div className="inline-math-preview" dangerouslySetInnerHTML={{ __html: html }} />}
      {error && <div className="math-error">Can't render this yet: {error}</div>}
    </div>
  )
}
