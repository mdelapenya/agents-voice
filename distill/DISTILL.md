# Distilling the voice (agent-run step)

Measurement is automated (`gen_style.mjs`). Interpretation is not: an agent reads the labeled corpus and writes the
reference files below into `<out>/skill/references/`. Run this with a strong model, with the index built, from the
repository root. Budget: a few hours of agent time for a 10k-text corpus.

## Ground rules

- **Every claim carries an anchor.** A stance, habit or principle is stated only with the URL of a real text that shows it.
  Prefer anchors from the era (`norms.json` → `era`). No anchor, no claim.
- **Numbers come from `style.md` only.** Never type a percentage or a median you measured by hand.
- **Describe, do not flatter.** "Approves 64% of reviews and attaches asks to the approval" is useful; "is a generous reviewer" is not.
- **Era first.** When early and late habits differ (gifs, length, prefixes), describe the late habit and name the shift.
- **The subject's text is the subject's.** A body opening with `@someone` is the subject addressing them.
- Use `scripts/voice search` (or `python3 pipeline/voice_index.py search`) for every sample: `--act <act> --since <era> -n 40`,
  then read the hits in full. Sample both roles (`--role own`, `--role other`).

## Files to write

### `playbooks/<act>.md` — one per act in `label/TAXONOMY.md` (except reaction, bot-command, other)

```
# <act> — <one-line definition>

Stance: <what the subject is trying to achieve with this act, in one or two sentences>
Moves:  <the 2–4 things the texts actually do, in order; quote the fixed phrases>
Never:  <what the subject does not do here, each with evidence>
Exemplars:
- <url> — <why this one is representative>   (4–6, era-weighted, both roles if both exist)
Search: `scripts/voice search --act <act> --since <era>`
```

### `playbooks/inline-review.md` — the inline review-comment genre

Shape of a comment on a line of code: prefixes (`suggestion:`, `question:` …) and their frequency from `style.md`,
suggestion blocks, questions vs. statements, how replies in a thread look, scope guards ("not for this PR").

### `principles.md` — recurring technical positions

Positions the subject has stated more than once (API shape, testing habits, naming, breaking changes, dependencies …).
One bullet per position, with two anchors each. This is the file that lets an agent take the subject's side on a
technical question without asking.

### `boundaries.md` — decisions reserved for the subject

Derive from the `decline` and `propose` acts and from own-repo `request-change`: what did the subject decide personally rather
than let a contributor decide? Typical: public API surface, breaking changes, release timing, scope of a contribution,
access and governance. End with the hand-back line agents must emit, e.g.
`DECISION NEEDED: <boundary> — <option A> / <option B>`.

### `anti-patterns.md` — what agents do that the subject never does

Four groups: register (LLM phrasing), shape (headers, bullets, length), stance (hedging, over-apologising, deciding
beyond boundaries), mechanics (gifs, dates, version promises). Each line states the agent habit and the subject's actual
habit with an anchor.

### `voice-notes.md` — the voice in prose

The paragraph a co-maintainer would write to describe how the subject writes: openers, closers, hedges, how
asks are phrased, how evidence is cited, language quirks to keep and to drop, repo-specific templates. This file is
injected into SKILL.md under "Norms specific to <name>", so keep it under ~300 words and all bullets.

## Finish

`node pipeline/assemble.mjs` reports any file still missing. Then run the eval (`eval/README` section in the top-level README).
