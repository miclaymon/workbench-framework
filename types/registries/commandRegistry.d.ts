export function createCommandRegistry({ getCtx, log }: {
    getCtx: any;
    log?: () => void;
}): {
    register: (cmd: any) => () => void;
    unregister: (id: any) => boolean;
    get: (id: any) => any;
    has: (id: any) => boolean;
    list: () => any[];
    isEnabled: (id: any) => boolean;
    execute: (id: any, ...args: any[]) => any;
};
