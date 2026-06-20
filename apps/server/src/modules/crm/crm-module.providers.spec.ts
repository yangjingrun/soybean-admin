import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CRM_ACCOUNT_REPOSITORY,
  CRM_AI_DRAFT_TASK_REPOSITORY,
  CRM_DASHBOARD_REPOSITORY,
  CRM_INBOX_REPOSITORY,
  CRM_MAILBOX_REPOSITORY,
  CRM_SEQUENCE_REPOSITORY,
  CRM_SETTINGS_REPOSITORY,
  CRM_STORE,
  CRM_SUPPRESSION_REPOSITORY
} from './crm.tokens';
import { crmRepositoryProviders } from './crm-module.providers';
import { CRM_PERSONA_PROFILE_REPOSITORY } from './persona-profiles/crm-persona-profile.repository';
import { CRM_PRODUCT_LINE_REPOSITORY } from './product-lines/crm-product-line.repository';
import { CRM_SEQUENCE_POLICY_REPOSITORY } from './sequence-policies/crm-sequence-policy.repository';
import { CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY } from './template-groups/crm-email-template-group.repository';

const domainRepositoryTokens = [
  CRM_ACCOUNT_REPOSITORY,
  CRM_SETTINGS_REPOSITORY,
  CRM_PRODUCT_LINE_REPOSITORY,
  CRM_PERSONA_PROFILE_REPOSITORY,
  CRM_SUPPRESSION_REPOSITORY,
  CRM_MAILBOX_REPOSITORY,
  CRM_SEQUENCE_REPOSITORY,
  CRM_AI_DRAFT_TASK_REPOSITORY,
  CRM_SEQUENCE_POLICY_REPOSITORY,
  CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY,
  CRM_INBOX_REPOSITORY,
  CRM_DASHBOARD_REPOSITORY
];

describe('crmRepositoryProviders', () => {
  it('keeps domain repositories behind their own adapter classes', () => {
    for (const token of domainRepositoryTokens) {
      const provider = crmRepositoryProviders.find(item => 'provide' in item && item.provide === token);

      assert.ok(provider, `missing provider for ${String(token)}`);
      assert.equal('useClass' in provider, true, `${String(token)} should use a repository class`);
      assert.equal('useExisting' in provider, false, `${String(token)} should not alias CRM_STORE`);
    }
  });

  it('keeps the legacy aggregate store as an internal adapter dependency', () => {
    const provider = crmRepositoryProviders.find(item => 'provide' in item && item.provide === CRM_STORE);

    assert.ok(provider);
    assert.equal('useClass' in provider, true);
  });
});
