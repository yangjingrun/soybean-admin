# Module P - CRM List Query Indexes

## Reference Baseline

- Prisma official docs show compound indexes with `@@index([fieldA, fieldB])` and recommend indexing fields used in `where`, `orderBy`, and relations to improve query performance: <https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes>.
- Mature CRM/admin systems usually split member-owned views and organization-admin views, so list indexes need to cover both `organizationId + ownerUserId` and organization-wide filters.
- Local CRM rules keep member data private by owner, while organization admins can read broader organization lists.

## Finding

CRM list APIs commonly page by time while combining tenant, owner, status, and mailbox filters:

- Lead repository: `organizationId + ownerUserId? + status?`, ordered by `updatedAt desc`.
- Sequence review: `organizationId + ownerUserId? + status?`, ordered by `updatedAt desc`.
- Inbox threads: `organizationId + ownerUserId? + status? + mailboxId?`, ordered by `lastInboundAt desc`.

Existing indexes covered several common paths, but missed member status filtering on accounts, organization-admin sequence lists, and mailbox-filtered inbox thread lists.

## Adopted Shape

- Keep CRM controllers, services, stores, response shape, and permission behavior unchanged.
- Add B-tree compound indexes for list-query filters:
  - `CrmAccount`: `organizationId + ownerUserId + status + updatedAt`
  - `CrmSequenceEnrollment`: `organizationId + updatedAt`
  - `CrmSequenceEnrollment`: `organizationId + status + updatedAt`
  - `CrmInboxThread`: `organizationId + lastInboundAt`
  - `CrmInboxThread`: `organizationId + mailboxId + lastInboundAt`
  - `CrmInboxThread`: `organizationId + ownerUserId + mailboxId + lastInboundAt`
- Keep existing indexes for current query paths and avoid risky drops during development iteration.

## Not Adopted

- No keyword full-text or trigram index in this step. Current keyword filters use `contains` across multiple text fields and need a separate search design.
- No cursor-pagination migration. Existing API contract uses page/size and count.
- No CRM service/store split in this step. Query performance can be improved without moving business logic.

## Impact Boundary

- The migration only adds indexes and does not rewrite CRM data.
- Insert/update cost increases modestly on these tables, but the affected queries back core repeated dashboard/list workflows.
- Permission and owner scopes remain unchanged.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-list-indexes.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
pnpm --filter @soybean/server exec prisma validate --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server typecheck
git diff --check
```
