import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  "./packages/node-cache/vite.config.ts",
  "./packages/cache-manager/vite.config.ts",
  "./packages/file-entry-cache/vite.config.ts",
  "./packages/flat-cache/vite.config.ts",
  "./packages/cacheable-request/vitest.config.mjs",
  "./packages/cacheable/vite.config.ts"
])
