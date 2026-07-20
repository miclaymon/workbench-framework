import { describe, it, expect, vi } from 'vitest'
import { createHookRegistry } from '../../src/registries/hookRegistry.js'

describe('createHookRegistry', () => {
  it('apply() returns the original value when no handlers are registered', () => {
    const { apply } = createHookRegistry()
    expect(apply('menu.file', { items: [] }, {})).toEqual({ items: [] })
  })

  it('threads the value through handlers in ascending order', () => {
    const { add, apply } = createHookRegistry()
    const calls = []
    add('x', (v) => { calls.push('second'); return v + 1 }, 10)
    add('x', (v) => { calls.push('first'); return v + 1 }, 0)
    expect(apply('x', 1)).toBe(3)
    expect(calls).toEqual(['first', 'second'])
  })

  it('defaults order to 0 and is stable-ish across equal orders (registration order)', () => {
    const { add, apply } = createHookRegistry()
    const seen = []
    add('x', (v) => { seen.push('a'); return v })
    add('x', (v) => { seen.push('b'); return v })
    apply('x', 0)
    expect(seen).toEqual(['a', 'b'])
  })

  it("a handler returning undefined is a no-op (doesn't null out the value)", () => {
    const { add, apply } = createHookRegistry()
    add('x', () => undefined)
    add('x', (v) => v + 1)
    expect(apply('x', 1)).toBe(2)
  })

  it('passes ctx through to every handler', () => {
    const { add, apply } = createHookRegistry()
    const ctx = { activityId: 'explorer' }
    let seenCtx
    add('x', (v, c) => { seenCtx = c; return v })
    apply('x', 1, ctx)
    expect(seenCtx).toBe(ctx)
  })

  it('isolates a throwing handler and still runs the rest of the chain', () => {
    const log = vi.fn()
    const { add, apply } = createHookRegistry({ log })
    add('x', () => { throw new Error('boom') }, 0)
    add('x', (v) => v + 1, 1)
    expect(apply('x', 1)).toBe(2)
    expect(log).toHaveBeenCalledWith('hooks', expect.stringContaining('threw'), expect.any(Error), 'error')
  })

  it('throws from add() when fn is not a function', () => {
    const { add } = createHookRegistry()
    expect(() => add('x', 'nope')).toThrow()
  })

  it('the disposer removes only its own handler', () => {
    const { add, apply } = createHookRegistry()
    const disposeA = add('x', (v) => v + 1)
    add('x', (v) => v + 10)
    disposeA()
    expect(apply('x', 0)).toBe(10)
  })

  it('has() reflects whether a hook name currently has handlers', () => {
    const { add, has } = createHookRegistry()
    expect(has('x')).toBe(false)
    const dispose = add('x', (v) => v)
    expect(has('x')).toBe(true)
    dispose()
    expect(has('x')).toBe(false)
  })

  it('re-sorts correctly when a handler is added after others with lower order', () => {
    const { add, apply } = createHookRegistry()
    const seen = []
    add('x', () => { seen.push('c') }, 5)
    add('x', () => { seen.push('a') }, -5)
    add('x', () => { seen.push('b') }, 0)
    apply('x', 1)
    expect(seen).toEqual(['a', 'b', 'c'])
  })
})
