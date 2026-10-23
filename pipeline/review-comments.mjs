// Inline PR review comments by the configured user: list reviewed PRs per month (GraphQL search), then REST per PR.
// Resumable via raw/review-comments.done.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cfg, months } from "../lib/config.mjs";
const USER = cfg.login, RAW = cfg.raw;
const log = (l) => { console.log(l); appendFileSync(cfg.log, `[${new Date().toISOString()}] rc ${l}\n`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function gh(args) {
  for (let a = 0; a < 6; a++) {
    try { return JSON.parse(execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] })); }
    catch (e) { const m = String(e.stderr || e.message); if (/404/.test(m)) return null; log(`backoff(${a}): ${m.slice(0, 160)}`); execFileSync("sleep", [String(60 * (a + 1))]); }
  }
  throw new Error("gh failed");
}
const LIST_Q = `query($q:String!,$after:String){ rateLimit{remaining resetAt} search(type:ISSUE,query:$q,first:100,after:$after){ issueCount pageInfo{hasNextPage endCursor} nodes{ ... on PullRequest{ number url author{login} repository{nameWithOwner} reviewThreads{totalCount} } } } }`;
// Phase C1: list PRs
const listFile = join(RAW, "reviewed-prs.jsonl");
if (!existsSync(listFile)) {
  const rows = [];
  for (const m of months) {
    const q = `reviewed-by:${USER} is:pr created:${m.range}`;
    let after = null;
    while (true) {
      const res = gh(["api", "graphql", "-f", `query=${LIST_Q}`, "-f", `q=${q}`, ...(after ? ["-f", `after=${after}`] : [])]);
      const s = res.data.search; rows.push(...s.nodes.filter((n) => n?.url));
      if (s.issueCount > 1000) log(`WARN ${m.key} ${s.issueCount} > cap`);
      if (!s.pageInfo.hasNextPage) break; after = s.pageInfo.endCursor; await sleep(200);
    }
    log(`list ${m.key}: ${rows.length} cumulative`);
  }
  writeFileSync(listFile, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}
// Phase C2: per-PR inline comments (REST), resumable via progress file
const prs = readFileSync(listFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const outFile = join(RAW, "review-comments.jsonl"), doneFile = join(RAW, "review-comments.done");
const done = new Set(existsSync(doneFile) ? readFileSync(doneFile, "utf8").split("\n").filter(Boolean) : []);
let i = 0, mine = 0;
for (const pr of prs) {
  i++;
  if (done.has(pr.url)) continue;
  if (pr.reviewThreads.totalCount === 0) { appendFileSync(doneFile, pr.url + "\n"); continue; }
  const [owner, name] = pr.repository.nameWithOwner.split("/");
  let page = 1;
  while (true) {
    const rows = gh(["api", `repos/${owner}/${name}/pulls/${pr.number}/comments?per_page=100&page=${page}`]);
    if (!rows) break;
    for (const c of rows) if (c.user?.login === USER) { mine++; appendFileSync(outFile, JSON.stringify({ repo: pr.repository.nameWithOwner, pr: pr.url, prAuthor: pr.author?.login ?? null, html_url: c.html_url, path: c.path, diff_hunk: c.diff_hunk, body: c.body, created_at: c.created_at, in_reply_to_id: c.in_reply_to_id ?? null }) + "\n"); }
    if (rows.length < 100) break; page++;
  }
  appendFileSync(doneFile, pr.url + "\n");
  if (i % 100 === 0) { log(`prs ${i}/${prs.length}, mine ${mine}`); const rl = gh(["api", "rate_limit"]).resources.core; if (rl.remaining < 200) { const w = rl.reset * 1000 - Date.now() + 5000; log(`REST remaining ${rl.remaining}; sleeping ${Math.round(w / 1000)}s`); await sleep(w); } }
  await sleep(150);
}
log(`done review-comments: ${mine} inline comments`);
