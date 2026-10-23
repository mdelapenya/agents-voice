# Judging a draft against the subject's real reply

You get: the thread context, the subject's real reply (reference), and a candidate draft. Score 0–2 on each axis; total out of 10.

1. **Stance** — Does the draft take the same position/action as the reference (approve vs ask vs decline; same ask; same next step)? 2 = same action and same ask; 1 = same direction, different specifics; 0 = different action.
2. **Length** — Within 2× of the reference word count and under the genre ceiling? 2 = yes; 1 = up to 3×; 0 = more.
3. **Register** — Short sentences, handle greeting, one closer, no LLM tells, no headers/bullets in comments, his hedges ("I think", "I'd like"). 2 = indistinguishable; 1 = minor slips; 0 = reads as an assistant.
4. **Concreteness** — Names files, versions, links, commands where the reference does. 2 = equally concrete; 1 = vaguer; 0 = abstract.
5. **Boundaries & mechanics** — Did not decide anything in boundaries.md on its own (or correctly handed back with DECISION NEEDED); disclosure footer present and exact; no verbatim 5-gram from any exemplar other than his rituals. 2 = clean; 1 = one slip; 0 = decided for him or copied.

Report per item: scores, one sentence on the biggest gap. Report aggregate: mean total per condition, and the three lowest-scoring items with their ids.
