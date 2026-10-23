// Render eval prompts from <out>/eval/holdout.jsonl. Usage: node eval/render.mjs <n> <with-skill|baseline> > prompts.md
import { cfg, readJsonl } from "../lib/config.mjs";
const items = readJsonl(cfg.eval + "/holdout.jsonl");
const n = Number(process.argv[2] ?? 20), cond = process.argv[3] ?? "with-skill";
const skillNote = cond === "with-skill"
  ? `Set the environment variable VOICE_DB=${cfg.eval}/voice-eval.sqlite for every script you run. Before drafting, read ${cfg.skill}/SKILL.md and follow its workflow (classify, read the playbook, pull exemplars with scripts/voice search, draft, run scripts/voice lint, add the disclosure footer).`
  : `Write the reply as you normally would when asked to reply on a maintainer's behalf. Do not read any files.`;
for (const it of items.slice(0, n)) {
  console.log(`## ${it.id}\n`);
  console.log(`You are replying on GitHub as ${cfg.name} (@${cfg.login}), maintainer of ${it.repo}. ${skillNote}\n`);
  console.log(`Thread: ${it.threadKind} "${it.threadTitle}" opened by @${it.threadAuthor}.`);
  if (it.context.length) { console.log(`\nMost recent comments before yours:`); for (const c of it.context) console.log(`\n> **@${c.author}:** ${c.body.replace(/\n/g, "\n> ")}`); }
  else console.log(`\n(You are the first to comment.)`);
  console.log(`\nWrite only the comment body you would post. Harness in use: Claude.\n\n---\n`);
}
