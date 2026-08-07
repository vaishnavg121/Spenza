-- Expand-only settlement schema for Milestone 9.
-- Legacy Float amounts and historical rows remain untouched until reconciliation.
CREATE TYPE "SettlementKind" AS ENUM ('PAYMENT', 'REVERSAL');

ALTER TYPE "ActivityAction" ADD VALUE 'SETTLEMENT_REVERSED';

ALTER TABLE "Settlement"
  ADD COLUMN "amountMinor" BIGINT,
  ADD COLUMN "kind" "SettlementKind" NOT NULL DEFAULT 'PAYMENT',
  ADD COLUMN "reversesId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD CONSTRAINT "Settlement_amountMinor_positive" CHECK ("amountMinor" IS NULL OR "amountMinor" > 0),
  ADD CONSTRAINT "Settlement_distinct_parties" CHECK ("payerId" <> "payeeId"),
  ADD CONSTRAINT "Settlement_reversal_shape" CHECK (
    ("kind" = 'PAYMENT' AND "reversesId" IS NULL) OR
    ("kind" = 'REVERSAL' AND "reversesId" IS NOT NULL)
  );

CREATE UNIQUE INDEX "Settlement_reversesId_key" ON "Settlement"("reversesId");
CREATE INDEX "Settlement_createdById_idx" ON "Settlement"("createdById");
CREATE INDEX "Settlement_groupId_date_id_idx" ON "Settlement"("groupId", "date", "id");

ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_reversesId_fkey"
  FOREIGN KEY ("reversesId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
