/**
 * BNPL dashboard data: SQL builders and loader. Mirrors dashboard.py funnel + loan book + metrics.
 * Env: EXCLUDE_TEST_USERS (optional, default true) for test-user exclusion.
 */

import type { Connection } from 'snowflake-sdk';
import { runCount, runScalar, executeAsync } from './snowflake';

const EXCLUDE_TEST_USERS =
  (process.env.EXCLUDE_TEST_USERS ?? 'true').toLowerCase() === 'true' ||
  (process.env.EXCLUDE_TEST_USERS ?? 'true') === '1';
const EXCL_CP = EXCLUDE_TEST_USERS
  ? " AND ID NOT IN (SELECT ID FROM CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_PROFILE WHERE LOWER(EMAIL) LIKE '%stitch.money%')"
  : '';
const EXCL_PLAN = EXCLUDE_TEST_USERS
  ? " AND CONSUMER_PROFILE_ID NOT IN (SELECT ID FROM CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_PROFILE WHERE LOWER(EMAIL) LIKE '%stitch.money%')"
  : '';

function fd(f: string): string {
  return (f || '').slice(0, 10);
}

export function appliedCountSql(from?: string, to?: string): string {
  if (from && to) {
    return `SELECT COUNT(*) AS n FROM CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_PROFILE WHERE DATE(CREATED_AT) >= '${fd(from)}' AND DATE(CREATED_AT) <= '${fd(to)}'${EXCL_CP}`;
  }
  return `SELECT COUNT(*) AS n FROM CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_PROFILE WHERE 1=1${EXCL_CP}`;
}

export function approvedCountSql(from?: string, to?: string): string {
  if (from && to) {
    return `SELECT COUNT(*) AS n FROM CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_PROFILE WHERE UPPER(TRIM(CREDIT_CHECK_STATUS)) != 'REJECTED' AND DATE(CREATED_AT) >= '${fd(from)}' AND DATE(CREATED_AT) <= '${fd(to)}'${EXCL_CP}`;
  }
  return `SELECT COUNT(*) AS n FROM CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_PROFILE WHERE UPPER(TRIM(CREDIT_CHECK_STATUS)) != 'REJECTED'${EXCL_CP}`;
}

export function kycVerifiedCountSql(from?: string, to?: string): string {
  if (from && to) {
    return `SELECT COUNT(*) AS n FROM CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_PROFILE WHERE UPPER(TRIM(kyc_status)) IN ('VERIFIED', 'COMPLETE', 'SUCCESS') AND DATE(CREATED_AT) >= '${fd(from)}' AND DATE(CREATED_AT) <= '${fd(to)}'${EXCL_CP}`;
  }
  return `SELECT COUNT(*) AS n FROM CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_PROFILE WHERE UPPER(TRIM(kyc_status)) IN ('VERIFIED', 'COMPLETE', 'SUCCESS')${EXCL_CP}`;
}

export function planCreationSql(from?: string, to?: string): string {
  if (from && to) {
    return `SELECT COUNT(*) AS n FROM (SELECT DISTINCT ip.CONSUMER_PROFILE_ID FROM CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT ca INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT_INSTALMENT_LINK cal ON cal.COLLECTION_ATTEMPT_ID = ca.ID INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT i ON i.ID = cal.INSTALMENT_ID INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN ip ON ip.ID = i.INSTALMENT_PLAN_ID WHERE UPPER(TRIM(ca.TYPE)) = 'INITIAL' AND DATE(COALESCE(ca.EXECUTED_AT, ca.CREATED_AT)) >= '${fd(from)}' AND DATE(COALESCE(ca.EXECUTED_AT, ca.CREATED_AT)) <= '${fd(to)}'${EXCL_PLAN}) t`;
  }
  return `SELECT COUNT(*) AS n FROM (SELECT DISTINCT ip.CONSUMER_PROFILE_ID FROM CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT ca INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT_INSTALMENT_LINK cal ON cal.COLLECTION_ATTEMPT_ID = ca.ID INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT i ON i.ID = cal.INSTALMENT_ID INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN ip ON ip.ID = i.INSTALMENT_PLAN_ID WHERE UPPER(TRIM(ca.TYPE)) = 'INITIAL'${EXCL_PLAN}) t`;
}

export function initialCollectionSql(from?: string, to?: string): string {
  if (from && to) {
    return `SELECT COUNT(*) AS n FROM (SELECT DISTINCT ip.CONSUMER_PROFILE_ID FROM CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT ca INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT_INSTALMENT_LINK cal ON cal.COLLECTION_ATTEMPT_ID = ca.ID INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT i ON i.ID = cal.INSTALMENT_ID INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN ip ON ip.ID = i.INSTALMENT_PLAN_ID WHERE UPPER(TRIM(ca.TYPE)) = 'INITIAL' AND UPPER(TRIM(ca.STATUS)) = 'COMPLETED' AND DATE(COALESCE(ca.EXECUTED_AT, ca.CREATED_AT)) >= '${fd(from)}' AND DATE(COALESCE(ca.EXECUTED_AT, ca.CREATED_AT)) <= '${fd(to)}'${EXCL_PLAN}) t`;
  }
  return `SELECT COUNT(*) AS n FROM (SELECT DISTINCT ip.CONSUMER_PROFILE_ID FROM CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT ca INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT_INSTALMENT_LINK cal ON cal.COLLECTION_ATTEMPT_ID = ca.ID INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT i ON i.ID = cal.INSTALMENT_ID INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN ip ON ip.ID = i.INSTALMENT_PLAN_ID WHERE UPPER(TRIM(ca.TYPE)) = 'INITIAL' AND UPPER(TRIM(ca.STATUS)) = 'COMPLETED'${EXCL_PLAN}) t`;
}

export function consumersWithPlanSql(from?: string, to?: string): string {
  if (from && to) {
    return `SELECT COUNT(*) AS n FROM (SELECT DISTINCT CONSUMER_PROFILE_ID FROM CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN WHERE DATE(CREATED_AT) >= '${fd(from)}' AND DATE(CREATED_AT) <= '${fd(to)}'${EXCL_PLAN}) t`;
  }
  return `SELECT COUNT(*) AS n FROM (SELECT DISTINCT CONSUMER_PROFILE_ID FROM CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN WHERE 1=1${EXCL_PLAN}) t`;
}

const OVERDUE_COUNT_SQL = `SELECT COUNT(*) AS n FROM CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT i WHERE i.next_execution_date IS NOT NULL AND (UPPER(TRIM(i.status)) = 'PENDING' OR UPPER(TRIM(i.status)) = 'OVERDUE')`;

const CREDIT_ALLOCATED_SQL = `SELECT COALESCE(SUM(CREDIT_LIMIT), 0) AS total FROM "CDC_CREDITMASTER_PRODUCTION"."PUBLIC"."CREDIT_BALANCE"`;

function loanBookSettledSql(from?: string, to?: string): string {
  if (from && to) {
    return `SELECT COALESCE(SUM(COALESCE(ip.QUANTITY, ip.VALUE, ip.AMOUNT, ip.TOTAL_AMOUNT, 0)), 0) AS total FROM CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN ip WHERE DATE(ip.CREATED_AT) >= '${fd(from)}' AND DATE(ip.CREATED_AT) <= '${fd(to)}'${EXCL_PLAN}`;
  }
  return `SELECT COALESCE(SUM(COALESCE(ip.QUANTITY, ip.VALUE, ip.AMOUNT, ip.TOTAL_AMOUNT, 0)), 0) AS total FROM CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN ip WHERE 1=1${EXCL_PLAN}`;
}

function loanBookCollectedSql(from?: string, to?: string): string {
  const base = `SELECT COALESCE(SUM(COALESCE(i.QUANTITY, i.AMOUNT, 0)), 0) AS total FROM CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT i INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN ip ON ip.ID = i.INSTALMENT_PLAN_ID WHERE EXISTS (SELECT 1 FROM CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT_INSTALMENT_LINK cail INNER JOIN CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT ca ON ca.ID = cail.COLLECTION_ATTEMPT_ID WHERE cail.INSTALMENT_ID = i.ID AND UPPER(TRIM(ca.STATUS)) = 'COMPLETED')`;
  const excl = EXCL_PLAN.replace('CONSUMER_PROFILE_ID', 'ip.CONSUMER_PROFILE_ID');
  if (from && to) {
    return `${base} AND DATE(i.CREATED_AT) >= '${fd(from)}' AND DATE(i.CREATED_AT) <= '${fd(to)}'${excl}`;
  }
  return base + excl;
}

const INSTALMENT_PLAN_COUNT_SQL = `SELECT COUNT(*) AS n FROM CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN WHERE (UPPER(TRIM(STATUS)) = 'ACTIVE' OR UPPER(TRIM(STATUS)) = 'COMPLETED')`;

async function loadMerchantBreakdown(
  conn: Connection,
  from?: string,
  to?: string
): Promise<MerchantRow[]> {
  try {
    const rows = await executeAsync(conn, merchantBreakdownSql(from, to));
    if (!rows?.length) return [];
    return rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const get = (key: string): unknown =>
        r[key] ?? r[key.toLowerCase()] ?? r[key.toUpperCase()];
      const merchant = String(get('merchant') ?? get('MERCHANT') ?? '(blank)');
      const planCount = Number(get('plan_count') ?? get('PLAN_COUNT') ?? 0) || 0;
      const totalPlanAmount = Number(get('total_plan_amount') ?? get('TOTAL_PLAN_AMOUNT') ?? 0) || 0;
      return { merchant, plan_count: planCount, total_plan_amount: totalPlanAmount };
    });
  } catch {
    return [];
  }
}

/** Per-merchant: merchant name, plan_count, total_plan_amount (sum of QUANTITY/VALUE/AMOUNT). Date filter on CREATED_AT. */
function merchantBreakdownSql(from?: string, to?: string): string {
  const where =
    from && to
      ? `WHERE (UPPER(TRIM(ip.STATUS)) = 'ACTIVE' OR UPPER(TRIM(ip.STATUS)) = 'COMPLETED') AND DATE(ip.CREATED_AT) >= '${fd(from)}' AND DATE(ip.CREATED_AT) <= '${fd(to)}'${EXCL_PLAN}`
      : `WHERE (UPPER(TRIM(ip.STATUS)) = 'ACTIVE' OR UPPER(TRIM(ip.STATUS)) = 'COMPLETED')${EXCL_PLAN}`;
  return `
SELECT COALESCE(ip.CLIENT_NAME, '(blank)') AS merchant,
       COUNT(*) AS plan_count,
       COALESCE(SUM(COALESCE(ip.QUANTITY, ip.VALUE, ip.AMOUNT, ip.TOTAL_AMOUNT, 0)), 0) AS total_plan_amount
FROM CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN ip
${where}
GROUP BY ip.CLIENT_NAME
ORDER BY total_plan_amount DESC
LIMIT 50
`.trim();
}

export interface MerchantRow {
  merchant: string;
  plan_count: number;
  total_plan_amount: number;
}

export interface BnplPayload {
  from: string | null;
  to: string | null;
  refreshed_at: string;
  applications: number | null;
  approval_rate_pct: number | null;
  n_applied: number | null;
  n_kyc_completed: number | null;
  n_credit_check_completed: number | null;
  n_plan_creation: number | null;
  n_initial_collection: number | null;
  n_consumers_with_plan: number | null;
  n_consumers_with_plan_all: number | null;
  n_overdue: number | null;
  loan_book: {
    credit_allocated: number | null;
    operations_settled: number | null;
    operations_collected: number | null;
    total_settled: number | null;
    total_collected: number | null;
  } | null;
  total_plan_amount: number | null;
  first_attempt_pct: number | null;
  default_rate_pct: number | null;
  penalty_ratio_pct: number | null;
  merchant: {
    top3_volume_pct: number | null;
    n_merchants: number | null;
    by_merchant: MerchantRow[];
  };
  error?: string;
}

/** Run promise; on timeout return null instead of throwing (so slow queries don't block the response). */
async function withTimeoutNull<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timeoutId!);
    return result;
  } catch {
    clearTimeout(timeoutId!);
    return null;
  }
}

/** Per-query timeout so we always return within the function limit; slow queries become null. */
const BOUNDED_QUERY_TIMEOUT_MS = 20_000;
const SLOW_QUERY_TIMEOUT_MS = 8_000;

export async function loadBnplData(
  conn: Connection,
  fromDate: string | null,
  toDate: string | null
): Promise<BnplPayload> {
  const from = fromDate?.slice(0, 10) ?? null;
  const to = toDate?.slice(0, 10) ?? null;
  const payload: BnplPayload = {
    from,
    to,
    refreshed_at: new Date().toISOString(),
    applications: null,
    approval_rate_pct: null,
    n_applied: null,
    n_kyc_completed: null,
    n_credit_check_completed: null,
    n_plan_creation: null,
    n_initial_collection: null,
    n_consumers_with_plan: null,
    n_consumers_with_plan_all: null,
    n_overdue: null,
    loan_book: null,
    total_plan_amount: null,
    first_attempt_pct: null,
    default_rate_pct: null,
    penalty_ratio_pct: null,
    merchant: { top3_volume_pct: null, n_merchants: null, by_merchant: [] },
  };

  const run = (fn: () => Promise<number | null>, timeoutMs: number) => withTimeoutNull(fn(), timeoutMs);
  const runCountT = (sql: string) => run(() => runCount(conn, sql), BOUNDED_QUERY_TIMEOUT_MS);
  const runScalarT = (sql: string) => run(() => runScalar(conn, sql), BOUNDED_QUERY_TIMEOUT_MS);

  try {
    // All queries run in parallel with per-query timeout — we never wait more than max(20s, 8s) = 20s for this batch
    const [
      n_applied,
      n_credit_check_completed,
      n_kyc_completed,
      n_plan_creation,
      n_initial_collection,
      n_consumers_with_plan,
      total_settled,
      total_collected,
      total_plan_amount,
      merchantRows,
      n_consumers_with_plan_all,
      n_overdue,
      credit_allocated,
    ] = await Promise.all([
      runCountT(appliedCountSql(from ?? undefined, to ?? undefined)),
      runCountT(approvedCountSql(from ?? undefined, to ?? undefined)),
      runCountT(kycVerifiedCountSql(from ?? undefined, to ?? undefined)),
      runCountT(planCreationSql(from ?? undefined, to ?? undefined)),
      runCountT(initialCollectionSql(from ?? undefined, to ?? undefined)),
      runCountT(consumersWithPlanSql(from ?? undefined, to ?? undefined)),
      runScalarT(loanBookSettledSql(from ?? undefined, to ?? undefined)),
      runScalarT(loanBookCollectedSql(from ?? undefined, to ?? undefined)),
      runScalarT(loanBookSettledSql(from ?? undefined, to ?? undefined)),
      withTimeoutNull(loadMerchantBreakdown(conn, from ?? undefined, to ?? undefined), BOUNDED_QUERY_TIMEOUT_MS),
      withTimeoutNull(runCount(conn, consumersWithPlanSql()), SLOW_QUERY_TIMEOUT_MS),
      withTimeoutNull(runCount(conn, OVERDUE_COUNT_SQL), SLOW_QUERY_TIMEOUT_MS),
      withTimeoutNull(runScalar(conn, CREDIT_ALLOCATED_SQL), SLOW_QUERY_TIMEOUT_MS),
    ]);

    payload.n_applied = n_applied ?? null;
    payload.n_credit_check_completed = n_credit_check_completed ?? null;
    payload.n_kyc_completed = n_kyc_completed ?? null;
    payload.n_plan_creation = n_plan_creation ?? null;
    payload.n_initial_collection = n_initial_collection ?? null;
    payload.n_consumers_with_plan = n_consumers_with_plan ?? null;
    payload.n_consumers_with_plan_all = n_consumers_with_plan_all ?? null;
    payload.n_overdue = n_overdue ?? null;
    payload.applications = n_initial_collection ?? null;
    if (n_credit_check_completed != null && n_applied != null && n_applied > 0) {
      payload.approval_rate_pct = Math.round((100 * (n_credit_check_completed ?? 0)) / n_applied * 10) / 10;
    }
    payload.total_plan_amount = total_plan_amount ?? null;
    payload.loan_book = {
      credit_allocated: credit_allocated ?? null,
      operations_settled: total_settled ?? null,
      operations_collected: total_collected ?? null,
      total_settled: total_settled ?? null,
      total_collected: total_collected ?? null,
    };

    const byMerchant = Array.isArray(merchantRows) ? merchantRows : [];
    const totalVol = byMerchant.reduce((s, r) => s + r.total_plan_amount, 0);
    const top3Vol = byMerchant.slice(0, 3).reduce((s, r) => s + r.total_plan_amount, 0);
    payload.merchant = {
      top3_volume_pct: totalVol > 0 ? Math.round((100 * top3Vol) / totalVol) : null,
      n_merchants: byMerchant.length,
      by_merchant: byMerchant,
    };
  } catch (e) {
    payload.error = e instanceof Error ? e.message : String(e);
  }
  return payload;
}
