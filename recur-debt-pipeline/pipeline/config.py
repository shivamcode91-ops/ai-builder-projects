"""Central config: Prism gateway credentials, model selection, pricing."""
import os

PRISM_BASE_URL = os.environ.get("PRISM_BASE_URL", "https://prism.recur.club/v1")
PRISM_API_KEY = os.environ.get("PRISM_API_KEY", "")

# Cheap, fast model for document extraction (high volume, low reasoning).
EXTRACT_MODEL = os.environ.get("EXTRACT_MODEL", "claude-haiku-4-5-20251001")
# Stronger model for the structuring judgment and follow-up chat.
REASON_MODEL = os.environ.get("REASON_MODEL", "claude-sonnet-4-6")

# USD per 1M tokens (input, output) — indicative list prices, used only to
# estimate run cost in the meter printout.
PRICING = {
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-opus-4-6": (15.00, 75.00),
    "claude-opus-4-7": (15.00, 75.00),
}

REQUEST_TIMEOUT_S = 300  # Prism guide: large inputs can take 60-180s
MAX_RETRIES = 3

# Optional provider-specific request body passthrough (OpenAI SDK `extra_body`).
# Left empty for Prism/Anthropic. When testing against Gemini's OpenAI-compat
# endpoint, set EXTRA_BODY_JSON to disable "thinking" so it behaves like a
# plain chat model:
#   export EXTRA_BODY_JSON='{"extra_body":{"google":{"thinking_config":{"thinking_budget":0}}}}'
import json as _json
EXTRA_BODY = _json.loads(os.environ.get("EXTRA_BODY_JSON", "{}"))
