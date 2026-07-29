// Reading a visitor's own API key off a request.
//
// Rules this file exists to enforce:
//   1. The key lives for the duration of one request. It is never written to
//      disk, a cookie, a log line, or a response body.
//   2. It arrives in a header, not the URL, so it cannot end up in an access
//      log or a browser history entry.
//   3. It is shape-checked before we forward it anywhere, so this endpoint
//      cannot be used to relay arbitrary strings to a third party.
//   4. The payload it is used on is our own scenario data with hard length
//      caps, so the endpoint cannot be turned into a general-purpose prompt
//      relay running on someone else's account.

import { defaultModelFor, isSupportedProvider, validateCredential } from "./providers.js";

export const HEADER_PROVIDER = "x-agentguard-provider";
export const HEADER_KEY = "x-agentguard-key";
export const HEADER_MODEL = "x-agentguard-model";

const MAX_MODEL_LEN = 80;

/**
 * Pull a visitor-supplied credential off the request headers.
 * Returns { credential, error } — `credential` is null in demo mode.
 * `error` is a message safe to show, and never contains key material.
 */
export function credentialFromRequest(request) {
  const provider = (request.headers.get(HEADER_PROVIDER) || "").trim().toLowerCase();
  const apiKey = (request.headers.get(HEADER_KEY) || "").trim();

  // No key supplied — demo mode, which is the normal path.
  if (!provider && !apiKey) return { credential: null, error: null };

  if (!isSupportedProvider(provider)) {
    return { credential: null, error: "Unknown provider." };
  }

  const problem = validateCredential({ provider, apiKey });
  if (problem) return { credential: null, error: problem };

  let model = (request.headers.get(HEADER_MODEL) || "").trim();
  if (model.length > MAX_MODEL_LEN || /[^\w./:-]/.test(model)) model = "";

  return {
    credential: { provider, apiKey, model: model || defaultModelFor(provider) },
    error: null,
  };
}

/**
 * Clamp an action from the request body. Without this, someone could put a
 * novel-length string in `note` and use a visitor's key — or ours — as a
 * general-purpose model endpoint.
 */
export function sanitizeAction(raw) {
  if (!raw || typeof raw !== "object") return null;

  const str = (v, max) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const tool = str(raw.tool, 64);
  if (!tool) return null;

  const amount = Number(raw.amountPaise);

  return {
    tool,
    amountPaise: Number.isFinite(amount) && amount >= 0 ? Math.floor(amount) : 0,
    payeeVpa: str(raw.payeeVpa, 128),
    orderId: str(raw.orderId, 64),
    note: str(raw.note, 400),
  };
}
