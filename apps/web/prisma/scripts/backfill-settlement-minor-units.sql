-- MANUAL REVIEW REQUIRED. Do not run against the configured remote database.
-- Only completed, group-scoped settlements in reviewed two-decimal currencies are eligible.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Settlement" s
    JOIN "Group" g ON g."id" = s."groupId"
    WHERE s."status" = 'COMPLETED'
      AND s."amountMinor" IS NULL
      AND (
        s."amount" <= 0 OR
        s."currency" NOT IN ('INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD') OR
        s."currency" <> g."currency" OR
        s."amount" = 'Infinity'::double precision OR
        s."amount" = '-Infinity'::double precision OR
        s."amount" = 'NaN'::double precision OR
        ROUND(s."amount"::numeric * 100) <> s."amount"::numeric * 100 OR
        ROUND(s."amount"::numeric * 100) > 9223372036854775807
      )
  ) THEN
    RAISE EXCEPTION 'Settlement backfill requires currency or amount reconciliation';
  END IF;
END $$;

UPDATE "Settlement" s
SET "amountMinor" = ROUND(s."amount"::numeric * 100)::bigint
FROM "Group" g
WHERE s."groupId" = g."id"
  AND s."status" = 'COMPLETED'
  AND s."amountMinor" IS NULL
  AND s."currency" = g."currency"
  AND s."currency" IN ('INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD')
  AND s."amount" > 0
  AND ROUND(s."amount"::numeric * 100) = s."amount"::numeric * 100
  AND ROUND(s."amount"::numeric * 100) <= 9223372036854775807;
