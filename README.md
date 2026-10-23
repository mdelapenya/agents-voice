# agents-voice

> [!NOTE]
> I created this song (in Spanish) to represent this repo: https://suno.com/s/rWFj7L6CEOXVcwB5

Build an [Agent Skill](https://agentskills.io) that lets coding agents (Claude Code, Codex, Cursor, …) write public
GitHub text in a real maintainer's voice: their stance, their length, their rituals, their boundaries. The input is
that maintainer's own GitHub history; the output is a skill directory any harness can load.

Agent-written text always ends with a disclosure line, by default `🤖 Written assisted by my <Harness>`.

## How it works

1. **Harvest** every issue, PR body, comment, review summary and inline review comment the subject wrote in a time
   window, across all repositories, through `gh` (GraphQL search sharded by month, REST for inline comments).
2. **Normalize** into one JSONL corpus with role (own thread vs. someone else's), genre, thread context.
3. **Label** each text's speech act (approve, decline, ask-info, …), audience and tone with a cheap model in batches.
4. **Measure** lengths, rituals, punctuation, review verdicts and drift per genre → `style.md` + `norms.json`.
5. **Index** the corpus in SQLite FTS5 (stdlib only) so the skill can pull real exemplars at drafting time.
6. **Distill** (an agent reads the corpus): playbooks per act, technical principles, boundaries the agent must hand
   back, anti-patterns, voice notes. Every claim carries the URL of a real text.
7. **Assemble** the skill: `SKILL.md` + `references/` + `scripts/voice` (search and lint, Docker-first).
8. **Evaluate** on a hold-out of real threads: with-skill vs. baseline drafts, judged against the hidden real reply.

The design and the reasons behind it are in [DESIGN.md](DESIGN.md).

## Requirements

- Node 20+, Python 3.10+ with the stdlib `sqlite3` module (FTS5 enabled, which every mainstream build has).
- `gh` authenticated for the harvest. No npm or pip dependencies.
- Docker is optional. When present, the skill runs its Python tools in `python:3.12-slim`; otherwise it uses host Python.

## Build a voice

```bash
node setup.mjs <github-login> --from 2019-05 --to 2025-08 --era 2023   # writes voice.config.json
npm run harvest          # resumable; a 15k-text history takes a few hours of API time
npm run normalize        # -> out/<login>/corpus.jsonl + stats.json
npm run label:prepare    # chunks for the labeling model; then follow label/LABEL.md
npm run label:merge      # -> out/<login>/labels.jsonl
npm run style            # -> out/<login>/skill/references/{style.md,norms.json}
npm run index            # -> out/<login>/voice.sqlite
# distill: point a strong agent at distill/DISTILL.md; it writes the playbooks and principles
npm run assemble         # -> out/<login>/skill/SKILL.md, scripts; reports missing references
```

Everything under `out/` and `voice.config.json` is gitignored: it is one person's history and belongs to them.

## Install the skill

Copy or symlink `out/<login>/skill/` into the harness's skills directory (for Claude Code,
`~/.claude/skills/<login>-voice`) and put `voice.sqlite` next to the skill directory, or set `VOICE_DB`.

Agents call `scripts/voice search …` and `scripts/voice lint …`, never the `.py` files. The wrapper runs them in
Docker (`--network none`, your uid, skill and DB mounted read-only at their host paths) when `docker info`
succeeds and falls back to host `python3` otherwise. `VOICE_RUNTIME=host` forces the fallback; `VOICE_PY_IMAGE`
pins another image.

## Evaluate

```bash
npm run eval:holdout                          # 100 real threads, the subject's reply hidden; leak-free retrieval DB
node eval/render.mjs 20 with-skill > /tmp/with.md
node eval/render.mjs 20 baseline   > /tmp/base.md
# have an agent answer each prompt, then score with eval/JUDGE.md against the hidden reference
```

## Layout

- `setup.mjs`, `lib/config.mjs` — subject, window, era, disclosure, output paths.
- `pipeline/` — `harvest.mjs`, `review-comments.mjs`, `normalize.mjs`, `gen_style.mjs`, `voice_index.py`, `assemble.mjs`, `analyze.mjs`.
- `label/` — `TAXONOMY.md`, `LABEL.md`, `prepare.mjs`, `merge.mjs`.
- `distill/DISTILL.md` — instructions for the agent that writes the interpretive references.
- `skill-template/` — `SKILL.md` with placeholders and the `scripts/` shipped inside every generated skill.
- `eval/` — hold-out builder, prompt renderer, judge rubric.

## License

MIT.
