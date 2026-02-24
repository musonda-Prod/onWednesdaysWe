# Dashboard: Hover & Intelligence UX Enhancements

Suggestions aligned with the PRD: **minimalist, high-signal, strategic**. No clutter.

---

## 1. Hover / tooltip enhancements

### Signal blocks (HEALTH, RISK, CONCENTRATION, MOMENTUM)
- **Add `title` tooltips** on each block so users see *why* the state is green/amber/red without opening the expander.
  - Example HEALTH: *"Default &lt;7% and first attempt &gt;65% → green. One outside band → amber."*
  - Example CONCENTRATION: *"Top 3 merchants' share of volume. &lt;50% = low, 50–70% = medium, &gt;70% = high."*

### Macro zone cards (Healthy, Friction, Risk, Never Activated)
- **Hover tooltip** with a one-line “So what?” (e.g. Risk: *"Focus on retry and limits; consider tightening for new signups."*).
- Reuse each zone’s `description` or add a short `hover_tip` in `MACRO_ZONES`.

### Default rate / Penalty ratio / First attempt (macro health row)
- **Extend `_value_with_tooltip`** to accept an optional custom tooltip string (e.g. Penalty ratio: *"Share of instalment amount that is penalties/fees (from overdue instalments)."*).
- Keep existing “Not enough cohort maturity” for —/No data.

### Recovery curve (A1, A2, A3, Unpaid)
- **Enrich `hovertemplate`** with a one-line takeaway (e.g. *"68% collected on first try; retries add 18pp."*).
- Optional: show **cumulative %** in hover (e.g. *"After A1: 68% · After A2: 82% · After A3: 86% · Unpaid: 14%"*).

### Merchant concentration chart
- **Add concentration risk band to hover** (High/Medium/Low) so users don’t need to look at the table.
- Already has plans + value + %; one extra line in `customdata`/`hovertemplate`.

### Merchant table
- **Column header tooltips** (e.g. “Stable+Early %” → *"Share of this merchant’s loan value from Stable and Early payers."*) via Streamlit column_config or a small (i) with `title`.

### Funnel steps
- You already have image tooltips on hover. Optionally add **one short “typical cause” line** in the tooltip (e.g. “Initial collection” → *"Often: card declined, insufficient funds, or user abandoned."*).

---

## 2. Intelligence UX (context without clutter)

### Portfolio status line
- **Small (i) or “How this is derived”** next to the one-sentence status with a tooltip: *"From default rate, first-attempt success, approval rate, and segment drift."*
- Keeps the sentence prominent; detail on demand.

### Section titles
- **Optional (i) per section** with one sentence (e.g. Merchant risk: *"Where our loan value sits by partner; high concentration = higher partner risk."*).
- Implement as `title` on the section heading or a tiny icon.

### Segment intelligence table
- **Tooltip on Segment name** (e.g. “Stitch” → *"Missed a due date then paid on retry; moderate risk."*).
- Use `PERSONA_CARD_CONFIG` / `BEHAVIOUR_LANDSCAPE_SEGMENTS` for copy.

### Recovery curve
- **One-line “Intelligence” under the retry badge** (e.g. *"Most failure on attempt 1; retries recover 18pp."*) so the takeaway is visible without opening anything.

### Funnel
- **One-line summary in the funnel subtitle** (e.g. *"Largest drop: Credit check → Plan creation (12%)."*) so the biggest leak is obvious at a glance.

### “Why —?” for placeholders
- For metrics that often show “—”, add a **per-metric tooltip** (e.g. “% of revenue from Repeat Defaulters”: *"Requires revenue by segment (e.g. from INSTALMENT_PLAN / payments)."*).
- Reduces “is it broken?” anxiety.

---

## 3. Chart hover consistency

- **Unify `hoverlabel`** across all Plotly charts (you already have `hoverlabel=dict(bgcolor=PALETTE["panel"], bordercolor=PALETTE["accent"])` in `chart_layout`). Ensure every custom chart uses it.
- **Behaviour landscape bar**: add segment mix in hover (e.g. *"Healthy: 60% · Friction: 25% · Risk: 15%."*) if the data is available in the figure.

---

## 4. Progressive disclosure (already strong)

- Keep expanders for: “How each signal is calculated”, “What is read at each step”, “Why drop-off may happen”, “Segment intelligence table”.
- Add **consistent “?” or “Info”** only for 2–3 key terms (e.g. “Concentration risk”, “Retry lift”) with a single-sentence `title` tooltip.

---

## 5. Quick wins (low effort, high value)

| Enhancement | Where | Effort |
|------------|--------|--------|
| Signal block `title` tooltips | 4 signal cards | Low |
| Recovery curve hover: cumulative % + one-line takeaway | Recovery curve | Low |
| Merchant concentration hover: risk band | `_merchant_concentration_chart` | Low |
| One-line “Intelligence” under retry badge | Collection engine | Low |
| Funnel subtitle: “Largest drop: X → Y (Z%)” | Funnel section | Low |
| Macro zone card `title` with “So what?” | User behaviour cards | Low |

---

## 6. Out of scope (per PRD)

- No heavy animations beyond the existing title load.
- No extra modals or panels unless they replace an existing expander.
- No decorative hover effects; only information.
