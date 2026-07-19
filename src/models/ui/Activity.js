// ── UI model: Activity ────────────────────────────────────────────────────────
//
// A self-contained feature: metadata, an optional runtime API factory (`setup`),
// and the set of views it contributes. UI-agnostic — `setup` and the views' held
// components are opaque references the host resolves. First-party activities and
// third-party plugins build the same Activity instances (plugins via the exported
// classes; first-party defs are wrapped by activityFromDefinition()).
export class Activity {
  /** @param {{ id: string, label?: string, icon?: string, builtin?: boolean, setup?: Function }} opts */
  constructor(opts = {}) {
    if (!opts.id) throw new Error('[Activity] requires an id')
    this.id      = opts.id
    this.label   = opts.label ?? ''
    this.icon    = opts.icon ?? ''
    this.builtin = opts.builtin ?? false
    this.setup   = opts.setup ?? null
    /** @type {Map<string, import('./View.js').View>} */
    this._views  = new Map()
  }

  /** Add a view (returns this for chaining). */
  addView(view) {
    if (!view?.id) throw new Error(`[Activity ${this.id}] addView() needs a view with an id`)
    this._views.set(view.id, view)
    return this
  }

  getView(id) { return this._views.get(id) ?? null }
  get views()  { return this._views }

  viewsOf(surface) { return [...this._views.values()].filter(v => v.surface === surface) }
  get editors()       { return this.viewsOf('editor') }
  get panels()        { return this.viewsOf('panel') }
  get sections()      { return this.viewsOf('section') }
  get statusWidgets() { return this.viewsOf('status') }
  get modals()        { return this.viewsOf('modal') }
}
