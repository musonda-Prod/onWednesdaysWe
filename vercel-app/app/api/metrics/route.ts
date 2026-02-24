import { NextRequest, NextResponse } from 'next/server';
import { withConnection, runCount } from '@/lib/snowflake';

const INSTALMENT_PLAN_COUNT_SQL = `
SELECT COUNT(*) AS n
FROM CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN
WHERE (status = 'ACTIVE' OR status = 'COMPLETED')
`.trim();

const INSTALMENT_PLAN_COUNT_DATE_SQL = `
SELECT COUNT(*) AS n
FROM CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN
WHERE (status = 'ACTIVE' OR status = 'COMPLETED')
  AND DATE(created_at) >= ? AND DATE(created_at) <= ?
`.trim();

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from')?.slice(0, 10) ?? '';
  const to = request.nextUrl.searchParams.get('to')?.slice(0, 10) ?? '';

  try {
    const count = await withConnection(async (conn) => {
      if (from && to) {
        return runCount(conn, INSTALMENT_PLAN_COUNT_DATE_SQL, [from, to]);
      }
      return runCount(conn, INSTALMENT_PLAN_COUNT_SQL);
    });

    return NextResponse.json({
      ok: true,
      instalment_plan_count: count,
      from: from || null,
      to: to || null,
      refreshed_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message, refreshed_at: new Date().toISOString() },
      { status: 500 }
    );
  }
}
