// The pipeline. Both API routes run exactly this, which is the whole claim:
// the red-team suite is not a separate scripted path.
//
//   agent proposes a tool call
//           |
//   1. deterministic policy engine   amount ceiling, tool + payee allowlists
//           |
//   2. LLM intent verifier           does this match what the user asked for?
//           |
//   3. combine — STRICTER WINS       DENY > ESCALATE > ALLOW
//           |
//   ALLOW? -- yes --> 4. execute against Razorpay (test mode)
//          -- no  --> blocked, logged, nothing reaches Razorpay

import { ALLOW, combineVerdicts, evaluatePolicy } from "./policy.js";
import { verifyIntent, llmConfigured } from "./intent.js";
import { executeAction, resolveExecMode } from "./razorpay.js";
import { MANDATE, USER_GOAL } from "./scenarios.js";
import { recordedForAction, recordedForAttempt } from "./recorded.js";

export async function runPipeline({
  action,
  mandate = MANDATE,
  userGoal = USER_GOAL,
  execute = true,
  credential = null,
  // The attempt id, so the recording can be looked up for suite runs. Pass
  // false to disable recorded mode entirely.
  recordedId = null,
}) {
  // 1. Rules. Pure, instant, and still correct if everything below fails.
  const rules = evaluatePolicy(action, mandate);

  // 2. Intent. Never throws; falls back to a rule-shaped verdict.
  //
  // Demo mode: with no key anywhere, serve the recorded response from a real
  // model rather than the rule-shaped fallback, so a visitor still sees what
  // layer 2 contributes. Labelled as a recording, never as live. A visitor's
  // own key always takes precedence and produces a genuine call.
  let intent;
  const canRecord = !credential?.apiKey && !llmConfigured() && recordedId !== false;
  const recorded = canRecord
    ? (recordedId ? recordedForAttempt(recordedId) : recordedForAction(action))
    : null;

  if (recorded) {
    intent = { ...recorded, fallback: false, provider: "recorded", byo: false };
  } else {
    intent = await verifyIntent({ action, mandate, userGoal, credential });
  }

  // 3. Stricter wins. This is the safety property — a rule-based ALLOW can
  //    never override an intent-based DENY.
  const verdict = combineVerdicts(rules.verdict, intent.verdict);

  // 4. Execute only on a final ALLOW. Everything else stops here.
  let execution = null;
  if (verdict === ALLOW && execute) {
    execution = await executeAction(action);
  }

  // Which layer actually decided this? The headline reason has to come from the
  // layer that produced the winning verdict, or the card contradicts itself —
  // an ESCALATE from the rule engine must not be explained with the intent
  // verifier's "this looks fine".
  const decidedBy =
    rules.verdict === verdict && intent.verdict !== verdict
      ? "rules"
      : intent.verdict === verdict && rules.verdict !== verdict
        ? "intent"
        : "both";

  const lastRuleReason = rules.reasons[rules.reasons.length - 1] ?? null;
  const headline =
    decidedBy === "rules" ? lastRuleReason || intent.reason : intent.reason;

  return {
    verdict,
    decidedBy,
    headline,
    ruleVerdict: rules.verdict,
    ruleReasons: rules.reasons,
    checks: rules.checks,
    intentVerdict: intent.verdict,
    intentReason: intent.reason,
    confidence: intent.confidence,
    intentFallback: intent.fallback,
    intentFallbackNote: intent.fallbackNote ?? null,
    // Which provider actually served this verdict, and what it had to skip to
    // get there. Names and model ids only — no key material.
    intentProvider: intent.provider ?? null,
    intentByo: Boolean(intent.byo),
    intentRecorded: Boolean(intent.recorded),
    intentModel: intent.model ?? null,
    intentDegradedFrom: intent.degradedFrom ?? null,
    execution,
    executionMode: resolveExecMode(),
    timestamp: new Date().toISOString(),
  };
}

/** Run a list of actions with a small concurrency cap. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await fn(items[index], index);
      }
    })
  );

  return results;
}
