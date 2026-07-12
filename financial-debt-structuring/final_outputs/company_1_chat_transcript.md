# Chat transcript — Solara Foods Private Limited

**Underwriter:** why is the CC enhancement the lead product and not invoice discounting?

**Copilot:** **CC enhancement leads because the funding gap is structural/recurring, not receivables-timing — ID alone can't cover it.**

- **Root cause of WC gap is inventory, not just DSO.**
  - Net WC cycle = DSO 42d + Inventory 46d – DPO 38d = **50 net days**
  - Inventory (46d) is the single largest component; ID only monetises receivables — it does **nothing** for the inventory funding gap
  - CC covers both legs (stock + debtors); ID covers only one

- **Peak WC need = ~INR 41.9M** (1.67 months × monthly COGS INR 25.1M); existing CC already at **68.3% utilisation (INR 41M drawn)** — headroom is thin and will compress further as revenue scales to INR 48.6Cr (FY26)

- **CC is revolving and always-on.** Solara needs a permanent, drawable buffer for day-to-day operations; ID is episodic — it only activates when invoices exist and are submitted, creating gaps during low-invoice periods

- **ID eligible pool is capped and variable.**
  - Eligible 0-60d receivables = INR 50.9M; after concentration haircut + 75% advance rate → INR 38.2M
  - That pool shrinks if collections accelerate or sales dip; CC limit is unconditional

- **Revenue growing at 26% YoY** — the WC gap will widen each quarter; a revolving CC scales naturally with utilisation, whereas ID requires fresh invoice submission every cycle

- **ID is additive, not substitutive** — it supplements the CC during peak months (e.g., May-25 inflows INR 55.1M, Aug-25 dip to INR 40.4M) but cannot replace the base revolving line

- **Pricing/structure fit:** CC at MCLR+75bps (9.75%) is appropriate for a recurring WC line; ID at repo+175bps (8.25%) is cheaper but self-liquidating — wrong instrument for a structural gap

**Bottom line:** CC enhancement solves the structural, always-present 50-day WC cycle including inventory. ID is a useful peak-liquidity tool layered on top, but it can't anchor the working-capital structure.

---

**Underwriter:** and if the CC enhancement were 1.5x?

**Copilot:** **What-if: CC enhancement sized at 1.5× avg monthly inflows instead of 1.8×**

1.5× avg monthly inflows = 1.5 × INR 47,231,461 = **INR 70,847,191 → ~INR 71M total CC limit**
Incremental over existing INR 60M sanction = **INR 11M** (vs INR 25M in base case)

---

**Serviceability re-check**

- Incremental CC interest: INR 11M × 80% avg utilisation = INR 8.8M drawn × 9.75% = **INR 858,000/year**
- Post-facility total debt service = INR 19,635,500 + INR 858,000 = **INR 20,493,500**
- Post-facility DSCR = INR 75,330,000 / INR 20,493,500 = **3.67× (vs 3.49× base case)**
- Total debt outstanding = INR 69,500,000 + INR 11,000,000 = **INR 80,500,000**
- Debt/EBITDA = INR 80,500,000 / INR 75,330,000 = **1.07× (vs 1.25× base case)**
- Both ratios improve vs base case; well clear of covenants ✓

---

**The problem: does INR 71M total CC actually cover the WC need?**

- Peak WC requirement (computed in base case) = INR 41.9M + 20% growth buffer = **INR 50.3M**
- INR 71M total limit vs INR 50.3M peak need → **INR 20.7M headroom** ✓ on paper
- But current drawn = INR 41M already; new limit = INR 71M → usable headroom = **INR 30M**
- FY26 revenue INR 48.6Cr growing at 26% → FY27 implied revenue ~INR 61.2Cr; monthly COGS scales to ~INR 31.6M; peak WC need rises to ~**INR 52.7M + 20% buffer = INR 63.2M**
- INR 71M limit would be **~90% utilised within 12 months** at current growth trajectory — breaching the "90% for 3 consecutive months" covenant trigger

---

**What changes vs base case**

| Parameter | Base case (1.8×) | What-if (1.5×) |
|---|---|---|
| Total CC limit | INR 85M | INR 71M |
| Incremental amount | INR 25M | INR 11M |
| Post-facility DSCR | 3.49× | 3.67× |
| Debt/EBITDA | 1.25× | 1.07× |
| FY27 utilisation (est.) | ~74% | ~89% → covenant risk |
| Re-pricing trigger risk | Low | High within 12m |

---

**Covenant/structural changes required at 1.5×**

- **Utilisation covenant must tighten:** 90% trigger becomes a near-certainty by FY27; recommend lowering the monitoring threshold to **80% for 2 consecutive months** to get early warning
- **Annual renewal cycle shortens effectively:** borrower will likely need to come back for another enhancement within 12 months — operationally inefficient and creates refinancing risk
- **ID facility becomes more critical:** with CC headroom tighter, the INR 38.2M ID line is no longer supplementary — it becomes a **necessary liquidity backstop**, changing the risk profile of the overall structure

---

**Recommendation**

- 1.5× is serviceable and ratios improve, but it **under-sizes the facility relative to the growth trajectory**
- Creates a near-certain covenant breach on utilisation within FY27 and forces an early renewal
- Base case 1.8× (INR 85M) is the better anchor; if credit committee wants conservatism, **1.65× (~INR 78M, incremental INR 18M)** is a reasonable middle ground — covers FY27 peak WC need without breaching utilisation covenant

---

**Underwriter:** what covenants change in that case?

**Copilot:** **Covenant changes under 1.5× (INR 71M total CC) vs base case (1.8× / INR 85M)**

---

**Covenants that must tighten**

- **CC utilisation monitoring threshold**
  - Base case: freeze trigger at >90% for 3 consecutive months
  - 1.5× case: must drop to **>80% for 2 consecutive months**
  - Reason: at 26% revenue growth, INR 71M limit hits ~89% utilisation by FY27; 90%/3-month trigger gives almost no reaction time

- **Annual renewal trigger**
  - Base case: standard 12-month renewal
  - 1.5× case: add a **mid-term review at 6 months** with mandatory limit adequacy assessment
  - Reason: borrower will likely need enhancement within the same tenor; formalise it rather than let it become an ad-hoc request

- **ID facility activation covenant**
  - Base case: ID is optional/supplementary; no mandatory draw trigger
  - 1.5× case: add a **mandatory ID utilisation clause** — if CC drawn >75% for 2 consecutive months, borrower must activate ID facility to relieve CC pressure
  - Reason: ID transitions from supplementary to structural backstop; needs to be contractually enforced, not discretionary

---

**Covenants that stay the same**

- DSCR ≥ 1.25× — post-facility DSCR is 3.67× vs 3.49× base; actually improves, no change needed
- Debt/EBITDA ≤ 3.0× — 1.07× vs 1.25× base; more headroom, no change needed
- Interest Coverage ≥ 2.0× — unaffected; ICR remains ~10×+ range
- Current Ratio ≥ 1.2× — unaffected by CC sizing
- Top-customer concentration ≤ 25% — unaffected
- No additional secured borrowings without NOC — unchanged
- Monthly stock and book-debt statements — unchanged
- No change of control — unchanged

---

**New covenant recommended only at 1.5×**

- **Limit adequacy certificate**
  - Borrower's CFO/auditor to certify at month 6 that existing CC limit remains sufficient for next 6 months' projected WC need based on actual revenue run-rate
  - If certificate cannot be given, lender has right to initiate enhancement review within 30 days
  - Not needed at 1.8× because headroom is sufficient through FY27

---

**Summary table**

| Covenant | Base (1.8×) | 1.5× case | Change? |
|---|---|---|---|
| Utilisation freeze trigger | >90% / 3 months | >80% / 2 months | **Tighter** |
| Mid-term review | None | 6-month mandatory | **New** |
| ID mandatory activation | Discretionary | >75% CC drawn / 2m | **New** |
| Limit adequacy certificate | Not required | Month-6 CFO cert | **New** |
| DSCR ≥ 1.25× | Unchanged | Unchanged | No change |
| Debt/EBITDA ≤ 3.0× | Unchanged | Unchanged | No change |
| ICR ≥ 2.0× | Unchanged | Unchanged | No change |
| Current Ratio ≥ 1.2× | Unchanged | Unchanged | No change |
| Concentration ≤ 25% | Unchanged | Unchanged | No change |

---

**Bottom line:** financial covenants don't need to change (ratios actually improve) — but **operational/monitoring covenants must tighten materially** to compensate for the thinner headroom. The three new covenants (utilisation threshold, mid-term review, mandatory ID activation) are the price of under-sizing.

---
