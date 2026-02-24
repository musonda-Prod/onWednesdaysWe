# Next-level intelligence & UX ideas

Ideas to take the Portfolio Intelligence Console from **strong** to **best-in-class**: clearer narrative, proactive signals, and a smoother, more trustworthy experience. Builds on [DASHBOARD_NEXT_IDEAS.md](DASHBOARD_NEXT_IDEAS.md).

---

## 1. Intelligence (narrative & “so what?”)

| Idea | What to build | Why it’s next-level |
|------|----------------|---------------------|
| **One-line daily take** | At the very top (below date range): a single sentence that answers “What should I care about today?” e.g. *“Default is up 0.4pp vs last week; first-try collection is stable; top 3 concentration fell to 62%.”* Generated from the same logic as Intelligence summary but as one editable template with placeholders. | Execs get the story in 5 seconds. |
| **Alert strip** | A slim strip (or badges) for **breached thresholds**: e.g. “Default >5%”, “Top 3 concentration >70%”, “First-try collection <60%”. Only show when a rule fires; link to the section that explains it. | Shifts from “look at the numbers” to “here’s what’s wrong.” |
| **Why this number** | On hover (or (i)) for each core metric: one line of plain English, e.g. “Default rate = share of plans that ever reached 30+ days overdue in the period.” Reuse/expand the “What is calculated” expander into per-metric tooltips. | Reduces “what does this mean?” and builds trust. |
| **Comparison in the headline** | When “Compare two ranges” is on, show the **delta in the section titles** where it matters: e.g. “Core health metrics · Range B vs A: default −0.2pp, first-try +1.1pp”. | Period-over-period becomes part of the narrative, not a separate view. |
| **Next best action by segment** | Under Behaviour landscape or Persona Command Center: one line per segment, e.g. “**Stitch (Rollers):** Retry lift is strong; keep current cadence.” / “**Gantu (Repeat Defaulters):** Share up 1.2pp; consider limit or recovery focus.” Rule-based at first (thresholds + retry lift + concentration). | Turns insight into “what do I do Monday morning?” |
| **Failure-reason story** | If you have `failure_reasons_df`, add a short sentence in Collection engine or Intelligence summary: “Most failed first attempts are **liquidity** (X%), then **card declined** (Y%).” Optional small bar or table. | Explains *why* first-try isn’t 100% without extra clicks. |
| **Roll rate / limit utilisation** | When data exists: **Roll rate** (e.g. % moving to 30+ dpd) and **Portfolio limit utilisation** (drawn vs limit). One card or one line in Loan book / Core health. | Leading indicators; aligns with risk and capacity. |

---

## 2. UX (flow, trust, control)

| Idea | What to build | Why it’s next-level |
|------|----------------|---------------------|
| **Sticky context bar** | A slim bar (or sidebar block) that stays visible (or is always in the same place): **Date range** + **Last refreshed** (e.g. “Data as of 14 Feb, 09:00” or “2 min ago”) + optional **Compare: A vs B**. | No scrolling to change range or check freshness; builds trust. |
| **Deep links** | Support `?view=bnpl&from=2025-01-01&to=2025-01-31` (and optionally `compare=1&from_b=...&to_b=...`). On load, set session state and apply range/compare. | Shareable links for standups, Slack, or “how it looked on the 10th.” |
| **Collapsible sections** | Let each major section (e.g. Loan book, Core health, Behaviour landscape, Merchant risk, Collection engine, Persona Command Center) be **collapsible** (accordion or expander). Remember state in session (e.g. “sections_open”). Default: first 2–3 open, rest closed. | Power users see only what they need; new users aren’t overwhelmed. |
| **Loading skeletons** | While heavy blocks load (signals, behaviour, merchant chart), show **skeleton placeholders** (grey bars/cards with same layout) instead of blank or spinner only. | Feels faster and more polished. |
| **Export where it matters** | One-click **Export** next to: Merchant concentration table, Segment/persona mix, Funnel counts, Bad payers list. Use `st.download_button` with CSV (and optional Excel). | Offline analysis and decks without leaving the app. |
| **“What’s in this view”** | At the top of BNPL Performance (or in sidebar): 2–3 lines. “This view shows: portfolio signals, health metrics, behaviour segments, merchant concentration, collection recovery, and overdue instalments. Data: INSTALMENT_PLAN, BNPL_COLLECTIONS, …” Optional link to a data dictionary. | Onboarding and audit in one place. |
| **Keyboard shortcut** | e.g. **R** = refresh (rerun). Optional **?** = open short “Keyboard shortcuts” modal or expander. | Power users stay in flow. |
| **Graceful degradation** | If one query fails (e.g. behaviour or collections), show the rest of the dashboard and a clear **card** in place of the failed block: “Behaviour: data unavailable (timeout or missing table).” Don’t break the whole page. | Resilience and clear expectations. |

---

## 3. Cross-cutting (intelligence + UX)

| Idea | What to build | Why it’s next-level |
|------|----------------|---------------------|
| **Benchmark bands on key metrics** | For default rate, first-try collection, approval rate: show a **target band** (e.g. “Target: &lt;5%”) as a subtle line or shaded zone in the metric card or small sparkline. | “Good” vs “needs work” is visible at a glance. |
| **Trend sparklines** | Next to each of the 4 core health metrics (or in the signal strip): a **tiny 5–7 point trend** (e.g. last 7 days or last 4 weeks). No full chart—just direction. | Momentum without leaving the page. |
| **Role-style views** | Optional **view presets** in the sidebar, e.g. “Collections” (recovery curve, overdue, failure reasons, bad payers) and “Strategy” (signals, merchant, behaviour, thesis). Each preset scrolls to or opens only those sections. | Right information for the right role. |
| **Overdue / at-risk in the strip** | In the top signal strip (or right under the date range): **“Uncollected / overdue: N”** with link or expander to the Bad payers section or export. | Drives action from the first second. |
| **Version + changelog** | Footer or sidebar: “Console v1.2” and “Changelog” expander with 3–5 recent bullets (e.g. “Added merchant quick links”, “Collection engine layout”). | Traceability and support. |

---

## 4. Quick wins (high impact, low effort)

1. **Last refreshed** in header or sticky bar (use existing `st.session_state["bnpl_last_refreshed"]`).
2. **Export merchant table** and **Export segment mix** as CSV via `st.download_button`.
3. **Failure reasons** one-liner or small bar in Collection engine (if `failure_reasons_df` is loaded).
4. **Overdue count** in the top strip: “Uncollected: N” linking to Bad payers.
5. **Deep link** for `view` + `from` + `to` (and optionally compare) so shared URLs open the right view and range.

---

## 5. Out of scope (stay minimal)

- No heavy animation or decorative charts.
- No real-time streaming; refresh on load or on demand is enough.
- No in-app collaboration; sharing = export + link.

---

## Suggested order to implement

1. **Trust & context:** Last refreshed, deep links, “What’s in this view.”
2. **Action:** Alert strip (1–3 rules), overdue in strip, failure-reason sentence.
3. **Narrative:** One-line daily take, comparison in headlines when compare mode is on.
4. **Control:** Collapsible sections, export buttons, optional role presets.
5. **Depth:** Next best action by segment, benchmark bands, trend sparklines, roll rate / limit utilisation when data exists.

You can treat this as a backlog and tick items off as you implement them in the dashboard.
