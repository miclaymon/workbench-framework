import { getActivity, registerActivity } from './registries/viewRegistry.js'
import { useActivityHost } from './host/activityHost.js'
import { createPluginHost } from './plugins/pluginHost.js'

// ── Workbench instance ──────────────────────────────────────────────────────
//
// The object a host app creates to stand up a workbench: it ties together the
// activity host (broker + frozen facade) and the plugin host under one identity
// that UI packages can bind to (e.g. @workbench/vue's <WorkbenchApp :workbench>).
//
// The app supplies everything app-specific through the options:
//   editor      the editor-grid adapter (activeTab / activeGroupId / editorRoot /
//               openTab plumbing — see host/activityHost.js)
//   prefs       reactive preferences object
//   services    shared helpers + late-bound handlers (incl. callPluginRpc for
//               plugin `server` backends)
//   log         debug logger
//   activities  first-party activity definitions. Their runtime APIs are
//               instantiated by the host; their SURFACES are ensured here via
//               registerActivity() — apps that need surfaces before instance
//               creation (e.g. layout slices constructed earlier in setup) may
//               register them at module scope first; that is detected and not
//               repeated.
//
// Plugins: `workbench.plugins` is the framework plugin host — the app feeds it
// { manifest, module } pairs however it delivers them (bundled import, fetched +
// hash-verified artifacts, …).
export class Workbench {
  constructor({ editor, prefs, services = {}, log = () => {}, activities = [] } = {}) {
    for (const def of activities) {
      if (!getActivity(def.id)) registerActivity(def)
    }
    this.host = useActivityHost({ editor, prefs, services, log, activities })
    this.facade = this.host.facade
    this.plugins = createPluginHost({ host: this.host, log })
    this.log = log
    // Back-reference so anything holding the host can reach the instance.
    this.host.workbench = this
  }
}

export function createWorkbench(options) {
  return new Workbench(options)
}
