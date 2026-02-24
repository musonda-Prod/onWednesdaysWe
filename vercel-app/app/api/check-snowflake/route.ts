import { NextResponse } from 'next/server';
import { createConnection } from '@/lib/snowflake';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

/**
 * GET /api/check-snowflake
 * Tries to connect to Snowflake with a 15s timeout and returns what happened.
 * Use this to confirm we're actually reaching Snowflake from Vercel.
 */
export async function GET() {
  const start = Date.now();
  const result: {
    ok: boolean;
    step: string;
    durationMs: number;
    env: { account: boolean; user: boolean; password: boolean; warehouse: boolean; database: boolean };
    accountHint?: string;
    error?: string;
    code?: string;
  } = {
    ok: false,
    step: 'init',
    durationMs: 0,
    env: {
      account: !!(process.env.SNOWFLAKE_ACCOUNT?.trim()),
      user: !!(process.env.SNOWFLAKE_USER?.trim()),
      password: !!(process.env.SNOWFLAKE_PASSWORD?.trim()),
      warehouse: !!(process.env.SNOWFLAKE_WAREHOUSE?.trim()),
      database: !!(process.env.SNOWFLAKE_DATABASE?.trim()),
    },
  };

  if (!result.env.account || !result.env.user || !result.env.password || !result.env.warehouse || !result.env.database) {
    result.step = 'env_missing';
    result.durationMs = Date.now() - start;
    return NextResponse.json(result);
  }

  const account = (process.env.SNOWFLAKE_ACCOUNT ?? '').trim();
  let accountHint = account;
  if (account.includes('snowflake.com')) {
    try {
      const path = new URL(account).pathname.replace(/^\/+|\/+$/g, '');
      const parts = path.split('/').filter(Boolean);
      accountHint = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : account.slice(0, 20);
    } catch {
      accountHint = account.slice(0, 20);
    }
  } else {
    accountHint = account.slice(0, 10) + (account.length > 10 ? '…' : '');
  }
  result.accountHint = accountHint;

  result.step = 'creating_connection';
  let conn: ReturnType<typeof createConnection>;
  try {
    conn = createConnection();
  } catch (e) {
    result.step = 'create_failed';
    result.error = e instanceof Error ? e.message : String(e);
    result.durationMs = Date.now() - start;
    return NextResponse.json(result);
  }

  result.step = 'connecting';
  const connectTimeoutMs = 15_000;
  const connectPromise = new Promise<void>((resolve, reject) => {
    conn.connect((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Connection timed out after 15s')), connectTimeoutMs)
  );

  try {
    await Promise.race([connectPromise, timeoutPromise]);
    result.ok = true;
    result.step = 'connected';
  } catch (e) {
    result.step = 'connect_failed';
    result.error = e instanceof Error ? e.message : String(e);
    const err = e as { code?: string };
    if (err?.code) result.code = String(err.code);
  } finally {
    try {
      if ('destroy' in conn && typeof (conn as { destroy: (cb: () => void) => void }).destroy === 'function') {
        (conn as { destroy: (cb: () => void) => void }).destroy(() => {});
      }
    } catch {
      // ignore
    }
  }

  result.durationMs = Date.now() - start;
  return NextResponse.json(result);
}
