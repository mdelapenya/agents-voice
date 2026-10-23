// Build labeling chunks from corpus.jsonl. Mechanical pre-labels go straight to <out>/label/out/.
// Usage: node label/prepare.mjs [kinds=comment,review] [prefix=chunk]   e.g. `node label/prepare.mjs review_comment rc`
import { writeFileSync, mkdirSync } from "node:fs";
import { cfg, readJsonl } from "../lib/config.mjs";
const rows = readJsonl(cfg.corpus);
mkdirSync(cfg.labelDir + "/in", { recursive: true }); mkdirSync(cfg.labelDir + "/out", { recursive: true });
const KINDS = new Set(process.argv[2]?.split(",") ?? ["comment", "review"]);
const PREFIX = process.argv[3] ?? "chunk"; // e.g. `node prepare.mjs review_comment rc` -> in/rc-NN.jsonl, out/prelabeled-rc.jsonl
const GIF = /!\[[^\]]*\]\(https?:\/\/(media\.)?giphy\.com[^)]*\)|giphy\.com\/media/i;
const strip = (b) => b.replace(GIF, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, "").trim();
const pre = [], todo = [];
for (const r of rows) {
  if (!KINDS.has(r.kind)) continue;
  const gif = GIF.test(r.body), text = strip(r.body);
  const base = { id: r.url, gif };
  if (/^(\/test|\/retest|@dependabot|@renovate|run tests|\/run-tests)/i.test(text) ) pre.push({ ...base, primary: "bot-command", secondary: null, audience: "bot", tone: "neutral" });
  else if (text.split(/\s+/).filter(Boolean).length <= 2 && !/\?/.test(text)) pre.push({ ...base, primary: /lgtm/i.test(text) ? "approve" : "reaction", secondary: /thank/i.test(text) ? "thank" : null, audience: "unknown", tone: "warm" });
  else todo.push({ id: r.url, kind: r.kind, role: r.ownThread ? "own-thread" : "others-thread", threadKind: r.threadKind, threadTitle: r.threadTitle, threadAuthor: r.threadAuthor, reviewState: r.reviewState ?? undefined, path: r.path ?? undefined, hunk: r.diffHunk ? r.diffHunk.split("\n").slice(-6).join("\n").slice(0, 500) : undefined, year: r.createdAt.slice(0, 4), gif, body: r.body.replace(GIF, "[gif]").slice(0, 900) });
}
writeFileSync(`${cfg.labelDir}/out/prelabeled-${PREFIX}.jsonl`, pre.map((x) => JSON.stringify(x)).join("\n") + "\n");
const SIZE = 120; let n = 0;
for (let i = 0; i < todo.length; i += SIZE) writeFileSync(`${cfg.labelDir}/in/${PREFIX}-${String(++n).padStart(2, "0")}.jsonl`, todo.slice(i, i + SIZE).map((x) => JSON.stringify(x)).join("\n") + "\n");
console.log(JSON.stringify({ prelabeled: pre.length, toLabel: todo.length, chunks: n }));
