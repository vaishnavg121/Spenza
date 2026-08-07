# Identity Migration Report

## Design

The User model receives nullable unique clerkSubjectId. Internal User IDs remain canonical and all existing foreign keys remain unchanged. PostgreSQL unique semantics permit existing users to remain unlinked while ensuring each Clerk subject maps to at most one User.

## Migration safety

The explicit additive migration adds one nullable column and a unique index. It was not executed: the configured DATABASE_URL is a remote Cloud SQL-style target with no proven disposable-development classification or migration history. No reset, deletion, or backfill was performed.

## Linking policy

Existing subject mappings resolve directly. A genuinely new verified subject may create one User with its subject in a transaction; legacy email matches require explicit reconciliation and must never be linked automatically. Milestone 6 still requires API persistence/resolution implementation and isolated database tests before the migration can be considered complete.

## API, tests, and validation

Prisma composition is isolated in the API identity composition module; the profile router accepts the identity service through its factory. Route tests cover mapped/new user reads, reconciliation, identity conflict, valid updates, and rejection of unknown and identity-overriding fields. Lint, strict type checking, tests, API build, web build, and Prisma validation pass. The migration remains unexecuted. A reviewer must apply it with prisma migrate deploy only to a proven-safe development or staging database, then run reconciliation checks before any production rollout.
