// Harvest the configured user's GitHub activity (issues, PRs, comment threads, review summaries) via `gh`.
// Sharded by month because GitHub search caps at 1000 results per query. Resumable: one file per month.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cfg, months } from "../lib/config.mjs";

const USER = cfg.login, RAW = cfg.raw;
const log = (...a) => { const l = `[${new Date().toISOString()}] ${a.join(" ")}`; console.log(l); appendFileSync(cfg.log, l + "\n"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function gql(query, variables) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [k, v] of Object.entries(variables)) { if (v === null) continue; args.push(typeof v === "number" ? "-F" : "-f", `${k}=${v}`); }
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const out = execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
      return JSON.parse(out);
    } catch (e) {
      const msg = String(e.stderr || e.message);
      if (/rate limit|secondary|abuse|502|503|timeout/i.test(msg)) { log(`backoff(${attempt}): ${msg.slice(0, 160)}`); execFileSync("sleep", [String(60 * (attempt + 1))]); continue; }
      throw e;
    }
  }
  throw new Error("gql failed after retries");
}

async function guardRate(rl) {
  if (!rl) return;
  if (rl.remaining < 150) {
    const wait = Math.max(5, (new Date(rl.resetAt) - Date.now()) / 1000 + 5);
    log(`rate remaining ${rl.remaining}; sleeping ${Math.round(wait)}s until ${rl.resetAt}`);
    await sleep(wait * 1000);
  }
}

const AUTHORED_Q = `
query($q:String!,$after:String){ rateLimit{remaining resetAt}
 search(type:ISSUE,query:$q,first:100,after:$after){ issueCount pageInfo{hasNextPage endCursor}
  nodes{ __typename
   ... on Issue{ number title body createdAt closedAt url state repository{nameWithOwner} labels(first:10){nodes{name}} comments{totalCount} }
   ... on PullRequest{ number title body createdAt closedAt url state merged additions deletions changedFiles repository{nameWithOwner} labels(first:10){nodes{name}} comments{totalCount} }
 }}}`;

const COMMENTED_Q = `
query($q:String!,$after:String){ rateLimit{remaining resetAt}
 search(type:ISSUE,query:$q,first:25,after:$after){ issueCount pageInfo{hasNextPage endCursor}
  nodes{ __typename
   ... on Issue{ number title createdAt url state author{login} repository{nameWithOwner}
     comments(first:50){ totalCount pageInfo{hasNextPage endCursor} nodes{ author{login} body createdAt url } } }
   ... on PullRequest{ number title createdAt url state merged author{login} repository{nameWithOwner}
     comments(first:50){ totalCount pageInfo{hasNextPage endCursor} nodes{ author{login} body createdAt url } }
     reviews(first:30){ totalCount nodes{ author{login} body state submittedAt url } } }
 }}}`;

const MORE_COMMENTS_Q = `
query($owner:String!,$name:String!,$number:Int!,$after:String){ rateLimit{remaining resetAt}
 repository(owner:$owner,name:$name){ issueOrPullRequest(number:$number){
   ... on Issue{ comments(first:100,after:$after){ pageInfo{hasNextPage endCursor} nodes{ author{login} body createdAt url } } }
   ... on PullRequest{ comments(first:100,after:$after){ pageInfo{hasNextPage endCursor} nodes{ author{login} body createdAt url } } } } } }`;

async function searchAll(kind, qualifier, query) {
  for (const m of months) {
    const file = join(RAW, `${kind}-${m.key}.jsonl`);
    if (existsSync(file)) continue;
    const q = `${qualifier} created:${m.range}`;
    let after = null, rows = [], total = null, pages = 0;
    while (true) {
      const res = gql(query, { q, after });
      if (res.errors && !res.data?.search) throw new Error(JSON.stringify(res.errors).slice(0, 500));
      const s = res.data.search; total ??= s.issueCount; pages++;
      rows.push(...s.nodes.filter(Boolean));
      await guardRate(res.data.rateLimit);
      if (!s.pageInfo.hasNextPage) break;
      after = s.pageInfo.endCursor; await sleep(300);
    }
    if (total > 1000) log(`WARN ${kind} ${m.key} issueCount ${total} > 1000 cap`);
    writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
    log(`${kind} ${m.key}: ${rows.length}/${total} (${pages} pages)`);
  }
}

async function fillMissingComments() {
  // Threads with >50 comments: page the rest so later replies are not missed.
  const file = join(RAW, "comments-overflow.jsonl");
  if (existsSync(file)) return;
  const out = [];
  for (const m of months) {
    const f = join(RAW, `commented-${m.key}.jsonl`);
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n").filter(Boolean)) {
      const t = JSON.parse(line);
      if (!t.comments?.pageInfo?.hasNextPage) continue;
      const [owner, name] = t.repository.nameWithOwner.split("/");
      let after = t.comments.pageInfo.endCursor;
      while (after) {
        const res = gql(MORE_COMMENTS_Q, { owner, name, number: t.number, after });
        const c = res.data?.repository?.issueOrPullRequest?.comments; if (!c) break;
        for (const n of c.nodes) if (n.author?.login === USER) out.push({ thread: t.url, ...n });
        await guardRate(res.data.rateLimit);
        after = c.pageInfo.hasNextPage ? c.pageInfo.endCursor : null; await sleep(200);
      }
      log(`overflow ${t.url}: total ${t.comments.totalCount}`);
    }
  }
  writeFileSync(file, out.map((r) => JSON.stringify(r)).join("\n") + (out.length ? "\n" : ""));
}

const phase = process.argv[2] ?? "all";
if (phase === "all" || phase === "authored") {
  await searchAll("issues", `author:${USER} is:issue`, AUTHORED_Q);
  await searchAll("prs", `author:${USER} is:pr`, AUTHORED_Q);
}
if (phase === "all" || phase === "commented") {
  await searchAll("commented", `commenter:${USER}`, COMMENTED_Q);
  await fillMissingComments();
}
log("done", phase);
