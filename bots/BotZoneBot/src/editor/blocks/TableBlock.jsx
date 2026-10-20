import React from 'react'
import Icon from '../../components/Icon.jsx'
import RichTextInput from './shared/RichTextInput.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'

const ALIGNS = ['left', 'center', 'right']

export default function TableBlock({ block, activeInputRef }) {
  const {
    updateTableCell,
    addTableRow,
    removeTableRow,
    addTableColumn,
    removeTableColumn,
    setTableOption
  } = useDocument()

  const colCount = block.rows[0]?.length || 0

  function cycleAlign(colIndex) {
    const current = block.align[colIndex] || 'left'
    const next = ALIGNS[(ALIGNS.indexOf(current) + 1) % ALIGNS.length]
    const align = [...block.align]
    align[colIndex] = next
    setTableOption(block.id, { align })
  }

  return (
    <div>
      <div className="table-scroll">
        <table
          className={`rich-table ${block.bordered ? 'bordered' : ''} ${block.striped ? 'striped' : ''} ${block.compact ? 'compact' : ''}`}
        >
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => {
                  const Tag = cell.isHeader ? 'th' : 'td'
                  return (
                    <Tag key={colIndex} style={{ textAlign: block.align[colIndex] || 'left' }}>
                      <RichTextInput
                        html={cell.text}
                        multiline={false}
                        placeholder=""
                        onChange={(text) => updateTableCell(block.id, rowIndex, colIndex, { text })}
                        activeInputRef={activeInputRef}
                      />
                    </Tag>
                  )
                })}
                <td style={{ border: 'none', padding: '0 0 0 4px' }}>
                  {block.rows.length > 1 && (
                    <button className="icon-btn" type="button" onClick={() => removeTableRow(block.id, rowIndex)}>
                      <Icon name="minus" size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-toolbar">
        <button className="chip" type="button" onClick={() => addTableRow(block.id)}>+ row</button>
        <button className="chip" type="button" onClick={() => addTableColumn(block.id)}>+ column</button>
        {colCount > 1 && (
          <button className="chip" type="button" onClick={() => removeTableColumn(block.id, colCount - 1)}>
            − column
          </button>
        )}
        {Array.from({ length: colCount }).map((_, i) => (
          <button key={i} className="chip" type="button" onClick={() => cycleAlign(i)}>
            col {i + 1}: {block.align[i] || 'left'}
          </button>
        ))}
        <button
          className={`chip ${block.bordered ? 'active' : ''}`}
          type="button"
          onClick={() => setTableOption(block.id, { bordered: !block.bordered })}
        >
          Borders
        </button>
        <button
          className={`chip ${block.striped ? 'active' : ''}`}
          type="button"
          onClick={() => setTableOption(block.id, { striped: !block.striped })}
        >
          Striped
        </button>
        <button
          className={`chip ${block.compact ? 'active' : ''}`}
          type="button"
          onClick={() => setTableOption(block.id, { compact: !block.compact })}
        >
          Compact
        </button>
      </div>

      <input
        className="table-caption-input"
        placeholder="Caption (optional)"
        value={block.caption}
        onChange={(e) => setTableOption(block.id, { caption: e.target.value })}
      />
    </div>
  )
}
