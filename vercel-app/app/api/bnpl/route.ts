import { NextRequest, NextResponse } from 'next/server';
import { withConnection } from '@/lib/snowflake';
import { loadBnplData } from '@/lib/bnpl-queries';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from') ?? null;
  const to = request.nextUrl.searchParams.get('to') ?? null;

  try {
    const payload = await withConnection((conn) => loadBnplData(conn, from, to));
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        from: from ?? null,
        to: to ?? null,
        refreshed_at: new Date().toISOString(),
        error: message,
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
      },
      { status: 500 }
    );
  }
}
