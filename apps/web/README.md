# Spenza web application

This workspace contains the promoted Next.js App Router application that serves as Spenza's production web foundation. Milestone 1 changes only its repository location and package identity; application behavior remains unchanged.

## Run from the repository root

```bash
pnpm install --frozen-lockfile
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Workspace validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm build:web
```

The application source is under `apps/web/src`, and its Prisma schema remains under `apps/web/prisma` until the later API/database migration. Local `.env*` files are ignored and must stay uncommitted.

Responsive redesign and PWA behavior begin in later milestones; this workspace does not yet include a manifest or service worker.
