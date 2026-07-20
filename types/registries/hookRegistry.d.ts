export function createHookRegistry({ log }?: {
    log?: () => void;
}): {
    add: (name: any, fn: any, order?: number) => () => void;
    apply: (name: any, value: any, ctx: any) => any;
    has: (name: any) => boolean;
};
