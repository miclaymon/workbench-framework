import { describe, it, expect, afterEach } from 'vitest'
import {
  registerActivity, unregisterActivity,
  getModal, listModals, getViewEntry,
  activityOfView, activityOfTabKind, tabViewIdForKind, tabViewForKind, tabIconDescriptor,
  getStatusViews, listActivities, listPrimaryViews, getActivity,
  viewAcceptsSections, viewAllowsDuplicateSections,
  viewActions, sectionActions, sectionHeadingShown, bubbledSectionActions,
  viewDataId, sectionDataId, useViewRegistry,
} from '../../src/registries/viewRegistry.js'

// viewRegistry holds module-level singleton state (REGISTRY/REGISTERED/etc. are
// not per-instance) — every test must clean up its own activity id afterward so
// tests can't leak into each other.
const registered = []
afterEach(() => {
  while (registered.length) unregisterActivity(registered.pop())
})

function register(def) {
  registerActivity(def)
  registered.push(def.id)
}

function panelDef(id, overrides = {}) {
  return {
    id,
    label: `Label ${id}`,
    icon: 'mdi-folder',
    panelViews: {
      [`${id}-panel`]: {
        label: 'Panel', component: { name: 'PanelComponent' },
        sections: [`${id}-section`], actions: [{ id: 'refresh' }],
      },
    },
    sections: {
      [`${id}-section`]: {
        label: 'Section', component: { name: 'SectionComponent' },
        homeView: `${id}-panel`, actions: [{ id: 'sectionAction' }],
      },
    },
    tabViews: {
      [`${id}-tab`]: { kind: `${id}Kind`, label: 'Tab', component: { name: 'TabComponent' }, icon: 'mdi-file' },
    },
    statusViews: {
      [`${id}-status`]: { component: { name: 'StatusComponent' }, region: 'left', order: 5 },
    },
    modals: {
      [`${id}-modal`]: { label: 'Modal', component: { name: 'ModalComponent' } },
    },
    ...overrides,
  }
}

describe('registerActivity / unregisterActivity', () => {
  it('ingests every surface type and unregisterActivity removes them all', () => {
    const def = panelDef('act1')
    register(def)

    expect(getActivity('act1')?.id).toBe('act1')
    expect(getViewEntry('act1-panel')).not.toBeNull()
    expect(getViewEntry('act1-section')).not.toBeNull()
    expect(getViewEntry('act1-tab')).not.toBeNull()
    expect(getStatusViews().some(v => v.id === 'act1-status')).toBe(true)
    expect(getModal('act1-modal')).not.toBeNull()

    unregisterActivity('act1')
    registered.pop()   // already cleaned up manually

    expect(getActivity('act1')).toBeNull()
    expect(getViewEntry('act1-panel')).toBeNull()
    expect(getViewEntry('act1-section')).toBeNull()
    expect(getViewEntry('act1-tab')).toBeNull()
    expect(getStatusViews().some(v => v.id === 'act1-status')).toBe(false)
    expect(getModal('act1-modal')).toBeNull()
  })

  it('unregisterActivity on an unknown id is a harmless no-op', () => {
    expect(() => unregisterActivity('never-registered')).not.toThrow()
  })

  it('registerActivity returns a disposer equivalent to unregisterActivity', () => {
    const def = panelDef('act-disposer')
    const dispose = registerActivity(def)
    expect(getActivity('act-disposer')).not.toBeNull()
    dispose()
    expect(getActivity('act-disposer')).toBeNull()
  })

  it('a promotable modal (one with a tab kind) is resolvable both as a modal and via TAB_KIND', () => {
    const def = panelDef('act2', {
      modals: {
        'act2-modal': { label: 'Modal', component: {}, kind: 'act2ModalKind' },
      },
    })
    register(def)
    expect(getModal('act2-modal')).not.toBeNull()
    expect(getViewEntry('act2-modal')).not.toBeNull()   // also lives in REGISTRY
    expect(tabViewIdForKind('act2ModalKind')).toBe('act2-modal')
    expect(activityOfTabKind('act2ModalKind')).toBe('act2')
  })
})

describe('view / tab-kind lookups', () => {
  it('activityOfView resolves the owning activity id', () => {
    register(panelDef('act3'))
    expect(activityOfView('act3-panel')).toBe('act3')
    expect(activityOfView('nope')).toBeNull()
  })

  it('activityOfTabKind defaults to "workbench" for an unknown kind', () => {
    expect(activityOfTabKind('nonexistent-kind')).toBe('workbench')
  })

  it('tabViewForKind resolves the registered EditorView', () => {
    register(panelDef('act4'))
    const view = tabViewForKind('act4Kind')
    expect(view?.id).toBe('act4-tab')
  })

  it('tabViewForKind / tabViewIdForKind return null for an unknown kind', () => {
    expect(tabViewIdForKind('nope')).toBeNull()
    expect(tabViewForKind('nope')).toBeNull()
  })
})

describe('tabIconDescriptor', () => {
  it('falls back to the static kind icon when there is no dynamic tabIcon()', () => {
    register(panelDef('act5'))
    const descriptor = tabIconDescriptor({ kind: 'act5Kind' })
    expect(descriptor).toEqual({ type: 'svg.path', icon: 'mdi-file' })
  })

  it('prefers a dynamic per-tab tabIcon() when present and it returns a value', () => {
    const def = panelDef('act6')
    register(def)
    const view = getViewEntry('act6-tab')
    view.tabIcon = (tab) => ({ type: 'thumbnail', src: tab.thumb })
    const descriptor = tabIconDescriptor({ kind: 'act6Kind', thumb: 'x.png' })
    expect(descriptor).toEqual({ type: 'thumbnail', src: 'x.png' })
  })

  it('falls back to the static icon when dynamic:false is forced, even with a tabIcon()', () => {
    register(panelDef('act7'))
    const view = getViewEntry('act7-tab')
    view.tabIcon = () => ({ type: 'thumbnail', src: 'ignored.png' })
    const descriptor = tabIconDescriptor({ kind: 'act7Kind' }, { dynamic: false })
    expect(descriptor).toEqual({ type: 'svg.path', icon: 'mdi-file' })
  })

  it('returns null when the tab kind has no registered view', () => {
    expect(tabIconDescriptor({ kind: 'nope' })).toBeNull()
  })

  it('falls back to the static icon when tabIcon() returns a falsy value', () => {
    register(panelDef('act8'))
    const view = getViewEntry('act8-tab')
    view.tabIcon = () => null
    expect(tabIconDescriptor({ kind: 'act8Kind' })).toEqual({ type: 'svg.path', icon: 'mdi-file' })
  })
})

describe('getStatusViews', () => {
  it('sorts by order and filters by region', () => {
    register(panelDef('actA', {
      statusViews: { 'actA-status': { component: {}, region: 'left', order: 2 } },
    }))
    register(panelDef('actB', {
      statusViews: { 'actB-status': { component: {}, region: 'left', order: 1 } },
    }))
    register(panelDef('actC', {
      statusViews: { 'actC-status': { component: {}, region: 'right', order: 0 } },
    }))

    const left = getStatusViews('left')
    expect(left.map(v => v.id)).toEqual(['actB-status', 'actA-status'])
    const right = getStatusViews('right')
    expect(right.map(v => v.id)).toEqual(['actC-status'])
    expect(getStatusViews().length).toBeGreaterThanOrEqual(3)
  })
})

describe('listActivities / listPrimaryViews', () => {
  it('listActivities reflects registered activities with core flag', () => {
    register(panelDef('act-list', {}))
    const entry = listActivities().find(a => a.id === 'act-list')
    expect(entry).toMatchObject({ id: 'act-list', label: 'Label act-list', icon: 'mdi-folder', core: false })
  })

  it('listPrimaryViews only includes panel views located in PrimarySideBar', () => {
    register(panelDef('act-primary', {
      panelViews: {
        'act-primary-panel': { label: 'P', component: {}, location: 'PrimarySideBar' },
      },
    }))
    const found = listPrimaryViews().find(v => v.id === 'act-primary-panel')
    expect(found).toEqual({ id: 'act-primary-panel', icon: '', label: 'P' })
  })
})

describe('view capability flags', () => {
  it('viewAcceptsSections defaults to true, and honours an explicit false', () => {
    register(panelDef('act-caps', {
      panelViews: {
        'act-caps-panel': { label: 'P', component: {}, acceptsSections: false },
      },
    }))
    expect(viewAcceptsSections('act-caps-panel')).toBe(false)
    expect(viewAcceptsSections('unknown-view')).toBe(true)   // no entry -> permissive default
  })

  it('viewAllowsDuplicateSections defaults to false', () => {
    register(panelDef('act-dup', {
      panelViews: {
        'act-dup-panel': { label: 'P', component: {}, allowDuplicateSections: true },
      },
    }))
    expect(viewAllowsDuplicateSections('act-dup-panel')).toBe(true)
    expect(viewAllowsDuplicateSections('unknown-view')).toBe(false)
  })
})

describe('actions and heading visibility', () => {
  it('viewActions / sectionActions read the actions array off the entry', () => {
    register(panelDef('act9'))
    expect(viewActions('act9-panel')).toEqual([{ id: 'refresh' }])
    expect(sectionActions('act9-section')).toEqual([{ id: 'sectionAction' }])
    expect(viewActions('unknown')).toEqual([])
  })

  it('sectionHeadingShown is true with multiple sections, or when alwaysShowHeading is set', () => {
    const many = [{ id: 's1' }, { id: 's2' }]
    expect(sectionHeadingShown(many, { id: 's1' })).toBe(true)
    expect(sectionHeadingShown([{ id: 's1' }], { id: 's1' })).toBe(false)
    expect(sectionHeadingShown([{ id: 's1' }], { id: 's1', alwaysShowHeading: true })).toBe(true)
    expect(sectionHeadingShown(undefined, { id: 's1' })).toBe(false)
  })

  it('bubbledSectionActions skips the self-section and any section whose heading already shows', () => {
    register(panelDef('act10', {
      sections: {
        'act10-self':   { label: 'Self', component: {}, homeView: 'act10-self', actions: [{ id: 'selfAction' }] },
        'act10-hidden': { label: 'Hidden', component: {}, homeView: 'act10-panel', actions: [{ id: 'hiddenAction' }] },
      },
    }))
    const sections = [{ id: 'act10-self' }, { id: 'act10-hidden' }]
    // single-section-worth heading rules: with 2 sections in the list, sectionHeadingShown
    // is true for all of them (length > 1), so nothing not already handled bubbles except
    // the self id, which is always excluded outright.
    const out = bubbledSectionActions('act10-self', sections)
    expect(out).toEqual([])
  })

  it('bubbledSectionActions bubbles a hidden-heading section’s actions up', () => {
    register(panelDef('act11', {
      sections: {
        'act11-section': { label: 'S', component: {}, homeView: 'act11-panel', actions: [{ id: 'a' }] },
      },
    }))
    const sections = [{ id: 'act11-section' }]   // only one section -> heading hidden by default
    expect(bubbledSectionActions('act11-panel', sections)).toEqual([{ id: 'a' }])
  })
})

describe('semantic DOM id helpers (pure)', () => {
  it('viewDataId capitalizes the view id', () => {
    expect(viewDataId('explorer')).toBe('Workbench:Explorer')
  })

  it('sectionDataId uses the self-section form when section === home', () => {
    expect(sectionDataId('debug', 'debug')).toBe('Workbench:Debug')
    expect(sectionDataId('debug')).toBe('Workbench:Debug')   // homeViewId defaults to sectionId
  })

  it('sectionDataId nests under the home view when different', () => {
    expect(sectionDataId('openEditors', 'explorer')).toBe('Workbench:Explorer.OpenEditors')
  })
})

describe('useViewRegistry', () => {
  it('exposes the live registry object and getViewEntry', () => {
    register(panelDef('act12'))
    const { registry, getViewEntry: getEntry } = useViewRegistry()
    expect(registry['act12-panel']).toBeDefined()
    expect(getEntry('act12-panel')).toBe(registry['act12-panel'])
  })
})
