"""Golden tests for the deterministic layer, pinned to hand-verified numbers
from the three provided datasets. Set DATASET_DIR to point elsewhere.

These cover the traps planted in the data:
  - bounce rows must be deduped (return + charges = ONE bounce)
  - Mar-26 cashflow closing is forced and breaks reconciliation in all 3
  - balance-sheet cash contradicts the actual bank-statement closing balance
  - company_2's MIS ageing disagrees with the Dataroom ageing
"""
import os
from pathlib import Path

import pytest

from pipeline.ingest.excel import ingest_excel
from pipeline.snapshot import build_snapshot

DATASETS = Path(os.environ.get(
    "DATASET_DIR",
    Path(__file__).parents[2] / "datasets",
))


@pytest.fixture(scope="module")
def data():
    if not DATASETS.exists():
        pytest.skip(f"datasets not found at {DATASETS}")
    return {i: ingest_excel(DATASETS / f"company_{i}") for i in (1, 2, 3)}


@pytest.fixture(scope="module")
def snaps(data):
    return {i: build_snapshot(data[i], docs={}) for i in (1, 2, 3)}


# ---------------------------------------------------------------- P&L / model

def test_pnl_revenue_latest(data):
    assert data[1]["financial_model"]["pnl"]["Revenue"]["FY2025-26"] == 486_000_000
    assert data[2]["financial_model"]["pnl"]["Revenue"]["FY2025-26"] == 321_000_000
    assert data[3]["financial_model"]["pnl"]["Revenue"]["FY2025-26"] == 602_000_000


def test_company_names(data):
    assert data[1]["financial_model"]["assumptions"]["Company"] == "Solara Foods Private Limited"
    assert data[2]["financial_model"]["assumptions"]["Company"] == "Nimbus Textiles Private Limited"
    assert data[3]["financial_model"]["assumptions"]["Company"] == "Orbit Auto Components Private Limited"


# ---------------------------------------------------------------- debt schedule

def test_debt_totals(data):
    assert data[1]["debt_schedule"]["totals"]["outstanding_inr"] == 69_500_000
    assert data[2]["debt_schedule"]["totals"]["outstanding_inr"] == 112_500_000
    assert data[3]["debt_schedule"]["totals"]["outstanding_inr"] == 314_000_000
    assert len(data[3]["debt_schedule"]["facilities"]) == 4


def test_wc_utilisation(data):
    # company_2: CC 67.5/70 + WCDL 24/25 -> 91.5/95 = 96.3%
    assert data[2]["debt_schedule"]["totals"]["wc_utilisation_pct"] == pytest.approx(96.3, abs=0.1)


# ---------------------------------------------------------------- ratios (recomputed)

def test_computed_dscr_matches_reported(snaps):
    # DSCR = EBITDA / (interest + 12 x EMI); must reproduce the Ratios tab
    for i, expected in ((1, 3.84), (2, 1.33), (3, 0.57)):
        assert snaps[i]["ratios_computed"]["dscr"] == pytest.approx(expected, abs=0.01)
        assert snaps[i]["ratios_reported"]["DSCR"] == pytest.approx(expected, abs=0.01)


def test_computed_leverage(snaps):
    assert snaps[1]["ratios_computed"]["debt_to_ebitda"] == pytest.approx(0.92, abs=0.01)
    assert snaps[3]["ratios_computed"]["debt_to_ebitda"] == pytest.approx(6.21, abs=0.01)


def test_negative_net_worth_company3(snaps):
    assert snaps[3]["ratios_computed"]["net_worth_inr"] == -11_638_137


# ---------------------------------------------------------------- bank statement

def test_bounce_dedupe(data):
    # Each bounce is 2 rows (return + charges); AICA reference counts: 0 / 4 / 2
    assert data[1]["bank_statement"]["bounce_count_12m"] == 0
    assert data[2]["bank_statement"]["bounce_count_12m"] == 4
    assert data[3]["bank_statement"]["bounce_count_12m"] == 2


def test_bank_closing_balances(data):
    assert data[1]["bank_statement"]["closing_balance_inr"] == pytest.approx(98_921_803.92)
    assert data[2]["bank_statement"]["closing_balance_inr"] == pytest.approx(38_456_898.41)


def test_avg_monthly_inflows_close_to_aica(data):
    # AICA cites avg monthly inflows 4.72Cr / 3.24Cr / 6.28Cr
    for i, aica in ((1, 47_231_461), (2, 32_378_141), (3, 62_782_958)):
        got = data[i]["bank_statement"]["avg_monthly_inflows_inr"]
        assert abs(got - aica) / aica < 0.10, f"company_{i}: {got} vs AICA {aica}"


# ---------------------------------------------------------------- receivables

def test_eligible_receivables(data):
    # 0-60d buckets
    assert data[1]["debtor_ageing"]["eligible_0_60_inr"] == 39_705_534 + 11_184_658
    assert data[2]["debtor_ageing"]["eligible_0_60_inr"] == 31_765_808 + 17_395_562
    assert data[2]["debtor_ageing"]["pct_90_plus"] == pytest.approx(20.0, abs=0.1)


# ---------------------------------------------------------------- planted traps

def test_cashflow_break_flagged_all_companies(snaps):
    for i in (1, 2, 3):
        flags = [f["flag"] for f in snaps[i]["data_quality_flags"]]
        assert "cashflow_reconciliation_break" in flags, f"company_{i} missing flag"
        breaks = [f for f in snaps[i]["data_quality_flags"]
                  if f["flag"] == "cashflow_reconciliation_break"]
        assert len(breaks) == 1 and "Mar-26" in breaks[0]["detail"]


def test_bs_cash_vs_bank_flagged(snaps):
    for i in (1, 2, 3):
        flags = [f["flag"] for f in snaps[i]["data_quality_flags"]]
        assert "bs_cash_vs_bank_statement" in flags, f"company_{i} missing flag"


def test_mis_ageing_mismatch_flagged_company2(snaps):
    flags = [f["flag"] for f in snaps[2]["data_quality_flags"]]
    assert "mis_vs_dataroom_ageing" in flags
    assert snaps[2]["mis"]["debtor_ageing"]["total_inr"] == 87_626_053


def test_mis_concentration(data):
    top5 = data[2]["mis"]["customers"]["top5"]
    assert top5[0]["name"] == "Vastra Global Exports LLP"
    assert top5[0]["pct"] == pytest.approx(40.3, abs=0.2)


# ---------------------------------------------------------------- risk signals

def test_risk_signals_archetypes(snaps):
    def signals(i):
        return {s["signal"] for s in snaps[i]["risk_signals"]}

    # company_1 is clean: no critical/high signals
    sev1 = {s["severity"] for s in snaps[1]["risk_signals"]}
    assert "critical" not in sev1 and "high" not in sev1

    # company_2: bounces, concentration, WC ceiling
    s2 = signals(2)
    assert any("Cheque returns" in x for x in s2)
    assert any("concentration" in x.lower() for x in s2)
    assert any("ceiling" in x.lower() for x in s2)

    # company_3: DSCR < 1.0 critical + negative net worth + losses
    sev3 = [s for s in snaps[3]["risk_signals"] if s["severity"] == "critical"]
    assert len(sev3) >= 2


# ---------------------------------------------------------------- LLM response parsing

def test_parse_json_response_tolerates_model_quirks():
    from pipeline.llm import parse_json_response
    clean = '{"a": 1}'
    fenced = '```json\n{"a": 1}\n```'
    prosey = 'Here is the extraction you asked for:\n\n{"a": 1}\n\nLet me know if you need more.'
    nested = 'Result: {"a": {"b": [1, 2, {"c": "}"}]}} trailing'
    assert parse_json_response(clean) == {"a": 1}
    assert parse_json_response(fenced) == {"a": 1}
    assert parse_json_response(prosey) == {"a": 1}
    assert parse_json_response(nested)["a"]["b"][2]["c"] == "}"
