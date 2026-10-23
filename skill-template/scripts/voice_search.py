#!/usr/bin/env python3
"""Search the subject's real GitHub texts (FTS5). Call through `scripts/voice search …`.

  voice search "flaky test" --act decline --role other --kind comment --since 2023 -n 5
  voice search --act approve --since 2024            # no query: filter only

Finds voice.sqlite beside this script, one or two directories above it, or at $VOICE_DB.
"""
import argparse, json, os, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("VOICE_DB") or next((p for p in (os.path.join(HERE, "voice.sqlite"), os.path.join(HERE, "..", "voice.sqlite"), os.path.join(HERE, "..", "..", "voice.sqlite")) if os.path.exists(p)), None)
if not DB or not os.path.exists(DB):
    sys.exit("voice.sqlite not found: put it beside the skill or set VOICE_DB")

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("query", nargs="?", default=None, help="FTS5 query, e.g. 'flaky test' or 'docs AND module'")
for f in ("act", "role", "kind", "audience", "repo", "since"): p.add_argument(f"--{f}")
p.add_argument("-n", type=int, default=5); p.add_argument("--min-words", type=int); p.add_argument("--json", action="store_true")
a = p.parse_args()

db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
where, params = [], []
if a.query: where.append("rec.rowid IN (SELECT rowid FROM fts WHERE fts MATCH ?)"); params.append(a.query)
for col, val in (("act", a.act), ("role", a.role), ("kind", a.kind), ("audience", a.audience), ("repo", a.repo)):
    if val: where.append(f"{col} = ?"); params.append(val)
if a.since: where.append("year >= ?"); params.append(int(a.since))
if a.min_words: where.append("words >= ?"); params.append(a.min_words)
sql = "SELECT id, kind, role, year, act, audience, tone, thread_title, body FROM rec"
if where: sql += " WHERE " + " AND ".join(where)
sql += " ORDER BY year DESC, RANDOM() LIMIT ?"; params.append(a.n)
rows = db.execute(sql, params).fetchall()
if a.json:
    print(json.dumps([dict(zip(("id", "kind", "role", "year", "act", "audience", "tone", "thread_title", "body"), r)) for r in rows], indent=1))
else:
    for r in rows: print(f"--- {r[0]}\n[{r[1]}/{r[2]} {r[3]} act={r[4]} aud={r[5]} tone={r[6]}] {r[7] or ''}\n{r[8].strip()}\n")
    if not rows: print("no matches", file=sys.stderr)
