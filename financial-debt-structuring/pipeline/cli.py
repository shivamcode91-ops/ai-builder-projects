"""CLI entry point.

  python -m pipeline.cli run  <company_dir> [--mock] [--out outputs]
  python -m pipeline.cli chat <output.json | company_dir>
  python -m pipeline.cli models
"""
import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from . import config
from .ingest.excel import ingest_excel
from .ingest import docs as docmod
from .snapshot import build_snapshot
from .structure import build_structure, validate_structure


def company_key(company_dir: Path):
    return Path(company_dir).name.lower().replace(" ", "_")


def cmd_run(args):
    company_dir = Path(args.company_dir)
    key = company_key(company_dir)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    print(f"[1/4] Ingesting Excel dataroom (deterministic, 0 tokens)...")
    excel = ingest_excel(company_dir)
    t_excel = time.time() - t0
    print(f"      parsed: {', '.join(k for k in excel if k != 'parse_warnings')}  ({t_excel:.1f}s)")
    for w in excel.get("parse_warnings", []):
        print(f"      [parse] {w}")

    if args.mock:
        print(f"[2/4] Loading document extractions from fixtures (--mock)...")
        docs = docmod.load_fixture(key)
        llm = None
    else:
        from .llm import GatewayLLM
        llm = GatewayLLM(use_cache=not args.no_cache)
        print(f"[2/4] Extracting {len(docmod.find_documents(company_dir))} documents "
              f"via {args.extract_model}...")
        docs = docmod.extract_all(llm, company_dir, model=args.extract_model)

    print(f"[3/4] Building credit snapshot (deterministic)...")
    snapshot = build_snapshot(excel, docs)
    print(f"      {len(snapshot['risk_signals'])} risk signals, "
          f"{len(snapshot['data_quality_flags'])} data-quality flags")

    if args.mock:
        print(f"[4/4] Loading structure from fixtures (--mock)...")
        fpath = Path(__file__).parents[1] / "fixtures" / "structures" / f"{key}.json"
        structure = json.loads(fpath.read_text())
    else:
        print(f"[4/4] Structuring via {args.reason_model}...")
        structure = build_structure(llm, snapshot, model=args.reason_model)

    warnings = validate_structure(structure, snapshot)
    for w in warnings:
        print(f"      [validate] {w}")

    elapsed = time.time() - t0
    meter = llm.meter.totals() if llm else {"note": "mock run, no LLM calls"}
    output = {
        "company": snapshot["company"],
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "credit_snapshot": snapshot,
        "debt_structure": structure,
        "validation_warnings": warnings,
        "run_meta": {"wall_clock_seconds": round(elapsed, 1), **meter,
                     "models": {"extract": args.extract_model, "reason": args.reason_model}},
    }
    out_path = out_dir / f"{key}_debt_structure.json"
    out_path.write_text(json.dumps(output, indent=2, default=str))

    print(f"\n=== {snapshot['company'].get('name')} — {structure.get('eligibility', '?').upper()} ===")
    for p in structure.get("recommended_products", []):
        pr = p.get("pricing") or {}
        print(f"  {p.get('product')}: INR {p.get('amount_inr', 0):,.0f}, "
              f"{p.get('tenor_months')}m, ~{pr.get('all_in_rate_pct')}% ({p.get('repayment')})")
    print(f"\nOutput: {out_path}")
    print(f"Wall clock: {elapsed:.1f}s")
    if llm:
        print("\n" + llm.meter.summary())


def cmd_chat(args):
    from .llm import GatewayLLM
    from .chat import chat_loop
    target = Path(args.target)
    if target.is_dir():
        target = Path(args.out) / f"{company_key(target)}_debt_structure.json"
    if not target.exists():
        raise SystemExit(f"No pipeline output at {target} — run `run` first.")
    llm = GatewayLLM(use_cache=False)  # conversation turns should never be cached
    chat_loop(llm, target, model=args.reason_model)


def cmd_prompt(args):
    """Dump the exact structuring messages for a company (for offline dry-runs
    and live-walkthrough debugging) without calling any model."""
    from .structure import SYSTEM_PROMPT, OUTPUT_SCHEMA
    company_dir = Path(args.company_dir)
    key = company_key(company_dir)
    excel = ingest_excel(company_dir)
    docs = docmod.load_fixture(key) if args.mock else json.loads(
        (Path(args.out) / f"{key}_debt_structure.json").read_text())["credit_snapshot"]["documents"]
    snapshot = build_snapshot(excel, docs)
    user = ("CREDIT SNAPSHOT (computed from the dataroom):\n"
            + json.dumps(snapshot, indent=1, default=str)
            + "\n\nRequired output schema:\n" + OUTPUT_SCHEMA)
    out_dir = Path("others/phase1_experiments/claude_chat")
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{key}_prompt.md"
    path.write_text(
        "# Exact structuring prompt — answer with ONLY the JSON object\n\n"
        "## SYSTEM\n\n" + SYSTEM_PROMPT + "\n\n## USER\n\n" + user + "\n")
    print(f"Wrote {path} (~{(len(SYSTEM_PROMPT) + len(user)) // 4} tokens)")


def cmd_models(args):
    from openai import OpenAI
    client = OpenAI(base_url=config.LLM_BASE_URL, api_key=config.LLM_API_KEY)
    for m in client.models.list():
        print(m.id)


def main():
    ap = argparse.ArgumentParser(prog="pipeline")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_run = sub.add_parser("run", help="dataroom -> snapshot + debt structure JSON")
    p_run.add_argument("company_dir")
    p_run.add_argument("--out", default="final_outputs")
    p_run.add_argument("--mock", action="store_true",
                       help="run offline using fixture extractions (no API key needed)")
    p_run.add_argument("--no-cache", action="store_true", help="bypass the LLM disk cache")
    p_run.add_argument("--extract-model", default=config.EXTRACT_MODEL)
    p_run.add_argument("--reason-model", default=config.REASON_MODEL)
    p_run.set_defaults(func=cmd_run)

    p_chat = sub.add_parser("chat", help="multi-turn follow-up chat on a company")
    p_chat.add_argument("target", help="pipeline output JSON or the company dir")
    p_chat.add_argument("--out", default="final_outputs")
    p_chat.add_argument("--reason-model", default=config.REASON_MODEL)
    p_chat.set_defaults(func=cmd_chat)

    p_prompt = sub.add_parser("prompt", help="dump the exact structuring prompt (no LLM call)")
    p_prompt.add_argument("company_dir")
    p_prompt.add_argument("--out", default="final_outputs")
    p_prompt.add_argument("--mock", action="store_true",
                          help="build the snapshot from fixture extractions")
    p_prompt.set_defaults(func=cmd_prompt)

    p_models = sub.add_parser("models", help="list models available to the key")
    p_models.set_defaults(func=cmd_models)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
