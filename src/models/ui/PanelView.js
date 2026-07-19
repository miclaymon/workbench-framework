import { View } from './View.js'

// A sidebar / bottom-panel view. Holds an ordered list of section ids and the
// docking-capability flags the panel system reads.
export class PanelView extends View {
  /** @param {import('./View.js').ViewOptions & { sections?: string[], acceptsSections?: boolean, allowDuplicateSections?: boolean }} opts */
  constructor(opts = {}) {
    super({ ...opts, location: opts.location ?? 'SideBar' })
    this.sections               = opts.sections ?? []
    this.acceptsSections        = opts.acceptsSections !== false
    this.allowDuplicateSections = opts.allowDuplicateSections === true
  }

  get surface() { return 'panel' }
}
