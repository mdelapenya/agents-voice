# Design

## Goal

An agent posting in a maintainer's name should take the position they would take, in the shape they would use, at the
length they would use, and must say that an agent helped. Imitating phrasing is not the goal; it is a side effect of
getting stance, shape and length right.

## Why a skill, not an agent or a RAG system

- **Skill**: a `SKILL.md` plus references and two scripts is loaded by every mainstream harness, needs no server,
  and can be read and corrected by the maintainer. The voice is a document they own.
- **Not an agent**: the posting agent already exists (Claude Code, Codex, …) and already has `gh`. The voice is advice
  to it, not a second agent.
- **Not RAG-first**: retrieval alone copies sentences and misses stance. Retrieval is step 3 of 5, scoped to
  "pull 3–5 exemplars for register", with a lint that rejects verbatim reuse of a single exemplar.
- **Not fine-tuning**: it cannot be inspected or corrected line by line, and it ties the voice to one model.

## Layers

| Layer | Artifact | Produced by |
|---|---|---|
| L0 corpus | `out/<login>/corpus.jsonl`, `labels.jsonl` | harvest, normalize, label |
| L1 spec | `style.md`, `norms.json` (measured) · playbooks, principles, boundaries, anti-patterns, voice-notes (distilled) | gen_style · distilling agent |
| L2 retrieval | `voice.sqlite` (FTS5) + `voice search` | voice_index |
| L3 process | `SKILL.md` workflow + `voice lint` | assemble |

Measured and interpreted content never mix in one file: `style.md` numbers are regenerated, prose is written by an
agent and anchored to URLs.

## Decisions

- **All repositories, one window.** Role (own thread vs. someone else's) is inferred per record from thread authorship,
  not from a repository allowlist. Voice differs more by role than by repo.
- **Era anchor.** Late-period texts define the voice; the whole window supplies drift tables and contrast.
- **Cheap-model labeling** in batches of 120 with mechanical pre-labels for bot commands and reactions, then a hand
  check. Labels drive playbooks, search filters and the eval stratification.
- **Formula-aware plagiarism check.** A 5-gram that appears in three or more corpus texts is a ritual and allowed;
  one found in fewer is a copy of a single exemplar and fails the lint. N-grams never span a sentence boundary.
- **Boundaries are hand-backs, not rules.** The agent never decides the things the subject decided personally; it
  emits `DECISION NEEDED: …` and stops.
- **Disclosure is mandatory and lint-enforced.** Template in config; the harness name is filled in at posting time.
- **No gifs or images** in agent-written text, regardless of the subject's own history.
- **Docker-first scripts.** `scripts/voice` runs the stdlib-only Python tools in `python:3.12-slim` with no network and
  same-path read-only mounts, falling back to host Python. The tools stay dependency-free so both paths are identical.
- **Leak-free eval.** The retrieval DB used during evaluation excludes every hold-out thread, not just the hidden reply.

## Evaluation

Hold-out of real late-era threads where someone else wrote before the subject; the subject's reply is the hidden
reference. Two conditions (with skill, baseline) are drafted by the same model and judged on five axes, two points
each: stance match, length, register, concreteness, disclosure. The eval measures the skill, so retrieval must not see
the answer.
