import { reactive } from '../reactivity.js'

// ── Hook registry ─────────────────────────────────────────────────────────────
//
// A synchronous, ordered filter chain — distinct from the event emitter (which is
// fire-and-forget). Each hook handler receives the running value plus a context
// and may return a replacement, letting activities/plugins transform or veto a
// value as it flows through the app. The menu contribution API is built on top of
// this (a menu is a hook that appends items); future cancellable points such as
// `before-rename` use the same mechanism.
//
//   add(name, fn, order=0) → disposer   handlers run low→high order
//   apply(name, value, ctx) → value     value threaded through every handler;
//                                        a handler returning undefined is a no-op
export function createHookRegistry({ log = () => {} } = {}) {
  const hooks = reactive(new Map())   // name → { fn, order }[]

  function add(name, fn, order = 0) {
    if (typeof fn !== 'function') throw new Error('[hooks] add() needs a function')
    const entry = { fn, order }
    const arr = hooks.get(name) ?? []
    arr.push(entry)
    arr.sort((a, b) => a.order - b.order)
    hooks.set(name, arr)
    return () => {
      const a = hooks.get(name)
      if (!a) return
      const i = a.indexOf(entry)
      if (i >= 0) a.splice(i, 1)
      if (a.length === 0) hooks.delete(name)
    }
  }

  function apply(name, value, ctx) {
    let v = value
    for (const { fn } of (hooks.get(name) ?? [])) {
      try {
        const r = fn(v, ctx)
        if (r !== undefined) v = r
      } catch (err) {
        log('hooks', `handler for "${name}" threw`, err, 'error')
      }
    }
    return v
  }

  function has(name) { return (hooks.get(name)?.length ?? 0) > 0 }

  return { add, apply, has }
}
