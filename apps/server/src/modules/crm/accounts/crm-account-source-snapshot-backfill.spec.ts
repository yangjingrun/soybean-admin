import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { backfillCrmAccountSourceSnapshots } from './crm-account-source-snapshot-backfill';

describe('crm-account-source-snapshot-backfill', () => {
  it('matches imported accounts to AI lead task candidates and backfills crawler evidence', async () => {
    const updates: Array<{ id: string; sourceSnapshot: Record<string, unknown> }> = [];
    const summary = await backfillCrmAccountSourceSnapshots({
      async findAccountsMissingSourceSnapshot() {
        return [
          {
            id: 'account-1',
            sourceTaskId: 'task-1',
            name: 'ABC Bearing LLC',
            normalizedName: 'abc bearing llc',
            domain: 'abc.example',
            websiteUrl: 'https://abc.example'
          }
        ];
      },
      async findTasksByIds(ids: string[]) {
        assert.deepEqual(ids, ['task-1']);

        return [
          {
            id: 'task-1',
            productLineSnapshot: {
              id: 'product-line-1',
              name: 'Deep groove ball bearings',
              targetCustomerType: '进口商和经销商',
              commonModelsText: '6203, 6204'
            },
            result: {
              candidates: [
                {
                  title: 'ABC Bearing LLC',
                  website: 'https://abc.example',
                  websiteEvidence: {
                    crawlStatus: 'completed',
                    socialLinks: ['https://www.linkedin.com/company/abc-bearing'],
                    whatsappLinks: ['https://wa.me/971501234567']
                  }
                }
              ]
            }
          }
        ];
      },
      async updateAccountSourceSnapshot(id: string, sourceSnapshot: Record<string, unknown>) {
        updates.push({ id, sourceSnapshot });
      }
    });

    assert.equal(summary.scannedAccountCount, 1);
    assert.equal(summary.updatedCount, 1);
    assert.deepEqual(updates, [
      {
        id: 'account-1',
        sourceSnapshot: {
          website: 'https://abc.example',
          productLine: {
            id: 'product-line-1',
            name: 'Deep groove ball bearings',
            targetCustomerType: '进口商和经销商',
            commonModelsText: '6203, 6204'
          },
          websiteEvidence: {
            crawlStatus: 'completed',
            socialLinks: ['https://www.linkedin.com/company/abc-bearing'],
            whatsappLinks: ['https://wa.me/971501234567']
          }
        }
      }
    ]);
  });
});
