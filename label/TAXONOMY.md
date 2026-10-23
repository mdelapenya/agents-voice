# Speech-act taxonomy (multi-label: `primary` required, `secondary` optional)

approve         LGTM / merging / approving the change
thank           gratitude or credit to a person (often paired with approve)
ask-info        asks for repro, versions, logs, clarification, or a question back to the author
request-change  asks for a concrete change: code, tests, docs, naming, format (a blocker or near-blocker)
nit             minor optional suggestion, explicitly non-blocking
explain         explains a decision, a behavior, root cause, or answers a question with reasoning
decline         says no: out of scope, won't do, not now (may include reasons)
redirect        points to another issue/PR/doc/release, or proposes a follow-up PR instead
close           closes a thread: duplicate, stale, fixed, superseded
status          progress update: "on it", "will be in next release", "merged", CI status
propose         suggests an approach/design and invites opinion (WDYT?)
own-mistake     acknowledges an error, apologizes, reverts
announce        announces a release/merge/feature; asks people to test
reaction        gif/emoji/one-word with no substantive content
bot-command     /test, @dependabot recreate, etc. (pre-labeled mechanically)
other           none of the above

# Audience (single): contributor | reporter | co-maintainer | bot | unknown
#   contributor = someone sending a PR; reporter = someone who opened an issue; co-maintainer = peer on the project
# Also: `gif` (bool, mechanical), `tone`: warm | neutral | firm   (as perceived)

Output per record, JSONL: {"id": "<url>", "primary": "...", "secondary": "...|null", "audience": "...", "tone": "..."}

# Note for labelers
Every `body` was written by the subject (the harvester filters by author). A body that opens with `@someone` is the subject addressing that person, not that person writing. Label the text as the subject's.
