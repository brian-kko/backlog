# Implementation worker brief

Shared instructions for implementation agents (Codex `gpt-6.1-sol`, or
`gpt-6-luna` for mechanical edits) that work on Gemuzu UI tasks in parallel.
Each agent gets this file plus a task spec, and runs in its own git worktree.

You are an implementation agent working on Gemuzu, a PC game backlog,
cross-store price watcher and patch-note digest. It's a Next.js App Router
app using React, Tailwind v4 and tRPC, in a pnpm monorepo. You're in a git
worktree of the repo; work ONLY inside it. Read `CLAUDE.md` and
`apps/nextjs/ux/COUNCIL.md` first for the product, audience and constraints.

## Hard rules

- **Files:** edit ONLY the files listed under "Files you own" in your task.
  Other agents are editing other files in parallel, and touching anything
  else causes merge conflicts.
- **CSS:**
  - Put NEW rules in your task's own file, `apps/nextjs/src/app/styles/<task>.css`
    (create it if needed), wrapped in `@layer components { ... }`. Tailwind
    `@apply` works there.
  - The integrator adds the `@import`; don't touch the import list in
    `styles.css`.
  - You MAY edit existing rules in `apps/nextjs/src/app/styles.css` in place,
    but only for selectors listed in your task. Don't reorder or reformat
    anything else.
- **Design system:**
  - Colours: dark #121411, card #1a1d18, muted #252a22, text #f2f4eb, muted
    text #b6bcad, lime #c8ed78 (`var(--signal)`).
  - Use the existing CSS variables: `--background`, `--foreground`,
    `--muted-foreground`, `--border`, `--signal`, `--font-display` (Barlow
    Condensed) and `--font-mono` (IBM Plex Mono).
  - Light theme must keep working.
- **Motion:** transform/opacity only. No blur, backdrop-filter, filter or
  WebGL, and nothing perpetual. Honour prefers-reduced-motion by showing the
  final state immediately.
- **Layout shift:** anything that loads late must have its space reserved.
- **Accessibility:** touch targets ≥44px on coarse pointers, visible focus,
  semantic HTML.
- **Pricing honesty:**
  - Never present saved/catalog prices as live.
  - Claim "lowest ever" only with live history.
  - Compare money in cents via `compareToSteam` from `@acme/validators`.
  - $0 shows "Free": use `price()` from `~/components/game-ui`, not `money()`.
- **Tests:**
  - Keep every `data-testid`.
  - `apps/nextjs/e2e/smoke.spec.ts` asserts some visible text, classes and
    accessible names. If you change one, update that assertion and list it in
    your summary.
- **Style:** Prettier, strict TypeScript, no `any`, no non-null assertions,
  short comments that explain why.

## Before finishing

From the worktree root, run these and fix anything you introduced:

```
npx prettier --write <files you changed>
pnpm --filter @acme/nextjs typecheck
pnpm --filter @acme/nextjs lint
```

Ten lint problems already exist and aren't yours: in
`e2e/public-discovery.spec.ts`, `e2e/smoke.spec.ts` (lines ~124/351), a
useEffect warning in `deals/page.tsx`, and an unused disable in
`library/page.tsx`. Don't add new ones.

Do NOT start a dev server, run e2e tests, install packages or commit.

Finish with a short summary:
- what you changed, per file
- any test assertions you updated
- anything you couldn't do
