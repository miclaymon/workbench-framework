import { describe, it, expect, vi } from 'vitest'
import { createEmitter } from '../src/emitter.js'

describe('createEmitter', () => {
  it('delivers a payload to a subscriber', () => {
    const emitter = createEmitter()
    const fn = vi.fn()
    emitter.on('x', fn)
    emitter.emit('x', { a: 1 })
    expect(fn).toHaveBeenCalledWith({ a: 1 })
  })

  it('emit() on a type with no subscribers is a no-op', () => {
    const emitter = createEmitter()
    expect(() => emitter.emit('nope', 1)).not.toThrow()
  })

  it('delivers to multiple subscribers of the same type', () => {
    const emitter = createEmitter()
    const a = vi.fn(), b = vi.fn()
    emitter.on('x', a)
    emitter.on('x', b)
    emitter.emit('x', 1)
    expect(a).toHaveBeenCalledWith(1)
    expect(b).toHaveBeenCalledWith(1)
  })

  it('on() returns an unsubscribe function', () => {
    const emitter = createEmitter()
    const fn = vi.fn()
    const dispose = emitter.on('x', fn)
    dispose()
    emitter.emit('x', 1)
    expect(fn).not.toHaveBeenCalled()
  })

  it('on() with a non-function returns a harmless no-op disposer', () => {
    const emitter = createEmitter()
    const dispose = emitter.on('x', 'not-a-function')
    expect(() => dispose()).not.toThrow()
    expect(() => emitter.emit('x', 1)).not.toThrow()
  })

  it('off() removes only the given handler, leaving siblings intact', () => {
    const emitter = createEmitter()
    const a = vi.fn(), b = vi.fn()
    emitter.on('x', a)
    emitter.on('x', b)
    emitter.off('x', a)
    emitter.emit('x', 1)
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledWith(1)
  })

  it('once() fires exactly once then auto-unsubscribes', () => {
    const emitter = createEmitter()
    const fn = vi.fn()
    emitter.once('x', fn)
    emitter.emit('x', 1)
    emitter.emit('x', 2)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(1)
  })

  it('once()’s own disposer can cancel it before it ever fires', () => {
    const emitter = createEmitter()
    const fn = vi.fn()
    const dispose = emitter.once('x', fn)
    dispose()
    emitter.emit('x', 1)
    expect(fn).not.toHaveBeenCalled()
  })

  it('a throwing subscriber does not break the emit loop or sibling subscribers', () => {
    const emitter = createEmitter()
    const after = vi.fn()
    emitter.on('x', () => { throw new Error('boom') })
    emitter.on('x', after)
    expect(() => emitter.emit('x', 1)).not.toThrow()
    expect(after).toHaveBeenCalledWith(1)
  })

  it('clear() drops all subscribers across all event types', () => {
    const emitter = createEmitter()
    const a = vi.fn(), b = vi.fn()
    emitter.on('x', a)
    emitter.on('y', b)
    emitter.clear()
    emitter.emit('x', 1)
    emitter.emit('y', 1)
    expect(a).not.toHaveBeenCalled()
    expect(b).not.toHaveBeenCalled()
  })

  it('a handler that unsubscribes itself mid-emit does not affect the current dispatch (snapshot semantics)', () => {
    const emitter = createEmitter()
    const calls = []
    let disposeSelf
    disposeSelf = emitter.on('x', () => { calls.push('self'); disposeSelf() })
    emitter.on('x', () => calls.push('other'))
    emitter.emit('x', 1)
    expect(calls).toEqual(['self', 'other'])
    calls.length = 0
    emitter.emit('x', 1)
    expect(calls).toEqual(['other'])
  })
})
