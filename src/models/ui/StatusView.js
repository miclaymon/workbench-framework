import { View } from './View.js'

// A status-bar widget. `region` ('left' | 'right') and `order` place it; the
// widget self-gates (renders nothing when it has no relevant context).
export class StatusView extends View {
  /** @param {import('./View.js').ViewOptions & { region?: 'left'|'right', order?: number }} opts */
  constructor(opts = {}) {
    super({ ...opts, location: 'StatusBar' })
    this.region = opts.region ?? 'left'
    this.order  = opts.order ?? 0
  }

  get surface() { return 'status' }
}
