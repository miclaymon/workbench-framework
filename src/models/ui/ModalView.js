import { EditorView } from './EditorView.js'

// A modal editor (Settings, Keyboard Shortcuts, …). Registered like any other
// view; opened by id and hosted in the ModalEditor shell. Promoting it to the
// main window re-presents the same EditorView as a tab.
export class ModalView extends EditorView {
  /** @param {import('./View.js').ViewOptions & { kind?: string, width?: string, height?: string }} opts */
  constructor(opts = {}) {
    super({ ...opts, location: 'Modal', presentation: 'modal' })
    this.width  = opts.width ?? null
    this.height = opts.height ?? null
  }
}
