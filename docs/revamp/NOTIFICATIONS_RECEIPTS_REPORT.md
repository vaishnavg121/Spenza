# Notifications and Receipts Report

## Outcome and scope

Milestone 12 implements private receipt image uploads and notification outbox architecture, integrated directly with authoritative financial services. 

- **Receipt Uploads**: Built secure receipt management using a signed URL lifecycle, keeping private artifacts isolated from web boundaries. Implemented a production GCS storage adapter.
- **Notifications**: Introduced a Notification API, Push Subscription management, and a notification center UI. Employs a transactional outbox to ensure external event failures never disrupt database commits. Complete Web Push service worker implemented.

No production schema migrations or remote database backfills were executed during this milestone. The modifications remain cleanly segregated from live data.

## Receipt architecture

- **Contracts**: Defined strictly in @spenza/contracts/receipt, outlining schemas for upload requests, URL mapping, and receipt finalization (e.g., CreateUploadRequestSchema).
- **GCS / Signed URL behavior**: Uses the StorageAdapter pattern. The implementation abstracts the underlying cloud provider (GcsStorageAdapter using @google-cloud/storage in prod, MockStorageAdapter in tests). Generates unique, non-guessable objectKey identifiers (eceipts/:groupId/:uuid) and short-lived signed URLs for PUT and GET operations.
- **Production GCS Adapter**: Uses Google Cloud Application Default Credentials (ADC), keeping JSON keys out of the codebase. The RECEIPTS_BUCKET_NAME must be configured in the environment.
- **Receipt authorization & Validation**: 
  - Only current group members can initialize uploads for their respective groups.
  - Finalization strictly matches the authenticated actor to the uploaderId recorded during the pending phase, preventing spoofing.
  - Before finalization, the server validates the actual object metadata (size and content type) against GCS using erifyObjectMetadata. Client MIME types alone are not trusted.
  - GET /url strictly mandates that the object has a READY status and the actor is an authorized group member, resolving IDOR risks.

## Notification architecture

- **Contracts**: Implemented @spenza/contracts/notification to encompass PushSubscriptionSchema and NotificationPageSchema.
- **APIs**:
  - POST /v1/push-subscriptions: Manages user endpoint and VAPID key pairs. Uses upsert mechanisms to prevent duplications.
  - DELETE /v1/push-subscriptions/:subscriptionId: Secure unsubscription logic bound strictly to the ctorUserId.
  - GET /v1/notifications: Paginated fetch mapping.
  - POST /v1/notifications/mark-read: Flags single or bulk notifications as read.
- **Web Push/service-worker behavior**: Web Push details (VAPID_PRIVATE_KEY, etc.) remain firmly on the backend. Subscriptions sync through the Express routes securely without exposing service worker configurations. The service worker safely strips sensitive payload details if necessary and handles caching securely.
- **Outbox/failure-isolation behavior**: Designed a generic OutboxEvent processor strategy. The createSettlement repository operation (and similar financial commits) natively writes an OutboxEvent row simultaneously within the Prisma transaction.
- **Outbox Worker**: Added a dedicated pnpm worker:notifications command to run src/notifications/worker.ts. It polls the pending outbox safely, decoupling network push requests from the transaction. Failures update the outbox row's retry attempts and status to FAILED, isolating the failure from the transaction.

## UI / Web adjustments

- **Receipt Web UI**: A new ReceiptManager React component securely initiates the signed upload flow and posts the binary file to the isolated endpoint. Provides localized validation (rejects files > 10MB or non-images) before invoking network resources.
- **Notification Center UI**: Embedded within the top-level navigation (pp-shell.tsx). Supports unread badges, infinite list rendering, and single/bulk mark-as-read toggles.
- **Browser Push Subscription**: A PushSubscribeButton component safely requests permission upon user interaction and submits the endpoint to the server securely using the public VAPID key.

## Schema Changes

Generated the structural updates necessary for Milestone 12 without executing against remote DB:

1. Receipt model (storing pending/ready/deleted states linked to Groups and Users).
2. PushSubscription model.
3. OutboxEvent model.

## Tests and validation

The test suite now incorporates the following verifications:

- **Receipt Service**: eceipt-service.test.ts validates IDOR protections, verifying that uploads and finalizations are properly restricted to active members and rightful uploaders. Metadata constraints check simulated payload drops across the storage adapters.
- **Notification Service**: 
otification-service.test.ts validates pagination bounds, subscription/unsubscription isolation (users cannot delete peers' subscriptions), and unread state mechanics.

All validations passed:
- pnpm lint -> 0 errors.
- pnpm typecheck -> 0 errors across monorepo.
- pnpm test -> Successfully executes 182 assertions across the system.
- pnpm build:api / pnpm build:web -> Success.
- pnpm prisma:validate -> Success.

## Remaining Milestone 12 Work

- Perform Prisma schema deployment (prisma migrate deploy) against target staging and production database.
- Establish Google Cloud Storage (GCS) Service Account credentials in Google Cloud, linking them securely to the GcsStorageAdapter inside the production runtime via ADC.
- Schedule the processOutbox worker cron sequence reliably in the production infrastructure.
