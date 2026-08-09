# Database Migration Runbook

## Overview
This runbook covers the exact sequence of steps to safely execute database schema migrations and data backfills for the Spenza production database in Google Cloud SQL.

**CRITICAL: Never execute migrations directly from a local machine using production credentials.**

## Prerequisites
1. Dedicated Cloud Run Job (`spenza-db-migrate`) with access to the Cloud SQL database and Secret Manager (`DATABASE_URL`).
2. Confirmed successful point-in-time backup in Google Cloud SQL.

## Migration Sequence

### 1. Pre-Migration Checklist
- [ ] Notify users of maintenance window if applicable.
- [ ] Verify point-in-time recovery is active in Cloud SQL.
- [ ] Take a manual backup of the `spenza` production database.

### 2. Additive Migrations Execution
All migrations designed for Milestones 1-12 are additive.

Execute the migration using the dedicated Cloud Run Job:
```bash
gcloud run jobs execute spenza-db-migrate --region=us-central1 --wait
```
*Note: The job should run `pnpm --filter @spenza/web exec prisma migrate deploy`.*

### 3. Backfill Execution (Post-Migration)
After the schema is updated, additive `BIGINT` columns will be `NULL`. A guarded backfill must be executed.

1. Connect to the Cloud SQL database using Cloud SQL Auth Proxy or a secure bastion.
2. Execute the expense backfill:
   ```bash
   psql -h 127.0.0.1 -U postgres -d spenza -f apps/web/prisma/scripts/backfill-expense-minor-units.sql
   ```
3. Execute the settlement backfill:
   ```bash
   psql -h 127.0.0.1 -U postgres -d spenza -f apps/web/prisma/scripts/backfill-settlement-minor-units.sql
   ```

### 4. Verification
Run the following SQL queries to reconcile data:
```sql
-- Verify no orphaned nulls remain
SELECT COUNT(*) FROM "Expense" WHERE "totalMinor" IS NULL AND "voidedAt" IS NULL;
SELECT COUNT(*) FROM "Settlement" WHERE "amountMinor" IS NULL AND "status" = 'COMPLETED';
```

### 5. Rollback Strategy
If the migration fails or data verification uncovers anomalies:
1. Since the migrations are purely additive (adding columns/tables), the older Next.js web application will remain functional. 
2. If schema corruption occurs, restore the Cloud SQL database to the exact timestamp of the manual backup taken in Step 1.
3. Terminate deployment of the newer API / Web Cloud Run revisions.
