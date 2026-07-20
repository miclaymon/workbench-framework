export function createCommandRegistry({ getCtx, log }: {
    getCtx: any;
    log?: () => void;
}): {
    register: (cmd: any) => () => void;
    unregister: (id: any) => any;
    get: (id: any) => any;
    has: (id: any) => any;
    list: () => any[];
    isEnabled: (id: any) => boolean;
    execute: (id: any, ...args: any[]) => any;
};
