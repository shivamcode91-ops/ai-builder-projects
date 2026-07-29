// Step 4 of the pipeline: execution. Runs ONLY on a final ALLOW.
//
// Three modes behind one executeAction(). Never throws — always returns
// { executed, mode, detail, reference?, shortUrl? }.
//
// Hard rule: refuse to execute against anything that is not a test key.

import { formatPaise } from "./format.js";

const REST_URL = "https://api.razorpay.com/v1/payment_links";
const MCP_URL = "https://mcp.razorpay.com/mcp";
const TIMEOUT_MS = 10000;

export function resolveExecMode() {
  const override = (process.env.RZP_EXEC_MODE || "").trim().toLowerCase();
  if (override === "rest" || override === "mcp" || override === "simulate") {
    return override;
  }

  const keyId = process.env.RZP_KEY_ID;
  const keySecret = process.env.RZP_KEY_SECRET;

  if (keyId && keySecret) {
    // Razorpay's sandbox is live mode with test credentials — there is no
    // separate base URL, so the key prefix is the only guard against pointing
    // this demo at real money.
    if (!keyId.startsWith("rzp_test_")) return "simulate";
    return "rest";
  }

  if (process.env.RZP_MERCHANT_TOKEN) return "mcp";

  return "simulate";
}

export function execModeLabel(mode) {
  if (mode === "rest") return "exec: rest · test mode";
  if (mode === "mcp") return "exec: mcp.razorpay.com · test mode";
  return "exec: simulated";
}

function fakeReference(prefix) {
  // Deterministic-looking but random enough to read as a real reference id.
  const suffix = Math.random().toString(36).slice(2, 16).padEnd(14, "0");
  return `${prefix}_${suffix}`;
}

function simulate(action, detail) {
  const isLink = action.tool === "link.create";
  return {
    executed: true,
    mode: "simulate",
    detail:
      detail ||
      `Simulated ${action.tool} for ${formatPaise(action.amountPaise)}. No network call made.`,
    reference: fakeReference(isLink ? "plink" : "rfnd"),
    shortUrl: isLink ? `https://rzp.io/i/${Math.random().toString(36).slice(2, 9)}` : null,
  };
}

async function withTimeout(fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function executeRest(action) {
  // Only payment links can be created from nothing. A refund needs a live
  // payment_id that this demo does not have, so it is reported honestly as
  // simulated rather than dressed up as a real call.
  if (action.tool !== "link.create") {
    return simulate(
      action,
      `${action.tool} needs a live payment_id to execute against Razorpay; simulated instead.`
    );
  }

  const auth = Buffer.from(
    `${process.env.RZP_KEY_ID}:${process.env.RZP_KEY_SECRET}`
  ).toString("base64");

  try {
    const res = await withTimeout((signal) =>
      fetch(REST_URL, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          amount: Number(action.amountPaise),
          currency: "INR",
          description: action.note || `AgentGuard ${action.tool}`,
          reference_id: `ag-${action.orderId || Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          notify: { sms: false, email: false },
          reminder_enable: false,
        }),
      })
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        executed: false,
        mode: "rest",
        detail: `Razorpay rejected the call (HTTP ${res.status}): ${
          data?.error?.description || "no description"
        }`,
        reference: null,
        shortUrl: null,
      };
    }

    return {
      executed: true,
      mode: "rest",
      detail: `Payment link created in Razorpay test mode for ${formatPaise(action.amountPaise)}.`,
      reference: data?.id ?? null,
      shortUrl: data?.short_url ?? null,
    };
  } catch (err) {
    return {
      executed: false,
      mode: "rest",
      detail: `Razorpay unreachable (${String(err?.message ?? err).slice(0, 100)}). Nothing was charged.`,
      reference: null,
      shortUrl: null,
    };
  }
}

async function executeMcp(action) {
  // Note: the documented `npx mcp-remote` setup is a local stdio bridge for
  // Claude Desktop / Cursor and cannot run inside a serverless function, so
  // this speaks JSON-RPC to the HTTP endpoint directly.
  try {
    const res = await withTimeout((signal) =>
      fetch(MCP_URL, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Basic ${process.env.RZP_MERCHANT_TOKEN}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "payment_link.create",
            arguments: {
              amount: Number(action.amountPaise),
              currency: "INR",
              description: action.note || `AgentGuard ${action.tool}`,
            },
          },
        }),
      })
    );

    const raw = await res.text();
    if (!res.ok) {
      return {
        executed: false,
        mode: "mcp",
        detail: `MCP endpoint returned HTTP ${res.status}.`,
        reference: null,
        shortUrl: null,
      };
    }

    // The endpoint may answer as JSON or as a single SSE frame.
    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      const frame = raw.split("\n").find((l) => l.startsWith("data:"));
      if (frame) {
        try {
          payload = JSON.parse(frame.slice(5).trim());
        } catch {
          /* leave payload null */
        }
      }
    }

    if (payload?.error) {
      return {
        executed: false,
        mode: "mcp",
        detail: `MCP call failed: ${payload.error?.message ?? "unknown error"}`,
        reference: null,
        shortUrl: null,
      };
    }

    const text = payload?.result?.content?.find?.((c) => c?.type === "text")?.text ?? "";
    let inner = null;
    try {
      inner = JSON.parse(text);
    } catch {
      /* not JSON, fine */
    }

    return {
      executed: true,
      mode: "mcp",
      detail: "Executed through mcp.razorpay.com/mcp in test mode.",
      reference: inner?.id ?? null,
      shortUrl: inner?.short_url ?? null,
    };
  } catch (err) {
    return {
      executed: false,
      mode: "mcp",
      detail: `MCP endpoint unreachable (${String(err?.message ?? err).slice(0, 100)}).`,
      reference: null,
      shortUrl: null,
    };
  }
}

export async function executeAction(action) {
  const mode = resolveExecMode();
  try {
    if (mode === "rest") return await executeRest(action);
    if (mode === "mcp") return await executeMcp(action);
    return simulate(action);
  } catch (err) {
    // Belt and braces: this function is contractually not allowed to throw.
    return {
      executed: false,
      mode,
      detail: `Execution adapter error: ${String(err?.message ?? err).slice(0, 120)}`,
      reference: null,
      shortUrl: null,
    };
  }
}
