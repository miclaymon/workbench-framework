import { reactive } from '../reactivity.js'

// ── Preference schema contributions ──────────────────────────────────────────
//
// A reactive registry of preference SECTIONS contributed by activities and
// plugins (the configuration contribution point). Each section mirrors a
// JSON-schema object property and is merged into the Settings panel alongside the
// static base schema (config/preferences/preferences.schema.json) — so a plugin's
// settings appear automatically, the same dynamic-contribution pattern as commands
// and menus. Values live in `prefs` under the section's key and persist normally.
//
// Section shape:
//   key         prefs namespace + schema property key (e.g. 'sourceControl')
//   title       section heading
//   order?      sort order among contributed sections (default 0)
//   properties  { [settingKey]: JSON-schema property (type/title/default/enum/…) }
const SECTIONS = reactive({})

export function registerPreferences(section) {
  if (!section?.key || !section.properties) {
    throw new Error('[preferences] register() needs { key, properties }')
  }
  SECTIONS[section.key] = { order: 0, title: section.key, ...section }
  return () => { if (SECTIONS[section.key]?.properties === section.properties) delete SECTIONS[section.key] }
}

// Contributed sections as JSON-schema object properties, ordered by `order` then
// title — merged into the base schema's `properties` by the Settings panel.
export function contributedSchemaProperties() {
  const out = {}
  const ordered = Object.values(SECTIONS).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.title).localeCompare(String(b.title)))
  for (const s of ordered) {
    out[s.key] = { type: 'object', title: s.title, properties: s.properties, 'x-contributed': true }
  }
  return out
}
