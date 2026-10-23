// Flatten raw/*.jsonl into corpus.jsonl: one record per text the configured user wrote, plus stats.json.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cfg, inWindow } from "../lib/config.mjs";
const USER = cfg.login, RAW = cfg.raw;
const read = (f) => readFileSync(join(RAW, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const files = readdirSync(RAW);
const out = [], seen = new Set();
const push = (r) => { if (!r.body || !r.body.trim() || seen.has(r.url)) return; seen.add(r.url); out.push(r); };
const isBot = (b) => /^<!--.*(renovate|dependabot)|^This PR contains the following updates|^Bumps \[/i.test(b.trim());
for (const f of files.filter((f) => f.startsWith("issues-"))) for (const n of read(f))
  push({ kind: "issue", repo: n.repository.nameWithOwner, url: n.url, createdAt: n.createdAt, title: n.title, body: n.body, labels: n.labels.nodes.map((l) => l.name), state: n.state });
for (const f of files.filter((f) => f.startsWith("prs-"))) for (const n of read(f))
  push({ kind: "pr", repo: n.repository.nameWithOwner, url: n.url, createdAt: n.createdAt, title: n.title, body: n.body, labels: n.labels.nodes.map((l) => l.name), state: n.merged ? "MERGED" : n.state, size: n.additions + n.deletions, files: n.changedFiles, bot: isBot(n.body || "") });
for (const f of files.filter((f) => f.startsWith("commented-"))) for (const t of read(f)) {
  const ctx = { repo: t.repository.nameWithOwner, thread: t.url, threadTitle: t.title, threadKind: t.__typename, threadAuthor: t.author?.login ?? null, ownThread: t.author?.login === USER };
  for (const c of t.comments?.nodes ?? []) if (c.author?.login === USER) push({ kind: "comment", ...ctx, url: c.url, createdAt: c.createdAt, body: c.body });
  for (const r of t.reviews?.nodes ?? []) if (r.author?.login === USER) push({ kind: "review", reviewState: r.state, ...ctx, url: r.url, createdAt: r.submittedAt, body: r.body });
}
if (files.includes("comments-overflow.jsonl")) for (const c of read("comments-overflow.jsonl")) push({ kind: "comment", thread: c.thread, url: c.url, createdAt: c.createdAt, body: c.body });
if (files.includes("review-comments.jsonl")) for (const c of read("review-comments.jsonl"))
  push({ kind: "review_comment", repo: c.repo, thread: c.pr, threadAuthor: c.prAuthor, ownThread: c.prAuthor === USER, inReplyTo: c.in_reply_to_id, url: c.html_url, createdAt: c.created_at, path: c.path, diffHunk: c.diff_hunk, body: c.body });
const kept = out.filter((r) => inWindow(r.createdAt));
out.length = 0; out.push(...kept);
out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
writeFileSync(cfg.corpus, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
const by = (k) => out.reduce((m, r) => ((m[r[k] ?? "?"] = (m[r[k] ?? "?"] || 0) + 1), m), {});
const top = (o, n = 25) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n));
const words = out.reduce((s, r) => s + r.body.split(/\s+/).length, 0);
const stats = { records: out.length, words, byKind: by("kind"), byYear: top(out.reduce((m, r) => ((m[r.createdAt.slice(0, 4)] = (m[r.createdAt.slice(0, 4)] || 0) + 1), m), {}), 10), topRepos: top(by("repo"), 30), ownVsOthers: { ownThread: out.filter((r) => r.ownThread === true).length, othersThread: out.filter((r) => r.ownThread === false).length } };
writeFileSync(join(cfg.out, "stats.json"), JSON.stringify(stats, null, 2));
console.log(JSON.stringify(stats, null, 2));
