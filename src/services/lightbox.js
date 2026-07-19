import { shallowRef, readonly, markRaw } from '../reactivity.js'

// ── Lightbox service (singleton) ────────────────────────────────────────────────
//
// A near-fullscreen overlay any activity/plugin can open to present content
// (typically a media item) above the workbench. Same module-singleton pattern as
// useIconRegistry / useDebugLog: state lives here, the host (LightboxHost.vue,
// mounted once by Workbench) renders the active entry, and the Workbench facade
// re-exports open/close/active so plugins reach it through the public API
// (`api.lightbox`, gated by the `lightbox` permission).
//
// An entry is an imperative render descriptor — { component, props } — so the
// caller fully controls what's shown (the Preview plugin passes its single-item
// media renderer + the item). Only one lightbox is open at a time.

const _active = shallowRef(null)   // { component, props } | null

// Open the lightbox with a component + props. The component is markRaw'd so Vue
// doesn't try to make it reactive. Passing nothing/!component is a no-op.
export function openLightbox({ component, props = {} } = {}) {
  if (!component) return
  _active.value = { component: markRaw(component), props }
}

export function closeLightbox() { _active.value = null }

// Readonly active entry for the host to render and for `facade.lightbox.active`.
export const lightboxActive = readonly(_active)

export function useLightbox() {
  return { active: lightboxActive, open: openLightbox, close: closeLightbox }
}
