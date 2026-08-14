# AI Builder Projects

### ▶︎ Open any of these right now — no login, no key, no setup

## **https://shivamcode91-ops.github.io/ai-builder-projects/**

| | Live demo | What it is | Try it with your own… |
|---|---|---|---|
| 🛡️ | **[AgentGuard →](https://shivamcode91-ops.github.io/ai-builder-projects/agentguard/)** | A safety layer between an AI assistant and a merchant's Razorpay account. Every refund or payment link it proposes is checked against the owner's limits **and** the job they described, then approved, held, or blocked — with a reason in plain words. One button fires ten known scam attempts through the same pipeline and scores what was stopped. | OpenRouter / Groq / Anthropic key |
| 📊 | **[Credit Workbench →](https://shivamcode91-ops.github.io/ai-builder-projects/debt/)** | Reads a company's dataroom and produces a credit snapshot and a recommended debt structure — product, amount, tenor, covenants — then answers an underwriter's follow-ups grounded in it. | Anthropic key + your own dataroom |
| 🫀 | **[Vitalis →](https://shivamcode91-ops.github.io/ai-builder-projects/vitalis/)** | A native iOS health app that turns Apple Health + InBody scans into one number: **Biological Age**. The scoring model runs in the page — change any reading and every score recomputes. | your own numbers |

Every demo **starts in a demo environment**: real output, nothing to set up, and anything recorded
rather than live is labelled as such on screen. Each one then takes your own key and your own data —
which never touch a server of mine, because there isn't one. These are static pages; your key goes
from your tab straight to the provider, lives in `sessionStorage`, and dies with the tab.

---

## The projects

| Project | Stack | Code | Write-up |
|---|---|---|---|
| [`Razorpay/`](Razorpay/) — AgentGuard | Next.js 14 · React · plain JS, zero deps beyond React | [source](Razorpay/) | [README](Razorpay/README.md) |
| [`financial-debt-structuring/`](financial-debt-structuring/) — Credit Workbench | Python · Claude (Haiku + Sonnet) | [source](financial-debt-structuring/) | [README](financial-debt-structuring/README.md) |
| [`vitalis-health-app/`](vitalis-health-app/) — Vitalis | Swift · SwiftUI · HealthKit · iOS 17+ | [source](vitalis-health-app/) | [README](vitalis-health-app/README.md) |

Each folder is self-contained and runs independently; its own `README.md` is the source of truth for
setup and commands.

## Running them locally

```bash
# AgentGuard — works with no environment variables at all
cd Razorpay && npm install && npm run dev        # → localhost:3000
npm test                                         # 28 tests, zero dependencies

# Credit Workbench — the offline tests need no API key
cd financial-debt-structuring
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest tests/ -q             # 7 pass offline; the golden tests need the private datasets

# Vitalis — open in Xcode 15+ and run on a physical iOS 17+ device
open vitalis-health-app/Vitalis.xcodeproj
```

## The published demos

The site above is the `docs/` folder, served by GitHub Pages. It is deliberately static, and each
demo gets there differently:

- **AgentGuard** is the real Next.js app, statically exported. Its two API routes run in the browser
  instead of on a server (`Razorpay/lib/localApi.js`) — both paths call the same `runPipeline()`, so
  the red-team suite is not a separate scripted path. Rebuild with `cd Razorpay && npm run build:static`.
- **Credit Workbench** is a static workbench over the pipeline's actual deliverable output. Regenerate
  the bundled runs with `python3 financial-debt-structuring/ui/build_demo_data.py`. Live mode reads
  your files in the browser and makes the same two model calls the pipeline makes.
- **Vitalis** is the scoring model from [`docs/VITALIS_SPEC.md`](vitalis-health-app/docs/VITALIS_SPEC.md)
  §4 ported to JS, driving a replica of the five screens. Same formulas, weights and clamps; published
  population medians stand in for the norm tables the iOS build bundles.

## Notes on data and secrets

- **No private data is committed.** The debt pipeline ships small *synthetic* fixtures (fictional
  companies); the real Excel datarooms are never included and are passed in as a path. The health app
  reads only your own device's Apple Health data and stores nothing off-device.
- **No secrets are committed.** API keys come from environment variables — see each project's
  `.env.example`. The published bundles are scanned for key material before every deploy.

MIT licensed.
