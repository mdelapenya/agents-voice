// Assemble <out>/skill from skill-template + generated references + distilled references.
// Fills the SKILL.md placeholders, copies scripts, and reports which distill outputs are still missing.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { cfg, REPO, readJsonl } from "../lib/config.mjs";

const T = join(REPO, "skill-template"), S = cfg.skill, R = join(S, "references");
mkdirSync(join(S, "scripts"), { recursive: true }); mkdirSync(join(R, "playbooks"), { recursive: true });
for (const f of readdirSync(join(T, "scripts"), { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name)) { copyFileSync(join(T, "scripts", f), join(S, "scripts", f)); if (f === "voice") chmodSync(join(S, "scripts", f), 0o755); }

const P = { they: ["they", "their", "them"], he: ["he", "his", "him"], she: ["she", "her", "her"] }[cfg.pronoun] ?? ["they", "their", "them"];
const corpus = existsSync(cfg.corpus) ? readJsonl(cfg.corpus).length : 0;
const notesPath = join(R, "voice-notes.md");
const voiceNotes = existsSync(notesPath) ? `## Norms specific to ${cfg.name}\n\n` + readFileSync(notesPath, "utf8").replace(/^# .*\n+/, "").trim() + "\n" : "";
const month = (iso) => new Date(iso + "T00:00:00Z").toLocaleString("en", { month: "short", year: "numeric", timeZone: "UTC" });
const lastMonth = (iso) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(0); return month(d.toISOString().slice(0, 10)); };
const vars = {
  skillName: cfg.skillName, name: cfg.name, login: cfg.login, pronoun: P[0], possessive: P[1], object: P[2],
  corpusSize: corpus ? `~${(corpus / 1000).toFixed(1)}k` : "the harvested", windowFrom: month(cfg.window.from), windowTo: lastMonth(cfg.window.to),
  eraFrom: cfg.era.slice(0, 4), disclosure: cfg.disclosure, voiceNotes,
};
let md = readFileSync(join(T, "SKILL.md"), "utf8").replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in vars)) throw new Error(`unknown placeholder ${k}`); return vars[k]; });
writeFileSync(join(S, "SKILL.md"), md);

const expected = ["style.md", "norms.json", "voice-notes.md", "principles.md", "boundaries.md", "anti-patterns.md", "playbooks/inline-review.md",
  ...["approve", "thank", "ask-info", "request-change", "nit", "explain", "decline", "redirect", "close", "status", "propose", "own-mistake", "announce"].map((a) => `playbooks/${a}.md`)];
const missing = expected.filter((f) => !existsSync(join(R, f)));
console.log(`assembled ${S}/SKILL.md (${md.split(/\s+/).length} words)`);
if (missing.length) console.log(`missing references (run gen_style for style/norms; follow distill/DISTILL.md for the rest):\n  ${missing.join("\n  ")}`);
else console.log("all references present");
