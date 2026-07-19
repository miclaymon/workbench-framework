// @workbench/framework — public surface.
//
// The Workbench framework: activity host + frozen facade, contribution
// registries (commands / keybindings / hooks / views / icons / preferences),
// overlay services (lightbox / peek), the split-grid layout engine, the UI model
// classes, and the permission-scoped plugin system (model + API + host).
//
// UI-framework-agnostic: state is built on @vue/reactivity stores only — no
// components, no renderer. A UI package (e.g. @workbench/vue) renders these
// stores; the host app supplies the app-specific parts (activity definitions,
// persistence, transports) as parameters. See each module for its contract.

// Workbench instance
export {
  Workbench,
  createWorkbench,
} from './workbench.js'

// Event emitter
export {
  createEmitter,
} from './emitter.js'

// Command registry
export {
  createCommandRegistry,
} from './registries/commandRegistry.js'

// Keybinding registry
export {
  createKeybindingRegistry,
  formatChord,
  normalizeChord,
} from './registries/keybindingRegistry.js'

// Hook registry
export {
  createHookRegistry,
} from './registries/hookRegistry.js'

// View / section / status registry
export {
  registerActivity,
  unregisterActivity,
  getModal,
  listModals,
  getViewEntry,
  activityOfView,
  activityOfTabKind,
  tabViewIdForKind,
  tabViewForKind,
  tabIconDescriptor,
  getStatusViews,
  listActivities,
  listPrimaryViews,
  getActivity,
  viewAcceptsSections,
  viewAllowsDuplicateSections,
  viewActions,
  sectionActions,
  sectionHeadingShown,
  bubbledSectionActions,
  viewDataId,
  sectionDataId,
  useViewRegistry,
} from './registries/viewRegistry.js'

// Icon-theme registry
export {
  registerIconTheme,
  unregisterIconTheme,
  setActiveIconTheme,
  listIconThemes,
  resolveIcon,
  useIconRegistry,
  activeIconThemeId,
  isIconThemeAvailable,
} from './registries/iconRegistry.js'

// Preference schema contributions
export {
  registerPreferences,
  contributedSchemaProperties,
} from './registries/preferenceSchema.js'

// Lightbox service
export {
  openLightbox,
  closeLightbox,
  useLightbox,
  lightboxActive,
} from './services/lightbox.js'

// Peek service
export {
  openPeek,
  closePeek,
  usePeek,
  peekActive,
} from './services/peek.js'

// Split-grid layout engine
export {
  isLeaf,
  isBranch,
  createLeaf,
  createBranch,
  findLeaf,
  collectLeaves,
  firstLeaf,
  leafCount,
  findParent,
  findTab,
  insertLeafBeside,
  removeLeaf,
  mergeAll,
  applyPreset,
  PRESETS,
} from './layout/layoutGrid.js'

// Activity host (broker + facade)
export {
  useActivityHost,
} from './host/activityHost.js'

// Permission-scoped plugin API
export {
  createPluginApi,
} from './plugins/pluginApi.js'

// Plugin host (loader + lifecycle)
export {
  createPluginHost,
} from './plugins/pluginHost.js'

// UI model classes
export {
  View,
  VIEW_LOCATIONS,
  EditorView,
  ModalView,
  PanelView,
  ViewSection,
  StatusView,
  Activity,
  activityFromDefinition,
} from './models/ui/index.js'

// Plugin model (manifest + permissions)
export {
  PERMISSIONS,
  HOST_PERMISSIONS,
  PERMISSION_NAMES,
  HOST_PERMISSION_NAMES,
  isKnownPermission,
  isKnownHostPermission,
  SUPPORTED_MANIFEST_VERSION,
  validateManifest,
  grantedPermissions,
} from './models/plugin/index.js'
