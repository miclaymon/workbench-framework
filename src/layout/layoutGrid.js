// Recursive split-view layout engine (the VS Code "grid").
//
// A layout is a tree of two node kinds:
//   leaf:   { type:'leaf',   id, tabs:[...], activeTabId }
//   branch: { type:'branch', id, direction:'row'|'column', children:[node...], sizes:[weight...] }
//
// `direction:'row'` lays children out left-to-right (vertical sashes, resize width);
// `direction:'column'` stacks them top-to-bottom (horizontal sashes, resize height).
// `sizes` are positive flex-grow weights parallel to `children` — they need not sum to
// anything; the renderer divides space proportionally, so resizing/splitting only ever
// adjusts neighbouring weights and never requires normalisation.
//
// All structural ops return the (possibly new) root so the caller can assign it back:
//   root.value = insertLeafBeside(root.value, ...)
// Mutations are otherwise in place, which Vue's deep reactivity picks up.

let _seq = 0
function gridId(prefix = 'node') {
  return `${prefix}-${Date.now().toString(36)}-${(_seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function isLeaf(n)   { return n?.type === 'leaf' }
export function isBranch(n) { return n?.type === 'branch' }

export function createLeaf({ tabs = [], activeTabId, id, tabPreviews, locked } = {}) {
  return {
    type: 'leaf',
    id: id ?? gridId('grp'),
    tabs,
    activeTabId: activeTabId ?? tabs[0]?.id ?? null,
    tabPreviews: tabPreviews !== false,
    locked: locked ?? false,
  }
}

export function createBranch(direction, children, sizes) {
  return {
    type: 'branch',
    id: gridId('br'),
    direction,
    children,
    sizes: sizes ?? children.map(() => 1),
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function findLeaf(node, id) {
  if (!node) return null
  if (isLeaf(node)) return node.id === id ? node : null
  for (const c of node.children) { const f = findLeaf(c, id); if (f) return f }
  return null
}

export function collectLeaves(node, acc = []) {
  if (!node) return acc
  if (isLeaf(node)) acc.push(node)
  else node.children.forEach(c => collectLeaves(c, acc))
  return acc
}

export function firstLeaf(node) {
  return collectLeaves(node)[0] ?? null
}

export function leafCount(node) {
  return collectLeaves(node).length
}

// Locate the branch that directly contains `id`, plus the index within it.
// Returns { parent, index } where parent is null when `id` is the root.
export function findParent(root, id, parent = null, index = -1) {
  if (!root) return null
  if (root.id === id) return { parent, index }
  if (isBranch(root)) {
    for (let i = 0; i < root.children.length; i++) {
      const r = findParent(root.children[i], id, root, i)
      if (r) return r
    }
  }
  return null
}

// Find the leaf holding a tab with the given id → { leaf, tab } or null.
export function findTab(node, tabId) {
  for (const leaf of collectLeaves(node)) {
    const tab = leaf.tabs.find(t => t.id === tabId)
    if (tab) return { leaf, tab }
  }
  return null
}

// ── Structural mutations ──────────────────────────────────────────────────────

const SIDE_DIRECTION = { left: 'row', right: 'row', top: 'column', bottom: 'column' }
const SIDE_BEFORE    = { left: true, top: true, right: false, bottom: false }

// Insert `newLeaf` adjacent to `targetLeafId` on the given side, creating or
// extending branches as needed. Returns the new root.
export function insertLeafBeside(root, targetLeafId, side, newLeaf) {
  const direction = SIDE_DIRECTION[side]
  const before    = SIDE_BEFORE[side]
  const loc = findParent(root, targetLeafId)
  if (!loc) return root

  const { parent, index } = loc
  const target = parent ? parent.children[index] : root

  // Target is the whole root → wrap it in a fresh branch.
  if (!parent) {
    const children = before ? [newLeaf, target] : [target, newLeaf]
    return createBranch(direction, children)
  }

  // Same orientation → splice the new leaf in beside the target, splitting its weight.
  if (parent.direction === direction) {
    const w = parent.sizes[index] ?? 1
    const insertIdx = before ? index : index + 1
    parent.children.splice(insertIdx, 0, newLeaf)
    parent.sizes[index] = w / 2
    parent.sizes.splice(insertIdx, 0, w / 2)
    return root
  }

  // Cross orientation → replace the target slot with a nested branch.
  const children = before ? [newLeaf, target] : [target, newLeaf]
  parent.children[index] = createBranch(direction, children)
  return root
}

// Remove a leaf, collapsing any branch left with a single child. Returns the new
// root. Removing the only remaining leaf is a no-op (callers must keep one group).
export function removeLeaf(root, leafId) {
  const loc = findParent(root, leafId)
  if (!loc || !loc.parent) return root

  const { parent, index } = loc
  parent.children.splice(index, 1)
  parent.sizes.splice(index, 1)

  if (parent.children.length > 1) return root

  // Collapse the now single-child branch into its surviving child.
  const survivor = parent.children[0]
  const grand = findParent(root, parent.id)
  if (!grand || !grand.parent) return survivor
  grand.parent.children[grand.index] = survivor
  return root
}

// Move every tab into the first leaf and make it the sole group. Returns the
// merged leaf as the new root.
export function mergeAll(root) {
  const leaves = collectLeaves(root)
  if (leaves.length <= 1) return root
  const [keep, ...rest] = leaves
  for (const l of rest) keep.tabs.push(...l.tabs)
  keep.activeTabId ??= keep.tabs[0]?.id ?? null
  return keep
}

// ── Presets ───────────────────────────────────────────────────────────────────
//
// Reshape the existing groups into exactly `count` slots (merging surplus groups'
// tabs into the last slot, or padding with empty groups), then hand the slots to
// `build` to assemble the target tree.

function reshape(root, count, build) {
  const leaves = collectLeaves(root)
  let slots
  if (leaves.length >= count) {
    slots = leaves.slice(0, count)
    for (const surplus of leaves.slice(count)) {
      slots[count - 1].tabs.push(...surplus.tabs)
    }
    slots[count - 1].activeTabId ??= slots[count - 1].tabs[0]?.id ?? null
  } else {
    slots = [...leaves]
    while (slots.length < count) slots.push(createLeaf({ tabs: [] }))
  }
  return build(slots)
}

export const PRESETS = {
  single:      root => reshape(root, 1, s => s[0]),
  twoColumns:  root => reshape(root, 2, s => createBranch('row', s)),
  twoRows:     root => reshape(root, 2, s => createBranch('column', s)),
  threeColumns:root => reshape(root, 3, s => createBranch('row', s)),
  grid:        root => reshape(root, 4, s => createBranch('column', [
                  createBranch('row', [s[0], s[1]]),
                  createBranch('row', [s[2], s[3]]),
                ])),
}

export function applyPreset(root, name) {
  const fn = PRESETS[name]
  return fn ? fn(root) : root
}
