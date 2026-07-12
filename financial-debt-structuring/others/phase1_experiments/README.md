# Phase-1 experiments — how the pipeline was validated before spending the key

Budget discipline was part of the build: the full live path (real HTTP, vision
extraction of the scanned sanction letter, 429 retry/backoff, JSON parsing, the
token meter) was proven end-to-end on a FREE OpenAI-compatible gateway before a
rupee of the gateway API key was spent.

- `groq/` — complete live runs of all 3 companies + a multi-turn chat transcript
  through Groq (Llama 4 Scout extraction, Llama 3.3 70B structuring). These are
  validation artifacts from an EARLIER prompt version — the final submission
  outputs are in `final_outputs/` at the repo root, generated via gateway with
  Anthropic models.

Also tested during phase 1 (artifacts not kept to avoid confusion): a Gemini
stand-in gateway, and frozen-prompt dry-runs across Claude model tiers to pick
the extraction/structuring split (Haiku for volume, Sonnet for judgment).
