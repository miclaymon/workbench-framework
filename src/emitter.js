/**
 * Minimal synchronous event emitter used as the pub/sub primitive for
 * inter-activity collaboration. Each activity API owns one of these to notify
 * subscribers (other activities, panels, status widgets) of context changes; the
 * activity host owns one for app-level events.
 *
 * Intentionally tiny and dependency-free so it is safe to hand to third-party
 * plugins later: handlers are isolated (a throwing subscriber can't break the
 * emit loop or sibling subscribers).
 */
export function createEmitter() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map()

  /**
   * Subscribe to an event type.
   * @param {string} type
   * @param {(payload: any) => void} fn
   * @returns {() => void} an unsubscribe function
   */
  function on(type, fn) {
    if (typeof fn !== 'function') return () => {}
    let set = listeners.get(type)
    if (!set) { set = new Set(); listeners.set(type, set) }
    set.add(fn)
    return () => off(type, fn)
  }

  /** Subscribe for a single emission, then auto-unsubscribe. */
  function once(type, fn) {
    const dispose = on(type, payload => { dispose(); fn(payload) })
    return dispose
  }

  /** Remove a previously-registered handler. */
  function off(type, fn) {
    listeners.get(type)?.delete(fn)
  }

  /** Emit an event to all current subscribers; subscriber errors are isolated. */
  function emit(type, payload) {
    const set = listeners.get(type)
    if (!set) return
    for (const fn of [...set]) {
      try { fn(payload) } catch { /* one bad subscriber must not break the rest */ }
    }
  }

  /** Drop all subscribers (used on teardown). */
  function clear() { listeners.clear() }

  return { on, once, off, emit, clear }
}
