export const crmSendQueueName = 'crm-email-send';

export const crmSendRemoveOnFail = {
  age: 7 * 24 * 60 * 60,
  count: 1000
} as const;
