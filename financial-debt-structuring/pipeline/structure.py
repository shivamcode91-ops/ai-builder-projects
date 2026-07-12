"""The structuring judgment: one call to the reasoning model with (a) a
condensed debt-structuring knowledge base and (b) the computed snapshot.
The model chooses product + terms; code validates shape and serviceability.
"""
import json

from . import config
from .llm import parse_json_response

# Condensed from the provided Debt-Structuring KB primer. This is the only
# "domain knowledge" the model gets — everything else must come from the
# snapshot, which keeps the rationale traceable to the borrower's data.
KB_SUMMARY = """DEBT STRUCTURING PRINCIPLES (condensed knowledge base):

Products and fit:
- Term Loan (TL): capex/long-term needs; repaid from operating cash flows; 1-7yr amortising.
- Working Capital Demand Loan (WCDL): inventory/operating cycle; 3-12mo revolving.
- Cash Credit / Overdraft (CC/OD): day-to-day liquidity; repaid from collections; annual revolving.
- Invoice/Receivables Discounting: unlocks cash in receivables; self-liquidating from the
  invoices; 30-120 day cycles. Fits when short ageing buckets are healthy and debtors creditworthy.
- Revolving Credit Facility (RCF): flexible recurring draw/repay, 1-3yr.
- Venture Debt: pre-profit equity-backed runway, 2-4yr, often with moratorium.
- Supply-chain finance: lumpy supplier payments, per cycle.

Selection heuristics:
- Short recurring working-capital gap -> CC/OD, WCDL or RCF.
- Cash stuck in receivables with creditworthy debtors -> Invoice Discounting.
- One-time long-lived asset/capex -> amortising TL.
- Match repayment source to repayment obligation; never fund a 30-day gap with 5yr debt or vice versa.

Sizing rules of thumb:
- Working-capital limit ~ fraction of monthly inflows or of ELIGIBLE receivables
  (advance rate ~70-85% on current (0-60d) receivables; discount/exclude 90+ and
  haircut concentrated debtors).
- Term debt sized so projected DSCR >= 1.25 through the tenor (DSCR = EBITDA / (interest + principal due)).
- Total leverage kept within ~3x EBITDA unless strongly secured.

Risk -> terms mapping:
- Thin liquidity -> moratorium or revolving line over bullet TL.
- Cheque bounces -> tighter monitoring, higher spread, possible cash collateral.
- Revenue concentration -> concentration covenant, lower advance rate.
- High leverage -> smaller limit, tighter covenants.
- Weak governance -> personal guarantees, stricter covenants.
- Covenant norms: DSCR >= ~1.25, Debt/EBITDA <= ~3.0, ICR >= ~2.0, Current Ratio >= ~1.2,
  plus reporting, no-additional-debt, end-use, no change of control.
- Conditions precedent: filings, updated ageing, KYC, security perfection.
- Pricing: benchmark (repo/MCLR) + spread (bps) reflecting risk; processing/commitment fees.
- It is acceptable — and correct — to DECLINE new senior debt when serviceability fails
  (e.g. DSCR < 1.0, negative net worth), or to offer only self-liquidating/secured
  structures that do not add EMI burden, or restructuring of existing debt."""

OUTPUT_SCHEMA = """{
 "eligibility": "eligible | conditional | decline",
 "eligibility_reason": "one sentence",
 "recommended_products": [
   {
     "product": "e.g. Invoice Discounting / WCDL / Term Loan",
     "purpose": "use of funds",
     "amount_inr": <number>,
     "amount_basis": "arithmetic that produced the amount, citing snapshot fields",
     "tenor_months": <number>,
     "pricing": {"benchmark": "repo|MCLR", "spread_bps": <number>, "all_in_rate_pct": <number>,
                 "processing_fee_pct": <number>},
     "repayment": "amortising EMI | bullet | revolving | self-liquidating (+ moratorium if any)",
     "advance_rate_pct": <number|null>,
     "security": ["..."],
     "covenants": ["specific, with numeric thresholds"],
     "conditions_precedent": ["..."],
     "monitoring": ["..."],
     "serviceability_check": ["explicit arithmetic, ONE step per array entry, e.g.
                              'EBITDA FY2025-26 = INR 75,330,000', ending with the
                              post-facility DSCR or coverage conclusion"]
   }
 ],
 "declined_products": [{"product": "...", "reason": "tied to snapshot evidence"}],
 "key_risks": ["top risks the structure mitigates and how"],
 "rationale": ["6-12 crisp bullet points, <=25 words each; every bullet must cite a
               specific snapshot number or flag. NOT prose paragraphs."]
}"""

SYSTEM_PROMPT = f"""You are a senior credit structurer at an Indian debt marketplace.
You receive a computed credit snapshot for one borrower (all numbers already
extracted and cross-checked from its dataroom; data-quality flags list known
inconsistencies). Recommend a debt structure per the knowledge base.

{KB_SUMMARY}

Rules:
- Be specific and serviceable: size amounts with explicit arithmetic from snapshot
  numbers; never propose debt the cash flows cannot carry.
- Use the LATEST fiscal year's figures for all serviceability math, and label the
  year you used.
- Where two documents disagree on the same quantity (see data-quality flags), use
  the LOWER/more conservative number for sizing.
- Any amortising facility must keep post-facility DSCR >= 1.25 (show the math).
- Base advance rates on ELIGIBLE (0-60 day) receivables; haircut for concentration.
- Address the data-quality flags: where documents disagree, structure conservatively
  off the weaker number and add a condition precedent to resolve the discrepancy.
- Choose the LEAD product by use-of-funds and repayment source per the selection
  heuristics — NOT by which sizing rule is easiest to compute. A fundamentally
  sound borrower with a recurring working-capital gap leads with CC/OD, WCDL or
  RCF sized off monthly inflows (~1-2x average monthly inflows, serviceability
  permitting). Invoice discounting leads only when receivables quality and debtor
  strength make it the best fit, or when weak serviceability rules out
  cash-flow-repaid products. Do not default every borrower to the same product.
- Calibrate the eligibility label to the borrower, not to the paperwork:
  'eligible' = fundamentally sound credit (standard conditions precedent may still
  be attached); 'conditional' = approval is only viable with material conditions
  (e.g. haircuts, escrow, covenant-linked limits) on a stretched credit;
  'decline' = new senior debt is refused (even when a self-liquidating or
  restructuring alternative is still described).
- Declining new senior debt is valid and sometimes required — but NEVER return an
  empty recommended_products list. When new debt is unserviceable, emit the
  constructive alternative (restructuring of existing facilities, or a
  self-liquidating/secured structure) as a fully-termed product entry: amount,
  tenor, pricing, security, covenants, conditions precedent, and the
  serviceability math showing the restructured obligations are carriable.
- Respond with ONLY the JSON object in the required schema."""


def build_structure(llm, snapshot, model=None):
    model = model or config.REASON_MODEL
    user = (
        "CREDIT SNAPSHOT (computed from the dataroom):\n"
        + json.dumps(snapshot, indent=1, default=str)
        + "\n\nRequired output schema:\n" + OUTPUT_SCHEMA
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]
    # 10k cap: Sonnet's fullest answer (decline + fully-termed restructuring)
    # measured ~6.5k output tokens; headroom avoids a truncate-and-rebill cycle.
    raw = llm.complete("structure", model, messages, max_tokens=10000)
    try:
        structure = parse_json_response(raw)
    except ValueError:
        retry = messages + [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": "That was not valid JSON. Return ONLY the JSON object."},
        ]
        structure = parse_json_response(llm.complete("structure:retry", model, retry, max_tokens=10000))
    return structure


def validate_structure(structure, snapshot):
    """Sanity checks; returns a list of warnings (printed, not fatal)."""
    warnings = []
    required = ("eligibility", "recommended_products", "rationale")
    for key in required:
        if key not in structure:
            warnings.append(f"missing key: {key}")
    if structure.get("eligibility") == "decline" and structure.get("recommended_products"):
        # declines may still carry a restructuring proposal — just surface it
        warnings.append("eligibility=decline but products present (restructuring offer?)")

    ebitda = list(snapshot["financials"]["ebitda_inr"].values())[-1] or 0
    existing_service = snapshot["ratios_computed"].get("annual_debt_service_inr", 0)
    for p in structure.get("recommended_products", []):
        amt = p.get("amount_inr") or 0
        tenor = p.get("tenor_months") or 0
        rate = (p.get("pricing") or {}).get("all_in_rate_pct") or 12.0
        repay = (p.get("repayment") or "").lower()
        if amt <= 0:
            warnings.append(f"{p.get('product')}: non-positive amount")
            continue
        # self-liquidating / revolving lines repay from collections, not EMI —
        # and "no EMI burden" must not trip the substring match
        self_liquidating = "self-liquidat" in repay or "no emi" in repay or "revolving" in repay
        if ("amortis" in repay or "emi" in repay) and not self_liquidating:
            if tenor:
                monthly_rate = rate / 100 / 12
                emi = amt * monthly_rate / (1 - (1 + monthly_rate) ** -tenor) if monthly_rate else amt / tenor
                # a restructuring replaces the existing schedule; a new facility adds to it
                is_restructure = "restructur" in (p.get("product") or "").lower()
                base = 0 if is_restructure else existing_service
                post_dscr = ebitda / (base + 12 * emi) if (base + 12 * emi) else None
                if post_dscr is not None and post_dscr < 1.20:
                    warnings.append(
                        f"{p.get('product')}: post-facility DSCR ~{post_dscr:.2f} < 1.25 "
                        f"({'replaces existing stack; ' if is_restructure else ''}"
                        f"EMI est INR {emi:,.0f}/mo on {amt:,.0f} @ {rate}% x {tenor}m)"
                    )
        adv = p.get("advance_rate_pct")
        eligible = snapshot["receivables"].get("eligible_0_60_inr") or 0
        if adv and eligible and amt > 0.90 * eligible:
            warnings.append(
                f"{p.get('product')}: amount INR {amt:,.0f} exceeds 90% of eligible "
                f"0-60d receivables INR {eligible:,.0f}"
            )
    return warnings
