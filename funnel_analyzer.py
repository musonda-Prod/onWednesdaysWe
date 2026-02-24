"""
Funnel analyzer: read funnel steps from Snowflake and compute step counts,
conversion rates, and drop-off. Outputs Excel + optional date filter.

Expected Snowflake table shape (column names are configurable below):
  - One column that identifies the "journey" (e.g. user_id, session_id)
  - One column for the step name or step number (e.g. step_name, step)
  - Optionally: a timestamp or step_order so steps can be ordered

Example table:
  user_id   | step_name   | step_order | event_ts
  ----------+-------------+------------+-------------------------
  u1        | signup      | 1          | 2025-01-01 10:00:00
  u1        | onboard     | 2          | 2025-01-01 10:01:00
  u1        | first_pay   | 3          | 2025-01-02 09:00:00
  u2        | signup      | 1          | 2025-01-01 11:00:00

Run:
  pip install -r requirements.txt
  Set env vars: SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_WAREHOUSE,
                SNOWFLAKE_DATABASE, SNOWFLAKE_SCHEMA

  Duo MFA (same as signing in to Snowflake in the browser):
    Use password auth: set SNOWFLAKE_PASSWORD and do NOT set SNOWFLAKE_AUTHENTICATOR.
    Snowflake will send a Duo push to your device; approve in the Duo app.
    Optional: SNOWFLAKE_PASSCODE if your org requires a passcode instead of push.

  SSO (browser opens): SNOWFLAKE_AUTHENTICATOR=externalbrowser (no password).
  python funnel_analyzer.py
"""

import os
import pandas as pd
from pathlib import Path

# Load .env from project folder so you can keep credentials out of the shell/code
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

# --- Config: point these at your Snowflake table and column names ---
SNOWFLAKE_ACCOUNT = os.environ.get("SNOWFLAKE_ACCOUNT", "")
SNOWFLAKE_USER = os.environ.get("SNOWFLAKE_USER", "")
SNOWFLAKE_PASSWORD = os.environ.get("SNOWFLAKE_PASSWORD", "")
SNOWFLAKE_PASSCODE = os.environ.get("SNOWFLAKE_PASSCODE", "").strip()  # Duo 6-digit code if push disabled
SNOWFLAKE_AUTHENTICATOR = os.environ.get("SNOWFLAKE_AUTHENTICATOR", "").strip().lower()
SNOWFLAKE_WAREHOUSE = os.environ.get("SNOWFLAKE_WAREHOUSE", "")
SNOWFLAKE_DATABASE = os.environ.get("SNOWFLAKE_DATABASE", "")
SNOWFLAKE_SCHEMA = os.environ.get("SNOWFLAKE_SCHEMA", "")
USE_SSO = SNOWFLAKE_AUTHENTICATOR == "externalbrowser"
# Optional: for SSO, some IdPs need account name only (e.g. ne54452). Set SNOWFLAKE_ACCOUNT_SSO to override.
SNOWFLAKE_ACCOUNT_SSO = os.environ.get("SNOWFLAKE_ACCOUNT_SSO", "").strip()
# Optional: if 250001 (can't reach Snowflake), try adding region (e.g. us-east-1, eu-central-1)
SNOWFLAKE_REGION = os.environ.get("SNOWFLAKE_REGION", "").strip()

# Table and columns for funnel steps (change to match your DB)
FUNNEL_TABLE = os.environ.get("FUNNEL_TABLE", "funnel_steps")  # or "schema.table"
USER_ID_COL = os.environ.get("FUNNEL_USER_COL", "user_id")     # journey identifier
STEP_COL = os.environ.get("FUNNEL_STEP_COL", "step_name")      # step name or id
ORDER_COL = os.environ.get("FUNNEL_ORDER_COL", "step_order")   # 1,2,3 or timestamp col
# Optional: filter by date (set to None or "" to disable)
DATE_COL = os.environ.get("FUNNEL_DATE_COL", "event_ts")       # leave "" if no date
DATE_FROM = os.environ.get("FUNNEL_DATE_FROM", "")             # e.g. 2025-01-01
DATE_TO = os.environ.get("FUNNEL_DATE_TO", "")                 # e.g. 2025-01-31

OUTPUT_PATH = Path(__file__).parent / "Funnel_Analysis.xlsx"


def _normalize_account(account: str, region: str = "") -> str:
    """Use account locator for connector; extract from Snowflake app URL if needed. Optionally append region."""
    if not account:
        return ""
    s = account.strip()
    if "snowflake.com" in s:
        # e.g. https://app.snowflake.com/mwqfsbb/ne54452/#/homepage -> mwqfsbb-ne54452
        try:
            from urllib.parse import urlparse
            parsed = urlparse(s)
            parts = [p for p in parsed.path.strip("/").split("/") if p]
            if len(parts) >= 2:
                s = f"{parts[0]}-{parts[1]}"
            elif len(parts) == 1:
                s = parts[0]
        except Exception:
            pass
    region = (region or os.environ.get("SNOWFLAKE_REGION", "")).strip()
    if region and "." not in s:
        s = f"{s}.{region}"
    return s


def get_connection():
    import snowflake.connector
    # Read at call time so Streamlit Cloud secrets (injected into os.environ) are picked up
    account = os.environ.get("SNOWFLAKE_ACCOUNT", SNOWFLAKE_ACCOUNT) or SNOWFLAKE_ACCOUNT
    user = os.environ.get("SNOWFLAKE_USER", SNOWFLAKE_USER) or SNOWFLAKE_USER
    warehouse = os.environ.get("SNOWFLAKE_WAREHOUSE", SNOWFLAKE_WAREHOUSE) or SNOWFLAKE_WAREHOUSE
    database = os.environ.get("SNOWFLAKE_DATABASE", SNOWFLAKE_DATABASE) or SNOWFLAKE_DATABASE
    schema = os.environ.get("SNOWFLAKE_SCHEMA", SNOWFLAKE_SCHEMA) or SNOWFLAKE_SCHEMA
    password = os.environ.get("SNOWFLAKE_PASSWORD", SNOWFLAKE_PASSWORD) or SNOWFLAKE_PASSWORD
    region = os.environ.get("SNOWFLAKE_REGION", "").strip() or SNOWFLAKE_REGION
    use_sso = (os.environ.get("SNOWFLAKE_AUTHENTICATOR", "") or SNOWFLAKE_AUTHENTICATOR or "").strip().lower() == "externalbrowser"
    account_sso = (os.environ.get("SNOWFLAKE_ACCOUNT_SSO", "") or SNOWFLAKE_ACCOUNT_SSO or "").strip()
    passcode = (os.environ.get("SNOWFLAKE_PASSCODE", "") or SNOWFLAKE_PASSCODE or "").strip()
    account = (account_sso if use_sso and account_sso else None) or _normalize_account(account, region)
    connect_args = dict(
        account=account,
        user=user,
        warehouse=warehouse,
        database=database,
        schema=schema,
    )
    if use_sso:
        connect_args["authenticator"] = "externalbrowser"
        connect_args["client_request_mfa_token"] = True  # cache token, fewer prompts
    else:
        connect_args["password"] = password
        connect_args["client_request_mfa_token"] = True  # cache Duo token (~4h), same push-to-device flow
        if passcode:
            connect_args["passcode"] = passcode  # use if Duo push disabled (390132)
    return snowflake.connector.connect(**connect_args)


def test_connection() -> bool:
    """Connect to Snowflake and run a simple query. Returns True if successful."""
    required = [SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_WAREHOUSE, SNOWFLAKE_DATABASE, SNOWFLAKE_SCHEMA]
    if not USE_SSO:
        required.append(SNOWFLAKE_PASSWORD)
    if not all(required):
        print("Missing env: set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_WAREHOUSE,")
        print("SNOWFLAKE_DATABASE, SNOWFLAKE_SCHEMA.")
        if not USE_SSO:
            print("For password auth also set SNOWFLAKE_PASSWORD.")
        else:
            print("For SSO, SNOWFLAKE_AUTHENTICATOR=externalbrowser is set (no password).")
        return False
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT CURRENT_VERSION()")
            row = cur.fetchone()
            print("Connected to Snowflake successfully.")
            print("Current version:", row[0] if row else "?")
        conn.close()
        return True
    except Exception as e:
        print("Connection failed:", e)
        return False


def load_funnel_steps(conn) -> pd.DataFrame:
    """Load raw step rows from Snowflake."""
    cols = [USER_ID_COL, STEP_COL, ORDER_COL]
    if DATE_COL and DATE_COL not in cols:
        cols.append(DATE_COL)
    col_list = ", ".join(f'"{c}"' for c in cols)
    full_table = FUNNEL_TABLE if "." in FUNNEL_TABLE else f'"{SNOWFLAKE_SCHEMA}"."{FUNNEL_TABLE}"'
    sql = f'SELECT {col_list} FROM {full_table}'
    conditions = []
    if DATE_COL and DATE_FROM:
        conditions.append(f'"{DATE_COL}" >= %s')
    if DATE_COL and DATE_TO:
        conditions.append(f'"{DATE_COL}" <= %s')
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    params = [p for p in [DATE_FROM if DATE_COL and DATE_FROM else None,
                          DATE_TO if DATE_COL and DATE_TO else None] if p]
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    return pd.DataFrame(rows, columns=cols)


def compute_funnel(df: pd.DataFrame) -> pd.DataFrame:
    """
    Count distinct users who reached each step (in order). Then compute
    conversion % from previous step and drop-off %.
    """
    if df.empty:
        return pd.DataFrame(columns=["step", "step_order", "count", "conversion_pct", "drop_off_pct"])

    # Distinct users per step (same user can appear in step 1, 2, 3...)
    step_counts = (
        df.groupby([ORDER_COL, STEP_COL])[USER_ID_COL]
        .nunique()
        .reset_index(name="count")
    )
    step_counts = step_counts.sort_values(ORDER_COL)
    step_counts = step_counts.rename(columns={ORDER_COL: "step_order", STEP_COL: "step"})

    # Conversion from previous step and drop-off
    step_counts["conversion_pct"] = None
    step_counts["drop_off_pct"] = None
    prev_count = None
    for i, row in step_counts.iterrows():
        c = row["count"]
        if prev_count is not None and prev_count > 0:
            step_counts.at[i, "conversion_pct"] = round(100.0 * c / prev_count, 1)
            step_counts.at[i, "drop_off_pct"] = round(100.0 * (1 - c / prev_count), 1)
        prev_count = c

    return step_counts[["step", "step_order", "count", "conversion_pct", "drop_off_pct"]]


def main():
    required = [SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_WAREHOUSE, SNOWFLAKE_DATABASE, SNOWFLAKE_SCHEMA]
    if not USE_SSO:
        required.append(SNOWFLAKE_PASSWORD)
    if not all(required):
        print("Set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_WAREHOUSE, SNOWFLAKE_DATABASE, SNOWFLAKE_SCHEMA.")
        print("For SSO (Duo): set SNOWFLAKE_AUTHENTICATOR=externalbrowser. For password auth: set SNOWFLAKE_PASSWORD.")
        return None

    conn = get_connection()
    try:
        raw = load_funnel_steps(conn)
        if raw.empty:
            print("No rows returned from funnel table. Check table name and date filters.")
            return None
        # Ensure numeric order for sorting
        raw[ORDER_COL] = pd.to_numeric(raw[ORDER_COL], errors="coerce")
        raw = raw.dropna(subset=[ORDER_COL])
        funnel = compute_funnel(raw)
        with pd.ExcelWriter(OUTPUT_PATH, engine="openpyxl") as writer:
            funnel.to_excel(writer, sheet_name="Funnel", index=False)
            raw.to_excel(writer, sheet_name="Raw_Steps", index=False)
        print("Created:", OUTPUT_PATH)
        print("Funnel summary:")
        print(funnel.to_string(index=False))
        return OUTPUT_PATH
    finally:
        conn.close()


def list_tables(filter_name=None) -> None:
    """List schemas and tables in the configured database. Optionally filter by name (e.g. BNPL)."""
    required = [SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_WAREHOUSE, SNOWFLAKE_DATABASE, SNOWFLAKE_SCHEMA]
    if not USE_SSO:
        required.append(SNOWFLAKE_PASSWORD)
    if not all(required):
        print("Set Snowflake env vars first (see .env).")
        return
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            sql = """
                SELECT TABLE_SCHEMA, TABLE_NAME
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_CATALOG = %s
                  AND TABLE_TYPE = 'BASE TABLE'
            """
            params = [SNOWFLAKE_DATABASE.strip()]
            if filter_name:
                sql += " AND (UPPER(TABLE_SCHEMA) LIKE %s OR UPPER(TABLE_NAME) LIKE %s)"
                pattern = f"%{filter_name.upper()}%"
                params.extend([pattern, pattern])
            sql += " ORDER BY TABLE_SCHEMA, TABLE_NAME"
            cur.execute(sql, params)
            rows = cur.fetchall()
        if not rows:
            print("No tables found in database", SNOWFLAKE_DATABASE, f"(filter: {filter_name})" if filter_name else "")
            return
        title = f"Tables in database {SNOWFLAKE_DATABASE}"
        if filter_name:
            title += f" (only {filter_name}-related)"
        print(title + ":")
        print("(Use FUNNEL_TABLE=schema.table or FUNNEL_TABLE=table in .env)\n")
        current_schema = None
        for schema, table in rows:
            if schema != current_schema:
                current_schema = schema
                print(f"  Schema: {schema}")
            print(f"    - {table}  →  FUNNEL_TABLE={schema}.{table}" if schema != SNOWFLAKE_SCHEMA else f"    - {table}  →  FUNNEL_TABLE={table}")
    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        test_connection()
    elif len(sys.argv) > 1 and sys.argv[1] in ("--list-bnpl",):
        list_tables(filter_name="BNPL")
    elif len(sys.argv) > 1 and sys.argv[1] in ("--list-tables", "--list", "--discover"):
        list_tables()
    else:
        main()
