# Chat transcript — Nimbus Textiles Private Limited

**Underwriter:** which debtor book did you trust for sizing and why?

**Copilot:** **Used the Dataroom (Financial Statements) debtor ageing — the lower/more conservative of the two sources.**

- **Two conflicting ageing totals exist:**
  - Dataroom (Financial_Statements_FY26.pdf): total receivables **INR 75,632,877**
  - MIS report (Mar-26): total receivables **INR 87,626,053**
  - Gap: **INR 11,993,176** — flagged as data-quality flag `mis_vs_dataroom_ageing`

- **0–60 day eligible pool comparison:**
  - Dataroom 0–60d: INR 31,765,808 + INR 17,395,562 = **INR 49,161,370**
  - MIS 0–60d: INR 28,524,448 + INR 25,006,135 = **INR 53,530,583**
  - Dataroom is **INR 4,369,213 lower** → used as the conservative base

- **Why dataroom preferred over MIS:**
  - Dataroom figures tie (or are closer) to audited/CA-certified financial statements — a harder evidentiary standard than internal MIS
  - MIS total is **16% higher** than dataroom with no reconciling explanation provided — unexplained upward variance in a borrower-produced report is a red flag, not a comfort
  - Bucket mix also differs (MIS shows more in 31–60d bucket, less in 0–30d) — suggests possible reclassification or cut-off difference, not just a timing lag
  - The cash/bank-statement gap (INR 35,856,898) already signals balance-sheet integrity issues; compounding that by using the *higher* MIS number would double-count the benefit of the doubt

- **Additional haircut applied on top:**
  - Even after choosing the lower base, a further **~31% round-down** was applied (INR 35,366,689 computed pool → INR 24,500,000 first-draw limit) to absorb residual ageing ambiguity

- **Hard CP required:** Borrower must provide an **auditor-certified ageing as at a single cut-off date** reconciling both figures before any disbursement; limit will be re-sized off whichever certified number is lower.

---

**Underwriter:** why cut the advance rate to 60 percent?

**Copilot:** **Vastra Global Exports triggered a concentration haircut — standard 80% advance rate cut to 60% because a single debtor dominates both the revenue and the receivables book.**

- **Concentration facts:**
  - Vastra = **40.3% of total revenue** (INR 129,301,408 of INR 320,997,690)
  - Vastra outstanding = **INR 35,092,141** = ~46% of total dataroom receivables (INR 75,632,877)
  - Vastra's share of the 0–60d eligible pool (pro-rata): **INR 19,812,032** out of INR 49,161,370 = ~40%

- **Why concentration increases loss-given-default on the receivable pool:**
  - Invoice discounting is only as good as the debtor paying — if Vastra delays, disputes, or defaults, **~40–46% of the entire eligible pool fails simultaneously**
  - Standard ID underwriting treats any single debtor >25–30% of pool as requiring a haircut; Vastra at 40%+ is well above that threshold
  - Vastra is an **export debtor** (LLP, not a rated corporate) — cross-border/export receivables carry additional risk: forex settlement delays, trade documentation disputes, no domestic enforcement fallback
  - **No credit check on Vastra exists in the dataroom** — KYC/NPA status unknown at time of sizing; this is a hard CP

- **Arithmetic of the haircut:**
  - Standard advance rate: **80%**
  - Concentration haircut applied: **−20 percentage points**
  - Vastra-linked advance rate: **60%**
  - Vastra eligible pool: INR 19,812,032 × 60% = **INR 11,887,219**
  - vs. what 80% would have given: INR 19,812,032 × 80% = **INR 15,849,626**
  - Haircut saves lender **INR 3,962,407** of exposure on Vastra invoices alone

- **Separate exposure cap layered on top:**
  - Even at 60% advance rate, Vastra-linked discounting is **capped at INR 12,000,000** as a covenant — so the rate cut and the absolute cap work together; neither alone is sufficient
  - If Vastra outstanding grows (order book is INR 276,504,811 with INR 154,987,083 confirmed), concentration could worsen — cap prevents automatic limit creep

- **What would restore the 80% rate:**
  - Vastra's share of eligible pool falls below 25% (requires diversification of debtor base)
  - OR a satisfactory credit report / trade reference on Vastra is submitted and accepted
  - OR Vastra provides a confirmed irrevocable LC or bank guarantee backing the invoices

---

**Underwriter:** what happens if the MIS ageing turns out to be correct?

**Copilot:** **If the MIS ageing (INR 87,626,053 total, 0–60d = INR 53,530,583) is the correct figure, the eligible pool widens — but the facility limit moves up only modestly after applying the same haircuts.**

---

**Step 1 — Recompute eligible pool on MIS base:**
- MIS 0–60d: INR 28,524,448 + INR 25,006,135 = **INR 53,530,583**
- vs. Dataroom 0–60d used for sizing: **INR 49,161,370**
- Incremental eligible base: **+INR 4,369,213**

---

**Step 2 — Recompute Vastra-linked vs non-Vastra split:**
- Vastra pro-rata share of MIS 0–60d: INR 53,530,583 × 40.3% = **INR 21,572,825**
- Non-Vastra: INR 53,530,583 − INR 21,572,825 = **INR 31,957,758**

---

**Step 3 — Apply same advance rates:**
- Vastra at 60%: INR 21,572,825 × 60% = **INR 12,943,695**
- Non-Vastra at 80%: INR 31,957,758 × 80% = **INR 25,566,206**
- Gross eligible pool: **INR 38,509,901**

---

**Step 4 — Compare to current sizing:**
- Current facility: **INR 24,500,000** (sized off dataroom, ~69% of INR 35,366,689 pool)
- MIS-based pool at same 69% draw-down ratio: INR 38,509,901 × 69% = **INR 26,571,832**
- Incremental headroom unlocked: **~INR 2,100,000**

---

**Step 5 — DSCR impact of higher limit (INR 26,500,000 rounded):**
- Incremental interest vs current: (INR 26,500,000 − INR 24,500,000) × 9.9% = **INR 198,000/year**
- Net replacement DSCR still comfortably above 1.25x — **immaterial movement**

---

**Key conclusions:**

- **Upside is small** — even if MIS is fully correct, facility limit moves from INR 24,500,000 to ~INR 26,500,000; not a material change
- **The concentration haircut on Vastra dominates the sizing** — that constraint is independent of which ageing is correct; Vastra cap at INR 12,000,000 remains binding
- **The more important MIS-vs-dataroom question is on the 90+ day bucket:**
  - Dataroom 90+: INR 15,126,575 = **20.0%** of book → breaches the 15% covenant
  - MIS 90+: INR 12,202,559 = **13.9%** of book → just inside the 15% covenant
  - If MIS is correct, borrower is **not in immediate covenant breach** on 90+ days; if dataroom is correct, **covenant is already breached at inception** and a waiver/cure plan is needed
  - This is the more consequential difference between the two sources — flag this for the credit committee

- **What to do:**
  - Do not upsize the facility pre-certification — the INR 2,100,000 gain is not worth the integrity risk
  - The auditor-certified ageing (hard CP) resolves both the pool size and the 90+ day covenant question simultaneously
  - If MIS is certified correct: modestly upsize to ~INR 26,500,000 and confirm no 90+ day covenant waiver needed
  - If dataroom is certified correct: hold at INR 24,500,000 and require a cure plan for the 90+ day breach before first drawdown

---
