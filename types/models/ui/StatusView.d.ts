export class StatusView extends View {
    /** @param {import('./View.js').ViewOptions & { region?: 'left'|'right', order?: number }} opts */
    constructor(opts?: import("./View.js").ViewOptions & {
        region?: "left" | "right";
        order?: number;
    });
    region: "left" | "right";
    order: number;
}
import { View } from './View.js';
