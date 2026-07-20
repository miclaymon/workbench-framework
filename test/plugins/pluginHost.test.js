import { describe, it, expect, vi } from 'vitest'
import { effect } from '@vue/reactivity'
import { createPluginHost } from '../../src/plugins/pluginHost.js'

function manifest(overrides = {}) {
  return {
    manifest_version: 1,
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    client: { entry: 'client/plugin.js' },
    ...overrides,
  }
}

function makeHost() {
  return { facade: {}, log: vi.fn(), services: {} }
}

function makeHostAndLog(opts = {}) {
  const log = vi.fn()
  const pluginHost = createPluginHost({ host: makeHost(), log, ...opts })
  return { pluginHost, log }
}

describe('createPluginHost — load(): manifest validation', () => {
  it('rejects an invalid manifest and marks it failed', () => {
    const { pluginHost } = makeHostAndLog()
    const bad = manifest({ name: '' })
    expect(() => pluginHost.load(bad, { activate: () => {} })).toThrow(/invalid manifest/)
    expect(pluginHost.stateOf('test-plugin')).toBe('failed')
  })

  it('does not throw setting state when the invalid manifest has no id', () => {
    const { pluginHost } = makeHostAndLog()
    expect(() => pluginHost.load({}, { activate: () => {} })).toThrow(/invalid manifest/)
  })

  it('logs non-fatal manifest warnings (e.g. unknown permission) and still loads', () => {
    const { pluginHost, log } = makeHostAndLog()
    pluginHost.load(manifest({ permissions: ['not-a-real-permission'] }), { activate: () => {} })
    expect(pluginHost.isLoaded('test-plugin')).toBe(true)
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('unknown permission'), null, 'warning')
  })
})

describe('createPluginHost — load(): activate() export', () => {
  it('throws when the module has no activate function', () => {
    const { pluginHost } = makeHostAndLog()
    expect(() => pluginHost.load(manifest(), {})).toThrow(/no activate\(api\) export/)
    expect(pluginHost.stateOf('test-plugin')).toBe('failed')
  })

  it('warns (but does not throw) when re-loading an already-loaded id', () => {
    const { pluginHost, log } = makeHostAndLog()
    pluginHost.load(manifest(), { activate: () => {} })
    pluginHost.load(manifest(), { activate: () => {} })
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('already loaded'), null, 'warning')
  })
})

describe('createPluginHost — engines contract', () => {
  it('loads when the engine range is satisfied', () => {
    const { pluginHost } = makeHostAndLog({ engines: { sdk: '1.2.0' } })
    pluginHost.load(manifest({ engines: { sdk: '^1.0.0' } }), { activate: () => {} })
    expect(pluginHost.isLoaded('test-plugin')).toBe(true)
  })

  it('throws with a legible message when the engine range is unsatisfied', () => {
    const { pluginHost } = makeHostAndLog({ engines: { sdk: '1.0.0' } })
    expect(() => pluginHost.load(manifest({ engines: { sdk: '^2.0.0' } }), { activate: () => {} }))
      .toThrow(/requires sdk \^2\.0\.0, host provides 1\.0\.0/)
    expect(pluginHost.stateOf('test-plugin')).toBe('failed')
  })

  it('warns and skips (does not throw) for an engine the host does not declare', () => {
    const { pluginHost, log } = makeHostAndLog({ engines: {} })
    pluginHost.load(manifest({ engines: { sdk: '^1.0.0' } }), { activate: () => {} })
    expect(pluginHost.isLoaded('test-plugin')).toBe(true)
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('unknown engine "sdk"'), null, 'warning')
  })

  it('warns and skips (does not throw) for an unparseable engine range', () => {
    const { pluginHost, log } = makeHostAndLog({ engines: { sdk: '1.0.0' } })
    pluginHost.load(manifest({ engines: { sdk: 'not-a-real-range' } }), { activate: () => {} })
    expect(pluginHost.isLoaded('test-plugin')).toBe(true)
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('unparseable engines.sdk range'), null, 'warning')
  })
})

describe('createPluginHost — dependencies contract', () => {
  it('throws when a declared dependency is not loaded', () => {
    const { pluginHost } = makeHostAndLog()
    expect(() => pluginHost.load(manifest({ dependencies: { 'dep-plugin': '^1.0.0' } }), { activate: () => {} }))
      .toThrow(/depends on "dep-plugin", which is not loaded/)
    expect(pluginHost.stateOf('test-plugin')).toBe('failed')
  })

  it('loads when the dependency is loaded and its version satisfies the range', () => {
    const { pluginHost } = makeHostAndLog()
    pluginHost.load(manifest({ id: 'dep-plugin', version: '1.5.0' }), { activate: () => {} })
    pluginHost.load(manifest({ id: 'test-plugin', dependencies: { 'dep-plugin': '^1.0.0' } }), { activate: () => {} })
    expect(pluginHost.isLoaded('test-plugin')).toBe(true)
  })

  it('throws when the loaded dependency violates the declared range', () => {
    const { pluginHost } = makeHostAndLog()
    pluginHost.load(manifest({ id: 'dep-plugin', version: '1.0.0' }), { activate: () => {} })
    expect(() => pluginHost.load(manifest({ id: 'test-plugin', dependencies: { 'dep-plugin': '^2.0.0' } }), { activate: () => {} }))
      .toThrow(/requires "dep-plugin" \^2\.0\.0, but 1\.0\.0 is loaded/)
    expect(pluginHost.stateOf('test-plugin')).toBe('failed')
  })

  it('warns and skips (does not throw) for an unparseable dependency range', () => {
    const { pluginHost, log } = makeHostAndLog()
    pluginHost.load(manifest({ id: 'dep-plugin', version: '1.0.0' }), { activate: () => {} })
    pluginHost.load(manifest({ id: 'test-plugin', dependencies: { 'dep-plugin': 'garbage' } }), { activate: () => {} })
    expect(pluginHost.isLoaded('test-plugin')).toBe(true)
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('unparseable dependency range'), null, 'warning')
  })
})

describe('createPluginHost — activate() lifecycle', () => {
  it('a synchronous activate() completes load() synchronously', () => {
    const { pluginHost } = makeHostAndLog()
    const result = pluginHost.load(manifest(), { activate: () => {} })
    expect(result).toBeUndefined()
    expect(pluginHost.stateOf('test-plugin')).toBe('active')
  })

  it('an async activate() returns a promise from load(), resolving to "active"', async () => {
    const { pluginHost } = makeHostAndLog()
    const result = pluginHost.load(manifest(), { activate: async () => {} })
    expect(result).toBeInstanceOf(Promise)
    expect(pluginHost.stateOf('test-plugin')).toBe('loading')
    await result
    expect(pluginHost.stateOf('test-plugin')).toBe('active')
    expect(pluginHost.isLoaded('test-plugin')).toBe(true)
  })

  it('a synchronous activate() throw is caught, wrapped, and the plugin marked failed', () => {
    const { pluginHost } = makeHostAndLog()
    expect(() => pluginHost.load(manifest(), { activate: () => { throw new Error('boom') } }))
      .toThrow(/"test-plugin" activate\(\) threw: boom/)
    expect(pluginHost.stateOf('test-plugin')).toBe('failed')
    expect(pluginHost.isLoaded('test-plugin')).toBe(false)
  })

  it('an async activate() rejection is swallowed (not re-thrown) but marks the plugin failed', async () => {
    const { pluginHost, log } = makeHostAndLog()
    const result = pluginHost.load(manifest(), { activate: async () => { throw new Error('async boom') } })
    await expect(result).resolves.toBeUndefined()   // does NOT reject
    expect(pluginHost.stateOf('test-plugin')).toBe('failed')
    expect(pluginHost.isLoaded('test-plugin')).toBe(false)
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('async activate() rejected: async boom'), null, 'error')
  })
})

describe('createPluginHost — disposer handling', () => {
  it('accepts a function disposer', () => {
    const { pluginHost } = makeHostAndLog()
    const dispose = vi.fn()
    pluginHost.load(manifest(), { activate: () => dispose })
    pluginHost.unload('test-plugin')
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('accepts an absent disposer silently (no warning)', () => {
    const { pluginHost, log } = makeHostAndLog()
    pluginHost.load(manifest(), { activate: () => {} })
    expect(log).not.toHaveBeenCalledWith('plugins', expect.stringContaining('disposer'), null, 'warning')
  })

  it('warns and drops a non-function disposer', () => {
    const { pluginHost, log } = makeHostAndLog()
    pluginHost.load(manifest(), { activate: () => ({ notAFunction: true }) })
    expect(log).toHaveBeenCalledWith(
      'plugins',
      expect.stringContaining('activate() returned a object disposer (expected a function)'),
      null, 'warning',
    )
    // unload() must not attempt to call the bogus disposer
    expect(() => pluginHost.unload('test-plugin')).not.toThrow()
  })

  it('warns and drops a non-function async disposer too', async () => {
    const { pluginHost, log } = makeHostAndLog()
    const result = pluginHost.load(manifest(), { activate: async () => 42 })
    await result
    expect(log).toHaveBeenCalledWith(
      'plugins',
      expect.stringContaining('activate() returned a number disposer'),
      null, 'warning',
    )
  })
})

describe('createPluginHost — unload()', () => {
  it('runs the disposer then deactivate(), and clears loaded/state', () => {
    const { pluginHost } = makeHostAndLog()
    const order = []
    const dispose = vi.fn(() => order.push('dispose'))
    const deactivate = vi.fn(() => order.push('deactivate'))
    pluginHost.load(manifest(), { activate: () => dispose, deactivate })
    pluginHost.unload('test-plugin')
    expect(order).toEqual(['dispose', 'deactivate'])
    expect(pluginHost.isLoaded('test-plugin')).toBe(false)
    expect(pluginHost.stateOf('test-plugin')).toBeNull()
  })

  it('is a no-op for an id that is not loaded', () => {
    const { pluginHost } = makeHostAndLog()
    expect(() => pluginHost.unload('nope')).not.toThrow()
  })

  it('refuses to unload a plugin that other loaded plugins depend on', () => {
    const { pluginHost } = makeHostAndLog()
    pluginHost.load(manifest({ id: 'base' }), { activate: () => {} })
    pluginHost.load(manifest({ id: 'dependent', dependencies: { base: '^1.0.0' } }), { activate: () => {} })
    expect(() => pluginHost.unload('base')).toThrow(/cannot unload "base" — required by dependent/)
    expect(pluginHost.isLoaded('base')).toBe(true)
  })

  it('isolates a throwing dispose() — logs the error but still finishes unloading', () => {
    const { pluginHost, log } = makeHostAndLog()
    const deactivate = vi.fn()
    pluginHost.load(manifest(), { activate: () => () => { throw new Error('dispose boom') }, deactivate })
    pluginHost.unload('test-plugin')
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('dispose threw'), expect.any(Error), 'error')
    expect(deactivate).toHaveBeenCalledTimes(1)   // still runs despite the dispose throw
    expect(pluginHost.isLoaded('test-plugin')).toBe(false)
  })

  it('isolates a throwing deactivate() — logs the error but still clears state', () => {
    const { pluginHost, log } = makeHostAndLog()
    pluginHost.load(manifest(), {
      activate: () => {},
      deactivate: () => { throw new Error('deactivate boom') },
    })
    pluginHost.unload('test-plugin')
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('deactivate threw'), expect.any(Error), 'error')
    expect(pluginHost.isLoaded('test-plugin')).toBe(false)
    expect(pluginHost.stateOf('test-plugin')).toBeNull()
  })
})

describe('createPluginHost — reactive states map', () => {
  it('states transitions are observable via @vue/reactivity effect()', async () => {
    const { pluginHost } = makeHostAndLog()
    const seen = []
    effect(() => { seen.push(pluginHost.stateOf('test-plugin')) })
    expect(seen).toEqual([null])

    const result = pluginHost.load(manifest(), { activate: async () => {} })
    expect(seen).toEqual([null, 'loading'])
    await result
    expect(seen).toEqual([null, 'loading', 'active'])
  })

  it('failures() lists ids whose state is "failed"', () => {
    const { pluginHost } = makeHostAndLog()
    expect(() => pluginHost.load(manifest(), { activate: () => { throw new Error('x') } })).toThrow()
    expect(pluginHost.failures()).toEqual(['test-plugin'])
  })
})

describe('createPluginHost — get()/list()', () => {
  it('get() returns the manifest for a loaded plugin, or null', () => {
    const { pluginHost } = makeHostAndLog()
    expect(pluginHost.get('test-plugin')).toBeNull()
    pluginHost.load(manifest(), { activate: () => {} })
    expect(pluginHost.get('test-plugin')?.id).toBe('test-plugin')
  })

  it('list() returns every loaded manifest', () => {
    const { pluginHost } = makeHostAndLog()
    pluginHost.load(manifest({ id: 'a' }), { activate: () => {} })
    pluginHost.load(manifest({ id: 'b' }), { activate: () => {} })
    expect(pluginHost.list().map(m => m.id).sort()).toEqual(['a', 'b'])
  })
})

describe('createPluginHost — loadAllAsync()', () => {
  it('activates dependency-ordered entries even when passed out of order', async () => {
    const { pluginHost } = makeHostAndLog()
    const order = []
    const entries = [
      {
        manifest: manifest({ id: 'dependent', dependencies: { base: '^1.0.0' } }),
        load: async () => ({ activate: () => { order.push('dependent') } }),
      },
      {
        manifest: manifest({ id: 'base', version: '1.0.0' }),
        load: async () => ({ activate: () => { order.push('base') } }),
      },
    ]
    await pluginHost.loadAllAsync(entries)
    expect(order).toEqual(['base', 'dependent'])
    expect(pluginHost.isLoaded('base')).toBe(true)
    expect(pluginHost.isLoaded('dependent')).toBe(true)
  })

  it('isolates one plugin failing to import — peers still load', async () => {
    const { pluginHost, log } = makeHostAndLog()
    const entries = [
      { manifest: manifest({ id: 'broken' }), load: async () => { throw new Error('network fail') } },
      { manifest: manifest({ id: 'ok' }), load: async () => ({ activate: () => {} }) },
    ]
    await pluginHost.loadAllAsync(entries)
    expect(pluginHost.isLoaded('broken')).toBe(false)
    expect(pluginHost.stateOf('broken')).toBe('failed')
    expect(pluginHost.isLoaded('ok')).toBe(true)
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('"broken" failed to import'), null, 'error')
  })

  it('isolates one plugin whose activate() throws — peers still load', async () => {
    const { pluginHost, log } = makeHostAndLog()
    const entries = [
      { manifest: manifest({ id: 'throws' }), load: async () => ({ activate: () => { throw new Error('bad activate') } }) },
      { manifest: manifest({ id: 'fine' }), load: async () => ({ activate: () => {} }) },
    ]
    await pluginHost.loadAllAsync(entries)
    expect(pluginHost.isLoaded('throws')).toBe(false)
    expect(pluginHost.isLoaded('fine')).toBe(true)
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('bad activate'), null, 'error')
  })

  it('drops an entry with a missing dependency before ever calling load()', async () => {
    const { pluginHost, log } = makeHostAndLog()
    const loadFn = vi.fn(async () => ({ activate: () => {} }))
    const entries = [
      { manifest: manifest({ id: 'orphan', dependencies: { 'nowhere-to-be-found': '^1.0.0' } }), load: loadFn },
    ]
    await pluginHost.loadAllAsync(entries)
    expect(loadFn).not.toHaveBeenCalled()
    expect(pluginHost.isLoaded('orphan')).toBe(false)
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('depends on missing "nowhere-to-be-found"'), null, 'warning')
  })

  it('drops a dependency cycle entirely, logging a warning, without throwing', async () => {
    const { pluginHost, log } = makeHostAndLog()
    const entries = [
      { manifest: manifest({ id: 'a', dependencies: { b: '^1.0.0' } }), load: async () => ({ activate: () => {} }) },
      { manifest: manifest({ id: 'b', dependencies: { a: '^1.0.0' } }), load: async () => ({ activate: () => {} }) },
    ]
    await expect(pluginHost.loadAllAsync(entries)).resolves.toBeUndefined()
    expect(pluginHost.isLoaded('a')).toBe(false)
    expect(pluginHost.isLoaded('b')).toBe(false)
    expect(log).toHaveBeenCalledWith('plugins', expect.stringContaining('dependency cycle'), null, 'warning')
  })
})
