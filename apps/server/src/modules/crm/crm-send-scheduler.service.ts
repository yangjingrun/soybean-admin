import { Inject, Injectable } from '@nestjs/common';
import {
  defaultFollowUpSharePercent,
  defaultOwnerDailySendLimit,
  normalizeFollowUpSharePercent,
  normalizeOwnerConcurrentSendLimit,
  normalizeOwnerDailySendLimit,
  normalizeOwnerDailySendLimitMax
} from './crm-global-config';
import { CrmSendAvailabilityService } from './crm-send-availability.service';
import { toCrmSendJobId } from './crm-send-queue.service';
import type { CrmSendSchedulerRepository } from './crm-send-scheduler.repository';
import { CRM_SEND_QUEUE, CRM_SEND_SCHEDULER_REPOSITORY } from './crm.tokens';
import type {
  CrmDueSendCandidateRecord,
  CrmOwnerSendStateRecord,
  CrmScheduledMessageStepKind,
  CrmSendQueuePort
} from './crm.types';

interface DispatchDueMessagesInput {
  now?: Date;
  take?: number;
}

interface OwnerDispatchState {
  dailyLimit: number;
  concurrentLimit: number;
  followUpSharePercent: number;
  queuedCount: number;
  dailyCount: number;
  firstTouchCount: number;
  followUpCount: number;
  dispatchedCount: number;
  dispatchedByKind: Record<CrmScheduledMessageStepKind, number>;
}

interface MailboxDispatchState {
  dailyCount: number;
  hourlyCount: number;
}

@Injectable()
export class CrmSendSchedulerService {
  constructor(
    @Inject(CRM_SEND_SCHEDULER_REPOSITORY) private readonly store: CrmSendSchedulerRepository,
    @Inject(CRM_SEND_QUEUE) private readonly sendQueue: CrmSendQueuePort,
    private readonly availabilityService: CrmSendAvailabilityService
  ) {}

  /** Moves due locally approved drafts into the real BullMQ send queue within owner and mailbox limits. */
  async dispatchDueMessages(input: DispatchDueMessagesInput = {}) {
    const now = input.now ?? new Date();
    const take = input.take ?? 100;
    const [globalConfig, candidates] = await Promise.all([
      this.store.getGlobalConfig(),
      this.store.listDueSendCandidates({ now, take })
    ]);
    const ownerDailySendLimitMax = normalizeOwnerDailySendLimitMax(globalConfig.ownerDailySendLimitMax);
    const concurrentLimit = normalizeOwnerConcurrentSendLimit(globalConfig.ownerConcurrentSendLimit);
    const ownerStates = new Map<string, OwnerDispatchState>();
    const dayRange = toUtcRange(now, 'day');
    const hourRange = toUtcRange(now, 'hour');
    const availableCandidates: CrmDueSendCandidateRecord[] = [];
    let dispatchedCount = 0;
    let skippedCount = 0;

    for (const candidate of candidates) {
      const availability = this.availabilityService.evaluate({
        now,
        country: candidate.account.country ?? '',
        timeZone: candidate.account.timeZone,
        city: candidate.account.city,
        sendRule: {
          workdays: globalConfig.sendWorkdays,
          windows: globalConfig.sendWindows
        }
      });

      if (!availability.canSend) {
        skippedCount += 1;

        if (availability.nextAvailableAt) {
          await this.deferCandidate(candidate, availability.nextAvailableAt);
        }

        continue;
      }

      availableCandidates.push(candidate);
    }

    const ownerStateSnapshots = await this.loadOwnerStateSnapshots(availableCandidates, dayRange);
    const mailboxStates = await this.loadMailboxStates(availableCandidates, dayRange, hourRange);

    for (const candidate of availableCandidates) {
      const ownerKey = toOwnerKey(candidate.message.organizationId, candidate.message.ownerUserId);
      const state = this.getOwnerState(ownerKey, {
        ownerDailySendLimitMax,
        concurrentLimit,
        dayRange,
        ownerStates,
        ownerStateSnapshots
      });

      if (this.isOwnerCapacityFull(state)) {
        skippedCount += 1;
        continue;
      }

      if (!this.canUseShareSlot(candidate, availableCandidates, state)) {
        skippedCount += 1;
        continue;
      }

      const mailboxKey = toMailboxKey(candidate.message.organizationId, candidate.mailbox.id);

      if (!this.hasMailboxCapacity(candidate, mailboxStates.get(mailboxKey))) {
        skippedCount += 1;
        continue;
      }

      const queued = await this.queueCandidate(candidate, now);

      if (!queued) {
        skippedCount += 1;
        continue;
      }

      dispatchedCount += 1;
      state.dispatchedCount += 1;
      state.dispatchedByKind[candidate.stepKind] += 1;
      this.reserveMailboxCapacity(mailboxKey, mailboxStates);
    }

    return {
      scannedCount: candidates.length,
      dispatchedCount,
      skippedCount
    };
  }

  private getOwnerState(
    ownerKey: string,
    input: {
      ownerDailySendLimitMax: number;
      concurrentLimit: number;
      dayRange: DateRange;
      ownerStates: Map<string, OwnerDispatchState>;
      ownerStateSnapshots: Map<string, CrmOwnerSendStateRecord>;
    }
  ) {
    const existing = input.ownerStates.get(ownerKey);

    if (existing) {
      return existing;
    }

    const snapshot = input.ownerStateSnapshots.get(ownerKey);
    const preference = snapshot?.preference ?? null;
    const dailyLimit = normalizeOwnerDailySendLimit(
      preference?.dailySendLimit ?? defaultOwnerDailySendLimit,
      input.ownerDailySendLimitMax
    );
    const state: OwnerDispatchState = {
      dailyLimit,
      concurrentLimit: input.concurrentLimit,
      followUpSharePercent: normalizeFollowUpSharePercent(
        preference?.followUpSharePercent ?? defaultFollowUpSharePercent
      ),
      queuedCount: snapshot?.queuedCount ?? 0,
      dailyCount: snapshot?.dailyCount ?? 0,
      firstTouchCount: snapshot?.firstTouchCount ?? 0,
      followUpCount: snapshot?.followUpCount ?? 0,
      dispatchedCount: 0,
      dispatchedByKind: {
        first_touch: 0,
        follow_up: 0
      }
    };

    input.ownerStates.set(ownerKey, state);

    return state;
  }

  /** Preloads owner-level send state once per scheduler batch. */
  private async loadOwnerStateSnapshots(candidates: CrmDueSendCandidateRecord[], dayRange: DateRange) {
    const owners = Array.from(
      new Map(
        candidates.map(candidate => [
          toOwnerKey(candidate.message.organizationId, candidate.message.ownerUserId),
          {
            organizationId: candidate.message.organizationId,
            ownerUserId: candidate.message.ownerUserId
          }
        ])
      ).values()
    );

    if (owners.length === 0) {
      return new Map<string, CrmOwnerSendStateRecord>();
    }

    const records = await this.store.listOwnerSendStates({
      owners,
      from: dayRange.from,
      to: dayRange.to
    });

    return new Map(records.map(record => [toOwnerKey(record.organizationId, record.ownerUserId), record]));
  }

  private isOwnerCapacityFull(state: OwnerDispatchState) {
    const dailyRemaining = state.dailyLimit - state.dailyCount - state.dispatchedCount;
    const concurrentRemaining = state.concurrentLimit - state.queuedCount - state.dispatchedCount;

    return dailyRemaining <= 0 || concurrentRemaining <= 0;
  }

  private canUseShareSlot(
    candidate: CrmDueSendCandidateRecord,
    candidates: CrmDueSendCandidateRecord[],
    state: OwnerDispatchState
  ) {
    const target = this.getStepKindTarget(candidate.stepKind, state);
    const current = this.getStepKindCount(candidate.stepKind, state);

    if (current < target) {
      return true;
    }

    const oppositeKind: CrmScheduledMessageStepKind = candidate.stepKind === 'follow_up' ? 'first_touch' : 'follow_up';
    const oppositeHasCandidate = candidates.some(
      item =>
        item.stepKind === oppositeKind &&
        item.message.ownerUserId === candidate.message.ownerUserId &&
        item.message.organizationId === candidate.message.organizationId &&
        item.message.status === 'draft_ready'
    );

    return !oppositeHasCandidate;
  }

  private getStepKindTarget(kind: CrmScheduledMessageStepKind, state: OwnerDispatchState) {
    const followUpTarget = Math.floor((state.dailyLimit * state.followUpSharePercent) / 100);

    return kind === 'follow_up' ? followUpTarget : state.dailyLimit - followUpTarget;
  }

  private getStepKindCount(kind: CrmScheduledMessageStepKind, state: OwnerDispatchState) {
    if (kind === 'follow_up') {
      return state.followUpCount + state.dispatchedByKind.follow_up;
    }

    return state.firstTouchCount + state.dispatchedByKind.first_touch;
  }

  private hasMailboxCapacity(candidate: CrmDueSendCandidateRecord, state: MailboxDispatchState | undefined) {
    const dailyCount = state?.dailyCount ?? 0;
    const hourlyCount = state?.hourlyCount ?? 0;

    return dailyCount < candidate.mailbox.dailyLimit && hourlyCount < candidate.mailbox.hourlyLimit;
  }

  /** Preloads mailbox capacity counters once and reserves locally as this scheduler queues messages. */
  private async loadMailboxStates(candidates: CrmDueSendCandidateRecord[], dayRange: DateRange, hourRange: DateRange) {
    const mailboxes = Array.from(
      new Map(
        candidates.map(candidate => [
          toMailboxKey(candidate.message.organizationId, candidate.mailbox.id),
          {
            organizationId: candidate.message.organizationId,
            mailboxId: candidate.mailbox.id
          }
        ])
      ).values()
    );

    if (mailboxes.length === 0) {
      return new Map<string, MailboxDispatchState>();
    }

    const records = await this.store.listMailboxSendStates({
      mailboxes,
      day: dayRange,
      hour: hourRange
    });

    return new Map(
      records.map(record => [
        toMailboxKey(record.organizationId, record.mailboxId),
        {
          dailyCount: record.dailyCount,
          hourlyCount: record.hourlyCount
        }
      ])
    );
  }

  private reserveMailboxCapacity(mailboxKey: string, mailboxStates: Map<string, MailboxDispatchState>) {
    const state = mailboxStates.get(mailboxKey) ?? {
      dailyCount: 0,
      hourlyCount: 0
    };

    state.dailyCount += 1;
    state.hourlyCount += 1;
    mailboxStates.set(mailboxKey, state);
  }

  private async queueCandidate(candidate: CrmDueSendCandidateRecord, now: Date) {
    const bullJobId = toCrmSendJobId(candidate.message.id, candidate.enrollment.runVersion);
    const queuedMessage = await this.store.updateMessage(
      candidate.message.id,
      candidate.message.organizationId,
      {
        status: 'queued',
        scheduledAt: now,
        bullJobId
      },
      { status: 'draft_ready' }
    );

    if (!queuedMessage) {
      return false;
    }

    try {
      await this.sendQueue.enqueueFirstMessage({
        enrollmentId: candidate.enrollment.id,
        messageId: candidate.message.id,
        organizationId: candidate.message.organizationId,
        ownerUserId: candidate.message.ownerUserId,
        runVersion: candidate.enrollment.runVersion
      });
      return true;
    } catch (error) {
      await this.store.updateMessage(
        candidate.message.id,
        candidate.message.organizationId,
        { status: 'draft_ready', bullJobId: null },
        { status: 'queued' }
      );
      throw error;
    }
  }

  /** Keeps a locally-invalid candidate draft-ready until the recipient's next send window. */
  private async deferCandidate(candidate: CrmDueSendCandidateRecord, nextAvailableAt: Date) {
    await this.store.updateMessage(
      candidate.message.id,
      candidate.message.organizationId,
      {
        status: 'draft_ready',
        scheduledAt: nextAvailableAt,
        bullJobId: null
      },
      { status: 'draft_ready' }
    );
  }
}

interface DateRange {
  from: Date;
  to: Date;
}

function toUtcRange(now: Date, unit: 'day' | 'hour'): DateRange {
  const from = new Date(now);
  from.setUTCMinutes(unit === 'hour' ? 0 : 0, 0, 0);

  if (unit === 'day') {
    from.setUTCHours(0, 0, 0, 0);
  }

  const to = new Date(from);

  if (unit === 'hour') {
    to.setUTCHours(to.getUTCHours() + 1);
  } else {
    to.setUTCDate(to.getUTCDate() + 1);
  }

  return { from, to };
}

function toOwnerKey(organizationId: string, ownerUserId: string) {
  return `${organizationId}:${ownerUserId}`;
}

function toMailboxKey(organizationId: string, mailboxId: string) {
  return `${organizationId}:${mailboxId}`;
}
