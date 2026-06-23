import { CrmGmailWebhookController } from '../crm-gmail-webhook.controller';
import { CrmAccountController } from '../controllers/crm-account.controller';
import { CrmInboxController } from '../controllers/crm-inbox.controller';
import { CrmMailboxController } from '../controllers/crm-mailbox.controller';
import { CrmSequenceController } from '../controllers/crm-sequence.controller';
import { CrmSettingsController } from '../controllers/crm-settings.controller';
import { CrmTrackingController } from '../tracking/crm-tracking.controller';

export const crmControllers = [
  CrmAccountController,
  CrmMailboxController,
  CrmSettingsController,
  CrmSequenceController,
  CrmInboxController,
  CrmGmailWebhookController,
  CrmTrackingController
];
