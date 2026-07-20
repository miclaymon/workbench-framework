export class ViewSection extends View {
    /** @param {import('./View.js').ViewOptions & { homeView?: string, alwaysShowHeading?: boolean }} opts */
    constructor(opts?: import("./View.js").ViewOptions & {
        homeView?: string;
        alwaysShowHeading?: boolean;
    });
    homeView: string;
    alwaysShowHeading: boolean;
}
import { View } from './View.js';
