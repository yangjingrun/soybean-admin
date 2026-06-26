interface CliOptions {
  domain: string;
  company: string | null;
  apiBase: string;
  limit: number;
  jobTitles: string[];
  raw: boolean;
}

interface LeadContactEmployee {
  fullName?: string;
  title?: string;
  companyName?: string;
  country?: string;
  location?: string;
  linkedinUrl?: string;
}

interface LeadContactEmailSource {
  name?: string;
  email?: string;
  valid?: boolean;
  personal?: boolean;
}

interface LeadContactRow {
  fullName: string | null;
  title: string | null;
  companyName: string | null;
  location: string | null;
  linkedinUrl: string;
  emails: Array<{
    email: string;
    valid: boolean;
    personal: boolean;
    sourceName: string | null;
    emailType: 'work' | 'personal';
  }>;
}

const defaultApiBase = 'https://api.leadcontact.ai';

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const token = process.env.LEADCONTACT_API_KEY?.trim() || process.env.LEADCONTACT_TOKEN?.trim();

  if (!token) {
    throw new Error('请先设置 LEADCONTACT_API_KEY，例如：LEADCONTACT_API_KEY=xxx pnpm exec tsx ...');
  }

  console.log(`查询公司域名：${options.domain}`);
  console.log(`查询公司名称：${options.company ?? '-'}`);
  console.log(`员工检索职位：${options.jobTitles.length ? options.jobTitles.join(', ') : '全部职位'}`);

  const employeeResult = await queryEmployees(options, token, 'domain');
  let employees = selectEmployees(employeeResult, options.limit);

  if (employees.length === 0 && options.company) {
    console.log('域名未命中员工，改用公司名回退查询。');
    const companyEmployeeResult = await queryEmployees(options, token, 'company');
    employees = selectEmployees(companyEmployeeResult, options.limit);

    if (options.raw) {
      (employeeResult as Record<string, unknown>).companyFallbackRaw = companyEmployeeResult;
    }
  }

  console.log(`员工结果：${employees.length} 个带 LinkedIn 的候选人`);

  const rows: LeadContactRow[] = [];

  for (const employee of employees) {
    const linkedinUrl = normalizeString(employee.linkedinUrl);

    if (!linkedinUrl) {
      continue;
    }

    const emailResult = await queryEmail(options, token, linkedinUrl);
    const emails = readEmailSources(emailResult)
      .filter(source => normalizeString(source.email))
      .map(source => {
        const email = normalizeString(source.email);

        return {
          email,
          valid: source.valid === true,
          personal: source.personal === true,
          sourceName: normalizeString(source.name) || null,
          emailType: resolveEmailType(email, options.domain, source)
        };
      });

    rows.push({
      fullName: normalizeString(employee.fullName) || null,
      title: normalizeString(employee.title) || null,
      companyName: normalizeString(employee.companyName) || null,
      location: normalizeString(employee.location) || normalizeString(employee.country) || null,
      linkedinUrl,
      emails
    });
  }

  if (options.raw) {
    console.log(
      JSON.stringify(
        {
          employeesRaw: employeeResult,
          rows
        },
        null,
        2
      )
    );
    return;
  }

  console.log(JSON.stringify({ domain: options.domain, count: rows.length, rows }, null, 2));
}

/** 按公司域名查询 LeadContact 员工列表。 */
async function queryEmployees(options: CliOptions, token: string, mode: 'domain' | 'company') {
  return postJson(`${options.apiBase}/api/rest/employess/query/advanced`, token, {
    ...(mode === 'company' && options.company ? { company: [options.company] } : { domain: [options.domain] }),
    ...(options.jobTitles.length ? { jobTitle: options.jobTitles } : {}),
    companyFilter: 'current',
    currentTitlesOnly: true,
    includeRelatedJobTitles: true
  });
}

/** 用员工 LinkedIn URL 查询邮箱。 */
async function queryEmail(options: CliOptions, token: string, profileUrl: string) {
  return postJson(`${options.apiBase}/api/rest/email/query`, token, { profileUrl });
}

async function postJson(url: string, token: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`LeadContact 请求失败：${response.status} ${text}`);
  }

  return data;
}

function selectEmployees(result: unknown, limit: number) {
  return readEmployees(result)
    .filter(employee => normalizeString(employee.linkedinUrl))
    .sort(compareEmployees)
    .slice(0, limit);
}

function readEmployees(result: unknown): LeadContactEmployee[] {
  const employees = (result as { data?: { employees?: unknown } } | null)?.data?.employees;

  return Array.isArray(employees) ? employees.filter(isObject) : [];
}

function readEmailSources(result: unknown): LeadContactEmailSource[] {
  const sources = (result as { data?: { sources?: unknown } } | null)?.data?.sources;

  return Array.isArray(sources) ? sources.filter(isObject) : [];
}

function compareEmployees(left: LeadContactEmployee, right: LeadContactEmployee) {
  return scoreEmployee(right) - scoreEmployee(left);
}

function scoreEmployee(employee: LeadContactEmployee) {
  const title = normalizeString(employee.title).toLowerCase();
  const buyerLike = /owner|founder|ceo|general manager|sales|business development|procurement|purchas|buyer|sourcing/.test(
    title
  );
  const managerLike = /manager|director|head|vp|chief/.test(title);

  return Number(buyerLike) * 10 + Number(managerLike) * 5;
}

function resolveEmailType(email: string, companyDomain: string, source: LeadContactEmailSource): 'work' | 'personal' {
  if (source.personal === true) {
    return 'personal';
  }

  const emailDomain = email.split('@')[1]?.trim().toLowerCase() || '';

  return emailDomain === companyDomain.toLowerCase() ? 'work' : 'personal';
}

function parseCliOptions(args: string[]): CliOptions {
  const domain = readOption(args, '--domain') || args.find(item => !item.startsWith('--')) || 'wasatalbadeel.com';
  const limit = Number(readOption(args, '--limit') || '5');
  const titles = readOption(args, '--titles');

  return {
    domain: normalizeDomain(domain),
    company: readOption(args, '--company')?.trim() || null,
    apiBase: (readOption(args, '--api-base') || defaultApiBase).replace(/\/+$/, ''),
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 20) : 5,
    jobTitles: titles ? titles.split(',').map(item => item.trim()).filter(Boolean) : [],
    raw: args.includes('--raw')
  };
}

function readOption(args: string[], name: string) {
  const exact = args.find(item => item.startsWith(`${name}=`));

  if (exact) {
    return exact.slice(name.length + 1);
  }

  const index = args.indexOf(name);

  return index >= 0 ? args[index + 1] : undefined;
}

function normalizeDomain(value: string) {
  const trimmed = value.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return new URL(trimmed).hostname.replace(/^www\./i, '').toLowerCase();
  }

  return trimmed.replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
