"""Build the credit snapshot: financials, computed ratios, risk signals and
cross-document data-quality flags. Entirely deterministic — the LLM never
computes a number that code can compute.
"""


def _latest(pnl_row, years):
    return pnl_row.get(years[-1], 0.0) if pnl_row else 0.0


def build_snapshot(excel, docs):
    fm = excel.get("financial_model", {})
    years = fm.get("pnl_years", [])
    pnl = fm.get("pnl", {})
    bs = fm.get("balance_sheet", {})
    ratios = fm.get("ratios", {})
    debt = excel.get("debt_schedule", {})
    ageing = excel.get("debtor_ageing", {})
    bank = excel.get("bank_statement", {})
    mis = excel.get("mis")
    aica = docs.get("aica_report", {})
    shp = docs.get("shareholding", {})

    revenue = _latest(pnl.get("Revenue"), years)
    ebitda = _latest(pnl.get("EBITDA"), years)
    interest = _latest(pnl.get("Interest"), years)
    pat = _latest(pnl.get("PAT"), years)
    rev_prev = pnl.get("Revenue", {}).get(years[-2], 0.0) if len(years) > 1 else 0.0

    totals = debt.get("totals", {})
    outstanding = totals.get("outstanding_inr", 0.0)
    monthly_emi = totals.get("monthly_emi_inr", 0.0)
    annual_debt_service = interest + 12 * monthly_emi

    computed = {
        "revenue_growth_pct": round(100 * (revenue / rev_prev - 1), 1) if rev_prev else None,
        "ebitda_margin_pct": round(100 * ebitda / revenue, 1) if revenue else None,
        "dscr": round(ebitda / annual_debt_service, 2) if annual_debt_service else None,
        "debt_to_ebitda": round(outstanding / ebitda, 2) if ebitda else None,
        "interest_coverage": round(ebitda / interest, 2) if interest else None,
        "annual_debt_service_inr": annual_debt_service,
        "net_worth_inr": bs.get("Shareholders' Equity"),
        "cash_months_cover": round(
            bs.get("Cash & Bank", 0.0) / bank["avg_monthly_outflows_inr"], 2
        ) if bank.get("avg_monthly_outflows_inr") else None,
    }

    snapshot = {
        "company": {
            "name": fm.get("assumptions", {}).get("Company"),
            "sector": fm.get("assumptions", {}).get("Sector"),
            "cin": fm.get("assumptions", {}).get("CIN"),
            "gstin": fm.get("assumptions", {}).get("GSTIN"),
        },
        "financials": {
            "years": years,
            "revenue_inr": {y: pnl.get("Revenue", {}).get(y) for y in years},
            "ebitda_inr": {y: pnl.get("EBITDA", {}).get(y) for y in years},
            "pat_inr": {y: pnl.get("PAT", {}).get(y) for y in years},
            "interest_inr": interest,
            "balance_sheet_latest": bs,
        },
        "working_capital": {
            "dso_days": fm.get("assumptions", {}).get("DSO (days)"),
            "dpo_days": fm.get("assumptions", {}).get("DPO (days)"),
            "inventory_days": fm.get("assumptions", {}).get("Inventory (days)"),
            "top_customer_pct": fm.get("assumptions", {}).get("Top customer %"),
        },
        "debt_profile": {
            "facilities": debt.get("facilities", []),
            "total_sanctioned_inr": totals.get("sanctioned_inr"),
            "total_outstanding_inr": outstanding,
            "monthly_emi_inr": monthly_emi,
            "wc_utilisation_pct": totals.get("wc_utilisation_pct"),
        },
        "receivables": {
            "total_inr": ageing.get("total_inr"),
            "buckets_inr": ageing.get("buckets_inr"),
            "eligible_0_60_inr": ageing.get("eligible_0_60_inr"),
            "pct_90_plus": ageing.get("pct_90_plus"),
        },
        "banking": {
            "avg_monthly_inflows_inr": bank.get("avg_monthly_inflows_inr"),
            "avg_monthly_outflows_inr": bank.get("avg_monthly_outflows_inr"),
            # statement rows arrive date-ordered, so insertion order is chronological
            "monthly_inflows_inr": {k: round(v["inflows"])
                                    for k, v in bank.get("monthly", {}).items()},
            "closing_balance_inr": bank.get("closing_balance_inr"),
            "closing_date": bank.get("closing_date"),
            "bounce_count_12m": bank.get("bounce_count_12m"),
        },
        "ratios_reported": ratios,
        "ratios_computed": computed,
        "aica": {
            "risk_score": aica.get("risk_score"),
            "risk_band": aica.get("risk_band"),
            "risk_observations": aica.get("risk_observations", []),
            "positive_signals": aica.get("positive_signals", []),
        },
        "governance": {
            "promoter_pct": shp.get("promoter_pct"),
            "holders": shp.get("holders", []),
            "pledging_disclosed": shp.get("pledging_disclosed"),
        },
        "documents": {k: v.get("_source") for k, v in docs.items()},
    }
    if mis:
        snapshot["mis"] = {k: v for k, v in mis.items() if k not in ("source", "tabs")}

    snapshot["risk_signals"] = derive_risk_signals(snapshot)
    snapshot["data_quality_flags"] = derive_dq_flags(excel, docs, snapshot)
    # sources that failed to parse are a credit-relevant fact, not just a log line
    for w in excel.get("parse_warnings", []):
        snapshot["data_quality_flags"].append(
            {"flag": "source_unparseable", "detail": w})
    return snapshot


def derive_risk_signals(s):
    """Threshold-based signals per the debt-structuring KB."""
    sig = []
    c = s["ratios_computed"]

    def add(severity, signal, evidence):
        sig.append({"severity": severity, "signal": signal, "evidence": evidence})

    dscr = c.get("dscr")
    if dscr is not None:
        if dscr < 1.0:
            add("critical", "DSCR below 1.0 — cannot service existing debt from EBITDA",
                f"computed DSCR {dscr} (EBITDA / (interest + 12x EMI))")
        elif dscr < 1.25:
            add("high", "DSCR below 1.25 comfort threshold", f"computed DSCR {dscr}")
        elif dscr < 1.75:
            add("medium", "Modest DSCR headroom", f"computed DSCR {dscr}")

    lev = c.get("debt_to_ebitda")
    if lev is not None and lev > 3.0:
        add("high" if lev > 4.5 else "medium", "Leverage above ~3x EBITDA norm",
            f"debt/EBITDA {lev}x")

    nw = c.get("net_worth_inr")
    if nw is not None and nw < 0:
        add("critical", "Negative net worth — technically insolvent balance sheet",
            f"equity INR {nw:,.0f}")

    pat_latest = list(s["financials"]["pat_inr"].values())[-1] if s["financials"]["pat_inr"] else None
    if pat_latest is not None and pat_latest < 0:
        add("high", "Loss-making at PAT level", f"latest PAT INR {pat_latest:,.0f}")

    bounces = s["banking"].get("bounce_count_12m")
    if bounces:
        add("high" if bounces >= 3 else "medium", "Cheque returns in trailing 12m",
            f"{bounces} returns in bank statement (fee rows excluded)")

    top = s["working_capital"].get("top_customer_pct")
    if top is not None and top >= 25:
        add("high" if top >= 40 else "medium", "Customer concentration",
            f"top customer {top}% of revenue")

    p90 = s["receivables"].get("pct_90_plus")
    if p90 is not None and p90 >= 10:
        add("medium", "Elevated 90+ day receivables", f"{p90}% of book overdue 90+ days")

    wc_util = s["debt_profile"].get("wc_utilisation_pct")
    if wc_util is not None and wc_util >= 90:
        add("high", "Working-capital limits near ceiling",
            f"{wc_util}% of sanctioned WC limits drawn")

    cover = c.get("cash_months_cover")
    if cover is not None and cover < 0.5:
        add("high", "Thin liquidity buffer",
            f"closing cash covers {cover} months of avg bank outflows")

    cr = s["ratios_reported"].get("Current Ratio")
    if cr is not None and cr < 1.2:
        add("medium", "Current ratio below 1.2 covenant norm", f"current ratio {cr}")

    if not sig:
        add("info", "No adverse signals triggered", "all thresholds clear")
    return sig


def derive_dq_flags(excel, docs, s):
    """Cross-document consistency checks. Discrepancies are surfaced, not
    silently reconciled — an underwriter must see them."""
    flags = []
    fm = excel.get("financial_model", {})
    bank = excel.get("bank_statement", {})

    # 1. Monthly cashflow internal reconciliation (opening + in - out = closing)
    for m in fm.get("monthly_cashflow", []):
        gap = m["opening"] + m["inflows"] - m["outflows"] - m["closing"]
        if abs(gap) > 1:
            flags.append({
                "flag": "cashflow_reconciliation_break",
                "detail": f"{m['month']}: opening+inflows-outflows exceeds stated closing "
                          f"by INR {gap:,.0f} (closing appears forced to the balance-sheet "
                          f"cash figure)",
            })

    # 2. Balance-sheet cash vs actual bank statement closing balance
    bs_cash = fm.get("balance_sheet", {}).get("Cash & Bank")
    bank_close = bank.get("closing_balance_inr")
    if bs_cash and bank_close and abs(bank_close - bs_cash) / max(bs_cash, 1) > 0.05:
        flags.append({
            "flag": "bs_cash_vs_bank_statement",
            "detail": f"Balance sheet cash INR {bs_cash:,.0f} vs bank statement closing "
                      f"INR {bank_close:,.0f} ({bank.get('closing_date')}) — "
                      f"unexplained gap of INR {bank_close - bs_cash:,.0f}",
        })

    # 3. MIS debtor ageing vs Dataroom debtor ageing
    mis = excel.get("mis") or {}
    mis_ageing = mis.get("debtor_ageing")
    da = excel.get("debtor_ageing")
    if mis_ageing and da and da.get("total_inr"):
        diff = mis_ageing["total_inr"] - da["total_inr"]
        if abs(diff) / da["total_inr"] > 0.05:
            flags.append({
                "flag": "mis_vs_dataroom_ageing",
                "detail": f"MIS debtor ageing total INR {mis_ageing['total_inr']:,.0f} vs "
                          f"Dataroom ageing INR {da['total_inr']:,.0f} (diff INR {diff:,.0f}); "
                          f"bucket mix also differs — eligible-receivable base is ambiguous",
            })

    # 4. Sanction letter covers fewer facilities than the debt schedule
    letter = docs.get("sanction_letter", {})
    facs = excel.get("debt_schedule", {}).get("facilities", [])
    if letter and len(facs) > 1:
        flags.append({
            "flag": "sanction_letter_partial_coverage",
            "detail": f"Sanction letter shows only 1 facility ({letter.get('lender')} "
                      f"{letter.get('facility_type')}, INR {letter.get('sanctioned_amount_inr', 0):,.0f}) "
                      f"but debt schedule lists {len(facs)} facilities — "
                      f"remaining sanction letters not in dataroom",
        })

    # 5. AICA bounce count vs bank statement count
    aica_bounces = docs.get("aica_report", {}).get("cheque_returns_12m")
    bank_bounces = bank.get("bounce_count_12m")
    if aica_bounces is not None and bank_bounces is not None and aica_bounces != bank_bounces:
        flags.append({
            "flag": "bounce_count_mismatch",
            "detail": f"AICA reports {aica_bounces} cheque returns vs {bank_bounces} "
                      f"found in bank statement",
        })
    return flags
