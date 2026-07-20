import { describe, it, expect, vi } from 'vitest'
import { createCommandRegistry } from '../../src/registries/commandRegistry.js'

function makeRegistry({ ctx = {} } = {}) {
  const log = vi.fn()
  const registry = createCommandRegistry({ getCtx: () => ctx, log })
  return { registry, log, ctx }
}

describe('createCommandRegistry', () => {
  it('registers a command and executes it', () => {
    const { registry } = makeRegistry()
    const run = vi.fn(() => 'result')
    registry.register({ id: 'a.cmd', title: 'A', run })
    expect(registry.execute('a.cmd')).toBe('result')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('passes ctx and forwarded args to run()', () => {
    const ctx = { host: true }
    const { registry } = makeRegistry({ ctx })
    const run = vi.fn()
    registry.register({ id: 'a.cmd', run })
    registry.execute('a.cmd', 1, 2, 3)
    expect(run).toHaveBeenCalledWith(ctx, 1, 2, 3)
  })

  it('throws on register() without an id or run function', () => {
    const { registry } = makeRegistry()
    expect(() => registry.register({ run: () => {} })).toThrow()
    expect(() => registry.register({ id: 'a' })).toThrow()
    expect(() => registry.register({ id: 'a', run: 'not-a-function' })).toThrow()
  })

  it('get/has/list reflect registered commands', () => {
    const { registry } = makeRegistry()
    expect(registry.has('a.cmd')).toBe(false)
    expect(registry.get('a.cmd')).toBeNull()
    const cmd = { id: 'a.cmd', run: () => {} }
    registry.register(cmd)
    expect(registry.has('a.cmd')).toBe(true)
    // Not `.toBe(cmd)`: `commands` is a `reactive(Map)`, so `.get()` returns a
    // reactive-wrapped proxy of the stored value, not the exact object passed to
    // `.set()`. Content equality is the right check here; see the dedicated
    // "BUG" test below for why that same proxy-vs-raw mismatch actually breaks
    // register()'s disposer.
    expect(registry.get('a.cmd')).toEqual(cmd)
    expect(registry.list()).toEqual([cmd])
  })

  // Regression: the disposer used to compare `commands.get(id) === cmd`, but a
  // reactive Map's get() returns a fresh proxy wrapping the stored value, so the
  // guard never matched and disposal silently did nothing — every command an
  // activity or plugin registered leaked on teardown (still executable, still in
  // the palette). Fixed by comparing against toRaw().
  it('the disposer returned by register() removes exactly that registration', () => {
    const { registry } = makeRegistry()
    const dispose = registry.register({ id: 'a.cmd', run: () => 1 })
    dispose()
    expect(registry.has('a.cmd')).toBe(false)
    expect(registry.get('a.cmd')).toBe(null)
    expect(registry.list()).toEqual([])
  })

  it('a stale disposer does not clobber a later re-registration of the same id', () => {
    const { registry } = makeRegistry()
    const disposeFirst = registry.register({ id: 'a.cmd', run: () => 1 })
    const second = { id: 'a.cmd', run: () => 2 }
    registry.register(second)
    disposeFirst()   // fires late, after the id was re-registered by someone else
    expect(registry.has('a.cmd')).toBe(true)
    expect(registry.get('a.cmd')).toEqual(second)
    expect(registry.execute('a.cmd')).toBe(2)
  })

  it('logs (but does not throw) when overwriting an existing id', () => {
    const { registry, log } = makeRegistry()
    registry.register({ id: 'a.cmd', run: () => {} })
    registry.register({ id: 'a.cmd', run: () => {} })
    expect(log).toHaveBeenCalledWith('commands', expect.stringContaining('overwriting "a.cmd"'))
  })

  describe('when() gating', () => {
    it('isEnabled() is true with no when predicate', () => {
      const { registry } = makeRegistry()
      registry.register({ id: 'a.cmd', run: () => {} })
      expect(registry.isEnabled('a.cmd')).toBe(true)
    })

    it('isEnabled() reflects the when() predicate against ctx', () => {
      const ctx = { canRun: false }
      const { registry } = makeRegistry({ ctx })
      registry.register({ id: 'a.cmd', when: (c) => c.canRun, run: () => {} })
      expect(registry.isEnabled('a.cmd')).toBe(false)
      ctx.canRun = true
      expect(registry.isEnabled('a.cmd')).toBe(true)
    })

    it('isEnabled() is false for an unknown command', () => {
      const { registry } = makeRegistry()
      expect(registry.isEnabled('nope')).toBe(false)
    })

    it('execute() no-ops a disabled command without calling run()', () => {
      const { registry, log } = makeRegistry({ ctx: { canRun: false } })
      const run = vi.fn()
      registry.register({ id: 'a.cmd', when: (c) => c.canRun, run })
      const result = registry.execute('a.cmd')
      expect(result).toBeUndefined()
      expect(run).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith('commands', expect.stringContaining('"a.cmd" is disabled'))
    })
  })

  it('execute() no-ops for an unknown command id and logs a note', () => {
    const { registry, log } = makeRegistry()
    expect(registry.execute('nope')).toBeUndefined()
    expect(log).toHaveBeenCalledWith('commands', expect.stringContaining('no such command "nope"'))
  })

  it('unregister(id) removes a command outright', () => {
    const { registry } = makeRegistry()
    registry.register({ id: 'a.cmd', run: () => {} })
    registry.unregister('a.cmd')
    expect(registry.has('a.cmd')).toBe(false)
  })
})
