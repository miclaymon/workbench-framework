/** Locations a view can occupy in the shell. */
export const VIEW_LOCATIONS: readonly string[];
/**
 * @typedef {Object} ViewOptions
 * @property {string}   id                 Unique within its activity.
 * @property {string}   [label]            Display name (heading / tab title).
 * @property {string}   [icon]             MDI path string.
 * @property {string}   [location]         One of VIEW_LOCATIONS.
 * @property {*}         [component]        The component rendered here (markRaw'd by the caller).
 * @property {Function} [props]            Binding hook → props object (args depend on surface).
 * @property {Function} [on]               Binding hook → event-listener map.
 * @property {Array}    [actions]          Action-button descriptors.
 * @property {string}   [expose]           Name of a host ref to populate with the mounted instance.
 */
export class View {
    /** @param {ViewOptions} opts */
    constructor(opts?: ViewOptions);
    id: string;
    label: string;
    icon: string;
    location: string;
    component: any;
    props: Function;
    on: Function;
    actions: any[];
    expose: string;
    /** Discriminator used by the registries to route a view to the right store. */
    get surface(): string;
}
export type ViewOptions = {
    /**
     * Unique within its activity.
     */
    id: string;
    /**
     * Display name (heading / tab title).
     */
    label?: string;
    /**
     * MDI path string.
     */
    icon?: string;
    /**
     * One of VIEW_LOCATIONS.
     */
    location?: string;
    /**
     * The component rendered here (markRaw'd by the caller).
     */
    component?: any;
    /**
     * Binding hook → props object (args depend on surface).
     */
    props?: Function;
    /**
     * Binding hook → event-listener map.
     */
    on?: Function;
    /**
     * Action-button descriptors.
     */
    actions?: any[];
    /**
     * Name of a host ref to populate with the mounted instance.
     */
    expose?: string;
};
