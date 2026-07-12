# Chat transcript — Orbit Auto Components Private Limited

**Underwriter:** why decline but still offer receivables discounting?

**Copilot:** **Short answer: the invoice discounting adds zero net new debt — it substitutes existing drawn WC, so it doesn't worsen an already-broken DSCR.**

---

- **The decline is for new senior/amortising debt.** Any new term loan or incremental WC line adds to the INR 314 Mn outstanding and increases annual debt service above the current INR 88.75 Mn — which EBITDA of INR 50.57 Mn already can't cover (DSCR 0.57x).

- **Invoice discounting is structurally different — it's a substitution, not an addition.**
  - ICICI Cash Credit (INR 104 Mn drawn) gets reduced by INR 1 for every INR 1 discounted.
  - Net funded debt stays at INR 314 Mn — the covenant explicitly caps total debt at current outstanding.
  - No new principal repayment obligation is created; each invoice self-liquidates when the debtor pays.

- **The incremental cost is marginal and quantified.**
  - CC interest saved: INR 61.4 Mn × 10.2% = INR 6.26 Mn/yr
  - Invoice discounting cost: INR 61.4 Mn × 13.25% = INR 8.14 Mn/yr
  - Net extra cost: INR 1.87 Mn/yr — DSCR moves from 0.57x to 0.54x, not a cliff.

- **It actually improves the credit quality of the WC book.**
  - CC is unsecured revolving draw; invoice discounting is backed by assigned receivables routed through escrow.
  - Lender gets direct debtor payment flow — better recovery position than an unsecured CC.

- **The alternative (doing nothing) is worse.**
  - CC is 95.3% utilised with no headroom; the company has no liquidity buffer (cash covers 0.09 months of outflows).
  - A self-liquidating receivables line at least creates a structured repayment cycle tied to actual trade flows.

- **Bottom line:** Decline = no new money in. Invoice discounting = same money, better structure, better security, same debt quantum.

---

**Underwriter:** the receivables may already be charged to the ICICI cash credit - how does your facility deal with that?

**Copilot:** **Critical point — if ICICI's CC already has a first charge on current assets (including receivables), our facility cannot take a clean assignment without ICICI's consent. Here's how to handle it.**

---

**What the dataroom tells us (and doesn't):**
- Only the ICICI CC sanction letter is in the dataroom — and it's a scan (`Sanction_Letter_scan.png`).
- The snapshot already flags `sanction_letter_partial_coverage` — we don't have the full charge documents.
- Standard ICICI CC practice: first pari-passu charge on entire current assets (stock + debtors) is almost certainly in place.
- We do **not** have the CERSAI charge search or ROC Form CHG-7 extract in the dataroom — so charge position is **unconfirmed but highly probable**.

---

**The structural problem if charge exists:**
- We cannot take a valid first charge / clean assignment of receivables that are already hypothecated to ICICI.
- Discounting invoices already charged to ICICI without their NOC could constitute fraudulent encumbrance.
- Debtor payments routed to our escrow would conflict with ICICI's charge — they could legally intercept those flows.

---

**How the structure must be adapted:**

- **Option 1 — ICICI NOC + Pari-passu Inter-Creditor Agreement (ICA)**
  - Require ICICI's written NOC specifically releasing identified invoices from their charge for the purpose of discounting.
  - Execute a formal ICA where ICICI agrees our escrow has priority on specifically assigned invoices.
  - ICICI CC limit reduces by INR 1 for every INR 1 discounted — this gives ICICI an incentive (their exposure reduces, security pool shrinks proportionately).
  - **This is already listed as a CP in the recommended structure** but needs to be elevated to a hard gate, not just a formality.

- **Option 2 — ICICI itself runs the invoice discounting (sub-limit of CC)**
  - Cleaner structurally: ICICI converts part of the CC into a self-liquidating invoice discounting sub-limit under their existing charge.
  - We step back and offer only the advisory / structuring role — or co-originate if ICICI agrees.
  - Avoids inter-creditor conflict entirely.

- **Option 3 — Co-lending / Funded Participation with ICICI**
  - We fund alongside ICICI under their existing charge umbrella via a participation agreement.
  - More complex, slower to execute, but preserves charge integrity.

---

**What we need before proceeding:**

- **CERSAI charge search** on Orbit Auto Components CIN `U40374HA2012PTC301867` — confirms exact charge holder, asset class charged, and whether debtors are specifically included.
- **ROC Form CHG-1 / CHG-7 filings** — confirms charge creation and satisfaction history.
- **Full ICICI CC sanction letter** (not just the scan) — check exact hypothecation clause wording on current assets.
- **ICICI's written NOC / ICA term sheet** — without this, Option 1 cannot proceed.

---

**Revised CP priority:**
- CERSAI search → elevated to **Day 1 diligence action**, before any term sheet is issued.
- ICICI NOC + ICA → elevated from standard CP to **hard structural prerequisite**; no drawdown possible without it.
- If ICICI declines NOC → Option 1 falls away; pivot to Option 2 or decline invoice discounting entirely.

---

**Bottom line:** The facility as structured assumes pari-passu charge is achievable — that assumption needs to be stress-tested against the CERSAI search immediately. If ICICI holds an exclusive first charge on debtors and won't grant NOC, the invoice discounting structure collapses and the only remaining recommendation is the term-loan restructuring advisory.

---

**Underwriter:** what would need to change for new senior debt to become possible?

**Copilot:** **Short answer: four things need to move simultaneously — DSCR above 1.25x, net worth positive, leverage below 3.5x, and data-quality flags cleared. None are close today.**

---

**Where we are vs. where we need to be:**

| Metric | Today | Minimum Threshold | Gap |
|---|---|---|---|
| DSCR | 0.57x | 1.25x | Need EBITDA/debt-service ratio to more than double |
| Net Worth | INR -11.6 Mn | > 0 (ideally > INR 50 Mn) | Need ~INR 12 Mn just to reach zero |
| Debt/EBITDA | 6.21x | ≤ 3.5x | Need debt down and/or EBITDA up sharply |
| Current Ratio | 0.99x | ≥ 1.2x | Needs ~INR 30 Mn liquidity improvement |
| PAT | -INR 4.8 Mn | Positive | Three consecutive loss years |

---

**The four levers — what specifically needs to change:**

**1. Debt service must fall (restructuring is prerequisite, not optional)**
- Term-loan restructuring to 84 months reduces annual debt service from INR 88.75 Mn to ~INR 55.4 Mn.
- Post-restructuring DSCR = 0.91x — still below 1.25x but the floor is cleared.
- To reach 1.25x on restructured debt service of INR 55.4 Mn, EBITDA must reach INR 69.2 Mn.
- Current EBITDA = INR 50.6 Mn — gap of INR 18.6 Mn (37% improvement needed).
- **Restructuring must complete before any new senior debt conversation starts.**

**2. EBITDA must grow to INR 69+ Mn**
- Two paths — revenue growth or margin expansion (or both):
  - *Revenue path:* at current 8.4% EBITDA margin, revenue needs to reach INR 824 Mn (vs. INR 602 Mn today — 37% growth; at 3% annual growth that's ~10 years away).
  - *Margin path:* at current INR 602 Mn revenue, EBITDA margin needs to reach ~11.5% (vs. 8.4% today — 310 bps improvement).
  - *Combined path (realistic):* revenue INR 650 Mn + margin 10.5% = EBITDA INR 68.3 Mn — achievable in 2-3 years if operational improvements are made.
- Need to see **two consecutive years of EBITDA growth** before new senior debt is considered.

**3. Net worth must turn positive and build**
- Currently INR -11.6 Mn — driven by three years of PAT losses (INR -8.6 Mn, -6.3 Mn, -4.8 Mn).
- PAT is improving ~INR 1.5-1.9 Mn per year at current trajectory.
- At that rate, PAT breakeven is ~2-3 years away; net worth turns positive ~1 year after that.
- **Faster routes:**
  - Promoter equity infusion — Vikram Sethi / Helios Growth Fund inject fresh equity; INR 15-20 Mn would clear negative net worth and provide covenant headroom.
  - This is the single fastest fix and should be a condition of any future senior debt conversation.
  - Helios Growth Fund (10% holder) is the natural candidate — equity infusion aligns with their investment thesis.

**4. Leverage must compress to ≤ 3.5x Debt/EBITDA**
- Today: INR 314 Mn debt / INR 50.6 Mn EBITDA = 6.21x.
- To reach 3.5x at current EBITDA: debt must fall to INR 177 Mn (repay INR 137 Mn — 44% of outstanding).
- To reach 3.5x at target EBITDA INR 69 Mn: debt must fall to INR 241 Mn (repay INR 73 Mn).
- **Debt reduction sources:**
  - Operating cash flow after restructured EMIs — modest but positive if DSCR > 1.0x.
  - Promoter equity infusion applied directly to debt prepayment.
  - Asset monetisation — net block INR 136.5 Mn; sale-leaseback of non-core fixed assets could release INR 20-30 Mn.

---

**Data-quality flags must be cleared (non-negotiable):**

- **INR 44.7 Mn cash discrepancy** (balance sheet vs. bank statement) — auditor certificate required; until resolved, financial statements cannot be relied upon for covenant testing.
- **Missing 3 sanction letters** — INR 210 Mn of debt is unconfirmed; any new lender doing senior underwriting needs confirmed charge positions on all existing debt.
- **CERSAI charge search** — must confirm exact security position before any new charge can be created.

---

**Minimum conditions checklist for new senior debt to be tabled:**

- [ ] Term-loan restructuring completed and 6-month moratorium period passed
- [ ] Two consecutive quarters of DSCR ≥ 1.0x on restructured basis (auditor-certified)
- [ ] PAT positive for at least one full fiscal year
- [ ] Net worth positive — ideally via promoter equity infusion of ≥ INR 15 Mn
- [ ] Debt/EBITDA ≤ 5.0x (interim gate) and trajectory toward 3.5x confirmed
- [ ] All four sanction letters in dataroom
- [ ] Cash discrepancy reconciled with auditor certificate
- [ ] CERSAI search clean or existing charges confirmed and mapped
- [ ] No cheque bounces in trailing 6 months
- [ ] Current ratio ≥ 1.2x

---

**Realistic timeline:**
- Earliest credible window for new senior debt: **18-24 months** — contingent on restructuring completing in Q1, promoter equity infusion, and EBITDA reaching INR 60+ Mn by FY2027.
- If promoter equity infusion of INR 20 Mn happens immediately: net worth turns positive, DSCR improves marginally (interest saving on prepaid debt), timeline compresses to **12-18 months**.
- Without equity infusion: **24-36 months** at current trajectory.

---
