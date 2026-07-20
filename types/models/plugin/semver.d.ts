/**
 * Parse a semver string into comparable parts.
 * @returns {{ major: number, minor: number, patch: number, prerelease: string[] }|null}
 */
export function parseVersion(v: any): {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[];
} | null;
/**
 * Compare two semver strings. Unparseable versions sort last.
 * @returns {number} -1 | 0 | 1
 */
export function compareVersions(a: any, b: any): number;
/**
 * Does `version` satisfy `range`?
 *
 * A range is one or more comparator sets joined by `||`; within a set, parts are
 * AND-joined. `*`, `x`, and an empty range mean "any version".
 *
 * @param {string} version  a concrete semver string
 * @param {string} range    e.g. "^1.0.0", ">=1.2.0 <2.0.0", "1.x || ^2.0.0"
 * @returns {boolean|null}  null when the range can't be parsed (caller decides:
 *                          treat as unconstrained + warn, rather than silently deny)
 */
export function satisfies(version: string, range: string): boolean | null;
