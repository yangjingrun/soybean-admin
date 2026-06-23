import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  addCrmBusinessDays,
  applyEnrollmentStat,
  applyMessageStat,
  buildPersonaStatMap,
  countDates,
  createEmptyStrategyRows,
  formatCrmBusinessDateKey,
  getOrCreateStrategyStatRow,
  isDate,
  readProgressPercent,
  sortStrategyRows,
  startOfCrmBusinessDay,
  toDateRange,
  toScopedOrganizationWhere
} from './prisma-crm-store.helpers';
import type {
  CrmMessageRecord,
  CrmSequenceEnrollmentStatus,
  CrmStrategyStatDimension,
  CrmStrategyStatsRecord,
  CrmWorkbenchOverviewRecord
} from '../crm.types';
import type { CrmDashboardRepository } from '../dashboard/crm-dashboard.repository';

@Injectable()
export class PrismaCrmDashboardStore implements CrmDashboardRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getWorkbenchOverview(args: {
    organizationId: string;
    ownerUserId: string;
    now: Date;
  }): Promise<CrmWorkbenchOverviewRecord> {
    const todayStart = startOfCrmBusinessDay(args.now);
    const tomorrowStart = addCrmBusinessDays(todayStart, 1);
    const yesterdayStart = addCrmBusinessDays(todayStart, -1);
    const trendStart = addCrmBusinessDays(todayStart, -6);
    const scopedWhere = toScopedOrganizationWhere(args);
    const todayRange = toDateRange(todayStart, tomorrowStart);
    const yesterdayRange = toDateRange(yesterdayStart, todayStart);
    const trendDays = Array.from({ length: 7 }, (_, index) => addCrmBusinessDays(trendStart, index));

    const [
      sentCount,
      queuedCount,
      failedCount,
      pendingReplyCount,
      totalReplyCount,
      draftReviewCount,
      firstDraftReviewCount,
      followUpDraftReviewCount,
      riskyDraftReviewCount,
      sendFailedCount,
      mailboxIssueCount,
      missingContactCount,
      emailVerificationPendingCount,
      riskyEmailCount,
      aiLeadTaskPendingCount,
      yesterdaySentCount,
      yesterdayReplyCount,
      trendSentRecords,
      trendReplyRecords,
      aiDraftTasks,
      aiLeadTask
    ] = await Promise.all([
      this.prisma.crmMessage.count({
        where: {
          ...scopedWhere,
          status: 'sent',
          sentAt: todayRange
        }
      }),
      this.prisma.crmMessage.count({
        where: {
          ...scopedWhere,
          status: 'queued'
        }
      }),
      this.prisma.crmMessage.count({
        where: {
          ...scopedWhere,
          status: 'failed'
        }
      }),
      this.prisma.crmInboxThread.count({
        where: {
          ...scopedWhere,
          status: 'pending'
        }
      }),
      this.prisma.crmInboxMessage.count({
        where: {
          ...scopedWhere,
          receivedAt: todayRange
        }
      }),
      this.prisma.crmMessage.count({
        where: {
          ...scopedWhere,
          status: 'draft_pending_review'
        }
      }),
      this.prisma.crmMessage.count({
        where: {
          ...scopedWhere,
          status: 'draft_pending_review',
          stepIndex: 1
        }
      }),
      this.prisma.crmMessage.count({
        where: {
          ...scopedWhere,
          status: 'draft_pending_review',
          stepIndex: { gt: 1 }
        }
      }),
      this.prisma.crmMessage.count({
        where: {
          ...scopedWhere,
          status: 'draft_pending_review',
          metadata: { path: ['aiDraft', 'riskNotes'], not: Prisma.JsonNull }
        }
      }),
      this.prisma.crmMessage.count({
        where: {
          ...scopedWhere,
          status: 'failed'
        }
      }),
      this.prisma.crmMailbox.count({
        where: {
          ...scopedWhere,
          status: { in: ['paused', 'auth_expired', 'revoked'] }
        }
      }),
      this.prisma.crmAccount.count({
        where: {
          ...scopedWhere,
          status: 'missing_contact'
        }
      }),
      this.prisma.crmContact.count({
        where: {
          ...scopedWhere,
          emailStatus: 'unchecked'
        }
      }),
      this.prisma.crmContact.count({
        where: {
          ...scopedWhere,
          emailStatus: { in: ['risky', 'invalid', 'unreachable'] }
        }
      }),
      this.prisma.aiLeadSearchTask.count({
        where: {
          organizationId: args.organizationId,
          userId: args.ownerUserId,
          status: 'completed',
          readAt: null
        }
      }),
      this.prisma.crmMessage.count({
        where: {
          ...scopedWhere,
          status: 'sent',
          sentAt: yesterdayRange
        }
      }),
      this.prisma.crmInboxMessage.count({
        where: {
          ...scopedWhere,
          receivedAt: yesterdayRange
        }
      }),
      this.prisma.crmMessage.findMany({
        where: {
          ...scopedWhere,
          status: 'sent',
          sentAt: {
            gte: trendStart,
            lt: tomorrowStart
          }
        },
        select: { sentAt: true }
      }),
      this.prisma.crmInboxMessage.findMany({
        where: {
          ...scopedWhere,
          receivedAt: {
            gte: trendStart,
            lt: tomorrowStart
          }
        },
        select: { receivedAt: true }
      }),
      this.prisma.crmAiDraftTask.findMany({
        where: {
          ...scopedWhere,
          status: { in: ['queued', 'running', 'failed', 'completed'] },
          OR: [{ status: { in: ['queued', 'running'] } }, { readAt: null }]
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 2
      }),
      this.prisma.aiLeadSearchTask.findFirst({
        where: {
          organizationId: args.organizationId,
          userId: args.ownerUserId,
          status: { in: ['queued', 'running', 'failed', 'completed'] },
          OR: [{ status: { in: ['queued', 'running'] } }, { readAt: null }]
        },
        orderBy: { updatedAt: 'desc' }
      })
    ]);

    const sentByDate = countDates(trendSentRecords.map(record => record.sentAt).filter(isDate));
    const repliesByDate = countDates(trendReplyRecords.map(record => record.receivedAt));
    const runningTasks = [
      ...aiDraftTasks.map(task => ({
        id: task.id,
        type: 'ai_draft' as const,
        title: 'AI 草稿生成',
        status: task.status,
        totalCount: task.requestedCount,
        completedCount: task.successCount,
        failedCount: task.failedCount,
        pendingCount: task.pendingCount + task.runningCount + task.retryingCount,
        routePath: '/crm/email-sequences'
      })),
      ...(aiLeadTask
        ? [
            {
              id: aiLeadTask.id,
              type: 'ai_leads' as const,
              title: 'AI 获客任务',
              status: aiLeadTask.status,
              totalCount: aiLeadTask.targetLeadCount,
              completedCount: aiLeadTask.status === 'completed' ? aiLeadTask.targetLeadCount : 0,
              failedCount: aiLeadTask.status === 'failed' ? 1 : 0,
              pendingCount: ['queued', 'running'].includes(aiLeadTask.status) ? aiLeadTask.targetLeadCount : 0,
              progressPercent: readProgressPercent(aiLeadTask.progressState, aiLeadTask.status),
              routePath: '/ai-leads'
            }
          ]
        : []),
      ...(queuedCount + failedCount > 0
        ? [
            {
              id: 'send-queue',
              type: 'send' as const,
              title: '开发信发送',
              status: failedCount > 0 ? 'failed' : 'queued',
              totalCount: queuedCount + failedCount,
              completedCount: 0,
              failedCount,
              pendingCount: queuedCount,
              routePath: '/crm/email-sequences'
            }
          ]
        : [])
    ].slice(0, 3);

    return {
      generatedAt: args.now,
      today: {
        sentCount,
        queuedCount,
        failedCount,
        pendingReplyCount,
        totalReplyCount,
        draftReviewCount,
        firstDraftReviewCount,
        followUpDraftReviewCount,
        riskyDraftReviewCount,
        issueCount: sendFailedCount + mailboxIssueCount,
        sendFailedCount,
        mailboxIssueCount,
        missingContactCount,
        emailVerificationPendingCount,
        riskyEmailCount,
        aiLeadTaskPendingCount
      },
      yesterday: {
        sentCount: yesterdaySentCount,
        totalReplyCount: yesterdayReplyCount
      },
      trend: trendDays.map(date => {
        const key = formatCrmBusinessDateKey(date);

        return {
          date: key,
          sentCount: sentByDate.get(key) ?? 0,
          replyCount: repliesByDate.get(key) ?? 0
        };
      }),
      runningTasks
    };
  }

  async listStrategyStats(args: { organizationId: string; ownerUserId?: string }): Promise<CrmStrategyStatsRecord> {
    const where = toScopedOrganizationWhere(args);
    const [enrollments, personaEvents] = await Promise.all([
      this.prisma.crmSequenceEnrollment.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          productLine: true,
          policy: true,
          messages: {
            orderBy: [{ stepIndex: 'asc' as const }, { createdAt: 'asc' as const }]
          }
        }
      }),
      this.prisma.crmTimelineEvent.findMany({
        where: {
          ...where,
          eventType: {
            in: ['sequence_draft_generated', 'sequence_follow_up_draft_generated']
          }
        },
        orderBy: { createdAt: 'asc' }
      })
    ]);
    const personaByEnrollmentId = buildPersonaStatMap(personaEvents);
    const rows = createEmptyStrategyRows();

    for (const enrollment of enrollments) {
      const statInputs: Array<{
        dimension: CrmStrategyStatDimension;
        key: string;
        name: string;
      }> = [
        { dimension: 'template', key: 'default_template', name: '默认模板' },
        {
          dimension: 'policy',
          key: enrollment.policy?.id ?? 'none',
          name: enrollment.policy?.name ?? '未设置策略'
        },
        {
          dimension: 'productLine',
          key: enrollment.productLine?.id ?? 'none',
          name: enrollment.productLine?.name ?? '未设置产品线'
        },
        {
          dimension: 'persona',
          key: personaByEnrollmentId.get(enrollment.id)?.key ?? 'unknown',
          name: personaByEnrollmentId.get(enrollment.id)?.name ?? '未匹配画像'
        }
      ];

      for (const input of statInputs) {
        const row = getOrCreateStrategyStatRow(rows[input.dimension], input);
        applyEnrollmentStat(row, enrollment.status as CrmSequenceEnrollmentStatus);

        // ready/queued/sent/failed 统计本地 message 状态，不依赖 Gmail 真实投递结果。
        for (const message of enrollment.messages) {
          applyMessageStat(row, message.status as CrmMessageRecord['status']);
        }
      }
    }

    return {
      generatedAt: new Date(),
      rows: {
        template: sortStrategyRows(rows.template),
        policy: sortStrategyRows(rows.policy),
        persona: sortStrategyRows(rows.persona),
        productLine: sortStrategyRows(rows.productLine)
      }
    };
  }
}
