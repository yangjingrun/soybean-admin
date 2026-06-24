import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCrmAiWritingModules } from './crm-ai-writing-module-resolver';

describe('crm-ai-writing-module-resolver', () => {
  it('selects base modules for the first outreach email', () => {
    const modules = resolveCrmAiWritingModules({
      stepIndex: 1,
      contactTitle: null,
      account: { country: null, city: null, timeZone: null },
      previousMessages: []
    });

    assert.deepEqual(
      modules.map(item => item.promptKey),
      [
        'crm_outreach_base_rules',
        'crm_outreach_cold_email_core',
        'crm_outreach_sequence_strategy',
        'crm_outreach_public_source_grounding',
        'crm_outreach_subject_line',
        'crm_outreach_deliverability_guard',
        'crm_outreach_output_contract'
      ]
    );
  });

  it('selects follow-up, procurement role, and region modules when context supports them', () => {
    const modules = resolveCrmAiWritingModules({
      stepIndex: 2,
      contactTitle: 'Senior Sourcing Manager',
      account: { country: 'SA', city: 'Riyadh', timeZone: 'Asia/Riyadh' },
      previousMessages: [{ stepIndex: 1, subject: 'Bearing fit', bodyText: 'First note.' }]
    });

    assert.equal(modules.some(item => item.promptKey === 'crm_outreach_role_persona'), true);
    assert.equal(modules.some(item => item.promptKey === 'crm_outreach_region_localization'), true);
    assert.match(modules.find(item => item.promptKey === 'crm_outreach_role_persona')?.reason || '', /procurement/i);
    assert.match(modules.find(item => item.promptKey === 'crm_outreach_sequence_strategy')?.reason || '', /follow-up/i);
  });

  it('keeps unknown titles cautious instead of over-assuming a persona', () => {
    const modules = resolveCrmAiWritingModules({
      stepIndex: 1,
      contactTitle: 'Team',
      account: { country: null, city: null, timeZone: null },
      previousMessages: []
    });

    assert.equal(modules.some(item => item.promptKey === 'crm_outreach_role_persona'), true);
    assert.match(modules.find(item => item.promptKey === 'crm_outreach_role_persona')?.reason || '', /unknown/i);
  });
});
