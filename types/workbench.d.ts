export function createWorkbench(options: any): Workbench;
export class Workbench {
    constructor({ editor, prefs, services, log, activities, engines }?: {
        services?: {};
        log?: () => void;
        activities?: any[];
        engines?: {};
    });
    host: {
        activeTab: any;
        activeGroupId: any;
        editorRoot: any;
        activeActivityId: any;
        prefs: any;
        selection: any;
        api: (id: any) => any;
        requireApi: (id: any) => any;
        activities: () => any[];
        on: (type: string, fn: (payload: any) => void) => () => void;
        once: (type: any, fn: any) => () => void;
        emit: (type: any, payload: any) => void;
        log: (...a: any[]) => any;
        services: {};
    };
    facade: any;
    plugins: {
        load: (manifest: any, module: any) => any;
        unload: (id: any) => void;
        loadAllAsync: (lazyEntries: any) => Promise<void>;
        isLoaded: (id: any) => any;
        stateOf: (id: any) => any;
        states: any;
        failures: () => any[];
        get: (id: any) => any;
        list: () => any[];
    };
    log: () => void;
}
