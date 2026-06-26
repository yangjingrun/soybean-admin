import type { CrmInboxMessageType } from './crm.types';

const strongUnsubscribeReplyPatterns = [
  /\bunsubscribe\b/i,
  /\bremove\s+me\b/i,
  /\bdo\s+not\s+contact\b/i,
  /\bdon't\s+contact\b/i,
  /退订/,
  /取消订阅/,
  /不要再联系/,
  /停止联系/
];
const weakUnsubscribeReplyPatterns = [/\bstop\b/i, /\bnot\s+interested\b/i];
const bounceReplyPatterns = [
  /delivery status notification/i,
  /delivery failure/i,
  /delivery failed/i,
  /undeliver(?:ed|able)/i,
  /returned mail/i,
  /\bmailer-daemon\b/i,
  /\bpostmaster\b/i,
  /diagnostic-code:\s*smtp/i,
  /\b550\s+5\.1\.1\b/i,
  /\buser unknown\b/i,
  /\bmailbox unavailable\b/i
];

/** Classifies inbound customer-side messages before CRM inbox persistence. */
export function classifyCustomerReplyMessage(subject: string, bodyText: string): CrmInboxMessageType {
  const content = `${subject}\n${bodyText}`;
  if (strongUnsubscribeReplyPatterns.some(pattern => pattern.test(content))) {
    return 'unsubscribe_hint';
  }

  if (weakUnsubscribeReplyPatterns.some(pattern => pattern.test(content))) {
    return 'unsubscribe_review_pending';
  }

  return bounceReplyPatterns.some(pattern => pattern.test(content)) ? 'bounce' : 'customer_reply';
}
