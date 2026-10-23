// Hold-out set: era texts in others' threads with the preceding context, the subject's reply hidden in `reference`.
// Usage: node eval/build_holdout.mjs [n=100]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { cfg, readJsonl } from "../lib/config.mjs";
const RAW = cfg.raw + "/", USER = cfg.login, N = Number(process.argv[2] ?? 100), ERA = cfg.era.slice(0, 7);
const labels = new Map(readJsonl(cfg.labels).map((x) => [x.id, x]));
const items = [];
for (const f of readdirSync(RAW).filter((f) => f.startsWith("commented-") && f.slice(10, 17) >= ERA)) {
  for (const line of readFileSync(RAW + f, "utf8").split("\n").filter(Boolean)) {
    const t = JSON.parse(line);
    if (t.author?.login === USER) continue;
    const comments = (t.comments?.nodes ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    comments.forEach((c, i) => {
      if (c.author?.login !== USER) return;
      const lab = labels.get(c.url); if (!lab || ["bot-command", "reaction", "other"].includes(lab.primary)) return;
      if (c.body.trim().split(/\s+/).length < 8) return;
      const prior = comments.slice(Math.max(0, i - 3), i).filter((p) => p.author?.login !== USER);
      if (!prior.length && i > 0) return;
      items.push({ id: c.url, repo: t.repository.nameWithOwner, threadKind: t.__typename, threadTitle: t.title, threadAuthor: t.author?.login,
        context: prior.map((p) => ({ author: p.author?.login, body: p.body.slice(0, 1500) })), act: lab.primary, audience: lab.audience, reference: c.body });
    });
  }
}
// stratify: cap any act at 25% so approve/explain don't swamp the set
const byAct = {}; for (const it of items) (byAct[it.act] ??= []).push(it);
const cap = Math.ceil(N / 4), out = [];
for (const [, arr] of Object.entries(byAct).sort((a, b) => a[1].length - b[1].length)) { arr.sort(() => Math.random() - 0.5); out.push(...arr.slice(0, cap)); }
out.sort(() => Math.random() - 0.5);
const final = out.slice(0, N);
writeFileSync(cfg.eval + "/holdout.jsonl", final.map((x) => JSON.stringify(x)).join("\n") + "\n");
console.log(JSON.stringify({ candidates: items.length, selected: final.length, byAct: Object.fromEntries(Object.entries(final.reduce((m, x) => ((m[x.act] = (m[x.act] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1])) }));
