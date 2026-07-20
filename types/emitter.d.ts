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
export function createEmitter(): {
    on: (type: string, fn: (payload: any) => void) => () => void;
    once: (type: any, fn: any) => () => void;
    off: (type: any, fn: any) => void;
    emit: (type: any, payload: any) => void;
    clear: () => void;
};
