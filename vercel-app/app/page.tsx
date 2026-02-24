'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PALETTE,
  REVENUE_RATE,
  PERSONA_DISPLAY_NAMES,
  MACRO_ZONES,
  FUNNEL_STEPS,
  FUNNEL_DROPOFF_SUGGESTIONS,
  DEFAULT_PERSONA_PCTS,
  DEFAULT_PERSONA_DELTAS,
} from '@/lib/constants';

type BnplPayload = {
  from: string | null;
  to: string | null;
  refreshed_at: string;
  applications: number | null;
  approval_rate_pct: number | null;
  n_applied: number | null;
  n_kyc_completed: number | null;
  n_credit_check_completed: number | null;
  n_plan_creation: number | null;
  n_initial_collection: number | null;
  n_consumers_with_plan: number | null;
  n_consumers_with_plan_all: number | null;
  n_overdue: number | null;
  loan_book: {
    credit_allocated: number | null;
    operations_settled: number | null;
    operations_collected: number | null;
    total_settled: number | null;
    total_collected: number | null;
  } | null;
  total_plan_amount: number | null;
  first_attempt_pct: number | null;
  default_rate_pct: number | null;
  penalty_ratio_pct: number | null;
  merchant: {
    top3_volume_pct: number | null;
    n_merchants: number | null;
    by_merchant: { merchant: string; plan_count: number; total_plan_amount: number }[];
  };
  error?: string;
};

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}
function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}
function fmtRand(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtRand2(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatRefreshed(iso: string): string {
  try {
    const d = new Date(iso);
    const sec = (Date.now() - d.getTime()) / 1000;
    if (sec < 60) return 'Last run: just now';
    if (sec < 3600) return `Last run: ${Math.floor(sec / 60)} min ago`;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<BnplPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    loan_book: true,
    funnel: true,
    behaviour: false,
    funnel_drop: false,
  });

  const fallbackErrorPayload = useCallback((): BnplPayload => ({
    from: from || null,
    to: to || null,
    refreshed_at: new Date().toISOString(),
    applications: null,
    approval_rate_pct: null,
    n_applied: null,
    n_kyc_completed: null,
    n_credit_check_completed: null,
    n_plan_creation: null,
    n_initial_collection: null,
    n_consumers_with_plan: null,
    n_consumers_with_plan_all: null,
    n_overdue: null,
    loan_book: null,
    total_plan_amount: null,
    first_attempt_pct: null,
    default_rate_pct: null,
    penalty_ratio_pct: null,
    merchant: { top3_volume_pct: null, n_merchants: null, by_merchant: [] },
  }), [from, to]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/bnpl?${params.toString()}`);
      const contentType = res.headers.get('content-type') ?? '';
      const isJson = contentType.includes('application/json');
      if (!isJson) {
        const text = await res.text();
        setData({ ...fallbackErrorPayload(), error: text || `Request failed (${res.status})` });
        return;
      }
      const json: BnplPayload = await res.json();
      setData(json);
    } catch (e) {
      setData({
        ...fallbackErrorPayload(),
        error: e instanceof Error ? e.message : 'Request failed',
      });
    } finally {
      setLoading(false);
    }
  }, [from, to, fallbackErrorPayload]);

  useEffect(() => {
    fetchData();
  }, []);

  const d = data;
  const dateRangeText =
    d?.from && d?.to
      ? `Metrics: ${new Date(d.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} → ${new Date(d.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
      : 'Select date range';
  const totalRevenue =
    d?.total_plan_amount != null && d.total_plan_amount > 0
      ? d.total_plan_amount * REVENUE_RATE
      : null;
  const personaPcts = { ...DEFAULT_PERSONA_PCTS };
  const personaDeltas = { ...DEFAULT_PERSONA_DELTAS };

  const nApplied = d?.n_applied ?? 0;
  const nKyc = d?.n_kyc_completed ?? 0;
  const nCredit = d?.n_credit_check_completed ?? 0;
  const nPlan = d?.n_plan_creation ?? 0;
  const nInitial = d?.n_initial_collection ?? 0;
  const dropKyc = Math.max(0, nApplied - nKyc);
  const dropCredit = Math.max(0, nKyc - nCredit);
  const dropPlan = Math.max(0, nCredit - nPlan);
  const dropInitial = Math.max(0, nPlan - nInitial);
  const pctDropKyc = nApplied ? Math.round((1000 * dropKyc) / nApplied) / 10 : 0;
  const pctDropCredit = nKyc ? Math.round((1000 * dropCredit) / nKyc) / 10 : 0;
  const pctDropPlan = nCredit ? Math.round((1000 * dropPlan) / nCredit) / 10 : 0;
  const pctDropInitial = nPlan ? Math.round((1000 * dropInitial) / nPlan) / 10 : 0;
  type DropItem = { label: string; pct: number };
  const drops: DropItem[] = [
    { label: 'Signed up → KYC', pct: pctDropKyc },
    { label: 'KYC → Credit check', pct: pctDropCredit },
    { label: 'Credit check → Plan', pct: pctDropPlan },
    { label: 'Plan → Initial collection', pct: pctDropInitial },
  ];
  const sortedDrops = [...drops].sort((a: DropItem, b: DropItem) => b.pct - a.pct);
  const firstDrop = sortedDrops[0];
  const largestDrop = sortedDrops.every((x) => x.pct === 0) || !firstDrop ? '—' : `${firstDrop.label} (${firstDrop.pct}%)`;

  const nextBestActions = [
    (personaPcts.stitch > 0 && PERSONA_DISPLAY_NAMES.stitch) ? `${PERSONA_DISPLAY_NAMES.stitch}: Focus on retry timing and early contact.` : null,
    (personaPcts.gantu > 0 && PERSONA_DISPLAY_NAMES.gantu) ? `${PERSONA_DISPLAY_NAMES.gantu}: Monitor drift; prioritise recovery where possible.` : null,
    (personaPcts.lilo > 0 && PERSONA_DISPLAY_NAMES.lilo) ? `${PERSONA_DISPLAY_NAMES.lilo}: Stable; maintain onboarding and first-try collection.` : null,
    (personaPcts.never_activated > 0 && PERSONA_DISPLAY_NAMES.never_activated) ? `${PERSONA_DISPLAY_NAMES.never_activated}: First payment failed; review friction and liquidity.` : null,
  ].filter(Boolean) as string[];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          background: PALETTE.panel,
          borderRight: `1px solid ${PALETTE.border}`,
          padding: 16,
        }}
      >
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: PALETTE.textSoft, marginBottom: 8 }}>
          Date range
        </div>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={{
            width: '100%',
            marginBottom: 8,
            background: PALETTE.elevated,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 6,
            color: PALETTE.text,
            padding: '8px 10px',
          }}
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{
            width: '100%',
            marginBottom: 12,
            background: PALETTE.elevated,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 6,
            color: PALETTE.text,
            padding: '8px 10px',
          }}
        />
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          style={{
            width: '100%',
            background: PALETTE.accent,
            color: PALETTE.bg,
            border: 'none',
            borderRadius: 6,
            padding: '10px 16px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <p className="muted" style={{ marginTop: 16, fontSize: '0.7rem' }}>
          View: BNPL Performance
        </p>
      </aside>

      <div className="main" style={{ flex: 1, maxWidth: 'none', paddingTop: 24 }}>
        <div className="bnpl-sticky-bar">
          <span className="bnpl-date">{dateRangeText}</span>
          <span className="bnpl-refresh">{d ? formatRefreshed(d.refreshed_at) : '—'}</span>
          <span style={{ color: PALETTE.textSoft }}>Compare: <strong>Off</strong></span>
        </div>

        {d?.error && (
          <div className="card" style={{ marginBottom: 16, borderColor: PALETTE.danger }}>
            <p className="error">{d.error}</p>
          </div>
        )}

        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            BNPL Pulse
          </h1>
          <p style={{ margin: '4px 0 8px 0', fontSize: '0.9rem', color: PALETTE.textSecondary }}>
            {dateRangeText} {d && formatRefreshed(d.refreshed_at) !== '—' ? ` · ${formatRefreshed(d.refreshed_at)}` : ''}
          </p>
          <p style={{ fontSize: '0.95rem', color: PALETTE.text, margin: 0 }}>
            Portfolio stable. Default rate and Repeat Defaulter share are starting to trend up; watch this segment. Concentration elevated. Collection efficiency holding.
          </p>
          <p style={{ fontSize: '0.85rem', color: PALETTE.textSecondary, margin: '8px 0 4px 0' }}>
            Today: Default {d?.default_rate_pct != null ? `${d.default_rate_pct}%` : '—'}, first-try collection {d?.first_attempt_pct != null ? `${d.first_attempt_pct}%` : '—'}. Keep an eye on concentration.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${PALETTE.border}`,
            }}
          >
            <div title="Active users: Count of users who signed up and completed an initial payment in the selected period.">
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: PALETTE.textSoft }}>Active users</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: PALETTE.text }}>{fmtNum(d?.applications)}</div>
            </div>
            <div title="Approval rate: % of applicants who were allocated credit.">
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: PALETTE.textSoft }}>Approval rate</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: PALETTE.text }}>{d?.approval_rate_pct != null ? `${d.approval_rate_pct}%` : '—'}</div>
            </div>
            <div title="Uncollected instalments: PENDING or OVERDUE.">
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: PALETTE.textSoft }}>Uncollected instalments</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: PALETTE.text }}>{fmtNum(d?.n_overdue)}</div>
            </div>
            <div title="Revenue = 4.99% of each plan amount in period.">
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: PALETTE.textSoft }}>Revenue</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: PALETTE.text }}>{totalRevenue != null ? fmtRand2(totalRevenue) : '—'}</div>
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'HEALTH', dot: '●', text: 'Contained', micro: 'Default & first attempt in band.', color: PALETTE.success },
            { label: 'RISK', dot: '●', text: 'Flat', micro: 'Repeat Defaulter share flat or decreasing.', color: PALETTE.success },
            { label: 'CONCENTRATION', dot: '●', text: 'Elevated', micro: 'Top 3 merchant share.', color: PALETTE.warn },
            { label: 'MOMENTUM', dot: '●', text: 'Stable', micro: 'Rank and approval trend.', color: PALETTE.success },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: PALETTE.panel,
                border: `1px solid ${PALETTE.border}`,
                borderLeft: `3px solid ${s.color}`,
                borderRadius: 8,
                padding: '10px 12px',
              }}
              title={`${s.label}: ${s.micro}`}
            >
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: PALETTE.textSoft, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 2 }}>{s.dot} {s.text}</div>
              <div style={{ fontSize: '0.7rem', color: PALETTE.textSecondary, lineHeight: 1.3 }}>{s.micro}</div>
            </div>
          ))}
        </div>

        <p className="section-title">Core health metrics</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Default rate', value: fmtPct(d?.default_rate_pct), trend: '+0.3pp', interp: 'Contained but drifting upward' },
            { label: 'First attempt collection success', value: d?.first_attempt_pct != null ? `${d.first_attempt_pct}%` : '—', trend: '→', interp: 'Stable' },
            { label: 'Approval rate', value: d?.approval_rate_pct != null ? `${d.approval_rate_pct}%` : '—', trend: '→', interp: 'In range' },
            { label: 'Penalty ratio', value: fmtPct(d?.penalty_ratio_pct), trend: '↑1.1pp', interp: 'Watch' },
            { label: 'Roll rate (30+ DPD)', value: '—', trend: '—', interp: 'Requires DPD data' },
          ].map((m) => (
            <div key={m.label} style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: '8px 16px' }} title={m.label}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: PALETTE.textSoft }}>{m.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: PALETTE.text, letterSpacing: '-0.02em' }}>{m.value}</div>
              <div style={{ fontSize: '0.75rem', color: PALETTE.textSoft }}>{m.trend}</div>
              <div style={{ fontSize: '0.7rem', color: PALETTE.textSoft, marginTop: 4, lineHeight: 1.3 }}>{m.interp}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setExpanded((e) => ({ ...e, loan_book: !e.loan_book }))}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              color: PALETTE.text,
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            {expanded.loan_book ? '▼' : '▶'} Loan book summary
          </button>
          {expanded.loan_book && d?.loan_book && (
            <div className="expander-content">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginTop: 12 }}>
                <div style={{ padding: '12px 16px', background: PALETTE.elevated, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: PALETTE.textSoft }}>Credit allocated</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.text }}>{fmtRand(d.loan_book.credit_allocated)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: PALETTE.elevated, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: PALETTE.textSoft }}>Settled to merchants</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.text }}>{fmtRand(d.loan_book.operations_settled ?? d.loan_book.total_settled)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: PALETTE.elevated, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: PALETTE.textSoft }}>Collections from users</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.text }}>{fmtRand(d.loan_book.operations_collected ?? d.loan_book.total_collected)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: PALETTE.elevated, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: PALETTE.textSoft }}>Funding gap</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.text }}>
                    {fmtRand(
                      (d.loan_book.operations_settled ?? d.loan_book.total_settled) != null &&
                      (d.loan_book.operations_collected ?? d.loan_book.total_collected) != null
                        ? Math.max(0, (d.loan_book.operations_settled ?? d.loan_book.total_settled ?? 0) - (d.loan_book.operations_collected ?? d.loan_book.total_collected ?? 0))
                        : null
                    )}
                  </div>
                </div>
                <div style={{ padding: '12px 16px', background: PALETTE.elevated, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: PALETTE.textSoft }}>Limit utilisation</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.text }}>
                    {d.loan_book.credit_allocated != null && (d.loan_book.operations_settled ?? d.loan_book.total_settled) != null && d.loan_book.credit_allocated > 0
                      ? `${((100 * (d.loan_book.operations_settled ?? d.loan_book.total_settled ?? 0)) / d.loan_book.credit_allocated).toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setExpanded((e) => ({ ...e, funnel: !e.funnel }))}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              color: PALETTE.text,
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            {expanded.funnel ? '▼' : '▶'} Conversion funnel
          </button>
          {expanded.funnel && (
            <div className="expander-content">
              <p style={{ fontSize: '0.8rem', color: PALETTE.textSoft, marginTop: 8 }}>
                Sign-up → Plan creation → initial collection. Largest drop: {String(largestDrop)}
              </p>
              <div className="funnel-strip" style={{ marginTop: 12 }}>
                {[
                  { value: nApplied, pctStr: '—', drop: 0 },
                  { value: nKyc, pctStr: `${pctDropKyc}% dropped`, drop: dropKyc },
                  { value: nCredit, pctStr: `${pctDropCredit}% dropped`, drop: dropCredit },
                  { value: nPlan, pctStr: `${pctDropPlan}% dropped`, drop: dropPlan },
                  { value: nInitial, pctStr: `${pctDropInitial}% dropped`, drop: dropInitial },
                ].map((step, i) => {
                  const config = FUNNEL_STEPS[i];
                  return (
                    <span key={config?.label ?? i} style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
                      {i > 0 && <span className="funnel-arrow">→</span>}
                      <div className="funnel-step-wrap" title={config?.tooltip} style={{ cursor: 'help' }}>
                        <div className="funnel-step-tooltip">
                          <img src={`/funnel_screens/${config?.image ?? ''}`} alt="" />
                          <div className="funnel-step-tooltip-label">{config?.label ?? ''} — screen</div>
                        </div>
                        <div className="funnel-step">
                          <div className="funnel-step-label">{config?.label ?? ''}</div>
                          <div className="funnel-step-value">{fmtNum(step.value)}</div>
                          <div className="funnel-step-pct">{step.pctStr}</div>
                          {step.drop > 0 && <div style={{ fontSize: '0.65rem', color: PALETTE.warn }}>↓ {step.drop.toLocaleString()} from prev</div>}
                        </div>
                      </div>
                    </span>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.8rem', color: PALETTE.textSoft, marginTop: 12 }}>
                <strong>Consumers with ≥1 plan:</strong> {fmtNum(d?.n_consumers_with_plan)} (in selected date range) {d?.n_consumers_with_plan_all != null ? ` · ${fmtNum(d.n_consumers_with_plan_all)} all time` : ''}
              </p>
            </div>
          )}
        </div>

        <p className="section-title">User behaviour</p>
        <p style={{ fontSize: '0.8rem', color: PALETTE.textSoft, marginBottom: 12 }}>
          Healthy = Stable + Early Finishers. Friction = Rollers + Volatile. Risk = Repeat Defaulters. Never Activated = first instalment failed.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {MACRO_ZONES.map((zone) => {
            const zonePct = zone.internal_keys.reduce((s, k) => s + (personaPcts[k] ?? 0), 0);
            const zoneTrend = zone.internal_keys.reduce((s, k) => s + (personaDeltas[k] ?? 0), 0) / Math.max(1, zone.internal_keys.length);
            const trendStr = zoneTrend > 0 ? `↑ +${zoneTrend.toFixed(1)}pp` : zoneTrend < 0 ? `↓ ${zoneTrend.toFixed(1)}pp` : '—';
            return (
              <div
                key={zone.key}
                style={{
                  background: PALETTE.panel,
                  border: `1px solid ${PALETTE.border}`,
                  borderLeft: `4px solid ${zone.color}`,
                  borderRadius: 8,
                  padding: 12,
                }}
                title={zone.so_what}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: PALETTE.text, marginBottom: 4 }}>{zone.name}</div>
                <div style={{ fontSize: '0.65rem', color: PALETTE.textSoft, marginBottom: 4 }}>{zone.sublabel}</div>
                <div style={{ fontSize: '0.7rem', color: PALETTE.textSecondary, marginBottom: 8, lineHeight: 1.35 }}>{zone.description}</div>
                <div style={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: PALETTE.textSoft }}>Share</div>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: PALETTE.text }}>{Math.round(zonePct)}%</span>
                <span style={{ fontSize: '0.65rem', color: PALETTE.textSoft }}> · Trend </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: PALETTE.text }}>{trendStr}</span>
              </div>
            );
          })}
        </div>

        <p className="section-title">Behaviour landscape</p>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, height: 28, borderRadius: 6, overflow: 'hidden', background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}>
          {['lilo', 'early_finisher', 'stitch', 'jumba', 'gantu', 'never_activated'].map((k) => (
            <div
              key={k}
              style={{
                width: `${personaPcts[k] ?? 0}%`,
                minWidth: personaPcts[k] ? 4 : 0,
                background: k === 'lilo' || k === 'early_finisher' ? PALETTE.chartStable : k === 'stitch' ? PALETTE.chartRoller : k === 'jumba' ? PALETTE.chartVolatile : k === 'gantu' ? PALETTE.chartEscalator : PALETTE.chartInactive,
              }}
              title={`${PERSONA_DISPLAY_NAMES[k] ?? k}: ${personaPcts[k] ?? 0}%`}
            />
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: PALETTE.textSoft, marginBottom: 16 }}>Stable · Early Finishers · Rollers · Volatile · Repeat Defaulters · Never Activated</p>

        {nextBestActions.length > 0 && (
          <>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>Next best action by segment</p>
            {nextBestActions.slice(0, 6).map((action, i) => (
              <div
                key={i}
                style={{
                  background: PALETTE.panel,
                  border: `1px solid ${PALETTE.border}`,
                  borderLeft: `3px solid ${PALETTE.accent}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: PALETTE.text }}>{action}</span>
              </div>
            ))}
          </>
        )}

        <p className="section-title" style={{ marginTop: 32 }}>Merchant concentration</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: PALETTE.textSoft }}>Top 3 merchant concentration</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: PALETTE.text }}>{d?.merchant?.top3_volume_pct != null ? `${d.merchant.top3_volume_pct}%` : '—'}</div>
            <div style={{ fontSize: '0.75rem', color: PALETTE.textSoft, marginTop: 4 }}>Share of volume from largest 3 merchants.</div>
          </div>
          <div style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: PALETTE.textSoft }}>Number of merchants</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: PALETTE.text }}>{d?.merchant?.n_merchants ?? '—'}</div>
            <div style={{ fontSize: '0.75rem', color: PALETTE.textSoft, marginTop: 4 }}>Merchant count in scope.</div>
          </div>
        </div>

        <p style={{ fontWeight: 700, marginBottom: 4 }}>Where our loans are concentrated</p>
        <p style={{ fontSize: '0.8rem', color: PALETTE.textSoft, marginBottom: 12 }}>Share of total loan value by merchant (%). Plans and value are for the selected date range.</p>
        {(() => {
          const byMerchant = d?.merchant?.by_merchant;
          if (!byMerchant || byMerchant.length === 0) {
            return (
              <div style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
                <p style={{ fontSize: '0.9rem', color: PALETTE.textSoft, margin: 0 }}>No merchant data for the selected period. Check date range and data connection.</p>
              </div>
            );
          }
          const totalVol = byMerchant.reduce((s, r) => s + r.total_plan_amount, 0);
          const top12 = byMerchant.slice(0, 12);
          const barColors = [PALETTE.chartStable, PALETTE.chartRoller, PALETTE.chartVolatile, PALETTE.chartEscalator, PALETTE.accent, '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16', '#F97316'];
          return (
            <div style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {top12.map((row, i) => {
                  const pct = totalVol > 0 ? (100 * row.total_plan_amount) / totalVol : 0;
                  return (
                    <div key={row.merchant} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: '0 0 140px', fontSize: '0.8rem', color: PALETTE.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.merchant}>{row.merchant}</div>
                      <div style={{ flex: 1, minWidth: 0, height: 22, background: PALETTE.elevated, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: barColors[i % barColors.length], borderRadius: 4 }} title={`Plans: ${row.plan_count} · Value: ${row.total_plan_amount.toLocaleString()} · ${pct.toFixed(1)}%`} />
                      </div>
                      <div style={{ flex: '0 0 48px', fontSize: '0.8rem', fontWeight: 600, color: PALETTE.text, textAlign: 'right' }}>{pct.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {(() => {
          const byMerchant = d?.merchant?.by_merchant;
          if (!byMerchant || byMerchant.length === 0) return null;
          return (
            <>
              <p style={{ fontWeight: 700, marginBottom: 4 }}>Revenue per merchant</p>
              <p style={{ fontSize: '0.8rem', color: PALETTE.textSoft, marginBottom: 8 }}>Revenue per merchant = 4.99% of each individual plan amount for that merchant (sum over all plans in the selected period).</p>
              <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${PALETTE.border}` }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: PALETTE.textSoft, fontWeight: 600 }}>Merchant</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: PALETTE.textSoft, fontWeight: 600 }}>Plan amount (R)</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: PALETTE.textSoft, fontWeight: 600 }}>Revenue (4.99%) (R)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMerchant.slice(0, 15).map((row) => (
                      <tr key={row.merchant} style={{ borderBottom: `1px solid ${PALETTE.border}` }}>
                        <td style={{ padding: '10px 12px', color: PALETTE.text }}>{row.merchant}</td>
                        <td style={{ padding: '10px 12px', color: PALETTE.text, textAlign: 'right' }}>{row.total_plan_amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '10px 12px', color: PALETTE.text, textAlign: 'right' }}>{(row.total_plan_amount * REVENUE_RATE).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}

        {totalRevenue != null && totalRevenue > 0 && (
          <>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>Total revenue</p>
            <div style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: '12px 16px', marginBottom: 24 }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: PALETTE.textSoft }}>Revenue (4.99% of each plan)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: PALETTE.text }}>{fmtRand2(totalRevenue)}</div>
              <div style={{ fontSize: '0.75rem', color: PALETTE.textSoft, marginTop: 4 }}>Total plan amount in period: {fmtRand(d?.total_plan_amount)}</div>
            </div>
          </>
        )}

        <div className="card" style={{ marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => setExpanded((e) => ({ ...e, funnel_drop: !e.funnel_drop }))}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              color: PALETTE.text,
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            {expanded.funnel_drop ? '▼' : '▶'} Why drop-off may happen at each step and how to fix it
          </button>
          {expanded.funnel_drop && (
            <div className="expander-content">
              {FUNNEL_DROPOFF_SUGGESTIONS.map((sug, i) => (
                <div
                  key={i}
                  style={{
                    background: PALETTE.elevated,
                    border: `1px solid ${PALETTE.border}`,
                    borderLeft: `4px solid ${PALETTE.accent}`,
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: PALETTE.text, marginBottom: 8 }}>
                    {i + 1}. {sug.from_step} → {sug.to_step}
                    {[dropKyc, dropCredit, dropPlan, dropInitial][i] > 0 && (
                      <span style={{ marginLeft: 8, background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, borderRadius: 999, padding: '2px 8px', fontSize: '0.7rem', color: PALETTE.textSoft }}>
                        {[dropKyc, dropCredit, dropPlan, dropInitial][i].toLocaleString()} dropped
                      </span>
                    )}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: PALETTE.textSoft, marginBottom: 4 }}>Why it may happen</div>
                    <div style={{ fontSize: '0.8rem', lineHeight: 1.5, color: PALETTE.text }}>{sug.why}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: PALETTE.textSoft, marginBottom: 4 }}>How to fix</div>
                    <div style={{ fontSize: '0.8rem', lineHeight: 1.5, color: PALETTE.text }}>{sug.fix}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
