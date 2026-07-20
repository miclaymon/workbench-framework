export function openLightbox({ component, props }?: {
    props?: {};
}): void;
export function closeLightbox(): void;
export function useLightbox(): {
    active: Readonly<import("@vue/reactivity").Ref<any, any>>;
    open: typeof openLightbox;
    close: typeof closeLightbox;
};
export const lightboxActive: Readonly<import("@vue/reactivity").Ref<any, any>>;
