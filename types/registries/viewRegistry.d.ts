export function registerActivity(actOrDef: any): () => void;
export function unregisterActivity(id: any): void;
export function getModal(id: any): any;
export function listModals(): any[];
export function getViewEntry(id: any): any;
export function activityOfView(id: any): any;
/** The activity id that owns a given tab kind (defaults to the core activity). */
export function activityOfTabKind(kind: any): any;
/** The tab-view id registered for a given tab kind, if any. */
export function tabViewIdForKind(kind: any): any;
export function tabViewForKind(kind: any): any;
export function tabIconDescriptor(tab: any, { dynamic }?: {
    dynamic?: boolean;
}): any;
export function getStatusViews(region: any): any[];
export function listActivities(): {
    id: any;
    label: any;
    icon: any;
    core: boolean;
}[];
export function listPrimaryViews(): {
    id: any;
    icon: any;
    label: any;
}[];
export function getActivity(id: any): any;
export function viewAcceptsSections(viewId: any): boolean;
export function viewAllowsDuplicateSections(viewId: any): boolean;
export function viewActions(viewId: any): any;
export function sectionActions(sectionId: any): any;
export function sectionHeadingShown(sections: any, section: any): boolean;
export function bubbledSectionActions(viewId: any, sections: any): any[];
export function viewDataId(viewId: any): string;
export function sectionDataId(sectionId: any, homeViewId: any): string;
export function useViewRegistry(): {
    registry: {};
    getViewEntry: typeof getViewEntry;
};
