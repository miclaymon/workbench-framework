import { reactive } from '../reactivity.js'
import { validateManifest } from '../models/plugin/index.js'
import { satisfies } from '../models/plugin/semver.js'
import { createPluginApi } from './pluginApi.js'

// ── Plugin host (loader + lifecycle) ──────────────────────────────────────────
//
// Owns the set of loaded plugins. A *plugin* is a { manifest, module } pair:
//   manifest  the validated metadata block (see models/plugin).
//   module    the plugin's entry exports — `activate(api)` (required) and an
//             optional `deactivate(api)`. activate() registers the plugin's
//             activity/commands/etc. through its permission-scoped `api`. It may
//             be sync or async, and may return (or resolve to) a disposer; on
//             unload that disposer + deactivate() run.
//
// The eventual archive loader (extract .zip/.vsix → read manifest.json → import
// src/plugin.js in a sandbox) produces those pairs and feeds them here; this layer
// is agnostic to where they came from. Registration of a plugin's UI surfaces goes
// through the same facade path first-party activities use — plugins are not special.
//
// Robustness: every plugin is isolated. A bad manifest, an import failure, a
// thrown/rejected activate(), or a bogus disposer is logged and confined to that
// plugin — peers and the host keep running. `states` tracks each plugin's
// lifecycle ('loading' | 'active' | 'failed') for a future plugin-manager UI.
//
// `engines` is the host's declared contract versions, e.g. `{ sdk: '1.0.0' }` — the
// host supplies them because the framework has no knowledge of the SDK surface a
// given app publishes. A plugin's `engines` block is checked against them at load;
// an engine the host doesn't declare is a warning (forward-compatible, like unknown
// permissions), a declared-but-unsatisfied range refuses the load.
export function createPluginHost({ host, log = () => {}, engines = {} }) {
  const loaded = reactive(new Map())   // id → { manifest, api, module, dispose }
  const states = reactive(new Map())   // id → 'loading' | 'active' | 'failed'

  function isLoaded(id) { return loaded.has(id) }
  function stateOf(id)  { return states.get(id) ?? null }

  // A disposer must be a function (or absent). Anything else (a forgotten
  // `return`, a ref, an object) means cleanup can't run on unload — warn and drop
  // it so unload() doesn't later try to call a non-function.
  function checkDisposer(id, d) {
    if (d == null || typeof d === 'function') return d
    log('plugins', `"${id}" activate() returned a ${typeof d} disposer (expected a function); cleanup on unload will be skipped`, null, 'warning')
    return undefined
  }

  // Record the loaded entry and resolve its disposer. activate() may have returned
  // a disposer directly (sync) or a promise (async). For the async case we register
  // the entry immediately in 'loading' state and resolve the disposer when it
  // settles; a rejection unwinds the entry and marks it failed. Returns a promise
  // only when activation is async, so sync callers (Explorer) stay synchronous.
  function finalize(manifest, api, module, result) {
    const id = manifest.id
    const entry = reactive({ manifest, api, module, dispose: undefined })
    loaded.set(id, entry)

    if (!isThenable(result)) {
      entry.dispose = checkDisposer(id, result)
      states.set(id, 'active')
      log('plugins', `loaded "${id}" v${manifest.version}`, null, 'info')
      return
    }

    return result.then(
      (d) => {
        entry.dispose = checkDisposer(id, d)
        states.set(id, 'active')
        log('plugins', `loaded "${id}" v${manifest.version}`, null, 'info')
      },
      (err) => {
        loaded.delete(id)
        states.set(id, 'failed')
        log('plugins', `"${id}" async activate() rejected: ${err?.message ?? err}`, null, 'error')
      },
    )
  }

  // Load one plugin from an already-imported module. Throws on an invalid manifest,
  // an unmet dependency, or a synchronous activate() throw; warnings (unknown
  // permissions, …) are logged and non-fatal. Returns a promise when activate() is
  // async (so the batch loader can await it), otherwise completes synchronously.
  function load(manifest, module) {
    const { valid, errors, warnings } = validateManifest(manifest)
    if (!valid) {
      if (manifest?.id) states.set(manifest.id, 'failed')
      throw new Error(`[plugins] invalid manifest for "${manifest?.id ?? '?'}": ${errors.join('; ')}`)
    }
    for (const w of warnings) log('plugins', `${manifest.id}: ${w}`, null, 'warning')

    if (loaded.has(manifest.id)) { log('plugins', `"${manifest.id}" already loaded`, null, 'warning'); return }
    if (typeof module?.activate !== 'function') {
      states.set(manifest.id, 'failed')
      throw new Error(`[plugins] "${manifest.id}" entry has no activate(api) export`)
    }
    // Contract compatibility: a plugin built against an incompatible SDK/host would
    // fail in confusing ways at runtime (missing exports, changed shapes), so refuse
    // it up front with a legible message.
    for (const [engine, range] of Object.entries(manifest.engines ?? {})) {
      const hostVersion = engines[engine]
      if (hostVersion == null) {
        log('plugins', `${manifest.id}: requires unknown engine "${engine}" (${range}) — not checked`, null, 'warning')
        continue
      }
      const ok = satisfies(hostVersion, range)
      if (ok === null) {
        log('plugins', `${manifest.id}: unparseable engines.${engine} range "${range}" — not checked`, null, 'warning')
        continue
      }
      if (!ok) {
        states.set(manifest.id, 'failed')
        throw new Error(`[plugins] "${manifest.id}" requires ${engine} ${range}, host provides ${hostVersion}`)
      }
    }
    for (const [depId, range] of Object.entries(manifest.dependencies ?? {})) {
      const dep = loaded.get(depId)
      if (!dep) {
        states.set(manifest.id, 'failed')
        throw new Error(`[plugins] "${manifest.id}" depends on "${depId}", which is not loaded`)
      }
      const ok = satisfies(dep.manifest.version, range)
      if (ok === null) {
        log('plugins', `${manifest.id}: unparseable dependency range "${depId}": "${range}" — not checked`, null, 'warning')
      } else if (!ok) {
        states.set(manifest.id, 'failed')
        throw new Error(`[plugins] "${manifest.id}" requires "${depId}" ${range}, but ${dep.manifest.version} is loaded`)
      }
    }

    states.set(manifest.id, 'loading')
    const api = createPluginApi(manifest, host)
    let result
    try {
      result = module.activate(api)   // plugin contributes through its scoped api
    } catch (err) {
      states.set(manifest.id, 'failed')
      throw new Error(`[plugins] "${manifest.id}" activate() threw: ${err?.message ?? err}`)
    }
    return finalize(manifest, api, module, result)
  }

  function unload(id) {
    const p = loaded.get(id)
    if (!p) return
    const dependents = [...loaded.values()].filter(o => o.manifest.dependencies?.[id])
    if (dependents.length) {
      throw new Error(`[plugins] cannot unload "${id}" — required by ${dependents.map(d => d.manifest.id).join(', ')}`)
    }
    try { if (typeof p.dispose === 'function') p.dispose() } catch (err) { log('plugins', `"${id}" dispose threw`, err, 'error') }
    try { p.module.deactivate?.(p.api) } catch (err) { log('plugins', `"${id}" deactivate threw`, err, 'error') }
    loaded.delete(id)
    states.delete(id)
  }

  // Load many lazily-imported plugins. Each entry is { manifest, load } where
  // load() => Promise<module>. Two phases:
  //   1. Import every module in parallel (the slow I/O). A failed import is
  //      isolated, logged, and that plugin is skipped — peers still resolve.
  //   2. Activate the successful imports sequentially in dependency order, so a
  //      dependent always sees its dependencies already active and registrations
  //      don't interleave. Each activate() is independently guarded.
  // Plugins with missing/cyclic dependencies are dropped by order() up front.
  async function loadAllAsync(lazyEntries) {
    const ordered = order(lazyEntries, log)
    for (const e of ordered) states.set(e.manifest.id, 'loading')

    const imported = await Promise.all(ordered.map(async (e) => {
      try {
        return { manifest: e.manifest, module: await e.load() }
      } catch (err) {
        states.set(e.manifest.id, 'failed')
        log('plugins', `"${e.manifest.id}" failed to import: ${err?.message ?? err}`, null, 'error')
        return { manifest: e.manifest, module: null }
      }
    }))

    for (const { manifest, module } of imported) {
      if (!module) continue
      try { await load(manifest, module) } catch (err) { log('plugins', String(err?.message ?? err), null, 'error') }
    }
  }

  return {
    load,
    unload,
    loadAllAsync,
    isLoaded,
    stateOf,
    states,   // reactive id → state map, for a plugin-manager UI
    failures: () => [...states].filter(([, s]) => s === 'failed').map(([id]) => id),
    get: (id) => loaded.get(id)?.manifest ?? null,
    list: () => [...loaded.values()].map(p => p.manifest),
  }
}

function isThenable(v) { return v != null && typeof v.then === 'function' }

// Topologically order { manifest, … } entries by manifest.dependencies. Entries
// whose dependencies are absent from the set, or that participate in a cycle, are
// dropped with a log note (load() would reject them anyway).
function order(entries, log) {
  const byId = new Map(entries.map(e => [e.manifest.id, e]))
  const out = []
  const done = new Set()
  const visiting = new Set()

  function visit(id) {
    if (done.has(id)) return true
    if (visiting.has(id)) { log('plugins', `dependency cycle involving "${id}" — skipped`, null, 'warning'); return false }
    const entry = byId.get(id)
    if (!entry) return false
    visiting.add(id)
    for (const depId of Object.keys(entry.manifest.dependencies ?? {})) {
      if (!byId.has(depId)) { log('plugins', `"${id}" depends on missing "${depId}" — skipped`, null, 'warning'); visiting.delete(id); return false }
      if (!visit(depId)) { visiting.delete(id); return false }
    }
    visiting.delete(id)
    done.add(id)
    out.push(entry)
    return true
  }

  for (const e of entries) visit(e.manifest.id)
  return out
}
