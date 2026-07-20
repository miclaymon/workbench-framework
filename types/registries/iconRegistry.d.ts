export function registerIconTheme({ id, label, getIcon }?: {}): () => void;
export function unregisterIconTheme(id: any): void;
export function setActiveIconTheme(id: any): void;
export function listIconThemes(): {
    id: any;
    label: any;
}[];
export function resolveIcon(ctx: any): any;
export function useIconRegistry(): {
    resolveIcon: typeof resolveIcon;
    isIconThemeAvailable: import("@vue/reactivity").ComputedRef<boolean>;
    activeIconThemeId: Readonly<import("@vue/reactivity").Ref<any, any>>;
    listIconThemes: typeof listIconThemes;
};
export const activeIconThemeId: Readonly<import("@vue/reactivity").Ref<any, any>>;
export const isIconThemeAvailable: import("@vue/reactivity").ComputedRef<boolean>;
