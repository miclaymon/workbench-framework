import { reactive } from '../reactivity.js'
import { activityFromDefinition } from '../models/ui/index.js'

// ── View / section / status registry (dynamic) ──────────────────────────────────
//
// A flat id → entry lookup aggregated from the per-activity definition modules in
// `client/activities/`. Activities are the source of truth (grouped by activity);
// the panel system (ViewContentHost, ViewContainer, SplitView …), the editor
// (TabContentHost), and the status bar resolve content by a flat id through the
// helpers here.
//
// The stores are reactive and populated through registerActivity(), so first-party
// activities (bootstrapped below) and third-party plugins (which call the same
// entry point at runtime via the facade) share one registration path —
// registering or removing an activity adds/removes its surfaces live.
//
// Entry shape (unchanged from before the activity grouping):
//   label      display name (also the default heading/tab label)
//   icon       MDI path string
//   component  the Vue component (markRaw'd — no need for reactivity)
//   kind       (tab views) the runtime editor-tab kind this view renders
//   homeView   (sections) the View this section natively belongs to
//   sections   (Views that own sections) ordered section ids
//   props(ctx) → object of props bound to the component (ctx = the activity host)
//   on(ctx)    → object of event listeners
//   expose     name of a Workbench ref to populate with the mounted instance
//
// `ctx` passed to props/on is the activity host (see useActivityHost.js).

const REGISTRY         = reactive({})   // view / section / tab id → View instance
const STATUS_VIEWS     = reactive({})   // status id → StatusView instance (activityId stamped)
const MODALS           = reactive({})   // modal id → ModalView instance (activityId stamped)
const VIEW_TO_ACTIVITY = reactive({})   // view / section / tab id → activity id
const TAB_KIND         = reactive({})   // tab kind → { activityId, viewId }
const REGISTERED       = reactive({})   // activity id → Activity instance

// Place a single view into the flat stores by its surface type.
function ingestView(activityId, view) {
  if (view.surface === 'status') {
    view.activityId = activityId
    STATUS_VIEWS[view.id] = view
    return
  }
  if (view.surface === 'modal') {
    view.activityId = activityId
    MODALS[view.id] = view
    VIEW_TO_ACTIVITY[view.id] = activityId
    // A promotable modal (one with a tab `kind`) is also resolvable as a tab view,
    // so "Open in Main Window" can render the same body component in the grid — it
    // lives in MODALS *and* REGISTRY/TAB_KIND simultaneously.
    if (view.kind) {
      REGISTRY[view.id] = view
      TAB_KIND[view.kind] = { activityId, viewId: view.id }
    }
    return
  }
  REGISTRY[view.id] = view
  VIEW_TO_ACTIVITY[view.id] = activityId
  if (view.surface === 'editor' && view.kind) TAB_KIND[view.kind] = { activityId, viewId: view.id }
}

// Ingest one activity's contributed surfaces. Accepts an Activity instance (how a
// plugin authors) or a declarative definition (first-party, wrapped here). Returns
// a disposer that removes them again (used by facade.activities.register).
export function registerActivity(actOrDef) {
  const activity = activityFromDefinition(actOrDef)
  REGISTERED[activity.id] = activity
  for (const view of activity.views.values()) ingestView(activity.id, view)
  return () => unregisterActivity(activity.id)
}

export function unregisterActivity(id) {
  const activity = REGISTERED[id]
  if (!activity) return
  for (const view of activity.views.values()) {
    if (view.surface === 'status') { delete STATUS_VIEWS[view.id]; continue }
    if (view.surface === 'modal')  {
      delete MODALS[view.id]; delete VIEW_TO_ACTIVITY[view.id]
      if (view.kind) { delete REGISTRY[view.id]; delete TAB_KIND[view.kind] }
      continue
    }
    delete REGISTRY[view.id]
    delete VIEW_TO_ACTIVITY[view.id]
    if (view.surface === 'editor' && view.kind) delete TAB_KIND[view.kind]
  }
  delete REGISTERED[id]
}

// Modal views contributed by activities, looked up / listed by the modal host.
export function getModal(id) { return MODALS[id] ?? null }
export function listModals() { return Object.values(MODALS) }

// (No bootstrap here — the host app registers its first-party activities through
// registerActivity() before rendering, the same path plugins use at runtime.)

export function getViewEntry(id) {
  return REGISTRY[id] ?? null
}

// ── Activity-aware lookups ─────────────────────────────────────────────────────

// The activity that owns a given view/section/tab id.
export function activityOfView(id) {
  return VIEW_TO_ACTIVITY[id] ?? null
}

/** The activity id that owns a given tab kind (defaults to the core activity). */
export function activityOfTabKind(kind) {
  return TAB_KIND[kind]?.activityId ?? 'workbench'
}

/** The tab-view id registered for a given tab kind, if any. */
export function tabViewIdForKind(kind) {
  return TAB_KIND[kind]?.viewId ?? null
}

// Resolve an editor tab (by its runtime `kind`) to its tab-view registry entry.
export function tabViewForKind(kind) {
  const id = tabViewIdForKind(kind)
  return id ? REGISTRY[id] : null
}

// Resolve the icon descriptor (ResolvedIcon shape) for an editor tab. When the
// tab's editor-view defines a per-tab tabIcon(tab) — e.g. Preview returns its
// thumbnail or file-type icon — use it; otherwise the view's static kind icon as
// an MDI path. `dynamic:false` forces the static kind icon, which renderers use as
// the fallback when a dynamic <img> icon fails to load. Returns null when the kind
// has no registered view/icon (the renderer then shows nothing or its own default).
export function tabIconDescriptor(tab, { dynamic = true } = {}) {
  const view = tabViewForKind(tab.kind)
  if (!view) return null
  if (dynamic && typeof view.tabIcon === 'function') {
    const d = view.tabIcon(tab)
    if (d) return d
  }
  return view.icon ? { type: 'svg.path', icon: view.icon } : null
}

// Status-bar widgets contributed by activities, in registration order, optionally
// filtered by region ('left' | 'right').
export function getStatusViews(region) {
  const all = Object.values(STATUS_VIEWS).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return region ? all.filter(v => (v.region ?? 'left') === region) : all
}

export function listActivities() {
  return Object.values(REGISTERED).map(a => ({ id: a.id, label: a.label, icon: a.icon, core: !!a.builtin }))
}

// Panel views destined for the primary side bar (the Activity Bar entries), in
// registration order — Explorer first, then any plugin-contributed activities.
export function listPrimaryViews() {
  return Object.values(REGISTRY)
    .filter(v => v.surface === 'panel' && v.location === 'PrimarySideBar')
    .map(v => ({ id: v.id, icon: v.icon, label: v.label }))
}

export function getActivity(id) {
  return REGISTERED[id] ?? null
}

// ── View capability flags ──────────────────────────────────────────────────────

// Whether other Views' sections may be docked into this View (default true).
export function viewAcceptsSections(viewId) {
  return getViewEntry(viewId)?.acceptsSections !== false
}

// Whether a View may hold the same section id more than once (default false).
export function viewAllowsDuplicateSections(viewId) {
  return getViewEntry(viewId)?.allowDuplicateSections === true
}

// ── Action buttons & heading visibility ────────────────────────────────────────
// Buttons cascade by hierarchy: a section's buttons live in its section heading
// when shown, else bubble to the view heading, else to the tab strip; a view's
// buttons live in its view heading when shown, else the tab strip. Each level
// renders the groups it holds inline, separated, with panel actions last.

// A View's own action buttons (e.g. Debug's Clear).
export function viewActions(viewId) {
  return getViewEntry(viewId)?.actions ?? []
}

// A named section's own action buttons (e.g. Places' Refresh).
export function sectionActions(sectionId) {
  return getViewEntry(sectionId)?.actions ?? []
}

// Whether a section's heading is rendered: when its View has more than one
// section, or the section opts in via `alwaysShowHeading` (e.g. Places, so its
// heading — and Refresh button — stay put even when it's Explorer's only section).
export function sectionHeadingShown(sections, section) {
  return (Array.isArray(sections) && sections.length > 1) || !!section?.alwaysShowHeading
}

// Section actions that must bubble up because their own heading is hidden. A
// self-section (id === viewId) contributes nothing — it's the View's own content,
// represented by viewActions. Named sections whose heading shows keep their
// buttons there.
export function bubbledSectionActions(viewId, sections) {
  const out = []
  for (const s of (sections ?? [])) {
    if (s.id === viewId) continue
    if (sectionHeadingShown(sections, s)) continue
    out.push(...sectionActions(s.id))
  }
  return out
}

// ── Semantic DOM ID helpers ────────────────────────────────────────────────────
// Used to stamp data-view-id / data-section-id / data-section-instance-uuid
// attributes onto rendered elements for automation and DevTools inspection.

function _cap(str) { return str.charAt(0).toUpperCase() + str.slice(1) }

// e.g. 'explorer' → 'Workbench:Explorer'
export function viewDataId(viewId) {
  return `Workbench:${_cap(viewId)}`
}

// e.g. ('openEditors', 'explorer') → 'Workbench:Explorer.OpenEditors'
//      ('debug', 'debug')          → 'Workbench:Debug'  (self-section)
export function sectionDataId(sectionId, homeViewId) {
  const home = homeViewId ?? sectionId
  if (sectionId === home) return `Workbench:${_cap(sectionId)}`
  return `Workbench:${_cap(home)}.${_cap(sectionId)}`
}

export function useViewRegistry() {
  return { registry: REGISTRY, getViewEntry }
}
