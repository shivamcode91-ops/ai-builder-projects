# AICA Debt Structuring Pipeline

Reads a company's Dataroom + AICA report and produces a **credit snapshot** and a
**recommended debt structure** (product + terms + rationale) as JSON, then supports a
multi-turn follow-up chat on the same company. Built for the Recur Club AI Product
Builder take-home.

## Run it — step by step

`<datasets>` below = the folder containing `company_1/ company_2/ company_3/`
(each a Dataroom + AICA report). Datasets are not redistributed inside this repo.

```bash
# 1. one-time setup (~1 min): fresh Python env + pinned deps
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. sanity check WITHOUT any API key — full pipeline offline from fixtures
.venv/bin/python -m pipeline.cli run <datasets>/company_1 --mock
#    -> prints the 4 stages + verdict banner,
#       writes final_outputs/company_1_debt_structure.json

# 3. test suite (16 golden tests need the datasets; 7 run without)
DATASET_DIR=<datasets> .venv/bin/python -m pytest tests/ -q
#    -> 23 passed

# 4. the real thing — set the key, run a company live (~90-120 s)
export PRISM_API_KEY="prism-candidate-xxxx"     # see .env.example
.venv/bin/python -m pipeline.cli run <datasets>/company_1
#    -> per-call token/latency/$ meter prints at the end

# 5. multi-turn chat on that company (transcript saves on exit)
.venv/bin/python -m pipeline.cli chat <datasets>/company_1
#    e.g.  why this tenor?  ->  and if the amount were 1.5x?  ->  exit

# 6. optional — the visual workbench (same engine, zero extra deps)
.venv/bin/python ui/server.py --datasets <datasets>
#    -> open http://127.0.0.1:8787 : queue -> memo -> re-run modal -> live copilot
```

## Deliverables map

| Deliverable | Where |
|---|---|
| Code + README | this repo / `README.md` (approach, large files, budget below) |
| Outputs, all 3 companies | `final_outputs/company_N_debt_structure.json` + `final_outputs/company_N_chat_transcript.md` |
| Productionization note | `PRODUCTIONIZATION_NOTE.md` |
| UI design (one screen) | `design_architecture_ui/UI_design_credit_workbench.html` (open in a browser) — and the same design runs live against the pipeline: `python ui/server.py --datasets <dir>` |
| Dashboard screenshots (live UI) | `design_architecture_ui/screenshot_dashboard_queue.png` (lender queue) + `screenshot_memo_with_copilot.png` (credit memo + grounded chat) |
| Architecture / data-flow diagram | `design_architecture_ui/architecture_DFD.html` |
| Everything else (experiments, runbook) | `others/` |

## Approach

The pipeline is built around one rule: **the LLM never computes a number that code can
compute.**

```
Dataroom ──┬─ .xlsx (bank stmt, MIS, model, debt, ageing) ──► deterministic parsers (0 tokens)
           └─ PDFs + scanned PNG (5 small docs) ────────────► Haiku extraction (typed JSON each)
                                    │
                                    ▼
                    credit snapshot (computed in code):
                    ratios recomputed, risk signals, cross-document
                    data-quality flags
                                    │
                                    ▼
                    ONE Sonnet call: condensed KB + snapshot ──► debt structure JSON
                                    │
                                    ▼
                    code-side validation (post-facility DSCR, advance-rate caps)
                                    │
                                    ▼
                    chat: snapshot+structure (~6KB) as context ──► cheap multi-turn follow-ups
```

**Stage 1 — deterministic ingestion (`pipeline/ingest/excel.py`).** Everything numeric
lives in Excel, so we parse it with openpyxl and *compute* the metrics: monthly bank
inflows/outflows, bounce events, DSCR = EBITDA/(interest + 12×EMI), leverage, eligible
(0–60d) receivables, WC utilisation. Exact, free, and instant.

**Stage 2 — document extraction (`pipeline/ingest/docs.py`).** Only 5 small documents
per company need language/vision: the AICA report, financial statements, GST summary,
shareholding pattern (born-digital PDFs → local pypdf text → Haiku with a strict JSON
schema) and the scanned sanction letter (PNG → Haiku vision). If a PDF turns out to be
scanned (< 200 chars/page), pages are rendered locally with PyMuPDF and routed through
vision instead — same path, no code change.

**Stage 3 — snapshot (`pipeline/snapshot.py`).** Merges computed + extracted facts,
derives threshold-based risk signals (KB norms: DSCR 1.25, 3× leverage, etc.) and —
deliberately — **cross-document data-quality flags**. The provided datarooms contain
real inconsistencies (the Mar-26 cash-flow closing is forced to the balance-sheet cash
figure and contradicts the actual bank-statement balance; one company's MIS ageing
disagrees with its Dataroom ageing by ₹1.2 Cr). The pipeline surfaces these instead of
averaging them away, and the structurer is instructed to size off the weaker number and
attach a condition precedent.

**Stage 4 — structuring (`pipeline/structure.py`).** A single call to the reasoning
model with a ~600-token condensed knowledge base and the ~2k-token snapshot. The output
schema forces arithmetic (`amount_basis`, `serviceability_check`) so every term traces
to snapshot evidence. Code then re-checks serviceability (EMI math → post-facility DSCR)
and advance-rate caps, printing warnings.

**Chat (`pipeline/chat.py`).** Documents are read once at `run` time; the chat context
is just the compact output JSON, so follow-up turns cost ~3k input tokens instead of
re-reading the dataroom. History is retained across turns; transcripts are saved.

## Model choice

| Stage | Model | Why |
|---|---|---|
| Extraction (5 docs) | `claude-haiku-4-5` | High-volume, low-reasoning; typed JSON from 1–2 page docs. ~5× cheaper than Sonnet. |
| Structuring + chat | `claude-sonnet-4-6` | The one judgment-heavy call; Sonnet handles the serviceability arithmetic and KB tradeoffs reliably. |
| Opus | not used | The snapshot is already distilled and validated in code; Opus adds cost/latency, not accuracy, at this input size. |

Override per run: `--extract-model`, `--reason-model`, or env vars.

## Handling the large files and the token budget

- **The big files never enter a prompt.** Bank statements (~2,700 rows) and the 23-tab
  MIS (registers up to ~2,150 rows) are reduced to compact aggregates in code.
- **Everything LLM-touched is disk-cached** (`.cache/llm`, keyed on model+messages), so
  re-runs and demos re-spend zero tokens on unchanged inputs.
- **`--mock` mode** runs the full pipeline offline from recorded fixtures — used for
  development and the golden tests so the budget-capped key is only spent on validated
  runs.
- Measured footprint per company run: ~10–15k input + ~4k output tokens
  (≈ $0.05–0.10), structuring call ~2–3k input. Retries handle 429/5xx with backoff.

## Tests

```bash
.venv/bin/python -m pytest tests/ -q     # 23 tests: 17 golden + 6 deviation
```

Golden tests pin the deterministic layer to hand-verified numbers from the three
datasets — including the planted traps (bounce-row dedupe, the Mar-26 reconciliation
break, balance-sheet-vs-bank-statement cash, MIS-vs-Dataroom ageing). Deviation tests
(`tests/test_hardening.py`) pin graceful degradation on datarooms that DON'T match the
provided template: renamed/reordered bank-statement columns, other date formats,
different bounce wording, corrupt files (isolated into `source_unparseable` DQ flags
instead of a crash), and extraction-JSON retries.

## Repo map

```
pipeline/
  cli.py            entry point: run / chat / models
  config.py         Prism base URL, model selection, pricing table
  llm.py            OpenAI-SDK client for Prism: cache, retries, token/latency meter
  ingest/excel.py   deterministic parsers (financial model, debt, ageing, bank, MIS)
  ingest/docs.py    Haiku extraction for PDFs/PNG, scanned-PDF fallback via vision
  snapshot.py       computed ratios, risk signals, cross-document DQ flags
  structure.py      condensed KB + structuring prompt + code-side validation
  chat.py           multi-turn REPL grounded in the run output
ui/                 the local UI to test with (live workbench over the same engine)
  server.py         stdlib http server: /api/run, /api/chat, /api/output
  index.html        lender queue -> credit memo -> re-run modal -> grounded copilot
tests/
  test_golden.py    17 tests pinned to hand-verified dataset numbers (incl. the traps)
  test_hardening.py 5 deviation tests: layout drift, corrupt files, extraction retries
fixtures/           pre-recorded LLM outputs so --mock and tests run offline, no key
                    (NOT company data — datasets stay outside the repo, passed as a path)
final_outputs/      DELIVERABLE: 3 debt-structure JSONs + 3 chat transcripts (Prism runs)
design_architecture_ui/  DELIVERABLE: UI design (credit workbench) + architecture DFD
PRODUCTIONIZATION_NOTE.md  DELIVERABLE: what breaks today, what to harden first
others/             supporting evidence: stand-in gateway experiments, per-model
                    dry-runs, phase-2 runbook (the token-budget story)
```
