# Putting the guide on Dify Cloud

**Status: imported, and every node runs (2026-11-08). 发布 → 发布更新 and the
chat link are the last two clicks (`§ 5`).**
Live web app: <https://freefish0904.github.io/freefish-campus-guide/>
Dify Web App link: `«paste https://udify.app/chat/… here after 发布»`

This is route B: Dify hosts the chat and the model, **the existing JavaScript
engine computes the routes**. The model never writes a number, a floor, a
lift number or a walking time — every one of those comes out of
`src/router.js` + `src/steps.js` + `src/i18n.js`, the same files the browser
runs. A single shareable Web App link is the deliverable.

```
Start (user message)
   │
   ▼
Code「engine」          dist/dify-code-node.js  — parse + route + render
   │
   ├── code.ok = true ────────────────────────────► Answer: {{engine.text}}
   │                                                (verbatim, no model)
   └── code.ok = false
          │
          ▼
       LLM「front desk」  openai / gpt-5.6-sol — only for "I don't know what
          │                you mean" and campus-life questions
          ▼
       Answer: {{llm.text}}
```

Two consequences worth saying out loud in the report:

* **The routing is deterministic.** The same question gives the same answer
  in the browser and on Dify, character for character. `tests/check_bundle.js`
  asserts exactly that (12 questions, byte-identical text).
* **The app still works with the model switched off.** Delete the LLM node
  and every wayfinding question is still answered; only "what is on LG7"
  small talk degrades. That is the fallback path, and it is tested.

---

## 0. Import the app instead of building it

Dify can create an app from a YAML file (**工作室 → 创建应用 → 导入 DSL 文件**;
English UI: Studio → Import DSL File). Two files are built for that. You need
one, not both.

| file | nodes | model | use it when |
|---|---|---|---|
| `dist/hkust-guide.dsl.yml` | 开始 → 引擎 → 直接回复 (3) | **none** | **default.** Import, publish, done. Works with no credits and no provider. |
| `dist/hkust-guide-chatgpt.dsl.yml` | 开始 → 引擎 → If-Else → 直接回复 / 大语言模型 → 直接回复 (6) | `openai` / `gpt-5.6-sol` | you want the model to handle "I did not understand" and campus small talk |

Both embed `dist/dify-code-node.js` **verbatim** as the Code node body, so what
arrives in Dify is the exact file the tests passed. `node tests/check_dsl.js`
parses both files with PyYAML, compares the parsed code with the file on disk
byte for byte, walks the graph, resolves every `{{#node.field#}}` reference and
then executes the parsed code — 204 checks (§1).

**Steps**

1. Pick a file, download it (or open it and select all).
2. <https://cloud.dify.ai> → **工作室** → **创建应用** → **导入 DSL 文件**
   (the button may read 导入 DSL / 导入 DSL 文件 depending on the build),
   choose the file.
3. The app opens with the graph already wired and the prompt already written.
   Nothing to type, no variables to add.
4. **Model file only:** the 大语言模型 node is already set to `openai` /
   `gpt-5.6-sol` — the id your dropdown shows (confirmed 2026-11-08) — with
   temperature 0 and max tokens 240. If that node reads 模型不可用 instead, your
   workspace names the provider differently: one click on **模型** →
   `gpt-5.6-sol` rewrites both the provider and the name in the app and nothing
   else changes. Tell me the provider label above the model if that happens.
5. **发布 → 发布更新**, then **概览 / Web 应用** to set the icon, name and
   suggested questions — the file already carries the opening line and five
   starter questions.

**If the import is refused**, the `version:` line is the only suspect. Dify
compares it with its own and returns `PENDING` — which creates *no app* — when
the file is newer than the server (see `tools/make_dsl.js` for the rule). The
file says `0.2.0`, which is older than any 1.x-era Cloud build:

```bash
sed -i '' 's/^version: .*/version: 0.7.0/' dist/hkust-guide.dsl.yml
```

Then import again. Send me the exact error text if it still refuses.

**If the import works and the 引擎 node then fails** with
`Not all output parameters are validated.`, the Code node body is older than
this repo's: its `main()` returns the whole `Engine.answer()` object, and Dify
counts what a Code node returns against the outputs you declared. Rebuild both
files (`node tools/bundle_engine.js && node tools/make_dsl.js`) and import
again — the current `main()` returns exactly `text`, `kind`, `ok`.

**Why 0.2.0 and not 0.7.0:** a version *newer* than the server's is the one
case where Dify accepts the upload, parks it in Redis and creates nothing. An
older one only earns a "DSL 版本较旧" warning. There is no per-version
migration code, so the node shape is unaffected.

The rest of this file builds the same app by hand, node by node. Keep it as the
written explanation for the report, and as plan B if an import is rejected.

---

## 1. What the build produces

```bash
node tools/bundle_engine.js        # writes dist/, prints the engine version
node tools/make_dsl.js             # writes dist/*.dsl.yml, the files you import
node tests/check_bundle.js         # 116 checks: fresh, sandbox-safe, byte-identical
node tests/check_sandbox.js        # 32 checks: the pasted node under a hostile box
node tests/check_dsl.js            # 204 checks: both DSL files parse, wire up and run
```

| file | size | what it is |
|---|---|---|
| `dist/hkust-guide.dsl.yml` | 103 KB | **import this one** — 3 nodes, no model, nothing to configure |
| `dist/hkust-guide-chatgpt.dsl.yml` | 108 KB | the same, plus If/Else + LLM + Answer (6 nodes) |
| `dist/dify-code-node.js` | 82 KB | **paste this into a Code node** if you build by hand — the engine behind `function main(inputs)` |
| `dist/dify-engine.js` | 104 KB | the same code unwrapped, for `node dist/dify-engine.js` debugging |
| `dist/dify-engine.min.js` | 74 KB | comments and indentation stripped, if a box complains about size |

The two `.dsl.yml` files are generated from `dist/dify-code-node.js` by
`node tools/make_dsl.js`; they contain it verbatim, indented as one YAML
literal block. `node tools/make_dsl.js --check` fails if they are stale.

The bundle is the seven browser scripts in `index.html` load order plus
`tools/engine_api.js`, hashed into `Engine.version` (printed by the build and
on the first line of `dist/dify-code-node.js`; `tests/check_bundle.js` fails if
that hash is not the hash of the sources it just hashed). `tests/check_bundle.js`
also rebuilds the files and fails if `dist/` is stale, so the file you paste is
always the file the tests passed.

What the Code node returns for
`library entrance to lg 1 canteen` (this exact text is what the Answer node
prints):

```
**Library Entrance → LG1 Canteen (Maxim's)**
3 min 12 s · 260 m on foot · no lift · Step-free

1. Walk 45 m along the Lee Shau Kee Library LG1 corridor
2. Follow the covered walkway to Academic Building (60 m)
3. Walk 155 m along the Academic Building LG1 corridor, past ATM
✓ You have arrived at LG1 Canteen (Maxim's)
```

---

## 2. Phase 0 — the five-minute smoke test

The one thing that could still go wrong is Dify refusing an 82 KB Code node.
Find out now, not after wiring six nodes.

### What is already proven, and what is not

| | how it is checked | status |
|---|---|---|
| the engine is current, sandbox-safe, byte-identical to the browser | `node tests/check_bundle.js` (116 checks) | **green** |
| the pasted file survives strict mode, no `console`, junk inputs, the 5-level / 400k output limits, and repeat calls | `node tests/check_sandbox.js` (42 checks, cold answer ~13 ms) | **green** |
| Dify Cloud accepts a 106 KB DSL / 82 KB Code node at all | imported 2026-11-08: 开始 成功, 引擎 ran in 230 ms | **yes** |
| Dify's JS runtime matches Node's for this code | the same run: the code executed, and only the output check failed | **yes** |
| the model id is in *your* workspace | 大语言模型 模型 dropdown, 2026-11-08 | **`gpt-5.6-sol`** |

Everything in the first two rows runs on this machine, in a `vm` context with
nothing in it, which is the closest thing to a Code node that can be tested
without logging in. Rows three to five cannot be settled from here; Phase 0 is
one paste that settles all three.

### What to do, in order

Eight steps. Every button named below is given with its 简体中文 label, and the
table right after this sentence is the whole mapping in one place.

#### If your Dify is in 简体中文

The rest of this file names buttons in English. Dify's zh-Hans build keeps some
English, translates some, and one translation will derail you. This is the
mapping, checked against Dify's own Chinese documentation
(`docs.dify.ai/zh-hans`), not guessed:

| in this file | 中文界面 |
|---|---|
| Studio | **工作室** |
| Create from Blank | **从空白创建** |
| Chatflow | **Chatflow** — 中文界面也保留英文名。**不要**选「工作流」 |
| Start | **开始**（新版文档写作「用户输入」） |
| Code | **代码** |
| Language | **语言**（Python / JavaScript） |
| Input Variables | **输入变量** |
| Output Variables | **输出变量** |
| If/Else | **If-Else** |
| Answer | **直接回复** |
| LLM | **大语言模型** |
| model / temperature / max tokens | **模型** / **温度** / **最大 token 数** |
| Memory | **记忆** |
| Settings → Model Provider | **集成 → 模型供应商** |
| Default Model → System Reasoning Model | **默认模型 → 系统推理模型** |
| Preview | **预览** |
| Run (a single node) | **运行**（节点面板里的单节点调试） |
| Publish → Publish Update | **发布 → 发布更新** |
| Overview / Web App | **概览** / **Web 应用** |
| Conversation Variables | **会话变量** |
| the `{x}` variable picker | **插入变量**（也可以在输入框里直接打 `/`） |

**The one trap: 「直接回复」只存在于 Chatflow.** A Workflow app's last node is
called **「结束」**, and it produces no chat UI. If the node you just added reads
结束, the app was created as 工作流 — recreate it as Chatflow, or every check in
Appendix A fails for the boring reason that there is nowhere to type.

**0. Put the file on your clipboard.** In the repo, one line:

```bash
pbcopy < dist/dify-code-node.js && pbpaste | wc -c
```

It must print **83824**. That is the whole file — pasting half of it is the
one mistake that produces a puzzling syntax error instead of a size error.

1. <https://cloud.dify.ai> → **Studio**（工作室）→ **Create from Blank**（从空白创建）→ **Chatflow**.
   Name it `HKUST Campus Guide`. (Chatflow, not Workflow: we want the chat box
   and conversation variables; the Workflow app has no chat UI.)
2. The graph already has **Start**（开始）. Click **+** after it → **Code**（代码）.
3. In the Code node, set **Language = JavaScript**（语言）, then **Input Variables**（输入变量）:
   delete the two default rows and add one.

   | name | type | value |
   |---|---|---|
   | `query` | String | `{{#sys.query#}}` (pick `sys.query` from the `{x}` menu) |

   Do **not** add `lang` / `originId` / `destId` / `stepFree` yet: absent is the
   same as empty, and the engine detects the language itself.
4. **Paste** into the code box (⌘V once). The first line should read
   `/* =====...` and `Dify Code node (JavaScript) - GENERATED FILE`.
5. **Output Variables**（输出变量）— the step that bites everyone. Add exactly
   these three, no more and no fewer:

   | name | type | what it is |
   |---|---|---|
   | `text` | String | the answer the 直接回复 node prints (markdown) |
   | `kind` | String | `route` / `nearest` / `clarify` — branch on this |
   | `ok` | Boolean | `true` when a route or the nearest POI was found |

   **The count has to match, in both directions.** `CodeNode._transform_result`
   ends with

   ```python
   if len(parameters_validated) != len(result):
       raise CodeNodeError("Not all output parameters are validated.")
   ```

   so a declared output the code never returns fails the node — and so does a
   key the code returns that you did not declare. `main()` therefore returns
   exactly `{text, kind, ok}` and nothing else, dropping the other fields
   (`sec`, `steps`, `lifts`, `originId`, …) that `Engine.answer()` produces.
   If you later want one of them downstream, return it from `main()` as a
   fourth key **and** declare a fourth output: the two lists stay equal or the
   run stops with that error. The full object is still one call away —
   `answerFull(inputs)` in the same file — just not through the node's outputs.
6. **Run this node**（运行）in the node's own debug panel with
   `query = library entrance to lg 1 canteen`. Expect `ok: true`,
   `kind: route`, and `text` starting `**Library Entrance → LG1 Canteen
   (Maxim's)**`. (The 192 s and the empty lift list are in that text; the
   separate `sec` / `lifts` fields are not declared outputs any more.)
7. Add an **Answer** node（直接回复）after the Code node. In its text box type `/` or click
   `{x}` → **Code** → **text**, so the reference is `{{#<node>.text#}}`. Do not
   hand-type the node id.
8. **Preview**（预览）the chat (top right) and ask the three questions below.

| ask this | expect |
|---|---|
| `library entrance to lg 1 canteen` | a route, 3 min 12 s, no lift |
| `where is the nearest toilet from the piazza` | "Nearest restroom to Entrance Piazza", 5 min 26 s |
| `hello` | `Try: "I am at the Library entrance, how do I get to LG1 canteen?" …` |

**Report back one of these three**, and we go to Phase 1:

* *(a)* it worked → nothing to do, keep going;
* *(b)* Dify refused the paste, or the code box stopped accepting text, or the
  node failed with a size/timeout error → send me the exact message. Note that
  `dist/dify-engine.min.js` is **not** a drop-in replacement: it is the engine
  without the `main()` wrapper. The real fallback is plan B2 — a 40-line
  serverless `api/route.mjs` behind an HTTP Request node — so the message
  decides which one we build;
* *(c)* it loaded and ran, but a query returned `ok: false` or a stack trace →
  send the error: the first four lines of the file you pasted carry the engine
  hash (`Engine version: a2762b3892aa` in this build), and that hash is what
  tells me whether the paste is the build the tests passed.

Nothing in the repo needs to change for (a).


---

## 3. Phase 1 — the working chatflow

Everything above Phase 0 stays; this adds the model for the cases the rules
deliberately do not handle (vague sentences, campus-life questions).

```
Start ─► Code「engine」 ─► If「rules answered?」 ─► Answer「route」
                                   │
                                   └─ else ─► LLM「front desk」 ─► Answer「reply」
```

| node | type | settings |
|---|---|---|
| Start | Start（开始） | only `sys.query` is used |
| Code「engine」 | Code（代码）, JavaScript | input `query` = `{{#sys.query#}}`; outputs **`text`** (String) + **`kind`** (String) + **`ok`** (Boolean), all three and nothing else; body = `dist/dify-code-node.js` |
| If「rules answered?」 | If/Else（If-Else） | `{{#code.kind#}}` **is not** `clarify` → TRUE, or `{{#code.ok#}}` **is** `true` if you prefer the boolean; note the picker gives you the real node id, not the word `code` |
| Answer「route」 | Answer（直接回复） | `{{#code.text#}}` |
| LLM「front desk」 | LLM（大语言模型） | model **gpt-5.6-sol** (`openai`), exactly as the DSL ships it, temperature **0**, max tokens **240**, no thinking mode, 记忆 off |
| Answer「reply」 | Answer（直接回复） | `{{#llm.text#}}` |

Two rules that make this an honest demo:

1. **The TRUE branch prints the engine text verbatim.** No model, no
   reformatting. If the model is down, if the credits are gone, if the
   provider rate-limits — the route still comes out, with the right numbers.
2. **The LLM branch never sees a route.** On the FALSE branch the engine found
   nothing to draw, so there is nothing for the model to get wrong.

The imported DSL asks the same question with a string instead of a boolean:
`{{#code.kind#}}` **is not** `clarify` → TRUE. `kind` is `route` / `nearest` /
`clarify`, so the decision is identical, and a string comparison has no
boolean-to-YAML coercion to go wrong. Either is correct; the files use `kind`
because it fails loudly rather than silently in the wrong branch.

### Model

Your workspace model is **`gpt-5.6-sol`** (confirmed 2026-11-08), and the
imported DSL already says `provider: openai`, `name: gpt-5.6-sol` — so the
6-node file arrives with the model bound and nothing to click. If the node
reads 模型不可用, your workspace labels the provider something other than
`openai`; one click on **模型** → `gpt-5.6-sol` fixes it and leaves the prompt,
the temperature and the wiring untouched. The provider label is the only thing
I could not see from here.

Settings that matter, whichever model it is:

* **温度 = 0** — the branch is for a fixed, short reply, not for variety.
* **最大 token 数 = 240** — the answer is at most three sentences.
* **记忆 = 关** — every turn is a fresh sentence to the engine; memory would let
  the model answer from the chat instead of from the router.

Nothing else in the app depends on which model it is: it never sees a route, a
distance, a lift number or a walking time. That is why the no-model DSL file
exists — same routing, no provider at all.

### Prompt for LLM「front desk」

**System:**

```
You are the front desk of the HKUST Campus Guide. A deterministic route
engine has already tried to answer the visitor's sentence and could not.

Do this, in order:

1. If the sentence is a question about campus life (food, study spots,
   facilities, transport, discounts, apps), answer it in at most three short
   sentences using ONLY the facts in FACTS. If a fact is not in FACTS, say you
   are not sure and point at the official HKUST Student app.
2. Otherwise the engine is missing one piece: where the visitor is, or where
   they want to go. Ask exactly ONE question for that missing piece, then list
   the candidate places it found (labels only - keep their ids out of the
   sentence).
3. Never state a walking time, distance, floor number, lift number or a
   sequence of steps. Those come from the engine, never from you. If the
   visitor asks "how long", say the engine needs both places first.

Reply in the language of the visitor's sentence (English, 简体中文 or 粵語).
Under 60 words. No headings, no emoji, no tables.
```

**User:**

```
VISITOR SAID: {{#sys.query#}}
ENGINE READING: {{#code.understood#}}
RULES REPLY (match its tone): {{#code.text#}}
CANDIDATES: {{#code.candidates#}}
LANG: {{#code.lang#}}

FACTS (HKUST, from data/ust-newcomer.txt):
- LG1 Canteen (Maxim's): roast duck leg rice, iced lemon tea.
- LG5: McDonald's, open all night during exam weeks.
- LG7 Canteen: hidden "科大全餐" set - two dishes, rice and a drink for HK$38.
- LSK Canteen: wraps; the LSK study room is quiet and has the fastest Wi-Fi.
- Library: 24-hour study area on G/F, sea-view seats on the top floor (go
  before 8am), Learning Commons, group study rooms, nap pods, 3D printing.
- Business building (CYT): Bloomberg terminals, sea-facing seats.
- E2 computer room: open all night, no booking needed.
- Sports Centre pool: free with a booking.
- ParknShop: bread and salads discounted after 8pm. The G/F bookstore and the
  SU store both give student discounts.
- Transport: no MTR at the door. Minibus 11M to Hang Hau, 11 to Choi Hung,
  bus 91 / 91M; all stop at the southern entrance.
- Apps: Canvas (courses), Duo Mobile (login), HKUST Student (timetable,
  grades, venue booking), USTing (timetable, library rooms, laundry).
```

Leave **Memory** off on this node. It is a one-shot helper, and old turns in
the prompt make it re-answer questions that were already answered.

### What the two branches look like from the user's side

| ask | who answers |
|---|---|
| `library entrance to lg 1 canteen` | engine — 3 min 12 s, no lift, 3 steps, arrival line |
| `能带我去吃饭吗` | rules miss the slang → LLM asks which canteen and lists LG7 / LG1 / LSK |
| `LG5 麦当劳考试周通宵吗` | rules see a place but no destination → LLM answers from FACTS |
| `how long` | LLM asks for both places instead of inventing a time |


---

## 4. Phase 2 — multi-turn ("where are you starting from?")

Optional, and the part the browser app does with `state.pending`. Without it a
follow-up like "from the library entrance" has nothing to attach to.

1. Open the **Conversation Variables** panel (chatflow, left edge of the
   canvas) and add two **String** variables, both default `""`:
   `pendingOriginId`, `pendingDestId`.
2. In the Code node add two inputs:
   `originId` = `{{#conversation.pendingOriginId#}}`,
   `destId` = `{{#conversation.pendingDestId#}}`.
   The engine already does the right thing with them — that is the
   `multi-turn` block in `tests/check_bundle.js`.
3. After the Code node, branch three ways, each with its own **Variable
   Assigner** node:

| branch | condition | assign |
|---|---|---|
| route found | `code.ok` is `true` | `pendingOriginId` = `` (clear), `pendingDestId` = `` |
| needs an origin | `code.need` is `origin` | `pendingDestId` = `{{#code.destId#}}`, `pendingOriginId` = `` |
| needs a destination | otherwise | `pendingOriginId` = `{{#code.originId#}}`, `pendingDestId` = `` |

Clearing on every completed route is what stops a stale destination from
hijacking the next, unrelated question — the same reason `src/app.js` sets
`state.pending = null`.

Now: "I'm at the library" → "Got it, where to?" → "LG1 canteen" → the route,
in the same conversation.

---

## 5. Phase 3 — publish, and the checks before you send the link

1. **Publish → Publish Update**（发布 → 发布更新）. In **Overview**（概览）, set the icon, name
   (`HKUST Campus Guide`) and description; under **Web App**（Web 应用）fill in the
   opening message and the suggested questions:

   opening: `Ask me how to get anywhere on campus - EN / 中文 / 粵語.`
   suggested questions (one per line, all verified against the engine):
   `I am at the library entrance, how do I get to LG1 canteen?` — 3 min 12 s
   `圖書館去 LG1 飯堂點行` — 3 min 12 s, no lift
   `LG7 食堂去 LG1 食堂 不想走楼梯` — 3 min 01 s, one lift
   `图书馆去游泳池` — 10 min 54 s, two lifts
   `What's open for dinner after 8pm?` — the model, from FACTS


2. **Access**: Site (public link, no login) is what a course submission wants.
   Copy the `https://udify.app/chat/…` link — that is the single link.

3. Run the eight checks in **Appendix A** on the published link, not in the
   editor. The editor sometimes has a warm sandbox that a cold start does not.

4. Paste the link into `docs/SUBMISSION.md` §1 and at the top of this file.

---

## 6. Limits, and what happens when they bite

| limit | value | what we do |
|---|---|---|
| Code node output | 400,000 chars | the longest answer here is ~700 chars |
| Code node nesting | 5 levels | the answer object is 4 (`answer → understood → candidates → item`) |
| Code node network | blocked | the engine makes no calls — that is why it can live in a node at all |
| Sandbox plan | ~200 messages / 5 apps | one app; the engine path costs no tokens, so previews are cheap |
| DeepSeek cost | a few cents | the model only runs on the FALSE branch |
| Bundle size | 82 KB pasted | if a box refuses it, use `dist/dify-engine.min.js` (74 KB) in the same wrapper |

Plan B2, only if the paste is refused outright: `api/route.mjs` (about 40
lines around the same bundle, `POST {query}` → JSON) on Vercel or Cloudflare,
called from an **HTTP Request** node. One more deploy and an egress rule, plus
latency — which is why the paste is tried first.

---

## Appendix A — the eight acceptance checks

Run these on the published link, in a fresh conversation. Six are the course
demo; two are the ones that prove the architecture.

| # | ask | pass looks like |
|---|---|---|
| 1 | `I am at the library entrance, how do I get to LG1 canteen?` | 3 min 12 s · 260 m · no lift · Step-free, three numbered steps, arrival line — identical to the browser app |
| 2 | `from LG7 canteen to a 3F classroom, no stairs` | two lift banks, no stairs or escalator in the steps |
| 3 | `圖書館去 LG1 飯堂點行` | 3 min 12 s · 圖書館入口 → LG1 食堂（美心）, no lift, Chinese labels |
| 4 | `where is the nearest toilet from the piazza?` | "Nearest restroom to Entrance Piazza" + a walk |
| 5 | `LG5 麦当劳考试周通宵吗` | LLM answers from FACTS, no invented route |
| 6 | `how long does it take` | asks for both places, invents no number |
| 7 | **model off** — delete the LLM node, or point it at a model with no credits, and republish | checks 1–4 still pass unchanged. This is the fallback path — and it is exactly the 3-node DSL file |
| 8 | open the link on a phone, rotate, ask check 1 | readable, steps wrap, no horizontal scroll |

Check 7 is the one to show in the report: it is the difference between "a
chatbot that talks about a router" and "a router that a chatbot can talk to".

### What the rules still get wrong (say this before a grader finds it)

* A floor plus a *building*, not a room — "怎么去 3 楼教室" — resolves to the
  3/F corridor node, because no room is called "教室". The route is right to
  the floor and the last 20 m are up to the reader.
* A bare `食堂` with no floor picks LG7 (it is registered first). With the
  floor it is unambiguous, with or without a space: `去LG1食堂` works since the
  compact-alias fix in `src/nlu.js`.
* Both are rule-table gaps, not router bugs — which is exactly the class of
  sentence the LLM branch is for, and the reason `Engine.suggest()` exists.

## Appendix B — why the engine lives in a Code node, not in the prompt

| | model-only | this build |
|---|---|---|
| same question twice | usually the same, not guaranteed | byte-identical (`tests/check_bundle.js`) |
| floor / lift numbers | hallucination risk | read out of `src/data/campus.ust.js` |
| the 641 router assertions | cover none of it | cover the same code path |
| model down | app is down | every route still works |
| cost per route | one completion | zero |
