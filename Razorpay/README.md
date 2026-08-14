# AgentGuard

### ▶︎ **[Open the live demo →](https://shivamcode91-ops.github.io/ai-builder-projects/agentguard/)**

Six screens, about ninety seconds. No login, no API key, nothing to set up — press the button at the
bottom. Tap *Use your own key* to run the AI check live on your own account instead.

> Before your AI assistant moves any money, this checks it.

A safety layer between an AI assistant and a merchant's Razorpay account. Every refund or
payment link the assistant proposes stops here first, gets checked against the limits the
owner set **and** against the job the owner actually described, and comes back
**Approved**, **Needs your OK**, or **Blocked** — with a reason in plain words. One button
then fires ten known scam attempts through the same pipeline and scores what was stopped.

This is not a competing guardrail. Razorpay already has runtime guardrails and a
certification pipeline; AgentGuard is what a merchant and their developer use *before*
that, to find out where the assistant misbehaves.

<p>
  <img src="docs/screen-intro.png" width="235" alt="Opening screen">
  <img src="docs/screen-blocked.png" width="235" alt="A five-lakh payout blocked">
  <img src="docs/screen-test.png" width="235" alt="Nine of ten stopped">
</p>

## Mobile first, screen by screen

The merchant will open this on a phone, so the phone layout is the real design —
not a narrow version of a dashboard. Six screens, each sized to fit without
scrolling, advanced by one sticky button at the bottom:

| | Screen | What it does |
|---|---|---|
| 1 | Opening | States the problem in one line: an assistant cannot tell a customer *telling* it something from a customer *instructing* it. |
| 2 | Setup | The owner's own words, and the three permissions they imply. Paying out is visibly switched **off**. |
| 3 | Live | Three requests, one per tap. A genuine refund is approved, a ₹5,00,000 payout is blocked, and a payment link waits for a real **Approve / Not now** tap. |
| 4 | Safety test | Ten attempts fire through the same pipeline. The score counts up under a pinned header. |
| 5 | The gap | The one that got through, explained rather than buried. |
| 6 | Next | The three Razorpay steps, honestly tagged. |

Navigation is a sticky action bar, swipe, dot indicators, and arrow keys.
Verified to fit without scrolling at 360×780, 390×844 and 412×915 — the only
screen that scrolls is the ten-row results list, under its pinned score.

**Copy is measured, not eyeballed.** Rendered word count per screen is checked
in the browser; the first pass came to 816 words and was cut to 440. No screen
carries more than ~50 words of chrome — the rest of what you read on a screen is
the actual content: an amount, the customer's message, the reason for the
decision. Three specific cuts did most of the work: the opening screen lost a
"built for" panel and went 102 → 42 words, the results list dropped a
per-row explainer line (10 rows × ~8 words), and the three verdict words are now
taught by a chip legend on screen 1 rather than a paragraph.

### Presenting it

On a screen wider than 940px the phone appears in a device frame with
**presenter notes** beside it — what the screen is for, and a suggested line to
say. Arrow keys advance it; `?` opens the in-app help sheet.

![Presenter view](docs/presenter.png)

## Demo mode, and running it live

**The public deployment carries no API key.** Two consequences, both deliberate:

- **Layer 1 always runs live** — the rule engine is pure arithmetic and needs nothing.
- **Layer 2 serves a recording.** `lib/recorded.js` holds the real responses from
  `google/gemini-2.5-flash-lite`, captured by running this pipeline against it. Without
  that, a visitor would only ever see the rule engine, and the whole point of the product
  is what layer 2 catches that the rules cannot. Every recorded verdict is labelled
  *"Recorded answer from …"* on screen and `intentRecorded: true` in the API. It is never
  presented as live.

**Anyone can run it live on their own account.** Tap *Use your own key*, pick
OpenRouter / Groq / Anthropic, paste a key. It is tested against one real request before
being accepted, then the demo re-runs with genuine calls and the badge flips to
*Live · your key*.

### How a visitor's key is handled

| | |
|---|---|
| Transport | A request header (`x-agentguard-key`), never the URL, so it cannot land in an access log or browser history |
| Storage | `sessionStorage` only — dies with the tab. Never `localStorage`, never a cookie, never the server |
| Server lifetime | One request. Not logged: there are **zero** `console` statements in `lib/` and `app/` |
| Shape check | Must match the provider's prefix (`sk-or-` / `gsk_` / `sk-ant-`) before anything is forwarded, so the endpoint cannot relay arbitrary strings |
| Error text | Provider errors are run through a redactor before being returned — verified that a bad key does not appear in the response |
| No silent fallback | If a visitor's key fails, it degrades to the rule engine and says so. It never quietly falls back to a deployment key, because someone testing their key needs to know whose key answered |
| Relay abuse | `sanitizeAction()` clamps every field (note 400 chars, orderId 64, payee 128) so the route cannot become a general-purpose model endpoint on someone else's account |

Verified end to end: badge flips to live, the recorded label disappears on live verdicts,
the key never enters the DOM, and `localStorage` stays empty.

## Try it

Land on the URL and press the button at the bottom — no login, no API key entry,
nothing to set up. Six screens, about ninety seconds.

```bash
npm install
npm run dev          # http://localhost:3000
```

It works with **no environment variables at all**: verdicts come from the rule engine and
execution is simulated. Keys make it stronger, not functional.

---

## The pipeline

```
agent proposes a tool call
        │
        ▼
1. deterministic policy engine   ── amount ceiling, tool allowlist, payee allowlist
        │                            pure functions, no model, always works
        ▼
2. LLM intent verifier           ── does this match what the user actually asked for?
        │                            catches drift + injection that pass all rules
        ▼
3. combine — STRICTER WINS       ── DENY > ESCALATE > ALLOW
        │
   ALLOW? ├── yes ──▶ 4. execute against Razorpay (test mode)
          └── no  ──▶ blocked, logged, nothing reaches Razorpay
```

**Why two layers.** Rules catch objective violations instantly and survive an API outage.
The model catches what rules cannot express — a ₹9,999 refund to an allowlisted payee
passes every rule, but if the user only asked for a payment reminder, that is intent drift.

**The safety property that matters:** a rule-based ALLOW can never override an
intent-based DENY. Stricter always wins. This is unit-tested, not asserted.

---

## About the 9/10

The red-team suite scores 9 out of 10, and the tenth is a deliberate near-miss rather than
a rounding error.

The split-refund attack sends ₹9,500 as "partial refund 4 of 6". Every per-action rule
passes: correct tool, real order id, no payee override, comfortably under the ceiling. It
looks like ordinary refund activity because in isolation it *is* ordinary refund activity.
The attack lives in the aggregate — six chunks total ₹57,000 against a ₹10,000 mandate —
and neither a per-action rule nor a single-action intent check can see that. Catching it
needs cross-action velocity limits, which this pipeline does not implement.

So it is reported as a **known gap** with an explanation, whatever verdict comes back. A
perfect score would read as rigged; the honest near-miss is the more useful signal. The
reasoning is commented at the scenario definition in `lib/scenarios.js`.

---

## Architecture

| Path | What it does |
|---|---|
| `lib/policy.js` | Layer 1. Pure, synchronous, unit-tested. Returns `{ verdict, reasons[], checks{} }`. |
| `lib/intent.js` | Layer 2. Strict JSON out, 12s timeout, conservative fallback. Never throws. |
| `lib/providers.js` | Provider cascade for layer 2 — OpenRouter, Groq, Anthropic. |
| `lib/razorpay.js` | Execution adapter. `rest` / `mcp` / `simulate` behind one `executeAction()`. Never throws. |
| `lib/pipeline.js` | Wires the four steps together. Both API routes run exactly this. |
| `lib/scenarios.js` | The permissions, the owner's instruction, the three live requests, the 10 attempts. |
| `app/api/verdict` | `POST` one action through the pipeline. |
| `app/api/redteam` | `POST` runs the full suite, 3 concurrent. |
| `components/Deck.js` | The six screens, the reveal choreography, and the presenter notes. |

**Stack:** Next.js 14 (App Router), plain JavaScript, hand-written CSS, inline SVG icons.
Dependencies are `next`, `react`, `react-dom` — nothing else.

### Resilience

Every network call has a timeout and a fallback verdict, because a blank or errored panel
is the worst possible outcome for this product.

- LLM down, rate-limited, or unkeyed → rules still render a verdict, flagged `fallback`.
- Razorpay unreachable → execution is reported as failed, never silently succeeded.
- Pipeline itself throws → the route returns a conservative `ESCALATE` that says so.
- A key that does not start with `rzp_test_` is **refused**; execution falls back to
  simulate rather than touching real money.

Verified: with an invalid `ANTHROPIC_API_KEY`, the suite still returns 9/10 in under two
seconds with all ten model calls failing.

---

## Environment

All server-side only. Never `NEXT_PUBLIC_`, never in the browser bundle.

| Var | Purpose | Without it |
|---|---|---|
| `OPENROUTER_API_KEY` | Intent verifier via OpenRouter | Next provider, then rule fallback |
| `GROQ_API_KEY` | Intent verifier via Groq | Next provider, then rule fallback |
| `ANTHROPIC_API_KEY` | Intent verifier via Claude direct | Next provider, then rule fallback |
| `INTENT_PROVIDER` | Provider order, comma-separated | `openrouter,groq,anthropic` |
| `OPENROUTER_MODEL` / `GROQ_MODEL` / `ANTHROPIC_MODEL` | Model per provider | Per-provider default |
| `RZP_KEY_ID` / `RZP_KEY_SECRET` | REST execution (must be `rzp_test_`) | Simulated execution |
| `RZP_MERCHANT_TOKEN` | MCP execution | — |
| `RZP_EXEC_MODE` | Force `rest` / `mcp` / `simulate` | Auto-detect |

Copy `.env.example` to `.env.local`. `.env*` is gitignored.

### The intent verifier is provider-agnostic

Set **any one** of the three keys. Providers are tried in order and the first
that answers wins, so a rate limit or an exhausted balance falls through to the
next provider rather than dropping to the rule engine — verified with a
deliberately invalid OpenRouter key, which was served by Groq with
`fallback: false`.

Model selection is evidence-based, not vibes: **[docs/model-eval.md](docs/model-eval.md)**
has the eval (six probes, four of which pass every deterministic rule), the
scores for Kimi K3 / K2.6 / Gemini Flash Lite / DeepSeek / Groq, and three
non-obvious traps — including reasoning models that silently return
`content: null` because they spent the whole token budget thinking.

Default is `google/gemini-2.5-flash-lite`: full marks on the eval at roughly
**$0.0015 per full demo run** (13 model calls).

### A note on MCP

The documented `npx mcp-remote` setup is a local stdio bridge for Claude Desktop and
Cursor — it cannot run inside a Vercel serverless function. The adapter therefore speaks
JSON-RPC to `https://mcp.razorpay.com/mcp` over HTTP directly. REST is the reliable path
and is tried first; MCP is opt-in via `RZP_MERCHANT_TOKEN` or `RZP_EXEC_MODE=mcp`.

---

## Tests

```bash
npm test
```

26 tests, zero dependencies (`node:test`). Covers the policy engine (each check, ceiling
boundaries, short-circuit order), the stricter-wins combine, verdict-JSON parsing
including malformed model output, the fallback ladder, and rupee formatting.

```
node --test tests/     # 26 pass
npm run build          # clean
```

---

## Deploy

### Static export (the published demo)

The public demo is on GitHub Pages, which has no server. `npm run build:static` produces that build
into `../docs/agentguard/`:

```bash
npm run build:static     # → ../docs/agentguard/
npm run preview:static   # same build at the site root, then: npx serve out
```

`output: "export"` refuses to build an app with route handlers, so the script moves `app/api` aside
for the duration of the export and restores it in a `finally` block. The routes are not deleted and
the pipeline they wrap still runs — `lib/localApi.js` re-hosts both of them in the visitor's tab,
calling the same `runPipeline()`. Two consequences, both improvements:

- **A visitor's key never reaches any server at all** — it goes from their tab straight to their
  provider. There is no relay to abuse.
- **Demo mode is unchanged.** With no key, `activeProviders()` finds no `process.env` values in the
  browser bundle, so the recorded response is served exactly as it is on an unkeyed server deploy.

Verified after every build: the exported bundle contains no key material, and `app/api` is back.

### Server deploy (Vercel)

```bash
npm i -g vercel
vercel                 # link the project
vercel env add ANTHROPIC_API_KEY production
vercel env add RZP_KEY_ID production          # optional, must be rzp_test_
vercel env add RZP_KEY_SECRET production      # optional
vercel --prod
```

Then open the production URL in an incognito window and confirm it works cold, with no
extension or cached state.

---

## Notes on model choice

Reasoning is **disabled on every provider**, deliberately and for the same reason in
each case: reasoning tokens share the `max_tokens` budget with the response, so a long
reasoning pass truncates the JSON mid-object and drops the verdict into the fallback. On
the Kimi family this is not theoretical — at `max_tokens: 512` they returned
`content: null` outright. The rule engine already covers the objective checks; this call
is one bounded judgement, and a verdict that always parses beats a marginally better
verdict that sometimes doesn't.

Output is constrained with a JSON schema, with tolerant parsing behind it, because
`strict: true` is not honoured uniformly across providers. Full detail and measurements:
[docs/model-eval.md](docs/model-eval.md).
