"""LLM client for the Prism gateway (OpenAI-compatible), with disk caching,
retry handling and per-call token/latency metering.

Every response is cached under .cache/llm keyed on (model, messages,
max_tokens), so re-running the pipeline never re-spends tokens on inputs that
haven't changed.
"""
import hashlib
import json
import time
from pathlib import Path

from . import config


class TruncatedResponse(RuntimeError):
    """Model stopped at the output-token cap; retrying as-is won't help."""


class Meter:
    """Accumulates token usage and latency across all calls in a run."""

    def __init__(self):
        self.calls = []

    def record(self, name, model, prompt_tokens, completion_tokens, seconds, cached):
        self.calls.append({
            "name": name,
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "seconds": round(seconds, 2),
            "cached": cached,
        })

    def totals(self):
        live = [c for c in self.calls if not c["cached"]]
        cost = 0.0
        for c in live:
            inp, outp = config.PRICING.get(c["model"], (0, 0))
            cost += c["prompt_tokens"] / 1e6 * inp + c["completion_tokens"] / 1e6 * outp
        return {
            "llm_calls": len(self.calls),
            "cached_calls": len(self.calls) - len(live),
            "prompt_tokens": sum(c["prompt_tokens"] for c in live),
            "completion_tokens": sum(c["completion_tokens"] for c in live),
            "llm_seconds": round(sum(c["seconds"] for c in live), 2),
            "est_cost_usd": round(cost, 4),
        }

    def summary(self):
        lines = [f"{'call':<28}{'model':<30}{'in_tok':>8}{'out_tok':>8}{'sec':>7}  cached"]
        for c in self.calls:
            lines.append(
                f"{c['name']:<28}{c['model']:<30}{c['prompt_tokens']:>8}"
                f"{c['completion_tokens']:>8}{c['seconds']:>7}  {'yes' if c['cached'] else 'no'}"
            )
        t = self.totals()
        lines.append(
            f"TOTAL (live): {t['prompt_tokens']} in / {t['completion_tokens']} out tokens, "
            f"{t['llm_seconds']}s LLM time, ~${t['est_cost_usd']} "
            f"({t['cached_calls']}/{t['llm_calls']} calls served from cache)"
        )
        return "\n".join(lines)


class PrismLLM:
    def __init__(self, cache_dir=".cache/llm", use_cache=True):
        if not config.PRISM_API_KEY:
            raise SystemExit(
                "PRISM_API_KEY is not set. Export it (see .env.example) or run with --mock."
            )
        from openai import OpenAI

        self.client = OpenAI(
            base_url=config.PRISM_BASE_URL,
            api_key=config.PRISM_API_KEY,
            timeout=config.REQUEST_TIMEOUT_S,
            max_retries=0,  # we handle retries ourselves (Prism has no fallback)
        )
        self.cache_dir = Path(cache_dir)
        self.use_cache = use_cache
        self.meter = Meter()

    def _cache_key(self, model, messages, max_tokens):
        blob = json.dumps({"m": model, "msgs": messages, "mt": max_tokens}, sort_keys=True)
        return hashlib.sha256(blob.encode()).hexdigest()[:32]

    def _stream_call(self, model, messages, max_tokens, temperature):
        """One streamed completion -> (text, finish_reason, usage).

        Usage arrives in the final chunk when the gateway honours
        stream_options={"include_usage": True}; if it doesn't (or rejects the
        param), fall back to a chars/4 estimate so the meter keeps working.
        """
        kwargs = dict(model=model, messages=messages, max_tokens=max_tokens,
                      temperature=temperature, stream=True, **config.EXTRA_BODY)
        try:
            stream = self.client.chat.completions.create(
                stream_options={"include_usage": True}, **kwargs)
        except Exception as e:
            if "stream_options" not in str(e):
                raise
            stream = self.client.chat.completions.create(**kwargs)

        parts, finish_reason, usage_obj = [], None, None
        for chunk in stream:
            if getattr(chunk, "usage", None):
                usage_obj = chunk.usage
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = getattr(choice, "delta", None)
            if delta is not None and delta.content:
                parts.append(delta.content)
            if choice.finish_reason:
                finish_reason = choice.finish_reason
        text = "".join(parts)
        # Prism's streamed usage can omit prompt_tokens — estimate what's missing
        # (chars/4) so the meter and budget math stay honest.
        p_tok = getattr(usage_obj, "prompt_tokens", 0) if usage_obj else 0
        c_tok = getattr(usage_obj, "completion_tokens", 0) if usage_obj else 0
        usage = {
            "prompt_tokens": p_tok or sum(
                len(str(m.get("content", ""))) for m in messages) // 4,
            "completion_tokens": c_tok or len(text) // 4,
        }
        return text, finish_reason, usage

    def complete(self, name, model, messages, max_tokens=2000, temperature=0.0):
        cache_file = self.cache_dir / f"{self._cache_key(model, messages, max_tokens)}.json"
        if self.use_cache and cache_file.exists():
            hit = json.loads(cache_file.read_text())
            self.meter.record(name, model, hit["usage"]["prompt_tokens"],
                              hit["usage"]["completion_tokens"], 0.0, cached=True)
            return hit["text"]

        last_err = None
        for attempt in range(1, config.MAX_RETRIES + 1):
            t0 = time.time()
            try:
                # Streamed: Prism sits behind CloudFront, which 504s long-lived
                # non-streaming requests; a byte stream keeps the connection alive
                # for the ~60s a full structuring generation takes.
                text, finish_reason, usage = self._stream_call(
                    model, messages, max_tokens, temperature)
                dt = time.time() - t0
                if finish_reason == "length":
                    raise TruncatedResponse(
                        f"'{name}' hit the {max_tokens}-token output cap before finishing "
                        f"(response truncated). Raise max_tokens for this call. Note: some "
                        f"models spend hidden reasoning tokens against this cap."
                    )
                self.meter.record(name, model, usage["prompt_tokens"],
                                  usage["completion_tokens"], dt, cached=False)
                if self.use_cache:
                    self.cache_dir.mkdir(parents=True, exist_ok=True)
                    cache_file.write_text(json.dumps({"text": text, "usage": usage}))
                return text
            except TruncatedResponse:
                raise  # deterministic; retrying identical args won't help
            except Exception as e:  # includes RateLimitError (429 = budget cap)
                last_err = e
                status = getattr(e, "status_code", None)
                if status == 429:
                    # A budget-cap 429 is permanent (Prism guide: expected when the
                    # key is exhausted) — retrying only burns time. Fail fast.
                    if "insufficient_quota" in str(e) or "budget" in str(e).lower():
                        raise SystemExit(
                            f"API key budget exhausted (429 on '{name}'): {e}\n"
                            f"Completed calls are disk-cached; re-run with a funded "
                            f"key to resume where this left off."
                        )
                    print(f"  [llm] 429 on '{name}' — rate limited. "
                          f"Retry {attempt}/{config.MAX_RETRIES} in {10 * attempt}s...")
                    time.sleep(10 * attempt)
                elif status is not None and status < 500:
                    raise  # 4xx other than 429: our bug, don't burn retries
                else:
                    time.sleep(3 * attempt)
        raise RuntimeError(f"LLM call '{name}' failed after {config.MAX_RETRIES} attempts: {last_err}")


def parse_json_response(text):
    """Extract the first JSON object from a model response, tolerating code
    fences and surrounding prose. raw_decode handles braces inside strings."""
    decoder = json.JSONDecoder()
    start = text.find("{")
    while start != -1:
        try:
            obj, _ = decoder.raw_decode(text[start:])
            return obj
        except json.JSONDecodeError:
            start = text.find("{", start + 1)
    raise ValueError(f"No JSON object in response: {text[:200]}")
