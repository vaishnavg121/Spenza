# Operations & Observability

## Logging
The API utilizes `pino-http` for structured JSON logging.
- Includes `X-Request-Id` automatically generated or propagated for tracing.
- Ignores healthcheck paths (`/health`, `/v1/health`) to reduce noise.
- Ensure Google Cloud Logging parses the JSON output accurately for Log Explorer.

## Billing Safety & Budgets
Set a conservative Google Cloud budget alert (e.g., $10/month threshold) linked to an email notification. 

**IMPORTANT**: Budget alerts are *notifications*, not hard spending caps. They will not automatically turn off services.
- Frequently check remaining trial credits in the Billing dashboard.
- Monitor Cloud SQL daily burn (this is the only fixed-cost asset).
- Monitor Cloud Run and GCS usage (request-based, should be near $0 for a small friends group).

If costs spike unexpectedly, manually stop the Cloud SQL instance or scale Cloud Run revisions to 0.

## Outbox Processing / Notifications
The `OutboxEvent` table buffers external network calls (Web Push).
If push delivery fails:
1. The outbox processor increments the `attempts` counter and marks it `FAILED`.
2. Financial transactions are inherently isolated from this.
3. **Runbook**: Inspect Cloud Logs for VAPID configuration issues. A manual SQL `UPDATE "OutboxEvent" SET status = 'PENDING' WHERE status = 'FAILED'` can re-trigger dispatch.

## Receipt Storage Failure
If the `spenza-api` fails to issue signed URLs:
1. Ensure the Service Account associated with the Cloud Run revision has `Storage Object Admin` rights on the designated bucket.
2. The UI handles failures safely via standard toast error states.
