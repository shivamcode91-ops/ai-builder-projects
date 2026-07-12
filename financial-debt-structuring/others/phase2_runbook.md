# Phase 2 — clean gateway runs (submission artifacts)

Only outputs generated via the LLM gateway (Anthropic models) with the API key
belong here. The Groq/Gemini stand-ins from phase 1 are never used for these runs.

## Runbook (executed when the gateway key arrives)

```bash
cd financial-debt-structuring
export LLM_API_KEY="your-api-key-here"        # from your provider; keep out of version control

# 0. sanity: list models visible to the key (a metadata GET, no token spend)
.venv/bin/python -m pipeline.cli models

# 1. document -> structure for all 3 companies  (writes final_outputs/company_N_debt_structure.json)
for c in company_1 company_2 company_3; do
  .venv/bin/python -m pipeline.cli run "<datasets>/$c"
done

# 2. multi-turn chat per company (transcript saved next to the output JSON on exit)
.venv/bin/python -m pipeline.cli chat "<datasets>/company_1"
.venv/bin/python -m pipeline.cli chat "<datasets>/company_2"
.venv/bin/python -m pipeline.cli chat "<datasets>/company_3"
```

Models: `claude-haiku-4-5` for the 5 document extractions, `claude-sonnet-4-6` for the
one structuring call and the chat (see README "Model choice").

## Budget plan (key cap: $10)

Measured per-company footprint (validated live in phase 1 over two gateways):

| Step | Tokens (in/out) | Est. cost on gateway (Haiku $1/$5, Sonnet $3/$15 per M) |
|---|---|---|
| Extraction ×5 (Haiku) | ~5.5k / ~1k | ~$0.01 |
| Structuring ×1 (Sonnet) | ~3.5k / ~1.5k | ~$0.03 |
| **Per company run** | **~9k / ~2.5k** | **~$0.05** |
| Chat, per turn (Sonnet) | ~3.5k / ~0.4k | ~$0.02 |

Full submission = 3 runs + 3× three-turn chats ≈ **$0.30–0.50**, i.e. under 5% of the
cap. Head-room protections already in the pipeline:

- **Disk cache** (`.cache/llm`): identical calls are never re-billed — re-runs and
  demos are free.
- **Fail-fast on budget exhaustion**: an `insufficient_quota` 429 aborts immediately
  with a clear message instead of retry-spinning.
- **`--mock` mode**: all development and tests run offline; the key is spent only on
  the final validated runs above.

## What lands in this folder

- `final_outputs/company_N_debt_structure.json` — credit snapshot + debt structure + validation warnings +
  run_meta (tokens, $, latency per call)
- `final_outputs/company_N_chat_transcript.md` — multi-turn follow-up transcripts

## Packaging the submission zip

From the folder above the repo (datasets are NOT included — assignment ground rule):

```bash
zip -r financial-debt-structuring.zip financial-debt-structuring \
  -x "*/.venv/*" "*/__pycache__/*" "*/.cache/*" "*/.DS_Store" "*/.playwright-mcp/*"
```

`.git/` is kept in the zip deliberately — the commit history documents the build.
Verify before sending: `unzip -l financial-debt-structuring.zip | grep -i -c dataset` → 0.
