import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDefaultLeadImportForm, normalizeLeadImportPayload } from './shared';

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
});
