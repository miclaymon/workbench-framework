import { computed, ref, watch } from '../reactivity.js'
import { activityOfTabKind, registerActivity, unregisterActivity, getModal, listModals } from '../registries/viewRegistry.js'
import { collectLeaves } from '../layout/layoutGrid.js'
import { registerPreferences } from '../registries/preferenceSchema.js'
import { registerIconTheme, setActiveIconTheme, listIconThemes } from '../registries/iconRegistry.js'
import { openLightbox, closeLightbox, lightboxActive } from '../services/lightbox.js'
import { openPeek, closePeek, peekActive } from '../services/peek.js'
import { createEmitter } from '../emitter.js'
import { createCommandRegistry } from '../registries/commandRegistry.js'
import { createKeybindingRegistry } from '../registries/keybindingRegistry.js'
import { createHookRegistry } from '../registries/hookRegistry.js'

// ── Activity host (broker) ──────────────────────────────────────────────────
//
// Instantiates every activity's runtime API and brokers collaboration between
// them. It is the single object handed to view/section/status content as their
// binding context (replacing the old ad-hoc `viewCtx`): registry entries read
// app-level state, query other activities via `api(id)`, and read the active
// activity's published `selection` capability — none of them reach across
// activity boundaries directly.
//
// The frozen `host.facade` is the public contribution + query surface third-party
// plugins will eventually import: commands, keybindings, hooks, the menu
// contribution API, dynamic activity registration, app-level pub/sub (`events`),
// capability resolution (`selection`), peer-activity query (`peer`), and `log`.
// The host itself additionally carries internal wiring (services, late-bound slice
// handlers) that the facade deliberately hides from plugins.
//
// Params:
//   editor      the editor-grid slice (active tab / group / root)
//   prefs       reactive preferences object
//   services    app services + late-bound handlers shared with activity setups and
//               registry entries (fsStat, uuid, statusbar, …); the host app assigns
//               slice handlers onto the returned host after its slices initialise.
//               services.callPluginRpc(pluginId, method, params, opts) enables the
//               plugin `server` permission slice (see plugins/pluginApi.js).
//   log         debug logger passed to activity setups
//   activities  the host app's initial (first-party) activity definitions; their
//               runtime APIs are instantiated here. Their SURFACES must already be
//               in the view registry (the app registers them via registerActivity
//               before building the host — same split as before extraction).
// Structural equality for two tab `params` bags (plain JSON-able objects). Used by
// openTab to decide whether an existing tab represents the same target — null/
// undefined both mean "no params" (singleton kinds), so they compare equal.
function sameParams(a, b) {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

export function useActivityHost({ editor, prefs, services = {}, log = () => {}, activities = [] }) {
  const apis = new Map()
  const activityDefs = new Map()
  const appEvents = createEmitter()

  const activeTab        = editor.activeTab
  const activeGroupId    = editor.activeGroupId
  const editorRoot       = editor.editorRoot
  const activeActivityId = computed(() => activityOfTabKind(activeTab.value?.kind))

  /** The runtime API for an activity, or null if it has none. */
  function api(id) { return apis.get(id) ?? null }
  function requireApi(id) {
    const a = apis.get(id)
    if (!a) throw new Error(`[activity-host] no API registered for activity "${id}"`)
    return a
  }

  // The active activity's published selection snapshot, or null when the active
  // activity publishes none (e.g. the Home tab). Consumers (Preview, Details,
  // status widgets) read this and self-gate when it is null.
  const selection = computed(() => api(activeActivityId.value)?.selection?.value ?? null)

  const host = {
    // app-level reactive context
    activeTab, activeGroupId, editorRoot, activeActivityId,
    prefs,
    // capability resolution
    selection,
    // activity API access
    api, requireApi,
    activities: () => [...apis.keys()],
    // app-level pub/sub
    on:   appEvents.on,
    once: appEvents.once,
    emit: appEvents.emit,
    // convenience: push to the Debug activity's log over its API
    log: (...a) => api('debug')?.log?.(...a),
    // shared services / late-bound slice handlers (Workbench fills these in)
    services,
  }

  // ── Command registry + public facade ──────────────────────────────────────
  // Commands are the single source of truth for invokable behaviour; menus,
  // keybindings, and the palette reference them by id. getCtx() returns the host
  // so a command's run(ctx)/when(ctx) receive the same binding context view and
  // section actions already use — resolved lazily because the host is augmented
  // with slice handlers only after the activities below are set up.
  const commands = createCommandRegistry({ getCtx: () => host, log })
  const keybindings = createKeybindingRegistry({ log })
  const hooks = createHookRegistry({ log })

  // Editor capability: open editor tabs by kind. The tab body resolves through the
  // registry (tabViewForKind), so activities/plugins contribute editor tabs without
  // reaching into the editor-grid slice directly.
  const editorApi = {
    // `params` is opaque per-tab context fixed at open time (e.g. the Git Graph's
    // repo, or a Preview's item) — the tab view reads it via props(tab, ctx).
    // focusExisting (default) avoids duplicates by focusing a tab of the same kind
    // AND the same params: a singleton kind (no params) always matches, while a
    // per-item kind matches only the same item (so two different previews/repos
    // open two tabs, but re-opening one focuses it). Pass focusExisting:false to
    // force a distinct tab every time. `toSide` opens the tab in a split group to
    // the right of the active one (e.g. "Open Preview to the Side").
    openTab(kind, { title, params = null, focusExisting = true, toSide = false } = {}) {
      if (focusExisting) {
        const existing = editor.findTab(t => t.kind === kind && sameParams(t.params, params))
        if (existing) { editor.focusTab(existing.groupId, existing.tab.id); return existing.tab.id }
      }
      const id = services.uuid()
      const tab = {
        id, kind, title: title ?? kind,
        mode: 'normal', pinned: false, selectedItems: [], focusedItem: null, selectedPath: '', path: '',
      }
      if (params) tab.params = params
      if (toSide) editor.openTabBeside(tab, 'right')   // new split group holds just this tab
      else editor.addTabToActiveGroup(tab)
      return id
    },
    // A read-only snapshot of every open tab across all groups (id/kind/title/path)
    // — lets an activity/plugin reason about what's open (e.g. which directories,
    // for repo detection) without reaching into the editor-grid slice.
    tabs() {
      return collectLeaves(editorRoot.value).flatMap(leaf =>
        (leaf.tabs ?? []).map(t => ({ id: t.id, kind: t.kind, title: t.title, path: t.path ?? '' })))
    },
  }

  // Modal controller: a single active-modal id. Modals are activity-contributed
  // ModalView surfaces (Settings, Keyboard Shortcuts, …); ModalHost renders the
  // active one in the ModalEditor shell. open/close drive it; commands and menus
  // open a modal by id instead of toggling a per-modal ref.
  const activeModalId = ref(null)
  const modals = {
    open(id) { if (getModal(id)) activeModalId.value = id; else log('modals', `no such modal "${id}"`) },
    close() { activeModalId.value = null },
    // Promote a modal to a real editor tab ("Open in Main Window"): present the
    // same ModalView as a tab (its `kind` resolves the body via the registry),
    // then close the modal.
    promote(id) {
      const view = getModal(id)
      if (!view?.kind) { log('modals', `modal "${id}" is not promotable`); return }
      editorApi.openTab(view.kind, { title: view.label })
      modals.close()
    },
    active: activeModalId,
    get: getModal,
    list: listModals,
  }

  // Menu contribution API: app-level menus (the menu bar and shared context menus)
  // collect items from any activity/plugin. Backed by the hook registry — each
  // contribution is an ordered hook on `menu:<id>` that appends its items, and
  // menus.items() runs them to produce the merged descriptor list. Each item is a
  // `{ command }` reference or a literal menu descriptor the caller resolves.
  const menus = {
    register(menuId, contribution) {
      return hooks.add(`menu:${menuId}`, (items, ctx) => {
        if (contribution.when && !contribution.when(ctx)) return items
        const extra = contribution.build ? (contribution.build(ctx) ?? [])
                    : contribution.items ? contribution.items
                    : contribution.command ? [{ command: contribution.command, label: contribution.label, icon: contribution.icon }]
                    : []
        return [...items, ...extra]
      }, contribution.order ?? 0)
    },
    items(menuId, ctx) { return hooks.apply(`menu:${menuId}`, [], ctx) },
  }

  // Instantiate one activity's runtime API. Surfaces (views / sections / status)
  // are registered separately via registerActivity(); facade.activities.register
  // does both for plugins added at runtime.
  function instantiateActivity(def) {
    apis.set(def.id, def.setup ? def.setup({ api: facade, host, editor, prefs, services, log }) : {})
    activityDefs.set(def.id, def)
  }

  // The frozen public facade: the contribution + query surface handed to every
  // activity's setup() as `api`, and the same surface third-party plugins will
  // eventually import as the Workbench API. It exposes only registration, events,
  // capabilities, and queries — never internal services or slice handlers.
  const facade = Object.freeze({
    commands: {
      register:  commands.register,
      execute:   commands.execute,
      get:       commands.get,
      list:      commands.list,
      isEnabled: commands.isEnabled,
    },
    // keybindings (chord → command); the dispatcher lives in useWorkbenchKeyboard.
    // list/forCommand let the palette and keyboard-shortcuts viewer read bindings.
    keybindings: { register: keybindings.register, list: keybindings.list, forCommand: keybindings.forCommand },
    // generic ordered hooks (transform/veto), and the menu contribution API
    // (app-level menus + shared context menus) built on top of them
    hooks: { add: hooks.add, apply: hooks.apply, has: hooks.has },
    menus: { register: menus.register, items: menus.items },
    // modal surfaces (open/close/promote by id; `active` is a readonly ref of the open id)
    modals: { open: modals.open, close: modals.close, promote: modals.promote, active: activeModalId, get: getModal, list: listModals },
    // editor capability: open registered editor tabs by kind; read open tabs
    editor: { openTab: editorApi.openTab, tabs: editorApi.tabs },
    // preferences: contribute a settings section (schema) + read a value by path
    preferences: {
      register: registerPreferences,
      get: (path) => String(path).split('.').reduce((o, k) => o?.[k], prefs),
    },
    // icon themes: an icon-pack plugin registers a getIcon handler; renderers
    // resolve item icons through the active one (layer 2 of the icon pipeline).
    icons: { register: registerIconTheme, setActive: setActiveIconTheme, list: listIconThemes },
    // lightbox: open a near-fullscreen overlay with a component + props (e.g. the
    // Preview plugin's single-item media viewer). `active` is a readonly ref.
    lightbox: { open: openLightbox, close: closeLightbox, active: lightboxActive },
    // peek: open a positioned popup near a trigger rect (the keyboard hold-Space
    // preview). `active` is a readonly ref.
    peek: { open: openPeek, close: closePeek, active: peekActive },
    // dynamic activity registration. First-party activities use the bootstrap
    // below; a plugin calls register() at runtime to add an activity's API and its
    // surfaces together, and gets a disposer that removes both.
    activities: {
      register(def) {
        if (apis.has(def.id)) { log('activities', `"${def.id}" already registered`); return () => {} }
        instantiateActivity(def)
        const disposeSurfaces = registerActivity(def)
        appEvents.emit('activity-register', def.id)
        return () => {
          appEvents.emit('activity-unregister', def.id)
          disposeSurfaces()
          apis.delete(def.id)
          activityDefs.delete(def.id)
        }
      },
      unregister(id) {
        if (!apis.has(id)) return
        appEvents.emit('activity-unregister', id)
        unregisterActivity(id)
        apis.delete(id)
        activityDefs.delete(id)
      },
      get(id)  { return activityDefs.get(id) ?? null },
      list()   { return [...activityDefs.values()].map(a => ({ id: a.id, label: a.label, icon: a.icon, core: !!a.core })) },
    },
    // app-level pub/sub
    events: { on: appEvents.on, once: appEvents.once, emit: appEvents.emit },
    // active activity's published selection snapshot (capability)
    selection,
    // query another activity's API
    peer: api,
    // read-only app-level context
    query: {
      get activeTab()        { return activeTab.value },
      get activeActivityId() { return activeActivityId.value },
    },
    // push to the Debug activity's log
    log: (...a) => api('debug')?.log?.(...a),
  })
  host.facade = facade
  host.keybindings = keybindings   // internal: the keyboard dispatcher reads forChord()

  // Instantiate the initial (first-party) activity APIs — their surfaces were
  // registered by the host app before building the host. setup receives the public
  // `api` (facade) plus internal wiring (host/editor/prefs/services/log); it may
  // read other activities lazily via host.api(), and none do so synchronously, so
  // list order is safe.
  for (const def of activities) instantiateActivity(def)

  // Re-broadcast active-tab / active-activity changes as app-level events so
  // activities can react without watching the editor grid directly. The active-tab
  // signal keys on the tab's id AND path: navigating a directory tab mutates its
  // `path` in place (same tab object), so a plain identity watch would miss it —
  // and consumers like Source Control re-detect repos from the open dir tabs' paths.
  watch(
    () => { const t = activeTab.value; return t ? `${t.id} ${t.path ?? ''}` : null },
    () => appEvents.emit('active-tab-change', activeTab.value),
  )
  watch(activeActivityId, id  => appEvents.emit('active-activity-change', id))

  // The active icon theme follows the `iconTheme` preference; the registry falls
  // back to the first registered theme when it is unset or names an unloaded pack.
  watch(() => prefs.iconTheme, id => { if (id) setActiveIconTheme(id) }, { immediate: true })

  return host
}
