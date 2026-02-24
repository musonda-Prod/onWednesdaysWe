import { NextRequest, NextResponse } from 'next/server';
import { withConnection } from '@/lib/snowflake';
import { loadBnplData } from '@/lib/bnpl-queries';

export const dynamic = 'force-dynamic';
/** Use full 60s (Hobby max) so Snowflake connection + queries can finish. */
export const maxDuration = 60;

const emptyPayload = (from: string | null, to: string | null, error: string) => ({
  from,
  to,
  refreshed_at: new Date().toISOString(),
  error,
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
});

const TIMEOUT_MS = 55_000; // Leave a few seconds under Vercel limit

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Request timed out. Snowflake took too long — try a smaller date range or try again.')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from') ?? null;
  const to = request.nextUrl.searchParams.get('to') ?? null;

  try {
    const payload = await withTimeout(
      withConnection((conn) => loadBnplData(conn, from, to)),
      TIMEOUT_MS
    );
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(emptyPayload(from, to, message), { status: 500 });
  }
}
