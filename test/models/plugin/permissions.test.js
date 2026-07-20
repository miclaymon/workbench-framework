import { describe, it, expect } from 'vitest'
import {
  PERMISSIONS,
  HOST_PERMISSIONS,
  PERMISSION_NAMES,
  HOST_PERMISSION_NAMES,
  isKnownPermission,
  isKnownHostPermission,
  isKnownServerPermission,
} from '../../../src/models/plugin/permissions.js'

describe('permission catalogs', () => {
  it('PERMISSION_NAMES mirrors the keys of PERMISSIONS', () => {
    expect(PERMISSION_NAMES).toEqual(Object.keys(PERMISSIONS))
  })

  it('HOST_PERMISSION_NAMES mirrors the keys of HOST_PERMISSIONS', () => {
    expect(HOST_PERMISSION_NAMES).toEqual(Object.keys(HOST_PERMISSIONS))
  })

  it('catalogs are frozen', () => {
    expect(Object.isFrozen(PERMISSIONS)).toBe(true)
    expect(Object.isFrozen(HOST_PERMISSIONS)).toBe(true)
    expect(Object.isFrozen(PERMISSION_NAMES)).toBe(true)
  })
})

describe('isKnownPermission', () => {
  it('is true for every cataloged permission', () => {
    for (const name of PERMISSION_NAMES) expect(isKnownPermission(name)).toBe(true)
  })

  it('is false for unknown strings', () => {
    expect(isKnownPermission('not-a-real-permission')).toBe(false)
    expect(isKnownPermission('')).toBe(false)
  })

  it('does not fall through the prototype chain (e.g. "toString")', () => {
    expect(isKnownPermission('toString')).toBe(false)
    expect(isKnownPermission('constructor')).toBe(false)
  })
})

describe('isKnownHostPermission', () => {
  it('is true for every cataloged host permission', () => {
    for (const name of HOST_PERMISSION_NAMES) expect(isKnownHostPermission(name)).toBe(true)
  })

  it('is false for unknown strings', () => {
    expect(isKnownHostPermission('fs:delete')).toBe(false)
  })
})

describe('isKnownServerPermission', () => {
  it('accepts any exec:<name> as parameterized', () => {
    expect(isKnownServerPermission('exec:git')).toBe(true)
    expect(isKnownServerPermission('exec:anything-at-all')).toBe(true)
  })

  it('rejects a bare "exec:" with nothing after the colon', () => {
    expect(isKnownServerPermission('exec:')).toBe(false)
  })

  it('matches the non-exec catalog exactly', () => {
    expect(isKnownServerPermission('fs:read')).toBe(true)
    expect(isKnownServerPermission('fs:write')).toBe(true)
    expect(isKnownServerPermission('net')).toBe(true)
    expect(isKnownServerPermission('fs:delete')).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(isKnownServerPermission(null)).toBe(false)
    expect(isKnownServerPermission(undefined)).toBe(false)
    expect(isKnownServerPermission(42)).toBe(false)
  })
})
