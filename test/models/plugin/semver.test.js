import { describe, it, expect } from 'vitest'
import { parseVersion, compareVersions, satisfies } from '../../../src/models/plugin/semver.js'

describe('parseVersion', () => {
  it('parses a plain version', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
  })

  it('parses a prerelease', () => {
    expect(parseVersion('1.2.3-alpha.1')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: ['alpha', '1'] })
  })

  it('strips build metadata and keeps prerelease', () => {
    expect(parseVersion('1.2.3-beta+exp.sha.5114f85')).toEqual({
      major: 1, minor: 2, patch: 3, prerelease: ['beta'],
    })
  })

  it('parses build metadata with no prerelease', () => {
    expect(parseVersion('1.2.3+build.5')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
  })

  it('trims surrounding whitespace', () => {
    expect(parseVersion('  1.2.3  ')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
  })

  it.each([
    ['a leading v', 'v1.2.3'],
    ['a two-part version', '1.2'],
    ['a four-part version', '1.2.3.4'],
    ['garbage', 'not-a-version'],
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('returns null for %s', (_label, input) => {
    expect(parseVersion(input)).toBeNull()
  })
})

describe('compareVersions', () => {
  it('compares major/minor/patch numerically (not lexically)', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1)
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1)
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1)   // fails under string compare
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
  })

  it('a release outranks any prerelease of the same triple', () => {
    expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0-alpha')).toBe(1)
  })

  it('orders prerelease identifiers per semver §11.4 precedence chain', () => {
    const chain = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ]
    for (let i = 0; i < chain.length - 1; i++) {
      expect(compareVersions(chain[i], chain[i + 1])).toBe(-1)
      expect(compareVersions(chain[i + 1], chain[i])).toBe(1)
    }
    expect(compareVersions(chain[0], chain[0])).toBe(0)
  })

  it('compares numeric prerelease identifiers numerically, not lexically', () => {
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.11')).toBe(-1)
  })

  it('treats an unparseable version as sorting last, regardless of side', () => {
    expect(compareVersions('garbage', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.0', 'garbage')).toBe(-1)
    expect(compareVersions('garbage', 'also-garbage')).toBe(0)
  })
})

describe('satisfies', () => {
  it('returns null when the version itself is unparseable', () => {
    expect(satisfies('not-a-version', '^1.0.0')).toBeNull()
  })

  it('treats an empty, "*", or "x" range as unconstrained', () => {
    expect(satisfies('1.0.0', '')).toBe(true)
    expect(satisfies('1.0.0', undefined)).toBe(true)
    expect(satisfies('1.0.0', '*')).toBe(true)
    expect(satisfies('1.0.0', 'x')).toBe(true)
    expect(satisfies('1.0.0', '  ')).toBe(true)
  })

  it('matches an exact version', () => {
    expect(satisfies('1.2.3', '1.2.3')).toBe(true)
    expect(satisfies('1.2.3', '=1.2.3')).toBe(true)
    expect(satisfies('1.2.4', '1.2.3')).toBe(false)
  })

  describe('caret ranges', () => {
    it('^1.2.3 allows >=1.2.3 <2.0.0', () => {
      expect(satisfies('1.2.3', '^1.2.3')).toBe(true)
      expect(satisfies('1.5.0', '^1.2.3')).toBe(true)
      expect(satisfies('1.2.2', '^1.2.3')).toBe(false)
      expect(satisfies('2.0.0', '^1.2.3')).toBe(false)
    })

    it('^0.2.3 allows >=0.2.3 <0.3.0 (0.x major pins the minor)', () => {
      expect(satisfies('0.2.5', '^0.2.3')).toBe(true)
      expect(satisfies('0.3.0', '^0.2.3')).toBe(false)
    })

    it('^0.0.3 allows only >=0.0.3 <0.0.4 (0.0.x pins the patch)', () => {
      expect(satisfies('0.0.3', '^0.0.3')).toBe(true)
      expect(satisfies('0.0.4', '^0.0.3')).toBe(false)
    })
  })

  describe('tilde ranges', () => {
    it('~1.2.3 allows >=1.2.3 <1.3.0', () => {
      expect(satisfies('1.2.3', '~1.2.3')).toBe(true)
      expect(satisfies('1.2.9', '~1.2.3')).toBe(true)
      expect(satisfies('1.3.0', '~1.2.3')).toBe(false)
      expect(satisfies('1.2.2', '~1.2.3')).toBe(false)
    })
  })

  describe('comparators and AND-sets', () => {
    it('supports a single comparator', () => {
      expect(satisfies('1.5.0', '>=1.0.0')).toBe(true)
      expect(satisfies('0.5.0', '>=1.0.0')).toBe(false)
      expect(satisfies('1.5.0', '<2.0.0')).toBe(true)
      expect(satisfies('2.5.0', '<=2.5.0')).toBe(true)
      expect(satisfies('2.5.1', '<=2.5.0')).toBe(false)
      expect(satisfies('2.5.0', '>2.4.0')).toBe(true)
    })

    it('ANDs space-separated comparators in one set', () => {
      expect(satisfies('1.5.0', '>=1.0.0 <2.0.0')).toBe(true)
      expect(satisfies('2.5.0', '>=1.0.0 <2.0.0')).toBe(false)
      expect(satisfies('0.5.0', '>=1.0.0 <2.0.0')).toBe(false)
    })
  })

  describe('|| alternatives', () => {
    it('matches if any alternative set matches', () => {
      expect(satisfies('1.2.7', '1.2.7 || >=1.2.9 <2.0.0')).toBe(true)
      expect(satisfies('1.2.9', '1.2.7 || >=1.2.9 <2.0.0')).toBe(true)
      expect(satisfies('1.2.8', '1.2.7 || >=1.2.9 <2.0.0')).toBe(false)
    })

    it('skips an unparseable alternative rather than failing the whole range', () => {
      // '1.x' is an x-range beyond a bare '*' — deliberately unsupported (see
      // semver.js's header comment) — so this alternative is skipped; only the
      // '^2.0.0' alternative is actually evaluated.
      expect(satisfies('2.5.0', '1.x || ^2.0.0')).toBe(true)
      expect(satisfies('1.5.0', '1.x || ^2.0.0')).toBe(false)
    })
  })

  describe('unparseable ranges', () => {
    it('returns null (not false) so callers can warn-and-skip', () => {
      expect(satisfies('1.0.0', 'not a valid range at all')).toBeNull()
      expect(satisfies('1.0.0', '^')).toBeNull()
      expect(satisfies('1.0.0', '>=garbage')).toBeNull()
    })

    it('returns null when every alternative is unparseable', () => {
      expect(satisfies('1.0.0', '1.x || 2.x')).toBeNull()
    })
  })
})
