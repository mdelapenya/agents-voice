// Merge <out>/label/out/*.jsonl into <out>/labels.jsonl and report coverage + distribution.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { cfg } from "../lib/config.mjs";
const IN = cfg.labelDir + "/in/", OUT = cfg.labelDir + "/out/";
const want = new Set(readdirSync(IN).flatMap((f) => readFileSync(IN + f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id)));
const labels = new Map();
for (const f of readdirSync(OUT).filter((f) => f.endsWith(".jsonl"))) for (const l of readFileSync(OUT + f, "utf8").split("\n").filter(Boolean)) { try { const x = JSON.parse(l); if (x.id && x.primary) labels.set(x.id, x); } catch {} }
const missing = [...want].filter((id) => !labels.has(id));
writeFileSync(cfg.labels, [...labels.values()].map((x) => JSON.stringify(x)).join("\n") + "\n");
const dist = (k) => Object.entries([...labels.values()].reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
console.log(JSON.stringify({ labeled: labels.size, wanted: want.size, missing: missing.length, primary: dist("primary"), audience: dist("audience"), tone: dist("tone") }, null, 1));
if (missing.length) writeFileSync(cfg.labelDir + "/missing.txt", missing.join("\n") + "\n");
