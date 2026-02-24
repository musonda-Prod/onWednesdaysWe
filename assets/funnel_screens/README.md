# Funnel screen screenshots (hover on conversion funnel)

The dashboard shows the relevant app screen when users hover on each conversion funnel step.

**Preferred: individual screens**  
Place one PNG per step in this folder with these exact names:

| Step | Filename |
|------|----------|
| Signed up | `signed_up.png` |
| KYC completed | `kyc_completed.png` |
| Credit check completed | `credit_check.png` |
| Approved | `approved.png` |
| Initial collection | `initial_collection.png` |

Each image is scaled to a consistent width for the tooltip so the full screen is visible.

**Fallback: composite**  
Alternatively, place a single wide composite PNG named **`composite.png`** (all app screens in one horizontal strip). The dashboard will slice it by step. Individual files above take precedence if present.
