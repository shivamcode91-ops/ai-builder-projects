"""One-screen underwriter UI — a thin local server over the existing pipeline.

  PRISM_API_KEY=... python ui/server.py --datasets <dir-with-company_N> [--out final_outputs]

Serves http://127.0.0.1:8787 : pick a company, Run (spawns the same CLI the
evaluators use), read the verdict card, chat grounded in the run output.
No new dependencies — stdlib http.server; the API key never leaves the env.
"""
import argparse
import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline import config                      # noqa: E402
from pipeline.chat import CHAT_SYSTEM            # noqa: E402

ARGS = None


def company_key(name):
    return name.lower().replace(" ", "_")


def out_path(company):
    return ROOT / ARGS.out / f"{company_key(company)}_debt_structure.json"


def list_companies():
    base = Path(ARGS.datasets)
    rows = []
    for d in sorted(p for p in base.iterdir() if p.is_dir() and not p.name.startswith(".")):
        n_files = sum(1 for f in d.rglob("*") if f.is_file() and not f.name.startswith("."))
        row = {"name": d.name, "n_files": n_files,
               "has_output": out_path(d.name).exists(), "eligibility": None}
        if row["has_output"]:
            try:
                row["eligibility"] = json.loads(out_path(d.name).read_text())[
                    "debt_structure"].get("eligibility")
            except Exception:
                pass
        rows.append(row)
    return rows


def run_company(company, fresh=False):
    cmd = [sys.executable, "-m", "pipeline.cli", "run",
           str(Path(ARGS.datasets) / company), "--out", ARGS.out,
           "--extract-model", ARGS.extract_model, "--reason-model", ARGS.reason_model]
    if fresh:  # re-run = full live analysis, not a cache replay
        cmd.append("--no-cache")
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=600)
    log = proc.stdout + (("\n" + proc.stderr) if proc.returncode else "")
    output = None
    if out_path(company).exists():
        output = json.loads(out_path(company).read_text())
    return {"ok": proc.returncode == 0, "log": log, "output": output}


def chat_turn(company, messages):
    from pipeline.llm import PrismLLM
    out = json.loads(out_path(company).read_text())
    system = CHAT_SYSTEM.format(
        snapshot=json.dumps(out["credit_snapshot"], indent=1, default=str),
        structure=json.dumps(out["debt_structure"], indent=1, default=str))
    llm = PrismLLM(use_cache=False)
    answer = llm.complete("ui:chat", ARGS.reason_model,
                          [{"role": "system", "content": system}] + messages,
                          max_tokens=2500)
    c = llm.meter.calls[-1]
    return {"answer": answer,
            "usage": {"in": c["prompt_tokens"], "out": c["completion_tokens"],
                      "seconds": c["seconds"]}}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *a):  # quiet
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            body = (Path(__file__).parent / "index.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/api/companies":
            self._json({"companies": list_companies(),
                        "models": {"extract": ARGS.extract_model, "reason": ARGS.reason_model},
                        "gateway": config.PRISM_BASE_URL, "out": ARGS.out})
        elif self.path.startswith("/api/output"):
            company = self.path.split("=", 1)[1]
            p = out_path(company)
            self._json(json.loads(p.read_text()) if p.exists() else {"error": "not run yet"},
                       200 if p.exists() else 404)
        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(n) or b"{}")
        try:
            if self.path == "/api/run":
                self._json(run_company(body["company"], bool(body.get("fresh"))))
            elif self.path == "/api/chat":
                self._json(chat_turn(body["company"], body["messages"]))
            else:
                self._json({"error": "not found"}, 404)
        except Exception as e:  # surface errors to the UI instead of a dead socket
            self._json({"error": f"{type(e).__name__}: {e}"}, 500)


def main():
    global ARGS
    ap = argparse.ArgumentParser()
    ap.add_argument("--datasets", required=True, help="folder containing company_N dirs")
    ap.add_argument("--out", default="final_outputs")
    ap.add_argument("--extract-model", default=config.EXTRACT_MODEL)
    ap.add_argument("--reason-model", default=config.REASON_MODEL)
    ap.add_argument("--port", type=int, default=8787)
    ARGS = ap.parse_args()
    (ROOT / ARGS.out).mkdir(parents=True, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", ARGS.port), Handler)
    print(f"Underwriter UI on http://127.0.0.1:{ARGS.port}  "
          f"(gateway {config.PRISM_BASE_URL}, out {ARGS.out})")
    srv.serve_forever()


if __name__ == "__main__":
    main()
