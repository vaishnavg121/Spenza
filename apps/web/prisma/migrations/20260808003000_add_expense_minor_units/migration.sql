-- Expand-only financial schema for Milestone 8.
-- Legacy floating-point columns remain in place until reconciliation and cutover.
ALTER TABLE "Expense"
  ADD COLUMN "totalMinor" BIGINT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "voidedAt" TIMESTAMP(3);

ALTER TABLE "ExpenseSplit"
  ADD COLUMN "allocationMinor" BIGINT,
  ADD COLUMN "allocationOrder" INTEGER,
  ADD COLUMN "percentageBps" INTEGER,
  ADD COLUMN "shareWeight" BIGINT;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_totalMinor_positive" CHECK ("totalMinor" IS NULL OR "totalMinor" > 0),
  ADD CONSTRAINT "Expense_version_positive" CHECK ("version" > 0);

ALTER TABLE "ExpenseSplit"
  ADD CONSTRAINT "ExpenseSplit_allocationMinor_nonnegative" CHECK ("allocationMinor" IS NULL OR "allocationMinor" >= 0),
  ADD CONSTRAINT "ExpenseSplit_allocationOrder_nonnegative" CHECK ("allocationOrder" IS NULL OR "allocationOrder" >= 0),
  ADD CONSTRAINT "ExpenseSplit_percentageBps_range" CHECK ("percentageBps" IS NULL OR "percentageBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "ExpenseSplit_shareWeight_positive" CHECK ("shareWeight" IS NULL OR "shareWeight" > 0);

CREATE TABLE "ExpensePayment" (
  "id" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contributionMinor" BIGINT NOT NULL,
  "paymentOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExpensePayment_contribution_positive" CHECK ("contributionMinor" > 0),
  CONSTRAINT "ExpensePayment_order_nonnegative" CHECK ("paymentOrder" >= 0)
);

CREATE TABLE "ExpenseRevision" (
  "id" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "actorId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpenseRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExpenseRevision_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseSplit_expenseId_allocationOrder_key" ON "ExpenseSplit"("expenseId", "allocationOrder");
CREATE UNIQUE INDEX "ExpensePayment_expenseId_userId_key" ON "ExpensePayment"("expenseId", "userId");
CREATE UNIQUE INDEX "ExpensePayment_expenseId_paymentOrder_key" ON "ExpensePayment"("expenseId", "paymentOrder");
CREATE INDEX "ExpensePayment_userId_idx" ON "ExpensePayment"("userId");
CREATE UNIQUE INDEX "ExpenseRevision_expenseId_version_key" ON "ExpenseRevision"("expenseId", "version");
CREATE INDEX "ExpenseRevision_actorId_idx" ON "ExpenseRevision"("actorId");
CREATE UNIQUE INDEX "IdempotencyRecord_actorId_method_route_key_key" ON "IdempotencyRecord"("actorId", "method", "route", "key");
CREATE INDEX "IdempotencyRecord_createdAt_idx" ON "IdempotencyRecord"("createdAt");

ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseRevision" ADD CONSTRAINT "ExpenseRevision_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseRevision" ADD CONSTRAINT "ExpenseRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
