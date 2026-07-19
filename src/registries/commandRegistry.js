import { reactive } from '../reactivity.js'

// ── Command registry ─────────────────────────────────────────────────────────
//
// The single source of truth for invokable workbench behaviours. A *command* is a
// named, runnable unit; menus, keybindings, and the command palette all reference
// commands by id instead of embedding their own action closures. Activities (and,
// later, third-party plugins) contribute commands through the workbench facade
// (see useActivityHost.js), so the registry is dynamic — every registration
// returns a disposer and can come and go at runtime.
//
// Command shape:
//   id         unique string, namespaced by convention ('explorer.newFolder')
//   title      human label (command palette / menus)
//   category?  grouping label shown in the palette ('File', 'View', …)
//   icon?      MDI path string
//   when(ctx)? predicate — when present and falsy the command is disabled and
//              execute() is a no-op. `ctx` is the activity host: the same binding
//              context view/section actions already receive (NOT the facade).
//   run(ctx, …args)  the behaviour.
//
// `ctx` is resolved lazily via getCtx() so the registry can be created before the
// host is fully assembled — the host gains late-bound slice handlers only after
// the activities have been set up.
export function createCommandRegistry({ getCtx, log = () => {} }) {
  const commands = reactive(new Map())

  function register(cmd) {
    if (!cmd?.id || typeof cmd.run !== 'function') {
      throw new Error('[commands] register() needs { id, run }')
    }
    if (commands.has(cmd.id)) log('commands', `overwriting "${cmd.id}"`)
    commands.set(cmd.id, cmd)
    // Disposer removes only this exact registration, so a later re-register of the
    // same id isn't clobbered by an earlier disposer firing late.
    return () => { if (commands.get(cmd.id) === cmd) commands.delete(cmd.id) }
  }

  function get(id) { return commands.get(id) ?? null }
  function has(id) { return commands.has(id) }
  function list()  { return [...commands.values()] }

  // Whether the command exists and its `when` predicate (if any) currently holds.
  function isEnabled(id) {
    const cmd = commands.get(id)
    if (!cmd) return false
    return cmd.when ? !!cmd.when(getCtx()) : true
  }

  // Run a command by id. Silently no-ops (with a debug note) for unknown or
  // currently-disabled commands so callers — keybindings, menus, palette — don't
  // each have to guard.
  function execute(id, ...args) {
    const cmd = commands.get(id)
    if (!cmd) { log('commands', `no such command "${id}"`); return undefined }
    const ctx = getCtx()
    if (cmd.when && !cmd.when(ctx)) { log('commands', `"${id}" is disabled`); return undefined }
    return cmd.run(ctx, ...args)
  }

  return { register, unregister: (id) => commands.delete(id), get, has, list, isEnabled, execute }
}
