export function isKnownPermission(name: any): boolean;
export function isKnownHostPermission(name: any): boolean;
export function isKnownServerPermission(name: any): boolean;
/** Front-end capability permissions → human description. */
export const PERMISSIONS: Readonly<{
    activities: "Contribute and remove activities (panels, editor tabs, status widgets, modals).";
    commands: "Register commands and execute them by id.";
    keybindings: "Bind keyboard chords to commands.";
    menus: "Contribute items into application and context menus.";
    hooks: "Add ordered transform/veto hooks into app data flows.";
    modals: "Open, close, and contribute modal editors.";
    editor: "Open registered editor tabs by kind.";
    preferences: "Contribute settings to the Settings panel and read their values.";
    events: "Subscribe to and emit app-level events.";
    selection: "Read the active activity's selection capability.";
    query: "Query other activities and read app-level state.";
    icons: "Register an icon theme that resolves file/folder icons.";
    lightbox: "Open a near-fullscreen lightbox overlay.";
    peek: "Open a positioned peek popup near a trigger element.";
    server: "Call this plugin's own sandboxed WASM backend (declared in `server`).";
    net: "Make outbound network requests through `api.net.fetch`, limited to the origins declared in the manifest `net.origins`.";
    storage: "Persist per-plugin key/value data through `api.storage` (namespaced; not shared with other plugins).";
    clipboard: "Read and write the system clipboard through `api.clipboard`.";
}>;
export const HOST_PERMISSIONS: Readonly<{
    'fs:read': "Read files and directories through the data server.";
    'fs:write': "Create, rename, move, and delete files through the control server.";
    control: "Issue arbitrary control-server operations.";
    clipboard: "Read and write the workbench clipboard.";
}>;
export const SERVER_PERMISSIONS: Readonly<{
    exec: "Run an allowlisted external binary, declared per-tool as exec:<name> (e.g. exec:git).";
    'fs:read': "Read files and directories from the host filesystem (blacklist-enforced).";
    'fs:write': "Write files to the host filesystem (blacklist-enforced).";
    net: "Make outbound network requests.";
}>;
export const PERMISSION_NAMES: readonly string[];
export const HOST_PERMISSION_NAMES: readonly string[];
