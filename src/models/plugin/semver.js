// ── Minimal semver range matching ─────────────────────────────────────────────
//
// Just enough to evaluate the ranges plugin manifests actually use (`engines.sdk`
// and `dependencies`): exact versions, `^`, `~`, comparators, AND-joined
// comparator sets, and `||` alternatives. Written here rather than pulled from npm
// because this package stays dependency-free (a runtime dep would resolve from the
// package's real path through the `file:` symlink — see AGENTS.md).
//
// Not supported (deliberately — validateManifest rejects nothing on this basis, and
// an unparseable range is treated as "no constraint" with a warning by the caller):
// hyphen ranges (`1.2.3 - 2.0.0`), x-ranges beyond a bare `*`, and build metadata.

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

/**
 * Parse a semver string into comparable parts.
 * @returns {{ major: number, minor: number, patch: number, prerelease: string[] }|null}
 */
export function parseVersion(v) {
  const m = VERSION_RE.exec(String(v ?? '').trim())
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
  }
}

// Numeric prerelease identifiers compare numerically, alphanumerics lexically, and
// numeric always sorts lower (semver §11.4.3).
function comparePrerelease(a, b) {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1    // a release outranks any prerelease
  if (b.length === 0) return -1
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i], y = b[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y)
    if (xn && yn) { const d = Number(x) - Number(y); if (d) return d < 0 ? -1 : 1; continue }
    if (xn !== yn) return xn ? -1 : 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/**
 * Compare two semver strings. Unparseable versions sort last.
 * @returns {number} -1 | 0 | 1
 */
export function compareVersions(a, b) {
  const pa = parseVersion(a), pb = parseVersion(b)
  if (!pa || !pb) return pa ? -1 : pb ? 1 : 0
  for (const k of ['major', 'minor', 'patch']) {
    if (pa[k] !== pb[k]) return pa[k] < pb[k] ? -1 : 1
  }
  return comparePrerelease(pa.prerelease, pb.prerelease)
}

// Expand `^`/`~` into the equivalent pair of comparators.
//   ^1.2.3 → >=1.2.3 <2.0.0    ^0.2.3 → >=0.2.3 <0.3.0    ^0.0.3 → >=0.0.3 <0.0.4
//   ~1.2.3 → >=1.2.3 <1.3.0
function expand(op, v) {
  const p = parseVersion(v)
  if (!p) return null
  const lower = { op: '>=', v }
  if (op === '~') return [lower, { op: '<', v: `${p.major}.${p.minor + 1}.0` }]
  if (p.major > 0) return [lower, { op: '<', v: `${p.major + 1}.0.0` }]
  if (p.minor > 0) return [lower, { op: '<', v: `0.${p.minor + 1}.0` }]
  return [lower, { op: '<', v: `0.0.${p.patch + 1}` }]
}

// One comparator set (space-separated parts, AND-joined) → [{ op, v }] or null if
// any part is unparseable.
function parseComparators(set) {
  const out = []
  for (const partRaw of set.trim().split(/\s+/)) {
    const part = partRaw.trim()
    if (!part || part === '*' || part === 'x' || part === 'X') continue   // no constraint
    const m = /^(\^|~|>=|<=|>|<|=)?\s*(.+)$/.exec(part)
    if (!m) return null
    const op = m[1] ?? '=', v = m[2]
    if (op === '^' || op === '~') {
      const pair = expand(op, v)
      if (!pair) return null
      out.push(...pair)
      continue
    }
    if (!parseVersion(v)) return null
    out.push({ op: op === '=' ? '=' : op, v })
  }
  return out
}

function testComparator(version, { op, v }) {
  const c = compareVersions(version, v)
  switch (op) {
    case '=':  return c === 0
    case '>':  return c > 0
    case '>=': return c >= 0
    case '<':  return c < 0
    case '<=': return c <= 0
    default:   return false
  }
}

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
export function satisfies(version, range) {
  if (!parseVersion(version)) return null
  const raw = String(range ?? '').trim()
  if (!raw || raw === '*' || raw === 'x' || raw === 'X') return true

  let parsedAny = false
  for (const set of raw.split('||')) {
    const comparators = parseComparators(set)
    if (comparators === null) continue      // skip an unparseable alternative
    parsedAny = true
    if (comparators.every((c) => testComparator(version, c))) return true
  }
  return parsedAny ? false : null
}
