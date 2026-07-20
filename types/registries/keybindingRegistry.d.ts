export function createKeybindingRegistry({ log }?: {
    log?: () => void;
}): {
    register: (binding: any) => () => void;
    forChord: (chord: any) => any;
    forCommand: (commandId: any) => any[];
    list: () => any[];
    normalizeChord: typeof normalizeChord;
};
export function formatChord(chord: any): any[];
export function normalizeChord(key: any): string;
