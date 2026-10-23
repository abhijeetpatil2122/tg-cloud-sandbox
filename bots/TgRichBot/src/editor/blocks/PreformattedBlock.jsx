import React from 'react'
import { useDocument } from '../../store/DocumentContext.jsx'
import { CODE_LANGUAGES } from '../../document/schema.js'

export default function PreformattedBlock({ block }) {
  const { updateBlock } = useDocument()
  return (
    <div className="preformatted-block">
      <select
        className="lang-select"
        value={block.language}
        onChange={(e) => updateBlock(block.id, { language: e.target.value })}
      >
        {CODE_LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
      <textarea
        value={block.code}
        placeholder="Paste or write code…"
        spellCheck={false}
        onChange={(e) => updateBlock(block.id, { code: e.target.value }, { coalesceKey: `code:${block.id}` })}
      />
    </div>
  )
}
