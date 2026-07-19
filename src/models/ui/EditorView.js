import { View } from './View.js'

// An editor surface. The same EditorView can be presented as a tab in the editor
// grid or as a floating modal — "Open in Main Window" simply flips `presentation`
// from 'modal' to 'tab'. `kind` is the runtime tab-kind the persisted tab carries.
export class EditorView extends View {
  /** @param {import('./View.js').ViewOptions & { kind?: string, presentation?: 'tab'|'modal', tabIcon?: Function }} opts */
  constructor(opts = {}) {
    super({ ...opts, location: opts.location ?? 'Editor' })
    this.kind         = opts.kind ?? null
    this.presentation = opts.presentation ?? 'tab'
    // Optional per-tab icon: tabIcon(tab) → a ResolvedIcon descriptor
    // ({ type:'url'|'svg.path'|'component'|'file.path', icon }) so a tab can show a
    // dynamic icon from its params (e.g. Preview's thumbnail / file-type icon)
    // instead of the static `icon`. Returns null to fall back to `icon`.
    this.tabIcon      = opts.tabIcon ?? null
  }

  get surface() { return this.presentation === 'modal' ? 'modal' : 'editor' }
}
