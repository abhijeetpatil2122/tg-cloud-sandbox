import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react'
import { createInitialDocument, createBlock, isDocumentEmpty } from '../document/schema.js'
import { createHistory, pushHistory, undo as undoHistory, redo as redoHistory, canUndo, canRedo } from '../document/history.js'

const DocumentCtx = createContext(null)

export function DocumentProvider({ children }) {
  const [doc, setDoc] = useState(createInitialDocument)
  const historyRef = useRef(createHistory())
  const [, forceRender] = useState(0)
  const bump = () => forceRender((n) => n + 1)

  const commit = useCallback((updater, { coalesceKey } = {}) => {
    setDoc((prev) => {
      const next = updater(prev)
      pushHistory(historyRef.current, prev, { coalesceKey })
      return next
    })
    bump()
  }, [])

  const findIndex = (blocks, id) => blocks.findIndex((b) => b.id === id)

  const addBlock = useCallback(
    (type, props = {}, afterId = null) => {
      const block = createBlock(type, props)
      commit((prev) => {
        const blocks = [...prev.blocks]
        const index = afterId ? findIndex(blocks, afterId) : blocks.length - 1
        blocks.splice(index + 1, 0, block)
        return { ...prev, blocks }
      })
      return block.id
    },
    [commit]
  )

  const updateBlock = useCallback(
    (id, patch, { coalesceKey } = {}) => {
      commit(
        (prev) => ({
          ...prev,
          blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
        }),
        { coalesceKey: coalesceKey || `block:${id}` }
      )
    },
    [commit]
  )

  const deleteBlock = useCallback(
    (id) => {
      commit((prev) => {
        const blocks = prev.blocks.filter((b) => b.id !== id)
        return { ...prev, blocks: blocks.length ? blocks : [createBlock('paragraph')] }
      })
    },
    [commit]
  )

  const moveBlock = useCallback(
    (id, direction) => {
      commit((prev) => {
        const blocks = [...prev.blocks]
        const index = findIndex(blocks, id)
        const target = direction === 'up' ? index - 1 : index + 1
        if (target < 0 || target >= blocks.length) return prev
        ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
        return { ...prev, blocks }
      })
    },
    [commit]
  )

  // ---- List item helpers ----
  const mapListBlock = (prev, id, fn) => ({
    ...prev,
    blocks: prev.blocks.map((b) => (b.id === id ? fn(b) : b))
  })

  const addListItem = useCallback(
    (blockId, afterItemId) => {
      commit((prev) =>
        mapListBlock(prev, blockId, (b) => {
          const items = [...b.items]
          const index = afterItemId ? items.findIndex((i) => i.id === afterItemId) : items.length - 1
          items.splice(index + 1, 0, { id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, html: '', checked: false })
          return { ...b, items }
        })
      )
    },
    [commit]
  )

  const updateListItem = useCallback(
    (blockId, itemId, patch) => {
      commit(
        (prev) =>
          mapListBlock(prev, blockId, (b) => ({
            ...b,
            items: b.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i))
          })),
        { coalesceKey: `listitem:${itemId}` }
      )
    },
    [commit]
  )

  const removeListItem = useCallback(
    (blockId, itemId) => {
      commit((prev) =>
        mapListBlock(prev, blockId, (b) => {
          const items = b.items.filter((i) => i.id !== itemId)
          return { ...b, items: items.length ? items : b.items.slice(0, 1) }
        })
      )
    },
    [commit]
  )

  // ---- Table helpers ----
  const mapTableBlock = (prev, id, fn) => ({
    ...prev,
    blocks: prev.blocks.map((b) => (b.id === id ? fn(b) : b))
  })

  const updateTableCell = useCallback(
    (blockId, rowIndex, colIndex, patch) => {
      commit(
        (prev) =>
          mapTableBlock(prev, blockId, (b) => {
            const rows = b.rows.map((row, r) =>
              r !== rowIndex ? row : row.map((cell, c) => (c !== colIndex ? cell : { ...cell, ...patch }))
            )
            return { ...b, rows }
          }),
        { coalesceKey: `cell:${blockId}:${rowIndex}:${colIndex}` }
      )
    },
    [commit]
  )

  const addTableRow = useCallback(
    (blockId) => {
      commit((prev) =>
        mapTableBlock(prev, blockId, (b) => {
          const cols = b.rows[0]?.length || 2
          const row = Array.from({ length: cols }, () => ({ text: '', isHeader: false }))
          return { ...b, rows: [...b.rows, row] }
        })
      )
    },
    [commit]
  )

  const removeTableRow = useCallback(
    (blockId, rowIndex) => {
      commit((prev) =>
        mapTableBlock(prev, blockId, (b) => {
          if (b.rows.length <= 1) return b
          return { ...b, rows: b.rows.filter((_, r) => r !== rowIndex) }
        })
      )
    },
    [commit]
  )

  const addTableColumn = useCallback(
    (blockId) => {
      commit((prev) =>
        mapTableBlock(prev, blockId, (b) => ({
          ...b,
          align: [...b.align, 'left'],
          rows: b.rows.map((row, r) => [...row, { text: '', isHeader: r === 0 }])
        }))
      )
    },
    [commit]
  )

  const removeTableColumn = useCallback(
    (blockId, colIndex) => {
      commit((prev) =>
        mapTableBlock(prev, blockId, (b) => {
          if (b.rows[0].length <= 1) return b
          return {
            ...b,
            align: b.align.filter((_, i) => i !== colIndex),
            rows: b.rows.map((row) => row.filter((_, c) => c !== colIndex))
          }
        })
      )
    },
    [commit]
  )

  const setTableOption = useCallback(
    (blockId, patch) => {
      commit((prev) => mapTableBlock(prev, blockId, (b) => ({ ...b, ...patch })))
    },
    [commit]
  )

  const setMediaSource = useCallback(
    (blockId, source) => {
      commit((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, source } : b))
      }))
    },
    [commit]
  )

  const undo = useCallback(() => {
    const previous = undoHistory(historyRef.current, doc)
    if (previous) setDoc(previous)
    bump()
  }, [doc])

  const redo = useCallback(() => {
    const next = redoHistory(historyRef.current, doc)
    if (next) setDoc(next)
    bump()
  }, [doc])

  const value = useMemo(
    () => ({
      doc,
      isEmpty: isDocumentEmpty(doc),
      addBlock,
      updateBlock,
      deleteBlock,
      moveBlock,
      addListItem,
      updateListItem,
      removeListItem,
      updateTableCell,
      addTableRow,
      removeTableRow,
      addTableColumn,
      removeTableColumn,
      setTableOption,
      setMediaSource,
      undo,
      redo,
      canUndo: canUndo(historyRef.current),
      canRedo: canRedo(historyRef.current)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc]
  )

  return <DocumentCtx.Provider value={value}>{children}</DocumentCtx.Provider>
}

export function useDocument() {
  const ctx = useContext(DocumentCtx)
  if (!ctx) throw new Error('useDocument must be used within DocumentProvider')
  return ctx
}
