# Spenza

Spenza is being migrated incrementally from the retained Next.js application to a mobile-first expense-sharing platform. The repository is a pnpm workspace; the existing application remains the runnable product under `apps/web-legacy` until replacement parity is verified.

## Workspace layout

```text
apps/
  web-legacy/       Existing Next.js application
  mobile/           Reserved for Milestone 2
  api/              Reserved for Milestone 3
packages/
  contracts/        Reserved shared API contracts
  config/           Reserved shared runtime/build configuration
  eslint-config/    Shared ESLint configuration
  tsconfig/         Shared strict TypeScript configuration
```

## Commands

```bash
pnpm install
pnpm dev:web
pnpm build:web
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
```

The current repository has no automated test suite, so `pnpm test` is an orchestration command that will begin running workspace test scripts as they are introduced.

Local environment files remain untracked. The legacy web application reads its local environment from `apps/web-legacy/.env*`; never commit secret values.

See `docs/MILESTONES.md` and `docs/revamp/MONOREPO_SETUP_REPORT.md` for scope and migration status.
