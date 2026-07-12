# AI Builder Projects

A growing collection of AI product + engineering builds. Each folder is a self-contained
project with its own README and run instructions.

| Project | What it is | Stack | Run guide |
|---|---|---|---|
| [`recur-debt-pipeline/`](recur-debt-pipeline/) | An AI pipeline that reads a company's financial dataroom and produces a credit snapshot + a recommended debt structure (with a grounded follow-up chat). | Python · Claude (Haiku + Sonnet) | [README](recur-debt-pipeline/README.md) |
| [`vitalis-health-app/`](vitalis-health-app/) | A native iOS health app that turns Apple Health + InBody scans into a single "Biological Age" score. 100% on-device. | Swift · SwiftUI · HealthKit | [README](vitalis-health-app/README.md) |

## How this repo is organised

- Every project lives in its own top-level folder and runs independently.
- Each project's own `README.md` is the source of truth for setup + commands.
- New builds get added here over time — one folder per project.

## Notes

- **No private data is committed.** The debt pipeline ships with small *synthetic*
  fixtures (fictional companies) covering the LLM stages; the real assignment datasets
  (the Excel datarooms) are never included, so the full end-to-end run needs those
  private datasets supplied as a path. The health app reads only your own device's Apple
  Health data at runtime and stores nothing off-device.
- **No secrets are committed.** API keys are read from environment variables — see each
  project's `.env.example`.

## Quick start

```bash
# Debt pipeline (Python) — no API key needed to run the offline tests:
cd recur-debt-pipeline
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest tests/ -q   # 7 pass offline; 16 golden tests need the private datasets (auto-skipped)

# Health app (iOS) — open in Xcode 15+ and run on an iOS 17+ device:
open vitalis-health-app/Vitalis.xcodeproj
```

> The debt pipeline's full run/chat and its golden tests need the private Recur datasets
> supplied as a path (`... run <datasets>/company_1`) — see its README. Everything else
> (code, architecture, UI design, offline tests) works without them.

See each project's README for the full walkthrough.
