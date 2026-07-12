"""Multi-turn follow-up chat grounded in one company's snapshot + structure.

The documents were distilled once at `run` time; the chat context is just the
compact output JSON (~a few KB), so every follow-up turn is cheap and fast
while staying fully grounded. History is kept across turns in-process and the
transcript is saved on exit.
"""
import json
from pathlib import Path

from . import config

CHAT_SYSTEM = """You are an underwriting copilot. You answered for this borrower with the
credit snapshot and recommended debt structure below (produced by the pipeline from the
company's dataroom). Answer follow-up questions from the underwriter.

Rules:
- Ground every answer in the snapshot/structure numbers; quote them.
- If asked "what if" (different amount, tenor, product), redo the serviceability
  arithmetic explicitly and state which terms/covenants would change and why.
- If the data cannot answer the question, say what document you would need.
- Be concise: an underwriter is reading this between calls.
- Format every answer as short dash-bullet points, numbers first — never long
  paragraphs. One-line summary sentence on top is fine.

CREDIT SNAPSHOT:
{snapshot}

RECOMMENDED STRUCTURE:
{structure}"""


def chat_loop(llm, output_json_path, model=None):
    model = model or config.REASON_MODEL
    out = json.loads(Path(output_json_path).read_text())
    system = CHAT_SYSTEM.format(
        snapshot=json.dumps(out["credit_snapshot"], indent=1, default=str),
        structure=json.dumps(out["debt_structure"], indent=1, default=str),
    )
    messages = [{"role": "system", "content": system}]
    company = out.get("company", {}).get("name", "company")
    transcript = [f"# Chat transcript — {company}\n"]
    print(f"\nChat about {company} — ask follow-ups; 'exit' to quit.\n")
    turn = 0
    while True:
        try:
            q = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not q or q.lower() in ("exit", "quit"):
            break
        turn += 1
        messages.append({"role": "user", "content": q})
        answer = llm.complete(f"chat:turn{turn}", model, messages, max_tokens=2500)
        messages.append({"role": "assistant", "content": answer})
        c = llm.meter.calls[-1]
        print(f"\n{answer}\n")
        print(f"  [{c['prompt_tokens']} in / {c['completion_tokens']} out tokens, {c['seconds']}s]\n")
        transcript.append(f"**Underwriter:** {q}\n\n**Copilot:** {answer}\n\n---\n")

    if turn:
        tpath = Path(output_json_path).with_name(
            Path(output_json_path).stem.replace("_debt_structure", "") + "_chat_transcript.md")
        tpath.write_text("\n".join(transcript))
        print(f"\nTranscript saved to {tpath}")
        print(llm.meter.summary())
