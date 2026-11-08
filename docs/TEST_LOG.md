# Test log

## What was tested

Everything runs locally; there is no backend.

- `node tests/run_tests.js` runs 49 cases / 641 assertions against the same
  scripts the browser loads and writes `docs/TEST_RESULTS.md`.
- `node tests/check_graph.js` validates both data sets alone with the same
  checks (`tests/check_campus.js`): demo 214 nodes / 300 edges / 57 places,
  HKUST 240 nodes / 291 edges / 64 places - each one a connected graph, every
  place reachable without stairs, no orphan nodes, every indoor edge inside its
  footprint, and every declared quirk still true.
- `tests/smoke.html` drives the real interface: five cards, three languages,
  a step click, a floor tab, the player, the step-free switch, a question with
  no origin, and gibberish; then, on the HKUST frame, the checklist (open, tick,
  persist, Go, all-done, reset) — 30 checks, 0 JavaScript errors.
- `tests/font_check.html` rasterises every printable character and inspects the
  live DOM for an icon that is a character — 921 checks, 0 problems.
- `tests/layout_check.html` re-renders every floor in every language with and
  without a route, for each campus (`?data=demo` 72 renders / 1273 texts,
  `?data=ust` 48 renders / 999 texts), measures each label with `getBBox()` and
  fails if one touches another label, a lift box, the route line, the canvas
  edge, or the walls of its own building.

## Coverage

- **Language (24 cases)** — English, 中文, 粵語, traditional and simplified
  characters, full-width punctuation, room codes (LT-1, CR-101, Lab 402),
  typos ("libary entraince"), a missing origin, a missing destination, and
  gibberish.
- **Routing (12)** — cross-building trips, step-free constraints, the Lift 2
  / LG1 trap, fastest versus step-free timings, step ordering.
- **Nearest POI (4)** and **translation completeness (4)** — every interface
  string exists in all three languages.
- **Data (5)** plus the graph checker above.
- **Visual** — headless Chrome screenshots at 1440×900 and 390×844.
- **Live** — three deep links on the deployed copy, all assets 200.

## Bugs found and fixed

1. A lift ride charged its waiting time once per floor (66 s instead of 30 s
   for three floors); lifts now connect every pair of floors they serve.
2. Cantonese keywords were traditional-only, so "唔想行楼梯" (simplified) was
   not read as a step-free request; a traditional-to-simplified fold now runs
   on both the input and the keyword tables.
3. "How do I get from A to B" put both places in the origin, because the
   question marker was matched before the origin marker.
4. "EA 7F" resolved to the whole building instead of that floor.
5. Clicking a step in an older answer did not highlight it.
6. Room names piled up on each other: every label was placed with `getBBox()`
   while its group was still detached from the document, and an unlaid-out
   node reports an empty box, so all candidates scored zero and the last one
   (±40 below the dot) always won. The group is now appended to the `<svg>`
   before anything is measured, labels are scored against the route, the lift
   boxes, the other labels and the walls of their own building, and a name
   that still cannot fit is wrapped onto two lines instead of escaping
   through the wall.
7. `reserveRoute()` reserved segments of *every* floor, so a line drawn on G/F
   pushed LG1 labels away from empty space; the blocker is now filtered by the
   floor being drawn. This was what pushed "Coffee Shop" out of the Student Hub.
8. Re-ordering the plan so the route runs *under* the lift capsules put the pin
   labels before the room labels, and "You are here" landed on top of
   "Main Entrance" (caught by `layout_check.html`, 3 renders). Pins are drawn
   after the rooms again; only the line moved down a layer.
9. The faint route from *other* floors was drawn on every floor, so visiting an
   unrelated level showed a phantom dashed line at corridor height. It now
   appears only on floors the route actually uses.

## Map rendering pass (2026-11-07)

The plan was rebuilt as a product-style map instead of a diagram.

- **Real footprints** - `campus.js` gained an `OUTLINES` table (stepped, chamfered
  and rounded polygons); `rect` stays as the bounding box, so labels, the graph
  checker and the layout checker keep working unchanged.
- **Categories** - `src/icons.js` maps each `poi` type to one of seven categories
  with an inline line icon (no emoji: they re-render differently on every OS).
  Dots are category-coloured; icons appear when zoomed in.
- **Three levels of detail** by zoom: < 0.92x building names only, 0.92-1.7x adds
  room names, > 1.7x adds icons. At the middle level the label set is exactly the
  old one, which is why `layout_check.html` still reports 72 renders / 1302 texts
  / 0 problems.
- **Zoom and pan** - wheel, drag, double-click, buttons, `?zoom=` deep link.
  Marker and type sizes are in screen px (`--u` = map units per CSS px), so the
  geometry zooms while the labels stay legible instead of turning into wallpaper.
- **Legend** - seven categories, click one to fade the rest; the fade is CSS only,
  so no label moves while filtering.
- **Route** - white casing, orange line, chevrons, and a ghost of the same route
  on the other floors it uses.

Re-checked after the rebuild: graph OK (214 nodes / 300 edges), 49 cases /
599 assertions / 0 failed, smoke 17 passed / 0 errors, layout check 72 renders /
1302 texts / 0 problems, screenshots regenerated at 1440x900 and 390x844.

## Real HKUST data pass (2026-11-07)

The app now runs on the Clear Water Bay campus by default; the fictional campus
stays as `?data=demo` because the 49-case suite asserts exact routes on it.

- **One engine, two specs.** The graph builder moved out of `campus.js` into
  `src/data/graph.js` (`buildCampus(spec)`); `campus.js` and the new
  `campus.ust.js` are now pure specs, and `active.js` picks one from
  `?data=demo|ust`. Demo behaviour is bit-identical: 214 nodes / 300 edges /
  599 assertions before the split, the same numbers after.
- **The campus-agnostic bits left the code.** `nlu.js` used to hard-code the
  demo's building aliases, building entry rooms and "popular" suggestions; they
  now live in the spec (`BUILDINGS[b].aliases`, `entry`, `meta.popular`), so a
  new campus is data only.
- **64 real places** from `data/ust-newcomer.txt`, hkust.edu.hk/visit and
  library.hkust.edu.hk — LG1/LG5/LG7 canteens, the 24-hour study area, the
  sea-view seats, the LSK canteen and study room, CYT Bloomberg terminals, the
  E2 computer room, the pool, ParknShop, the bookstore, the 11/11M/91/91M/792M/104
  stops. Anything unconfirmed is `verified: false` and the header counts it
  ("REAL CAMPUS · 47 to verify").
- **The two-lift trap is real data now**: HKUST splits the Academic Building
  over LG7/LG5/LG3/LG1/G/1F-4F and numbers lifts campus-wide, so Lift 1 serves
  LG7-G and Lift 2 serves G-4F. LG7 canteen → LT-A is 3 min 40 s, two lifts, and
  the data check asserts that neither bank can do it alone (`QUIRKS`).
- **Open ground is a kind of building.** The entrance piazza and the sea-front
  promenade are `kind: 'open'`: dashed, unfilled, no shadow. They still own
  spine nodes, so the bus stops are routable.
- **Uphill paths carry explicit seconds** (`LINKS[].sec`): the halls are drawn
  20 m from the library and cost 4 minutes, because the drawing is compressed
  and the timetable is not.
- **The plan follows the floor.** `fitView()`/`ensureVisible()` fit the buildings
  that exist on the current level, so LG1 shows the library and the academic
  building at reading size instead of a mostly empty sheet, and switching to G/F
  zooms back out to the whole campus until the user takes over the camera.

### Bugs found and fixed in this pass

10. Building names ran into the next building once the campus had ten of them
    ("Lee Shau Kee Business Building" is 210 m of type in a 210 m footprint):
    names are now measured, shrunk to fit, and wrapped onto two lines, and they
    are drawn *last* so they can be scored against the room labels and pins that
    are already on the floor.
11. The plan drew names above a footprint even when the building was at the top
    of the sheet, so the promenade label hung off the canvas (`text-off-canvas`
    at y = -5). Rows that do not fit on the sheet are no longer offered.
12. The sea-front strip was 56 units deep, less than a label lane, so its own
    room labels were pushed outside the zone (`label-outside-building`). The
    strip is now 72 deep with its spine on the centre line.
13. The short building code ("LSK") landed on top of a room label because it was
    only tested against the building name. It now has to clear everything
    already placed, and simply disappears when it cannot.

### Re-checked

- `node tests/check_graph.js` — demo 214 nodes / 300 edges / 57 rooms, HKUST
  240 nodes / 291 edges / 64 rooms; both connected, both 100% step-free, no
  orphan nodes, every quirk intact.
- `node tests/run_tests.js` — 49 cases / 602 assertions / 0 failed (3 new
  assertions come from the LG3/LG5/LG7 floor aliases).
- `python3 tests/browser_check.py` — smoke 21 checks / 0 errors (17 demo + 4
  HKUST, including "header names the real campus"); label layout demo 72
  renders / 1273 texts / 0 problems, HKUST 48 renders / 999 texts / 0 problems.
- Screenshots regenerated from the HKUST data at 1440x900 and 390x844.

## Font/icon audit + newcomer checklist (2026-11-07)

### What the audit found

The page and the SVG plan shared one font stack, and the text itself was clean:
no emoji, no private-use characters, every CJK string rendering from PingFang /
Noto Sans SC. The problem was one layer up - **five icons were characters**:

| where | was | now |
|---|---|---|
| brand mark | `◇` | `<svg class="ico">` diamond |
| zoom out | `−` (U+2212, not a hyphen) | SVG minus |
| zoom in | `+` | SVG plus |
| fit | `⤢` | SVG corner brackets |
| arrived | `✓` | SVG tick |

A character is not an icon: it is a different weight on macOS, a different
width on Windows, and on a box whose fonts lack it, a hollow box the size of the
font. All five are now inline `<svg class="ico">` with their own pixel
`width`/`height` and `stroke: currentColor`, so **neither the font size nor the
font stack can resize or reshape an icon** - and an icon cannot move a label.

The map is not exempt: `#map text { font-family: inherit }` was inheritance, not
a promise, so the stack moved into `--font-ui` and both `body` and the SVG labels
read it.

### The new check

`tests/font_check.html` (wired into `browser_check.py`) answers both halves:

- Rasterises **every character the app can print** - UI dictionary, scenario
text, the checklist, all 64 real place names, in three languages, **865 unique
characters** - and compares each bitmap with the `.notdef` box (drawn from
U+10FFFE, a noncharacter, so no font maps it). Also flags anything painted by a
colour font, because an emoji would ignore our colour.
- Walks the live DOM: icon slots (zoom, brand, arrived badge, checklist entry /
close / tick) must hold an `<svg>` with a rendered size; a lone dingbat or arrow
in the toolbars/thread is an error; SVG labels must resolve to the same family
as the page.

Result: **865 characters, 0 tofu, 0 colour-font characters, 921 DOM checks, 0
problems.**

### The checklist layer

- `src/data/tasks.js`: **22 tasks in 5 groups** (before you arrive / four cards,
one ID / SIS course selection / first days on campus / money, software, apps)
plus **5 tips** that never count towards progress. Every item carries the
section of `data/ust-newcomer.txt` it came from, and an `at` room id where the
guide names a place that exists on the plan.
- `src/tasks.js`: the drawer. Ticks persist in `localStorage['fust.tasks.v1']`
under the campus id, progress is shown twice (badge + bar), **Go** calls
`FUST.App.goTo()` so the checklist and the chat box share one planner, and an
item that happens off campus is labelled instead of being given a fake route.
- Hidden on `?data=demo`: the checklist is HKUST-specific and the demo campus is
fictional, so the entry point is removed rather than faked.

### Bugs found and fixed in this pass

14. Eight places on the plan were reachable only through a glyph the font stack
    might not carry (`⤢`, `◇`, `−`, `✓`). All replaced by SVG;
    see the table above.
15. `tests/layout_check.html` had no assertion for **text over a POI dot** - a
    label could be painted straight through a marker and still pass. Added; it
    immediately found 6 sub-pixel grazes ("逸夫演艺中心主厅" on G/F, zh/yue,
    every render). `placeLabel()` now nudges away from the collision in 1-unit
    steps when every candidate collides, instead of accepting the least-bad one.
18. The label check only ever ran in a 1000px pane, which is the *easiest* one:
    type is sized in screen px, so in a narrow pane `--u` grows and every label
    covers more of the map. Sweeping 1000 / 700 / 520px found **136 problems on
    HKUST** (and 60 on the demo campus) that no screenshot had shown - room
    labels piled on each other and building names ran off the bottom of the
    sheet. Fixed in three parts: room labels that still collide (or cannot stay
    inside their building) are now **dropped** instead of drawn on top of
    something; a two-line building name now reserves room for its second line
    before choosing a row, so it can no longer hang off the canvas; and building
    names are sized in map units with a shrink-to-fit retry (17 → 14.6 → 12.6)
    rather than in screen px, so the same floor lays out the same way at any pane
    width. The check now also asserts that **no room label is dropped at 1000px**,
    so the fix cannot quietly hide behind the new drop rule.
16. The all-done line was rendered inside `if (done === total)`, so the tick that
    completed the list could never reveal it (caught by clicking all 22 in the
    smoke test). It is now always in the DOM and toggled by `hidden`.
17. `font_check.html` intermittently reported nothing at all: on a cold start the
    iframe can still be `about:blank` when its `load` event has already fired, so
    the check ran against an empty document. It now polls for the app, and
    `browser_check.py` retries a page that produced no verdict instead of
    reporting it as a failure.

### Re-checked

- `node tests/check_graph.js` - demo 214/300, HKUST 240 nodes / 291 edges / 64
  rooms, plus the new checklist checks (22 tasks / 5 groups / 5 tips, every
  `at` id a real room, every string in three languages, every item sourced).
- `node tests/run_tests.js` - 49 cases / 641 assertions / 0 failed (39 of
  them come from the 18 new `tasks.*` strings in three languages).
- `python3 tests/browser_check.py` - smoke **30 checks / 0 errors** (15 demo + 15
  HKUST), font check **921 DOM checks / 0 problems**, label layout at three pane
  widths: demo 132 renders / 2092 texts, HKUST 102 renders / 1762 texts, both
  0 problems (demo drops 39 labels at 520px, HKUST 33 at 700px and 77 at 520px -
  reported, not hidden).
- Screenshots: checklist drawer desktop EN/ZH and at 390x844.

## Dify build pass (2026-11-08)

The same engine now runs in a Dify Code node (`docs/DIFY.md`). What was added
and what it caught:

- `tools/bundle_engine.js` + `tools/engine_api.js` -> `dist/`. The bundle is the
  seven browser scripts in `index.html` order, so the Dify app cannot drift
  from the web app; `Engine.version` is a hash of exactly those files.
- `tests/check_bundle.js`: 112 checks - freshness of `dist/`, no
  `document`/`window`/`require`/`process`/`fetch` in the minified code, JSON
  nesting <= 5 (a Dify output limit), the twelve golden questions byte-identical
  to a card rendered independently here, every quoted example in the app's own
  help text actually understood, and the generated `function main(inputs)`
  wrapper called the way Dify calls it.
- `tests/check_sandbox.js`: 32 checks on the file that gets pasted - strict
  mode, a context with no `console`, `undefined`/`null`/number/object/20 000
  characters as `inputs`, `'false'` as a boolean, repeat calls, and its own
  mutation of the inputs object. Cold answer ~13 ms against Dify's timeout.
- `tests/browser_check.py` runs both first, so one command still covers everything.

### Bugs found and fixed in this pass

- **A POI word beat an explicit destination.** "I am at the library entrance,
  and then I pick LG1 canteen" produced *nearest entrance to the library
  entrance* (0 s) instead of the walk: `NLU.parse` reads "entrance" as a POI, so
  `intent` became `nearest`, and that outranked the destination carried from the
  previous turn. `Engine.answer` now lets an explicit `destId` win over a POI
  word. Caught by the `multi-turn` check.
- **Chinese written without spaces missed the aliases.** `去LG1食堂` resolved to
  **LG7** canteen (247 s) because every alias is stored as `lg1 食堂` with a
  space. `registerEntity` now also indexes a compact copy of any form that
  contains a space, and the two canteens learned their 飯堂 spellings. 192 s,
  the right room. All 641 assertions still pass - the change only ever adds a
  match.
- **The app's own example sentence was not a sentence it understood.** The help
  text said `how do I get to LT-1?` - LT-1 exists on the demo campus only, so
  on the real HKUST map the app answered its own suggestion with "I could not
  work out the destination". The second example, `where is the nearest
  restroom?`, had no origin and so asked a question back. Both examples are now
  `... to LG1 canteen?` and `nearest restroom from the library entrance`, which
  work on both campuses, and `check_bundle.js` now pulls every quoted example
  out of the help text in all three languages and requires the engine to
  understand it (9 new checks). Any demo link built on LT-1 in
  `docs/SUBMISSION.md` got `&data=demo` or an HKUST question in its place.


Two data sets to keep in step; 47 places still marked 未核实; constant walking
speed and lift waits; no voice input. The checklist covers the newcomer guide,
not the whole first term: it has no dates, no reminders and no account, and the
five tips next to it are advice, not instructions. Nothing in it is verified
against an official calendar yet.


### The 简体中文 interface (2026-11-08)

Dify Cloud is being driven with the UI in Chinese, so every button in
`docs/DIFY.md` now carries its 简体中文 label - taken from Dify's own Chinese
docs (`docs.dify.ai/zh-hans`), not translated by eye:

- `工作室`, `从空白创建`, `代码`, `输入变量`, `输出变量`, `集成 -> 模型供应商`,
  `预览`, `发布` - all quoted from the Chinese pages for Studio, the Code node
  and the Answer node.
- **One of them is not a translation but a different node.** `Answer` is
  `直接回复`, and Dify's own docs say "直接回复节点仅适用于 Chatflow 应用。Workflow
  应用使用结束节点。" Choosing `工作流` at creation time therefore produces a
  `结束` node and no chat UI at all, and every acceptance check fails for a
  reason that has nothing to do with the engine. `docs/DIFY.md` now warns
  about this before step 1.
- `Chatflow` is left untranslated in the Chinese UI, which is worth knowing
  before hunting for the word 对话流.
- Same build re-confirmed before the paste: `dist/dify-code-node.js` 83824
  bytes, `Engine version: a2762b3892aa`, `check_bundle.js` 112/0,
  `check_sandbox.js` 32/0 (cold answer 13 ms). Documentation only - no source
  change, so the engine hash is unchanged.



### The DSL import pass (2026-11-08)

Building eight nodes by hand in a Chinese UI is a bad use of a demo slot, and
Dify can import an app from a YAML file instead. Two files are now generated:

- `dist/hkust-guide.dsl.yml` - Start -> Code (engine) -> Answer. Three nodes,
  no model, no provider, nothing to configure. This is the one to import.
- `dist/hkust-guide-chatgpt.dsl.yml` - the same plus If/Else -> Answer / LLM ->
  Answer, so "I did not understand" goes to the model.
- `tools/make_dsl.js` writes both from `dist/dify-code-node.js`, so the Code
  node body is the tested file verbatim, not a copy that can drift.
- `tests/check_dsl.js`: 204 checks. PyYAML (the parser Dify itself calls)
  parses both files; the parsed code is compared byte for byte with
  `dist/dify-code-node.js`; edge ids, edge `sourceType`/`targetType` and the
  If/Else `sourceHandle: 'true'` / `'false'` labels are checked against the
  nodes; every `{{#node.field#}}` in an Answer or a prompt must resolve to a
  node that exists and an output it declares; the graph must be reachable from
  Start, acyclic, and every path must end in an Answer node. Then the parsed
  code is compiled (`new Function(body + '\nreturn {main, answerFull};')`) and
  the app's own five starter questions are run through it: `main()` must return
  exactly the declared keys, each with the declared type, and none of the chips
  may fall to the model branch. `tests/browser_check.py` runs it alongside the
  other two.

What the checks were tested against - three deliberate breakages, each caught:
`version: 0.8.0` (newer than Dify main's 0.7.0, which makes the import come
back `PENDING` and creates no app), `code_language: python3`, `{{#9000000000009.text#}}`
pointing at a node that does not exist, and one character changed inside the
embedded engine (18 failures, and the runner prints findings instead of a stack
trace).

### Bugs found and fixed in this pass

- **"Not all output parameters are validated."** The first import failed on the
  Code node after 230 ms — it *ran*, and then Dify refused the result. The
  message is the last two lines of `_transform_result` in
  `api/core/workflow/nodes/code/code_node.py`:

  ```python
  # check if all output parameters are validated
  if len(parameters_validated) != len(result):
      raise CodeNodeError("Not all output parameters are validated.")
  ```

  It is a **count**, not a subset: the three declared outputs were fine and
  present, and the node still failed because `main()` returned all 21 keys of
  `Engine.answer()`. No output list could have been right either —
  `Engine.answer()` returns 21 keys for a route, 23 for a nearest-POI answer
  and 12 for a clarify, so the count changes per branch. `main()` now returns
  exactly `{text, kind, ok}` and the mapping moved into `answerFull(inputs)`,
  which the tests call when they need `lang` / `stepFree` / `originId` /
  `destId`. Caught afterwards in three places: `check_dsl.js` compares the
  returned key set with the declared outputs on every question (reverting
  `main()` to return the whole answer fails 9 checks and names both lists),
  `check_sandbox.js` asserts the three-key shape on a route, a nearest-POI
  answer and a clarify, and `check_bundle.js` does the same against the bundle.

  The same trap was in the hand-built instructions: step 5 said "declare
  `text` + `ok`, the node returns 20 more fields, add the ones you reference".
  That advice cannot work, for the same reason. `docs/DIFY.md` now says
  *exactly three, no more and no fewer*, quotes the check, and explains how to
  add a fourth (return it **and** declare it).



`api/services/dsl_version.py` compares the imported version with the server's:
newer or a different major -> `PENDING` (the payload is parked in Redis and
**no app is created**); lower minor -> `COMPLETED_WITH_WARNINGS`; equal ->
`COMPLETED`. Dify's main branch declares `0.7.0`. The files therefore say
`0.2.0`: it cannot be newer than Cloud, so the import always completes. It is
also above `0.1.5`, the cut-off below which `AppDslService` re-derives plugin
dependencies from the graph and can stop at an "install these plugins" step
naming a model provider we cannot know. There is no per-version migration code
in `app_dsl_service.py`, so the number changes only that status - the node
shape is the current one, taken from `web/app/components/workflow/nodes/*/default.ts`
and from real exported DSLs (a start/code/if-else/answer/llm Chatflow), not
from memory.

### Branching on `kind`, not on `ok`

The hand-built instructions branch on `{{#code.ok#}} is true`; the files branch
on `{{#code.kind#}} is not 'clarify'`. Both are the same decision (the engine
sets `kind: 'clarify'` exactly when it could not route). The files use the
string because a boolean has to survive YAML plus the condition engine's
coercion, and a string comparison has none. The Code node declares `text`
(string), `kind` (string) and `ok` (boolean) as outputs; `main()` returns those
three and nothing else, and the test compares the two key sets on every branch,
because Dify fails a Code node whose returned keys and declared outputs differ
in number (§ Bugs found).

### The model id

The 大语言模型 dropdown reads **`gpt-5.6-sol`** (confirmed 2026-11-08), which is
what `tools/make_dsl.js` already bakes in — `provider: openai`,
`name: gpt-5.6-sol`, temperature 0, max tokens 240, `mode: chat`. The provider
is the one half still inferred from the model name: Dify stores provider and
model separately, and the dropdown only shows the model, so a workspace that
registers OpenAI models under another provider name would need the one click on
**模型** to rewrite it. Nothing else in the file refers to the model.

Current, end to end: `check_bundle.js` 116/0, `check_sandbox.js` 42/0,
`check_dsl.js` 204/0, smoke 30/0, fonts 921/0, layout 2092/0 + 1762/0.
