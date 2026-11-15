# Handover audit

For whoever inherits this bot next year. 196 words, three parts, every claim
checkable in this repository — the last table says where.

## The note

**Two limits.** Scope: 240 nodes, names matched by a word index plus a
Levenshtein pass on words of ≥5 letters within two edits. A room absent from the
data is never found — only its nearest neighbour: "restroom" became the alias
"restroomgf" — and only editing data widens it. Contract: the Code node must
return its three declared keys (text, kind, ok); Dify compares the count, not the
names — our first import died on a four-key answer.

**The notch.** Booking: the Code node gains a write to the room-booking API. New
failures: a 0.7-confidence match books the wrong room; no state between turns: a
retyped request books twice; the model branch, blind to the graph and restrained
only by a prompt, can request a room absent from the data. Same input, different
outcomes.

**The condition.** The write files a pending request, not a booking: room ids
checked against the data, one idempotency key per user-slot, cleared by the
Estates Office before confirmation. It sits at the credential, above us: the
workflow is a DSL file anyone can re-import, so an in-graph guard is one edit
from gone. "Be careful" fails: a wrong booking answers "confirmed".

## Where each claim lives

| claim | file | what to read |
|---|---|---|
| 240 nodes, 291 edges, 10 buildings | `src/data/campus.ust.js` | the `SPEC`, built by `buildCampus`; count `FUST.CampusUST.nodes.length` |
| words ≥5 letters, two edits, no match if the length differs by more than 2 | `src/nlu.js` | `fuzzySegment`, lines 284–307 |
| a fuzzy hit is believed at 0.7 | `src/nlu.js` | `resolvePlace`, line 384 |
| "restroom" → "restroomgf" | `src/i18n.js` + `src/nlu.js` | the note at `i18n.js:101` prints `corrected.to`, and `corrected.to` is the index key, not a place name |
| the Code node must return exactly three keys | `docs/DIFY.md` §"The count has to match" | Dify's `CodeNode._transform_result`; `main()` at the end of `dist/dify-code-node.js` |
| no memory, no retrieved context | `dist/hkust-guide-chatgpt.dsl.yml` | `conversation_variables: []` (line 11), LLM node `memory.window.enabled: false`, `context.enabled: false` |
| the model is unverified | same file | `temperature: 0`, `max_tokens: 240`, and a prompt that says "Never invent a route" — instruction, not a check |
| 49 pinned cases | `tests/cases.json` | they assert intent, origin/destination, steps, lifts, time bands and `textHas` — properties of the reply. None of them can see a side effect. |

## Still open (known, not fixed)

* The `"restroom" → "restroomgf"` note is real and visible; the alias is a
  search key leaking into the sentence. Fix is in `resolvePlace` — report the
  node's own name, or stay quiet when the typed word is only the front of the
  key.
* The Dify provider (`openai`) is still the one value we inferred rather than
  read off the console; everything else in the DSL came from the app itself.
* No credential, no write path, no tool node exists yet — the booking notch is
  design, not code. That is the honest state of it.
