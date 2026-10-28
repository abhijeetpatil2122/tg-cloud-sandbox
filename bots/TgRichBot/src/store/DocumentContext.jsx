import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react'
import { createInitialDocument, createBlock, isDocumentEmpty, uid } from '../document/schema.js'
import { createHistory, pushHistory, undo as undoHistory, redo as redoHistory, canUndo, canRedo } from '../document/history.js'
import { mapNodes, updateNode, removeBlock, moveBlockInTree, insertAfter, appendChild, findNode } from '../document/tree.js'

const DocumentCtx = createContext(null)

export function DocumentProvider({ children }) {
  const [doc, setDoc] = useState(createInitialDocument)
  const historyRef = useRef(createHistory())
  const [, forceRender] = useState(0)
  const bump = () => forceRender((n) => n + 1)

  // Which block the user last focused/tapped (innermost one wins, see
  // BlockRenderer). A ref, not state — it changes on every focus and nothing
  // needs to re-render because of it; the toolbar just reads it on tap.
  const activeBlockRef = useRef(null)
  const setActiveBlock = useCallback((id) => {
    activeBlockRef.current = id
  }, [])
  const getActiveBlockId = useCallback(() => activeBlockRef.current, [])

  const commit = useCallback((updater, { coalesceKey } = {}) => {
    setDoc((prev) => {
      const next = updater(prev)
      pushHistory(historyRef.current, prev, { coalesceKey })
      return next
    })
    bump()
  }, [])

  // Every edit goes through the tree helpers, so it works the same whether
  // the target sits at the top level or nested in a quote / list item / details.
  const editNode = (prev, id, fn) => ({ ...prev, blocks: mapNodes(prev.blocks, (n) => (n.id === id ? fn(n) : n)) })

  const addBlock = useCallback(
    (type, props = {}, afterId = null) => {
      const block = createBlock(type, props)
      commit((prev) => ({ ...prev, blocks: insertAfter(prev.blocks, afterId, block) }))
      return block.id
    },
    [commit]
  )

  /** Adds a block as the last child of a container (a blockquote, details block, or list item id). */
  const addChildBlock = useCallback(
    (containerId, type, props = {}) => {
      const block = createBlock(type, props)
      commit((prev) => ({ ...prev, blocks: appendChild(prev.blocks, containerId, block) }))
      return block.id
    },
    [commit]
  )

  const updateBlock = useCallback(
    (id, patch, { coalesceKey } = {}) => {
      commit((prev) => ({ ...prev, blocks: updateNode(prev.blocks, id, patch) }), { coalesceKey: coalesceKey || `block:${id}` })
    },
    [commit]
  )

  const deleteBlock = useCallback(
    (id) => {
      commit((prev) => {
        const blocks = removeBlock(prev.blocks, id)
        // There must always be something to type into at the top level.
        return { ...prev, blocks: blocks.length ? blocks : [createBlock('paragraph')] }
      })
    },
    [commit]
  )

  const moveBlock = useCallback(
    (id, direction) => {
      commit((prev) => ({ ...prev, blocks: moveBlockInTree(prev.blocks, id, direction) }))
    },
    [commit]
  )

  // ---- Lists ----
  const addListItem = useCallback(
    (blockId, afterItemId) => {
      commit((prev) =>
        editNode(prev, blockId, (b) => {
          const items = [...b.items]
          const index = afterItemId ? items.findIndex((i) => i.id === afterItemId) : items.length - 1
          items.splice(index + 1, 0, { id: uid('li'), html: '', checked: false, children: [] })
          return { ...b, items }
        })
      )
    },
    [commit]
  )

  const updateListItem = useCallback(
    (blockId, itemId, patch) => {
      commit((prev) => ({ ...prev, blocks: updateNode(prev.blocks, itemId, patch) }), { coalesceKey: `listitem:${itemId}` })
    },
    [commit]
  )

  const removeListItem = useCallback(
    (blockId, itemId) => {
      commit((prev) =>
        editNode(prev, blockId, (b) => {
          const items = b.items.filter((i) => i.id !== itemId)
          return { ...b, items: items.length ? items : b.items.slice(0, 1) }
        })
      )
    },
    [commit]
  )

  // ---- Tables ----
  const updateTableCell = useCallback(
    (blockId, rowIndex, colIndex, patch) => {
      commit(
        (prev) =>
          editNode(prev, blockId, (b) => ({
            ...b,
            rows: b.rows.map((row, r) =>
              r !== rowIndex ? row : row.map((cell, c) => (c !== colIndex ? cell : { ...cell, ...patch }))
            )
          })),
        { coalesceKey: `cell:${blockId}:${rowIndex}:${colIndex}` }
      )
    },
    [commit]
  )

  const addTableRow = useCallback(
    (blockId) => {
      commit((prev) =>
        editNode(prev, blockId, (b) => {
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
        editNode(prev, blockId, (b) => (b.rows.length <= 1 ? b : { ...b, rows: b.rows.filter((_, r) => r !== rowIndex) }))
      )
    },
    [commit]
  )

  const addTableColumn = useCallback(
    (blockId) => {
      commit((prev) =>
        editNode(prev, blockId, (b) =>
          // The API allows at most 20 columns per table.
          b.rows[0].length >= 20
            ? b
            : { ...b, align: [...b.align, 'left'], rows: b.rows.map((row, r) => [...row, { text: '', isHeader: r === 0 }]) }
        )
      )
    },
    [commit]
  )

  const removeTableColumn = useCallback(
    (blockId, colIndex) => {
      commit((prev) =>
        editNode(prev, blockId, (b) =>
          b.rows[0].length <= 1
            ? b
            : { ...b, align: b.align.filter((_, i) => i !== colIndex), rows: b.rows.map((row) => row.filter((_, c) => c !== colIndex)) }
        )
      )
    },
    [commit]
  )

  const setTableOption = useCallback(
    (blockId, patch) => {
      commit((prev) => editNode(prev, blockId, (b) => ({ ...b, ...patch })))
    },
    [commit]
  )

  const setMediaSource = useCallback(
    (blockId, source) => {
      commit((prev) => editNode(prev, blockId, (b) => ({ ...b, source })))
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

  const getBlock = useCallback((id) => findNode(doc.blocks, id), [doc])

  const value = useMemo(
    () => ({
      doc,
      isEmpty: isDocumentEmpty(doc),
      getBlock,
      setActiveBlock,
      getActiveBlockId,
      addBlock,
      addChildBlock,
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
