# Portfolio Intelligence — Vercel deployment

This is a **Next.js** port of the full BNPL dashboard that runs on **Vercel** (org-allowed method). It uses the same Snowflake data and mirrors the Streamlit app’s BNPL Performance view.

## What’s included

- **API**
  - `GET /api/bnpl?from=YYYY-MM-DD&to=YYYY-MM-DD` — returns BNPL payload: funnel counts (applied, KYC, credit check, plan creation, initial collection), loan book (credit allocated, settled, collected), overdue count, applications, approval rate, revenue-related totals.
  - `GET /api/metrics?from=...&to=...` — legacy: instalment plan count only.
- **UI:** Full BNPL Pulse dashboard:
  - Sidebar: date range, Refresh.
  - Sticky bar: date range text, last refreshed, compare state.
  - Header: BNPL Pulse, portfolio status, daily take, KPIs (Active users, Approval rate, Uncollected instalments, Revenue).
  - 4 signal blocks: Health, Risk, Concentration, Momentum.
  - Core health metrics: Default rate, First attempt, Approval rate, Penalty ratio, Roll rate.
  - Collapsible: Loan book summary, Conversion funnel (5 steps + drop-offs), Why drop-off and how to fix.
  - User behaviour: 4 macro zones (Healthy, Friction, Risk, Never Activated).
  - Behaviour landscape: segment bar, Next best action by segment.
  - Merchant risk: Top 3 concentration, number of merchants, total revenue.

## Run locally

```bash
cd vercel-app
npm install
cp .env.example .env.local
# Edit .env.local with your Snowflake credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel (org)

1. **Connect repo**  
   In Vercel: New Project → Import your Git repo. Set **Root Directory** to `vercel-app`.

2. **Environment variables**  
   In the Vercel project → Settings → Environment Variables, add:

   - `SNOWFLAKE_ACCOUNT` — account locator (e.g. `xy12345` or `org-account`)
   - `SNOWFLAKE_USER`
   - `SNOWFLAKE_PASSWORD`
   - `SNOWFLAKE_WAREHOUSE`
   - `SNOWFLAKE_DATABASE`
   - `SNOWFLAKE_SCHEMA` (optional; defaults to `PUBLIC` in code)
   - `SNOWFLAKE_REGION` (optional; e.g. `eu-west-1` if needed)

   Use the same values as in the Streamlit app’s `.env` (or your org’s Snowflake service account for production).

3. **Deploy**  
   Push to your branch; Vercel will build and deploy. The app will be at `https://<project-name>.vercel.app`.

## Extending

- Add more API routes under `app/api/` (e.g. `app/api/health/route.ts`, `app/api/funnel/route.ts`) that use `lib/snowflake.ts` and mirror the Streamlit dashboard’s SQL.
- Add more sections on `app/page.tsx` that fetch from those endpoints and render charts (e.g. with Recharts or Plotly.js).

## Note

The full Streamlit dashboard (`dashboard.py` at repo root) remains the source for logic and SQL. This Vercel app is a minimal, org-approved deployment surface; you can grow it by copying more queries and views from the Streamlit app.
