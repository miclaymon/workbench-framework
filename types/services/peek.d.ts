export function openPeek({ component, props, triggerRect }?: {
    props?: {};
    triggerRect?: any;
}): void;
export function closePeek(): void;
export function usePeek(): {
    active: Readonly<import("@vue/reactivity").Ref<any, any>>;
    open: typeof openPeek;
    close: typeof closePeek;
};
export const peekActive: Readonly<import("@vue/reactivity").Ref<any, any>>;
