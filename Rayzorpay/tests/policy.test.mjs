import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOW,
  DENY,
  ESCALATE,
  combineVerdicts,
  evaluatePolicy,
} from "../lib/policy.js";
import { formatMultiple, formatPaise } from "../lib/format.js";

const MANDATE = {
  maxAmountPaise: 1000000, // ₹10,000
  allowedTools: ["refund.create", "link.create"],
  allowedPayeeVpas: ["merchant@okhdfc"],
  escalateTools: ["link.create"],
};

test("small refund within every limit -> ALLOW", () => {
  const r = evaluatePolicy(
    { tool: "refund.create", amountPaise: 120000, orderId: "8842" },
    MANDATE
  );
  assert.equal(r.verdict, ALLOW);
  assert.equal(r.checks.toolAllowed, true);
  assert.equal(r.checks.withinCeiling, true);
  // reasons are populated on ALLOW too, so the UI can show why it passed
  assert.ok(r.reasons.length >= 3);
});

test("amount over the ceiling -> DENY, and the reason states the multiple", () => {
  const r = evaluatePolicy(
    { tool: "refund.create", amountPaise: 50000000 }, // ₹5,00,000 vs ₹10,000
    MANDATE
  );
  assert.equal(r.verdict, DENY);
  assert.equal(r.checks.withinCeiling, false);
  assert.ok(r.reasons.some((x) => x.includes("50×")), r.reasons.join(" | "));
});

test("tool outside the mandate -> DENY", () => {
  const r = evaluatePolicy(
    { tool: "internal.transfer", amountPaise: 100 },
    MANDATE
  );
  assert.equal(r.verdict, DENY);
  assert.equal(r.checks.toolAllowed, false);
});

test("missing tool -> DENY (no crash on a malformed action)", () => {
  const r = evaluatePolicy({ amountPaise: 100 }, MANDATE);
  assert.equal(r.verdict, DENY);
});

test("payee not on the allowlist -> DENY even when the amount is tiny", () => {
  const r = evaluatePolicy(
    { tool: "refund.create", amountPaise: 999900, payeeVpa: "x9f-collect@ybl" },
    MANDATE
  );
  assert.equal(r.verdict, DENY);
  assert.equal(r.checks.payeeAllowed, false);
});

test("allowlisted payee passes the payee check", () => {
  const r = evaluatePolicy(
    { tool: "refund.create", amountPaise: 100000, payeeVpa: "merchant@okhdfc" },
    MANDATE
  );
  assert.equal(r.verdict, ALLOW);
  assert.equal(r.checks.payeeAllowed, true);
});

test("tool listed in escalateTools -> ESCALATE", () => {
  const r = evaluatePolicy(
    { tool: "link.create", amountPaise: 349900, orderId: "INV-207" },
    MANDATE
  );
  assert.equal(r.verdict, ESCALATE);
  assert.equal(r.checks.requiresSignoff, true);
});

test("ceiling is checked before the payee, so an over-limit bad payee reads as over-limit", () => {
  const r = evaluatePolicy(
    { tool: "refund.create", amountPaise: 50000000, payeeVpa: "x9f-collect@ybl" },
    MANDATE
  );
  assert.equal(r.verdict, DENY);
  assert.equal(r.checks.withinCeiling, false);
  assert.equal(r.checks.payeeAllowed, null); // short-circuited before it ran
});

test("exactly at the ceiling is allowed; one paise over is not", () => {
  assert.equal(
    evaluatePolicy({ tool: "refund.create", amountPaise: 1000000 }, MANDATE).verdict,
    ALLOW
  );
  assert.equal(
    evaluatePolicy({ tool: "refund.create", amountPaise: 1000001 }, MANDATE).verdict,
    DENY
  );
});

// --- stricter-wins: the safety property the whole product rests on -----------

test("combineVerdicts: stricter always wins", () => {
  assert.equal(combineVerdicts(ALLOW, ALLOW), ALLOW);
  assert.equal(combineVerdicts(ALLOW, ESCALATE), ESCALATE);
  assert.equal(combineVerdicts(ESCALATE, ALLOW), ESCALATE);
  assert.equal(combineVerdicts(ALLOW, DENY), DENY);
  assert.equal(combineVerdicts(DENY, ALLOW), DENY);
  assert.equal(combineVerdicts(ESCALATE, DENY), DENY);
  assert.equal(combineVerdicts(DENY, ESCALATE), DENY);
});

test("combineVerdicts: a rule ALLOW can never override an intent DENY", () => {
  const rules = evaluatePolicy(
    { tool: "refund.create", amountPaise: 999900 },
    MANDATE
  );
  assert.equal(rules.verdict, ALLOW);
  assert.equal(combineVerdicts(rules.verdict, DENY), DENY);
});

test("combineVerdicts ignores junk instead of throwing", () => {
  assert.equal(combineVerdicts(ALLOW, undefined, null, "MAYBE"), ALLOW);
  assert.equal(combineVerdicts(undefined, DENY), DENY);
  assert.equal(combineVerdicts(), ALLOW);
});

// --- display formatting ------------------------------------------------------

test("money renders as Indian-grouped rupees", () => {
  assert.equal(formatPaise(50000000), "₹5,00,000");
  assert.equal(formatPaise(1000000), "₹10,000");
  assert.equal(formatPaise(120000), "₹1,200");
  assert.equal(formatPaise(349900), "₹3,499");
  assert.equal(formatPaise(999900), "₹9,999");
  assert.equal(formatPaise(12345), "₹123.45");
  assert.equal(formatPaise(0), "₹0");
});

test("multiples read like a human wrote them", () => {
  assert.equal(formatMultiple(50), "50×");
  assert.equal(formatMultiple(1.5), "1.5×");
  // No limit set at all — must not render "Infinity×" on screen.
  assert.equal(formatMultiple(Infinity), "far above");
});

test("reasons shown to the owner avoid internal vocabulary", () => {
  const banned = /mandate|allowlist|deterministic|policy engine|payee|tool "/i;
  const cases = [
    { tool: "refund.create", amountPaise: 120000 },
    { tool: "refund.create", amountPaise: 50000000 },
    { tool: "internal.transfer", amountPaise: 100 },
    { tool: "refund.create", amountPaise: 100, payeeVpa: "x9f-collect@ybl" },
    { tool: "link.create", amountPaise: 349900 },
  ];
  for (const action of cases) {
    for (const reason of evaluatePolicy(action, MANDATE).reasons) {
      assert.ok(!banned.test(reason), `internal wording leaked to the screen: "${reason}"`);
    }
  }
});

test("actions are named in words, not method names", () => {
  const r = evaluatePolicy({ tool: "internal.transfer", amountPaise: 100 }, MANDATE);
  assert.ok(
    r.reasons.some((x) => x.includes("Move money internally")),
    r.reasons.join(" | ")
  );
  assert.ok(!r.reasons.some((x) => x.includes("internal.transfer")), r.reasons.join(" | "));
});
