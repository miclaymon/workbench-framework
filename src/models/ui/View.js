// ── UI model: View (base surface) ─────────────────────────────────────────────
//
// The abstract, framework-agnostic representation of a piece of UI an activity
// contributes. These classes carry NO Vue (or React) imports — an instance only
// *holds* a reference to whatever component renders at its location, so the same
// model can describe surfaces for any front-end and can be constructed by a
// sandboxed plugin that never touches the host's component code.
//
// The host registries store these instances; the Vue layer (ViewContentHost,
// TabContentHost, StatusBar, ModalEditor) reads the fields below to render.

/** Locations a view can occupy in the shell. */
export const VIEW_LOCATIONS = Object.freeze([
  'EditorTab', 'Editor', 'PrimarySideBar', 'SecondarySideBar', 'SideBar',
  'BottomPanel', 'Panel', 'StatusBar', 'Modal',
])

/**
 * @typedef {Object} ViewOptions
 * @property {string}   id                 Unique within its activity.
 * @property {string}   [label]            Display name (heading / tab title).
 * @property {string}   [icon]             MDI path string.
 * @property {string}   [location]         One of VIEW_LOCATIONS.
 * @property {*}         [component]        The component rendered here (markRaw'd by the caller).
 * @property {Function} [props]            Binding hook → props object (args depend on surface).
 * @property {Function} [on]               Binding hook → event-listener map.
 * @property {Array}    [actions]          Action-button descriptors.
 * @property {string}   [expose]           Name of a host ref to populate with the mounted instance.
 */
export class View {
  /** @param {ViewOptions} opts */
  constructor(opts = {}) {
    if (!opts.id) throw new Error('[View] requires an id')
    this.id        = opts.id
    this.label     = opts.label ?? ''
    this.icon      = opts.icon ?? ''
    this.location  = opts.location ?? ''
    this.component = opts.component ?? null
    this.props     = opts.props ?? null
    this.on        = opts.on ?? null
    this.actions   = opts.actions ?? []
    this.expose    = opts.expose ?? null
  }

  /** Discriminator used by the registries to route a view to the right store. */
  get surface() { return 'view' }
}
