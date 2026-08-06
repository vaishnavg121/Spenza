# Spenza

Spenza is being developed incrementally as a responsive, PWA-first expense-sharing platform. The repository is a pnpm workspace, and the promoted Next.js application under `apps/web` remains the runnable product throughout the migration.

## Workspace layout

```text
apps/
  web/              Production web application foundation
  mobile/           Empty placeholder retained for a later cleanup
  api/              Empty placeholder reserved for API Foundation
packages/
  contracts/        Reserved shared API contracts
  config/           Reserved shared runtime/build configuration
  eslint-config/    Shared ESLint configuration
  tsconfig/         Shared strict TypeScript configuration
```

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev:web
pnpm build:web
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
```

The current repository has no automated test suite, so `pnpm test` is an orchestration command that will begin running workspace test scripts as they are introduced.

Local environment files remain untracked. The web application reads its local environment from `apps/web/.env*`; never commit secret values.

See `docs/MILESTONES.md`, `docs/PWA_REQUIREMENTS.md`, and `docs/revamp/WEB_PROMOTION_REPORT.md` for scope and migration status.
