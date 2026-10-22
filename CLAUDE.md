# Backlog - Architecture & AI Agent Rules
- **Project**: Backlog — Cross-platform game price, patch note, live event, and backlog spending tracker.
- **Tech Stack**: Turborepo (`pnpm`), Next.js 15 (App Router), React Native (Expo SDK 52 + NativeWind v4), tRPC v11, Drizzle ORM, PostgreSQL 16 (Docker local / Neon prod), Better Auth, Vitest, Playwright.
- **Hardware Constraint**: Laptop GPU is disabled. For Android Studio emulators, always use `-gpu swiftshader_indirect`. Never add GPU-dependent libraries.
- **Package Boundaries**:
  1. `packages/validators`: Pure TypeScript functions, Zod schemas, Steam BBCode cleaners, price-threshold math, and Vitest unit tests (`src/__tests__/*.test.ts`). Zero DB or React imports here.
  2. `packages/db`: Drizzle schema in `src/schema.ts`. Push via `pnpm db:push`.
  3. `packages/api`: tRPC v11 routers in `src/router/*.ts`. Validate all inputs with `@acme/validators`.
  4. `apps/nextjs` & `apps/expo`: Consume backend strictly via `api.<router>.<procedure>.useQuery()` / `.useMutation()`.
- **Testing Mandate**: Every new parser, import/export schema, or deal calculator in `packages/validators` must include a Vitest unit test.
