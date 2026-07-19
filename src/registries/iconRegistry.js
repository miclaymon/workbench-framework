import { reactive, ref, computed, readonly } from '../reactivity.js'

// ── Icon-theme registry (dynamic) ───────────────────────────────────────────────
//
// The generic layer-2 of the icon priority pipeline (after custom .directory /
// desktop.ini icons, before the default MDI glyphs). An icon-pack plugin registers
// a theme through the Workbench facade (`api.icons.register`, gated by the `icons`
// permission); renderers resolve an icon for an item by calling resolveIcon(ctx),
// which delegates to the *active* theme's getIcon handler.
//
// Module singleton (same pattern as useViewRegistry / the former useIconPack) so
// plain renderer components — TreeItem, DirectoryLayout, the file-tree composable,
// SourceControlFileTree, DetailsSectionInfo — can consume it without the activity
// host. Only the active theme is consulted; a user may have several installed.
//
// Theme: { id, label, getIcon }
//   getIcon(ctx) => result | null
//     ctx    { path, name, isDir, kind, extension, expanded,
//              mimeType?, hasThumbnail, hasCustomIcon, activityName, activityContext? }
//     result { type:'url'|'component'|'svg.path'|'file.path', icon }
//     null   → no pack icon; the renderer falls through to its MDI default.

const _themes      = reactive(new Map())   // id → { id, label, getIcon }
const _activeId    = ref(null)             // currently-consulted theme id
const _preferredId = ref(null)            // user/preference choice (wins when present)

// Pick the active theme: the preferred one if it is registered, else keep the
// current active if still valid, else the first registered (so a freshly-loaded
// pack lights up immediately without any selection).
function _recomputeActive() {
  if (_preferredId.value && _themes.has(_preferredId.value)) { _activeId.value = _preferredId.value; return }
  if (_activeId.value && _themes.has(_activeId.value)) return
  _activeId.value = _themes.size ? _themes.keys().next().value : null
}

export function registerIconTheme({ id, label, getIcon } = {}) {
  if (!id || typeof getIcon !== 'function') {
    throw new Error('[icon-registry] register requires { id, getIcon }')
  }
  _themes.set(id, { id, label: label ?? id, getIcon })
  _recomputeActive()
  return () => unregisterIconTheme(id)
}

export function unregisterIconTheme(id) {
  if (!_themes.delete(id)) return
  if (_activeId.value === id) _activeId.value = null
  _recomputeActive()
}

// Select the active theme by id. Recorded as the preference even when the theme is
// not registered yet, so a preference read at startup wins once its pack loads.
export function setActiveIconTheme(id) {
  _preferredId.value = id || null
  _recomputeActive()
}

export function listIconThemes() {
  return [..._themes.values()].map(t => ({ id: t.id, label: t.label }))
}

// Resolve an icon descriptor for the active theme. A handler must never break
// rendering, so any throw is swallowed and treated as "no pack icon" (falls back
// to the MDI default). Reads the reactive active id + theme so callers wrapping
// this in a computed re-resolve when the theme (or its loaded data) changes.
export function resolveIcon(ctx) {
  const theme = _activeId.value ? _themes.get(_activeId.value) : null
  if (!theme) return null
  try {
    return theme.getIcon(ctx) ?? null
  } catch {
    return null
  }
}

export const activeIconThemeId = readonly(_activeId)
export const isIconThemeAvailable = computed(() => !!_activeId.value && _themes.has(_activeId.value))

export function useIconRegistry() {
  return { resolveIcon, isIconThemeAvailable, activeIconThemeId, listIconThemes }
}
