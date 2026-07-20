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
    isIconThemeAvailable: any;
    activeIconThemeId: any;
    listIconThemes: typeof listIconThemes;
};
export const activeIconThemeId: any;
export const isIconThemeAvailable: any;
