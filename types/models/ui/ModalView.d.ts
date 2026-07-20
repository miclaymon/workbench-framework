export class ModalView extends EditorView {
    /** @param {import('./View.js').ViewOptions & { kind?: string, width?: string, height?: string }} opts */
    constructor(opts?: import("./View.js").ViewOptions & {
        kind?: string;
        width?: string;
        height?: string;
    });
    width: string;
    height: string;
}
import { EditorView } from './EditorView.js';
