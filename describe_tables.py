"""
Inspect Snowflake tables (columns + sample rows) for merchant risk and behaviour.
Run from project root with VPN/connection. Output goes to TABLE_SCHEMA.txt and stdout.

Default tables (no args):
  ANALYTICS_PROD.PAYMENTS.BNPL
  ANALYTICS_PROD.PAYMENTS.BNPL_COLLECTIONS
  + list of tables in CDC_BNPL_PRODUCTION.PUBLIC

Usage:
  python describe_tables.py
  python describe_tables.py ANALYTICS_PROD.PAYMENTS.BNPL ANALYTICS_PROD.PAYMENTS.BNPL_COLLECTIONS
  python describe_tables.py CDC_BNPL_PRODUCTION.PUBLIC.CONSUMER_PROFILE CDC_BNPL_PRODUCTION.PUBLIC.INSTALLMENTS
  python describe_tables.py --list CDC_BNPL_PRODUCTION.PUBLIC
"""

import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from funnel_analyzer import get_connection

OUTPUT_FILE = Path(__file__).parent / "TABLE_SCHEMA.txt"

# Tables you need to access (database.schema.table or database.schema to list tables)
# Data model: BNPL Transaction → Merchant Settlement; BNPL Card Transaction → Customer Collections → Collection Attempts; D_CALENDAR.
DEFAULT_TABLES = [
    "ANALYTICS_PROD.PAYMENTS.BNPL",
    "ANALYTICS_PROD.PAYMENTS.BNPL_COLLECTIONS",
    "CDC_OPERATIONS_PRODUCTION.PUBLIC.BNPLTRANSACTION",
    "CDC_OPERATIONS_PRODUCTION.PUBLIC.BNPLCARDTRANSACTION",
    "CDC_OPERATIONS_PRODUCTION.PUBLIC.MERCHANT SETTLEMENT",
    "CDC_OPERATIONS_PRODUCTION.PUBLIC.CUSTOMER COLLECTIONS",
    "CDC_OPERATIONS_PRODUCTION.PUBLIC.COLLECTION ATTEMPTS",
    "CDC_OPERATIONS_PRODUCTION.PUBLIC.D_CALENDAR",
    "CDC_BNPL_PRODUCTION.PUBLIC",
    "CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC",
    "CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_EVENT",
]


def parse_table_arg(s: str):
    """Return (database, schema, table) or (database, schema, None) for --list."""
    parts = [p.strip() for p in s.split(".") if p.strip()]
    if len(parts) == 3:
        return parts[0], parts[1], parts[2]
    if len(parts) == 2:
        return parts[0], parts[1], None
    if len(parts) == 1:
        return None, None, parts[0]
    return None, None, None


def list_tables_in_schema(conn, database: str, schema: str) -> str:
    """List table names in database.schema."""
    lines = [f"\n{'='*60}", f"Tables in {database}.{schema}", f"{'='*60}"]
    with conn.cursor() as cur:
        cur.execute(f'USE DATABASE "{database}"')
        cur.execute(f'USE SCHEMA "{schema}"')
        cur.execute("SHOW TABLES")
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
    name_idx = cols.index("name") if "name" in cols else 0
    for row in rows:
        lines.append(f"  {row[name_idx]}")
    return "\n".join(lines)


def describe_table(conn, database: str, schema: str, table: str, limit: int = 5) -> str:
    """Return column list and sample rows for one table. Uses fully qualified name."""
    qualified = f'"{database}"."{schema}"."{table}"'
    lines = [f"\n{'='*60}", f"Table: {database}.{schema}.{table}", f"{'='*60}"]

    with conn.cursor() as cur:
        cur.execute(f"SELECT * FROM {qualified} LIMIT 0")
        cols = [d[0] for d in cur.description]
    lines.append(f"Columns ({len(cols)}): " + ", ".join(cols))

    with conn.cursor() as cur:
        cur.execute(f"SELECT * FROM {qualified} LIMIT {limit}")
        rows = cur.fetchall()
    lines.append(f"Sample rows (up to {limit}):")
    if rows:
        for i, row in enumerate(rows, 1):
            lines.append(f"  Row {i}: {row}")
    else:
        lines.append("  (no rows)")
    return "\n".join(lines)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    list_only = "--list" in sys.argv

    if list_only and args:
        # List tables in given database.schema
        conn = get_connection()
        out_lines = []
        for arg in args:
            db, schema, _ = parse_table_arg(arg)
            if db and schema:
                block = list_tables_in_schema(conn, db, schema)
                print(block)
                out_lines.append(block)
        conn.close()
        if out_lines:
            OUTPUT_FILE.write_text("\n".join(out_lines), encoding="utf-8")
            print(f"\nWritten to {OUTPUT_FILE}")
        return

    if not args:
        raw_tables = DEFAULT_TABLES.copy()
        # Also list CDC_BNPL_PRODUCTION.PUBLIC so we see consumer/installments etc.
        raw_tables.append("CDC_BNPL_PRODUCTION.PUBLIC")
    else:
        raw_tables = args

    print("Connecting to Snowflake...")
    conn = get_connection()

    out_lines = [f"Tables: {raw_tables}"]
    for raw in raw_tables:
        db, schema, table = parse_table_arg(raw)
        if not db or not schema:
            print(f"\nSkip (need database.schema.table or database.schema): {raw}")
            continue
        if table:
            try:
                block = describe_table(conn, db, schema, table)
                print(block)
                out_lines.append(block)
            except Exception as e:
                msg = f"\n{db}.{schema}.{table}: Error - {e}\n"
                print(msg)
                out_lines.append(msg)
        else:
            # database.schema only -> list tables
            try:
                block = list_tables_in_schema(conn, db, schema)
                print(block)
                out_lines.append(block)
            except Exception as e:
                msg = f"\n{db}.{schema}: Error - {e}\n"
                print(msg)
                out_lines.append(msg)

    conn.close()

    OUTPUT_FILE.write_text("\n".join(out_lines), encoding="utf-8")
    print(f"\nWritten to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
