# Handover audit

For whoever inherits this bot next year. 195 words, three parts. Every claim can
be checked in this repository; the table at the end says where.

Print copy: `docs/Handover-audit.pdf` (one page, same text).

## The note

**Two limits.** Scope: 240 nodes, names matched by a word index plus a Levenshtein
pass on 5+ letter words within two edits. A room absent from the data is never
found, only its nearest neighbour: "restroom" resolved to "restroomgf". No
retriever, only data to edit. Contract: the Code node must return exactly three
keys (text, kind, ok); Dify compares the count, not the names: our first import
died on a four-key answer. We learned that the hard way.

**The notch.** Booking: the Code node gains a write to the booking API. New
failures: a 0.7-confidence match books the wrong room; no state between turns, so
a retyped request books twice; the model branch, blind to the graph and restrained
only by a prompt, can request a room not in the data. Same input, different
outcome.

**The condition.** The write files a request, not a booking: room ids checked
against the data, one idempotency key per user-slot, Estates Office clearing the
queue before confirmation. It sits at the credential, above us: the workflow is a
DSL file anyone can re-import, so an in-graph guard is one edit away. "Be careful"
fails: a wrong booking answers "confirmed".

## Where each claim lives

| claim | file | what to read |
|---|---|---|
| 240 nodes, 291 edges, 10 buildings | `src/data/campus.ust.js` | the `SPEC`, built by `buildCampus`; count `FUST.CampusUST.nodes.length` |
| 5+ letter words, two edits, no match if the length differs by more than 2 | `src/nlu.js` | `fuzzySegment`, lines 284 to 307 |
| a fuzzy hit is believed at 0.7 | `src/nlu.js` | `resolvePlace`, line 384 |
| "restroom" becomes "restroomgf" | `src/nlu.js`, `src/i18n.js` | `corrected.to` is the index key, and the note at `i18n.js:101` prints it |
| the Code node must return exactly three keys | `docs/DIFY.md`, section "The count has to match" | Dify's `CodeNode._transform_result`; `main()` at the end of `dist/dify-code-node.js` |
| no memory, no retrieved context | `dist/hkust-guide-chatgpt.dsl.yml` | `conversation_variables: []` (line 11), LLM node `memory.window.enabled: false`, `context.enabled: false` |
| the model is unverified | same file | `temperature: 0`, `max_tokens: 240`, and a prompt that says "Never invent a route". That is an instruction, not a check. |
| 49 pinned cases | `tests/cases.json` | they assert intent, origin and destination, steps, lifts, time bands and `textHas`, all properties of the reply. None of them can see a side effect. |

## Still open (known, not fixed)

* The `"restroom"` to `"restroomgf"` note is real and visible: a search key is
  leaking into the sentence. The fix belongs in `resolvePlace`, where the note
  should carry the node's own name, or stay quiet when the typed word is only the
  front of the key.
* The Dify provider (`openai`) is still the one value we inferred rather than read
  off the console; everything else in the DSL came from the app itself.
* No credential, no write path and no tool node exists yet. The booking notch is
  design, not code. That is the honest state of it.
