import { describe, it, expect } from 'vitest'
import {
  isLeaf, isBranch, createLeaf, createBranch,
  findLeaf, collectLeaves, firstLeaf, leafCount, findParent, findTab,
  insertLeafBeside, removeLeaf, mergeAll, applyPreset, PRESETS,
} from '../../src/layout/layoutGrid.js'

function tab(id) { return { id, kind: 'text' } }

describe('createLeaf / createBranch', () => {
  it('creates a leaf with defaults', () => {
    const leaf = createLeaf()
    expect(leaf.type).toBe('leaf')
    expect(leaf.tabs).toEqual([])
    expect(leaf.activeTabId).toBeNull()
    expect(leaf.tabPreviews).toBe(true)
    expect(leaf.locked).toBe(false)
    expect(typeof leaf.id).toBe('string')
  })

  it('defaults activeTabId to the first tab', () => {
    const leaf = createLeaf({ tabs: [tab('a'), tab('b')] })
    expect(leaf.activeTabId).toBe('a')
  })

  it('an explicit activeTabId, id, tabPreviews and locked override defaults', () => {
    const leaf = createLeaf({ tabs: [tab('a'), tab('b')], activeTabId: 'b', id: 'fixed-id', tabPreviews: false, locked: true })
    expect(leaf).toMatchObject({ id: 'fixed-id', activeTabId: 'b', tabPreviews: false, locked: true })
  })

  it('generates unique ids across calls', () => {
    const a = createLeaf(), b = createLeaf()
    expect(a.id).not.toBe(b.id)
  })

  it('creates a branch with uniform default weights', () => {
    const [a, b, c] = [createLeaf(), createLeaf(), createLeaf()]
    const branch = createBranch('row', [a, b, c])
    expect(branch.type).toBe('branch')
    expect(branch.direction).toBe('row')
    expect(branch.children).toEqual([a, b, c])
    expect(branch.sizes).toEqual([1, 1, 1])
  })

  it('accepts explicit sizes', () => {
    const branch = createBranch('column', [createLeaf(), createLeaf()], [2, 1])
    expect(branch.sizes).toEqual([2, 1])
  })
})

describe('isLeaf / isBranch', () => {
  it('discriminate correctly, including nullish input', () => {
    const leaf = createLeaf(), branch = createBranch('row', [leaf])
    expect(isLeaf(leaf)).toBe(true)
    expect(isLeaf(branch)).toBe(false)
    expect(isBranch(branch)).toBe(true)
    expect(isBranch(leaf)).toBe(false)
    expect(isLeaf(null)).toBe(false)
    expect(isBranch(undefined)).toBe(false)
  })
})

describe('findLeaf / collectLeaves / firstLeaf / leafCount', () => {
  function tree() {
    const a = createLeaf({ id: 'a', tabs: [tab('t1')] })
    const b = createLeaf({ id: 'b', tabs: [tab('t2')] })
    const c = createLeaf({ id: 'c', tabs: [tab('t3')] })
    const inner = createBranch('column', [b, c])
    inner.id = 'inner'
    const root = createBranch('row', [a, inner])
    root.id = 'root'
    return { root, a, b, c, inner }
  }

  it('findLeaf locates a leaf anywhere in the tree, or returns null', () => {
    const { root, b } = tree()
    expect(findLeaf(root, 'b')).toBe(b)
    expect(findLeaf(root, 'nope')).toBeNull()
    expect(findLeaf(null, 'a')).toBeNull()
  })

  it('findLeaf on a lone leaf root matches only its own id', () => {
    const leaf = createLeaf({ id: 'solo' })
    expect(findLeaf(leaf, 'solo')).toBe(leaf)
    expect(findLeaf(leaf, 'other')).toBeNull()
  })

  it('collectLeaves flattens in depth-first document order', () => {
    const { root, a, b, c } = tree()
    expect(collectLeaves(root)).toEqual([a, b, c])
  })

  it('collectLeaves on null returns an empty array', () => {
    expect(collectLeaves(null)).toEqual([])
  })

  it('firstLeaf / leafCount', () => {
    const { root, a } = tree()
    expect(firstLeaf(root)).toBe(a)
    expect(leafCount(root)).toBe(3)
    expect(firstLeaf(null)).toBeNull()
    expect(leafCount(null)).toBe(0)
  })

  it('findParent locates the direct parent branch and index', () => {
    const { root, inner, b } = tree()
    expect(findParent(root, 'b')).toEqual({ parent: inner, index: 0 })
    expect(findParent(root, 'inner')).toEqual({ parent: root, index: 1 })
  })

  it('findParent on the root id itself returns a null parent', () => {
    const { root } = tree()
    expect(findParent(root, 'root')).toEqual({ parent: null, index: -1 })
  })

  it('findParent returns null for an unknown id', () => {
    const { root } = tree()
    expect(findParent(root, 'nope')).toBeNull()
  })

  it('findTab locates the leaf holding a given tab id', () => {
    const { root, b } = tree()
    const found = findTab(root, 't2')
    expect(found.leaf).toBe(b)
    expect(found.tab).toBe(b.tabs[0])
  })

  it('findTab returns null when the tab does not exist anywhere', () => {
    const { root } = tree()
    expect(findTab(root, 'nope')).toBeNull()
  })
})

describe('insertLeafBeside', () => {
  it('wraps a lone leaf root: side "right" appends after the target', () => {
    const target = createLeaf({ id: 'target' })
    const fresh = createLeaf({ id: 'fresh' })
    const root = insertLeafBeside(target, 'target', 'right', fresh)
    expect(isBranch(root)).toBe(true)
    expect(root.direction).toBe('row')
    expect(root.children).toEqual([target, fresh])
    expect(root.sizes).toEqual([1, 1])
  })

  it('side "left" inserts before the target', () => {
    const target = createLeaf({ id: 'target' })
    const fresh = createLeaf({ id: 'fresh' })
    const root = insertLeafBeside(target, 'target', 'left', fresh)
    expect(root.children).toEqual([fresh, target])
  })

  it('side "top"/"bottom" use a column direction', () => {
    const target = createLeaf({ id: 'target' })
    const top = insertLeafBeside(target, 'target', 'top', createLeaf({ id: 'top' }))
    expect(top.direction).toBe('column')
    expect(top.children.map(c => c.id)).toEqual(['top', 'target'])

    const bottom = insertLeafBeside(createLeaf({ id: 'target' }), 'target', 'bottom', createLeaf({ id: 'bot' }))
    expect(bottom.direction).toBe('column')
    expect(bottom.children.map(c => c.id)).toEqual(['target', 'bot'])
  })

  it('returns the same root unchanged when the target id does not exist', () => {
    const root = createLeaf({ id: 'solo' })
    const result = insertLeafBeside(root, 'missing', 'right', createLeaf())
    expect(result).toBe(root)
  })

  it('same-orientation insert splices in and splits the target weight in half', () => {
    const a = createLeaf({ id: 'a' }), b = createLeaf({ id: 'b' })
    const root = createBranch('row', [a, b], [1, 1])
    const fresh = createLeaf({ id: 'fresh' })
    const result = insertLeafBeside(root, 'a', 'right', fresh)
    expect(result).toBe(root)   // mutated in place, same reference
    expect(result.children.map(c => c.id)).toEqual(['a', 'fresh', 'b'])
    expect(result.sizes).toEqual([0.5, 0.5, 1])
  })

  it('same-orientation insert on the "left" side inserts before the target index', () => {
    const a = createLeaf({ id: 'a' }), b = createLeaf({ id: 'b' })
    const root = createBranch('row', [a, b])
    const fresh = createLeaf({ id: 'fresh' })
    const result = insertLeafBeside(root, 'b', 'left', fresh)
    expect(result.children.map(c => c.id)).toEqual(['a', 'fresh', 'b'])
  })

  it('cross-orientation insert nests a new branch in place of the target slot', () => {
    const a = createLeaf({ id: 'a' }), b = createLeaf({ id: 'b' })
    const root = createBranch('row', [a, b])
    const fresh = createLeaf({ id: 'fresh' })
    const result = insertLeafBeside(root, 'a', 'top', fresh)
    expect(result).toBe(root)
    expect(result.children[1]).toBe(b)
    const nested = result.children[0]
    expect(isBranch(nested)).toBe(true)
    expect(nested.direction).toBe('column')
    expect(nested.children.map(c => c.id)).toEqual(['fresh', 'a'])
  })
})

describe('removeLeaf', () => {
  it('is a no-op when the target is the sole root leaf', () => {
    const root = createLeaf({ id: 'solo' })
    expect(removeLeaf(root, 'solo')).toBe(root)
  })

  it('is a no-op for an unknown leaf id', () => {
    const root = createLeaf({ id: 'solo' })
    expect(removeLeaf(root, 'nope')).toBe(root)
  })

  it('removing one of two leaves collapses the branch down to the survivor', () => {
    const a = createLeaf({ id: 'a' }), b = createLeaf({ id: 'b' })
    const root = createBranch('row', [a, b])
    const result = removeLeaf(root, 'a')
    expect(result).toBe(b)   // the branch collapses; survivor becomes the new root
  })

  it('removing one of three leaves keeps the branch, dropping just that child', () => {
    const a = createLeaf({ id: 'a' }), b = createLeaf({ id: 'b' }), c = createLeaf({ id: 'c' })
    const root = createBranch('row', [a, b, c], [1, 1, 1])
    const result = removeLeaf(root, 'b')
    expect(result).toBe(root)
    expect(result.children).toEqual([a, c])
    expect(result.sizes).toEqual([1, 1])
  })

  it('collapsing a nested branch splices the survivor into the grandparent', () => {
    const a = createLeaf({ id: 'a' }), b = createLeaf({ id: 'b' }), c = createLeaf({ id: 'c' })
    const inner = createBranch('column', [a, b])
    const root = createBranch('row', [inner, c])
    const result = removeLeaf(root, 'a')
    expect(result).toBe(root)
    expect(result.children).toEqual([b, c])   // inner collapsed into just `b`
  })
})

describe('mergeAll', () => {
  it('is a no-op with zero or one leaves', () => {
    const solo = createLeaf({ id: 'solo', tabs: [tab('t1')] })
    expect(mergeAll(solo)).toBe(solo)
  })

  it('merges every leaf’s tabs into the first leaf in traversal order', () => {
    const a = createLeaf({ id: 'a', tabs: [tab('t1')] })
    const b = createLeaf({ id: 'b', tabs: [tab('t2')] })
    const c = createLeaf({ id: 'c', tabs: [tab('t3')] })
    const root = createBranch('row', [a, createBranch('column', [b, c])])
    const result = mergeAll(root)
    expect(result).toBe(a)
    expect(result.tabs.map(t => t.id)).toEqual(['t1', 't2', 't3'])
  })

  it('sets activeTabId to the first tab only when it was previously unset', () => {
    const a = createLeaf({ id: 'a', tabs: [] })   // activeTabId null
    const b = createLeaf({ id: 'b', tabs: [tab('t2')] })
    const root = createBranch('row', [a, b])
    const result = mergeAll(root)
    expect(result.activeTabId).toBe('t2')
  })

  it('leaves an already-set activeTabId alone', () => {
    const a = createLeaf({ id: 'a', tabs: [tab('t1')], activeTabId: 't1' })
    const b = createLeaf({ id: 'b', tabs: [tab('t2')] })
    const root = createBranch('row', [a, b])
    const result = mergeAll(root)
    expect(result.activeTabId).toBe('t1')
  })
})

describe('applyPreset / PRESETS', () => {
  function threeLeaves() {
    const a = createLeaf({ id: 'a', tabs: [tab('t1')] })
    const b = createLeaf({ id: 'b', tabs: [tab('t2')] })
    const c = createLeaf({ id: 'c', tabs: [tab('t3')] })
    return createBranch('row', [a, b, c])
  }

  it('applyPreset with an unknown name returns the root unchanged', () => {
    const root = threeLeaves()
    expect(applyPreset(root, 'not-a-preset')).toBe(root)
  })

  it('"single" collapses everything into one leaf', () => {
    const result = applyPreset(threeLeaves(), 'single')
    expect(isLeaf(result)).toBe(true)
    expect(result.tabs.map(t => t.id)).toEqual(['t1', 't2', 't3'])
  })

  it('"twoColumns" merges surplus leaves\' tabs into the last of exactly two slots', () => {
    const result = PRESETS.twoColumns(threeLeaves())
    expect(isBranch(result)).toBe(true)
    expect(result.direction).toBe('row')
    expect(result.children).toHaveLength(2)
    expect(result.children[0].tabs.map(t => t.id)).toEqual(['t1'])
    expect(result.children[1].tabs.map(t => t.id)).toEqual(['t2', 't3'])
  })

  it('"twoRows" is the column-direction counterpart of twoColumns', () => {
    const result = PRESETS.twoRows(threeLeaves())
    expect(result.direction).toBe('column')
    expect(result.children).toHaveLength(2)
  })

  it('"threeColumns" keeps three leaves as three row slots when the count matches exactly', () => {
    const result = PRESETS.threeColumns(threeLeaves())
    expect(result.direction).toBe('row')
    expect(result.children).toHaveLength(3)
    expect(result.children.map(l => l.tabs.map(t => t.id))).toEqual([['t1'], ['t2'], ['t3']])
  })

  it('pads with empty leaves when there are fewer groups than the preset needs', () => {
    const solo = createLeaf({ id: 'solo', tabs: [tab('t1')] })
    const result = PRESETS.twoColumns(solo)
    expect(result.children).toHaveLength(2)
    expect(result.children[0].tabs.map(t => t.id)).toEqual(['t1'])
    expect(result.children[1].tabs).toEqual([])
  })

  it('"grid" builds a 2x2 nested column-of-rows from four (or padded) leaves', () => {
    const result = PRESETS.grid(threeLeaves())   // 3 leaves -> pads to 4
    expect(result.direction).toBe('column')
    expect(result.children).toHaveLength(2)
    expect(result.children[0].direction).toBe('row')
    expect(result.children[1].direction).toBe('row')
    expect(result.children[0].children).toHaveLength(2)
    expect(result.children[1].children).toHaveLength(2)
  })

  it('applyPreset("grid") delegates to PRESETS.grid', () => {
    const viaApply = applyPreset(threeLeaves(), 'grid')
    expect(viaApply.direction).toBe('column')
  })
})
