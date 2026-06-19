import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '../../../generated/prisma/client';
import type { CrmEmailTemplateStepInput, CrmStore } from '../crm.types';
import { PrismaCrmStore } from './prisma-crm.store';

describe('PrismaCrmStore', () => {
  it('creates and lists accounts through Prisma with organization scope', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.createAccount({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'ABC Trading',
      normalizedName: 'abc trading',
      websiteUrl: 'https://abc.example',
      domain: 'abc.example',
      country: 'AE',
      customerType: 'distributor',
      status: 'missing_contact',
      sourceTaskId: 'task-1'
    });
    const result = await store.listAccounts({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      skip: 0,
      take: 20
    });

    assert.equal(prisma.crmAccount.createCalls[0].data.organizationId, 'org-1');
    assert.deepEqual(prisma.crmAccount.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.equal(result.total, 1);
  });

  it('builds keyword and status account filters without dropping organization scope', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.listAccounts({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      skip: 0,
      take: 20,
      keyword: 'bearing',
      status: 'ready'
    });

    assert.deepEqual(prisma.crmAccount.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'ready',
      OR: [
        { name: { contains: 'bearing', mode: 'insensitive' } },
        { domain: { contains: 'bearing', mode: 'insensitive' } },
        { websiteUrl: { contains: 'bearing', mode: 'insensitive' } },
        { country: { contains: 'bearing', mode: 'insensitive' } },
        { customerType: { contains: 'bearing', mode: 'insensitive' } }
      ]
    });
  });

  it('lists and slims archived accounts after the recovery window', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    const archivedBefore = new Date('2026-05-20T00:00:00.000Z');
    const slimmedAt = new Date('2026-06-19T00:00:00.000Z');

    await store.listAccountsForArchiveSlimming({
      archivedBefore,
      take: 100
    });
    await store.slimArchivedAccount({
      id: 'account-1',
      organizationId: 'org-1',
      archivedBefore,
      slimmedAt
    });

    assert.deepEqual(prisma.crmAccount.findManyCalls.at(-1), {
      where: {
        status: 'archived',
        archiveSlimmedAt: null,
        archivedAt: {
          lte: archivedBefore
        }
      },
      orderBy: { archivedAt: 'asc' },
      take: 100
    });
    assert.deepEqual(prisma.crmAccount.updateManyAndReturnCalls[0], {
      where: {
        id: 'account-1',
        organizationId: 'org-1',
        status: 'archived',
        archiveSlimmedAt: null,
        archivedAt: {
          lte: archivedBefore
        }
      },
      data: {
        archiveSlimmedAt: slimmedAt,
        customerType: null,
        websiteUrl: null
      },
      limit: 1
    });
  });

  it('returns the existing account when concurrent create hits a unique conflict', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    prisma.crmAccount.createError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test'
    });

    const account = await store.createAccount({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'ABC Trading',
      normalizedName: 'abc trading',
      websiteUrl: 'https://abc.example',
      domain: 'abc.example',
      country: 'AE',
      customerType: 'distributor',
      status: 'missing_contact',
      sourceTaskId: 'task-1'
    });

    assert.equal(account.id, 'account-1');
    assert.deepEqual(prisma.crmAccount.findUniqueCalls[0].where, {
      organizationId_ownerUserId_domain: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        domain: 'abc.example'
      }
    });
  });

  it('finds a fresh global email verification cache by email hash', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const cache = await store.findEmailVerificationCache({ emailHash: 'email-hash-1' });

    assert.equal(cache?.status, 'valid');
    assert.deepEqual(prisma.crmEmailVerificationCache.findUniqueCalls[0].where, {
      emailHash: 'email-hash-1'
    });
  });

  it('upserts a global email verification cache by email hash', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const cache = await store.upsertEmailVerificationCache({
      emailHash: 'email-hash-1',
      maskedEmail: 'a***@example.com',
      domain: 'example.com',
      status: 'valid',
      reason: 'mx_found',
      verifiedAt: new Date('2026-06-18T09:00:00.000Z'),
      expiresAt: new Date('2026-07-18T09:00:00.000Z'),
      checkedById: 'user-1',
      checkedByName: 'Alice'
    });

    assert.equal(cache.reason, 'mx_found');
    assert.deepEqual(prisma.crmEmailVerificationCache.upsertCalls[0].where, {
      emailHash: 'email-hash-1'
    });
    assert.equal(prisma.crmEmailVerificationCache.upsertCalls[0].create.status, 'valid');
    assert.equal(prisma.crmEmailVerificationCache.upsertCalls[0].update.reason, 'mx_found');
  });

  it('reads and saves CRM global config with normalized cooldown days', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const current = await store.getGlobalConfig();
    const saved = await store.saveGlobalConfig({
      emailVerificationCooldownDays: 45,
      updatedById: 'super-1',
      updatedByName: 'Super Admin'
    });

    assert.equal(current.emailVerificationCooldownDays, 30);
    assert.deepEqual(current.followUpDelayDays, { step2Days: 3, step3Days: 7, step4Days: 14, step5Days: 21 });
    assert.equal(saved.emailVerificationCooldownDays, 45);
    assert.deepEqual(saved.followUpDelayDays, { step2Days: 3, step3Days: 7, step4Days: 14, step5Days: 21 });
    assert.deepEqual(prisma.crmGlobalConfig.findUniqueCalls[0].where, { configKey: 'default' });
    assert.deepEqual(prisma.crmGlobalConfig.upsertCalls[0].where, { configKey: 'default' });
    assert.equal(prisma.crmGlobalConfig.upsertCalls[0].create.emailVerificationCooldownDays, 45);
    assert.equal(prisma.crmGlobalConfig.upsertCalls[0].create.followUpDelayDaysText, '3,7,14,21');
  });

  it('reads and saves organization CRM permission config', async () => {
    const prisma = createPrisma({ organizationConfig: createPrismaOrganizationConfig() });
    const store = new PrismaCrmStore(prisma as never);

    const current = await store.getOrganizationConfig('org-1');
    const saved = await store.saveOrganizationConfig({
      organizationId: 'org-1',
      allowAdminViewMemberEmailBody: true,
      updatedById: 'user-1',
      updatedByName: 'Alice'
    });

    assert.equal(current?.allowAdminViewMemberEmailBody, false);
    assert.equal(saved.allowAdminViewMemberEmailBody, true);
    assert.deepEqual(prisma.crmOrganizationConfig.findUniqueCalls[0].where, { organizationId: 'org-1' });
    assert.deepEqual(prisma.crmOrganizationConfig.upsertCalls[0].where, { organizationId: 'org-1' });
    assert.equal(prisma.crmOrganizationConfig.upsertCalls[0].create.allowAdminViewMemberEmailBody, true);
    assert.equal(prisma.crmOrganizationConfig.upsertCalls[0].update.updatedByName, 'Alice');
  });

  it('creates, lists, updates and sets default organization email template groups', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    const steps = createEmailTemplateSteps();

    const created = await store.createEmailTemplateGroup({
      organizationId: 'org-1',
      name: 'Distributor follow-up',
      language: 'en',
      description: 'Default distributor sequence',
      status: 'active',
      isDefault: false,
      steps,
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const listed = await store.listEmailTemplateGroups({
      organizationId: 'org-1',
      keyword: 'distributor',
      status: 'active',
      skip: 0,
      take: 10
    });
    const updated = await store.updateEmailTemplateGroup('template-group-1', 'org-1', {
      name: 'Updated distributor follow-up',
      steps
    });
    const defaultGroup = await store.setDefaultEmailTemplateGroup('template-group-1', 'org-1');

    assert.equal(created.steps.length, 5);
    assert.equal(listed.records[0].organizationId, 'org-1');
    assert.equal(updated?.name, 'Updated distributor follow-up');
    assert.equal(defaultGroup?.isDefault, true);
    assert.equal(prisma.crmEmailTemplateGroup.createCalls[0].data.organizationId, 'org-1');
    assert.deepEqual(prisma.crmEmailTemplateGroup.findManyCalls[0].where, {
      organizationId: 'org-1',
      status: 'active',
      OR: [
        { name: { contains: 'distributor', mode: 'insensitive' } },
        { description: { contains: 'distributor', mode: 'insensitive' } }
      ]
    });
    assert.equal(prisma.crmEmailTemplateGroup.updateManyAndReturnCalls[0].where.organizationId, 'org-1');
    assert.equal(prisma.crmEmailTemplateStep.deleteManyCalls[0].where.templateGroupId, 'template-group-1');
    assert.equal(prisma.crmEmailTemplateStep.createManyCalls[0].data.length, 5);
    assert.deepEqual(prisma.crmEmailTemplateGroup.updateManyCalls[0].where, {
      organizationId: 'org-1',
      id: { not: 'template-group-1' },
      isDefault: true
    });
  });

  it('creates, lists, updates and sets default organization sequence policies', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    const steps = [
      { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' as const },
      { stepIndex: 2, delayDays: 2, threadMode: 'same_thread' as const },
      { stepIndex: 3, delayDays: 5, threadMode: 'new_subject' as const },
      { stepIndex: 4, delayDays: 9, threadMode: 'new_subject' as const },
      { stepIndex: 5, delayDays: 14, threadMode: 'new_subject' as const }
    ];

    const created = await store.createSequencePolicy({
      organizationId: 'org-1',
      name: 'Fast follow-up',
      description: 'Shorter first week',
      status: 'active',
      isDefault: false,
      steps,
      linkPolicy: 'block_new_links',
      allowLowRiskAutoSend: true,
      sameCompanyContactStrategy: 'single_active_per_company',
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const listed = await store.listSequencePolicies({
      organizationId: 'org-1',
      keyword: 'fast',
      status: 'active',
      skip: 0,
      take: 10
    });
    const updated = await store.updateSequencePolicy('policy-1', 'org-1', {
      name: 'Updated fast follow-up',
      steps
    });
    const defaultPolicy = await store.setDefaultSequencePolicy('policy-1', 'org-1');

    assert.equal(created.steps[1].delayDays, 2);
    assert.equal(created.linkPolicy, 'block_new_links');
    assert.equal(listed.records[0].organizationId, 'org-1');
    assert.equal(updated?.name, 'Updated fast follow-up');
    assert.equal(defaultPolicy?.isDefault, true);
    assert.equal(prisma.crmSequencePolicy.createCalls[0].data.stepDelayDaysText, '0,2,5,9,14');
    assert.equal(
      prisma.crmSequencePolicy.createCalls[0].data.stepThreadModesText,
      'new_subject,same_thread,new_subject,new_subject,new_subject'
    );
    assert.deepEqual(prisma.crmSequencePolicy.findManyCalls[0].where, {
      organizationId: 'org-1',
      status: 'active',
      OR: [
        { name: { contains: 'fast', mode: 'insensitive' } },
        { description: { contains: 'fast', mode: 'insensitive' } }
      ]
    });
    assert.deepEqual(prisma.crmSequencePolicy.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        id: { not: 'policy-1' },
        isDefault: true
      },
      data: { isDefault: false }
    });
  });

  it('finds organization blacklist entries by organization and email hash', async () => {
    const prisma = createPrisma({ blacklistEntry: createPrismaBlacklist() });
    const store = new PrismaCrmStore(prisma as never);

    const entry = await store.findBlacklistEntry({
      organizationId: 'org-1',
      emailHash: 'hash-1'
    });

    assert.equal(entry?.reason, 'unsubscribe');
    assert.deepEqual(prisma.crmBlacklist.findUniqueCalls[0].where, {
      organizationId_emailHash: {
        organizationId: 'org-1',
        emailHash: 'hash-1'
      }
    });
  });

  it('upserts organization blacklist entries by organization and email hash', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const entry = await store.upsertBlacklistEntry({
      organizationId: 'org-1',
      emailHash: 'hash-1',
      maskedEmail: 'a***@example.com',
      reason: 'unsubscribe',
      sourceAccountId: 'account-1',
      sourceContactId: 'contact-1',
      sourceMessageId: 'inbox-message-1',
      createdById: 'user-1',
      createdByName: 'Alice'
    });

    assert.equal(entry.emailHash, 'hash-1');
    assert.deepEqual(prisma.crmBlacklist.upsertCalls[0].where, {
      organizationId_emailHash: {
        organizationId: 'org-1',
        emailHash: 'hash-1'
      }
    });
    assert.equal(prisma.crmBlacklist.upsertCalls[0].create.sourceMessageId, 'inbox-message-1');
  });

  it('lists organization blacklist entries by keyword without exposing other organizations', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.listBlacklistEntries({
      organizationId: 'org-1',
      keyword: 'alice',
      skip: 0,
      take: 20
    });

    assert.deepEqual(prisma.crmBlacklist.findManyCalls[0], {
      where: {
        organizationId: 'org-1',
        OR: [
          { maskedEmail: { contains: 'alice', mode: 'insensitive' } },
          { createdByName: { contains: 'alice', mode: 'insensitive' } }
        ]
      },
      skip: 0,
      take: 20,
      orderBy: { updatedAt: 'desc' }
    });
    assert.deepEqual(prisma.crmBlacklist.countCalls[0], {
      where: prisma.crmBlacklist.findManyCalls[0].where
    });
  });

  it('deletes one organization blacklist entry by scoped id', async () => {
    const prisma = createPrisma({ blacklistEntry: createPrismaBlacklist() });
    const store = new PrismaCrmStore(prisma as never);

    const entry = await store.deleteBlacklistEntry({
      id: 'blacklist-1',
      organizationId: 'org-1'
    });

    assert.equal(entry?.id, 'blacklist-1');
    assert.deepEqual(prisma.crmBlacklist.findFirstCalls[0].where, {
      id: 'blacklist-1',
      organizationId: 'org-1'
    });
    assert.deepEqual(prisma.crmBlacklist.deleteCalls[0].where, {
      id: 'blacklist-1'
    });
  });

  it('finds archived fingerprints by organization and requested fingerprint pairs', async () => {
    const prisma = createPrisma({
      archivedFingerprintResults: [
        createPrismaArchivedFingerprint({ fingerprintType: 'domain', fingerprintValue: 'buyer.example' })
      ]
    });
    const store = new PrismaCrmStore(prisma as never);

    const records = await store.findArchivedFingerprints({
      organizationId: 'org-1',
      fingerprints: [
        { fingerprintType: 'domain', fingerprintValue: 'buyer.example' },
        { fingerprintType: 'email_hash', fingerprintValue: 'email-hash-1' }
      ]
    });

    assert.equal(records.length, 1);
    assert.deepEqual(prisma.crmArchivedFingerprint.findManyCalls[0].where, {
      organizationId: 'org-1',
      OR: [
        { fingerprintType: 'domain', fingerprintValue: 'buyer.example' },
        { fingerprintType: 'email_hash', fingerprintValue: 'email-hash-1' }
      ]
    });
  });

  it('upserts archived fingerprints by organization type and value', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    const archivedAt = new Date('2026-06-18T10:00:00.000Z');

    const record = await store.upsertArchivedFingerprint({
      organizationId: 'org-1',
      fingerprintType: 'domain',
      fingerprintValue: 'buyer.example',
      maskedValue: 'buyer.example',
      accountName: 'Buyer Inc',
      normalizedName: 'buyer inc',
      country: 'AE',
      sourceAccountId: 'account-1',
      sourceContactId: null,
      sourceTaskId: 'task-1',
      archiveReason: 'Not a fit',
      archivedAt
    });

    assert.equal(record.fingerprintValue, 'buyer.example');
    assert.deepEqual(prisma.crmArchivedFingerprint.upsertCalls[0].where, {
      organizationId_fingerprintType_fingerprintValue: {
        organizationId: 'org-1',
        fingerprintType: 'domain',
        fingerprintValue: 'buyer.example'
      }
    });
    assert.equal(prisma.crmArchivedFingerprint.upsertCalls[0].update.archiveReason, 'Not a fit');
  });

  it('loads account detail with member owner scope and newest timeline first', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const detail = await store.getAccountDetail({
      id: 'account-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });

    assert.equal(detail?.account.id, 'account-1');
    assert.deepEqual(prisma.crmAccount.findFirstCalls[0].where, {
      id: 'account-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmContact.findManyCalls[0], {
      where: {
        organizationId: 'org-1',
        accountId: 'account-1'
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    assert.deepEqual(prisma.crmTimelineEvent.findManyCalls[0], {
      where: {
        organizationId: 'org-1',
        accountId: 'account-1'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  });

  it('loads account detail without owner scope for organization admins', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.getAccountDetail({
      id: 'account-1',
      organizationId: 'org-1'
    });

    assert.deepEqual(prisma.crmAccount.findFirstCalls[0].where, {
      id: 'account-1',
      organizationId: 'org-1'
    });
  });

  it('loads contacts with organization and optional owner scope', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const contact = await store.findContactById({
      id: 'contact-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });

    assert.equal(contact?.id, 'contact-1');
    assert.deepEqual(prisma.crmContact.findFirstCalls[0].where, {
      id: 'contact-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
  });

  it('updates contact email status through Prisma', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const contact = await store.updateContactEmailStatus('contact-1', 'valid');

    assert.equal(contact?.emailStatus, 'valid');
    assert.deepEqual(prisma.crmContact.updateManyAndReturnCalls[0], {
      where: { id: 'contact-1' },
      data: { emailStatus: 'valid' },
      limit: 1
    });
  });

  it('creates mailbox and uses provider plus email hash for duplicate lookup', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const mailbox = await store.createMailbox({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      ownerUserName: 'Alice',
      provider: 'gmail',
      emailAddress: 'alice@gmail.com',
      emailHash: 'hash-1',
      maskedEmail: 'a***@gmail.com',
      status: 'active',
      dailyLimit: 50,
      hourlyLimit: 10,
      warmupStage: 'new',
      encryptedRefreshToken: 'encrypted-refresh-token-1',
      authorizedAt: new Date('2026-06-18T09:00:00.000Z')
    });
    const existing = await store.findMailboxByProviderAndEmailHash('gmail', 'hash-1');

    assert.equal(mailbox.id, 'mailbox-1');
    assert.equal(mailbox.encryptedRefreshToken, 'encrypted-refresh-token-1');
    assert.equal(existing?.id, 'mailbox-1');
    assert.deepEqual(prisma.crmMailbox.findUniqueCalls[0].where, {
      provider_emailHash: {
        provider: 'gmail',
        emailHash: 'hash-1'
      }
    });
  });

  it('returns existing mailbox when concurrent create hits global provider email hash uniqueness', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    prisma.crmMailbox.createError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test'
    });

    const mailbox = await store.createMailbox({
      organizationId: 'org-2',
      ownerUserId: 'user-2',
      ownerUserName: 'Bob',
      provider: 'gmail',
      emailAddress: 'alice@gmail.com',
      emailHash: 'hash-1',
      maskedEmail: 'a***@gmail.com',
      status: 'active',
      dailyLimit: 50,
      hourlyLimit: 10,
      warmupStage: 'new',
      authorizedAt: new Date('2026-06-18T09:00:00.000Z')
    });

    assert.equal(mailbox.id, 'mailbox-1');
    assert.deepEqual(prisma.crmMailbox.findUniqueCalls[0].where, {
      provider_emailHash: {
        provider: 'gmail',
        emailHash: 'hash-1'
      }
    });
  });

  it('lists mailboxes with organization, owner, keyword and status filters', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.listMailboxes({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      keyword: 'gmail',
      status: 'active',
      skip: 0,
      take: 20
    });

    assert.deepEqual(prisma.crmMailbox.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'active',
      OR: [
        { emailAddress: { contains: 'gmail', mode: 'insensitive' } },
        { maskedEmail: { contains: 'gmail', mode: 'insensitive' } },
        { ownerUserName: { contains: 'gmail', mode: 'insensitive' } }
      ]
    });
    assert.deepEqual(prisma.crmMailbox.findManyCalls[0].orderBy, { updatedAt: 'desc' });
  });

  it('lists active Gmail mailboxes that need watch renewal', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    const renewBefore = new Date('2026-06-19T12:00:00.000Z');

    await store.listMailboxesForWatchRenewal({
      provider: 'gmail',
      renewBefore,
      take: 25
    });

    assert.deepEqual(prisma.crmMailbox.findManyCalls[0], {
      where: {
        provider: 'gmail',
        status: 'active',
        OR: [{ watchExpiration: null }, { watchExpiration: { lte: renewBefore } }]
      },
      orderBy: [{ watchExpiration: 'asc' }, { updatedAt: 'asc' }],
      take: 25
    });
  });

  it('finds and updates mailboxes through scoped identity reads before writes', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const found = await store.findMailboxById({
      id: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    const updated = await store.updateMailbox('mailbox-1', {
      status: 'paused',
      pausedAt: new Date('2026-06-18T10:00:00.000Z')
    });

    assert.equal(found?.id, 'mailbox-1');
    assert.equal(updated?.status, 'paused');
    assert.deepEqual(prisma.crmMailbox.findFirstCalls[0].where, {
      id: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmMailbox.updateManyAndReturnCalls[0], {
      where: { id: 'mailbox-1' },
      data: {
        status: 'paused',
        pausedAt: new Date('2026-06-18T10:00:00.000Z')
      },
      limit: 1
    });
  });

  it('advances mailbox Gmail history id with the current checkpoint guard', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const mailbox = await store.advanceMailboxHistoryId({
      mailboxId: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      fromHistoryId: '100',
      toHistoryId: '120'
    });

    assert.equal(mailbox?.lastHistoryId, '120');
    assert.deepEqual(prisma.crmMailbox.updateManyAndReturnCalls[0], {
      where: {
        id: 'mailbox-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        lastHistoryId: '100'
      },
      data: {
        lastHistoryId: '120',
        syncIssueType: null,
        syncIssueAt: null,
        syncIssueMessage: null
      },
      limit: 1
    });
  });

  it('creates and lists product lines with organization scope only', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.createProductLine({
      organizationId: 'org-1',
      name: 'Bearing Series',
      targetCustomerType: 'distributor',
      coreSellingPoints: 'Stable supply',
      moq: '100 pcs',
      leadTime: '15 days',
      paymentTerms: 'T/T',
      certifications: 'ISO 9001',
      catalogUrl: '/catalog/bearing.pdf',
      websiteUrl: 'https://example.com/bearing',
      commonModelsText: '6204, 6205',
      status: 'active',
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const result = await store.listProductLines({
      organizationId: 'org-1',
      keyword: 'bearing',
      status: 'active',
      skip: 0,
      take: 20
    });

    assert.equal(prisma.crmProductLine.createCalls[0].data.organizationId, 'org-1');
    assert.deepEqual(prisma.crmProductLine.findManyCalls[0].where, {
      organizationId: 'org-1',
      status: 'active',
      OR: [
        { name: { contains: 'bearing', mode: 'insensitive' } },
        { targetCustomerType: { contains: 'bearing', mode: 'insensitive' } },
        { coreSellingPoints: { contains: 'bearing', mode: 'insensitive' } },
        { moq: { contains: 'bearing', mode: 'insensitive' } },
        { leadTime: { contains: 'bearing', mode: 'insensitive' } },
        { paymentTerms: { contains: 'bearing', mode: 'insensitive' } },
        { certifications: { contains: 'bearing', mode: 'insensitive' } },
        { commonModelsText: { contains: 'bearing', mode: 'insensitive' } }
      ]
    });
    assert.deepEqual(prisma.crmProductLine.findManyCalls[0].orderBy, { updatedAt: 'desc' });
    assert.equal(result.records[0].id, 'product-line-1');
    assert.equal(result.total, 1);
  });

  it('finds product line by organization name for duplicate checks', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const productLine = await store.findProductLineByName('org-1', 'Bearing Series');

    assert.equal(productLine?.id, 'product-line-1');
    assert.deepEqual(prisma.crmProductLine.findUniqueCalls[0].where, {
      organizationId_name: {
        organizationId: 'org-1',
        name: 'Bearing Series'
      }
    });
  });

  it('finds and updates product lines through organization scoped identity', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const found = await store.findProductLineById({
      id: 'product-line-1',
      organizationId: 'org-1'
    });
    const updated = await store.updateProductLine('product-line-1', 'org-1', {
      name: 'Premium Bearing Series',
      status: 'archived'
    });

    assert.equal(found?.id, 'product-line-1');
    assert.equal(updated?.status, 'archived');
    assert.deepEqual(prisma.crmProductLine.findFirstCalls[0].where, {
      id: 'product-line-1',
      organizationId: 'org-1'
    });
    assert.deepEqual(prisma.crmProductLine.updateManyAndReturnCalls[0], {
      where: {
        id: 'product-line-1',
        organizationId: 'org-1'
      },
      data: {
        name: 'Premium Bearing Series',
        status: 'archived'
      },
      limit: 1
    });
  });

  it('creates, lists, updates and defaults persona profiles with organization scope', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.createPersonaProfile({
      organizationId: 'org-1',
      name: 'Procurement lead',
      titleKeywordsText: 'procurement\nbuyer',
      customerTypeKeywordsText: 'distributor',
      painPoints: 'price volatility',
      focusText: 'MOQ and lead time',
      avoidText: 'cheap',
      status: 'active',
      isDefault: false,
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const listed = await store.listPersonaProfiles({
      organizationId: 'org-1',
      keyword: 'procurement',
      status: 'active',
      skip: 0,
      take: 20
    });
    const found = await store.findPersonaProfileById({ id: 'persona-profile-1', organizationId: 'org-1' });
    const updated = await store.updatePersonaProfile('persona-profile-1', 'org-1', {
      name: 'Senior buyer',
      isDefault: true
    });
    const defaulted = await store.setDefaultPersonaProfile('persona-profile-1', 'org-1');

    assert.equal(prisma.crmPersonaProfile.createCalls[0].data.organizationId, 'org-1');
    assert.deepEqual(prisma.crmPersonaProfile.findManyCalls[0].where, {
      organizationId: 'org-1',
      status: 'active',
      OR: [
        { name: { contains: 'procurement', mode: 'insensitive' } },
        { description: { contains: 'procurement', mode: 'insensitive' } },
        { titleKeywordsText: { contains: 'procurement', mode: 'insensitive' } },
        { customerTypeKeywordsText: { contains: 'procurement', mode: 'insensitive' } },
        { painPoints: { contains: 'procurement', mode: 'insensitive' } },
        { focusText: { contains: 'procurement', mode: 'insensitive' } },
        { avoidText: { contains: 'procurement', mode: 'insensitive' } }
      ]
    });
    assert.equal(listed.records[0].titleKeywordsText, 'procurement\nbuyer');
    assert.equal(found?.id, 'persona-profile-1');
    assert.equal(updated?.isDefault, true);
    assert.equal(defaulted?.isDefault, true);
    assert.deepEqual(prisma.crmPersonaProfile.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        id: { not: 'persona-profile-1' },
        isDefault: true
      },
      data: { isDefault: false }
    });
  });

  it('creates and lists sequence review items with scoped include data', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.createSequenceEnrollment({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      productLineId: 'product-line-1',
      mailboxId: 'mailbox-1',
      name: 'ABC Trading - Ali Hassan',
      status: 'draft_review_pending',
      currentStep: 1,
      totalSteps: 5,
      runVersion: 1,
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const result = await store.listSequenceReviewItems({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      keyword: 'abc',
      status: 'draft_review_pending',
      skip: 0,
      take: 20
    });

    assert.equal(prisma.crmSequenceEnrollment.createCalls[0].data.organizationId, 'org-1');
    assert.deepEqual(prisma.crmSequenceEnrollment.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'draft_review_pending',
      OR: [
        { name: { contains: 'abc', mode: 'insensitive' } },
        { account: { name: { contains: 'abc', mode: 'insensitive' } } },
        { account: { domain: { contains: 'abc', mode: 'insensitive' } } },
        { contact: { fullName: { contains: 'abc', mode: 'insensitive' } } },
        { contact: { title: { contains: 'abc', mode: 'insensitive' } } },
        { contact: { maskedEmail: { contains: 'abc', mode: 'insensitive' } } }
      ]
    });
    assert.equal(result.records[0].firstMessage?.id, 'message-1');
    assert.deepEqual(
      result.records[0].messages.map(message => message.id),
      ['message-1']
    );
    assert.equal(result.total, 1);
    assert.deepEqual(prisma.crmSequenceEnrollment.findManyCalls[0].include, {
      account: true,
      contact: true,
      productLine: true,
      mailbox: true,
      policy: true,
      messages: {
        orderBy: [{ stepIndex: 'asc' }, { createdAt: 'asc' }]
      }
    });

    await store.listSequenceReviewItems({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      todoType: 'follow_up_draft_review',
      skip: 0,
      take: 20
    });

    assert.deepEqual(prisma.crmSequenceEnrollment.findManyCalls[1].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      AND: [
        {
          messages: {
            some: {
              stepIndex: { gt: 1 },
              status: 'draft_pending_review'
            }
          }
        }
      ]
    });
  });

  it('finds active enrollments and updates draft messages through scoped identities', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const enrollment = await store.findActiveEnrollmentByContact({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      contactId: 'contact-1',
      statuses: ['draft_review_pending', 'ready_to_send']
    });
    const accountEnrollment = await store.findActiveEnrollmentByAccount({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      statuses: ['draft_review_pending', 'ready_to_send']
    });
    const message = await store.findMessageById({
      id: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    const providerMessage = await store.findSentMessageByProviderId({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerMessageId: 'gmail-sent-1'
    });
    const updated = await store.updateMessage('message-1', 'org-1', {
      subject: 'Updated',
      status: 'draft_ready'
    });

    assert.equal(enrollment?.id, 'enrollment-1');
    assert.equal(accountEnrollment?.id, 'enrollment-1');
    assert.equal(message?.id, 'message-1');
    assert.equal(providerMessage?.id, 'message-1');
    assert.equal(updated?.status, 'draft_ready');
    assert.deepEqual(prisma.crmSequenceEnrollment.findFirstCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      contactId: 'contact-1',
      status: { in: ['draft_review_pending', 'ready_to_send'] }
    });
    assert.deepEqual(prisma.crmMessage.findFirstCalls[0].where, {
      id: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmMessage.findFirstCalls[1].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerMessageId: 'gmail-sent-1',
      status: 'sent'
    });
  });

  it('creates, lists and restores message draft versions with owner scoped raw queries', async () => {
    const prisma = createPrisma({
      draftVersionResults: [
        [
          createPrismaDraftVersion({
            id: 'draft-version-1',
            versionNo: 1,
            subject: 'Saved subject',
            bodyText: 'Saved body'
          })
        ],
        [
          createPrismaDraftVersion({
            id: 'draft-version-2',
            versionNo: 2,
            subject: 'Newer subject',
            bodyText: 'Newer body'
          }),
          createPrismaDraftVersion({
            id: 'draft-version-1',
            versionNo: 1,
            subject: 'Saved subject',
            bodyText: 'Saved body'
          })
        ],
        [
          createPrismaDraftVersion({
            id: 'draft-version-1',
            versionNo: 1,
            subject: 'Saved subject',
            bodyText: 'Saved body'
          })
        ]
      ]
    });
    const store = new PrismaCrmStore(prisma as never);

    const created = await store.createMessageDraftVersion({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      mailboxId: null,
      stepIndex: 1,
      subject: 'Saved subject',
      bodyText: 'Saved body',
      editorId: 'user-1',
      editorName: 'Alice'
    });
    const versions = await store.listMessageDraftVersions({
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    const restored = await store.restoreMessageDraftVersion({
      messageId: 'message-1',
      versionId: 'draft-version-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });

    assert.equal(created.versionNo, 1);
    assert.deepEqual(
      versions.map(version => [version.versionNo, version.subject]),
      [
        [2, 'Newer subject'],
        [1, 'Saved subject']
      ]
    );
    assert.equal(restored?.subject, 'Saved subject');
    assert.equal(restored?.bodyText, 'Saved body');
    assert.equal(prisma.queryRawCalls.length, 3);
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls.at(-1), {
      where: {
        id: 'message-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        status: 'draft_pending_review'
      },
      data: {
        subject: 'Saved subject',
        bodyText: 'Saved body'
      },
      limit: 1
    });
  });

  it('finds sent messages by provider thread id with full mailbox owner scope', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const providerThreadMessage = await store.findSentMessageByProviderThreadId({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerThreadId: 'gmail-thread-1'
    });

    assert.equal(providerThreadMessage?.id, 'message-1');
    assert.deepEqual(prisma.crmMessage.findFirstCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerThreadId: 'gmail-thread-1',
      status: 'sent'
    });
  });

  it('creates local follow-up draft bundles with scoped enrollment and timeline metadata', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    const scheduledAt = new Date('2026-06-23T10:00:00.000Z');

    const result = await store.createFollowUpDraftBundle({
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      message: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        mailboxId: 'mailbox-1',
        stepIndex: 2,
        threadMode: 'same_thread',
        subject: 'Follow-up',
        bodyText: 'Hi Ali',
        status: 'draft_pending_review',
        scheduledAt,
        providerThreadId: null
      },
      timelineEvent: {
        organizationId: 'org-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        ownerUserId: 'user-1',
        eventType: 'sequence_follow_up_draft_generated',
        title: '生成后续开发信草稿',
        content: 'Follow-up',
        metadata: {
          enrollmentId: 'enrollment-1',
          stepIndex: 2
        }
      }
    });

    assert.equal(result?.message.stepIndex, 2);
    assert.deepEqual(prisma.crmSequenceEnrollment.findFirstCalls.at(-1)?.where, {
      id: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmMessage.createCalls.at(-1)?.data, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      mailboxId: 'mailbox-1',
      stepIndex: 2,
      threadMode: 'same_thread',
      subject: 'Follow-up',
      bodyText: 'Hi Ali',
      status: 'draft_pending_review',
      scheduledAt,
      providerThreadId: null,
      enrollmentId: 'enrollment-1'
    });
    assert.deepEqual(prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata, {
      enrollmentId: 'enrollment-1',
      stepIndex: 2,
      messageId: 'message-2'
    });
  });

  it('starts first message sending with enrollment and message status guards', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.startFirstMessageSend({
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      fromEnrollmentStatus: 'ready_to_send',
      toEnrollmentStatus: 'sequence_running',
      fromMessageStatus: 'draft_ready',
      toMessageStatus: 'queued',
      accountStatus: 'sequence_running',
      scheduledAt: new Date('2026-06-18T10:00:00.000Z')
    });

    assert.equal(result?.message.status, 'queued');
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyAndReturnCalls[0].where, {
      id: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'ready_to_send'
    });
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls[0].where, {
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      stepIndex: 1,
      status: 'draft_ready'
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'message_queued');
  });

  it('does not mutate sending state when active mailbox guard fails inside transaction', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    prisma.crmMailbox.findUniqueResult = { status: 'paused' };

    const result = await store.startFirstMessageSend({
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      fromEnrollmentStatus: 'ready_to_send',
      toEnrollmentStatus: 'sequence_running',
      fromMessageStatus: 'draft_ready',
      toMessageStatus: 'queued',
      accountStatus: 'sequence_running',
      scheduledAt: new Date('2026-06-18T10:00:00.000Z')
    });

    assert.equal(result, null);
    assert.equal(prisma.crmSequenceEnrollment.updateManyAndReturnCalls.length, 0);
    assert.equal(prisma.crmMessage.updateManyAndReturnCalls.length, 0);
    assert.equal(prisma.crmTimelineEvent.createCalls.length, 0);
  });

  it('claims queued first message delivery by reserving daily and hourly mailbox quota', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.claimFirstMessageSendDelivery({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      claimedAt: new Date('2026-06-18T10:30:00.000Z')
    });

    assert.equal(result?.firstMessage?.id, 'message-1');
    assert.deepEqual(
      prisma.crmMailboxSendUsage.createCalls.map(call => call.data),
      [
        {
          organizationId: 'org-1',
          mailboxId: 'mailbox-1',
          bucketType: 'daily',
          bucketKey: '2026-06-18',
          usedCount: 1
        },
        {
          organizationId: 'org-1',
          mailboxId: 'mailbox-1',
          bucketType: 'hourly',
          bucketKey: '2026-06-18T10',
          usedCount: 1
        }
      ]
    );
  });

  it('skips queued delivery and stops the sequence when the contact is organization blacklisted', async () => {
    const prisma = createPrisma({ blacklistEntry: createPrismaBlacklist() });
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.claimFirstMessageSendDelivery({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      claimedAt: new Date('2026-06-18T10:30:00.000Z')
    });

    assert.equal(result, null);
    assert.equal(prisma.crmMailboxSendUsage.createCalls.length, 0);
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyCalls.at(-1), {
      where: {
        id: 'enrollment-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        runVersion: 1,
        status: 'sequence_running'
      },
      data: {
        status: 'stopped',
        runVersion: { increment: 1 }
      }
    });
    assert.deepEqual(prisma.crmMessage.updateManyCalls.at(-1), {
      where: {
        id: 'message-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        status: 'queued'
      },
      data: {
        status: 'skipped',
        bullJobId: null
      }
    });
  });

  it('claims queued follow-up delivery by the job message id instead of the first step', async () => {
    const prisma = createPrisma({
      sequenceReviewMessages: [
        createPrismaMessage({ id: 'message-1', status: 'sent', stepIndex: 1 }),
        createPrismaMessage({ id: 'message-2', status: 'queued', stepIndex: 2, threadMode: 'same_thread' })
      ]
    });
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.claimFirstMessageSendDelivery({
      enrollmentId: 'enrollment-1',
      messageId: 'message-2',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      claimedAt: new Date('2026-06-21T10:30:00.000Z')
    });

    assert.equal(result?.firstMessage.id, 'message-2');
    assert.equal(result?.firstMessage.stepIndex, 2);
  });

  it('does not claim queued first message delivery when mailbox quota is exhausted', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    prisma.crmMailboxSendUsage.updateManyResultCount = 0;
    prisma.crmMailboxSendUsage.findUniqueResult = {
      id: 'usage-1',
      organizationId: 'org-1',
      mailboxId: 'mailbox-1',
      bucketType: 'daily',
      bucketKey: '2026-06-18',
      usedCount: 50,
      createdAt: new Date('2026-06-18T00:00:00.000Z'),
      updatedAt: new Date('2026-06-18T00:00:00.000Z')
    };

    const result = await store.claimFirstMessageSendDelivery({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      claimedAt: new Date('2026-06-18T10:30:00.000Z')
    });

    assert.equal(result, null);
  });

  it('persists provider ids when completing first message send', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    const sentAt = new Date('2026-06-18T10:45:00.000Z');

    const result = await store.completeFirstMessageSend({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      sentAt,
      providerMessageId: 'gmail-message-1',
      providerThreadId: 'gmail-thread-1'
    });

    assert.equal(result?.message.status, 'sent');
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls.at(-1)?.data, {
      status: 'sent',
      sentAt,
      providerMessageId: 'gmail-message-1',
      providerThreadId: 'gmail-thread-1'
    });
  });

  it('creates only the next follow-up draft when completing first message send', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    const sentAt = new Date('2026-06-18T10:45:00.000Z');
    const scheduledAt = new Date('2026-06-21T10:45:00.000Z');

    const result = await store.completeFirstMessageSend({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      sentAt,
      providerMessageId: 'gmail-message-1',
      providerThreadId: 'gmail-thread-1',
      nextMessage: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        mailboxId: 'mailbox-1',
        stepIndex: 2,
        threadMode: 'same_thread',
        subject: 'Bearing Series for ABC Trading',
        bodyText: 'Hi Ali,\n\nJust following up.',
        status: 'draft_pending_review',
        scheduledAt,
        providerThreadId: 'gmail-thread-1'
      }
    });

    assert.equal(result?.nextMessage?.stepIndex, 2);
    assert.equal(prisma.crmMessage.createCalls.length, 1);
    assert.deepEqual(prisma.crmMessage.createCalls[0].data, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      mailboxId: 'mailbox-1',
      stepIndex: 2,
      threadMode: 'same_thread',
      subject: 'Bearing Series for ABC Trading',
      bodyText: 'Hi Ali,\n\nJust following up.',
      status: 'draft_pending_review',
      scheduledAt,
      providerThreadId: 'gmail-thread-1',
      enrollmentId: 'enrollment-1'
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'message_sent');
    assert.deepEqual(prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata, {
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      runVersion: 1,
      nextMessageId: 'message-2',
      nextStepIndex: 2
    });
  });

  it('reuses an existing local follow-up draft when completing first message send', async () => {
    const existingNextMessage = createPrismaMessage({
      id: 'message-local-2',
      stepIndex: 2,
      status: 'draft_ready',
      threadMode: 'same_thread',
      scheduledAt: new Date('2026-06-21T10:45:00.000Z')
    });
    const prisma = createPrisma({ existingNextMessage });
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.completeFirstMessageSend({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      sentAt: new Date('2026-06-18T10:45:00.000Z'),
      providerMessageId: 'gmail-message-1',
      providerThreadId: 'gmail-thread-1',
      nextMessage: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        mailboxId: 'mailbox-1',
        stepIndex: 2,
        threadMode: 'same_thread',
        subject: 'Bearing Series for ABC Trading',
        bodyText: 'Hi Ali,\n\nJust following up.',
        status: 'draft_pending_review',
        scheduledAt: new Date('2026-06-21T10:45:00.000Z'),
        providerThreadId: 'gmail-thread-1'
      }
    });

    assert.equal(result?.nextMessage?.id, 'message-local-2');
    assert.equal(prisma.crmMessage.createCalls.length, 0);
    assert.deepEqual(prisma.crmMessage.findFirstCalls.at(-1)?.where, {
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      stepIndex: 2
    });
    const metadata = prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata as
      | { nextMessageId?: string }
      | undefined;
    assert.equal(metadata?.nextMessageId, 'message-local-2');
  });

  it('records the sent follow-up step when completing a later queued message', async () => {
    const prisma = createPrisma({
      sentMessageResult: createPrismaMessage({
        id: 'message-2',
        status: 'queued',
        stepIndex: 2,
        threadMode: 'same_thread'
      })
    });
    const store = new PrismaCrmStore(prisma as never);
    const sentAt = new Date('2026-06-21T10:45:00.000Z');

    const result = await store.completeFirstMessageSend({
      enrollmentId: 'enrollment-1',
      messageId: 'message-2',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      sentAt,
      providerMessageId: 'gmail-message-2',
      providerThreadId: 'gmail-thread-1'
    });

    assert.equal(result?.message.stepIndex, 2);
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyAndReturnCalls[0].data, { currentStep: 2 });
  });

  it('marks Gmail mailbox auth expired and pauses pending sends for that mailbox', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    const expiredAt = new Date('2026-06-18T10:50:00.000Z');

    const result = await store.markMailboxAuthorizationExpired({
      mailboxId: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      reason: 'invalid_grant',
      expiredAt
    });

    assert.equal(result?.mailbox.status, 'auth_expired');
    assert.equal(result?.pausedEnrollmentCount, 1);
    assert.equal(result?.resetMessageCount, 1);
    assert.deepEqual(prisma.crmMailbox.updateManyAndReturnCalls.at(-1), {
      where: {
        id: 'mailbox-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1'
      },
      data: {
        status: 'auth_expired',
        watchExpiration: null,
        pausedAt: expiredAt
      },
      limit: 1
    });
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        mailboxId: 'mailbox-1',
        status: { in: ['ready_to_send', 'sequence_running'] }
      },
      data: {
        status: 'paused',
        runVersion: { increment: 1 }
      }
    });
    assert.deepEqual(prisma.crmMessage.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        mailboxId: 'mailbox-1',
        status: 'queued'
      },
      data: {
        status: 'draft_ready',
        bullJobId: null
      }
    });
  });

  it('stops one sequence and skips queued first message with status guard', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.stopSequenceEnrollment({
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      fromStatuses: ['ready_to_send', 'sequence_running', 'paused'],
      accountStatus: 'paused',
      actorUserId: 'admin-1'
    });

    assert.equal(result?.enrollment.status, 'stopped');
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyAndReturnCalls[0].where, {
      id: 'enrollment-1',
      organizationId: 'org-1',
      status: { in: ['ready_to_send', 'sequence_running', 'paused'] }
    });
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyAndReturnCalls[0].data, {
      status: 'stopped',
      runVersion: { increment: 1 }
    });
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls[0].where, {
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      status: 'queued'
    });
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls[0].data, {
      status: 'skipped',
      bullJobId: null
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'sequence_stopped');
  });

  it('lists inbox threads with scoped filters and include data', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.listInboxThreads({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      keyword: 'reply',
      status: 'pending',
      mailboxId: 'mailbox-1',
      skip: 0,
      take: 20
    });

    assert.equal(result.total, 1);
    assert.equal(result.records[0].thread.id, 'inbox-thread-1');
    assert.deepEqual(prisma.crmInboxThread.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'pending',
      mailboxId: 'mailbox-1',
      OR: [
        { subject: { contains: 'reply', mode: 'insensitive' } },
        { account: { name: { contains: 'reply', mode: 'insensitive' } } },
        { account: { domain: { contains: 'reply', mode: 'insensitive' } } },
        { contact: { fullName: { contains: 'reply', mode: 'insensitive' } } },
        { contact: { title: { contains: 'reply', mode: 'insensitive' } } },
        { contact: { maskedEmail: { contains: 'reply', mode: 'insensitive' } } }
      ]
    });
  });

  it('updates inbox thread status and writes timeline event', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.updateInboxThreadStatus({
      id: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      fromStatus: 'pending',
      toStatus: 'handled',
      accountStatus: 'followed_up'
    });

    assert.equal(result?.thread.status, 'handled');
    assert.deepEqual(prisma.crmInboxThread.updateManyAndReturnCalls[0].where, {
      id: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'pending'
    });
    assert.deepEqual(prisma.crmInboxThread.updateManyAndReturnCalls[0].data, {
      status: 'handled',
      unreadCount: 0
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'inbox_status_changed');
  });

  it('marks an inbox thread handled when Gmail removes UNREAD', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await (
      store as unknown as {
        syncInboxThreadGmailState(input: {
          organizationId: string;
          ownerUserId: string;
          mailboxId: string;
          providerThreadId: string;
          providerMessageId: string;
          changeType: 'labels_removed';
          labelIds: string[];
        }): ReturnType<CrmStore['updateInboxThreadStatus']>;
      }
    ).syncInboxThreadGmailState({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerThreadId: 'enrollment-1',
      providerMessageId: 'gmail-message-1',
      changeType: 'labels_removed',
      labelIds: ['UNREAD']
    });

    assert.equal(result?.thread.status, 'handled');
    assert.equal(result?.thread.unreadCount, 0);
    assert.deepEqual(prisma.crmInboxThread.findFirstCalls.at(-1)?.where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerThreadId: 'enrollment-1'
    });
    assert.deepEqual(prisma.crmInboxThread.updateCalls.at(-1)?.data, {
      status: 'handled',
      unreadCount: 0
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'gmail_label_synced');
    assert.deepEqual(prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata, {
      providerMessageId: 'gmail-message-1',
      providerThreadId: 'enrollment-1',
      changeType: 'labels_removed',
      labelIds: ['UNREAD'],
      fromStatus: 'pending',
      toStatus: 'handled'
    });
  });

  it('archives an inbox thread when Gmail removes INBOX without deleting local messages', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await (
      store as unknown as {
        syncInboxThreadGmailState(input: {
          organizationId: string;
          ownerUserId: string;
          mailboxId: string;
          providerThreadId: string;
          providerMessageId: string;
          changeType: 'labels_removed';
          labelIds: string[];
        }): ReturnType<CrmStore['updateInboxThreadStatus']>;
      }
    ).syncInboxThreadGmailState({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerThreadId: 'enrollment-1',
      providerMessageId: 'gmail-message-1',
      changeType: 'labels_removed',
      labelIds: ['INBOX']
    });

    assert.equal(result?.thread.status, 'archived');
    assert.equal(result?.thread.unreadCount, 0);
    assert.deepEqual(prisma.crmInboxThread.updateCalls.at(-1)?.data, {
      status: 'archived',
      unreadCount: 0
    });
    assert.equal(prisma.crmInboxMessage.createCalls.length, 0);
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'gmail_thread_archived');
  });

  it('replies to inbox thread with mailbox sender and marks it handled', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    const sentAt = new Date('2026-06-18T11:30:00.000Z');

    const result = await store.replyInboxThread({
      id: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Re: Bearing Series for ABC Trading',
      bodyText: 'Thanks, I will send details today.',
      sentAt,
      providerMessageId: 'mock:reply-1'
    });

    assert.equal(result?.thread.status, 'handled');
    assert.equal(result?.account.status, 'followed_up');
    assert.deepEqual(prisma.crmInboxThread.findFirstCalls.at(-1)?.where, {
      id: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmInboxMessage.createCalls.at(-1)?.data, {
      threadId: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      enrollmentId: 'enrollment-1',
      mailboxId: 'mailbox-1',
      provider: 'gmail',
      providerMessageId: 'mock:reply-1',
      replyToMessageId: 'inbox-message-1',
      fromEmail: 'alice@gmail.com',
      fromEmailHash: 'hash-1',
      maskedFromEmail: 'a***@gmail.com',
      subject: 'Re: Bearing Series for ABC Trading',
      snippet: 'Thanks, I will send details today.',
      bodyText: 'Thanks, I will send details today.',
      receivedAt: sentAt,
      messageType: 'customer_reply'
    });
    assert.deepEqual(prisma.crmInboxThread.updateCalls.at(-1)?.data, {
      status: 'handled',
      unreadCount: 0,
      messageCount: { increment: 1 }
    });
    assert.deepEqual(prisma.crmAccount.updateCalls.at(-1), {
      where: { id: 'account-1' },
      data: { status: 'followed_up' }
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'inbox_replied');
  });

  it('returns existing inbox message when ingesting duplicate provider message', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.ingestCustomerReply({
      outboundMessageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Re: Bearing Series',
      bodyText: 'Please send details.',
      receivedAt: new Date('2026-06-18T11:00:00.000Z'),
      providerThreadId: 'gmail-thread-1',
      providerMessageId: 'gmail-message-1'
    });

    assert.equal(result?.isDuplicate, true);
    assert.equal(result?.message.id, 'inbox-message-1');
    assert.equal(result?.thread.id, 'inbox-thread-1');
    assert.equal(prisma.crmBlacklist.upsertCalls.length, 0);
    assert.deepEqual(prisma.crmInboxMessage.findFirstCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerMessageId: 'gmail-message-1'
    });
    assert.equal(prisma.crmInboxMessage.createCalls.length, 0);
    assert.equal(prisma.crmInboxThread.updateCalls.length, 0);
    assert.equal(prisma.crmTimelineEvent.createCalls.length, 0);
  });

  it('rereads existing inbox message when concurrent ingest hits provider message uniqueness', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    prisma.crmInboxMessage.findFirstResults = [null, 'default'];
    prisma.crmInboxMessage.createError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test'
    });

    const result = await store.ingestCustomerReply({
      outboundMessageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Re: Bearing Series',
      bodyText: 'Please send details.',
      receivedAt: new Date('2026-06-18T11:00:00.000Z'),
      providerThreadId: 'gmail-thread-1',
      providerMessageId: 'gmail-message-1'
    });

    assert.equal(result?.isDuplicate, true);
    assert.equal(result?.message.id, 'inbox-message-1');
    assert.equal(prisma.crmInboxMessage.createCalls.length, 1);
    assert.deepEqual(prisma.crmInboxMessage.findFirstCalls.at(-1)?.where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerMessageId: 'gmail-message-1'
    });
    assert.equal(prisma.crmInboxThread.updateCalls.length, 0);
    assert.equal(prisma.crmTimelineEvent.createCalls.length, 0);
  });

  it('stops all active same-account sequences and skips queued follow-ups after a customer reply', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    prisma.crmInboxMessage.findFirstResult = null;

    const result = await store.ingestCustomerReply({
      outboundMessageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Re: Bearing Series',
      bodyText: 'Please send details.',
      receivedAt: new Date('2026-06-18T11:00:00.000Z'),
      providerThreadId: 'gmail-thread-1',
      providerMessageId: 'gmail-reply-1'
    });

    assert.equal(result?.isDuplicate, false);
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        status: { in: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'] }
      },
      data: {
        status: 'replied',
        runVersion: { increment: 1 }
      }
    });
    assert.deepEqual(prisma.crmMessage.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        status: 'queued'
      },
      data: {
        status: 'skipped',
        bullJobId: null
      }
    });
  });

  it('marks contact unsubscribed when ingesting an unsubscribe reply', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.ingestCustomerReply({
      outboundMessageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Re: Bearing Series',
      bodyText: 'Please remove me from your list.',
      receivedAt: new Date('2026-06-18T11:00:00.000Z'),
      messageType: 'unsubscribe_hint'
    });

    assert.equal(result?.message.messageType, 'unsubscribe_hint');
    assert.deepEqual(prisma.crmBlacklist.upsertCalls[0].where, {
      organizationId_emailHash: {
        organizationId: 'org-1',
        emailHash: 'hash-1'
      }
    });
    assert.equal(prisma.crmBlacklist.upsertCalls[0].create.sourceMessageId, 'inbox-message-1');
    assert.deepEqual(prisma.crmContact.updateCalls[0], {
      where: { id: 'contact-1' },
      data: { emailStatus: 'unsubscribed' }
    });
    assert.deepEqual(prisma.crmAccount.updateCalls.at(-1), {
      where: { id: 'account-1' },
      data: { status: 'blocked' }
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'customer_unsubscribed');
    const metadata = prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata as { messageType?: string } | undefined;
    assert.equal(metadata?.messageType, 'unsubscribe_hint');
  });

  it('marks contact unreachable when ingesting a bounce reply', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.ingestCustomerReply({
      outboundMessageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Delivery Status Notification (Failure)',
      bodyText: 'Diagnostic-Code: smtp; 550 5.1.1 User unknown',
      receivedAt: new Date('2026-06-18T11:00:00.000Z'),
      messageType: 'bounce'
    });

    assert.equal(result?.message.messageType, 'bounce');
    assert.deepEqual(prisma.crmContact.updateCalls[0], {
      where: { id: 'contact-1' },
      data: { emailStatus: 'unreachable' }
    });
    assert.deepEqual(prisma.crmAccount.updateCalls.at(-1), {
      where: { id: 'account-1' },
      data: { status: 'manual_review_pending' }
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'email_bounced');
    const metadata = prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata as { messageType?: string } | undefined;
    assert.equal(metadata?.messageType, 'bounce');
  });
});

function createPrismaMessage(input: Record<string, unknown> = {}) {
  return {
    id: 'message-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    stepIndex: 1,
    threadMode: 'new_subject',
    subject: 'Bearing Series for ABC Trading',
    bodyText: 'Hi Ali',
    status: 'draft_pending_review',
    scheduledAt: null,
    sentAt: null,
    bullJobId: null,
    providerMessageId: 'gmail-message-1',
    providerThreadId: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaDraftVersion(input: Record<string, unknown> = {}) {
  return {
    id: 'draft-version-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    messageId: 'message-1',
    mailboxId: null,
    stepIndex: 1,
    versionNo: 1,
    subject: 'Bearing Series for ABC Trading',
    bodyText: 'Hi Ali',
    editorId: 'user-1',
    editorName: 'Alice',
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    ...input
  };
}

function createPrismaBlacklist(input: Record<string, unknown> = {}) {
  return {
    id: 'blacklist-1',
    organizationId: 'org-1',
    emailHash: 'hash-1',
    maskedEmail: 'a***@example.com',
    reason: 'unsubscribe',
    sourceAccountId: 'account-1',
    sourceContactId: 'contact-1',
    sourceMessageId: 'inbox-message-1',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaArchivedFingerprint(input: Record<string, unknown> = {}) {
  return {
    id: 'archived-fingerprint-1',
    organizationId: 'org-1',
    fingerprintType: 'domain',
    fingerprintValue: 'buyer.example',
    maskedValue: 'buyer.example',
    accountName: 'Buyer Inc',
    normalizedName: 'buyer inc',
    country: 'AE',
    sourceAccountId: 'account-1',
    sourceContactId: null,
    sourceTaskId: 'task-1',
    archiveReason: 'Not a fit',
    archivedAt: new Date('2026-06-18T09:00:00.000Z'),
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaOrganizationConfig(input: Record<string, unknown> = {}) {
  return {
    id: 'crm-organization-config-1',
    organizationId: 'org-1',
    allowAdminViewMemberEmailBody: false,
    updatedById: 'user-1',
    updatedByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...input
  };
}

function createEmailTemplateSteps(): CrmEmailTemplateStepInput[] {
  return [1, 2, 3, 4, 5].map(stepIndex => ({
    stepIndex,
    name: `Step ${stepIndex}`,
    threadMode: stepIndex === 2 ? 'same_thread' : 'new_subject',
    delayDays: stepIndex === 1 ? 0 : stepIndex * 2,
    subjectTemplate: stepIndex === 2 ? '' : `Subject ${stepIndex}`,
    bodyTemplate: `Body ${stepIndex}`
  }));
}

function createPrisma(
  options: {
    archivedFingerprintResults?: ReturnType<typeof createPrismaArchivedFingerprint>[];
    blacklistEntry?: ReturnType<typeof createPrismaBlacklist> | null;
    draftVersionResults?: ReturnType<typeof createPrismaDraftVersion>[][];
    existingNextMessage?: ReturnType<typeof createPrismaMessage> | null;
    organizationConfig?: ReturnType<typeof createPrismaOrganizationConfig> | null;
    sequenceReviewMessages?: ReturnType<typeof createPrismaMessage>[];
    sentMessageResult?: ReturnType<typeof createPrismaMessage>;
  } = {}
) {
  const account = {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'ABC Trading',
    normalizedName: 'abc trading',
    websiteUrl: 'https://abc.example',
    domain: 'abc.example',
    country: 'AE',
    customerType: 'distributor',
    status: 'missing_contact',
    sourceTaskId: 'task-1',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
  const mailbox = {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    provider: 'gmail',
    emailAddress: 'alice@gmail.com',
    emailHash: 'hash-1',
    maskedEmail: 'a***@gmail.com',
    status: 'active',
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'new',
    watchExpiration: null,
    lastHistoryId: null,
    encryptedRefreshToken: 'encrypted-refresh-token-1',
    authorizedAt: new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
  const productLine = {
    id: 'product-line-1',
    organizationId: 'org-1',
    name: 'Bearing Series',
    targetCustomerType: 'distributor',
    coreSellingPoints: 'Stable supply',
    moq: '100 pcs',
    leadTime: '15 days',
    paymentTerms: 'T/T',
    certifications: 'ISO 9001',
    catalogUrl: '/catalog/bearing.pdf',
    websiteUrl: 'https://example.com/bearing',
    commonModelsText: '6204, 6205',
    status: 'active',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
  const personaProfile = {
    id: 'persona-profile-1',
    organizationId: 'org-1',
    name: 'Procurement lead',
    description: null,
    titleKeywordsText: 'procurement\nbuyer',
    customerTypeKeywordsText: 'distributor',
    painPoints: 'price volatility',
    focusText: 'MOQ and lead time',
    avoidText: 'cheap',
    status: 'active',
    isDefault: false,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
  const emailTemplateSteps = createEmailTemplateSteps().map(step => ({
    id: `template-step-${step.stepIndex}`,
    organizationId: 'org-1',
    templateGroupId: 'template-group-1',
    ...step,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  }));
  const emailTemplateGroup = {
    id: 'template-group-1',
    organizationId: 'org-1',
    name: 'Distributor follow-up',
    language: 'en',
    description: 'Default distributor sequence',
    status: 'active',
    isDefault: false,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    steps: emailTemplateSteps
  };
  const sequencePolicy = {
    id: 'policy-1',
    organizationId: 'org-1',
    name: 'Default sequence policy',
    description: null,
    status: 'active',
    isDefault: false,
    stepDelayDaysText: '0,3,7,14,21',
    stepThreadModesText: 'new_subject,same_thread,new_subject,new_subject,new_subject',
    linkPolicy: 'preserve_template_links',
    allowLowRiskAutoSend: false,
    sameCompanyContactStrategy: 'single_active_per_company',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
  const contact = {
    id: 'contact-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    ownerUserId: 'user-1',
    fullName: 'Ali Hassan',
    title: 'Buyer',
    email: 'ali@example.com',
    emailHash: 'hash-1',
    maskedEmail: 'a***@example.com',
    isPublicEmail: false,
    emailStatus: 'valid',
    sourceTaskId: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
  const emailVerificationCache = {
    id: 'email-verification-cache-1',
    emailHash: 'email-hash-1',
    maskedEmail: 'a***@example.com',
    domain: 'example.com',
    status: 'valid',
    reason: 'mx_found',
    verifiedAt: new Date('2026-06-18T09:00:00.000Z'),
    expiresAt: new Date('2026-07-18T09:00:00.000Z'),
    checkedById: 'user-1',
    checkedByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
  const blacklist = options.blacklistEntry ?? null;
  const message = createPrismaMessage();
  const enrollment = {
    id: 'enrollment-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    productLineId: 'product-line-1',
    mailboxId: 'mailbox-1',
    policyId: null,
    name: 'ABC Trading - Ali Hassan',
    status: 'draft_review_pending',
    currentStep: 1,
    totalSteps: 5,
    runVersion: 1,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    account,
    contact,
    productLine,
    mailbox,
    policy: null,
    messages: [message]
  };
  const inboxMessage = {
    id: 'inbox-message-1',
    threadId: 'inbox-thread-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    provider: 'gmail',
    providerMessageId: null,
    replyToMessageId: 'message-1',
    fromEmail: 'ali@example.com',
    fromEmailHash: 'hash-1',
    maskedFromEmail: 'a***@example.com',
    subject: 'Re: Bearing Series for ABC Trading',
    snippet: 'Please send details.',
    bodyText: 'Please send details.',
    receivedAt: new Date('2026-06-18T11:00:00.000Z'),
    messageType: 'customer_reply',
    createdAt: new Date('2026-06-18T11:00:00.000Z')
  };
  const inboxThread = {
    id: 'inbox-thread-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    provider: 'gmail',
    providerThreadId: 'enrollment-1',
    subject: 'Re: Bearing Series for ABC Trading',
    status: 'pending',
    lastInboundAt: new Date('2026-06-18T11:00:00.000Z'),
    unreadCount: 1,
    messageCount: 1,
    createdAt: new Date('2026-06-18T11:00:00.000Z'),
    updatedAt: new Date('2026-06-18T11:00:00.000Z'),
    account,
    contact,
    mailbox,
    enrollment,
    messages: [inboxMessage]
  };
  const queryRawResults = [...(options.draftVersionResults ?? [])];

  return {
    queryRawCalls: [] as unknown[][],
    async $transaction<T>(operation: (tx: unknown) => Promise<T>) {
      return operation(this);
    },
    async $queryRaw(...args: unknown[]) {
      this.queryRawCalls.push(args);
      return queryRawResults.shift() ?? [];
    },
    crmAccount: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }>,
      createError: null as Error | null,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        if (this.createError) throw this.createError;
        return account;
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return account;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return account;
      },
      async findMany(args: { where: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return [account];
      },
      async count() {
        return 1;
      },
      async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateCalls.push(args);
        return { ...account, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') };
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...account, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      }
    },
    crmContact: {
      findManyCalls: [] as Array<{ where: Record<string, unknown>; orderBy: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }>,
      async findMany(args: { where: Record<string, unknown>; orderBy: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return [
          {
            id: 'contact-1',
            organizationId: 'org-1',
            accountId: 'account-1',
            ownerUserId: 'user-1',
            fullName: 'Ali Hassan',
            title: 'Buyer',
            email: 'ali@example.com',
            emailHash: 'hash-1',
            maskedEmail: 'a***@example.com',
            isPublicEmail: false,
            emailStatus: 'unchecked',
            sourceTaskId: null,
            createdAt: new Date('2026-06-18T09:00:00.000Z'),
            updatedAt: new Date('2026-06-18T09:00:00.000Z')
          }
        ];
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return {
          id: 'contact-1',
          organizationId: 'org-1',
          accountId: 'account-1',
          ownerUserId: 'user-1',
          fullName: 'Ali Hassan',
          title: 'Buyer',
          email: 'ali@example.com',
          emailHash: 'hash-1',
          maskedEmail: 'a***@example.com',
          isPublicEmail: false,
          emailStatus: 'unchecked',
          sourceTaskId: null,
          createdAt: new Date('2026-06-18T09:00:00.000Z'),
          updatedAt: new Date('2026-06-18T09:00:00.000Z')
        };
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return {
          id: 'contact-1',
          organizationId: 'org-1',
          accountId: 'account-1',
          ownerUserId: 'user-1',
          fullName: 'Ali Hassan',
          title: 'Buyer',
          email: 'ali@example.com',
          emailHash: 'hash-1',
          maskedEmail: 'a***@example.com',
          isPublicEmail: false,
          emailStatus: 'unchecked',
          sourceTaskId: null,
          createdAt: new Date('2026-06-18T09:00:00.000Z'),
          updatedAt: new Date('2026-06-18T09:00:00.000Z')
        };
      },
      async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateCalls.push(args);
        return { ...contact, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') };
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return [
          {
            id: 'contact-1',
            organizationId: 'org-1',
            accountId: 'account-1',
            ownerUserId: 'user-1',
            fullName: 'Ali Hassan',
            title: 'Buyer',
            email: 'ali@example.com',
            emailHash: 'hash-1',
            maskedEmail: 'a***@example.com',
            isPublicEmail: false,
            emailStatus: args.data.emailStatus,
            sourceTaskId: null,
            createdAt: new Date('2026-06-18T09:00:00.000Z'),
            updatedAt: new Date('2026-06-18T10:00:00.000Z')
          }
        ];
      }
    },
    crmEmailVerificationCache: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      upsertCalls: [] as Array<{
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }>,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return emailVerificationCache;
      },
      async upsert(args: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        this.upsertCalls.push(args);
        return { ...emailVerificationCache, ...args.create, ...args.update };
      }
    },
    crmGlobalConfig: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      upsertCalls: [] as Array<{
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }>,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return null;
      },
      async upsert(args: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        this.upsertCalls.push(args);
        return {
          id: 'crm-global-config-1',
          configKey: 'default',
          emailVerificationCooldownDays: args.update.emailVerificationCooldownDays ?? 30,
          followUpDelayDaysText: args.update.followUpDelayDaysText ?? '3,7,14,21',
          updatedById: args.update.updatedById ?? null,
          updatedByName: args.update.updatedByName ?? null,
          createdAt: new Date('2026-06-18T09:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        };
      }
    },
    crmOrganizationConfig: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      upsertCalls: [] as Array<{
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }>,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return options.organizationConfig ?? null;
      },
      async upsert(args: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        this.upsertCalls.push(args);

        return {
          ...createPrismaOrganizationConfig(),
          ...options.organizationConfig,
          ...args.create,
          ...args.update,
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        };
      }
    },
    crmEmailTemplateGroup: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findManyCalls: [] as Array<{ where: Record<string, unknown>; skip: number; take: number }>,
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateManyCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return { ...emailTemplateGroup, ...args.data };
      },
      async findMany(args: { where: Record<string, unknown>; skip: number; take: number }) {
        this.findManyCalls.push(args);
        return [emailTemplateGroup];
      },
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return 1;
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return emailTemplateGroup;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return emailTemplateGroup;
      },
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        Object.assign(emailTemplateGroup, args.data, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
        return [emailTemplateGroup];
      }
    },
    crmEmailTemplateStep: {
      createManyCalls: [] as Array<{ data: Array<Record<string, unknown>> }>,
      deleteManyCalls: [] as Array<{ where: Record<string, unknown> }>,
      async createMany(args: { data: Array<Record<string, unknown>> }) {
        this.createManyCalls.push(args);
        return { count: args.data.length };
      },
      async deleteMany(args: { where: Record<string, unknown> }) {
        this.deleteManyCalls.push(args);
        return { count: 5 };
      }
    },
    crmSequencePolicy: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findManyCalls: [] as Array<{ where: Record<string, unknown>; skip: number; take: number; orderBy?: unknown }>,
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; orderBy?: unknown }>,
      updateManyCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return { ...sequencePolicy, ...args.data };
      },
      async findMany(args: { where: Record<string, unknown>; skip: number; take: number; orderBy?: unknown }) {
        this.findManyCalls.push(args);
        return [sequencePolicy];
      },
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return 1;
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return sequencePolicy;
      },
      async findFirst(args: { where: Record<string, unknown>; orderBy?: unknown }) {
        this.findFirstCalls.push(args);
        return sequencePolicy;
      },
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        Object.assign(sequencePolicy, args.data, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
        return [sequencePolicy];
      }
    },
    crmBlacklist: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }>,
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      deleteCalls: [] as Array<{ where: Record<string, unknown> }>,
      upsertCalls: [] as Array<{
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }>,
      findUniqueResult: blacklist,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return this.findUniqueResult;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return this.findUniqueResult;
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [createPrismaBlacklist()];
      },
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return 1;
      },
      async delete(args: { where: Record<string, unknown> }) {
        this.deleteCalls.push(args);
        return this.findUniqueResult;
      },
      async upsert(args: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        this.upsertCalls.push(args);
        return {
          ...createPrismaBlacklist(),
          ...args.create,
          ...args.update,
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        };
      }
    },
    crmArchivedFingerprint: {
      findManyCalls: [] as Array<{ where: Record<string, unknown>; orderBy: Record<string, unknown> }>,
      upsertCalls: [] as Array<{
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }>,
      async findMany(args: { where: Record<string, unknown>; orderBy: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return options.archivedFingerprintResults ?? [];
      },
      async upsert(args: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        this.upsertCalls.push(args);
        return {
          ...createPrismaArchivedFingerprint(),
          ...args.create,
          ...args.update,
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        };
      }
    },
    crmTimelineEvent: {
      findManyCalls: [] as Array<{ where: Record<string, unknown>; orderBy: Record<string, unknown> }>,
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      async findMany(args: { where: Record<string, unknown>; orderBy: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return [
          {
            id: 'event-1',
            organizationId: 'org-1',
            accountId: 'account-1',
            contactId: null,
            ownerUserId: 'user-1',
            eventType: 'account_imported',
            title: '导入',
            content: null,
            metadata: null,
            createdAt: new Date('2026-06-18T10:00:00.000Z')
          }
        ];
      },
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return {
          id: 'event-1',
          organizationId: 'org-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-1',
          eventType: args.data.eventType,
          title: args.data.title,
          content: args.data.content ?? null,
          metadata: args.data.metadata ?? null,
          createdAt: new Date('2026-06-18T10:00:00.000Z')
        };
      }
    },
    crmMailbox: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }>,
      createError: null as Error | null,
      findUniqueResult: null as Partial<typeof mailbox> | null,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        if (this.createError) throw this.createError;
        return mailbox;
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return this.findUniqueResult ? { ...mailbox, ...this.findUniqueResult } : mailbox;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return mailbox;
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [mailbox];
      },
      async count() {
        return 1;
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...mailbox, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      }
    },
    crmMailboxSendUsage: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateManyCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      updateManyResultCount: 0,
      findUniqueResult: null as Record<string, unknown> | null,
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: this.updateManyResultCount };
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return this.findUniqueResult;
      },
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return {
          id: `usage-${this.createCalls.length}`,
          ...args.data,
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        };
      }
    },
    crmProductLine: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }>,
      createError: null as Error | null,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        if (this.createError) throw this.createError;
        return productLine;
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return productLine;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return productLine;
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [productLine];
      },
      async count() {
        return 1;
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...productLine, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      }
    },
    crmPersonaProfile: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip?: number;
        take?: number;
        orderBy?: unknown;
      }>,
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateManyCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return { ...personaProfile, ...args.data };
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return personaProfile;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return personaProfile;
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip?: number;
        take?: number;
        orderBy?: unknown;
      }) {
        this.findManyCalls.push(args);
        return [personaProfile];
      },
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return 1;
      },
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        Object.assign(personaProfile, args.data, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
        return [personaProfile];
      }
    },
    crmSequenceEnrollment: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; include?: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
        include: Record<string, unknown>;
      }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }>,
      updateManyCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return enrollment;
      },
      async findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        if (args.include && args.where.status === 'sequence_running') {
          return {
            ...enrollment,
            status: 'sequence_running',
            messages: options.sequenceReviewMessages ?? [{ ...message, status: 'queued' }]
          };
        }
        return args.include
          ? enrollment
          : {
              ...enrollment,
              account: undefined,
              contact: undefined,
              productLine: undefined,
              mailbox: undefined,
              messages: undefined
            };
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
        include: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [enrollment];
      },
      async count() {
        return 1;
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...enrollment, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      },
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      }
    },
    crmMessage: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }>,
      updateManyCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return createPrismaMessage({
          ...args.data,
          id: `message-${this.createCalls.length + 1}`,
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        });
      },
      async findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        if (args.where.stepIndex && !args.where.status) {
          return options.existingNextMessage ?? null;
        }
        if (args.where.status === 'queued' && options.sentMessageResult) {
          return options.sentMessageResult;
        }
        if (args.include && args.where.status === 'sent') {
          return {
            ...message,
            status: 'sent',
            account,
            contact,
            enrollment,
            mailbox
          };
        }
        return message;
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return [
          { ...(options.sentMessageResult ?? message), ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }
        ];
      },
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      }
    },
    crmInboxThread: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; include?: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
        include: Record<string, unknown>;
      }>,
      updateCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return inboxThread;
      },
      async findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return args.include
          ? inboxThread
          : {
              ...inboxThread,
              account: undefined,
              contact: undefined,
              mailbox: undefined,
              enrollment: undefined,
              messages: undefined
            };
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
        include: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [inboxThread];
      },
      async count() {
        return 1;
      },
      async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateCalls.push(args);
        return { ...inboxThread, ...args.data, updatedAt: new Date('2026-06-18T12:00:00.000Z') };
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...inboxThread, ...args.data, updatedAt: new Date('2026-06-18T12:00:00.000Z') }];
      }
    },
    crmInboxMessage: {
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; include?: Record<string, unknown> }>,
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      createError: null as Error | null,
      findFirstResult: 'default' as 'default' | null,
      findFirstResults: [] as Array<'default' | null>,
      async findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        const result = this.findFirstResults.length > 0 ? this.findFirstResults.shift() : this.findFirstResult;
        if (result === null) return null;
        return args.include
          ? { ...inboxMessage, thread: inboxThread, account, contact, mailbox, enrollment }
          : { ...inboxMessage, thread: undefined };
      },
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        if (this.createError) throw this.createError;
        return { ...inboxMessage, ...args.data };
      }
    }
  };
}
