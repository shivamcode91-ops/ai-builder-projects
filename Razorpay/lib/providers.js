// Provider registry for the intent verifier.
//
// Three transports, one normalised return shape. The verifier tries them in
// order and uses the first that answers, so a rate limit or an empty wallet on
// one provider degrades to the next rather than to the rule engine.
//
// Measured on the AgentGuard intent probes (6 cases, 4 of which the rule engine
// cannot catch — see docs/model-eval.md):
//
//   google/gemini-2.5-flash-lite   6/6   ~1.0s   $0.10/$0.40 per Mtok
//   deepseek/deepseek-chat         6/6   ~0.4s   $0.20/$0.80
//   moonshotai/kimi-k3             6/6   ~2.3s   $3.00/$15.00
//   moonshotai/kimi-k2.6           6/6   ~2.1s   $0.65/$2.72
//   openai/gpt-oss-120b (Groq)     4/4   ~0.6s   free, then 429s hard
//
// Two traps worth knowing, both found the hard way:
//
//  1. OpenRouter's reasoning models (the whole Kimi family) spend the entire
//     max_tokens budget on reasoning tokens and return content: null with
//     finish_reason "length". `reasoning: {enabled: false}` fixes it and is 12x
//     faster. `reasoning: {exclude: true}` does NOT — it only hides them.
//  2. `reasoning` is an OpenRouter-only parameter. Groq 400s on it, and Groq
//     only supports json_schema on some of its models.

const TIMEOUT_MS = 12000;

// Big enough that a reasoning model can finish and still emit the JSON. Output
// is billed on actual usage, not on this ceiling, so headroom is free.
const MAX_TOKENS = 1200;

export const DEFAULT_ORDER = ["openrouter", "groq", "anthropic"];

const JSON_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["ALLOW", "ESCALATE", "DENY"] },
    reason: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["verdict", "reason", "confidence"],
  additionalProperties: false,
};

async function postJson(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON error body */
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

/** Pull the assistant text out of an OpenAI-shaped response. */
function openAiText(json) {
  const choice = json?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string" && content.trim()) return content;

  // A reasoning model that burned its whole budget returns null content with
  // finish_reason "length". Say so explicitly — this is the single most
  // confusing failure on OpenRouter and a bare "empty response" hides it.
  if (choice?.finish_reason === "length") {
    throw new Error(
      "model spent its token budget on reasoning and returned no content — disable reasoning or raise max_tokens"
    );
  }
  if (choice?.message?.refusal) throw new Error("model refused the request");
  throw new Error("response contained no assistant text");
}

// --- providers --------------------------------------------------------------

const PROVIDERS = {
  openrouter: {
    label: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    defaultModel: "google/gemini-2.5-flash-lite",
    modelEnv: "OPENROUTER_MODEL",
    async call({ apiKey, model, system, user }) {
      const r = await postJson(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          authorization: `Bearer ${apiKey}`,
          // OpenRouter attributes traffic with these; harmless if unset.
          "HTTP-Referer": process.env.PUBLIC_URL || "https://agentguard.vercel.app",
          "X-Title": "AgentGuard",
        },
        {
          model,
          max_tokens: MAX_TOKENS,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "verdict", strict: true, schema: JSON_SCHEMA },
          },
          // See trap 1 above. Do not remove.
          reasoning: { enabled: false },
        }
      );
      if (!r.ok) {
        throw Object.assign(
          new Error(`HTTP ${r.status}: ${r.json?.error?.message ?? r.text.slice(0, 120)}`),
          { status: r.status }
        );
      }
      return openAiText(r.json);
    },
  },

  groq: {
    label: "Groq",
    envKey: "GROQ_API_KEY",
    // The only Groq model in the free tier that accepts json_schema; llama-3.3
    // and qwen3.6 both reject it.
    defaultModel: "openai/gpt-oss-120b",
    modelEnv: "GROQ_MODEL",
    async call({ apiKey, model, system, user }) {
      const r = await postJson(
        "https://api.groq.com/openai/v1/chat/completions",
        { authorization: `Bearer ${apiKey}` },
        {
          model,
          max_tokens: MAX_TOKENS,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "verdict", strict: true, schema: JSON_SCHEMA },
          },
          // No `reasoning` key here — Groq 400s on it (trap 2).
        }
      );
      if (!r.ok) {
        throw Object.assign(
          new Error(`HTTP ${r.status}: ${r.json?.error?.message ?? r.text.slice(0, 120)}`),
          { status: r.status }
        );
      }
      return openAiText(r.json);
    },
  },

  anthropic: {
    label: "Claude",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5",
    modelEnv: "ANTHROPIC_MODEL",
    async call({ apiKey, model, system, user }) {
      const r = await postJson(
        "https://api.anthropic.com/v1/messages",
        {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          // The static build runs this call from the visitor's own tab, so
          // their key never reaches a server of ours. Anthropic blocks browser
          // calls unless this opt-in is present; it is ignored server-side.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        {
          model,
          max_tokens: MAX_TOKENS,
          // Same reasoning-budget concern as trap 1: on Sonnet 5 thinking is on
          // by default and shares max_tokens with the response.
          thinking: { type: "disabled" },
          output_config: {
            effort: "low",
            format: { type: "json_schema", schema: JSON_SCHEMA },
          },
          system,
          messages: [{ role: "user", content: user }],
        }
      );
      if (!r.ok) {
        throw Object.assign(
          new Error(`HTTP ${r.status}: ${r.json?.error?.message ?? r.text.slice(0, 120)}`),
          { status: r.status }
        );
      }
      if (r.json?.stop_reason === "refusal") throw new Error("model refused the request");
      const block = Array.isArray(r.json?.content)
        ? r.json.content.find((b) => b?.type === "text")
        : null;
      if (!block?.text) throw new Error("response contained no assistant text");
      return block.text;
    },
  },
};

// Key shapes, so we never forward an arbitrary string to a provider. This is a
// sanity check on visitor input, not authentication — the provider still
// decides whether the key is real.
const KEY_PREFIX = {
  openrouter: "sk-or-",
  groq: "gsk_",
  anthropic: "sk-ant-",
};

export function isSupportedProvider(name) {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, name);
}

/**
 * Validate a key a visitor typed in. Returns null when it is usable, or a
 * message safe to show them — which never contains any part of the key.
 */
export function validateCredential({ provider, apiKey }) {
  if (!isSupportedProvider(provider)) return "Pick OpenRouter, Groq or Anthropic.";
  if (typeof apiKey !== "string" || !apiKey.trim()) return "Paste a key first.";

  const key = apiKey.trim();
  if (key.length < 20) return "That key looks too short.";
  if (key.length > 300) return "That key looks too long.";
  if (/[\s -]/.test(key)) return "That key contains spaces or line breaks.";

  const expected = KEY_PREFIX[provider];
  if (expected && !key.startsWith(expected)) {
    return `A ${PROVIDERS[provider].label} key starts with ${expected}`;
  }
  return null;
}

/**
 * Providers to try, in order.
 *
 * `credential` is a key supplied per request by a visitor. When one is given it
 * is the ONLY provider used — we never quietly fall back to the deployment's
 * own key, because a visitor testing their key needs to know it was theirs that
 * answered. It is used for this request and never stored.
 */
export function activeProviders(credential = null) {
  if (credential?.apiKey && isSupportedProvider(credential.provider)) {
    const p = PROVIDERS[credential.provider];
    return [
      {
        name: credential.provider,
        label: p.label,
        model: credential.model || p.defaultModel,
        apiKey: credential.apiKey,
        call: p.call,
        byo: true,
      },
    ];
  }

  const configured = (process.env.INTENT_PROVIDER || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const order = configured.length ? configured : DEFAULT_ORDER;

  return order
    .filter((name) => PROVIDERS[name] && process.env[PROVIDERS[name].envKey])
    .map((name) => {
      const p = PROVIDERS[name];
      return {
        name,
        label: p.label,
        model: process.env[p.modelEnv] || p.defaultModel,
        apiKey: process.env[p.envKey],
        call: p.call,
        byo: false,
      };
    });
}

/** Default model for a provider, so the UI can prefill the field. */
export function defaultModelFor(provider) {
  return PROVIDERS[provider]?.defaultModel ?? "";
}

/** A short label for the UI, with no key material in it. */
export function providerSummary() {
  const active = activeProviders();
  if (!active.length) return null;
  return active.map((p) => `${p.label}:${p.model}`).join(" → ");
}
