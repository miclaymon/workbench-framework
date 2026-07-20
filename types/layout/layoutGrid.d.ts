export function isLeaf(n: any): boolean;
export function isBranch(n: any): boolean;
export function createLeaf({ tabs, activeTabId, id, tabPreviews, locked }?: {
    tabs?: any[];
}): {
    type: string;
    id: any;
    tabs: any[];
    activeTabId: any;
    tabPreviews: boolean;
    locked: any;
};
export function createBranch(direction: any, children: any, sizes: any): {
    type: string;
    id: string;
    direction: any;
    children: any;
    sizes: any;
};
export function findLeaf(node: any, id: any): any;
export function collectLeaves(node: any, acc?: any[]): any[];
export function firstLeaf(node: any): any;
export function leafCount(node: any): number;
export function findParent(root: any, id: any, parent?: any, index?: number): any;
export function findTab(node: any, tabId: any): {
    leaf: any;
    tab: any;
};
export function insertLeafBeside(root: any, targetLeafId: any, side: any, newLeaf: any): any;
export function removeLeaf(root: any, leafId: any): any;
export function mergeAll(root: any): any;
export function applyPreset(root: any, name: any): any;
export namespace PRESETS {
    function single(root: any): any;
    function twoColumns(root: any): any;
    function twoRows(root: any): any;
    function threeColumns(root: any): any;
    function grid(root: any): any;
}
