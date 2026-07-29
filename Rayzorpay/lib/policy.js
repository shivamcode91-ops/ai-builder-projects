// Layer 1 of the pipeline: the deterministic policy engine.
//
// Pure and synchronous on purpose. It has no model, no network, and no clock,
// so it produces the same verdict every time and keeps working when the LLM or
// Razorpay is down. Layer 2 (the intent verifier) can only ever make a verdict
// stricter — see combineVerdicts below.

import { formatMultiple, formatPaise, toolLabel } from "./format.js";

export const ALLOW = "ALLOW";
export const ESCALATE = "ESCALATE";
export const DENY = "DENY";

export const VERDICTS = [ALLOW, ESCALATE, DENY];

// DENY > ESCALATE > ALLOW
const RANK = { [ALLOW]: 0, [ESCALATE]: 1, [DENY]: 2 };

export function isVerdict(v) {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(RANK, v);
}

/**
 * The safety property that matters: stricter always wins. A rule-based ALLOW
 * can never override an intent-based DENY.
 */
export function combineVerdicts(...verdicts) {
  let worst = ALLOW;
  for (const v of verdicts) {
    if (!isVerdict(v)) continue;
    if (RANK[v] > RANK[worst]) worst = v;
  }
  return worst;
}

/**
 * Evaluate a proposed action against a mandate.
 *
 * Checks short-circuit on the first failure, in this order:
 *   1. tool not in allowedTools or escalateTools -> DENY
 *   2. amountPaise above maxAmountPaise          -> DENY
 *   3. payeeVpa present but not allowlisted      -> DENY
 *   4. tool listed in escalateTools              -> ESCALATE
 *   5. otherwise                                 -> ALLOW
 *
 * `reasons` is populated even on ALLOW so the UI can show why something passed.
 *
 * @returns {{ verdict: string, reasons: string[], checks: object }}
 */
export function evaluatePolicy(action, mandate) {
  const reasons = [];
  const checks = {
    toolAllowed: null,
    withinCeiling: null,
    payeeAllowed: null,
    requiresSignoff: null,
  };

  const allowedTools = mandate?.allowedTools ?? [];
  const escalateTools = mandate?.escalateTools ?? [];
  const allowedPayees = mandate?.allowedPayeeVpas ?? [];
  const ceiling = Number(mandate?.maxAmountPaise ?? 0);

  const tool = typeof action?.tool === "string" ? action.tool : null;
  const amount = Number(action?.amountPaise ?? 0);
  const payee = action?.payeeVpa || null;

  // Reasons are shown on screen, so they are written for the business owner —
  // no "allowlist", no "mandate", no tool method names on their own.
  const label = toolLabel(tool);

  // 1. Permitted actions. An action outside the list is the clearest possible
  //    signal that the assistant is doing something never authorised.
  const knownTools = new Set([...allowedTools, ...escalateTools]);
  if (!tool || !knownTools.has(tool)) {
    checks.toolAllowed = false;
    const permitted = [...knownTools].map(toolLabel).join(", ") || "nothing";
    reasons.push(
      `"${label}" is not something you allowed. You allowed: ${permitted}.`
    );
    return { verdict: DENY, reasons, checks };
  }
  checks.toolAllowed = true;
  reasons.push(`"${label}" is something you allowed.`);

  // 2. Amount limit.
  if (amount > ceiling) {
    checks.withinCeiling = false;
    const multiple = ceiling > 0 ? amount / ceiling : Infinity;
    reasons.push(
      `${formatPaise(amount)} is ${formatMultiple(multiple)} your ${formatPaise(ceiling)} limit.`
    );
    return { verdict: DENY, reasons, checks };
  }
  checks.withinCeiling = true;
  reasons.push(`${formatPaise(amount)} is within your ${formatPaise(ceiling)} limit.`);

  // 3. Approved destinations — only applies when the action names one.
  if (payee) {
    if (!allowedPayees.includes(payee)) {
      checks.payeeAllowed = false;
      reasons.push(`${payee} is not one of the accounts you approved.`);
      return { verdict: DENY, reasons, checks };
    }
    checks.payeeAllowed = true;
    reasons.push(`${payee} is an account you approved.`);
  }

  // 4. Actions the owner always wants to approve personally.
  if (escalateTools.includes(tool)) {
    checks.requiresSignoff = true;
    reasons.push(`You asked to approve every "${label}" yourself.`);
    return { verdict: ESCALATE, reasons, checks };
  }
  checks.requiresSignoff = false;

  // 5. Clean.
  reasons.push("Within everything you allowed.");
  return { verdict: ALLOW, reasons, checks };
}
