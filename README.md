# Spenza

Spenza is being developed incrementally as a responsive, PWA-first expense-sharing platform. The repository is a pnpm workspace, and the promoted Next.js application under `apps/web` remains the runnable product throughout the migration.

## Prerequisites

- Node.js 20 LTS (the same major version used by the production containers)
- pnpm 11.16.0 through Corepack

The repository's `.nvmrc` selects Node.js 20 for version managers that support it. Node.js 24 is not a supported local-development runtime for this project.

## Workspace layout

```text
apps/
  web/              Production web application (Next.js PWA)
  api/              Express API with Prisma/PostgreSQL, Clerk auth, idempotent workflows
  mobile/           Empty placeholder for future React Native app
packages/
  contracts/        Shared API contracts (Zod schemas)
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

All commands above are fully functional. `pnpm test` runs the complete test suite (214 API tests + 40 web tests).

Local environment files remain untracked. The web application reads its local environment from `apps/web/.env*`; never commit secret values.

See `docs/MILESTONES.md`, `docs/PWA_REQUIREMENTS.md`, and `docs/revamp/WEB_PROMOTION_REPORT.md` for scope and migration status.
