# Spenza Groups & Memberships Report

**Date:** August 6, 2026  
**Milestone:** Milestone 7 — Groups and Memberships for Spenza

---

## Outcome

Milestone 7 migrated Spenza's Groups and Memberships management onto the authenticated Express `/v1` API while preserving the existing responsive Next.js web application experience.

Authorization uses the authenticated internal Spenza user (`actorUserId`) resolved from the verified Clerk identity (`clerkSubjectId`). Requests never authorize using browser-supplied user IDs or email addresses.

---

## Shared Contracts Added (`packages/contracts`)

* `CreateGroupSchema` / `CreateGroupInput`: Group creation DTO validating `name` (2-100 chars), `description` (optional, max 500 chars), `currency` (3-letter ISO code, default `"USD"`), and `imageUrl`.
* `UpdateGroupSchema` / `UpdateGroupInput`: Group update DTO validating `name`, `description`, `imageUrl`, `currency`, and `isArchived`.
* `GroupMemberUserSchema`: User subset representation for members (`id`, `name`, `email`, `image`).
* `GroupMemberResponseSchema`: Member representation including `id`, `groupId`, `userId`, `role` (`ADMIN` | `MEMBER`), `isFavorite`, `createdAt`, and `user`.
* `GroupResponseSchema`: Complete group representation with `id`, `name`, `description`, `imageUrl`, `currency`, `inviteLink`, `isArchived`, `createdAt`, `updatedAt`, `members`, and optional `_count.expenses`.
* `AddGroupMemberSchema` / `AddGroupMemberInput`: Email-based member addition DTO.

---

## API Endpoints Implemented (`apps/api`)

* **`POST /v1/groups`**: Creates a group. Transactionally creates creator `GroupMember` with `role: "ADMIN"` and logs a `GROUP_CREATED` `Activity` record.
* **`GET /v1/groups`**: Lists all active (`isArchived: false`) groups where the authenticated user is a member.
* **`GET /v1/groups/:groupId`**: Gets group details. Object-level authorization checks that the authenticated user is a member. Non-members receive a `404 Not Found` error envelope to avoid IDOR resource existence leakage.
* **`PATCH /v1/groups/:groupId`**: Updates group details. Object-level authorization checks that the authenticated user is a group `ADMIN`. Non-admins receive `403 Forbidden`.
* **`POST /v1/groups/:groupId/members`**: Adds a member by email. Requires `ADMIN` role. Resolves user by email, creates `GroupMember`, and logs `USER_JOINED` `Activity`.
* **`DELETE /v1/groups/:groupId/members/:userId`**: Removes a member or leaves the group. Removing other members requires `ADMIN` role. Sole admins cannot leave a group with other members without appointing another admin first (`409 Conflict`). Removing a member does not delete historical expenses or financial records.
* **`POST /v1/groups/:groupId/leave`**: Endpoint for leaving a group.

---

## Authorization & Repository/Service Architecture

```text
apps/api/src/
├── groups/
│   ├── group-repository.ts    # PrismaGroupRepository (findGroupById, findGroupsByUserId, createGroup, updateGroup, addMember, removeMember, countAdmins, findUserByEmail, createActivity)
│   ├── group-service.ts       # GroupService (object-level authorization, role checks, sole-admin protection, DTO serialization)
│   └── group-composition.ts   # GroupService & GroupRepository instantiation with Prisma Client
└── routes/
    └── groups.ts              # Express router for /v1/groups endpoints using Zod contract validation
```

### Authorization Rules Enforced
1. **Creator Immutability:** Group creation always assigns the authenticated `actorUserId` as creator/admin. Browser-supplied creator IDs are ignored.
2. **Read Access:** Only members can read group details.
3. **Admin Privilege:** Updating group metadata or adding/removing other members requires `ADMIN` role.
4. **Sole-Admin Guard:** The sole `ADMIN` of a multi-member group cannot leave without appointing another admin first.
5. **Historical Retention:** Member removal deletes only the `GroupMember` row; historical expenses, splits, and settlements remain intact.

---

## Web Client Integration (`apps/web`)

* **`apps/web/src/lib/api-client.ts`**: Standard fetch wrapper with base URL handling and error envelope decoding.
* **`apps/web/src/lib/api-groups.ts`**: Client API functions (`fetchGroups`, `fetchGroupById`, `createGroupApi`, `updateGroupApi`, `addGroupMemberApi`, `leaveGroupApi`).
* **`apps/web/src/components/groups/create-group-dialog.tsx`**: Updated to use `createGroupApi` with TanStack Query mutation and cache invalidation.
* **`apps/web/src/app/(dashboard)/dashboard/groups/page.tsx`**: Updated `useQuery` to fetch `/v1/groups` via `fetchGroups()`.

---

## Legacy Code Status

* **`apps/web/src/actions/groups.ts`**: Retained as legacy Server Action code. Direct call sites in `create-group-dialog.tsx` and `groups/page.tsx` were replaced by `/v1` API integrations.

---

## Automated Test Coverage (`apps/api`)

12 Vitest + Supertest integration tests added in `apps/api/src/__tests__/groups.test.ts`:
* Unauthenticated `/v1/groups` returns `401 Unauthorized`.
* `POST /v1/groups` creates group with creator as `ADMIN`.
* `POST /v1/groups` rejects malformed payloads (`400 Validation Error`).
* `GET /v1/groups` returns only groups visible to authenticated actor.
* `GET /v1/groups/:groupId` returns group details for member.
* `GET /v1/groups/:groupId` hides non-member groups with `404`.
* `PATCH /v1/groups/:groupId` allows admin to update group.
* `PATCH /v1/groups/:groupId` rejects non-admin update (`403 Forbidden`).
* `POST /v1/groups/:groupId/members` adds member by email.
* `DELETE /v1/groups/:groupId/members/:userId` allows member removal.
* `POST /v1/groups/:groupId/leave` allows member to leave group.
* `POST /v1/groups/:groupId/leave` rejects sole admin departure (`409 Conflict`).

---

## Full Verification Results

| Command | Status | Notes |
| :--- | :--- | :--- |
| `pnpm lint` | **PASS** | 0 errors across all workspace projects. |
| `pnpm typecheck` | **PASS** | Strict TypeScript check passed across `@spenza/web`, `@spenza/contracts`, and `@spenza/api`. |
| `pnpm test` | **PASS** | 41 tests passed across 5 test suites in `@spenza/api`. |
| `pnpm build:api` | **PASS** | `tsc` compiled `@spenza/api` to `dist/`. |
| `pnpm build:web` | **PASS** | Next.js 16.3.0 compiled cleanly (11 static/dynamic routes). |
| `pnpm prisma:validate` | **PASS** | `apps/web/prisma/schema.prisma` is valid. |

---

## Schema & Migration Changes

* **Prisma Schema:** Unchanged. Existing `Group`, `GroupMember`, `GroupRole`, and `Activity` models were sufficient for Milestone 7.
* **Migrations:** No new database migrations were generated or executed.

---

## Confirmation

* **No database migrations were executed against remote Cloud SQL.**
* **Clerk identity architecture and `clerkSubjectId` schema field were preserved.**
* **Financial calculation logic, minor units, and expense engines were unchanged.**
* **No Git commits were created.**
