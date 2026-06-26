# CRM Email Open Tracking Design

## Goal

Add CRM email open tracking so the first tracked open of a sent CRM message creates a system notification that the owner can open and land on the related email sequence record.

## Scope

- Track email opens through a 1x1 transparent image embedded in sent HTML email.
- Reuse the existing `SystemNotification` polling flow, so the frontend can show the notification within the current 5 second polling interval.
- Store one aggregate open record per CRM message with first open time, last open time and open count.
- Create a notification only for the first open of each message.
- Route notification actions to `/crm/email-sequences` with `focus`, `enrollmentId`, `messageId` and `eventId` query parameters.

## Architecture

- `CrmTrackingTokenService` signs and verifies compact tracking tokens. Tokens contain only the CRM message id and are signed with `CRM_TRACKING_TOKEN_SECRET`.
- `CrmTrackingService` records one email-open aggregate, writes a CRM timeline event for the first open, and creates a system notification for the message owner.
- `CrmTrackingController` exposes `GET /crm/tracking/open/:token` without auth and always returns a transparent gif for valid opens.
- `CrmEmailSendGateway` sends `multipart/alternative` email when tracking context exists: plain text remains available, HTML includes escaped body text and the tracking pixel.
- `CrmSendWorkerService` provides tracking context when `CRM_TRACKING_PUBLIC_BASE_URL` and `CRM_TRACKING_TOKEN_SECRET` are configured.
- `useEmailSequenceTable` reads tracking focus query parameters and opens the related sequence detail with the target message selected.

## Data

`CrmEmailOpenEvent` stores:

- `organizationId`, `ownerUserId`, `accountId`, `contactId`, `enrollmentId`, `messageId`
- `openCount`
- `firstOpenedAt`, `lastOpenedAt`
- `lastUserAgent`, `lastIpAddress`
- timestamps

The table is unique by `messageId`, because one CRM message owns one aggregate open-tracking record.

## Notes

Open tracking is a weak signal because mailbox image loading, proxies, and security scanners can create false negatives or false positives. UI copy should say "可能打开" instead of absolute "已打开".
