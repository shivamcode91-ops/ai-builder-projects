# Productionization note (½ page)

## Where it breaks today

- **Template drift in datarooms.** Ingestion is deterministic-first, so it is exact and
  free on the provided template — but a dataroom from a different generator (new tab
  names in the financial model, a debt schedule with different columns, an MIS organised
  differently) will fail its parser. Failures are already isolated (a bad sheet becomes a
  `source_unparseable` data-quality flag instead of a crash), and the bank-statement
  parser resolves headers/columns by name with multi-format dates — but the other five
  parsers still assume the provided layout.
- **Doc-type routing is filename-based.** `Sanction_Letter*.png`, `GST*`, etc. A dataroom
  with unlabelled files needs a classification step (cheap LLM call over the first page).
- **Single-tenant, single-run.** Disk cache and outputs are local files; no queue, no
  concurrent-run safety, no auth on the UI server (localhost only by design).
- **No ground-truth feedback loop.** The structurer's output is validated for
  serviceability arithmetic, but product-choice quality is only as good as the prompt;
  there is no eval harness comparing against sanctioned deals.

## What I'd harden first (in order)

1. **LLM-fallback ingestion.** When a deterministic parser fails, route that sheet
   (rendered to CSV/text) through the same extraction path as the PDFs — the flag stays,
   the numbers still arrive. This closes the template-drift gap with ~30 lines.
2. **Document classifier.** Replace filename routing with a first-page classifier so any
   dataroom ordering works.
3. **Eval harness.** Golden snapshots exist (22 tests); add structure-level evals —
   reference deals scored on product match, amount-in-range, covenant coverage — run on
   every prompt change.
4. **Service wrapper.** The pipeline is already a pure function (folder → JSON); wrap it
   in a job queue with per-tenant budget metering (the `Meter` is per-run today),
   secrets management for gateway keys, and object storage for outputs/transcripts.
5. **Prompt/version pinning.** Snapshot + structure JSONs already embed `run_meta`
   (models, tokens, latency); add prompt-hash and pipeline version for full audit
   reproducibility — an underwriting decision must be replayable months later.

## Deliberate scope cuts

- No RAG/vector store: the dataroom is small and structured; distilling to a computed
  snapshot is cheaper and more auditable than retrieval.
- No streaming UI: the memo renders in one shot after a ~10–60 s run; polling is enough.
- Opus not used: the snapshot is pre-digested and code-validated; Sonnet + Haiku hit the
  cost/latency bar with no measured accuracy loss on this input size.
