export class PanelView extends View {
    /** @param {import('./View.js').ViewOptions & { sections?: string[], acceptsSections?: boolean, allowDuplicateSections?: boolean }} opts */
    constructor(opts?: import("./View.js").ViewOptions & {
        sections?: string[];
        acceptsSections?: boolean;
        allowDuplicateSections?: boolean;
    });
    sections: string[];
    acceptsSections: boolean;
    allowDuplicateSections: boolean;
}
import { View } from './View.js';
