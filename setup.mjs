// node setup.mjs <github-login> [--from YYYY-MM] [--to YYYY-MM] [--era YYYY] [--name "Full Name"] [--pronoun they|he|she] [--out dir]
// Writes voice.config.json. Defaults: window from the account's creation month to this month; era = last three years.
import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const login = argv.find((a) => !a.startsWith("--"));
if (!login) { console.error("usage: node setup.mjs <github-login> [--from YYYY-MM] [--to YYYY-MM] [--era YYYY] [--name ...] [--pronoun ...] [--out dir]"); process.exit(2); }
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

let profile = {};
try { profile = JSON.parse(execFileSync("gh", ["api", `users/${login}`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })); }
catch (e) { console.error(`warning: could not read users/${login} via gh (${String(e.stderr || e.message).trim().slice(0, 120)}); using defaults`); }

const now = new Date();
const firstOfMonth = (ym) => `${ym}-01`;
const nextMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`; };
const from = firstOfMonth(opt("from") ?? (profile.created_at ? profile.created_at.slice(0, 7) : `${now.getUTCFullYear() - 5}-01`));
const to = nextMonth(opt("to") ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`);  // --to is inclusive month; stored half-open
const eraYear = opt("era") ?? String(Number(to.slice(0, 4)) - 3);

const config = {
  login,
  name: opt("name") ?? profile.name ?? login,
  pronoun: opt("pronoun") ?? "they",
  window: { from, to },
  era: `${eraYear}-01-01`,
  disclosure: "🤖 Written assisted by my {harness}",
  skillName: `${login}-voice`,
  out: opt("out") ?? `out/${login}`,
};
if (existsSync("voice.config.json") && !argv.includes("--force")) { console.error("voice.config.json exists; pass --force to overwrite"); process.exit(1); }
writeFileSync("voice.config.json", JSON.stringify(config, null, 2) + "\n");
console.log(JSON.stringify(config, null, 2));
console.log(`\nNext: node pipeline/harvest.mjs && node pipeline/review-comments.mjs && node pipeline/normalize.mjs`);
