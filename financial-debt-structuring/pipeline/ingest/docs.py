"""LLM-based extraction for the non-tabular documents (PDFs + scanned image).

Strategy per document:
  1. Try local text extraction (pypdf) — the datarooms' PDFs are born-digital,
     so this is free and exact. The text (1-2 pages) goes to a cheap model
     that returns a small, typed JSON.
  2. If a PDF yields almost no text (i.e. it is a scan), render its pages to
     PNG locally (PyMuPDF) and use the model's vision path instead.
  3. The sanction letter is a PNG scan and always goes through vision.

Only these 5 small documents per company ever touch the LLM; every response
is disk-cached by the client, so unchanged documents cost zero on re-runs.
"""
import base64
import json
from pathlib import Path

from pypdf import PdfReader

from .. import config
from ..llm import parse_json_response

MIN_CHARS_PER_PAGE = 200  # below this we treat a PDF page as scanned

DOC_PROMPTS = {
    "aica_report": """Extract from this AICA underwriting report. Return ONLY JSON:
{
 "risk_score": <number, e.g. 6.1>, "risk_band": "<Low|Elevated|High as stated>",
 "avg_monthly_bank_inflows_inr": <number|null>,
 "closing_cash_inr": <number|null>,
 "total_borrowings_inr": <number|null>,
 "cheque_returns_12m": <int|null>,
 "top_customer_pct": <number|null>,
 "cited_ratios": {"dscr": <number|null>, "debt_to_ebitda": <number|null>, "interest_coverage": <number|null>, "current_ratio": <number|null>, "ebitda_margin_pct": <number|null>},
 "risk_observations": ["<each risk observation, verbatim-ish>"],
 "positive_signals": ["..."],
 "recommendation": "<any structuring recommendation it makes, or null>"
}
Use plain numbers (no commas). INR values as absolute rupees.""",

    "financial_statements": """Extract from these financial statements. Return ONLY JSON:
{
 "years": ["FY2023-24", ...],
 "pnl_latest": {"revenue": n, "cogs": n, "ebitda": n, "depreciation": n, "interest": n, "pbt": n, "tax": n, "pat": n},
 "balance_sheet_latest": {"net_block": n, "inventory": n, "trade_receivables": n, "cash": n, "other_assets": n, "total_assets": n, "borrowings": n, "trade_payables": n, "equity": n},
 "auditor_qualifications": ["... or empty list"],
 "notes": ["anything unusual, e.g. negative equity, going concern"]
}
Plain numbers, absolute rupees. 'latest' = most recent FY shown.""",

    "gst_returns": """Extract from this GST returns summary. Return ONLY JSON:
{
 "annual_taxable_turnover_inr": n,
 "months_covered": <int>,
 "filing_delays": ["... or empty list"],
 "monthly_turnover_inr": {"Apr-25": n, ...},
 "notes": ["mismatches vs books, penalties, anything unusual; else empty"]
}
Plain numbers, absolute rupees.""",

    "shareholding": """Extract from this shareholding pattern. Return ONLY JSON:
{
 "holders": [{"name": "...", "category": "Promoter|Investor|Other", "pct": n}],
 "promoter_pct": n,
 "pledging_disclosed": <true|false|null>,
 "directors": [{"name": "...", "din": "..."}],
 "governance_notes": ["... or empty"]
}""",

    "sanction_letter": """This is a scanned bank sanction letter. Extract ONLY JSON:
{
 "lender": "...", "reference": "...", "date": "...",
 "facility_type": "...", "sanctioned_amount_inr": n,
 "roi_pct": n, "rate_type": "floating|fixed|null", "tenor_months": <int|null>,
 "security": ["each security/collateral item"],
 "covenants": ["each covenant/condition"],
 "legibility_issues": ["anything you could not read; else empty"]
}
Plain numbers, absolute rupees.""",
}

DOC_FILES = {
    "aica_report": ["AICA_Report*.pdf"],
    "financial_statements": ["Financial_Statements*.pdf"],
    "gst_returns": ["GST_Returns*.pdf", "GST*.pdf"],
    "shareholding": ["Shareholding*.pdf"],
    "sanction_letter": ["Sanction_Letter*.png", "Sanction_Letter*.jpg", "Sanction_Letter*.pdf"],
}


def find_documents(company_dir: Path):
    found = {}
    for key, patterns in DOC_FILES.items():
        for pat in patterns:
            hits = sorted(Path(company_dir).rglob(pat))
            if hits:
                found[key] = hits[0]
                break
    return found


def pdf_text(path: Path):
    """Local text extraction; returns (text, is_scanned)."""
    reader = PdfReader(str(path))
    pages = [(p.extract_text() or "") for p in reader.pages]
    text = "\n\n".join(pages)
    scanned = len(text) < MIN_CHARS_PER_PAGE * max(1, len(pages))
    return text, scanned


def _render_pdf_pages(path: Path, max_pages=6):
    """Render a scanned PDF's pages to PNG bytes (local, via PyMuPDF)."""
    import fitz  # PyMuPDF — imported lazily; only needed for scanned PDFs

    doc = fitz.open(str(path))
    images = []
    for page in doc[:max_pages]:
        pix = page.get_pixmap(dpi=150)
        images.append(pix.tobytes("png"))
    return images


def _image_message(prompt, image_bytes_list):
    content = [{"type": "text", "text": prompt}]
    for b in image_bytes_list:
        content.append({
            "type": "image_url",
            "image_url": {"url": "data:image/png;base64," + base64.b64encode(b).decode()},
        })
    return [{"role": "user", "content": content}]


def extract_document(llm, doc_type: str, path: Path, model=None):
    model = model or config.EXTRACT_MODEL
    prompt = DOC_PROMPTS[doc_type]
    if path.suffix.lower() in (".png", ".jpg", ".jpeg"):
        messages = _image_message(prompt, [path.read_bytes()])
    else:
        text, scanned = pdf_text(path)
        if scanned:
            messages = _image_message(prompt, _render_pdf_pages(path))
        else:
            messages = [{"role": "user", "content": f"{prompt}\n\nDOCUMENT ({path.name}):\n{text}"}]
    # Generous cap: some models (e.g. Gemini "thinking") spend hidden reasoning
    # tokens against this budget, which can truncate the JSON if set too low.
    raw = llm.complete(f"extract:{doc_type}", model, messages, max_tokens=4000)
    try:
        result = parse_json_response(raw)
    except ValueError:
        retry = messages + [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": "That was not valid JSON. Return ONLY the JSON object."},
        ]
        result = parse_json_response(
            llm.complete(f"extract:{doc_type}:retry", model, retry, max_tokens=4000))
    result["_source"] = path.name
    return result


def extract_all(llm, company_dir: Path, model=None):
    docs = find_documents(company_dir)
    out = {}
    for doc_type, path in docs.items():
        out[doc_type] = extract_document(llm, doc_type, path, model=model)
    return out


def load_fixture(company_key: str):
    """--mock mode: pre-recorded extractions so the pipeline runs offline."""
    path = Path(__file__).parents[2] / "fixtures" / "doc_extracts" / f"{company_key}.json"
    if not path.exists():
        raise SystemExit(f"No mock fixture for {company_key} at {path}")
    return json.loads(path.read_text())
