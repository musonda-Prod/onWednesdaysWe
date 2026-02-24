# Funnel analyzer (Snowflake)

Analyzes funnel steps stored in Snowflake: counts users per step and computes conversion and drop-off rates.

## Who connects to Snowflake?

**The script runs on your machine** and connects to Snowflake using credentials you provide. The AI / Cursor cannot connect to your Snowflake directly (no access to your network or secrets). When you run `python funnel_analyzer.py`, the connection is made from your computer.

## Why Snowflake (not Datadog)

- Your steps are **in a database** → Snowflake is the right place to query them.
- Funnel analysis = SQL aggregations (count per step, conversion %) → Snowflake is built for this.
- Datadog is for metrics/monitoring; funnel steps would need to be sent as custom events and are less flexible for ad‑hoc analysis.

## Expected table in Snowflake

One table with **one row per step per user** (or per session), for example:

| user_id | step_name | step_order | event_ts          |
|---------|-----------|------------|-------------------|
| u1      | signup    | 1          | 2025-01-01 10:00  |
| u1      | onboard   | 2          | 2025-01-01 10:01  |
| u1      | first_pay | 3          | 2025-01-02 09:00  |
| u2      | signup    | 1          | 2025-01-01 11:00  |

- **Journey ID**: one column that identifies the funnel journey (e.g. `user_id`, `session_id`).
- **Step**: one column for the step name or step id (e.g. `step_name`, `step`).
- **Order**: one column that defines the sequence (e.g. `step_order` 1, 2, 3). Must be numeric. If you only have timestamps, add a computed column in Snowflake, e.g.  
  `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_ts) AS step_order`.

Column names are configurable via environment variables (see below).

## Setup

```bash
pip install -r requirements.txt
```

### How to give the script your Snowflake credentials

**Option A – `.env` file (recommended)**

1. Copy the example file:  
   `cp .env.example .env`
2. Edit `.env` and set your real values:
   - `SNOWFLAKE_ACCOUNT` – e.g. `xy12345.eu-central-1` (from the Snowflake URL: `https://xy12345.eu-central-1.snowflakecomputing.com`)
   - `SNOWFLAKE_USER` – your login name
   - `SNOWFLAKE_PASSWORD` – your password
   - `SNOWFLAKE_WAREHOUSE` – e.g. `COMPUTE_WH`
   - `SNOWFLAKE_DATABASE` – database name
   - `SNOWFLAKE_SCHEMA` – schema name
3. Do not commit `.env` (it’s in `.gitignore`). The script loads it automatically.

**Option B – Environment variables in the terminal**

```bash
export SNOWFLAKE_ACCOUNT="xy12345.eu-central-1"
export SNOWFLAKE_USER="your_username"
export SNOWFLAKE_PASSWORD="your_password"
export SNOWFLAKE_WAREHOUSE="COMPUTE_WH"
export SNOWFLAKE_DATABASE="your_database"
export SNOWFLAKE_SCHEMA="your_schema"
```

**Where to find these in Snowflake**

- **Account**: In the Snowflake URL after you log in, or in **Admin → Accounts** (e.g. `xy12345.eu-central-1`).
- **Warehouse / Database / Schema**: In the UI left-hand side, or run `SHOW WAREHOUSES;` and `SHOW DATABASES;` in a worksheet.

Optional (defaults in parentheses):

- `FUNNEL_TABLE` – table name or `schema.table` (default: `funnel_steps`)
- `FUNNEL_USER_COL` – journey ID column (default: `user_id`)
- `FUNNEL_STEP_COL` – step name column (default: `step_name`)
- `FUNNEL_ORDER_COL` – step order column (default: `step_order`)
- `FUNNEL_DATE_COL` – date/timestamp column for filtering (default: `event_ts`)
- `FUNNEL_DATE_FROM` / `FUNNEL_DATE_TO` – e.g. `2025-01-01`, `2025-01-31`

## Run

```bash
python funnel_analyzer.py
```

Output: **Funnel_Analysis.xlsx** with two sheets:

- **Funnel** – step, step_order, count, conversion_pct, drop_off_pct
- **Raw_Steps** – raw rows from Snowflake (for checks)

Console prints a funnel summary as well.

## Dashboard funnel (same CDC as BNPL notebook)

The main Streamlit dashboard (`dashboard.py`) has a **conversion funnel** that uses the same CDC production tables as the BNPL Reporting Notebook: Signed up (CONSUMER_PROFILE signups), KYC completed (verified KYC only), Credit check completed, Approved, Initial collection (checkout/first payment = activated: COLLECTION_ATTEMPT TYPE = 'initial', STATUS = 'COMPLETED'). There is no separate “Activated” step; Initial collection is the activation step. Optional test-user exclusion (`EXCLUDE_TEST_USERS` in `.env`) matches the notebook’s stitch.money filter. See **DASHBOARD_DATA_ACCESS.md** for full alignment notes.

## Dashboard

A Streamlit dashboard explores all tables in your Snowflake database (same `.env`), with adaptive charts:

```bash
pip install -r requirements.txt
streamlit run dashboard.py
```

- **Overview**: table list and row counts.
- **Per table**: KPIs, time series (if date columns exist), numeric histograms, categorical bar charts, and a data preview.
- Sidebar: filter to **BNPL-related tables only**, and pick which table to explore.
