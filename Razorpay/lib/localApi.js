// The two API routes, re-hosted in the visitor's tab.
//
// The deployed Next.js app runs the pipeline on a server. The published demo
// is a static export on GitHub Pages, which has no server, so the same lib/
// modules run client-side instead. What does NOT change is the important part:
// both paths call the same `runPipeline()`, so the red-team suite is still not
// a separate scripted path.
//
// Two consequences of running here rather than on a server, both good:
//
//   - A visitor's own key never reaches any server of ours. It goes from their
//     tab straight to their provider. There is no relay to abuse, which is what
//     `sanitizeAction` existed to prevent — it is kept anyway, because the
//     clamps also stop a malformed action reaching a paid endpoint.
//   - With no key anywhere, `activeProviders()` finds no `process.env` values
//     in the browser bundle, so demo mode serves the recording exactly as the
//     unkeyed server deployment does.
//
// `apiFetch` is a drop-in for `fetch` at the three call sites in Deck.js: it
// returns something with a `.json()`, and in a non-static build it IS `fetch`.

import { mapLimit, runPipeline } from "./pipeline.js";
import { MANDATE, RED_TEAM, USER_GOAL } from "./scenarios.js";
import { ALLOW, ESCALATE } from "./policy.js";
import { resolveExecMode } from "./razorpay.js";
import { credentialFromHeaders, sanitizeAction } from "./credential.js";

/** True in the GitHub Pages build, false for `next dev` and Vercel. */
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

const CONCURRENCY = 3;

/** Header lookup over the plain object Deck.js builds. */
function lookup(headers) {
  const lower = {};
  for (const [k, v] of Object.entries(headers || {})) lower[k.toLowerCase()] = v;
  return (name) => lower[String(name).toLowerCase()] ?? null;
}

/** app/api/verdict/route.js, minus the HTTP. */
async function verdict(headers, body) {
  let action = null;
  try {
    action = sanitizeAction(body?.action);
    if (!action) return { error: "Body must include an action with a tool string." };

    const { credential, error } = credentialFromHeaders(lookup(headers));
    if (error) return { error };

    const result = await runPipeline({
      action,
      mandate: body?.mandate ?? MANDATE,
      userGoal: body?.userGoal ?? USER_GOAL,
      credential,
    });
    return { action, ...result };
  } catch (err) {
    // Same contract as the route: never hand the UI an unrenderable response.
    return {
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
    };
  }
}

/** app/api/redteam/route.js, minus the HTTP. */
async function redteam(headers) {
  try {
    const { credential, error } = credentialFromHeaders(lookup(headers));
    if (error) return { error };

    const results = await mapLimit(RED_TEAM, CONCURRENCY, async (item) => {
      try {
        const run = await runPipeline({
          action: item.action,
          mandate: MANDATE,
          userGoal: USER_GOAL,
          // An ALLOW inside the safety suite must never create a real payment
          // link, even in test mode.
          execute: false,
          credential,
          recordedId: item.id,
        });

        return {
          id: item.id,
          attack: item.attack,
          tool: item.action.tool,
          amountPaise: item.action.amountPaise,
          verdict: run.verdict,
          caught: run.verdict !== ALLOW,
          reason: run.headline || run.intentReason,
          plain: item.plain ?? null,
          ruleVerdict: run.ruleVerdict,
          intentVerdict: run.intentVerdict,
          intentFallback: run.intentFallback,
          recorded: Boolean(run.intentRecorded),
          byo: Boolean(run.intentByo),
          knownGap: Boolean(item.knownGap),
          gapNote: item.gapNote ?? null,
        };
      } catch (err) {
        // One broken attack must not take down the scorecard.
        return {
          id: item.id,
          attack: item.attack,
          tool: item.action?.tool ?? null,
          amountPaise: item.action?.amountPaise ?? 0,
          verdict: ESCALATE,
          caught: true,
          reason: "This could not be checked, so it is being held rather than allowed.",
          plain: item.plain ?? null,
          ruleVerdict: ESCALATE,
          intentVerdict: ESCALATE,
          intentFallback: true,
          knownGap: Boolean(item.knownGap),
          gapNote: String(err?.message ?? err).slice(0, 160),
        };
      }
    });

    const caught = results.filter((r) => r.caught).length;

    return {
      total: results.length,
      caught,
      passRate: results.length ? Math.round((caught / results.length) * 100) : 0,
      usedFallback: results.some((r) => r.intentFallback),
      recorded: results.every((r) => r.recorded),
      byo: results.some((r) => r.byo),
      results,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      total: RED_TEAM.length,
      caught: 0,
      passRate: 0,
      usedFallback: true,
      results: [],
      error: `The suite could not be run: ${String(err?.message ?? err).slice(0, 160)}`,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Drop-in for `fetch` at the API call sites. On a server build it is `fetch`;
 * on the static build it runs the handler here and returns the same shape the
 * callers already use.
 */
export async function apiFetch(path, init = {}) {
  if (!IS_STATIC) return fetch(path, init);

  const headers = init.headers ?? {};
  let body = {};
  if (init.body) {
    try {
      body = JSON.parse(init.body);
    } catch {
      /* leave empty — verdict() rejects a missing action anyway */
    }
  }

  const data = path.includes("redteam")
    ? await redteam(headers)
    : await verdict(headers, body);

  return { ok: true, status: 200, json: async () => data };
}
