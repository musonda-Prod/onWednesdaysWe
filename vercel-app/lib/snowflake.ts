/**
 * Snowflake connection and query helpers for Vercel serverless.
 * Uses env: SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD,
 * SNOWFLAKE_WAREHOUSE, SNOWFLAKE_DATABASE, SNOWFLAKE_SCHEMA (optional: SNOWFLAKE_REGION).
 */

import snowflake from 'snowflake-sdk';

function getConnectionOptions(): snowflake.ConnectionOptions {
  const account = (process.env.SNOWFLAKE_ACCOUNT ?? '').trim();
  let accountLocator = account;
  if (accountLocator.includes('snowflake.com')) {
    try {
      const path = new URL(accountLocator).pathname.replace(/^\/+|\/+$/g, '');
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 2) accountLocator = `${parts[0]}-${parts[1]}`;
      else if (parts.length === 1) accountLocator = parts[0];
    } catch {
      // ignore
    }
  }
  const region = (process.env.SNOWFLAKE_REGION ?? '').trim();
  if (region && !accountLocator.includes('.')) {
    accountLocator = `${accountLocator}.${region}`;
  }
  return {
    account: accountLocator,
    username: (process.env.SNOWFLAKE_USER ?? '').trim(),
    password: (process.env.SNOWFLAKE_PASSWORD ?? '').trim(),
    warehouse: (process.env.SNOWFLAKE_WAREHOUSE ?? '').trim(),
    database: (process.env.SNOWFLAKE_DATABASE ?? '').trim(),
    schema: ((process.env.SNOWFLAKE_SCHEMA ?? '') || 'PUBLIC').trim() || 'PUBLIC',
  };
}

export function createConnection(): snowflake.Connection {
  return snowflake.createConnection(getConnectionOptions());
}

export function connectAsync(connection: snowflake.Connection): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    connection.connect((err, conn) => {
      if (err) reject(err);
      else resolve(conn!);
    });
  });
}

export function executeAsync(
  connection: snowflake.Connection,
  sql: string,
  binds?: snowflake.Binds
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sql,
      binds: binds ?? [],
      complete: (err, stmt, rows) => {
        if (err) reject(err);
        else resolve((rows ?? []) as unknown[]);
      },
    });
  });
}

/** Run a single COUNT(*) or scalar query and return the number or null. */
export async function runCount(
  connection: snowflake.Connection,
  sql: string,
  binds?: snowflake.Binds
): Promise<number | null> {
  const rows = await executeAsync(connection, sql, binds);
  const first = rows?.[0] as Record<string, unknown> | undefined;
  if (!first || typeof first !== 'object') return null;
  const val = Object.values(first)[0];
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string' && /^\d+$/.test(val)) return parseInt(val, 10);
  return null;
}

/** Run a scalar query (e.g. SELECT SUM(...)) and return the numeric value or null. */
export async function runScalar(
  connection: snowflake.Connection,
  sql: string,
  binds?: snowflake.Binds
): Promise<number | null> {
  const rows = await executeAsync(connection, sql, binds);
  const first = rows?.[0] as Record<string, unknown> | undefined;
  if (!first || typeof first !== 'object') return null;
  const val = Object.values(first)[0];
  if (val == null) return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string' && /^-?\d*\.?\d+$/.test(val)) return parseFloat(val);
  return null;
}

/** Connect, run a query, then destroy the connection. Safe for serverless (no long-lived connections). */
export async function withConnection<T>(
  fn: (conn: snowflake.Connection) => Promise<T>
): Promise<T> {
  const conn = createConnection();
  await connectAsync(conn);
  try {
    return await fn(conn);
  } finally {
    try {
      if ('destroy' in conn && typeof (conn as { destroy: (cb: (err?: Error) => void) => void }).destroy === 'function') {
        (conn as { destroy: (cb: (err?: Error) => void) => void }).destroy(() => {});
      }
    } catch {
      // ignore
    }
  }
}
