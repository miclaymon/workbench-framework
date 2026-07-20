import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// This package never runs `npm install` for @vue/reactivity (see AGENTS.md — a
// local copy would shadow the host app's through the `file:` symlink install and
// silently break dependency tracking there). Tests still need a real
// @vue/reactivity to exercise the actual reactive stores, so alias straight to
// the sibling app's installed copy rather than adding a second, unrelated
// instance under this package's own node_modules.
const appReactivity = fileURLToPath(
  new URL(
    '../files-workbench-app/client/node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js',
    import.meta.url,
  ),
)

export default defineConfig({
  resolve: {
    alias: {
      '@vue/reactivity': appReactivity,
    },
  },
  test: {
    environment: 'node',
  },
})
