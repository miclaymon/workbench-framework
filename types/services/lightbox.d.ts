export function openLightbox({ component, props }?: {
    props?: {};
}): void;
export function closeLightbox(): void;
export function useLightbox(): {
    active: any;
    open: typeof openLightbox;
    close: typeof closeLightbox;
};
export const lightboxActive: any;
