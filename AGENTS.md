# Agent Guide — @workbench/framework

Instructions for AI coding agents (Claude Code, etc.) working in this repository.

This package is the **framework layer** of the Workbench family, extracted from the
[Files Workbench](https://github.com/miclaymon/files-workbench) monolith (see that
repo's `PLAN.md` for the multi-package refactor map). It is consumed there via a
local install (`npm install ../../workbench-framework` → a `file:` symlink), and is
designed to be reusable by non-file-manager workbench apps and by non-Vue renderers.

## What this package is (and is not)

**Is**: the connective tissue of a workbench-style app — activity host + frozen
facade, contribution registries, the plugin system (model + permission-scoped API +
host), UI model classes, overlay-service stores, and the pure split-grid layout
engine.

**Is not**: UI. There are **no components, no DOM access, no renderer imports**
here. A UI package (`@workbench/vue`, later React/Solid) renders these stores; the
host app supplies app specifics (activity definitions, persistence, transports) as
parameters. Keep it that way — if a change needs a component or a fetch, it belongs
in the UI package or the host app, injected through `services` or a parameter.

## Module map (`src/`)

| Module | Contents |
|---|---|
| `workbench.js` | `createWorkbench(options)` / `new Workbench(options)` — the instance a host app creates: ensures activity-surface registration, builds the activity host + facade, creates the plugin host (`workbench.host` / `.facade` / `.plugins`, with a `host.workbench` back-reference). UI packages bind to it (e.g. `@workbench/vue`'s `<WorkbenchApp :workbench>`). |
| `index.js` | The public surface — a flat re-export of every module below. The app imports **only** from here (`from '@workbench/framework'`). Export names are load-bearing: consumers bind by name, so renames are breaking changes. |
| `reactivity.js` | The single indirection point for `@vue/reactivity` primitives. Framework code imports reactivity from here, never from `vue`/`@vue/reactivity` directly. |
| `emitter.js` | `createEmitter()` — tiny synchronous pub/sub with isolated subscriber errors. One per providing activity API + one for the host's app-level events. |
| `registries/commandRegistry.js` | Dynamic command store (`register`→disposer, `execute`, `get`, `list`, `isEnabled`). Commands are the single source of truth for invokable behaviour; `when`/`run` receive the host as ctx. |
| `registries/keybindingRegistry.js` | Chord→command bindings + `normalizeChord`/`formatChord` (`cmd`/`meta` fold to `ctrl`). The keydown dispatcher lives in the host app. |
| `registries/hookRegistry.js` | Ordered transform/veto chains (`add`→disposer, `apply`). The menu contribution API is built on it. |
| `registries/viewRegistry.js` | The dynamic view/section/tab/status/modal registry: reactive by-id stores populated via `registerActivity(def)` / `unregisterActivity(id)`, plus all the lookup/action/heading helpers the panel system uses (`getViewEntry`, `tabViewForKind`, `getStatusViews`, `listPrimaryViews`, `viewActions`, `sectionDataId`, …). **No bootstrap of its own** — the host app registers its first-party activities at startup, the same path plugins use at runtime. |
| `registries/iconRegistry.js` | Icon-theme registry (layer 2 of the host app's icon pipeline): `registerIconTheme({ id, label, getIcon })`, `resolveIcon(ctx)` delegating to the active theme, active-theme selection. |
| `registries/preferenceSchema.js` | Preference-section contributions (`registerPreferences`) merged into the host's settings UI via `contributedSchemaProperties()`. |
| `services/lightbox.js`, `services/peek.js` | Overlay singleton stores (`open*`/`close*` + a readonly active entry). The UI package mounts a host component that renders the active entry. |
| `layout/layoutGrid.js` | Pure recursive split-grid engine (leaf/branch tree, insert/remove/merge, presets). No DOM, no reactivity — callers own the reactive root. |
| `host/activityHost.js` | `useActivityHost({ editor, prefs, services, log, activities })` — instantiates activity runtime APIs, brokers collaboration (peer query, `selection` capability, app-level pub/sub), and builds the frozen **`host.facade`** (commands, keybindings, menus, hooks, activities, modals, editor, preferences, icons, lightbox, peek, events, selection, peer, query, log). |
| `plugins/pluginApi.js` | `createPluginApi(manifest, host)` — the frozen permission-scoped API handed to a plugin's `activate(api)`: UI model classes + `log` + exactly the granted facade slices, plus capability slices (`net`/`storage`/`clipboard`) and the `server` RPC slice (transport injected via `host.services.callPluginRpc`). |
| `plugins/pluginHost.js` | `createPluginHost({ host, log, engines })` — loads/unloads `{ manifest, module }` pairs: manifest validation, **contract checks** (`engines` vs the host's declared versions, `dependencies` vs the loaded plugin's version — both via `models/plugin/semver.js`), dependency ordering, lifecycle disposers, per-plugin fault isolation, reactive `states` map. **Delivery-agnostic**: fetching/verifying/importing artifacts is the host app's job. |
| `models/plugin/semver.js` | Dependency-free `satisfies` / `compareVersions` / `parseVersion`. Supports exact, `^`, `~`, comparators, AND-sets and `\|\|` alternatives; an unparseable range returns `null` so callers can warn-and-skip rather than silently deny. Deliberately not a full semver implementation (no hyphen/x-ranges). |
| `models/ui/` | `Activity`, `View`, `EditorView`, `ModalView`, `PanelView`, `ViewSection`, `StatusView` + `activityFromDefinition` — metadata + a component reference, renderer-neutral (no reactivity, no Vue). |
| `models/plugin/` | Chrome-style `manifest.json` validation + the permission catalog (`PERMISSIONS`, `HOST_PERMISSIONS`, server permissions). Unknown permissions warn, never fail (forward compatible). |

## The reactivity rules (critical)

- Depend on **`@vue/reactivity` only** (peer dependency) — never `vue`. All imports
  go through `src/reactivity.js` so shims/behaviour notes live in one place.
- **Single-instance requirement**: the consuming app must resolve
  `@vue/reactivity` to the same module instance its renderer uses, or dependency
  tracking silently breaks (state renders once, never updates). Vue + Vite hosts
  set `resolve.dedupe: ['vue', '@vue/reactivity']`. Never run `npm install` inside
  THIS repo — a local `node_modules/@vue/reactivity` would shadow the host's copy
  through the `file:` symlink and cause exactly that split-brain. (`npm run
  build:types` runs `tsc` via `npx -p typescript`, so it installs nothing here.)
- **Types are generated and committed.** `types/` is emitted from the JSDoc by
  `npm run build:types` (config: `tsconfig.types.json`) and is the package's
  published type surface (`exports["."].types`). Regenerate and commit it whenever
  an exported signature changes — a stale `types/` misleads consumers silently.
  Improve the JSDoc rather than hand-editing `types/`.
- The standalone `watch` re-exported here (Vue 3.5+) **flushes synchronously** on
  trigger — there is no component scheduler, unlike runtime-core's `flush: 'pre'`
  batching. Keep watch callbacks idempotent and cheap; don't assume coalescing.

## Host-app contract

The framework carries no app specifics. A host app provides:

- **Activity definitions**: register first-party surfaces with
  `registerActivity(def)` before first render, and pass the same list to
  `useActivityHost({ activities })` so their runtime APIs are instantiated (Files
  Workbench does both from `client/activities/index.js` + `Workbench.vue`).
- **`services`**: shared helpers activities/commands reach through the host
  (statusbar, fsStat, uuid, …), plus late-bound slice handlers the app assigns
  onto the host after its slices initialise. `services.callPluginRpc(pluginId,
  method, params, opts)` enables the plugin `server` permission slice; without it
  that slice is omitted and the plugin degrades as if its backend were absent.
- **Plugin delivery**: fetch, integrity-verify, and import plugin artifacts, then
  hand `{ manifest, module }` pairs to `createPluginHost().load(...)`.

## Conventions

- Plain JS + JSDoc (same as the app repo). No TypeScript source; `.d.ts` generation
  from JSDoc is planned.
- No comments unless the WHY is non-obvious; no trailing summary comments.
- Every `register*` returns a disposer; compose disposers for lifecycle cleanup.
- Facade objects handed to activities/plugins are `Object.freeze`d — additions are
  new keys on construction, never post-hoc mutation.
- Keep `index.js` in sync with module exports (it is generated as a flat re-export;
  if you add an export, add it there too).

## Verifying changes

This package has no test suite yet — it is verified through the consuming app:

```bash
cd ../files-workbench-app          # the app repo (branch refactor/multi-package)
cd client && npx vite build        # catches unresolved imports/exports
npm run dev                        # then exercise the app (plugins, palette, panels)
```

The symlinked install means framework edits are picked up by the app's Vite dev
server immediately — no reinstall needed.
