export class EditorView extends View {
    /** @param {import('./View.js').ViewOptions & { kind?: string, presentation?: 'tab'|'modal', tabIcon?: Function }} opts */
    constructor(opts?: import("./View.js").ViewOptions & {
        kind?: string;
        presentation?: "tab" | "modal";
        tabIcon?: Function;
    });
    kind: string;
    presentation: "tab" | "modal";
    tabIcon: Function;
    get surface(): "modal" | "editor";
}
import { View } from './View.js';
