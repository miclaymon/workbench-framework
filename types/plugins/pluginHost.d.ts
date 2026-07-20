export function createPluginHost({ host, log, engines }: {
    host: any;
    log?: () => void;
    engines?: {};
}): {
    load: (manifest: any, module: any) => any;
    unload: (id: any) => void;
    loadAllAsync: (lazyEntries: any) => Promise<void>;
    isLoaded: (id: any) => boolean;
    stateOf: (id: any) => any;
    states: import("@vue/reactivity").Reactive<Map<any, any>>;
    failures: () => any[];
    get: (id: any) => any;
    list: () => any[];
};
