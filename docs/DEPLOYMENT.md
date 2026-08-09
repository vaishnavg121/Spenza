# Deployment Architecture

## Friends-Only MVP Strategy
This configuration is specifically optimized for a small, friends-only deployment operating under Google Cloud's $300 free trial credits. It deliberately favors minimal resource allocation and request-based billing over high availability or massive scale. 

**Important:** The current $300 credits are temporary (typically 90 days). This deployment footprint is intentionally tiny to maximize credit duration. Before credits expire, reassess the Cloud SQL requirement, but no architectural rewrite is required today.

## Google Cloud Infrastructure
Spenza is deployed exclusively on Google Cloud Platform using serverless architecture.

- **Web Frontend**: Deployed on Cloud Run (`spenza-web`).
  - **Configuration**: 0 minimum instances, 2 maximum instances, 512Mi Memory, 1 CPU.
  - **Billing**: Request-based billing (CPU allocated only during request processing). No dedicated load balancer.
- **Express API**: Deployed on Cloud Run (`spenza-api`).
  - **Configuration**: 0 minimum instances, 2 maximum instances, 512Mi Memory, 1 CPU.
  - **Billing**: Request-based billing.
- **Database**: Cloud SQL for PostgreSQL (`spenza-db`).
  - **Cost Profile**: `db-f1-micro` (Shared core, 0.6 GB RAM). No High Availability (HA), no read replicas. Minimal starting storage (e.g., 10GB) with auto-growth enabled. Automated backups are strictly enabled. 
  - **Connectivity**: Cloud Run instances connect to Cloud SQL using the built-in Cloud SQL Auth Proxy integration. Avoid public IP exposure where practical, or restrict authorized networks strictly. Do not provision VPC connectors or NAT gateways for this MVP to avoid fixed hourly costs.
- **Artifact Registry**: Docker images are stored in a regional Artifact Registry repository (e.g., `us-central1-docker.pkg.dev/<PROJECT_ID>/spenza`). Do not use deprecated Container Registry (`gcr.io`).
- **Receipt Storage**: Google Cloud Storage (`spenza-receipts-prod`). 
  - **Cost Profile**: Single, private bucket. No replication (Regional). Standard storage class. Uniform bucket-level access.
- **Secrets Management**: Google Secret Manager.
- **Background Worker**: Cloud Run Job (`spenza-outbox-worker`) invoked sparingly (e.g., via Cloud Scheduler every 15-30 minutes) to process `OutboxEvent` tables and dispatch Web Push notifications. Do not run a continuous worker service.

## Environment configuration

Secrets must be mounted to Cloud Run via Secret Manager integration. Never embed them in Docker images.

### Web Environment Variables
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk Public Key (Public)
- `NEXT_PUBLIC_API_URL`: URL of the deployed `spenza-api` (Public)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: Web Push VAPID Public Key (Public)
- `CLERK_SECRET_KEY`: Mounted via Secret Manager.

### API Environment Variables
- `NODE_ENV`: `production`
- `PORT`: 4000
- `ALLOWED_ORIGINS`: `https://your-spenza-web-domain.com`
- `RECEIPTS_BUCKET_NAME`: `spenza-receipts-prod`
- `DATABASE_URL`: Mounted via Secret Manager.
- `CLERK_SECRET_KEY`: Mounted via Secret Manager.
- `GROUP_INVITE_SECRET`: Server-only secret containing at least 32 random bytes, mounted via Google Secret Manager. Never expose it through a `NEXT_PUBLIC_*` variable or commit a real value.
- `VAPID_PRIVATE_KEY`: Mounted via Secret Manager.

## Containerization
Both apps use multi-stage Docker builds based on `node:20-alpine` with `pnpm` enabled.
The `apps/web` Dockerfile utilizes Next.js Standalone output for a minimal production footprint. The `apps/api` Dockerfile uses a non-root `appuser` for security.

## CI/CD Pipeline
GitHub Actions manages the CI/CD pipeline.
1. **CI**: Triggers on pull requests. Runs lint, typecheck, tests, Prisma validation, and builds to ensure repository integrity.
2. **Deploy**: Triggers on SemVer tags (`v*.*.*`). Authenticates to GCP via Workload Identity Federation (WIF). Builds and pushes images to Artifact Registry, executes database migrations via Cloud Run Jobs, and promotes Cloud Run Revisions.

## Storage Configuration
The GCS Bucket `spenza-receipts-prod` must have CORS configured to accept `PUT` and `GET` requests from the web origin. Application Default Credentials (ADC) attached to the `spenza-api` service account provides authorization without passing explicit JSON keys.

## Deployment Order

Execute deployment in this precise, controlled sequence:

1. Verify project billing and free-trial credits are active.
2. Create the Artifact Registry repository (`spenza`).
3. Configure IAM and Service Accounts (least privilege for Cloud Run).
4. Configure Secret Manager with all required secret strings.
5. Verify the Cloud SQL instance configuration matches the cost profile.
6. Create the private GCS receipts bucket.
7. Let GitHub Actions build the containers (`v1.0.0` tag).
8. Deploy the API to Cloud Run initially without user traffic.
9. Rehearse database migrations on a disposable local/staging PostgreSQL instance.
10. Review data reconciliation results from rehearsal.
11. Apply controlled migrations to target Cloud SQL (via Cloud Run Job or Proxy) *only after explicit approval*.
12. Deploy/update the API Cloud Run revision.
13. Deploy the Web Cloud Run revision.
14. Configure Clerk production redirect URLs.
15. Configure Web Push/VAPID in the frontend/backend.
16. Configure the notification Cloud Scheduler to invoke the Cloud Run Job.
17. Run smoke/E2E tests against the live deployment.
18. Test PWA installation on a mobile device.
19. Invite friends.
