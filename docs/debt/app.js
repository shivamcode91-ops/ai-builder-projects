/* Credit workbench — static build.
 *
 * Two environments, one renderer:
 *
 *   Demo (default)  three recorded pipeline runs from final_outputs/, bundled
 *                   as demo-data.js. No key, no upload, nothing to set up.
 *   Live            the visitor's own Anthropic key and their own dataroom.
 *                   Files are read in this tab; the two model calls go from
 *                   here straight to api.anthropic.com. No server of ours is
 *                   involved, so the key never leaves the browser.
 *
 * The memo, the queue and the copilot render from the same run object either
 * way — a live run has to produce the same shape the pipeline produces, which
 * is the point of the JSON schema on the structuring call.
 */

/* ----------------------------------------------------------- formatting */

const fmtINR = (n) => {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const fmtNum = (n, d = 2) => (n == null || !isFinite(n) ? "—" : Number(n).toFixed(d));
const fmtPct = (n, d = 1) => (n == null || !isFinite(n) ? "—" : `${Number(n).toFixed(d)}%`);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

/** Minimal markdown → HTML for copilot answers. Escapes first, so model
 *  output can never inject markup. */
function md(text) {
  const lines = esc(text).split("\n");
  let html = "";
  let inList = false;
  const inline = (s) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/(?<![*\w])\*(?!\s)([^*]+?)(?<!\s)\*(?![*\w])/g, "<i>$1</i>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(bullet[1])}</li>`;
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (!line.trim()) continue;
    if (/^---+$/.test(line.trim())) { html += "<hr>"; continue; }
    const head = line.match(/^#{1,6}\s+(.*)$/);
    html += head ? `<h4>${inline(head[1])}</h4>` : `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

/* --------------------------------------------------------------- state */

const state = {
  runs: [],            // [{ id, run, turns, live? }]
  openId: null,
  cred: null,          // { key, model } — sessionStorage only, never sent to us
  busy: false,
};

const $ = (sel) => document.querySelector(sel);
const el = (id) => document.getElementById(id);

/* ------------------------------------------------------------ the queue */

function riskClass(band) {
  const b = String(band || "").toLowerCase();
  if (b.startsWith("low")) return "g";
  if (b.startsWith("elev") || b.startsWith("med") || b.startsWith("mod")) return "a";
  if (b.startsWith("high")) return "r";
  return "n";
}
function stampClass(elig) {
  const e = String(elig || "").toLowerCase();
  if (e.startsWith("eligible") || e.startsWith("approve")) return "approve";
  if (e.startsWith("decline") || e.startsWith("reject")) return "decline";
  return "conditional";
}

function headlineAmount(run) {
  const p = run?.debt_structure?.recommended_products || [];
  if (!p.length) return null;
  return p.reduce((sum, x) => sum + (Number(x.amount_inr) || 0), 0);
}

function renderQueue() {
  const rows = state.runs
    .map((entry) => {
      const r = entry.run;
      const band = r.credit_snapshot?.aica?.risk_band;
      const amount = headlineAmount(r);
      const lead = r.debt_structure?.recommended_products?.[0]?.product ?? "No facility recommended";
      const dscr = r.credit_snapshot?.ratios_computed?.dscr;
      return `
        <button class="qrow" data-open="${esc(entry.id)}">
          <span class="qstamp ${stampClass(r.debt_structure?.eligibility)}">${esc(r.debt_structure?.eligibility ?? "—")}</span>
          <span class="qname">
            <b>${esc(r.company?.name ?? "Company")}</b>
            <span>${esc(r.company?.sector ?? "")}</span>
          </span>
          <span><span class="dot ${riskClass(band)}"></span>${esc(band ?? "—")}</span>
          <span class="num">${fmtNum(dscr)}</span>
          <span class="qlead">${esc(lead)}</span>
          <span class="num">${amount ? fmtINR(amount) : "—"}</span>
          <span class="qsrc">${entry.live ? "your data" : "recorded run"}</span>
          <span class="qchev">›</span>
        </button>`;
    })
    .join("");

  const n = state.runs.length;
  const conditional = state.runs.filter((e) => stampClass(e.run.debt_structure?.eligibility) === "conditional").length;
  const declined = state.runs.filter((e) => stampClass(e.run.debt_structure?.eligibility) === "decline").length;

  el("queue").innerHTML = `
    <div class="qsummary">
      <span class="qchip">In queue <b>${n}</b></span>
      <span class="qchip">Conditional <b>${conditional}</b></span>
      <span class="qchip">Declined <b>${declined}</b></span>
    </div>
    <div class="qtable">
      <div class="qhead">
        <span>Verdict</span><span>Company</span><span>Risk</span><span>DSCR</span>
        <span>Lead product</span><span>Amount</span><span>Source</span><span></span>
      </div>
      ${rows}
    </div>
    <p class="qnote">
      Every row is a full pipeline run: deterministic parsers computed the numbers, one
      reasoning call chose the structure, then code re-checked serviceability. Open one to
      read the memo and question it.
    </p>`;

  el("queue").querySelectorAll("[data-open]").forEach((b) =>
    b.addEventListener("click", () => openMemo(b.dataset.open))
  );
}

/* ------------------------------------------------------------- the memo */

function metric(label, value, note) {
  return `<div class="metric"><span class="ml">${esc(label)}</span><span class="mv num">${value}</span>${
    note ? `<span class="mn">${esc(note)}</span>` : ""
  }</div>`;
}

function renderProduct(p) {
  const pricing = p.pricing || {};
  const priceBits = Object.entries(pricing)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: <b>${esc(String(v))}</b>`)
    .join(" · ");

  const list = (title, items) =>
    Array.isArray(items) && items.length
      ? `<div class="plist"><h5>${esc(title)}</h5><ul>${items
          .map((i) => `<li>${esc(typeof i === "string" ? i : JSON.stringify(i))}</li>`)
          .join("")}</ul></div>`
      : "";

  return `
    <article class="product">
      <header>
        <h4>${esc(p.product ?? "Facility")}</h4>
        <span class="pamt num">${fmtINR(p.amount_inr)}</span>
      </header>
      <p class="ppurpose">${esc(p.purpose ?? "")}</p>
      <div class="pmeta">
        ${p.tenor_months ? `<span>Tenor <b>${esc(p.tenor_months)} months</b></span>` : ""}
        ${p.repayment ? `<span>Repayment <b>${esc(p.repayment)}</b></span>` : ""}
        ${p.advance_rate_pct ? `<span>Advance rate <b>${esc(p.advance_rate_pct)}%</b></span>` : ""}
        ${priceBits ? `<span>${priceBits}</span>` : ""}
      </div>
      ${
        p.amount_basis
          ? `<details class="basis" open><summary>How the amount was sized</summary><pre>${esc(p.amount_basis)}</pre></details>`
          : ""
      }
      ${
        Array.isArray(p.serviceability_check) && p.serviceability_check.length
          ? `<details class="basis"><summary>Serviceability check (re-verified in code)</summary><pre>${esc(
              p.serviceability_check.join("\n")
            )}</pre></details>`
          : ""
      }
      <div class="pgrid">
        ${list("Security", p.security)}
        ${list("Covenants", p.covenants)}
        ${list("Conditions precedent", p.conditions_precedent)}
        ${list("Monitoring", p.monitoring)}
      </div>
    </article>`;
}

function renderMemo(entry) {
  const r = entry.run;
  const s = r.credit_snapshot || {};
  const f = s.financials || {};
  const rc = s.ratios_computed || {};
  const ds = r.debt_structure || {};
  const years = f.years || [];
  const lastYear = years[years.length - 1];

  const revSeries = years.map((y) => ({ y, v: f.revenue_inr?.[y] }));
  const maxRev = Math.max(...revSeries.map((d) => d.v || 0), 1);

  const flags = s.data_quality_flags || [];
  const signals = s.risk_signals || [];

  el("memo").innerHTML = `
    <div class="memohead">
      <div>
        <span class="qstamp ${stampClass(ds.eligibility)}">${esc(ds.eligibility ?? "—")}</span>
        <h2>${esc(r.company?.name ?? "Company")}</h2>
        <p class="sub">
          ${esc(r.company?.sector ?? "")}
          ${r.company?.cin ? ` · CIN ${esc(r.company.cin)}` : ""}
          ${r.company?.gstin ? ` · GSTIN ${esc(r.company.gstin)}` : ""}
        </p>
      </div>
      <div class="memoright">
        <span class="riskband"><span class="dot ${riskClass(s.aica?.risk_band)}"></span>${esc(
          s.aica?.risk_band ?? "—"
        )} risk${s.aica?.risk_score != null ? ` · score ${fmtNum(s.aica.risk_score, 1)}` : ""}</span>
        ${
          entry.live
            ? `<span class="srcbadge live">Live run · your data, your key</span>`
            : `<span class="srcbadge">Recorded run · ${esc(r.run_meta?.models?.reason ?? "pipeline output")}</span>`
        }
      </div>
    </div>

    <p class="verdict">${esc(ds.eligibility_reason ?? "")}</p>

    <section class="card">
      <h3>Credit snapshot <span class="tag">computed in code, not by the model</span></h3>
      <div class="metrics">
        ${metric("DSCR", fmtNum(rc.dscr), "EBITDA ÷ (interest + 12×EMI)")}
        ${metric("Debt / EBITDA", fmtNum(rc.debt_to_ebitda), "leverage")}
        ${metric("Interest cover", fmtNum(rc.interest_coverage), "×")}
        ${metric("Revenue growth", fmtPct(rc.revenue_growth_pct), "YoY")}
        ${metric("EBITDA margin", fmtPct(rc.ebitda_margin_pct), lastYear ?? "")}
        ${metric("Net worth", fmtINR(rc.net_worth_inr), "shareholders' equity")}
        ${metric("Annual debt service", fmtINR(rc.annual_debt_service_inr), "existing")}
        ${metric("Cash cover", `${fmtNum(rc.cash_months_cover, 2)}`, "months of outflow")}
      </div>

      <div class="twocol">
        <div>
          <h5>Revenue</h5>
          <div class="bars">
            ${revSeries
              .map(
                (d) => `
              <div class="bar">
                <span class="bfill" style="height:${Math.max(6, ((d.v || 0) / maxRev) * 100)}%"></span>
                <span class="blabel">${esc(d.y)}</span>
                <span class="bval num">${fmtINR(d.v)}</span>
              </div>`
              )
              .join("")}
          </div>
        </div>
        <div>
          <h5>Working capital &amp; banking</h5>
          <table class="kv">
            <tr><td>DSO</td><td class="num">${esc(s.working_capital?.dso_days ?? "—")} d</td></tr>
            <tr><td>Inventory days</td><td class="num">${esc(s.working_capital?.inventory_days ?? "—")} d</td></tr>
            <tr><td>DPO</td><td class="num">${esc(s.working_capital?.dpo_days ?? "—")} d</td></tr>
            <tr><td>Top customer</td><td class="num">${fmtPct(s.working_capital?.top_customer_pct, 0)}</td></tr>
            <tr><td>Avg monthly inflows</td><td class="num">${fmtINR(s.banking?.avg_monthly_inflows_inr)}</td></tr>
            <tr><td>Bounces (12m)</td><td class="num">${esc(s.banking?.bounce_count_12m ?? "—")}</td></tr>
            <tr><td>WC utilisation</td><td class="num">${fmtPct(s.debt_profile?.wc_utilisation_pct)}</td></tr>
            <tr><td>Eligible receivables (0–60d)</td><td class="num">${fmtINR(s.receivables?.eligible_0_60_inr)}</td></tr>
          </table>
        </div>
      </div>
    </section>

    ${
      flags.length
        ? `<section class="card dq">
             <h3>Cross-document data-quality flags <span class="tag">surfaced, not averaged away</span></h3>
             <ul>${flags
               .map(
                 (x) =>
                   `<li><b>${esc(x.flag)}</b> — ${esc(x.detail)}${
                     x.impact ? ` <i>${esc(x.impact)}</i>` : ""
                   }</li>`
               )
               .join("")}</ul>
           </section>`
        : ""
    }

    ${
      signals.length
        ? `<section class="card">
             <h3>Risk signals</h3>
             <ul class="signals">${signals
               .map(
                 (x) =>
                   `<li class="sev-${esc(String(x.severity || "info").toLowerCase())}"><b>${esc(
                     x.signal
                   )}</b><span>${esc(x.evidence ?? "")}</span></li>`
               )
               .join("")}</ul>
           </section>`
        : ""
    }

    <section class="card">
      <h3>Recommended structure</h3>
      ${
        (ds.recommended_products || []).length
          ? ds.recommended_products.map(renderProduct).join("")
          : `<p class="none">No facility recommended.</p>`
      }
      ${
        (ds.declined_products || []).length
          ? `<div class="declined"><h5>Considered and declined</h5><ul>${ds.declined_products
              .map((d) => `<li><b>${esc(d.product)}</b> — ${esc(d.reason)}</li>`)
              .join("")}</ul></div>`
          : ""
      }
    </section>

    ${
      (ds.key_risks || []).length
        ? `<section class="card"><h3>Key risks</h3><ul class="plain">${ds.key_risks
            .map((k) => `<li>${esc(typeof k === "string" ? k : JSON.stringify(k))}</li>`)
            .join("")}</ul></section>`
        : ""
    }

    ${
      (ds.rationale || []).length
        ? `<section class="card"><h3>Rationale</h3><ol class="plain">${ds.rationale
            .map((k) => `<li>${esc(typeof k === "string" ? k : JSON.stringify(k))}</li>`)
            .join("")}</ol></section>`
        : ""
    }

    ${
      r.run_meta
        ? `<p class="runmeta">
             Run: ${esc(r.run_meta.llm_calls ?? "—")} model calls ·
             ${esc(r.run_meta.prompt_tokens ?? "—")} in / ${esc(r.run_meta.completion_tokens ?? "—")} out tokens ·
             ${r.run_meta.est_cost_usd != null ? `$${fmtNum(r.run_meta.est_cost_usd, 4)}` : "—"} ·
             ${r.run_meta.wall_clock_seconds != null ? `${fmtNum(r.run_meta.wall_clock_seconds, 1)}s` : "—"}
             ${r.run_meta.models ? ` · extract ${esc(r.run_meta.models.extract)} · reason ${esc(r.run_meta.models.reason)}` : ""}
           </p>`
        : ""
    }`;
}

/* ----------------------------------------------------------- the copilot */

function pushChat(role, html) {
  const log = el("chatlog");
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = html;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function renderCopilot(entry) {
  const suggestions = (entry.turns || []).map((t) => t.q);
  el("chatlog").innerHTML = "";
  el("suggest").innerHTML = suggestions.length
    ? `<span class="slabel">${entry.live ? "Try asking" : "Answered in this demo"}</span>` +
      suggestions.map((q, i) => `<button class="schip" data-q="${i}">${esc(q)}</button>`).join("")
    : "";
  el("suggest").querySelectorAll("[data-q]").forEach((b) =>
    b.addEventListener("click", () => {
      el("chatinput").value = entry.turns[Number(b.dataset.q)].q;
      el("chatform").requestSubmit();
    })
  );

  pushChat(
    "sys",
    `<p>Grounded on this run only — the snapshot and the structure above, about 6KB of JSON.
     It cannot see the dataroom, so it cannot invent a number that is not in the snapshot.</p>`
  );
}

/** Demo-environment answering: serve the recorded answer for a recorded
 *  question. Never paraphrase one recorded answer into a reply to a different
 *  question — say plainly that the demo does not have it. */
function recordedAnswer(entry, question) {
  const norm = (s) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const asked = new Set(norm(question));
  let best = null;
  let bestScore = 0;
  for (const t of entry.turns || []) {
    const words = norm(t.q);
    const overlap = words.filter((w) => asked.has(w)).length;
    const score = words.length ? overlap / words.length : 0;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return bestScore >= 0.6 ? best.a : null;
}

async function askCopilot(entry, question) {
  pushChat("me", `<p>${esc(question)}</p>`);

  if (!entry.live && !state.cred) {
    const rec = recordedAnswer(entry, question);
    if (rec) {
      pushChat("bot", md(rec) + `<p class="recorded">Recorded answer from the saved transcript for this company.</p>`);
    } else {
      pushChat(
        "bot",
        `<p>The demo environment only has the saved transcript for this company, and that
          question is not in it — so there is no honest answer to give you here.</p>
         <p>Add your own Anthropic key (top right) and this runs live against the same
          grounded context, and will answer anything.</p>`
      );
    }
    return;
  }

  const thinking = pushChat("bot", `<p class="pending">Thinking…</p>`);
  try {
    const answer = await liveChat(entry.run, question);
    thinking.innerHTML = md(answer) + `<p class="recorded live">Live · your key · ${esc(state.cred.model)}</p>`;
  } catch (err) {
    thinking.innerHTML = `<p class="err">${esc(String(err.message || err))}</p>`;
  }
  el("chatlog").scrollTop = el("chatlog").scrollHeight;
}

/* ------------------------------------------------------- Anthropic calls */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/** One request to the Messages API, straight from this tab.
 *  The key rides a header and is never written anywhere but sessionStorage. */
async function anthropic(body, { timeoutMs = 180000 } = {}) {
  if (!state.cred) throw new Error("No key set.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": state.cred.key,
        "anthropic-version": "2023-06-01",
        // Anthropic blocks browser calls unless this opt-in is present. It is
        // safe here precisely because there is no server in the path: the key
        // goes from the visitor's tab to their own account.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON error body */ }
    if (!res.ok) {
      throw new Error(redact(json?.error?.message || `HTTP ${res.status}`));
    }
    if (json?.stop_reason === "refusal") {
      throw new Error("The model declined this request.");
    }
    const block = (json.content || []).find((b) => b.type === "text");
    if (!block?.text) throw new Error("The model returned no text.");
    return block.text;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("The request timed out.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Never let key material travel back into the DOM in an error string. */
const redact = (s) => String(s ?? "").replace(/sk-ant-[\w-]+/g, "[key redacted]").slice(0, 300);

const CHAT_SYSTEM = `You are the credit copilot inside a lender's workbench.

You are given ONE company's credit snapshot and recommended debt structure as JSON. That JSON is your entire world. Answer the underwriter's question from it.

Rules:
- Every number you state must come from the JSON or be arithmetic you show on numbers from the JSON. If a figure is not there, say it is not in the snapshot — never estimate it.
- Show the arithmetic when you re-size a facility or re-check serviceability. Post-facility DSCR = EBITDA / (interest + 12 x EMI + new interest).
- Amounts in INR, the way an Indian underwriter writes them.
- Be direct. Lead with the answer, then the working. Markdown, no preamble.`;

async function liveChat(run, question) {
  const context = JSON.stringify(
    { company: run.company, credit_snapshot: run.credit_snapshot, debt_structure: run.debt_structure },
    null,
    1
  );
  return anthropic({
    model: state.cred.model,
    max_tokens: 8000,
    system: CHAT_SYSTEM,
    messages: [{ role: "user", content: `COMPANY JSON\n${context}\n\nQUESTION\n${question}` }],
  });
}

/* ------------------------------------------- live run: read the dataroom */

const MAX_CHARS_PER_SHEET = 20000;
const MAX_ROWS = 400;

let xlsxLoading = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  if (!xlsxLoading) {
    xlsxLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "vendor/xlsx.mini.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load the spreadsheet parser."));
      document.head.appendChild(s);
    });
  }
  return xlsxLoading;
}

const readAs = (file, how) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    fr[how](file);
  });

/** Excel is where every number lives, so it is reduced here rather than sent
 *  raw: sheets become row-capped CSV, which is what the Python pipeline's
 *  parsers do in spirit — get the model out of the arithmetic. */
async function xlsxToText(file) {
  await loadXLSX();
  const buf = await readAs(file, "readAsArrayBuffer");
  const wb = window.XLSX.read(new Uint8Array(buf), { type: "array" });
  const parts = [];
  for (const name of wb.SheetNames) {
    const csv = window.XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
    const rows = csv.split("\n");
    const kept = rows.slice(0, MAX_ROWS).join("\n").slice(0, MAX_CHARS_PER_SHEET);
    const trimmed = rows.length > MAX_ROWS ? `\n… ${rows.length - MAX_ROWS} further rows not shown` : "";
    parts.push(`### Sheet: ${name} (${rows.length} rows)\n${kept}${trimmed}`);
  }
  return parts.join("\n\n");
}

/** Turn the visitor's files into Messages API content blocks. PDFs and images
 *  go to the model natively; spreadsheets and text are reduced here first. */
async function filesToBlocks(files) {
  const blocks = [];
  const notes = [];
  for (const file of files) {
    const name = file.name;
    const ext = name.split(".").pop().toLowerCase();
    try {
      if (ext === "pdf") {
        const dataUrl = await readAs(file, "readAsDataURL");
        blocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: dataUrl.split(",")[1] },
          title: name,
        });
        notes.push(`${name} — PDF, sent whole`);
      } else if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
        const dataUrl = await readAs(file, "readAsDataURL");
        const mediaType = dataUrl.slice(5, dataUrl.indexOf(";"));
        blocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data: dataUrl.split(",")[1] } });
        notes.push(`${name} — image, read by vision`);
      } else if (["xlsx", "xlsm"].includes(ext)) {
        const text = await xlsxToText(file);
        blocks.push({ type: "text", text: `FILE: ${name}\n${text}` });
        notes.push(`${name} — spreadsheet, parsed in this tab`);
      } else {
        const text = (await readAs(file, "readAsText")).slice(0, MAX_CHARS_PER_SHEET * 2);
        blocks.push({ type: "text", text: `FILE: ${name}\n${text}` });
        notes.push(`${name} — text`);
      }
    } catch (err) {
      notes.push(`${name} — skipped (${err.message})`);
    }
  }
  return { blocks, notes };
}

/* ------------------------------------------- live run: the two-stage call */

// Mirrors the shape pipeline/snapshot.py produces, so the memo renderer needs
// no special case for a live run.
const SNAPSHOT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["company", "financials", "working_capital", "debt_profile", "banking", "ratios_computed", "risk_signals", "data_quality_flags"],
  properties: {
    company: {
      type: "object", additionalProperties: false,
      required: ["name", "sector"],
      properties: {
        name: { type: "string" }, sector: { type: "string" },
        cin: { type: ["string", "null"] }, gstin: { type: ["string", "null"] },
      },
    },
    financials: {
      type: "object", additionalProperties: false,
      required: ["years", "revenue_inr", "ebitda_inr", "pat_inr", "interest_inr"],
      properties: {
        years: { type: "array", items: { type: "string" } },
        revenue_inr: { type: "object", additionalProperties: { type: "number" } },
        ebitda_inr: { type: "object", additionalProperties: { type: "number" } },
        pat_inr: { type: "object", additionalProperties: { type: "number" } },
        interest_inr: { type: ["number", "null"] },
      },
    },
    working_capital: {
      type: "object", additionalProperties: false,
      required: ["dso_days", "dpo_days", "inventory_days"],
      properties: {
        dso_days: { type: ["number", "null"] }, dpo_days: { type: ["number", "null"] },
        inventory_days: { type: ["number", "null"] }, top_customer_pct: { type: ["number", "null"] },
      },
    },
    debt_profile: {
      type: "object", additionalProperties: false,
      required: ["total_outstanding_inr", "monthly_emi_inr"],
      properties: {
        total_sanctioned_inr: { type: ["number", "null"] },
        total_outstanding_inr: { type: ["number", "null"] },
        monthly_emi_inr: { type: ["number", "null"] },
        wc_utilisation_pct: { type: ["number", "null"] },
      },
    },
    receivables: {
      type: "object", additionalProperties: false,
      properties: {
        total_inr: { type: ["number", "null"] },
        eligible_0_60_inr: { type: ["number", "null"] },
        pct_90_plus: { type: ["number", "null"] },
      },
    },
    banking: {
      type: "object", additionalProperties: false,
      properties: {
        avg_monthly_inflows_inr: { type: ["number", "null"] },
        avg_monthly_outflows_inr: { type: ["number", "null"] },
        closing_balance_inr: { type: ["number", "null"] },
        bounce_count_12m: { type: ["number", "null"] },
      },
    },
    ratios_computed: {
      type: "object", additionalProperties: false,
      required: ["dscr", "debt_to_ebitda"],
      properties: {
        revenue_growth_pct: { type: ["number", "null"] },
        ebitda_margin_pct: { type: ["number", "null"] },
        dscr: { type: ["number", "null"] },
        debt_to_ebitda: { type: ["number", "null"] },
        interest_coverage: { type: ["number", "null"] },
        annual_debt_service_inr: { type: ["number", "null"] },
        net_worth_inr: { type: ["number", "null"] },
        cash_months_cover: { type: ["number", "null"] },
      },
    },
    aica: {
      type: "object", additionalProperties: false,
      properties: {
        risk_score: { type: ["number", "null"] },
        risk_band: { type: ["string", "null"] },
        positive_signals: { type: "array", items: { type: "string" } },
      },
    },
    risk_signals: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["severity", "signal", "evidence"],
        properties: { severity: { type: "string" }, signal: { type: "string" }, evidence: { type: "string" } },
      },
    },
    data_quality_flags: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["flag", "detail"],
        properties: { flag: { type: "string" }, detail: { type: "string" }, impact: { type: ["string", "null"] } },
      },
    },
  },
};

const PRODUCT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["product", "purpose", "amount_inr", "amount_basis", "tenor_months", "repayment", "security", "covenants", "conditions_precedent", "monitoring", "serviceability_check"],
  properties: {
    product: { type: "string" },
    purpose: { type: "string" },
    amount_inr: { type: "number" },
    amount_basis: { type: "string" },
    tenor_months: { type: ["number", "null"] },
    pricing: {
      type: "object", additionalProperties: false,
      properties: {
        benchmark: { type: ["string", "null"] }, spread_bps: { type: ["number", "null"] },
        all_in_rate_pct: { type: ["number", "null"] }, processing_fee_pct: { type: ["number", "null"] },
      },
    },
    repayment: { type: "string" },
    advance_rate_pct: { type: ["number", "null"] },
    security: { type: "array", items: { type: "string" } },
    covenants: { type: "array", items: { type: "string" } },
    conditions_precedent: { type: "array", items: { type: "string" } },
    monitoring: { type: "array", items: { type: "string" } },
    serviceability_check: { type: "array", items: { type: "string" } },
  },
};

const STRUCTURE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["eligibility", "eligibility_reason", "recommended_products", "declined_products", "key_risks", "rationale"],
  properties: {
    eligibility: { type: "string", enum: ["eligible", "conditional", "decline"] },
    eligibility_reason: { type: "string" },
    recommended_products: { type: "array", items: PRODUCT_SCHEMA },
    declined_products: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["product", "reason"],
        properties: { product: { type: "string" }, reason: { type: "string" } },
      },
    },
    key_risks: { type: "array", items: { type: "string" } },
    rationale: { type: "array", items: { type: "string" } },
  },
};

const EXTRACT_SYSTEM = `You read a company's dataroom and return a credit snapshot as JSON.

You are the ingestion stage. Your job is to READ, not to judge. Pull the figures that are actually in the documents; compute only the ratios listed in the schema, and only from figures you found.

Hard rules:
- Never invent a number. If a field is not evidenced in the documents, set it to null and add a data_quality_flag saying which document was missing.
- Amounts in absolute INR (a figure printed as "4.86 Cr" becomes 48600000).
- When two documents disagree on the same figure, take the more conservative one AND record a data_quality_flag naming both values. Do not average them.
- dscr = EBITDA / (interest + 12 x monthly EMI). debt_to_ebitda = total outstanding / EBITDA. Use the latest year.
- risk_signals: threshold breaches you can evidence (DSCR under 1.25, leverage over 3x, bounces, receivable concentration, ageing). Each needs its evidence.`;

const STRUCTURE_SYSTEM = `You are a credit structurer at an Indian NBFC/bank. You are given a credit snapshot computed from a company's dataroom, and you recommend a debt structure.

Knowledge base you work to:
- DSCR floor 1.25x post-facility. Leverage ceiling 3.0x Debt/EBITDA. Below either, the answer is conditional at best.
- Working-capital gap = (DSO + inventory days - DPO) / 365 x annual revenue. Size cash credit against it, not against a round number.
- Invoice discounting advances at most 80% of 0-60 day receivables, and is capped further where customer concentration is high.
- Term loans need an evidenced capex purpose. No purpose, no term loan.
- Where a data-quality flag touches a number you are sizing off, size off the weaker figure AND attach a condition precedent that resolves the flag.

Requirements on your output:
- amount_basis must show the arithmetic, step by step, on figures from the snapshot. A number without its derivation is a failure.
- serviceability_check must re-derive post-facility DSCR line by line: EBITDA, existing service, new interest, new EMI, resulting DSCR against the 1.25x floor.
- Decline when the credit does not support a facility. A decline with a clear reason is a correct answer, not a failure.
- Every covenant and condition precedent must be checkable against something in the snapshot.`;

/** Pull the JSON object out of a response, tolerating stray prose. */
function parseJson(text, what) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const candidates = [trimmed];
  const start = trimmed.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < trimmed.length; i++) {
      if (trimmed[i] === "{") depth++;
      else if (trimmed[i] === "}" && --depth === 0) { candidates.push(trimmed.slice(start, i + 1)); break; }
    }
  }
  for (const c of candidates) {
    try { const p = JSON.parse(c); if (p && typeof p === "object") return p; } catch { /* next */ }
  }
  throw new Error(`The ${what} stage did not return usable JSON.`);
}

async function runLive(files, onStep) {
  const t0 = Date.now();

  onStep("Reading your files in this tab…");
  const { blocks, notes } = await filesToBlocks(files);
  if (!blocks.length) throw new Error("None of those files could be read.");

  onStep(`Stage 1 — extracting a snapshot from ${blocks.length} document${blocks.length > 1 ? "s" : ""}…`);
  const snapText = await anthropic({
    model: "claude-haiku-4-5",
    max_tokens: 16000,
    system: EXTRACT_SYSTEM,
    output_config: { format: { type: "json_schema", schema: SNAPSHOT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          ...blocks,
          { type: "text", text: "Return the credit snapshot for this company as JSON matching the schema." },
        ],
      },
    ],
  });
  const snapshot = parseJson(snapText, "extraction");

  onStep("Stage 2 — structuring the facility…");
  const structText = await anthropic({
    model: state.cred.model,
    max_tokens: 16000,
    system: STRUCTURE_SYSTEM,
    output_config: { effort: "high", format: { type: "json_schema", schema: STRUCTURE_SCHEMA } },
    messages: [
      { role: "user", content: `CREDIT SNAPSHOT\n${JSON.stringify(snapshot, null, 1)}\n\nRecommend the debt structure as JSON matching the schema.` },
    ],
  });
  const structure = parseJson(structText, "structuring");

  onStep("Re-checking serviceability in code…");
  const warnings = validate(snapshot, structure);

  return {
    id: `live_${Date.now()}`,
    live: true,
    turns: [
      { q: "why this amount and not more?" },
      { q: "what breaks if revenue falls 20%?" },
      { q: "and if the facility were 1.5x?" },
    ].map((t) => ({ q: t.q, a: null })),
    run: {
      company: snapshot.company,
      generated_at: new Date().toISOString(),
      credit_snapshot: snapshot,
      debt_structure: structure,
      validation_warnings: warnings,
      run_meta: {
        llm_calls: 2,
        wall_clock_seconds: (Date.now() - t0) / 1000,
        models: { extract: "claude-haiku-4-5", reason: state.cred.model },
        source_files: notes,
      },
    },
  };
}

/** The code-side check the pipeline runs after the model answers. The model
 *  is not asked to be trusted on arithmetic — it is checked. */
function validate(snapshot, structure) {
  const warnings = [];
  const rc = snapshot.ratios_computed || {};
  const ebitda = Number(rc.annual_debt_service_inr) && Number(rc.dscr)
    ? Number(rc.dscr) * Number(rc.annual_debt_service_inr)
    : null;

  for (const p of structure.recommended_products || []) {
    const amt = Number(p.amount_inr) || 0;
    const rate = Number(p.pricing?.all_in_rate_pct);
    if (ebitda && isFinite(rate) && rate > 0) {
      const newInterest = amt * (rate / 100);
      const post = ebitda / ((Number(rc.annual_debt_service_inr) || 0) + newInterest);
      if (isFinite(post) && post < 1.25) {
        warnings.push(
          `${p.product}: post-facility DSCR re-computes to ${post.toFixed(2)}x, below the 1.25x floor.`
        );
      }
    }
    const eligible = Number(snapshot.receivables?.eligible_0_60_inr);
    if (/discount|factoring|receivable/i.test(p.product) && isFinite(eligible) && amt > eligible * 0.8) {
      warnings.push(
        `${p.product}: ${fmtINR(amt)} exceeds 80% of eligible 0–60 day receivables (${fmtINR(eligible * 0.8)}).`
      );
    }
  }
  return warnings;
}

/* --------------------------------------------------------------- routing */

function openMemo(id) {
  const entry = state.runs.find((e) => e.id === id);
  if (!entry) return;
  state.openId = id;
  renderMemo(entry);
  renderCopilot(entry);
  document.body.dataset.view = "memo";
  el("crumb").textContent = entry.run.company?.name ?? "Memo";
  window.scrollTo(0, 0);
}

function backToQueue() {
  state.openId = null;
  document.body.dataset.view = "queue";
  el("crumb").textContent = "";
}

/* ----------------------------------------------------------- the key/data sheet */

function setMode() {
  const badge = el("modebadge");
  if (state.cred) {
    badge.textContent = `Live · your key · ${state.cred.model}`;
    badge.className = "modebadge live";
    el("keybtn").textContent = "Run your own data";
  } else {
    badge.textContent = "Demo environment · recorded runs";
    badge.className = "modebadge";
    el("keybtn").textContent = "Use your own key + data";
  }
}

function openSheet() { el("sheet").hidden = false; el("sheetback").hidden = false; }
function closeSheet() { el("sheet").hidden = true; el("sheetback").hidden = true; }

function restoreCred() {
  try {
    const raw = sessionStorage.getItem("cw.cred");
    if (raw) state.cred = JSON.parse(raw);
  } catch { /* ignore */ }
}
function saveCred(cred) {
  state.cred = cred;
  try { sessionStorage.setItem("cw.cred", JSON.stringify(cred)); } catch { /* ignore */ }
  setMode();
}
function clearCred() {
  state.cred = null;
  try { sessionStorage.removeItem("cw.cred"); } catch { /* ignore */ }
  setMode();
}

async function testKey(key, model) {
  const prev = state.cred;
  state.cred = { key, model };
  try {
    await anthropic(
      { model, max_tokens: 16, messages: [{ role: "user", content: "Reply with the word OK." }] },
      { timeoutMs: 30000 }
    );
    return null;
  } catch (err) {
    state.cred = prev;
    return redact(err.message);
  }
}

/* ------------------------------------------------------------------ init */

function wire() {
  el("keybtn").addEventListener("click", openSheet);
  el("sheetback").addEventListener("click", closeSheet);
  el("sheetclose").addEventListener("click", closeSheet);
  el("backbtn").addEventListener("click", backToQueue);
  el("homebtn").addEventListener("click", backToQueue);

  el("chatform").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = el("chatinput").value.trim();
    if (!q || state.busy) return;
    el("chatinput").value = "";
    const entry = state.runs.find((x) => x.id === state.openId);
    if (entry) askCopilot(entry, q);
  });

  // --- key form
  el("keyform").addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = el("apikey").value.trim();
    const model = el("model").value;
    const status = el("keystatus");

    if (!key.startsWith("sk-ant-")) {
      status.className = "status err";
      status.textContent = "An Anthropic key starts with sk-ant-";
      return;
    }
    status.className = "status";
    status.textContent = "Testing the key against one real request…";
    const problem = await testKey(key, model);
    if (problem) {
      status.className = "status err";
      status.textContent = problem;
      return;
    }
    saveCred({ key, model });
    status.className = "status ok";
    status.textContent = "Working. Now add a dataroom below, or ask the copilot anything.";
    el("uploadstep").hidden = false;
  });

  el("clearkey").addEventListener("click", () => {
    clearCred();
    el("apikey").value = "";
    el("keystatus").textContent = "Key cleared from this tab.";
    el("keystatus").className = "status";
    el("uploadstep").hidden = true;
  });

  // --- upload form
  const drop = el("drop");
  const picker = el("files");
  drop.addEventListener("click", () => picker.click());
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    picker.files = e.dataTransfer.files;
    showPicked();
  });
  picker.addEventListener("change", showPicked);

  function showPicked() {
    const names = [...picker.files].map((f) => `${f.name} (${(f.size / 1024).toFixed(0)} KB)`);
    el("picked").innerHTML = names.length
      ? `<b>${names.length} file${names.length > 1 ? "s" : ""}</b><ul>${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
      : "";
    el("runbtn").disabled = !names.length;
  }

  el("runbtn").addEventListener("click", async () => {
    if (!state.cred) return;
    const files = [...picker.files];
    if (!files.length) return;
    const status = el("runstatus");
    state.busy = true;
    el("runbtn").disabled = true;
    try {
      const entry = await runLive(files, (msg) => {
        status.className = "status";
        status.textContent = msg;
      });
      state.runs = [entry, ...state.runs];
      renderQueue();
      closeSheet();
      openMemo(entry.id);
      status.textContent = "";
    } catch (err) {
      status.className = "status err";
      status.textContent = redact(err.message || String(err));
    } finally {
      state.busy = false;
      el("runbtn").disabled = false;
    }
  });
}

function boot() {
  state.runs = (window.DEMO_RUNS || []).map((c) => ({ ...c, live: false }));
  restoreCred();
  setMode();
  if (state.cred) el("uploadstep").hidden = false;
  renderQueue();
  wire();
  document.body.dataset.view = "queue";
}

document.addEventListener("DOMContentLoaded", boot);
