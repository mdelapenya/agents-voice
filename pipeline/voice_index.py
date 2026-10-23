#!/usr/bin/env python3
"""Build and query the voice FTS5 index. Stdlib only. Paths come from voice.config.json (or $VOICE_CONFIG).

  python3 pipeline/voice_index.py build [--exclude holdout.jsonl] [--out db]   # <out>/corpus.jsonl (+ labels.jsonl) -> <out>/voice.sqlite
  python3 pipeline/voice_index.py search "flaky test" --act decline --role other --kind comment --since 2023 -n 5
"""
import argparse, json, os, sqlite3, sys, re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_cfg_path = os.environ.get("VOICE_CONFIG") or os.path.join(REPO, "voice.config.json")
if not os.path.exists(_cfg_path):
    sys.exit(f"No {_cfg_path}. Run: node setup.mjs <github-login>")
_cfg = json.load(open(_cfg_path, encoding="utf-8"))
OUT = os.path.join(REPO, _cfg.get("out") or f"out/{_cfg['login']}")
CORPUS, LABELS = os.path.join(OUT, "corpus.jsonl"), os.path.join(OUT, "labels.jsonl")
DB = os.environ.get("VOICE_DB") or os.path.join(OUT, "voice.sqlite")
GIF = re.compile(r"!\[[^\]]*\]\((https?://(?:media\.)?giphy\.com[^)]*)\)")

def build(args):
    excl = set()
    if getattr(args, "exclude", None):
        for line in open(args.exclude, encoding="utf-8"):
            if line.strip(): excl.add(json.loads(line)["id"].split("#")[0])  # exclude the whole thread, not just the reply
    global DB
    if getattr(args, "out", None): DB = args.out
    labels = {}
    lp = LABELS
    if os.path.exists(lp):
        for line in open(lp, encoding="utf-8"):
            if line.strip():
                x = json.loads(line); labels[x["id"]] = x
    if os.path.exists(DB): os.remove(DB)
    db = sqlite3.connect(DB)
    db.executescript("""
    CREATE TABLE rec(id TEXT PRIMARY KEY, kind TEXT, role TEXT, repo TEXT, year INT, created TEXT,
        thread TEXT, thread_title TEXT, thread_author TEXT, review_state TEXT, path TEXT,
        act TEXT, act2 TEXT, audience TEXT, tone TEXT, gif TEXT, words INT, body TEXT);
    CREATE VIRTUAL TABLE fts USING fts5(body, thread_title, content='rec', content_rowid='rowid', tokenize='porter unicode61');
    CREATE INDEX rec_act ON rec(act, role, kind, year);
    """)
    n = 0
    for line in open(CORPUS, encoding="utf-8"):
        if not line.strip(): continue
        r = json.loads(line)
        if r.get("bot"): continue
        if excl and ((r.get("thread") or r["url"]).split("#")[0] in excl): continue
        lab = labels.get(r["url"], {})
        role = "own" if r.get("ownThread") else ("other" if r.get("ownThread") is False else None)
        if r["kind"] in ("issue", "pr"): role = "own"
        gifs = GIF.findall(r["body"])
        db.execute("INSERT INTO rec VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
            r["url"], r["kind"], role, r.get("repo"), int(r["createdAt"][:4]), r["createdAt"],
            r.get("thread") or r["url"], r.get("threadTitle") or r.get("title"), r.get("threadAuthor"),
            r.get("reviewState"), r.get("path"), lab.get("primary"), lab.get("secondary"), lab.get("audience"),
            lab.get("tone"), gifs[0] if gifs else None, len(r["body"].split()), r["body"]))
        n += 1
    db.execute("INSERT INTO fts(fts) VALUES('rebuild')")
    db.commit()
    print(json.dumps({"records": n, "labeled": sum(1 for _ in db.execute("SELECT 1 FROM rec WHERE act IS NOT NULL")), "db": DB}))

def search(args):
    db = sqlite3.connect(DB)
    where, params = [], []
    if args.query:
        where.append("rec.rowid IN (SELECT rowid FROM fts WHERE fts MATCH ?)"); params.append(args.query)
    for col, val in (("act", args.act), ("role", args.role), ("kind", args.kind), ("audience", args.audience), ("repo", args.repo)):
        if val: where.append(f"{col} = ?"); params.append(val)
    if args.since: where.append("year >= ?"); params.append(int(args.since))
    if args.min_words: where.append("words >= ?"); params.append(args.min_words)
    if args.gif: where.append("gif IS NOT NULL")
    sql = "SELECT id, kind, role, year, act, audience, tone, thread_title, body FROM rec"
    if where: sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY year DESC, RANDOM() LIMIT ?"; params.append(args.n)
    rows = db.execute(sql, params).fetchall()
    if args.json:
        print(json.dumps([dict(zip(("id","kind","role","year","act","audience","tone","thread_title","body"), r)) for r in rows], indent=1)); return
    for r in rows:
        print(f"--- {r[0]}\n[{r[1]}/{r[2]} {r[3]} act={r[4]} aud={r[5]} tone={r[6]}] {r[7] or ''}\n{r[8].strip()}\n")
    if not rows: print("no matches", file=sys.stderr)

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sp = p.add_subparsers(dest="cmd", required=True)
b = sp.add_parser("build"); b.set_defaults(fn=build); b.add_argument("--exclude", help="holdout.jsonl whose threads are left out"); b.add_argument("--out", help="db path")
s = sp.add_parser("search"); s.set_defaults(fn=search)
s.add_argument("query", nargs="?", default=None, help="FTS5 query, e.g. 'flaky test' or 'docs AND module'")
for f in ("act", "role", "kind", "audience", "repo", "since"): s.add_argument(f"--{f}")
s.add_argument("-n", type=int, default=5); s.add_argument("--min-words", type=int); s.add_argument("--gif", action="store_true"); s.add_argument("--json", action="store_true")
argv = sys.argv[1:]
if argv and argv[0] not in ("build", "search", "-h", "--help"): argv = ["search"] + argv  # bare query defaults to search
a = p.parse_args(argv); a.fn(a)
