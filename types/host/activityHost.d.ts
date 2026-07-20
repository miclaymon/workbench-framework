export function useActivityHost({ editor, prefs, services, log, activities }: {
    editor: any;
    prefs: any;
    services?: {};
    log?: () => void;
    activities?: any[];
}): {
    activeTab: any;
    activeGroupId: any;
    editorRoot: any;
    activeActivityId: import("@vue/reactivity").ComputedRef<any>;
    prefs: any;
    selection: import("@vue/reactivity").ComputedRef<any>;
    api: (id: any) => any;
    requireApi: (id: any) => any;
    activities: () => any[];
    on: (type: string, fn: (payload: any) => void) => () => void;
    once: (type: any, fn: any) => () => void;
    emit: (type: any, payload: any) => void;
    log: (...a: any[]) => any;
    services: {};
};
