import { NextResponse } from 'next/server';

/**
 * GET /api/check-env — Reports whether Snowflake env vars are set (no values).
 * Use this to verify Vercel env config. Remove or protect in production if desired.
 */
export const dynamic = 'force-dynamic';

const REQUIRED = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD', 'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_DATABASE'] as const;
const OPTIONAL = ['SNOWFLAKE_SCHEMA', 'SNOWFLAKE_REGION'] as const;

export async function GET() {
  const required: Record<string, boolean> = {};
  const optional: Record<string, boolean> = {};
  REQUIRED.forEach((key) => {
    const val = process.env[key];
    required[key] = typeof val === 'string' && val.trim().length > 0;
  });
  OPTIONAL.forEach((key) => {
    const val = process.env[key];
    optional[key] = typeof val === 'string' && val.trim().length > 0;
  });
  const allRequiredSet = REQUIRED.every((k) => required[k]);
  return NextResponse.json({
    ok: allRequiredSet,
    message: allRequiredSet
      ? 'All required Snowflake env vars are set.'
      : 'Some required env vars are missing or empty. Add them in Vercel → Project → Settings → Environment Variables.',
    required,
    optional,
  });
}
