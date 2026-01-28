# Agents

Cacheable is a caching monorepo providing a comprehensive suite of caching packages for Node.js built on Keyv.

## Packages

- `cacheable` - Layer 1/2 caching framework with distributed cache support
- `cache-manager` - High-level cache manager (used by NestJS)
- `cacheable-request` - RFC 7234 compliant HTTP request caching
- `flat-cache` - File-based persistent caching
- `file-entry-cache` - File metadata cache
- `@cacheable/memory` - In-memory caching with LRU support
- `@cacheable/node-cache` - Node-cache replacement
- `@cacheable/utils` - Shared utilities (hashing, time parsing, memoization)

## Commands

- `pnpm test` - Run linting and tests with coverage (use after making changes)
- `pnpm build` - Build all packages (TypeScript to dist/)
- `pnpm lint` - Run Biome linting with auto-fix
- `pnpm clean` - Clean all packages
- `pnpm test:services:start` - Start Redis for testing
- `pnpm test:services:stop` - Stop Redis

## Testing

- Always run `pnpm test` after making changes
- Goal: 100% code coverage
- Tests use Vitest with v8 coverage
- Redis container via Docker for integration tests

## Code Style

- TypeScript strict mode
- Biome: tabs, double quotes
- ES modules (ESM)
- Build with tsup (CJS + ESM output)
