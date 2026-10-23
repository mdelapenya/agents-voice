// Every pipeline script reads its subject (GitHub login), time window and output paths from
// voice.config.json, written by `node setup.mjs <login>`. Nothing user-specific lives in code.
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.env.VOICE_CONFIG ? resolve(process.env.VOICE_CONFIG) : join(REPO, "voice.config.json");
if (!existsSync(file)) {
  console.error(`No ${file}. Run: node setup.mjs <github-login> [--from YYYY-MM] [--to YYYY-MM] [--era YYYY]`);
  process.exit(2);
}
const raw = JSON.parse(readFileSync(file, "utf8"));
for (const k of ["login", "window"]) if (!raw[k]) { console.error(`voice.config.json: missing "${k}"`); process.exit(2); }

export const cfg = {
  login: raw.login,
  name: raw.name || raw.login,
  pronoun: raw.pronoun || "they",          // used only in generated prose: "they", "he", "she"
  window: raw.window,                      // { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }, half-open [from, to)
  era: raw.era || raw.window.from,         // texts from this date on define the current voice
  disclosure: raw.disclosure || "🤖 Written assisted by my {harness}",
  skillName: raw.skillName || `${raw.login}-voice`,
  out: resolve(REPO, raw.out || `out/${raw.login}`),
};
cfg.raw = join(cfg.out, "raw");
cfg.skill = join(cfg.out, "skill");
cfg.labelDir = join(cfg.out, "label");
cfg.eval = join(cfg.out, "eval");
cfg.corpus = join(cfg.out, "corpus.jsonl");
cfg.labels = join(cfg.out, "labels.jsonl");
cfg.db = join(cfg.out, "voice.sqlite");
cfg.log = join(cfg.out, "harvest.log");
for (const d of [cfg.raw, cfg.skill, cfg.labelDir, cfg.eval]) mkdirSync(d, { recursive: true });

// Calendar months covering the window, as GitHub search `created:` ranges.
export const months = (() => {
  const out = [];
  let d = new Date(cfg.window.from + "T00:00:00Z");
  const end = new Date(cfg.window.to + "T00:00:00Z");
  while (d < end) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, mm = String(m).padStart(2, "0");
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    out.push({ key: `${y}-${mm}`, range: `${y}-${mm}-01..${y}-${mm}-${last}` });
    d = new Date(Date.UTC(y, m, 1));
  }
  return out;
})();

export const readJsonl = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
export const inWindow = (iso) => iso >= cfg.window.from && iso < cfg.window.to;
