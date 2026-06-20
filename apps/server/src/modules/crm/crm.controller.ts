import { Inject, Optional } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';
import { CrmControllerBase, applyControllerMixins } from './crm-controller.helpers';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { CrmService } from './crm.service';
import { CrmAccountController } from './controllers/crm-account.controller';
import { CrmInboxController } from './controllers/crm-inbox.controller';
import { CrmMailboxController } from './controllers/crm-mailbox.controller';
import { CrmSequenceController } from './controllers/crm-sequence.controller';
import { CrmSettingsController } from './controllers/crm-settings.controller';

/**
 * Compatibility shell for direct CrmController tests.
 * Route handlers now live in the coarse-grained CRM domain controllers.
 */
export interface CrmController
  extends CrmAccountController,
    CrmMailboxController,
    CrmSettingsController,
    CrmSequenceController,
    CrmInboxController {}

export class CrmController extends CrmControllerBase {
  constructor(
    @Inject(CrmService) crmService: CrmService,
    @Optional()
    @Inject(CrmGmailWatchService)
    gmailWatchService?: CrmGmailWatchService,
    @Optional()
    @Inject(AppConfigService)
    appConfigService?: AppConfigService
  ) {
    super(crmService, gmailWatchService, appConfigService);
  }
}

applyControllerMixins(CrmController, [
  CrmAccountController,
  CrmMailboxController,
  CrmSettingsController,
  CrmSequenceController,
  CrmInboxController
]);

export { CrmAccountController } from './controllers/crm-account.controller';
export { CrmInboxController } from './controllers/crm-inbox.controller';
export { CrmMailboxController } from './controllers/crm-mailbox.controller';
export { CrmSequenceController } from './controllers/crm-sequence.controller';
export { CrmSettingsController } from './controllers/crm-settings.controller';
