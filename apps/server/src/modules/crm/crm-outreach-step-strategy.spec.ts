import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crmOutreachStepStrategies, getCrmOutreachStepStrategy } from './crm-outreach-step-strategy';

describe('crm-outreach-step-strategy', () => {
  it('defines five distinct outreach step duties from the sending guide', () => {
    assert.equal(crmOutreachStepStrategies.length, 5);
    assert.equal(getCrmOutreachStepStrategy(1).taskKey, 'relevance');
    assert.equal(getCrmOutreachStepStrategy(2).taskKey, 'product_decision');
    assert.equal(getCrmOutreachStepStrategy(3).taskKey, 'risk_validation');
    assert.equal(getCrmOutreachStepStrategy(4).taskKey, 'role_choice');
    assert.equal(getCrmOutreachStepStrategy(5).taskKey, 'polite_close');
  });

  it('keeps weak follow-up wording out of default follow-up templates', () => {
    const bodies = crmOutreachStepStrategies.map(step => step.bodyTemplate).join('\n');

    assert.doesNotMatch(bodies, /just following up|checking in|bumping/i);
    assert.match(getCrmOutreachStepStrategy(2).bodyTemplate, /one current designation|cross-reference/i);
    assert.match(
      getCrmOutreachStepStrategy(3).bodyTemplate,
      /verification route|sample|dimensional check|supplier documents/i
    );
    assert.match(getCrmOutreachStepStrategy(4).bodyTemplate, /Which is closer|A letter is enough/i);
    assert.doesNotMatch(bodies, /2-3 regular options|short product overview|short product list/i);
  });

  it('does not expose raw customer type labels in default templates', () => {
    const bodies = crmOutreachStepStrategies.map(step => step.bodyTemplate).join('\n');

    assert.doesNotMatch(bodies, /\{\{account\.customerType\}\}/);
    assert.doesNotMatch(bodies, /\bFor distributors\b|\bSome distributors\b|\bworks in distributor\b/i);
    assert.match(getCrmOutreachStepStrategy(1).bodyTemplate, /\{\{contact\.firstTouchScenario\}\}/);
    assert.match(getCrmOutreachStepStrategy(1).bodyTemplate, /\{\{product\.modelSample\}\}/);
    assert.match(getCrmOutreachStepStrategy(2).bodyTemplate, /\{\{product\.modelSample\}\}/);
  });

  it('uses the Day 1/3/7/12/18 cadence and makes step five a normal polite close', () => {
    assert.deepEqual(
      crmOutreachStepStrategies.map(step => step.defaultDelayDays),
      [0, 3, 7, 12, 18]
    );

    const step5 = getCrmOutreachStepStrategy(5);

    assert.equal(step5.defaultContinuousFollowUp, false);
    assert.equal(step5.requiresNewSignal, false);
    assert.deepEqual(step5.wordRange, { min: 35, max: 65 });
  });

  it('passes explicit execution constraints for follow-up AI generation', () => {
    const step2 = getCrmOutreachStepStrategy(2);
    const step3 = getCrmOutreachStepStrategy(3);
    const step4 = getCrmOutreachStepStrategy(4);
    const step5 = getCrmOutreachStepStrategy(5);

    assert.match(step2.mustAvoid.join('\n'), /full product catalogs|mixed-language model descriptions/i);
    assert.match(step2.ctaInstruction, /one designation|one replacement item|one series coverage/i);
    assert.match(step3.mustAvoid.join('\n'), /invent ISO|customer references/i);
    assert.match(step3.ctaInstruction, /proof_review|sample_or_trial|micro_input/i);
    assert.match(step4.mustDo.join('\n'), /A\/B\/C\/D\/E|wrong-contact|not-reviewing-now/i);
    assert.match(step4.mustAvoid.join('\n'), /full catalog|open-ended/i);
    assert.match(step4.selfCheck.join('\n'), /wrong-contact option|not-now option/i);
    assert.match(step5.mustAvoid.join('\n'), /guilt|urgency|last chance/i);
    assert.match(step5.ctaInstruction, /close_loop|timing_check|redirect/i);
    assert.match(step5.selfCheck.join('\n'), /signals end of this sequence/i);
  });
});
