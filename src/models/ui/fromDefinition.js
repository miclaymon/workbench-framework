import { Activity } from './Activity.js'
import { EditorView } from './EditorView.js'
import { ModalView } from './ModalView.js'
import { PanelView } from './PanelView.js'
import { ViewSection } from './ViewSection.js'
import { StatusView } from './StatusView.js'

// Bridge between the declarative activity-definition format (the object literals
// in client/activities/*.js) and the class model. Lets first-party activities
// keep their current authoring shape while the registries operate on instances;
// an already-built Activity (how a plugin authors) passes straight through.
//
// Definition shape consumed:
//   { id, label, icon, builtin|core, setup,
//     tabViews:    { [id]: { kind, label, icon, component, props } },
//     panelViews:  { [id]: { label, icon, sections, acceptsSections, allowDuplicateSections, actions, props, on } },
//     sections:    { [id]: { label, icon, homeView, component, expose, actions, props, on, alwaysShowHeading } },
//     statusViews: { [id]: { region, order, component } },
//     modals:      { [id]: { label, icon, component, props, on, actions } } }
export function activityFromDefinition(def) {
  if (def instanceof Activity) return def

  const activity = new Activity({
    id:      def.id,
    label:   def.label,
    icon:    def.icon,
    builtin: def.builtin ?? def.core ?? false,
    setup:   def.setup ?? null,
  })

  for (const [id, d] of Object.entries(def.tabViews ?? {}))    activity.addView(new EditorView({ id, ...d }))
  for (const [id, d] of Object.entries(def.panelViews ?? {}))  activity.addView(new PanelView({ id, ...d }))
  for (const [id, d] of Object.entries(def.sections ?? {}))    activity.addView(new ViewSection({ id, ...d }))
  for (const [id, d] of Object.entries(def.statusViews ?? {})) activity.addView(new StatusView({ id, ...d }))
  for (const [id, d] of Object.entries(def.modals ?? {}))      activity.addView(new ModalView({ id, ...d }))

  return activity
}
