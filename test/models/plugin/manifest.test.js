import { describe, it, expect } from 'vitest'
import { validateManifest, grantedPermissions, SUPPORTED_MANIFEST_VERSION } from '../../../src/models/plugin/manifest.js'

function baseManifest(overrides = {}) {
  return {
    manifest_version: SUPPORTED_MANIFEST_VERSION,
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    client: { entry: 'client/plugin.js' },
    ...overrides,
  }
}

describe('validateManifest', () => {
  it('accepts a minimal valid client manifest', () => {
    const { valid, errors, warnings } = validateManifest(baseManifest())
    expect(valid).toBe(true)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('accepts a server-only manifest', () => {
    const { valid, errors } = validateManifest(baseManifest({
      client: undefined,
      server: { entry: 'server/plugin.js', runtime: 'wasm-js' },
    }))
    expect(valid).toBe(true)
    expect(errors).toEqual([])
  })

  it('rejects a non-object manifest', () => {
    expect(validateManifest(null)).toEqual({ valid: false, errors: ['manifest must be an object'], warnings: [] })
    expect(validateManifest(undefined).valid).toBe(false)
    expect(validateManifest('nope').valid).toBe(false)
  })

  it('rejects the wrong manifest_version', () => {
    const { valid, errors } = validateManifest(baseManifest({ manifest_version: 2 }))
    expect(valid).toBe(false)
    expect(errors).toContain(`manifest_version must be ${SUPPORTED_MANIFEST_VERSION} (got 2)`)
  })

  it('reports a missing manifest_version distinctly', () => {
    const { errors } = validateManifest(baseManifest({ manifest_version: undefined }))
    expect(errors).toContain(`manifest_version must be ${SUPPORTED_MANIFEST_VERSION} (got none)`)
  })

  it.each([
    ['upper case', 'MyPlugin'],
    ['spaces', 'my plugin'],
    ['underscores', 'my_plugin'],
    ['leading hyphen', '-my-plugin'],
    ['empty', ''],
    ['non-string', 42],
  ])('rejects a bad id (%s)', (_label, id) => {
    const { valid, errors } = validateManifest(baseManifest({ id }))
    expect(valid).toBe(false)
    expect(errors.some(e => e.includes('id must be'))).toBe(true)
  })

  it('accepts kebab-case ids with digits', () => {
    expect(validateManifest(baseManifest({ id: 'plugin-2-go' })).valid).toBe(true)
  })

  it('requires a non-empty name', () => {
    expect(validateManifest(baseManifest({ name: '' })).valid).toBe(false)
    expect(validateManifest(baseManifest({ name: '   ' })).valid).toBe(false)
    expect(validateManifest(baseManifest({ name: undefined })).valid).toBe(false)
  })

  it.each(['1.0', 'v1.0.0', 'abc', '', 1])('rejects a bad version (%j)', (version) => {
    expect(validateManifest(baseManifest({ version })).valid).toBe(false)
  })

  it('accepts a semver version with prerelease/build metadata', () => {
    expect(validateManifest(baseManifest({ version: '1.0.0-beta.1+build.5' })).valid).toBe(true)
  })

  it('requires at least a client or server target', () => {
    const { valid, errors } = validateManifest(baseManifest({ client: undefined }))
    expect(valid).toBe(false)
    expect(errors).toContain('a plugin must declare a client and/or server target')
  })

  it('rejects a client block missing entry', () => {
    expect(validateManifest(baseManifest({ client: {} })).valid).toBe(false)
    expect(validateManifest(baseManifest({ client: { entry: '' } })).valid).toBe(false)
    expect(validateManifest(baseManifest({ client: [] })).valid).toBe(false)
  })

  it('rejects a server block missing entry, but allows an unknown runtime as a warning', () => {
    const bad = validateManifest(baseManifest({ client: undefined, server: {} }))
    expect(bad.valid).toBe(false)

    const { valid, warnings } = validateManifest(baseManifest({
      client: undefined,
      server: { entry: 'server/plugin.js', runtime: 'native' },
    }))
    expect(valid).toBe(true)
    expect(warnings.some(w => w.includes('unknown server.runtime'))).toBe(true)
  })

  it('rejects unknown server permission shapes but warns on unknown named permissions', () => {
    const badShape = validateManifest(baseManifest({
      client: undefined,
      server: { entry: 'x.js', permissions: 'exec:git' },
    }))
    expect(badShape.valid).toBe(false)

    const { valid, warnings } = validateManifest(baseManifest({
      client: undefined,
      server: { entry: 'x.js', permissions: ['exec:git', 'exec:custom-tool', 'not-a-real-permission'] },
    }))
    expect(valid).toBe(true)
    expect(warnings.some(w => w.includes('not-a-real-permission'))).toBe(true)
    // exec:<anything> is always known (parameterized permission)
    expect(warnings.some(w => w.includes('exec:git'))).toBe(false)
    expect(warnings.some(w => w.includes('exec:custom-tool'))).toBe(false)
  })

  it('warns (does not error) on unknown front-end / host permissions', () => {
    const { valid, warnings } = validateManifest(baseManifest({
      permissions: ['commands', 'not-a-real-permission'],
      host_permissions: ['fs:read', 'not-a-real-host-permission'],
    }))
    expect(valid).toBe(true)
    expect(warnings.some(w => w.includes('unknown permission "not-a-real-permission"'))).toBe(true)
    expect(warnings.some(w => w.includes('unknown host permission "not-a-real-host-permission"'))).toBe(true)
  })

  it('rejects non-array permissions/host_permissions/dependencies shapes', () => {
    expect(validateManifest(baseManifest({ permissions: 'commands' })).valid).toBe(false)
    expect(validateManifest(baseManifest({ host_permissions: 'fs:read' })).valid).toBe(false)
    expect(validateManifest(baseManifest({ dependencies: ['a', 'b'] })).valid).toBe(false)
  })

  it('accepts a well-formed dependencies map', () => {
    expect(validateManifest(baseManifest({ dependencies: { 'other-plugin': '^1.0.0' } })).valid).toBe(true)
  })

  it('validates the net block shape', () => {
    expect(validateManifest(baseManifest({ net: { origins: ['https://example.com'] } })).valid).toBe(true)
    expect(validateManifest(baseManifest({ net: [] })).valid).toBe(false)
    expect(validateManifest(baseManifest({ net: { origins: 'https://example.com' } })).valid).toBe(false)
  })

  it('accumulates multiple errors at once', () => {
    const { valid, errors } = validateManifest({ manifest_version: 1, id: 'BAD ID', name: '', version: 'nope' })
    expect(valid).toBe(false)
    expect(errors.length).toBeGreaterThanOrEqual(4)
  })
})

describe('grantedPermissions', () => {
  it('returns declared, known permissions', () => {
    expect(grantedPermissions({ permissions: ['commands', 'menus'] })).toEqual(['commands', 'menus'])
  })

  it('drops unknown permissions', () => {
    expect(grantedPermissions({ permissions: ['commands', 'not-a-real-permission'] })).toEqual(['commands'])
  })

  it('returns an empty array when permissions is absent', () => {
    expect(grantedPermissions({})).toEqual([])
  })
})
