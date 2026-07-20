// Single indirection point for the reactivity primitives the framework uses.
//
// The framework is UI-framework-agnostic: it depends only on @vue/reactivity (the
// standalone reactive-store package — no components, no renderer). A Vue host
// consumes the stores natively; other renderers (React, Solid) can subscribe via
// watch/effect adapters.
//
// IMPORTANT — single-instance requirement: the host application must resolve
// @vue/reactivity to the SAME module instance its renderer uses (for Vue apps:
// the copy inside `vue` itself), or dependency tracking silently breaks across
// the boundary. With Vite, set `resolve.dedupe: ['vue', '@vue/reactivity']`.
//
// Note on `watch`: this is @vue/reactivity's standalone watch (Vue 3.5+). Unlike
// the runtime-core wrapper it has no component-scheduler integration — callbacks
// fire synchronously on trigger rather than batched at flush:'pre' timing.
export {
  reactive,
  ref,
  shallowRef,
  computed,
  readonly,
  markRaw,
  toRaw,
  watch,
  effectScope,
} from '@vue/reactivity'
