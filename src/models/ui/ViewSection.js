import { View } from './View.js'

// A section inside a panel view. `homeView` is the panel it natively belongs to;
// `alwaysShowHeading` keeps its heading (and its action buttons) visible even when
// it is the only section in its host view.
export class ViewSection extends View {
  /** @param {import('./View.js').ViewOptions & { homeView?: string, alwaysShowHeading?: boolean }} opts */
  constructor(opts = {}) {
    super(opts)
    this.homeView          = opts.homeView ?? null
    this.alwaysShowHeading = opts.alwaysShowHeading === true
  }

  get surface() { return 'section' }
}
