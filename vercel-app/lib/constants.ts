/** Design and content constants aligned with Streamlit dashboard. */
export const PALETTE = {
  bg: '#0F172A',
  panel: '#111827',
  elevated: '#1E293B',
  text: '#E5E7EB',
  textSecondary: '#CBD5E1',
  textSoft: '#64748B',
  success: '#22C55E',
  warn: '#F59E0B',
  danger: '#EF4444',
  accent: '#3B82F6',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.12)',
  chartStable: '#22C55E',
  chartRoller: '#F59E0B',
  chartVolatile: '#F97316',
  chartEscalator: '#EF4444',
  chartInactive: '#64748B',
} as const;

export const REVENUE_RATE = 0.0499;

export const PERSONA_DISPLAY_NAMES: Record<string, string> = {
  lilo: 'Stable',
  early_finisher: 'Early Finishers',
  stitch: 'Rollers',
  jumba: 'Volatile',
  gantu: 'Repeat Defaulters',
  never_activated: 'Never Activated',
  unknown: 'Unknown',
};

export const MACRO_ZONES = [
  { key: 'healthy', name: 'Healthy', internal_keys: ['lilo', 'early_finisher'], sublabel: 'Stable + Early Finishers', color: PALETTE.chartStable, description: 'Pays on time or early. Low retries, no default.', so_what: 'Maintain; nurture with loyalty and higher limits where appropriate.' },
  { key: 'friction', name: 'Friction', internal_keys: ['stitch', 'jumba'], sublabel: 'Rollers + Volatile', color: PALETTE.chartRoller, description: 'Late or missed then paid on retry; or one default then recovered.', so_what: 'Focus on retry and reminders; consider soft limits.' },
  { key: 'risk', name: 'Risk', internal_keys: ['gantu'], sublabel: 'Repeat Defaulters', color: PALETTE.chartEscalator, description: 'Multiple defaults or no recovery. Highest portfolio risk.', so_what: 'Focus on collections and limits.' },
  { key: 'never_activated', name: 'Never Activated', internal_keys: ['never_activated'], sublabel: 'First instalment failed', color: PALETTE.chartInactive, description: 'First payment attempt failed. Funnel drop.', so_what: 'Improve checkout and first-payment UX.' },
];

export const FUNNEL_DROPOFF_SUGGESTIONS = [
  { from_step: 'Signed up', to_step: 'KYC completed', why: 'Users abandon before or during KYC: long form, unclear value, document capture friction, mobile UX, or they sign up but never open the verification link.', fix: 'Shorten the flow; send reminder SMS/email with one-tap link; show progress; optimise document capture; pre-fill where possible.' },
  { from_step: 'KYC completed', to_step: 'Credit check completed', why: 'Credit check rejected or not run: policy too strict, score thresholds, affordability rules, or technical failure.', fix: 'Review rejection reasons; relax non-risk levers where safe; improve messaging; retry transient failures.' },
  { from_step: 'Credit check completed', to_step: 'Plan creation', why: 'Approved users don\'t reach the plan/payment step: drop-off on offer screen, unclear terms, basket abandoned.', fix: 'Simplify offer screen; show instalment breakdown; reduce friction to Continue; save basket and send reminder.' },
  { from_step: 'Plan creation', to_step: 'Initial collection', why: 'Users reach payment but don\'t complete: card declined, insufficient funds, 3DS/OTP abandonment.', fix: 'Support multiple payment methods; retry failed attempts; optimise 3DS flow; prompt to add another card.' },
];

/** Placeholder behaviour mix (%). When API has behaviour data, replace. */
export const DEFAULT_PERSONA_PCTS: Record<string, number> = {
  lilo: 48,
  early_finisher: 12,
  stitch: 15,
  jumba: 10,
  gantu: 9,
  never_activated: 6,
};

export const DEFAULT_PERSONA_DELTAS: Record<string, number> = {
  gantu: 1.8,
  jumba: -1.2,
  stitch: 0.3,
  lilo: -0.8,
  early_finisher: 0.6,
};
