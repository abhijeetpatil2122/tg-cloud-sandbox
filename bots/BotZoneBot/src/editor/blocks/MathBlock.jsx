import React, { useMemo } from 'react'
import katex from 'katex'
import { useDocument } from '../../store/DocumentContext.jsx'

function renderMath(expression) {
  if (!expression.trim()) return { html: '', error: null }
  try {
    const html = katex.renderToString(expression, { throwOnError: true, displayMode: true })
    return { html, error: null }
  } catch (err) {
    return { html: '', error: err.message }
  }
}

export default function MathBlock({ block }) {
  const { updateBlock } = useDocument()
  const { html, error } = useMemo(() => renderMath(block.expression), [block.expression])

  return (
    <div className="math-block">
      <textarea
        value={block.expression}
        placeholder="LaTeX expression, e.g. \\frac{a}{b} = c"
        spellCheck={false}
        onChange={(e) => updateBlock(block.id, { expression: e.target.value }, { coalesceKey: `math:${block.id}` })}
      />
      {html && <div className="math-preview" dangerouslySetInnerHTML={{ __html: html }} />}
      {error && <div className="math-error">Can't render this yet: {error}</div>}
      <div className="hint">Rendered live below — Telegram renders the same LaTeX when the message is posted.</div>
    </div>
  )
}
