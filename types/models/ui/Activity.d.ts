export class Activity {
    /** @param {{ id: string, label?: string, icon?: string, builtin?: boolean, setup?: Function }} opts */
    constructor(opts?: {
        id: string;
        label?: string;
        icon?: string;
        builtin?: boolean;
        setup?: Function;
    });
    id: string;
    label: string;
    icon: string;
    builtin: boolean;
    setup: Function;
    /** @type {Map<string, import('./View.js').View>} */
    _views: Map<string, import("./View.js").View>;
    /** Add a view (returns this for chaining). */
    addView(view: any): this;
    getView(id: any): import("./View.js").View;
    get views(): Map<string, import("./View.js").View>;
    viewsOf(surface: any): import("./View.js").View[];
    get editors(): import("./View.js").View[];
    get panels(): import("./View.js").View[];
    get sections(): import("./View.js").View[];
    get statusWidgets(): import("./View.js").View[];
    get modals(): import("./View.js").View[];
}
