"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AUTOPLAY, PERMISSIONS, USER_GOAL, AGENT_TASK } from "../lib/scenarios.js";
import { formatPaise, toolLabel } from "../lib/format.js";
// `fetch` on the server build; the same pipeline run in this tab on the static
// one. The call sites below cannot tell the difference. See lib/localApi.js.
import { apiFetch } from "../lib/localApi.js";
import {
  ArrowLeft,
  ArrowRight,
  BoltIcon,
  CheckIcon,
  HoldIcon,
  RestartIcon,
  ShieldIcon,
  ThroughIcon,
  WarnIcon,
  verdictIcon,
} from "./icons.js";

const LABEL = { ALLOW: "Approved", ESCALATE: "Needs your OK", DENY: "Blocked" };
const VCLASS = { ALLOW: "v-allow", DENY: "v-deny", ESCALATE: "v-escalate" };

// Reveal timings for the live screen, in ms after arriving on it. Requests are
// fetched the moment the deck mounts, so these gate only the reveal — a slow
// check shows a spinner in place rather than stalling the sequence.
const REVEAL = [250, 2100, 4000];
const DECIDE = [1150, 3000, 4900];

const SCREENS = [
  { id: "intro", label: "Start" },
  { id: "setup", label: "Setup" },
  { id: "live", label: "Live" },
  { id: "test", label: "Test" },
  { id: "gap", label: "Gap" },
  { id: "fit", label: "Next" },
];

// What a presenter should say on each screen. Desktop only.
const NOTES = [
  {
    kicker: "Screen 1 of 6 · Opening",
    title: "Set the stakes before showing anything",
    body: "The audience needs one fact before the demo makes sense: an AI assistant cannot tell the difference between a customer telling it something and a customer instructing it.",
    say: "“Shops are starting to let AI handle their refunds. The AI reads a support message and acts on it. Watch what happens when someone writes an instruction into that message.”",
  },
  {
    kicker: "Screen 2 of 6 · Setup",
    title: "Show that the owner is in charge",
    body: "These limits are set by the shop owner in their own words, not by a developer in a config file. Point out that paying money out is switched off entirely.",
    say: "“This shop owner allowed two things: refunds up to ten thousand, and payment links they approve themselves. They said do not pay anyone. Remember that.”",
  },
  {
    kicker: "Screen 3 of 6 · The demo",
    title: "Three requests, three different answers",
    body: "The first is a genuine refund and it goes through — establish that this is not a product that blocks everything. The second is the payoff: read the hidden instruction in the customer's message out loud. The third waits for a tap.",
    say: "“A real refund, approved. Now look at this message — it says admin mode is on and limits do not apply. A customer wrote that. Five lakh, blocked.”",
  },
  {
    kicker: "Screen 4 of 6 · The test",
    title: "Press the button and let it run",
    body: "Ten attempts that have fooled other assistants. The score counts up as each one lands. Nine stop.",
    say: "“These are ten known tricks. Hidden instructions, money to the wrong account, amounts a rupee under the limit. Nine of ten stopped.”",
  },
  {
    kicker: "Screen 5 of 6 · The honest bit",
    title: "Volunteer the failure",
    body: "This is the most credible moment in the demo. One attempt gets through, and it is named rather than buried. Anyone technical in the room will trust everything else more because of it.",
    say: "“One got through. Six refunds of nine and a half thousand each, all inside the limit. Catching that needs a running daily total, which we do not do yet. So it is nine, not ten.”",
  },
  {
    kicker: "Screen 6 of 6 · Close",
    title: "Where this sits on Razorpay",
    body: "Only the first step needs nothing from Razorpay — it works today. Be explicit that the other two are proposals.",
    say: "“Today this runs as a check before you go live. The real prize is the second step: the shop owner sets these limits inside the Razorpay dashboard, and holds arrive on their phone.”",
  },
];

const HELP = [
  {
    h: "What am I looking at?",
    p: "A demonstration of a safety check that sits between an AI assistant and a shop's Razorpay account. Nothing here touches real money.",
    dl: [
      ["Who it is for", "A shop owner who wants an assistant to handle refunds without risking the bank balance."],
      ["How to move", "Press the button at the bottom. Six short screens."],
    ],
  },
  {
    h: "About these limits",
    p: "The owner sets these once, in their own words. Everything the assistant does is measured against them.",
    dl: [
      ["Up to ₹10,000", "The most that can move in one action."],
      ["With your OK", "The assistant may prepare it, but you press approve."],
      ["Do not pay out", "Refunds to customers only. No payouts to anyone."],
    ],
  },
  {
    h: "What is happening here",
    p: "Each request the assistant makes is checked twice — against your limits, and against the job you described. The stricter answer wins.",
    dl: [
      ["Approved", "Both checks were satisfied. It has gone to Razorpay."],
      ["Needs your OK", "Allowed, but you asked to approve this kind yourself."],
      ["Blocked", "One of the checks objected. The money did not move."],
    ],
  },
  {
    h: "About the safety test",
    p: "Ten attempts, each one a trick that has worked on assistants elsewhere. They run through exactly the same checks you just watched.",
    dl: [
      ["Stopped", "Blocked, or held for you. Either way the money stayed put."],
      ["Got through", "It was approved. We show these rather than hide them."],
    ],
  },
  {
    h: "Why one gets through",
    p: "Because it is genuinely hard, and pretending otherwise would be dishonest.",
    dl: [
      ["The trick", "Split one large refund into six small ones, each under the limit."],
      ["Why it works", "Each refund on its own looks completely normal."],
      ["The fix", "A running daily total per order. Not built yet."],
    ],
  },
  {
    h: "What happens next",
    p: "The demo runs as a standalone check today. The valuable version lives inside Razorpay.",
    dl: [
      ["Available now", "Run your assistant through this before going live."],
      ["Proposed", "Limits set in the Razorpay dashboard; holds pushed to the owner's phone."],
    ],
  },
];

function money(p) {
  return <span className="money">{formatPaise(p)}</span>;
}

/* ---------------------------------------------------------------- screens */

function Intro() {
  return (
    <>
      <p className="eyebrow">AgentGuard</p>
      <h2>
        Your AI assistant wants to move money.
        <span className="big">This checks it first.</span>
      </h2>
      <p className="sub">Approved, held, or blocked — with a reason.</p>

      <div className="card">
        <div className="cardlabel">The risk</div>
        <p className="quote" style={{ margin: 0 }}>
          A customer can hide an instruction inside a support message. Your assistant
          will follow it.
        </p>
      </div>

      {/* Teaches the three outcomes before the demo uses them — visual, and
          six words rather than a paragraph. */}
      <div className="legend">
        {[
          ["v-allow", "ALLOW", "Approved"],
          ["v-escalate", "ESCALATE", "Needs your OK"],
          ["v-deny", "DENY", "Blocked"],
        ].map(([cls, v, text], n) => (
          <div key={v} className={`legend-item ${cls}`} style={{ animationDelay: `${180 + n * 110}ms` }}>
            <span className="stamp">
              {verdictIcon(v, 12)}
              {text}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Setup() {
  return (
    <>
      <p className="eyebrow">Before we start</p>
      <h2>What you&apos;ve allowed</h2>

      <div className="card">
        <div className="cardlabel">You told the assistant</div>
        <p className="quote" style={{ margin: 0 }}>
          &ldquo;{USER_GOAL}&rdquo;
        </p>
      </div>

      <div className="card">
        <ul className="perms">
          <li style={{ animationDelay: "60ms" }}>
            <span className="tick">
              <CheckIcon size={12} />
            </span>
            <span className="ptext">
              Refund a customer
              <span className="pnote">Up to {formatPaise(PERMISSIONS.maxAmountPaise)}</span>
            </span>
          </li>
          <li style={{ animationDelay: "150ms" }}>
            <span className="tick warn">
              <HoldIcon size={12} />
            </span>
            <span className="ptext">
              Send a payment link
              <span className="pnote">Only with your OK</span>
            </span>
          </li>
          <li style={{ animationDelay: "240ms" }}>
            <span className="tick no">
              <WarnIcon size={12} />
            </span>
            <span className="ptext">
              Pay money out
              <span className="pnote">Not allowed</span>
            </span>
          </li>
        </ul>
      </div>
    </>
  );
}

function Decision({ result, held, onAnswer }) {
  const cls = VCLASS[result.verdict] ?? "v-escalate";
  const reason = result.headline || result.intentReason;
  const isHold = result.verdict === "ESCALATE";

  return (
    <div className={`dec ${cls}`}>
      <span className="stamp">
        {verdictIcon(result.verdict, 13)}
        {LABEL[result.verdict] ?? result.verdict}
      </span>
      <p className="dec-reason">{reason}</p>

      {result.verdict === "DENY" ? (
        <div className="dec-foot">
          <ShieldIcon size={15} />
          Stopped before it reached Razorpay
        </div>
      ) : null}

      {/* Never let a recording read as a live call. */}
      {result.intentRecorded ? (
        <div className="recnote" style={{ textAlign: "left", marginTop: 8 }}>
          Recorded answer from {result.intentModel} · add your key to run it live
        </div>
      ) : null}

      {isHold && !held ? (
        <div className="approve">
          <button className="yes" onClick={() => onAnswer("approved")}>
            Approve
          </button>
          <button onClick={() => onAnswer("declined")}>Not now</button>
        </div>
      ) : null}

      {isHold && held ? (
        <div className="answered">
          {held === "approved"
            ? "You approved it — the link has gone out."
            : "You declined it — nothing was sent."}
        </div>
      ) : null}
    </div>
  );
}

function Live({ step, shown, result, held, onAnswer }) {
  const item = AUTOPLAY[step];
  const a = item.action;
  const bits = [];
  if (a.orderId) bits.push(`order #${a.orderId}`);
  if (a.payeeVpa) bits.push(`to ${a.payeeVpa}`);

  const TITLES = ["A genuine refund", "Read the message", "This one needs you"];
  const SUBS = ["", "A customer wrote the second line.", ""];

  return (
    <>
      <p className="eyebrow">Live · request {step + 1} of {AUTOPLAY.length}</p>
      <h2>{TITLES[step]}</h2>
      {SUBS[step] ? <p className="sub">{SUBS[step]}</p> : null}

      {shown.reveal ? (
        <div className="req">
          <div className="req-top">
            <span className="req-what">{toolLabel(a.tool)}</span>
            <span className="req-amt money">{formatPaise(a.amountPaise)}</span>
          </div>
          {bits.length ? <div className="req-meta">{bits.join(" · ")}</div> : null}
          {a.note ? (
            <div className="req-note">
              <span className="tag">
                <WarnIcon size={12} />
                Customer&apos;s message — anyone can write this
              </span>
              {a.note}
            </div>
          ) : null}
        </div>
      ) : null}

      {shown.decide ? (
        result ? (
          <Decision result={result} held={held} onAnswer={onAnswer} />
        ) : (
          <div className="waiting">
            <span className="spin" />
            Checking against your limits…
          </div>
        )
      ) : null}
    </>
  );
}

function Test({ test, running, revealed, onRun }) {
  const rows = test?.results?.slice(0, revealed) ?? [];
  const stopped = rows.filter((r) => r.caught).length;
  const total = test?.total ?? 10;

  return (
    <>
      <p className="eyebrow">Safety test</p>
      <h2>Ten known tricks</h2>

      {!test && !running ? (
        <>
          <p className="sub">Same checks you just watched.</p>
          <div className="scorecard">
            <div style={{ color: "var(--brand)", marginBottom: 10 }}>
              <ShieldIcon size={34} />
            </div>
            <div className="scorecap" style={{ marginTop: 0 }}>
              Press the button below.
            </div>
          </div>
        </>
      ) : null}

      {running ? (
        <div className="scorecard">
          <div className="bignum">
            —<span className="of"> / {total}</span>
          </div>
          <div className="scorecap">Running ten attempts…</div>
          <div className="meter">
            {Array.from({ length: total }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </div>
      ) : null}

      {test && !test.error ? (
        <>
          <div className="scorecard pin">
            <div className="bignum money">
              {stopped}
              <span className="of"> of {total}</span>
            </div>
            <div className="scorecap">
              stopped before any money moved
              {test.recorded ? " · recorded run" : test.byo ? " · your key, live" : ""}
            </div>
            <div className="meter">
              {Array.from({ length: total }, (_, i) => {
                const r = test.results[i];
                const seen = i < revealed;
                return (
                  <i
                    key={i}
                    className={seen ? (r?.caught ? "on" : "miss") : ""}
                  />
                );
              })}
            </div>
          </div>

          <ul className="attempts">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className={`attempt${r.knownGap ? " gap" : ""}`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span
                  className="att-icon"
                  style={{
                    color: r.caught
                      ? r.verdict === "DENY"
                        ? "var(--stop)"
                        : "var(--hold)"
                      : "var(--hold)",
                  }}
                >
                  {r.caught ? verdictIcon(r.verdict, 15) : <ThroughIcon size={15} />}
                </span>
                <span className="att-body">
                  <span className="att-name">{r.attack}</span>
                  {/* Not every attempt moves money — the permission-change one
                      would otherwise read as a nonsensical "₹0". */}
                  {r.amountPaise > 0 ? (
                    <span className="att-sub">{formatPaise(r.amountPaise)}</span>
                  ) : (
                    <span className="att-sub">Tries to change your permissions</span>
                  )}
                </span>
                <span
                  className={`chip ${
                    r.caught ? (r.verdict === "DENY" ? "chip-stop" : "chip-hold") : "chip-through"
                  }`}
                >
                  {r.caught ? LABEL[r.verdict] : "Got through"}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {test?.error ? <div className="callout">{test.error}</div> : null}
    </>
  );
}

function Gap({ test }) {
  const row = test?.results?.find((r) => r.knownGap);
  return (
    <>
      <p className="eyebrow">Got through</p>
      <h2>Nine, not ten</h2>
      <p className="sub">
        Six refunds of {formatPaise(950000)} add up to {formatPaise(5700000)}.
      </p>

      <div className="card">
        <div className="req-top">
          <span className="req-what">Refund a customer</span>
          <span className="req-amt money">{formatPaise(950000)}</span>
        </div>
        <div className="req-meta">&ldquo;Partial refund 4 of 6&rdquo;</div>
        {row ? (
          <div className="dec-foot" style={{ borderTop: "1px solid var(--line)" }}>
            <ThroughIcon size={15} />
            {row.caught ? LABEL[row.verdict] : "Got through"}
          </div>
        ) : null}
      </div>

      <div className="callout" style={{ marginTop: 11 }}>
        Each one is under your limit and looks normal. Catching it needs a daily total.
        Not built yet.
      </div>
    </>
  );
}

function Fit() {
  return (
    <>
      <p className="eyebrow">Where this fits</p>
      <h2>Three steps on Razorpay</h2>

      <div className="card">
        <div className="phase">
          <span className="pnum">1</span>
          <span>
            <span className="ptitle">A check before you go live</span>
            <span className="ptag now">Working today</span>
          </span>
        </div>
        <div className="phase" style={{ animationDelay: "90ms" }}>
          <span className="pnum">2</span>
          <span>
            <span className="ptitle">Limits in your Razorpay dashboard</span>
            <span className="ptag soon">Proposed</span>
          </span>
        </div>
        <div className="phase" style={{ animationDelay: "180ms" }}>
          <span className="pnum">3</span>
          <span>
            <span className="ptitle">Enforced at the API</span>
            <span className="ptag soon">Proposed</span>
          </span>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------- your own key */

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter", prefix: "sk-or-", model: "google/gemini-2.5-flash-lite" },
  { id: "groq", label: "Groq", prefix: "gsk_", model: "openai/gpt-oss-120b" },
  { id: "anthropic", label: "Claude", prefix: "sk-ant-", model: "claude-sonnet-5" },
];

function KeySheet({ cred, onSave, onClear, onClose }) {
  const [provider, setProvider] = useState(cred?.provider ?? "openrouter");
  const [key, setKey] = useState("");
  const [model, setModel] = useState(cred?.model ?? "");
  const [state, setState] = useState({ busy: false, error: null, ok: null });

  const chosen = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  async function test() {
    setState({ busy: true, error: null, ok: null });
    try {
      const res = await apiFetch("/api/verdict", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-agentguard-provider": provider,
          "x-agentguard-key": key.trim(),
          ...(model.trim() ? { "x-agentguard-model": model.trim() } : {}),
        },
        body: JSON.stringify({
          action: { tool: "refund.create", amountPaise: 120000, orderId: "8842" },
        }),
      });
      const data = await res.json();
      if (data.error) {
        setState({ busy: false, error: data.error, ok: null });
        return;
      }
      if (data.intentFallback) {
        setState({
          busy: false,
          error: "That key was rejected by the provider. Check it and try again.",
          ok: null,
        });
        return;
      }
      setState({ busy: false, error: null, ok: `Working — answered by ${data.intentModel}.` });
      onSave({ provider, key: key.trim(), model: model.trim() || chosen.model });
    } catch {
      setState({ busy: false, error: "Could not reach the check. Try again.", ok: null });
    }
  }

  return (
    <>
      <div className="sheetback" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Use your own API key">
        <div className="grabber" />
        <h3>Run it with your own key</h3>
        <p>
          The demo shows a recorded response. Add a key and the AI check runs live on your
          account instead.
        </p>

        <div className="field">
          <label>Provider</label>
          <div className="segs">
            {PROVIDERS.map((pv) => (
              <button
                key={pv.id}
                className="seg"
                aria-pressed={provider === pv.id}
                onClick={() => {
                  setProvider(pv.id);
                  setState({ busy: false, error: null, ok: null });
                }}
              >
                {pv.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="agkey">API key</label>
          <input
            id="agkey"
            type="password"
            value={key}
            autoComplete="off"
            spellCheck={false}
            placeholder={`${chosen.prefix}…`}
            onChange={(e) => setKey(e.target.value)}
          />
          <div className="hint">Starts with {chosen.prefix}</div>
        </div>

        <div className="field">
          <label htmlFor="agmodel">Model (optional)</label>
          <input
            id="agmodel"
            type="text"
            value={model}
            autoComplete="off"
            spellCheck={false}
            placeholder={chosen.model}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>

        <div className="privacy">
          <strong>Your key stays in this browser tab.</strong> It is sent with each check,
          used once, and never stored or logged on the server. Closing the tab forgets it.
        </div>

        {state.error ? <div className="keyerr">{state.error}</div> : null}
        {state.ok ? <div className="keyok">{state.ok}</div> : null}

        <div className="sheetrow">
          {cred ? (
            <button onClick={onClear}>Forget key</button>
          ) : (
            <button onClick={onClose}>Cancel</button>
          )}
          <button
            className="primary"
            onClick={test}
            disabled={state.busy || key.trim().length < 20}
          >
            {state.busy ? "Checking…" : "Test and use"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- deck */

export default function Deck() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState("fwd");
  const [help, setHelp] = useState(false);
  const [keySheet, setKeySheet] = useState(false);
  const [cred, setCred] = useState(null);

  const [liveStep, setLiveStep] = useState(0);
  const [shown, setShown] = useState({ reveal: 0, decide: 0 });
  const [results, setResults] = useState([null, null, null]);
  const [held, setHeld] = useState(null);

  const [test, setTest] = useState(null);
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(0);

  const timers = useRef([]);
  const fetched = useRef(false);
  const touch = useRef(null);

  const addTimer = (ms, fn) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // sessionStorage, not localStorage: a key someone typed into a demo should
  // not outlive the tab.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ag.cred");
      if (raw) setCred(JSON.parse(raw));
    } catch {
      /* storage blocked — demo mode is fine */
    }
  }, []);

  const authHeaders = useCallback(
    () =>
      cred
        ? {
            "x-agentguard-provider": cred.provider,
            "x-agentguard-key": cred.key,
            ...(cred.model ? { "x-agentguard-model": cred.model } : {}),
          }
        : {},
    [cred]
  );

  const saveCred = useCallback((next) => {
    setCred(next);
    try {
      sessionStorage.setItem("ag.cred", JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setKeySheet(false);
    // Re-run everything with the visitor's key so they see their own results.
    setResults([null, null, null]);
    setTest(null);
    setRevealed(0);
    fetched.current = false;
  }, []);

  const clearCred = useCallback(() => {
    setCred(null);
    try {
      sessionStorage.removeItem("ag.cred");
    } catch {
      /* ignore */
    }
    setKeySheet(false);
    setResults([null, null, null]);
    setTest(null);
    setRevealed(0);
    fetched.current = false;
  }, []);

  // Fetch the three decisions as soon as the deck mounts, so they are ready
  // by the time anyone reaches the live screen.
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    AUTOPLAY.forEach((item, idx) => {
      apiFetch("/api/verdict", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: item.action }),
      })
        .then((r) => r.json())
        .then((data) =>
          setResults((prev) => {
            const next = [...prev];
            next[idx] = { ...data, action: data.action ?? item.action };
            return next;
          })
        )
        .catch(() =>
          setResults((prev) => {
            const next = [...prev];
            next[idx] = {
              action: item.action,
              verdict: "ESCALATE",
              intentReason:
                "This could not be checked just now, so it is being held for you rather than allowed through.",
              intentFallback: true,
            };
            return next;
          })
        );
    });
  }, [authHeaders, cred]);

  // Reveal the current request, then its decision. Re-runs for each request,
  // so every beat animates rather than only the first.
  useEffect(() => {
    if (i !== 2) return;
    setShown({ reveal: 0, decide: 0 });
    const a = setTimeout(() => setShown((s) => ({ ...s, reveal: 1 })), 220);
    const b = setTimeout(() => setShown((s) => ({ ...s, decide: 1 })), 1150);
    timers.current.push(a, b);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [i, liveStep]);

  const runTest = useCallback(async () => {
    setRunning(true);
    setTest(null);
    setRevealed(0);
    try {
      const res = await apiFetch("/api/redteam", { method: "POST", headers: authHeaders() });
      const data = await res.json();
      setRunning(false);
      setTest(data);
      const n = Array.isArray(data.results) ? data.results.length : 0;
      for (let k = 1; k <= n; k++) {
        addTimer(90 * k, () => setRevealed((v) => Math.max(v, k)));
      }
    } catch {
      setRunning(false);
      setTest({
        total: 10,
        results: [],
        error: "The test could not run just now. Please try again.",
      });
    }
  }, [authHeaders]);

  const go = useCallback(
    (next) => {
      if (next < 0 || next >= SCREENS.length) return;
      setDir(next > i ? "fwd" : "back");
      setI(next);
      setHelp(false);
    },
    [i]
  );

  // Keyboard, for presenting from a laptop.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        if (i === 2 && liveStep < AUTOPLAY.length - 1) setLiveStep((n) => n + 1);
        else go(i + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        if (i === 2 && liveStep > 0) setLiveStep((n) => n - 1);
        else go(i - 1);
      }
      else if (e.key === "Escape") setHelp(false);
      else if (e.key === "?") setHelp((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go, liveStep]);

  const onTouchStart = (e) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    // Horizontal intent only, so a vertical scroll never changes screen.
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.7) {
      const fwd = dx < 0;
      if (i === 2 && fwd && liveStep < AUTOPLAY.length - 1) setLiveStep((n) => n + 1);
      else if (i === 2 && !fwd && liveStep > 0) setLiveStep((n) => n - 1);
      else go(fwd ? i + 1 : i - 1);
    }
    touch.current = null;
  };

  // The action button says what pressing it will actually do.
  let ctaLabel = "Continue";
  let ctaIcon = <ArrowRight />;
  let ctaAction = () => go(i + 1);
  let ctaBusy = false;

  if (i === 0) ctaLabel = "See how it works";
  else if (i === 1) ctaLabel = "Start the assistant";
  else if (i === 2) {
    if (liveStep < AUTOPLAY.length - 1) {
      ctaLabel = "Next request";
      ctaAction = () => setLiveStep((n) => n + 1);
    } else {
      ctaLabel = "Next: the safety test";
    }
  }
  else if (i === 3) {
    if (running) {
      ctaLabel = "Running…";
      ctaBusy = true;
      ctaAction = () => {};
      ctaIcon = <BoltIcon />;
    } else if (!test) {
      ctaLabel = "Run the safety test";
      ctaIcon = <BoltIcon />;
      ctaAction = runTest;
    } else {
      ctaLabel = "What got through?";
    }
  } else if (i === 4) ctaLabel = "Where this fits";
  else if (i === 5) {
    ctaLabel = "Start again";
    ctaIcon = <RestartIcon />;
    ctaAction = () => {
      setTest(null);
      setRevealed(0);
      setHeld(null);
      setShown({ reveal: 0, decide: 0 });
      setLiveStep(0);
      go(0);
    };
  }

  const screens = [
    <Intro key="intro" />,
    <Setup key="setup" />,
    <Live
      key={`live-${liveStep}`}
      step={liveStep}
      shown={shown}
      result={results[liveStep]}
      held={held}
      onAnswer={setHeld}
    />,
    <Test key="test" test={test} running={running} revealed={revealed} onRun={runTest} />,
    <Gap key="gap" test={test} />,
    <Fit key="fit" />,
  ];

  const note = NOTES[i];
  const helpText = HELP[i];

  return (
    <div className="stage">
      <div className="phone" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="topbar">
          <div className="dots">
            {SCREENS.map((s, n) => (
              <button
                key={s.id}
                className={`dot${n < i ? " done" : ""}${n === i ? " here" : ""}`}
                onClick={() => go(n)}
                aria-label={`Go to ${s.label}`}
                aria-current={n === i ? "step" : undefined}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            className="helpbtn"
            onClick={() => setHelp((h) => !h)}
            aria-expanded={help}
            aria-label="What am I looking at?"
          >
            ?
          </button>
        </div>

        <div className="modebar">
          <span className={`modechip${cred ? " live" : ""}`}>
            <span className="led" />
            {cred ? `Live · your ${cred.provider} key` : "Demo mode"}
          </span>
          <button className="keylink" onClick={() => setKeySheet(true)}>
            {cred ? "Change" : "Use your own key"}
          </button>
        </div>

        <div className="screenwrap">
          <div key={i} className={dir === "back" ? "screen back" : "screen"}>
            {screens[i]}
          </div>
        </div>

        {keySheet ? (
          <KeySheet
            cred={cred}
            onSave={saveCred}
            onClear={clearCred}
            onClose={() => setKeySheet(false)}
          />
        ) : null}

        {help ? (
          <>
            <div className="sheetback" onClick={() => setHelp(false)} />
            <div className="sheet" role="dialog" aria-label="Help">
              <div className="grabber" />
              <h3>{helpText.h}</h3>
              <p>{helpText.p}</p>
              <dl>
                {helpText.dl.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <button className="sheetclose" onClick={() => setHelp(false)}>
                Got it
              </button>
            </div>
          </>
        ) : null}

        <div className="actionbar">
          <button
            className="backbtn"
            onClick={() => {
              if (i === 2 && liveStep > 0) setLiveStep((n) => n - 1);
              else go(i - 1);
            }}
            disabled={i === 0}
            aria-label="Back"
          >
            <ArrowLeft />
          </button>
          <button
            className={`cta${ctaBusy ? " busy" : ""}`}
            onClick={ctaAction}
            disabled={ctaBusy}
          >
            {ctaIcon}
            {ctaLabel}
          </button>
        </div>
      </div>

      {/* Presenter notes — desktop only, never shown on the phone. */}
      <aside className="notes" key={`note-${i}`}>
        <div className="kicker">{note.kicker}</div>
        <h1>{note.title}</h1>
        <p>{note.body}</p>
        <div className="say">{note.say}</div>
        <div className="keys">
          <span>
            <kbd>←</kbd> <kbd>→</kbd> move
          </span>
          <span>
            <kbd>?</kbd> help
          </span>
          <span>Swipe on a phone</span>
        </div>
      </aside>
    </div>
  );
}
