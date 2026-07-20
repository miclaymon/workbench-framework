# @workbench/framework

The Workbench framework — the connective layer of a workbench-style application:

- **Activity host + facade** (`useActivityHost`) — instantiates activity runtime
  APIs and brokers collaboration (capability pull, pub/sub, peer query). Builds the
  frozen `host.facade`: the contribution + query surface (commands, keybindings,
  menus, hooks, activities, modals, editor, preferences, icons, lightbox, peek,
  events, selection, query) handed to every activity `setup()` and — narrowed by
  permission — to plugins.
- **Contribution registries** — commands (single source of truth for invokable
  behaviour), keybindings (chord → command), hooks (ordered transform/veto
  chains), the dynamic view/section/status/modal registry, icon themes, and
  preference-schema sections.
- **Plugin system** — Chrome-style manifest validation + permission catalog,
  `createPluginApi` (the frozen permission-scoped API), and `createPluginHost`
  (dependency-ordered load/unload with lifecycle + fault isolation). Delivery- and
  transport-agnostic: the host app fetches/verifies artifacts and supplies
  `services.callPluginRpc` for plugin backends.
- **UI model classes** — `Activity`, `View`, `EditorView`, `ModalView`,
  `PanelView`, `ViewSection`, `StatusView`: metadata + a component reference,
  renderer-neutral.
- **Split-grid layout engine** (`layoutGrid`) — the pure recursive editor-grid
  tree (leaves/branches, insert/remove/merge/presets). No DOM, no reactivity.
- **Overlay services** — lightbox and peek singleton stores (a UI package renders
  the active entry).

## Reactivity

Built on **`@vue/reactivity` only** (peer dependency) — reactive stores, no Vue
components or renderer. A Vue host consumes the stores natively; React/Solid
adapters can subscribe via `watch`/`effect`.

**Single-instance requirement**: the host app must resolve `@vue/reactivity` to
the same module instance its renderer uses (for Vue apps, the copy inside `vue`).
With Vite:

```js
resolve: { dedupe: ['vue', '@vue/reactivity'] }
```

## Host-app contract

The framework carries no app specifics. The host app provides:

- its first-party activity definitions — registered via `registerActivity(def)`
  before rendering, and passed to `useActivityHost({ activities })` so their
  runtime APIs are instantiated;
- `services` (shared helpers + late-bound handlers activities may use), including
  `services.callPluginRpc(pluginId, method, params, opts)` if plugins with the
  `server` permission should reach their backends;
- plugin *delivery* (fetching, integrity verification, module import) — the host
  hands `createPluginHost` ready `{ manifest, module }` pairs;
- its contract versions, e.g. `createWorkbench({ engines: { sdk: SDK_VERSION } })`.
  A plugin manifest's `engines` block is checked against these **before** it loads:
  an unsatisfied range refuses the plugin with a legible error, an engine the host
  doesn't declare is a warning (forward-compatible). `dependencies` ranges are
  enforced the same way against the loaded plugin's version. Range matching uses
  the bundled `satisfies()` (also exported) — `^`, `~`, comparators, AND-sets and
  `||` alternatives.

## Types

The package ships generated declarations (`types/`, wired through the `exports`
map), emitted from the source JSDoc:

```bash
npm run build:types    # runs tsc via npx — nothing is installed into this repo
```

They are committed; regenerate and commit whenever an exported signature changes.

Used by [Files Workbench](https://github.com/miclaymon/files-workbench); consumed
there via a local install: `npm install ../../workbench-framework`.
