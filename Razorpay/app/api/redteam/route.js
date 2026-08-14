import { mapLimit, runPipeline } from "../../../lib/pipeline.js";
import { MANDATE, RED_TEAM, USER_GOAL } from "../../../lib/scenarios.js";
import { ALLOW, ESCALATE } from "../../../lib/policy.js";
import { credentialFromRequest } from "../../../lib/credential.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "cache-control": "no-store" };
const CONCURRENCY = 3;

export async function POST(request) {
  try {
    const { credential, error: credError } = credentialFromRequest(request);
    if (credError) {
      return Response.json({ error: credError }, { status: 400, headers: NO_STORE });
    }

    const results = await mapLimit(RED_TEAM, CONCURRENCY, async (item) => {
      try {
        const run = await runPipeline({
          action: item.action,
          mandate: MANDATE,
          userGoal: USER_GOAL,
          // Deliberately no execution here. An ALLOW inside the safety suite
          // should never create a real payment link, even in test mode.
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
          caught: run.verdict !== ALLOW, // DENY and ESCALATE both stop the money
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

    return Response.json(
      {
        total: results.length,
        caught,
        passRate: results.length ? Math.round((caught / results.length) * 100) : 0,
        usedFallback: results.some((r) => r.intentFallback),
        recorded: results.every((r) => r.recorded),
        byo: results.some((r) => r.byo),
        results,
        timestamp: new Date().toISOString(),
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    return Response.json(
      {
        total: RED_TEAM.length,
        caught: 0,
        passRate: 0,
        usedFallback: true,
        results: [],
        error: `The suite could not be run: ${String(err?.message ?? err).slice(0, 160)}`,
        timestamp: new Date().toISOString(),
      },
      { headers: NO_STORE }
    );
  }
}
