import { isKnownPermission, isKnownHostPermission, isKnownServerPermission } from './permissions.js'

// ── Plugin manifest ───────────────────────────────────────────────────────────
//
// The metadata block every plugin ships (manifest.json), modelled on a Chrome
// extension manifest. The loader validates it before a plugin is granted any API.
//
// @typedef {Object} PluginManifest
// @property {number}   manifest_version   Format version (only SUPPORTED_MANIFEST_VERSION today).
// @property {string}   id                 Unique, kebab-case (a-z, 0-9, hyphen).
// @property {string}   name               Human display name.
// @property {string}   version            Semver (e.g. "1.0.0").
// @property {string}   [description]
// @property {string}   [author]
// @property {string}   [icon]             MDI path or asset reference.
// @property {Object}   [client]           Client (renderer) target: { entry } — the entry module,
//                                          relative to the plugin root (e.g. "client/plugin.js"),
//                                          exporting activate(api) and optional deactivate(api).
// @property {Object}   [server]           Sandboxed WASM backend: { entry, runtime, permissions[] }.
//                                          `entry` is the JS source compiled to WASM (build-plugins.js);
//                                          `permissions` are SERVER_PERMISSIONS (e.g. exec:git, fs:read).
//                                          A plugin must declare a `client` and/or a `server` target.
// @property {string[]} [permissions]      Front-end capabilities (see PERMISSIONS).
// @property {string[]} [host_permissions] Host/backend access (see HOST_PERMISSIONS).
// @property {Object<string,string>} [dependencies]  Plugin id → semver range that must load first.
// @property {Object}   [engines]          e.g. { sdk: "^1.0.0" } — the @fw/sdk contract version.

export const SUPPORTED_MANIFEST_VERSION = 1

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+].+)?$/

/**
 * Validate a manifest. Errors block loading; warnings (e.g. unknown permissions,
 * which are ignored rather than fatal — as Chrome does) are advisory.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateManifest(manifest) {
  const errors = []
  const warnings = []

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['manifest must be an object'], warnings }
  }

  if (manifest.manifest_version !== SUPPORTED_MANIFEST_VERSION) {
    errors.push(`manifest_version must be ${SUPPORTED_MANIFEST_VERSION} (got ${manifest.manifest_version ?? 'none'})`)
  }
  if (typeof manifest.id !== 'string' || !ID_RE.test(manifest.id)) {
    errors.push('id must be a kebab-case string (a-z, 0-9, hyphen)')
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    errors.push('name is required')
  }
  if (typeof manifest.version !== 'string' || !SEMVER_RE.test(manifest.version)) {
    errors.push('version must be a semver string (e.g. "1.0.0")')
  }
  // A plugin must declare at least one runnable target: a `client` UI entry and/or a
  // `server` WASM backend. (Loaders read `client.entry`/`server.entry`, not a `main`.)
  if (manifest.client == null && manifest.server == null) {
    errors.push('a plugin must declare a client and/or server target')
  }
  if (manifest.client != null) {
    const c = manifest.client
    if (typeof c !== 'object' || Array.isArray(c)) {
      errors.push('client must be an object { entry }')
    } else if (typeof c.entry !== 'string' || !c.entry.trim()) {
      errors.push('client.entry (entry module path) is required')
    }
  }
  if (manifest.net != null) {
    if (typeof manifest.net !== 'object' || Array.isArray(manifest.net)) {
      errors.push('net must be an object { origins: string[] }')
    } else if (manifest.net.origins != null && !Array.isArray(manifest.net.origins)) {
      errors.push('net.origins must be an array of origin strings')
    }
  }

  if (manifest.permissions != null) {
    if (!Array.isArray(manifest.permissions)) errors.push('permissions must be an array')
    else for (const p of manifest.permissions) {
      if (!isKnownPermission(p)) warnings.push(`unknown permission "${p}" (ignored)`)
    }
  }
  if (manifest.host_permissions != null) {
    if (!Array.isArray(manifest.host_permissions)) errors.push('host_permissions must be an array')
    else for (const p of manifest.host_permissions) {
      if (!isKnownHostPermission(p)) warnings.push(`unknown host permission "${p}" (ignored)`)
    }
  }
  if (manifest.dependencies != null && (typeof manifest.dependencies !== 'object' || Array.isArray(manifest.dependencies))) {
    errors.push('dependencies must be an object of { pluginId: versionRange }')
  }

  if (manifest.server != null) {
    const s = manifest.server
    if (typeof s !== 'object' || Array.isArray(s)) {
      errors.push('server must be an object { entry, runtime, permissions }')
    } else {
      if (typeof s.entry !== 'string' || !s.entry.trim()) errors.push('server.entry (backend source path) is required')
      if (s.runtime != null && s.runtime !== 'wasm-js') warnings.push(`unknown server.runtime "${s.runtime}" (only "wasm-js" is supported)`)
      if (s.permissions != null) {
        if (!Array.isArray(s.permissions)) errors.push('server.permissions must be an array')
        else for (const p of s.permissions) {
          if (!isKnownServerPermission(p)) warnings.push(`unknown server permission "${p}" (ignored)`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

/** Granted permissions, dropping any unknown ones (so callers can trust the list). */
export function grantedPermissions(manifest) {
  return (manifest.permissions ?? []).filter(isKnownPermission)
}
