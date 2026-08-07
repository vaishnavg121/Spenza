-- MANUAL REVIEW REQUIRED. Do not run until a production-shaped restore is available.
-- This backfill is deliberately limited to reviewed two-decimal currencies.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Expense"
    WHERE "currency" NOT IN ('INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD')
  ) THEN
    RAISE EXCEPTION 'Unsupported currency exponent found; backfill aborted';
  END IF;
END $$;

UPDATE "Expense"
SET "totalMinor" = ROUND("amount"::numeric * 100)::bigint
WHERE "totalMinor" IS NULL;

UPDATE "ExpenseSplit"
SET "allocationMinor" = ROUND("amountOwed"::numeric * 100)::bigint
WHERE "allocationMinor" IS NULL;
