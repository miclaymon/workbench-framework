import { shallowRef, readonly, markRaw } from '../reactivity.js'

// ── Peek service (singleton) ────────────────────────────────────────────────────
//
// A positioned popup (a "peek") any activity/plugin can open to show a rich preview
// near a trigger element — the keyboard twin of the mouse-hover media preview, but
// for any item and any content. Same module-singleton pattern as useLightbox: state
// lives here, the host (PeekHost.vue, mounted once by Workbench) renders + positions
// the active entry, and the Workbench facade re-exports open/close/active so plugins
// reach it through the public API (`api.peek`, gated by the `peek` permission).
//
// An entry is a render descriptor + anchor — { component, props, triggerRect } —
// where triggerRect is a DOMRect-like snapshot of the element to position near.
// Only one peek is open at a time.

const _active = shallowRef(null)   // { component, props, triggerRect } | null

// Open the peek with a component + props, anchored at triggerRect. The component is
// markRaw'd so Vue doesn't try to make it reactive. Missing component/rect is a no-op.
export function openPeek({ component, props = {}, triggerRect = null } = {}) {
  if (!component || !triggerRect) return
  _active.value = { component: markRaw(component), props, triggerRect }
}

export function closePeek() { _active.value = null }

// Readonly active entry for the host to render and for `facade.peek.active`.
export const peekActive = readonly(_active)

export function usePeek() {
  return { active: peekActive, open: openPeek, close: closePeek }
}
