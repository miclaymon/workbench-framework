import { grantedPermissions } from '../models/plugin/index.js'
import { Activity, View, EditorView, ModalView, PanelView, ViewSection, StatusView } from '../models/ui/index.js'

// ── Plugin API (the WorkbenchAPI a plugin imports) ────────────────────────────
//
// Given a validated manifest and the live activity host, build the frozen,
// permission-scoped surface handed to a plugin's activate(api). The workbench
// facade is the full contribution/query API; this exposes ONLY the slices the
// manifest's permissions grant. A plugin that declares "activities" + "commands"
// gets `api.activities` and `api.commands` and nothing else — the same shape a
// first-party activity's setup() receives, narrowed by permission.
//
// Always available (independent of permissions): the UI model classes a plugin
// constructs its surfaces from (Activity/PanelView/…) — inert until registered —
// plus `log` and a frozen copy of `manifest`.
const UI_MODEL = Object.freeze({ Activity, View, EditorView, ModalView, PanelView, ViewSection, StatusView })

// Each permission → a function that picks its slice from the facade.
const FACADE_SLICE = {
  activities:  (f) => ({ activities: f.activities }),
  commands:    (f) => ({ commands: f.commands }),
  keybindings: (f) => ({ keybindings: f.keybindings }),
  menus:       (f) => ({ menus: f.menus }),
  hooks:       (f) => ({ hooks: f.hooks }),
  modals:      (f) => ({ modals: f.modals }),
  editor:      (f) => ({ editor: f.editor }),
  preferences: (f) => ({ preferences: f.preferences }),
  events:      (f) => ({ events: f.events }),
  selection:   (f) => ({ selection: f.selection }),
  query:       (f) => ({ query: f.query, peer: f.peer }),
  icons:       (f) => ({ icons: f.icons }),
  lightbox:    (f) => ({ lightbox: f.lightbox }),
  peek:        (f) => ({ peek: f.peek }),
}

export function createPluginApi(manifest, host) {
  const facade = host.facade
  const api = {
    ...UI_MODEL,
    manifest: Object.freeze({ ...manifest }),
    log: (...args) => host.log?.(`plugin:${manifest.id}`, ...args),
  }
  const granted = grantedPermissions(manifest)
  for (const perm of granted) {
    const pick = FACADE_SLICE[perm]
    if (pick) Object.assign(api, pick(facade))
  }

  // Capability slices — host-mediated stand-ins for ambient globals, so a plugin's
  // supported path to the network / persistence / clipboard is `api`, not raw
  // window.fetch / localStorage (which the capability scan flags). This is
  // defense-in-depth + auditability, not a sandbox (see docs/PLUGINS.md).
  if (granted.includes('net')) {
    const origins = Array.isArray(manifest.net?.origins) ? manifest.net.origins : []
    api.net = Object.freeze({
      // fetch, restricted to the manifest's declared origins.
      fetch: (url, opts) => {
        let u
        try { u = new URL(url, globalThis.location?.href) } catch { return Promise.reject(new Error('net: invalid url')) }
        if (!origins.includes(u.origin)) {
          return Promise.reject(new Error(`net: origin ${u.origin} is not in this plugin's declared net.origins`))
        }
        return fetch(u.href, opts)
      },
      origins: Object.freeze([...origins]),
    })
  }
  if (granted.includes('storage')) {
    const prefix = `fw:plugin:${manifest.id}:`
    const CAP = 1 << 20 // ~1 MB soft cap per value
    api.storage = Object.freeze({
      get: (key) => { try { const v = localStorage.getItem(prefix + key); return v == null ? null : JSON.parse(v) } catch { return null } },
      set: (key, value) => {
        const s = JSON.stringify(value ?? null)
        if (s.length > CAP) throw new Error('storage: value exceeds the per-value quota')
        localStorage.setItem(prefix + key, s)
      },
      remove: (key) => localStorage.removeItem(prefix + key),
      keys: () => Object.keys(localStorage).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)),
    })
  }
  if (granted.includes('clipboard')) {
    api.clipboard = Object.freeze({
      readText:  () => navigator.clipboard?.readText?.()  ?? Promise.reject(new Error('clipboard: unavailable')),
      writeText: (t) => navigator.clipboard?.writeText?.(String(t)) ?? Promise.reject(new Error('clipboard: unavailable')),
    })
  }

  // The "server" permission grants `api.server`, a client bridge to the plugin's OWN
  // sandboxed WASM backend — bound to this plugin's id, so it can never call another
  // plugin's backend. `call(method, params, { write })` returns the backend's result
  // (or throws). The permission IS the capability; the manifest's `server` block only
  // declares the backend (consumed by the build + Go host), and a runtime-loaded
  // plugin's manifest doesn't carry it — so gate on the permission alone. A call with
  // no backend loaded just fails (404), which callers already handle.
  //
  // The transport is host-provided (the framework is delivery-agnostic): the host app
  // supplies services.callPluginRpc(pluginId, method, params, opts). Without it the
  // slice is omitted and the plugin degrades as if its backend were unavailable.
  if (granted.includes('server')) {
    const rpc = host.services?.callPluginRpc
    if (typeof rpc === 'function') {
      const id = manifest.id
      api.server = Object.freeze({
        call: (method, params, opts) => rpc(id, method, params, opts),
      })
    } else {
      host.log?.('plugins', `"${manifest.id}" declares the server permission but the host provides no callPluginRpc service — api.server unavailable`, null, 'warning')
    }
  }

  return Object.freeze(api)
}
