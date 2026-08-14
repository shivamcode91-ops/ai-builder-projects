import { runPipeline } from "../../../lib/pipeline.js";
import { MANDATE, USER_GOAL } from "../../../lib/scenarios.js";
import { ESCALATE } from "../../../lib/policy.js";
import { resolveExecMode } from "../../../lib/razorpay.js";
import { credentialFromRequest, sanitizeAction } from "../../../lib/credential.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request) {
  let action = null;

  try {
    const body = await request.json();
    // Clamped, so this route cannot be used as a general-purpose model relay.
    action = sanitizeAction(body?.action);

    if (!action) {
      return Response.json(
        { error: "Body must include an action with a tool string." },
        { status: 400, headers: NO_STORE }
      );
    }

    // A visitor may supply their own key. It is used for this request only and
    // is never stored or logged.
    const { credential, error: credError } = credentialFromRequest(request);
    if (credError) {
      return Response.json({ error: credError }, { status: 400, headers: NO_STORE });
    }

    const result = await runPipeline({
      action,
      mandate: body?.mandate ?? MANDATE,
      userGoal: body?.userGoal ?? USER_GOAL,
      credential,
    });

    return Response.json({ action, ...result }, { headers: NO_STORE });
  } catch (err) {
    // This route must never hand the UI an unrenderable response. If the
    // pipeline itself broke, return a conservative ESCALATE that says so.
    return Response.json(
      {
        action,
        verdict: ESCALATE,
        ruleVerdict: ESCALATE,
        ruleReasons: ["The policy pipeline errored before it could reach a verdict."],
        checks: {},
        intentVerdict: ESCALATE,
        intentReason:
          "AgentGuard could not evaluate this action, so it is held for a human rather than passed through.",
        confidence: 0,
        intentFallback: true,
        intentFallbackNote: String(err?.message ?? err).slice(0, 160),
        execution: null,
        executionMode: resolveExecMode(),
        timestamp: new Date().toISOString(),
        degraded: true,
      },
      { headers: NO_STORE }
    );
  }
}
