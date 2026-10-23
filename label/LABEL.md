# Labeling the corpus with a cheap model

Speech-act labels power `voice search --act …`, the playbooks, and the eval hold-out. They are produced by a
small model in batches; a human (or the distilling agent) spot-checks ~100 records afterwards.

## Inputs

`node label/prepare.mjs comment,review chunk` and `node label/prepare.mjs review_comment rc` write:

- `<out>/label/out/prelabeled-<prefix>.jsonl` — mechanical labels (bot commands, one-word reactions). Done.
- `<out>/label/in/<prefix>-NN.jsonl` — chunks of 120 records to label. Each record:
  `{id, kind, role, threadKind, threadTitle, threadAuthor, reviewState?, path?, hunk?, year, body}`.

## Prompt (one chunk per call; Haiku-class models are enough)

> You label short GitHub texts written by one maintainer. Read `TAXONOMY.md` (pasted below). For every record in the
> attached JSONL, output exactly one JSON line: `{"id": "<id>", "primary": "<act>", "secondary": "<act>|null", "audience": "<audience>", "tone": "warm|neutral|firm"}`.
> `primary` is what the text mainly does; `secondary` only if a second act is clearly present (approve + thank is the common pair).
> Every body was written by the subject; a leading `@someone` is the subject addressing that person. Do not skip, merge, or reorder records.
> Output JSONL only, no commentary.

Write each model's output to `<out>/label/out/<prefix>-NN.jsonl`. Any harness that can read a file and write a file works;
with T3 Code or Claude Code, one `delegate_task`/subagent per chunk on the cheapest model is the quickest path.

## Merge and check

```
node label/merge.mjs       # -> <out>/labels.jsonl, prints coverage and distributions, lists missing ids
```

Spot-check: `python3 pipeline/voice_index.py build && python3 pipeline/voice_index.py search --act decline -n 20`. Expect
>90% agreement; relabel a chunk if its distribution looks off (for example `explain` above 40%).
