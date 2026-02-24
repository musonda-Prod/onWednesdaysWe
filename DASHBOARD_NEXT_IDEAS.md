# Dashboard: What Else Can We Do?

Ideas grouped by theme. Aligned with **minimalist, high-signal, strategic** PRD.

---

## 1. Data & metrics

| Idea | What | Why |
|------|------|-----|
| **Period-over-period** | Compare current range vs previous (e.g. "Past 7 days vs prior 7 days"): default rate, first attempt %, approval %, top merchant share. Show Δ and ↑/↓. | One click to see if things are improving or worsening. |
| **Trend sparklines** | Tiny trend (e.g. 7 points) next to each signal or core metric: not a full chart, just "direction last 7 days". | Quick sense of momentum without leaving the page. |
| **Benchmark bands** | Show target/benchmark bands on key metrics (e.g. "Target: default <5%") as a subtle line or band in the metric card. | Clarifies "good" vs "needs work". |
| **WoW / MoM in header** | Where you have "Metrics: 1 Jan → 7 Jan", add "WoW: default −0.3pp · first attempt +2pp" (when data allows). | Exec summary in one line. |
| **Failure reasons chart** | You have `failure_reasons_df`; if not already shown, add a small bar or table of top collection failure reasons (e.g. liquidity, card declined). | Explains *why* first attempt isn’t 100%. |
| **Overdue / at-risk count** | Prominent "Instalments overdue: N" or "At-risk (1+ missed): N" with link or expander to list/export. | Drives action. |

---

## 2. UX & navigation

| Idea | What | Why |
|------|------|-----|
| **Sticky date range** | Keep date presets and range visible (e.g. in sidebar or a slim sticky bar) so changing range doesn’t require scrolling. | Faster iteration on "what if I look at last month?". |
| **Deep link / query params** | Support `?view=bnpl&from=2025-01-01&to=2025-01-31` so a link opens the dashboard with that view and range. | Shareable links for standups or reports. |
| **Keyboard shortcut** | e.g. "R" = refresh data (or reload). | Power users. |
| **"Last refreshed"** | Show "Data as of 14 Feb 2025, 09:00" or "Last run: 2 min ago" near the header. | Trust and freshness. |
| **Collapsible sections** | Allow collapsing e.g. Competitive Structure or Persona Command Center so the main flow (signals → health → funnel → merchant → collection) stays above the fold. | Less scroll for daily use. |
| **Comparison mode** | Toggle "Compare two ranges" (e.g. Range A vs Range B) and show key metrics side by side. | A/B period analysis. |

---

## 3. Export & sharing

| Idea | What | Why |
|------|------|-----|
| **Export to CSV/Excel** | Buttons: "Export merchant table", "Export segment mix", "Export funnel counts". | Offline analysis and decks. |
| **PDF / image snapshot** | "Download this view as PDF" (or screenshot) for the current BNPL Performance view. | One-pagers for leadership. |
| **Scheduled report** | (Backend/cron) Generate a daily/weekly summary (e.g. email or Slack) with key numbers and "vs last period". | Push instead of pull. |

---

## 4. Performance & reliability

| Idea | What | Why |
|------|------|-----|
| **Caching** | You already use `@st.cache_resource` for conn; consider `@st.cache_data(ttl=300)` for heavy metric/behaviour queries keyed by (from_date, to_date). | Faster reruns and less DB load. |
| **Graceful degradation** | If one query fails (e.g. behaviour), show the rest of the dashboard with a clear "Behaviour: data unavailable" instead of breaking the whole page. | Resilience. |
| **Loading skeletons** | While metrics/behaviour load, show skeleton placeholders (e.g. grey bars where signals will be). | Perceived speed. |
| **Query timeouts** | Set a timeout on long-running queries and surface "Partial data (timeout)" when relevant. | No hanging. |

---

## 5. Governance & clarity

| Idea | What | Why |
|------|------|-----|
| **Data dictionary** | Sidebar or expander: "What each metric means" (one line per metric) and "Source: table.column". | Onboarding and audit. |
| **Missing data summary** | One line or badge: "3 metrics from demo data" or "All metrics from Snowflake (ANALYTICS_PROD)". | Transparency. |
| **Version / changelog** | Footer or sidebar: "Dashboard v1.2 · Changelog" with short bullet list of recent changes. | Traceability. |
| **Role-based views** | (If you have roles) e.g. "Collections" view (recovery curve + overdue + failure reasons) vs "Strategy" (signals + merchant + competitive). | Right view for the right role. |

---

## 6. BNPL-specific

| Idea | What | Why |
|------|------|-----|
| **Limit utilisation** | If you have credit limit and drawn amount: "Portfolio limit utilisation: 67%" and trend. | Capacity and risk. |
| **Roll rate** | % of balances that "roll" from current to 30+ dpd (when data exists). | Leading indicator of default. |
| **Merchant-level alerts** | Flag when a merchant’s share or risk % crosses a threshold (e.g. "Hertex Fabrics >25% of volume"). | Proactive concentration risk. |
| **Segment trend** | Small table or sparkline: "Gantu (Repeat Defaulters) share: 9% → 11% (4w)". | See risk segment growing. |
| **Next best action** | One line per segment: "Stitch: send retry reminder; Gantu: consider limit reduction." (Rule-based or model later.) | From insight to action. |

---

## 7. Quick wins (low effort)

- **Last refreshed** timestamp in header.
- **Export merchant table** and **Export segment table** as CSV (Streamlit `st.download_button`).
- **Failure reasons** bar or table if `failure_reasons_df` is loaded but not shown.
- **Overdue count** in header or signal strip ("Uncollected: N").
- **Sticky date range** in sidebar so it’s always visible when scrolling.

---

## 8. Out of scope (per PRD)

- No heavy animation or decorative charts.
- No social or collaboration features inside the app (sharing = export / link).
- No real-time streaming; refresh on load or on demand is enough.
