// The live model call cannot be exercised without a key, so the two pieces
// that decide what happens around it — response parsing and the fallback — are
// tested directly here.

import assert from "node:assert/strict";
import test from "node:test";

import { fallbackIntent, parseVerdictJson } from "../lib/intent.js";
import { ALLOW, DENY, ESCALATE } from "../lib/policy.js";
import { MANDATE } from "../lib/scenarios.js";

test("parses a clean JSON verdict", () => {
  const r = parseVerdictJson('{"verdict":"DENY","reason":"Not authorized.","confidence":0.93}');
  assert.deepEqual(r, { verdict: DENY, reason: "Not authorized.", confidence: 0.93 });
});

test("tolerates markdown fences", () => {
  const r = parseVerdictJson('```json\n{"verdict":"ALLOW","reason":"Fine.","confidence":0.8}\n```');
  assert.equal(r.verdict, ALLOW);
});

test("tolerates prose wrapped around the object", () => {
  const r = parseVerdictJson(
    'Here is my assessment:\n{"verdict":"ESCALATE","reason":"Needs a human.","confidence":0.6}\nHope that helps.'
  );
  assert.equal(r.verdict, ESCALATE);
  assert.equal(r.reason, "Needs a human.");
});

test("accepts a lowercase verdict", () => {
  assert.equal(parseVerdictJson('{"verdict":"deny","reason":"x","confidence":1}').verdict, DENY);
});

test("clamps confidence into 0..1 and defaults a missing one", () => {
  assert.equal(parseVerdictJson('{"verdict":"DENY","reason":"x","confidence":42}').confidence, 1);
  assert.equal(parseVerdictJson('{"verdict":"DENY","reason":"x","confidence":-3}').confidence, 0);
  assert.equal(parseVerdictJson('{"verdict":"DENY","reason":"x"}').confidence, 0.5);
});

test("rejects an unknown verdict rather than inventing one", () => {
  assert.equal(parseVerdictJson('{"verdict":"MAYBE","reason":"x","confidence":1}'), null);
});

test("returns null on junk instead of throwing", () => {
  assert.equal(parseVerdictJson(""), null);
  assert.equal(parseVerdictJson("not json at all"), null);
  assert.equal(parseVerdictJson(null), null);
  assert.equal(parseVerdictJson(undefined), null);
  assert.equal(parseVerdictJson("{unclosed"), null);
});

test("supplies a reason when the model omits one", () => {
  assert.equal(parseVerdictJson('{"verdict":"ALLOW","confidence":0.5}').reason, "No reason given.");
});

// --- fallback ---------------------------------------------------------------
// With no key at all the demo must still show a real ALLOW, DENY and ESCALATE.
// A fallback that denied everything would be safe and useless.

test("fallback DENIES money heading to an unapproved payee", () => {
  const r = fallbackIntent(
    { action: { tool: "refund.create", amountPaise: 100, payeeVpa: "x9f-collect@ybl" }, mandate: MANDATE },
    "no key"
  );
  assert.equal(r.verdict, DENY);
  assert.equal(r.fallback, true);
});

test("fallback ALLOWS an in-mandate action so the demo shows a real pass", () => {
  const r = fallbackIntent(
    { action: { tool: "refund.create", amountPaise: 120000 }, mandate: MANDATE },
    "no key"
  );
  assert.equal(r.verdict, ALLOW);
  assert.equal(r.fallback, true);
});

test("fallback ESCALATES anything it cannot place", () => {
  const unknownTool = fallbackIntent(
    { action: { tool: "internal.transfer", amountPaise: 100 }, mandate: MANDATE },
    "no key"
  );
  assert.equal(unknownTool.verdict, ESCALATE);

  const overCeiling = fallbackIntent(
    { action: { tool: "refund.create", amountPaise: 99999999 }, mandate: MANDATE },
    "no key"
  );
  assert.equal(overCeiling.verdict, ESCALATE);
});

test("fallback carries the reason it fell back, for the UI to surface", () => {
  const r = fallbackIntent(
    { action: { tool: "refund.create", amountPaise: 1 }, mandate: MANDATE },
    "verifier timed out after 12s"
  );
  assert.equal(r.fallbackNote, "verifier timed out after 12s");
});
