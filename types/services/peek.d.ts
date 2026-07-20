export function openPeek({ component, props, triggerRect }?: {
    props?: {};
    triggerRect?: any;
}): void;
export function closePeek(): void;
export function usePeek(): {
    active: any;
    open: typeof openPeek;
    close: typeof closePeek;
};
export const peekActive: any;
