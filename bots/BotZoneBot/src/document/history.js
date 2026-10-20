// Simple snapshot-based undo/redo. Every meaningful change pushes a deep
// clone of the previous document onto `past`. Rapid keystrokes within the
// same block are coalesced (see `coalesce`) so undo doesn't fire once per
// character.

export function createHistory() {
  return { past: [], future: [], lastKey: null, lastAt: 0 }
}

const COALESCE_WINDOW_MS = 700

export function pushHistory(history, previousDoc, { coalesceKey } = {}) {
  const now = Date.now()
  const canCoalesce =
    coalesceKey &&
    coalesceKey === history.lastKey &&
    now - history.lastAt < COALESCE_WINDOW_MS

  if (!canCoalesce) {
    history.past.push(structuredClone(previousDoc))
    // Cap history so long editing sessions don't grow memory unbounded.
    if (history.past.length > 100) history.past.shift()
  }
  history.lastKey = coalesceKey || null
  history.lastAt = now
  history.future = []
}

export function undo(history, currentDoc) {
  if (!history.past.length) return null
  const previous = history.past.pop()
  history.future.push(structuredClone(currentDoc))
  history.lastKey = null
  return previous
}

export function redo(history, currentDoc) {
  if (!history.future.length) return null
  const next = history.future.pop()
  history.past.push(structuredClone(currentDoc))
  history.lastKey = null
  return next
}

export const canUndo = (history) => history.past.length > 0
export const canRedo = (history) => history.future.length > 0
