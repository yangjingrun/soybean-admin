import { Inject, Injectable } from '@nestjs/common';
import {
  defaultFollowUpSharePercent,
  defaultOwnerDailySendLimit,
  normalizeFollowUpSharePercent,
  normalizeOwnerConcurrentSendLimit,
  normalizeOwnerDailySendLimit,
  normalizeOwnerDailySendLimitMax
} from './crm-global-config';
import { toCrmSendJobId } from './crm-send-queue.service';
import { CRM_SEND_QUEUE, CRM_STORE } from './crm.tokens';
import type {
  CrmDueSendCandidateRecord,
  CrmScheduledMessageStepKind,
  CrmSendQueuePort,
  CrmStore
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

@Injectable()
export class CrmSendSchedulerService {
  constructor(
    @Inject(CRM_STORE) private readonly store: CrmStore,
    @Inject(CRM_SEND_QUEUE) private readonly sendQueue: CrmSendQueuePort
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
    let dispatchedCount = 0;
    let skippedCount = 0;

    for (const candidate of candidates) {
      const ownerKey = `${candidate.message.organizationId}:${candidate.message.ownerUserId}`;
      const state = await this.getOwnerState(ownerKey, candidate, {
        ownerDailySendLimitMax,
        concurrentLimit,
        dayRange,
        ownerStates
      });

      if (this.isOwnerCapacityFull(state)) {
        skippedCount += 1;
        continue;
      }

      if (!this.canUseShareSlot(candidate, candidates, state)) {
        skippedCount += 1;
        continue;
      }

      if (!(await this.hasMailboxCapacity(candidate, dayRange, hourRange))) {
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
    }

    return {
      scannedCount: candidates.length,
      dispatchedCount,
      skippedCount
    };
  }

  private async getOwnerState(
    ownerKey: string,
    candidate: CrmDueSendCandidateRecord,
    input: {
      ownerDailySendLimitMax: number;
      concurrentLimit: number;
      dayRange: DateRange;
      ownerStates: Map<string, OwnerDispatchState>;
    }
  ) {
    const existing = input.ownerStates.get(ownerKey);

    if (existing) {
      return existing;
    }

    const [preference, queuedCount, dailyCount, firstTouchCount, followUpCount] = await Promise.all([
      this.store.getSendPreference({
        organizationId: candidate.message.organizationId,
        ownerUserId: candidate.message.ownerUserId
      }),
      this.store.countOwnerQueuedMessages({
        organizationId: candidate.message.organizationId,
        ownerUserId: candidate.message.ownerUserId
      }),
      this.store.countDispatchedMessages({
        organizationId: candidate.message.organizationId,
        ownerUserId: candidate.message.ownerUserId,
        from: input.dayRange.from,
        to: input.dayRange.to
      }),
      this.store.countDispatchedMessages({
        organizationId: candidate.message.organizationId,
        ownerUserId: candidate.message.ownerUserId,
        stepKind: 'first_touch',
        from: input.dayRange.from,
        to: input.dayRange.to
      }),
      this.store.countDispatchedMessages({
        organizationId: candidate.message.organizationId,
        ownerUserId: candidate.message.ownerUserId,
        stepKind: 'follow_up',
        from: input.dayRange.from,
        to: input.dayRange.to
      })
    ]);
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
      queuedCount,
      dailyCount,
      firstTouchCount,
      followUpCount,
      dispatchedCount: 0,
      dispatchedByKind: {
        first_touch: 0,
        follow_up: 0
      }
    };

    input.ownerStates.set(ownerKey, state);

    return state;
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

  private async hasMailboxCapacity(candidate: CrmDueSendCandidateRecord, dayRange: DateRange, hourRange: DateRange) {
    const [dailyCount, hourlyCount] = await Promise.all([
      this.store.countDispatchedMessages({
        organizationId: candidate.message.organizationId,
        mailboxId: candidate.mailbox.id,
        from: dayRange.from,
        to: dayRange.to
      }),
      this.store.countDispatchedMessages({
        organizationId: candidate.message.organizationId,
        mailboxId: candidate.mailbox.id,
        from: hourRange.from,
        to: hourRange.to
      })
    ]);

    return dailyCount < candidate.mailbox.dailyLimit && hourlyCount < candidate.mailbox.hourlyLimit;
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
