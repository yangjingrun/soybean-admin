import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatArchivedFingerprintTypeLabel,
  getArchivedFingerprintMatchEvents,
  getLeadTimelineItemType,
  readArchivedFingerprintMatches,
  createDefaultLeadImportForm,
  normalizeLeadImportPayload
} from './shared';

describe('crm lead shared helpers', () => {
  it('creates an empty manual lead import form', () => {
    assert.deepEqual(createDefaultLeadImportForm(), {
      name: '',
      websiteUrl: '',
      country: '',
      customerType: '',
      contactFullName: '',
      contactTitle: '',
      contactEmail: ''
    });
  });

  it('normalizes manual lead import payload and omits empty contact data', () => {
    assert.deepEqual(
      normalizeLeadImportPayload({
        name: '  ABC Trading  ',
        websiteUrl: ' https://abc.example ',
        country: ' AE ',
        customerType: ' distributor ',
        contactFullName: '',
        contactTitle: ' ',
        contactEmail: ''
      }),
      {
        name: 'ABC Trading',
        websiteUrl: 'https://abc.example',
        country: 'AE',
        customerType: 'distributor'
      }
    );
  });

  it('normalizes manual lead import contact fields when any contact field exists', () => {
    assert.deepEqual(
      normalizeLeadImportPayload({
        name: 'ABC Trading',
        websiteUrl: '',
        country: '',
        customerType: '',
        contactFullName: ' Ali Hassan ',
        contactTitle: ' Buyer ',
        contactEmail: ' ali@example.com '
      }),
      {
        name: 'ABC Trading',
        websiteUrl: '',
        country: '',
        customerType: '',
        contact: {
          fullName: 'Ali Hassan',
          title: 'Buyer',
          email: 'ali@example.com'
        }
      }
    );
  });

  it('extracts archived fingerprint match events from account timeline', () => {
    const events = [
      createTimelineEvent({ id: 'event-1', eventType: 'account_imported' }),
      createTimelineEvent({
        id: 'event-2',
        eventType: 'archived_fingerprint_matched',
        metadata: {
          matchedFingerprints: [
            {
              fingerprintType: 'domain',
              maskedValue: 'buyer.example',
              archivedAt: '2026-06-18T09:00:00.000Z',
              accountName: 'Archived Buyer'
            }
          ]
        }
      })
    ];

    assert.deepEqual(
      getArchivedFingerprintMatchEvents(events).map(event => event.id),
      ['event-2']
    );
    assert.deepEqual(readArchivedFingerprintMatches(events[1]), [
      {
        fingerprintType: 'domain',
        maskedValue: 'buyer.example',
        archivedAt: '2026-06-18T09:00:00.000Z',
        accountName: 'Archived Buyer'
      }
    ]);
  });

  it('formats archived fingerprint timeline display helpers', () => {
    assert.equal(formatArchivedFingerprintTypeLabel('domain'), '域名');
    assert.equal(formatArchivedFingerprintTypeLabel('email_hash'), '邮箱');
    assert.equal(getLeadTimelineItemType(createTimelineEvent({ eventType: 'archived_fingerprint_matched' })), 'warning');
    assert.equal(getLeadTimelineItemType(createTimelineEvent({ eventType: 'note_added' })), 'default');
  });
});

function createTimelineEvent(input: Partial<Api.Crm.LeadTimelineEvent> = {}): Api.Crm.LeadTimelineEvent {
  return {
    id: input.id ?? 'event-1',
    organizationId: input.organizationId ?? 'org-1',
    accountId: input.accountId ?? 'account-1',
    contactId: input.contactId ?? null,
    ownerUserId: input.ownerUserId ?? 'user-1',
    eventType: input.eventType ?? 'note_added',
    title: input.title ?? '备注',
    content: input.content ?? null,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? '2026-06-19T00:00:00.000Z'
  };
}
