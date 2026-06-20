import dayjs from 'dayjs';
import { shallowRef } from 'vue';

type WorkbenchRequestMode = 'initial' | 'refresh' | 'poll';

export interface WorkbenchRouteTarget {
  routePath: string;
  query?: Record<string, string>;
}

export interface WorkbenchRecommendation extends WorkbenchRouteTarget {
  key: string;
  title: string;
  description: string;
  actionText: string;
  icon: string;
}

export interface WorkbenchMetricCard extends WorkbenchRouteTarget {
  key: string;
  title: string;
  value: number;
  description: string;
  icon: string;
  accent: 'blue' | 'green' | 'amber' | 'red';
}

export interface WorkbenchTodoItem extends WorkbenchRouteTarget {
  key: string;
  title: string;
  description: string;
  count: number;
  tagType: NaiveUI.ThemeColor;
  icon: string;
}

export interface WorkbenchTrendOption {
  tooltip: Record<string, unknown>;
  legend: { data: string[]; top: number; right: number };
  grid: { left: number; right: number; top: number; bottom: number; containLabel: boolean };
  xAxis: { type: 'category'; boundaryGap: boolean; data: string[] };
  yAxis: { type: 'value'; minInterval: number; splitLine: { lineStyle: { color: string } } };
  series: Array<{
    name: string;
    type: 'line';
    smooth: boolean;
    symbolSize: number;
    lineStyle: { width: number };
    areaStyle?: { opacity: number };
    data: number[];
  }>;
}

export interface WorkbenchTaskCountMeta {
  completedCount: number;
  failedCount: number;
  pendingCount: number;
  totalCount: number;
}

const pendingReplyTarget: WorkbenchRouteTarget = {
  routePath: '/crm/inbox',
  query: { status: 'pending' }
};

const sentTodayTarget: WorkbenchRouteTarget = {
  routePath: '/crm/email-sequences',
  query: { messageStatus: 'sent', dateScope: 'today' }
};

const draftReviewTarget: WorkbenchRouteTarget = {
  routePath: '/crm/email-sequences',
  query: { todoType: 'draft_review_pending' }
};

const sendFailedTarget: WorkbenchRouteTarget = {
  routePath: '/crm/email-sequences',
  query: { todoType: 'send_failed' }
};

const mailboxIssueTarget: WorkbenchRouteTarget = {
  routePath: '/crm/settings'
};

const missingContactTarget: WorkbenchRouteTarget = {
  routePath: '/crm/leads',
  query: { status: 'missing_contact' }
};

const aiLeadTarget: WorkbenchRouteTarget = {
  routePath: '/ai-leads'
};

const startAiLeadTarget: WorkbenchRouteTarget = {
  routePath: '/ai-leads'
};

/** Pick the single action users should handle first on today's workbench. */
export function buildWorkbenchRecommendation(overview: Api.Crm.WorkbenchOverview | null): WorkbenchRecommendation {
  const today = overview?.today;

  if (!today) {
    return {
      key: 'loading',
      title: '正在同步今日工作',
      description: '首页会汇总客户回信、发送进度、草稿审核和线索质量。',
      actionText: '刷新工作台',
      icon: 'mdi:refresh',
      routePath: ''
    };
  }

  if (today.pendingReplyCount > 0) {
    return {
      key: 'pending-replies',
      title: '先处理客户回信',
      description: `${today.pendingReplyCount} 封客户回信待处理，优先回复能缩短跟进周期。`,
      actionText: '处理回信',
      icon: 'mdi:email-alert-outline',
      ...pendingReplyTarget
    };
  }

  if (today.sendFailedCount > 0 || today.mailboxIssueCount > 0) {
    const target = today.sendFailedCount > 0 ? sendFailedTarget : mailboxIssueTarget;

    return {
      key: 'send-exceptions',
      title: '先修复发送异常',
      description: `发送失败 ${today.sendFailedCount} 封，邮箱异常 ${today.mailboxIssueCount} 个。`,
      actionText: today.sendFailedCount > 0 ? '查看失败邮件' : '检查邮箱',
      icon: 'mdi:alert-circle-outline',
      ...target
    };
  }

  if (today.draftReviewCount > 0) {
    return {
      key: 'draft-review',
      title: '审核待发送草稿',
      description: `待审核 ${today.draftReviewCount} 封，首封 ${today.firstDraftReviewCount} 封，跟进 ${today.followUpDraftReviewCount} 封。`,
      actionText: '审核草稿',
      icon: 'mdi:file-document-edit-outline',
      ...draftReviewTarget
    };
  }

  const leadIssueCount = countLeadIssues(today);
  if (leadIssueCount > 0) {
    return {
      key: 'lead-quality',
      title: '补齐线索资料',
      description: `还有 ${leadIssueCount} 条线索需要补资料或验证邮箱。`,
      actionText: '处理线索',
      icon: 'mdi:account-search-outline',
      ...buildLeadQualityTarget(today)
    };
  }

  if (today.aiLeadTaskPendingCount > 0) {
    return {
      key: 'ai-lead-results',
      title: '查看 AI 获客结果',
      description: `${today.aiLeadTaskPendingCount} 个获客任务有新结果待确认。`,
      actionText: '查看结果',
      icon: 'mdi:creation-outline',
      ...aiLeadTarget
    };
  }

  return {
    key: 'start-ai-leads',
    title: '开始一轮新获客',
    description: '今天暂无待办，可以从 AI 获客开始补充客户池。',
    actionText: '开始获客',
    icon: 'mdi:target-account',
    ...startAiLeadTarget
  };
}

/** Build the four top cards for the workbench first viewport. */
export function buildWorkbenchMetricCards(overview: Api.Crm.WorkbenchOverview | null): WorkbenchMetricCard[] {
  const today = overview?.today;
  const yesterday = overview?.yesterday;

  return [
    {
      key: 'pending-replies',
      title: '待处理回信',
      value: today?.pendingReplyCount ?? 0,
      description: `今日共 ${today?.totalReplyCount ?? 0} 封，${formatDelta('较昨天', (today?.totalReplyCount ?? 0) - (yesterday?.totalReplyCount ?? 0))}`,
      icon: 'mdi:email-fast-outline',
      accent: 'blue',
      ...pendingReplyTarget
    },
    {
      key: 'sent-today',
      title: '今日已发送',
      value: today?.sentCount ?? 0,
      description: `队列 ${today?.queuedCount ?? 0} 封，失败 ${today?.failedCount ?? 0} 封，${formatDelta('较昨天', (today?.sentCount ?? 0) - (yesterday?.sentCount ?? 0))}`,
      icon: 'mdi:send-check-outline',
      accent: 'green',
      ...sentTodayTarget
    },
    {
      key: 'draft-review',
      title: '待审核草稿',
      value: today?.draftReviewCount ?? 0,
      description: `首封 ${today?.firstDraftReviewCount ?? 0} 封，跟进 ${today?.followUpDraftReviewCount ?? 0} 封`,
      icon: 'mdi:file-document-edit-outline',
      accent: 'amber',
      ...draftReviewTarget
    },
    {
      key: 'send-exceptions',
      title: '发送/邮箱异常',
      value: (today?.sendFailedCount ?? 0) + (today?.mailboxIssueCount ?? 0),
      description: `发送失败 ${today?.sendFailedCount ?? 0} 封，邮箱异常 ${today?.mailboxIssueCount ?? 0} 个`,
      icon: 'mdi:alert-circle-outline',
      accent: 'red',
      ...(today?.sendFailedCount ? sendFailedTarget : mailboxIssueTarget)
    }
  ];
}

/** Build the compact ordered todo list below the chart. */
export function buildWorkbenchTodoItems(overview: Api.Crm.WorkbenchOverview | null): WorkbenchTodoItem[] {
  const today = overview?.today;
  if (!today) return [];

  const items: WorkbenchTodoItem[] = [];

  pushTodo(items, {
    key: 'pending-replies',
    title: '客户回信待处理',
    description: `今日总回信 ${today.totalReplyCount} 封`,
    count: today.pendingReplyCount,
    tagType: 'warning',
    icon: 'mdi:email-alert-outline',
    ...pendingReplyTarget
  });

  pushTodo(items, {
    key: 'send-failed',
    title: '发送失败需要处理',
    description: `邮箱异常 ${today.mailboxIssueCount} 个`,
    count: today.sendFailedCount,
    tagType: 'error',
    icon: 'mdi:send-lock-outline',
    ...sendFailedTarget
  });

  pushTodo(items, {
    key: 'mailbox-issue',
    title: '邮箱授权或暂停',
    description: '修复后才能继续稳定发送',
    count: today.mailboxIssueCount,
    tagType: 'error',
    icon: 'mdi:mailbox-open-up-outline',
    ...mailboxIssueTarget
  });

  pushTodo(items, {
    key: 'draft-review',
    title: '草稿待审核',
    description: `首封 ${today.firstDraftReviewCount} 封，跟进 ${today.followUpDraftReviewCount} 封，风险提示 ${today.riskyDraftReviewCount} 封`,
    count: today.draftReviewCount,
    tagType: 'info',
    icon: 'mdi:file-document-edit-outline',
    ...draftReviewTarget
  });

  pushTodo(items, {
    key: 'lead-quality',
    title: '线索资料待补齐',
    description: `缺联系人 ${today.missingContactCount} 条，待验证 ${today.emailVerificationPendingCount} 条，风险邮箱 ${today.riskyEmailCount} 条`,
    count: countLeadIssues(today),
    tagType: 'warning',
    icon: 'mdi:account-search-outline',
    ...buildLeadQualityTarget(today)
  });

  pushTodo(items, {
    key: 'ai-lead-results',
    title: 'AI 获客结果待确认',
    description: '查看任务结果并导入有价值客户',
    count: today.aiLeadTaskPendingCount,
    tagType: 'success',
    icon: 'mdi:creation-outline',
    ...aiLeadTarget
  });

  return items;
}

/** Build the 7-day ECharts option for sent emails and customer replies. */
export function buildWorkbenchTrendOption(trend: Api.Crm.WorkbenchTrendPoint[]): WorkbenchTrendOption {
  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['发送邮件', '客户回复'],
      top: 0,
      right: 0
    },
    grid: {
      left: 0,
      right: 8,
      top: 42,
      bottom: 4,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map(item => dayjs(item.date).format('MM-DD'))
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: {
        lineStyle: {
          color: 'rgba(148, 163, 184, 0.18)'
        }
      }
    },
    series: [
      {
        name: '发送邮件',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.08 },
        data: trend.map(item => item.sentCount)
      },
      {
        name: '客户回复',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.06 },
        data: trend.map(item => item.replyCount)
      }
    ]
  };
}

/** Check whether the home page should poll the workbench endpoint. */
export function shouldPollWorkbench(overview: Api.Crm.WorkbenchOverview | null) {
  return Boolean(overview?.runningTasks.some(task => ['queued', 'running'].includes(task.status)));
}

export function formatWorkbenchUpdatedAt(value: string | null | undefined) {
  return value ? dayjs(value).format('HH:mm:ss') : '--';
}

export function formatTaskProgress(task: Api.Crm.WorkbenchRunningTask) {
  if (typeof task.progressPercent === 'number') {
    return Math.max(0, Math.min(100, Math.round(task.progressPercent)));
  }

  const totalCount = Math.max(task.totalCount, task.completedCount + task.failedCount + task.pendingCount);
  if (totalCount <= 0) return 0;

  return Math.round(((task.completedCount + task.failedCount) / totalCount) * 100);
}

/** Keep request indicators independent from stale data response guards. */
export function createWorkbenchLoadingTracker() {
  const loading = shallowRef(false);
  const refreshing = shallowRef(false);
  let initialCount = 0;
  let refreshCount = 0;

  function start(mode: WorkbenchRequestMode) {
    let finished = false;

    if (mode === 'initial') {
      initialCount += 1;
      loading.value = true;
    }

    if (mode === 'refresh') {
      refreshCount += 1;
      refreshing.value = true;
    }

    return () => {
      if (finished) return;
      finished = true;

      if (mode === 'initial') {
        initialCount = Math.max(0, initialCount - 1);
        loading.value = initialCount > 0;
      }

      if (mode === 'refresh') {
        refreshCount = Math.max(0, refreshCount - 1);
        refreshing.value = refreshCount > 0;
      }
    };
  }

  return {
    loading,
    refreshing,
    start
  };
}

/** Derive display counts from backend task progress when the raw counters are coarse. */
export function formatTaskCountMeta(task: Api.Crm.WorkbenchRunningTask): WorkbenchTaskCountMeta {
  if (task.type === 'ai_leads' && ['queued', 'running'].includes(task.status)) {
    const progress = formatTaskProgress(task);
    const completedCount = Math.min(task.totalCount, Math.max(0, Math.round((task.totalCount * progress) / 100)));

    return {
      completedCount,
      failedCount: task.failedCount,
      pendingCount: Math.max(0, task.totalCount - completedCount - task.failedCount),
      totalCount: task.totalCount
    };
  }

  return {
    completedCount: task.completedCount,
    failedCount: task.failedCount,
    pendingCount: task.pendingCount,
    totalCount: task.totalCount
  };
}

export function formatTaskStatus(status: string) {
  const labelMap: Record<string, string> = {
    queued: '排队中',
    running: '进行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  };

  return labelMap[status] ?? status;
}

function pushTodo(items: WorkbenchTodoItem[], item: WorkbenchTodoItem) {
  if (item.count <= 0) return;

  items.push(item);
}

function countLeadIssues(today: Api.Crm.WorkbenchTodayStats) {
  return today.missingContactCount + today.emailVerificationPendingCount + today.riskyEmailCount;
}

function buildLeadQualityTarget(today: Api.Crm.WorkbenchTodayStats): WorkbenchRouteTarget {
  if (today.missingContactCount > 0) return missingContactTarget;
  if (today.emailVerificationPendingCount > 0) {
    return {
      routePath: '/crm/leads',
      query: { status: 'email_verification_pending' }
    };
  }

  return {
    routePath: '/crm/leads',
    query: { status: 'manual_review_pending' }
  };
}

function formatDelta(label: string, value: number) {
  if (value === 0) return `${label} 持平`;

  return `${label} ${value > 0 ? '+' : ''}${value}`;
}
