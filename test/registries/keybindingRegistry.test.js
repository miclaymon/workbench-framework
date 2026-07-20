import { describe, it, expect, vi } from 'vitest'
import { createKeybindingRegistry, formatChord, normalizeChord } from '../../src/registries/keybindingRegistry.js'

describe('normalizeChord', () => {
  it('lowercases and passes through a simple key', () => {
    expect(normalizeChord('Delete')).toBe('delete')
  })

  it('folds cmd/meta/command to ctrl, and option to alt', () => {
    expect(normalizeChord('cmd+s')).toBe('ctrl+s')
    expect(normalizeChord('meta+s')).toBe('ctrl+s')
    expect(normalizeChord('command+s')).toBe('ctrl+s')
    expect(normalizeChord('option+s')).toBe('alt+s')
  })

  it('orders modifiers ctrl -> alt -> shift regardless of input order', () => {
    expect(normalizeChord('shift+alt+ctrl+p')).toBe('ctrl+alt+shift+p')
    expect(normalizeChord('ctrl+shift+p')).toBe('ctrl+shift+p')
    expect(normalizeChord('p+shift+ctrl')).toBe('ctrl+shift+p')
  })

  it('dedupes an equivalent modifier appearing twice (e.g. ctrl and control)', () => {
    expect(normalizeChord('ctrl+control+p')).toBe('ctrl+p')
  })

  it('is idempotent', () => {
    const once = normalizeChord('cmd+shift+p')
    expect(normalizeChord(once)).toBe(once)
  })

  it('handles a bare modifier-less base key with mixed case', () => {
    expect(normalizeChord('ArrowUp')).toBe('arrowup')
  })
})

describe('formatChord', () => {
  it('maps known tokens to display labels', () => {
    expect(formatChord('ctrl+shift+p')).toEqual(['Ctrl', 'Shift', 'P'])
  })

  it('formats arrow keys and named keys with their glyphs', () => {
    expect(formatChord('ctrl+arrowup')).toEqual(['Ctrl', '↑'])
    expect(formatChord('delete')).toEqual(['Delete'])
    expect(formatChord('backspace')).toEqual(['⌫'])
  })

  it('title-cases an unrecognized multi-char token', () => {
    expect(formatChord('ctrl+home')).toEqual(['Ctrl', 'Home'])
  })

  it('upper-cases a single-char base token', () => {
    expect(formatChord('ctrl+1')).toEqual(['Ctrl', '1'])
  })
})

describe('createKeybindingRegistry', () => {
  it('register() stores under the normalized chord, keyed for direct lookup', () => {
    const registry = createKeybindingRegistry()
    registry.register({ key: 'cmd+s', command: 'file.save' })
    expect(registry.forChord('ctrl+s')).toHaveLength(1)
    expect(registry.forChord('ctrl+s')[0].command).toBe('file.save')
  })

  it('forChord() looks up the chord map directly — it does NOT re-normalize its argument', () => {
    // By contract (see the module comment: "the dispatcher resolves a keydown to
    // a chord and runs the bound command"), the caller is expected to normalize
    // a live keydown into canonical form before calling forChord(). Passing an
    // equivalent-but-not-canonical spelling like 'meta+s' misses, even though
    // 'cmd+s' was registered — only 'ctrl+s' (and other pre-normalized chords)
    // will find it.
    const registry = createKeybindingRegistry()
    registry.register({ key: 'cmd+s', command: 'file.save' })
    expect(registry.forChord('meta+s')).toEqual([])
    expect(registry.forChord(registry.normalizeChord('meta+s'))).toHaveLength(1)
  })

  it('throws when key or command is missing', () => {
    const registry = createKeybindingRegistry()
    expect(() => registry.register({ command: 'x' })).toThrow()
    expect(() => registry.register({ key: 'ctrl+s' })).toThrow()
  })

  it('supports multiple bindings on the same chord', () => {
    const registry = createKeybindingRegistry()
    registry.register({ key: 'ctrl+k', command: 'a.cmd' })
    registry.register({ key: 'ctrl+k', command: 'b.cmd' })
    expect(registry.forChord('ctrl+k').map(b => b.command)).toEqual(['a.cmd', 'b.cmd'])
  })

  it('forCommand() finds every chord bound to a command id', () => {
    const registry = createKeybindingRegistry()
    registry.register({ key: 'ctrl+1', command: 'editor.focusGroup', args: [1] })
    registry.register({ key: 'ctrl+2', command: 'editor.focusGroup', args: [2] })
    registry.register({ key: 'ctrl+s', command: 'file.save' })
    const bindings = registry.forCommand('editor.focusGroup')
    expect(bindings).toHaveLength(2)
    expect(bindings.map(b => b.chord).sort()).toEqual(['ctrl+1', 'ctrl+2'])
  })

  it('list() flattens every chord bucket', () => {
    const registry = createKeybindingRegistry()
    registry.register({ key: 'ctrl+k', command: 'a.cmd' })
    registry.register({ key: 'ctrl+k', command: 'b.cmd' })
    registry.register({ key: 'ctrl+s', command: 'c.cmd' })
    expect(registry.list()).toHaveLength(3)
  })

  it("disposer removes only its own binding, leaving siblings on the same chord", () => {
    const registry = createKeybindingRegistry()
    const disposeA = registry.register({ key: 'ctrl+k', command: 'a.cmd' })
    registry.register({ key: 'ctrl+k', command: 'b.cmd' })
    disposeA()
    const remaining = registry.forChord('ctrl+k')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].command).toBe('b.cmd')
  })

  it('disposing the last binding on a chord removes the chord bucket entirely', () => {
    const registry = createKeybindingRegistry()
    const dispose = registry.register({ key: 'ctrl+k', command: 'a.cmd' })
    dispose()
    expect(registry.forChord('ctrl+k')).toEqual([])
    expect(registry.list()).toEqual([])
  })

  it('a double-dispose is a harmless no-op', () => {
    const registry = createKeybindingRegistry()
    const dispose = registry.register({ key: 'ctrl+k', command: 'a.cmd' })
    dispose()
    expect(() => dispose()).not.toThrow()
  })

  it('exposes normalizeChord on the instance', () => {
    const registry = createKeybindingRegistry()
    expect(registry.normalizeChord('cmd+s')).toBe('ctrl+s')
  })
})
