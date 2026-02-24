# Dashboard sections: where real data is missing and what access is needed

This file lists every section that currently uses **placeholders**, **fallbacks**, or **synthetic data**, and what tables/columns or APIs you’d need to wire in real data.

---

## BNPL Reporting Notebook alignment

The dashboard aligns with the **BNPL Reporting Notebook** (and `bnpl_functions.py`) where the same CDC tables are used:

- **Data model:** Instalment Plan (one per BNPL order), Instalment (3–6 per plan), Collection Attempt (linked via COLLECTION_ATTEMPT_INSTALMENT_LINK), Consumer Profile (CREDIT_CHECK_STATUS, CREDIT_CHECK_ID), Credit Entity / Balance / Experian Result.
- **Approval rate** = non-rejected / total consumers who went through credit check (CREDIT_CHECK_STATUS != 'REJECTED').
- **Activation** = approved consumers who have at least one INSTALMENT_PLAN (STATUS ACTIVE/COMPLETED); same-day = first plan on same day as signup.
- **Credit extended** = order value − initial instalment; **outstanding** = credit extended − collected non-initial instalments.
- **First-attempt success** = % of non-initial instalments where the first collection attempt (by EXECUTED_AT) succeeded (STATUS = 'COMPLETED'); see `load_first_try_collection_from_cdc()`. The dashboard funnel’s last step is **Initial collection** (checkout payment), not first repayment.
- **Collection attempt types:** `initial` (checkout), `internal` (scheduled retry), `external` (Pay Now).
- **Failure classifications:** LIQUIDITY / TECHNICAL (retryable), NON_RETRYABLE (hard fail).
- **Credit score bands (notebook):** `<585`, `585-599`, `600-615`, `616-635`, `636-656`, `657+`, `Unknown`.

**Test users:** Set `EXCLUDE_TEST_USERS=true` in `.env` (default) to exclude consumers with `LOWER(EMAIL) LIKE '%stitch.money%'` from Signed up, KYC completed, and Activated counts, matching the notebook's `EXCLUDE_TEST_USERS` and `_EXCL_CP` / `_EXCL_PLAN`.

---

## 0. **Using your own BNPL data (recommended)**

- **Set in `.env`:** `BNPL_DATABASE`, `BNPL_SCHEMA`, `BNPL_TABLE` to point at your transaction/application table (e.g. `CDC_CREDIT_MASTER`, `PUBLIC`, `BNPL`). The dashboard will use this first instead of `ANALYTICS_PROD.PAYMENTS.BNPL`.
- **Fallback:** If the primary source fails, the dashboard tries the connection default database (`SNOWFLAKE_DATABASE` / `SNOWFLAKE_SCHEMA`) with table names: `BNPL`, `INSTALMENT_PLAN`, `BNPL_TRANSACTION`, `TRANSACTION`.
- **Column names:** Your table can use `AMOUNT` (mapped to VALUE), `CUSTOMER_ID` or `CONSUMER_ID` (mapped to CLIENT_ID), `MERCHANT` (mapped to MERCHANT_NAME), `DATE` or `TRANSACTION_DATE` (mapped to CREATED_AT). Ideal columns: VALUE (or AMOUNT), STATUS, CREATED_AT (or date column), CLIENT_ID (or customer id), MERCHANT_NAME (or MERCHANT) for applications, GMV, concentration, and growth.

---

## 1. **Top-level metrics (when Snowflake is unavailable)**

- **What’s placeholder:** Entire metrics dict (applications, approval rate, GMV, AOV, active customers, default rate, growth MoM, repeat rate) comes from `_demo_metrics()` when there’s no Snowflake connection.
- **What you need:** A live connection to Snowflake (or another source) so `load_bnpl_known_tables()` / `compute_bnpl_metrics()` run. Primary sources: `ANALYTICS_PROD.PAYMENTS.BNPL`, `ANALYTICS_PROD.PAYMENTS.BNPL_COLLECTIONS`, and optionally `CDC_BNPL_PRODUCTION.PUBLIC.INSTALMENT_PLAN` or `CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_PROFILE` for approval/allocated counts.

---

## 2. **Default rate**

- **What’s placeholder:** If no table has a default/arrears column, default rate is missing and the UI falls back to **6.2%** in several places (e.g. ranking, stress test, portfolio health).
- **What you need:** A table (e.g. `CDC_BNPL_PRODUCTION` instalment/plan or consumer profile) with a column that indicates default/delinquent/arrears/DPD. The code looks for column names containing "default", "delinquent", "arrears", "dpd", or "overdue". Alternatively, a dedicated default-flag or DPD column that can be aggregated to a portfolio default rate.

---

## 3. **Funnel (Signed up → KYC completed → Credit check completed → Approved → Initial collection)**

- **What’s real (when Snowflake + CDC tables are available):**
  - **Signed up:** `load_applied_count(conn, from_date, to_date)` — COUNT from **CDC_CONSUMER_PROFILE_PRODUCTION.PUBLIC.CONSUMER_PROFILE** (optionally filtered by CREATED_AT).
  - **KYC completed:** `load_kyc_verified_count(conn, ...)` — consumers with verified KYC (kyc_status IN ('VERIFIED','COMPLETE','SUCCESS')).
  - **Credit check completed:** approved + rejected (from CONSUMER_PROFILE CREDIT_CHECK_STATUS).
  - **Approved:** `load_approved_count(conn, ...)` — CONSUMER_PROFILE where CREDIT_CHECK_STATUS != 'REJECTED'.
  - **Initial collection:** **load_initial_collection_count(conn, from_date, to_date)** — COUNT(DISTINCT CONSUMER_PROFILE_ID) from COLLECTION_ATTEMPT (TYPE = 'initial', STATUS = 'COMPLETED') joined via COLLECTION_ATTEMPT_INSTALMENT_LINK → INSTALMENT → INSTALMENT_PLAN. This is the checkout/first payment; the dashboard uses this as **activated** (no separate “Activated” step).
- **What’s placeholder:** When Snowflake is unavailable or loaders return nothing, the funnel uses fallbacks (e.g. n_initial_collection = 0.95 × n_approved).

### Optional extra onboarding steps (if you have the data)

You can add more funnel steps if your CDC or analytics tables support them:

| Step | What you need | Example source |
|------|----------------|-----------------|
| **Application started** | Count of users who started but did not complete signup (e.g. first touch or partial form). | Event table or CONSUMER_PROFILE with status = 'PENDING' / 'INCOMPLETE' and CREATED_AT. |
| **Document / ID uploaded** | Count who uploaded ID before KYC verified. | Verification or KYC table with “document_uploaded” or “submitted” timestamp. |
| **Bank / payment method linked** | Count who linked a bank or card before first order. | Payment method or wallet table (e.g. CONSUMER_PROFILE or linked table with “payment_method_added” or similar). |
| **Terms accepted / contract signed** | Count who accepted T&C or signed the BNPL agreement. | CONSUMER_PROFILE or agreement table with acceptance timestamp or flag. |
| **Checkout started / basket created** | Count who started checkout before initial collection. | Order or basket table with CREATED_AT, optionally joined to COLLECTION_ATTEMPT to see who then completed initial. |

Add a loader (like `load_initial_collection_count`) and a funnel step in the same pattern as the existing steps; keep the order consistent with your real flow (e.g. Signed up → … → Terms accepted → Approved → Initial collection).

---

## 4. **Rejection drivers (Row 2 under funnel)**

- **What’s real:**  
  - **Top rejection reasons:** When **CDC_CREDITMASTER_PRODUCTION.PUBLIC.CREDIT_POLICY_TRACE** is available, the dashboard loads traces for rejected consumers (CONSUMER_PROFILE.credit_check_status = 'rejected', FINAL_DECISION = 'REJECT') and parses the **RULES** JSON for reasons starting with "Credit application rejected by rules: …". Those rule names are shown with real % (aligned with bnpl_functions logic). If policy trace is missing or has no parseable reasons, the UI falls back to score-based buckets (from EXPERIAN_RESULT.credit_score) or the fixed mix.
- **What’s placeholder:**  
  - **Rejection rate WoW:** "↑ 1.2pp WoW" is **hardcoded** (no week-over-week comparison).
- **What you need for WoW:** Same rejection funnel aggregated by week; then (this_week_rate − last_week_rate) in percentage points.

---

## 5. **KYC & operational friction (Row 3)**

- **What’s placeholder:**  
  - **Avg time stuck in KYC:** **1.4 days** is hardcoded.  
  - **Recovery after KYC prompt:** **62%** is hardcoded.
- **What you need:**  
  - **KYC drop-off rate:** Already computed from `len(kyc_df) / n_applied` when data exists (CDC_VERIFICATION_MASTER + CONSUMER_PROFILE).  
  - **Avg time stuck in KYC:** Timestamps for "entered KYC" and "verified" (or "abandoned") per user in verification/consumer tables.  
  - **Recovery after KYC prompt:** A flag or event indicating "completed KYC after reminder" vs "never completed", so we can compute % recovered after prompt.

---

## 6. **Frozen users (Row 4)**

- **What’s placeholder:** **Freeze reason mix** is the caption "Fraud · Chargeback · Compliance" only; no percentages. Current SQL only has `frozen = TRUE` (no reason).
- **What you need:** A **freeze reason** (or category) column on the table that has `frozen` (e.g. CONSUMER_PROFILE or a separate freezes table), with values we can group (e.g. Fraud, Chargeback, Compliance, Other). Then we can show real % mix.

---

## 7. **Behaviour composition**

- **What’s placeholder:** When `load_behaviour_data(conn)` returns nothing, behaviour comes from **`_behaviour_snapshot_placeholder()`**: fixed percentages for Never Activated, Lilo, Stitch, Jumba, Gantu, Early Finisher. So the whole section can be placeholder.
- **What you need:**  
  - **Activation:** First-installment success per plan/customer (already attempted from `CDC_BNPL_PRODUCTION` INSTALMENT / INSTALMENT_PLAN: status of first installment = success vs not).  
  - **Segments:** A **behaviour/segment** (or risk tier) per customer or per plan—e.g. Lilo, Stitch, Jumba, Gantu, Early Finisher—from CONSUMER_PROFILE, INSTALMENT, or a dedicated behaviour/collections table. Column names the code looks for: SEGMENT, BEHAVIOUR, RISK_TIER, STATUS, TYPE, CLUSTER, PAYMENT_BEHAVIOUR (in that order). Values are mapped to personas via `_match_persona_to_segment()`.

---

## 8. **Collection pulse**

- **What’s placeholder:**  
  - **Currently overdue %:** Uses `metrics.total_instalments` or `metrics.applications` or **10000** as denominator if missing.  
  - **Failures liquidity-related %:** **71%** unless `overdue_ca_df` has a failure/reason column with liquidity-related keywords.  
  - **Recovered within 7 days %:** **63%** is hardcoded.  
  - **Escalations:** **"Escalations stable"** is hardcoded (no count or trend).
- **What you need:**  
  - **Total instalments** (or active plans) for denominator.  
  - **Failure reason** (or classification) on collection/attempt data to compute liquidity-related %.  
  - **Recovery events** (e.g. paid within 7d of first overdue) to compute recovered within 7d %.  
  - **Escalation** flag or count (and optionally trend) to show real escalations.

---

## 9. **Merchant exposure & drift**

- **What’s placeholder:**  
  - **Merchant risk when no plans:** If `instalment_plans_today_df` (or plans from BNPL/INSTALMENT_PLAN) isn’t available, the whole section uses **`_merchant_risk_placeholder()`**: top3_volume_pct=62, escalator_excess_pp=1.8, n_merchants=3.  
  - **Escalator share:** Escalator % per merchant is **synthetic** (rank-based formula). Comment in code: "When behaviour cluster exists, replace with real escalator % per merchant."  
  - **Velocity Δ (4w):** **No 4-week data**; `velocity_delta_4w` is all None; drift in the fragility table uses **drift_placeholders** (e.g. "↑ 2.1pp", "↑ 0.4pp", …).  
  - **Risk drift label:** "Risk trending upward (4w)" uses **`_drift_pp = 2.1`** placeholder instead of real 4w delta.  
  - **Behaviour concentration (microbars):** "Requires behaviour cluster"; per-merchant mix uses **placeholder_pcts** (five fixed tuples) instead of real Stable/Stitch/Jumba/Gantu by merchant.
- **What you need:**  
  - **Plans/transactions with merchant** so volume share and concentration are real.  
  - **Escalator (or at-risk) share per merchant** from behaviour/segment data (e.g. % of each merchant’s users in Gantu/Jumba).  
  - **Volume (or exposure) by merchant over the last 4 weeks** to compute velocity delta and real drift.  
  - **Behaviour segment by merchant** (or by user linked to merchant) to show real behaviour composition per merchant.

---

## 10. **Portfolio health strip**

- **What’s placeholder:** Default, Approval, 1st Attempt, Penalty and the status sentence come from **metrics and first_attempt_pct**. If default_rate is missing, the narrative still uses 6.2% in places. The "What’s forming" line is rule-based from signal_label (Stable/Heating/Volatile), not from real drift/penalty data.
- **What you need:** Real **default rate**, **approval rate**, **first attempt %** (already supported from collection data), and if you want "Penalty" in the strip: **penalty/revenue or penalty count** so we can show a real metric and dependence ratio.

---

## 11. **Drift & product levers (expandable / internal)**

- **What’s placeholder:** **`_drift_placeholder()`** returns: Default Drift (30d vs 90d) +0.3pp, Limit Inflation vs Default Growth 1.1x, Penalty Dependence 8%, Retry Success Curve Shift −2%. Used when drift/levers aren’t loaded from data.
- **What you need:**  
  - **Default rate for 30d and 90d** (or two windows) to compute default drift (pp).  
  - **Limit/capacity and default** over time to get "limit inflation vs default growth" ratio.  
  - **Revenue from penalties** (and total revenue) for penalty dependence %.  
  - **Retry success rate** (e.g. by attempt number) for current vs prior period to compute curve shift.

---

## 12. **Path to #1 / Portfolio stress test**

- **What’s placeholder:** These use **real metrics when present** (approval, default, scale, growth). When **default_rate_pct** is missing, it falls back to **6.2%** in stress-test simulations. Benchmarks (e.g. SA top provider approval 70%, default 3%) are hardcoded in `BNPL_BENCHMARKS`; that’s intentional. So the only "missing" piece is **real default rate** so levers and path tasks aren’t using 6.2%.
- **What you need:** Same as **Default rate** above: a real default (or arrears) metric so Path to #1 and Stress Test use your actual default rate.

---

## 13. **Collection performance by attempt (when no CDC COLLECTION_ATTEMPT)**

- **What’s placeholder:** When `collection_by_attempt_df` is empty, the section shows a generic caption and, if there’s no `trend_df`, a **synthetic line chart** (14 days, fake volume) so something still renders.
- **What you need:** Access to **CDC_BNPL_PRODUCTION.PUBLIC.COLLECTION_ATTEMPT** (or equivalent) with **TRANSACTION_ID**, **STATUS**, and a date column (**EXECUTED_AT** or CREATED_AT) so we can compute success/fail by attempt number and, if desired, a real trend.

---

## 14. **Retry volume / trend chart**

- **What’s placeholder:** When there’s no **trend_df** (daily volume), the chart uses a **placeholder DataFrame**: 14 days, synthetic volume. So the line is fake.
- **What you need:** Same as in `load_bnpl_known_tables`: a **date column** on the main BNPL or collection table so we can resample to daily and build `trend_df` (e.g. CREATED_AT on ANALYTICS_PROD.PAYMENTS.BNPL).

---

## 15. **App ranking (South Africa / Global)**

- **What’s placeholder:** Ranking itself is computed from **real metrics** (approval, default, growth, scale) and benchmark averages. If **default_rate_pct** is missing, it’s assumed **6.2%** for the score. So again, the main gap is **real default rate**.
- **SA competitors (logos, rank, approval %, customers):** The list is in `SA_COMPETITORS` in dashboard.py. **Approval rates and customer counts** are **estimated from market reports** (Payflex, PayJustNow, MoreTyme, TymeBank, Mobicred, Happy Pay, Float — 2024–2025). Replace with your own data if you have it. Logos go in `assets/logos/` (e.g. payflex.png); set `logo_path` per competitor. **Your displayed SA rank** can be overridden with `DISPLAY_SA_RANK_OVERRIDE` (e.g. set to 6).
- **What you need:** Real **default_rate_pct** (and the rest of the metrics you already have) so the rank and projected ranks are fully data-driven.

---

## Summary table

| Section / metric              | Uses real data?              | What you need for full real data |
|------------------------------|------------------------------|-----------------------------------|
| Top-level metrics            | Yes if Snowflake + BNPL load | Connection + ANALYTICS_PROD / CDC tables |
| Default rate                 | Only if column exists        | Default/arrears/DPD column in a loaded table |
| Funnel counts                | Partial (rejected real)      | applications, active_customers in metrics |
| Rejection WoW                | No                           | Weekly rejection rate + prior week |
| Rejection reasons            | Partial (score buckets)      | Rejection reason / decline code or affordability & fraud flags |
| KYC drop-off                 | Yes                          | — |
| KYC avg days / recovery      | No                           | KYC timestamps; recovery-after-prompt flag |
| Frozen reason mix            | No                           | Freeze reason column (e.g. Fraud, Chargeback, Compliance) |
| Behaviour composition        | Yes if load_behaviour_data   | First-installment status + segment/behaviour column |
| Collection pulse             | Partial                      | total_instalments; failure reason; recovery 7d; escalation flag |
| Merchant exposure            | Yes if plans with merchant   | Plans/transactions by merchant; escalator % by merchant; 4w volume |
| Merchant drift / velocity    | No                           | Volume (or exposure) by merchant by week (4w) |
| Merchant behaviour mix        | No                           | Behaviour segment by merchant (or by user→merchant) |
| Portfolio health             | Partial                      | Real default rate; optional penalty metric |
| Drift & levers               | No                           | 30d/90d default; limit vs default; penalty rev; retry curve |
| Path to #1 / Stress test     | Partial                      | Real default_rate_pct |
| Collection by attempt        | Yes if CDC COLLECTION_ATTEMPT| TRANSACTION_ID, STATUS, date on COLLECTION_ATTEMPT |
| Retry/volume trend chart     | Yes if trend_df              | Date column on main BNPL/collection table |
| App ranking                  | Partial                      | Real default_rate_pct |

---

**Quick wins for "most impact with least new data":**

1. **Default rate** — One column (default/arrears/DPD) in an existing table unlocks ranking, stress test, and portfolio health.
2. **Rejection reason** — One decline/reason column for rejections unlocks real "Top rejection reasons".
3. **KYC timestamps + recovery flag** — Unlocks "Avg time stuck in KYC" and "Recovery after KYC prompt".
4. **Freeze reason** — One column on frozen users unlocks "Freeze reason mix".
5. **4-week volume by merchant** — Unlocks real drift and velocity in Merchant Exposure.
