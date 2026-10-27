// Pure helpers for editing a *tree* of blocks. A "container" is any node that
// has an `id` and a `children` array: a blockquote, a details block, or a
// list *item* (list items aren't blocks, but they hold nested blocks too).
// Every operation here returns a new tree and never mutates its input.
import { BLOCK } from './schema.js'

function mapItem(item, fn) {
  const patched = fn(item)
  return Array.isArray(patched.children) ? { ...patched, children: mapNodes(patched.children, fn) } : patched
}

function descend(node, fn) {
  let out = node
  if (Array.isArray(out.children)) out = { ...out, children: mapNodes(out.children, fn) }
  if (out.type === BLOCK.LIST) out = { ...out, items: out.items.map((item) => mapItem(item, fn)) }
  return out
}

/** Visits every block AND every list item, anywhere in the tree. fn(node) must return a node. */
export function mapNodes(blocks, fn) {
  return blocks.map((block) => descend(fn(block), fn))
}

/** Applies arrFn to every sibling array in the tree — the top level and every children array. */
export function mapArrays(blocks, arrFn) {
  return arrFn(blocks).map((block) => {
    let out = block
    if (Array.isArray(out.children)) out = { ...out, children: mapArrays(out.children, arrFn) }
    if (out.type === BLOCK.LIST) {
      out = {
        ...out,
        items: out.items.map((item) => (Array.isArray(item.children) ? { ...item, children: mapArrays(item.children, arrFn) } : item))
      }
    }
    return out
  })
}

export function findNode(blocks, id) {
  for (const block of blocks) {
    if (block.id === id) return block
    if (Array.isArray(block.children)) {
      const hit = findNode(block.children, id)
      if (hit) return hit
    }
    if (block.type === BLOCK.LIST) {
      for (const item of block.items) {
        if (item.id === id) return item
        if (Array.isArray(item.children)) {
          const hit = findNode(item.children, id)
          if (hit) return hit
        }
      }
    }
  }
  return null
}

export const updateNode = (blocks, id, patch) => mapNodes(blocks, (n) => (n.id === id ? { ...n, ...patch } : n))

export const removeBlock = (blocks, id) => mapArrays(blocks, (arr) => arr.filter((b) => b.id !== id))

export function moveBlockInTree(blocks, id, direction) {
  return mapArrays(blocks, (arr) => {
    const index = arr.findIndex((b) => b.id === id)
    if (index < 0) return arr
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= arr.length) return arr
    const next = [...arr]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
}

/** Inserts `block` right after the block `afterId`, in whichever sibling array holds it. Appends to the top level if afterId isn't found. */
export function insertAfter(blocks, afterId, block) {
  if (!afterId || !findNode(blocks, afterId)) return [...blocks, block]
  return mapArrays(blocks, (arr) => {
    const index = arr.findIndex((b) => b.id === afterId)
    if (index < 0) return arr
    const next = [...arr]
    next.splice(index + 1, 0, block)
    return next
  })
}

/** Appends `block` to the end of a container's children (container = blockquote / details / list item id). */
export const appendChild = (blocks, containerId, block) =>
  mapNodes(blocks, (n) => (n.id === containerId ? { ...n, children: [...(n.children || []), block] } : n))