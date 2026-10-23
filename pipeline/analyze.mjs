import { readFileSync } from "node:fs";
const rows = readFileSync(new URL("./corpus.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean).map(JSON.parse)
  .filter((r) => !r.bot);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const pct = (n, d) => d ? Math.round((n / d) * 1000) / 10 : 0;
const strip = (b) => b.replace(/```[\s\S]*?```/g, " ").replace(/<!--[\s\S]*?-->/g, " ");
const groups = {};
for (const r of rows) { const k = `${r.kind}${r.kind === "comment" || r.kind === "review" || r.kind === "review_comment" ? (r.ownThread ? "/own" : "/other") : ""}`; (groups[k] ??= []).push(r); }
const table = [];
for (const [k, rs] of Object.entries(groups)) {
  const bodies = rs.map((r) => strip(r.body));
  const words = bodies.map((b) => b.trim().split(/\s+/).filter(Boolean).length);
  const has = (re) => pct(bodies.filter((b) => re.test(b)).length, bodies.length);
  table.push({ group: k, n: rs.length, medWords: med(words), p90Words: [...words].sort((a, b) => a - b)[Math.floor(words.length * 0.9)],
    emoji: has(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u), exclaim: has(/!/), question: has(/\?/), codeBlock: pct(rs.filter((r) => /```/.test(r.body)).length, rs.length),
    inlineCode: has(/`[^`]+`/), bullets: has(/^\s*[-*] /m), headers: has(/^#+ /m), mentions: has(/@\w+/), please: has(/\bplease\b/i), thanks: has(/\bthank/i),
    lgtm: has(/\bLGTM\b/i), nit: has(/\bnit\b/i), wdyt: has(/\bWDYT\b/i), iThink: has(/\bI think\b/), weShould: has(/\bwe (should|could|need)\b/i), sorry: has(/\bsorry\b/i), link: has(/https?:\/\//) });
}
console.table(table);
// Openers and closers across comments in others' threads
const others = rows.filter((r) => (r.kind === "comment" || r.kind === "review") && !r.ownThread);
const first = (b) => strip(b).trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase().replace(/[^a-z@ ]/g, "");
const count = (arr) => Object.entries(arr.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log("\nTop openers (others' threads):", count(others.map((r) => first(r.body))));
const lastWord = (b) => { const t = strip(b).trim().split("\n").filter(Boolean); return (t[t.length - 1] || "").trim().slice(0, 40).toLowerCase(); };
console.log("\nTop closing lines:", count(others.map((r) => lastWord(r.body))).filter(([, n]) => n > 15));
// Frequent phrases (bigrams/trigrams) in others' threads
const grams = (n) => { const m = {}; for (const r of others) { const w = strip(r.body).toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter(Boolean); for (let i = 0; i + n <= w.length; i++) { const g = w.slice(i, i + n).join(" "); m[g] = (m[g] || 0) + 1; } } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
console.log("\nTop trigrams:", grams(3).slice(0, 40).map(([g, n]) => `${g} (${n})`).join(" | "));
// Review state distribution
const rev = rows.filter((r) => r.kind === "review" && !r.ownThread);
console.log("\nReview states (others' PRs):", count(rev.map((r) => r.reviewState)));
console.log("Review with empty-ish body (<5 words):", pct(rev.filter((r) => strip(r.body).trim().split(/\s+/).length < 5).length, rev.length), "%");
// Issue structure: how often his issues have headers / repro
const iss = rows.filter((r) => r.kind === "issue");
console.log("\nIssues: headers", pct(iss.filter((r) => /^#+ /m.test(r.body)).length, iss.length), "% | 'steps to reproduce'", pct(iss.filter((r) => /reproduc/i.test(r.body)).length, iss.length), "% | 'expected'", pct(iss.filter((r) => /expected/i.test(r.body)).length, iss.length), "% | template-ish (<!--)", pct(iss.filter((r) => /<!--/.test(r.body)).length, iss.length), "%");
const prs = rows.filter((r) => r.kind === "pr");
console.log("PRs: headers", pct(prs.filter((r) => /^#+ /m.test(r.body)).length, prs.length), "% | 'What does this PR do'", pct(prs.filter((r) => /what does this/i.test(r.body)).length, prs.length), "% | 'Why is it important'", pct(prs.filter((r) => /why is it important/i.test(r.body)).length, prs.length), "% | mentions issue #", pct(prs.filter((r) => /(closes|fixes|resolves|related)\s*#\d+|#\d+/i.test(r.body)).length, prs.length), "% | checklist", pct(prs.filter((r) => /- \[[ x]\]/i.test(r.body)).length, prs.length), "%");
// Era drift: med words and emoji by year for others' comments
const byYear = {};
for (const r of others) (byYear[r.createdAt.slice(0, 4)] ??= []).push(r);
console.log("\nEra drift (others' comments):", Object.entries(byYear).map(([y, rs]) => `${y}: n=${rs.length} med=${med(rs.map((r) => strip(r.body).split(/\s+/).length))} emoji=${pct(rs.filter((r) => /[\u{1F300}-\u{1FAFF}]/u.test(r.body)).length, rs.length)}%`).join(" | "));
