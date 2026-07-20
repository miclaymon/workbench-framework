/**
 * Validate a manifest. Errors block loading; warnings (e.g. unknown permissions,
 * which are ignored rather than fatal — as Chrome does) are advisory.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateManifest(manifest: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
/** Granted permissions, dropping any unknown ones (so callers can trust the list). */
export function grantedPermissions(manifest: any): any;
export const SUPPORTED_MANIFEST_VERSION: 1;
