// ── Plugin permissions ────────────────────────────────────────────────────────
//
// Chrome-extension-inspired permission model. A plugin's manifest declares the
// `permissions` it needs; the loader hands it a WorkbenchAPI exposing ONLY the
// facade slices those permissions grant (see usePluginApi.js). A plugin that
// never declares "commands" simply has no `api.commands` to call.
//
// Two tiers, mirroring Chrome's `permissions` vs `host_permissions`:
//   PERMISSIONS       — front-end capabilities, each gating a slice of the
//                       workbench facade (UI contribution + app collaboration).
//   HOST_PERMISSIONS  — access to the host/backend (filesystem, control server).
//                       Declared and surfaced now; enforcement lands with the
//                       backend bridge (no fs in the facade yet).

/** Front-end capability permissions → human description. */
export const PERMISSIONS = Object.freeze({
  activities:  'Contribute and remove activities (panels, editor tabs, status widgets, modals).',
  commands:    'Register commands and execute them by id.',
  keybindings: 'Bind keyboard chords to commands.',
  menus:       'Contribute items into application and context menus.',
  hooks:       'Add ordered transform/veto hooks into app data flows.',
  modals:      'Open, close, and contribute modal editors.',
  editor:      'Open registered editor tabs by kind.',
  preferences: 'Contribute settings to the Settings panel and read their values.',
  events:      'Subscribe to and emit app-level events.',
  selection:   "Read the active activity's selection capability.",
  query:       'Query other activities and read app-level state.',
  icons:       'Register an icon theme that resolves file/folder icons.',
  lightbox:    'Open a near-fullscreen lightbox overlay.',
  peek:        'Open a positioned peek popup near a trigger element.',
  server:      "Call this plugin's own sandboxed WASM backend (declared in `server`).",
  // Capability permissions — each grants a host-mediated `api` slice so a plugin
  // never needs raw ambient globals (see the capability scan + in-realm hardening).
  net:         'Make outbound network requests through `api.net.fetch`, limited to the origins declared in the manifest `net.origins`.',
  storage:     'Persist per-plugin key/value data through `api.storage` (namespaced; not shared with other plugins).',
  clipboard:   'Read and write the system clipboard through `api.clipboard`.',
})

// Host/backend access permissions → human description. Each gates a brokered
// service the Workbench exposes; the plugin never reaches the filesystem or control
// server directly — the Workbench forwards vetted requests to the Go server on its
// behalf. (Git access is no longer here: it moved into the source-control plugin's
// own sandboxed WASM backend, gated by SERVER_PERMISSIONS below.)
export const HOST_PERMISSIONS = Object.freeze({
  'fs:read':      'Read files and directories through the data server.',
  'fs:write':     'Create, rename, move, and delete files through the control server.',
  'control':      'Issue arbitrary control-server operations.',
  'clipboard':    'Read and write the workbench clipboard.',
})

// Server-plugin permissions → human description. Declared inside a plugin's `server`
// block, these gate the host functions its WASM backend may call (see the Go host in
// server/v1/plugin_host.go). `exec` is parameterized per binary — `exec:git` permits
// running only `git`. These are the entire trust surface of a server plugin: with
// none granted, the sandboxed module cannot touch the filesystem, network, or shell.
export const SERVER_PERMISSIONS = Object.freeze({
  exec:       'Run an allowlisted external binary, declared per-tool as exec:<name> (e.g. exec:git).',
  'fs:read':  'Read files and directories from the host filesystem (blacklist-enforced).',
  'fs:write': 'Write files to the host filesystem (blacklist-enforced).',
  net:        'Make outbound network requests.',
})

export const PERMISSION_NAMES = Object.freeze(Object.keys(PERMISSIONS))
export const HOST_PERMISSION_NAMES = Object.freeze(Object.keys(HOST_PERMISSIONS))

export function isKnownPermission(name) { return Object.hasOwn(PERMISSIONS, name) }
export function isKnownHostPermission(name) { return Object.hasOwn(HOST_PERMISSIONS, name) }

// exec is parameterized (exec:<binary>); everything else is an exact catalog match.
export function isKnownServerPermission(name) {
  if (typeof name !== 'string') return false
  if (name.startsWith('exec:')) return name.length > 'exec:'.length
  return Object.hasOwn(SERVER_PERMISSIONS, name)
}
