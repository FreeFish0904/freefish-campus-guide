# Putting the guide on Dify Cloud

**Status: S1 done (engine bundle), S0 (Dify clicking) not started.**
Live web app: <https://freefish0904.github.io/freefish-campus-guide/>

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
   ├── answer.ok = true ──────────────────────────► Answer: {{engine.text}}
   │                                                (verbatim, no model)
   └── answer.ok = false
          │
          ▼
       LLM「front desk」  DeepSeek — only for "I don't know what you mean"
          │                and campus-life questions
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

## 1. What the build produces

```bash
node tools/bundle_engine.js        # writes dist/, prints the engine version
node tests/check_bundle.js         # 103 checks: fresh, sandbox-safe, byte-identical
```

| file | size | what it is |
|---|---|---|
| `dist/dify-code-node.js` | 82 KB | **paste this into the Code node** — the engine behind `function main(inputs)` |
| `dist/dify-engine.js` | 104 KB | the same code unwrapped, for `node dist/dify-engine.js` debugging |
| `dist/dify-engine.min.js` | 74 KB | comments and indentation stripped, if a box complains about size |

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

1. <https://cloud.dify.ai> → **Studio** → **Create from Blank** → **Chatflow**.
   Name it `HKUST Campus Guide`. (Chatflow, not Workflow: we want the chat box
   and conversation variables; the Workflow app has no chat UI.)
2. The graph already has **Start**. Click **+** after it → **Code**.
3. In the Code node: language **JavaScript**, then **Input Variables**:

   | name | type | value |
   |---|---|---|
   | `query` | String | `{{#sys.query#}}` |
   | `lang` | String | *(leave empty — the engine detects EN/中文/粵語)* |

   Delete the two default input rows Dify puts there, and do **not** add
   `originId` / `destId` yet (empty is the same as absent).
4. Paste all of `dist/dify-code-node.js` into the code box. **Run this node**
   in the node's debug panel with `query` = `library entrance to lg 1 canteen`;
   the output should be the block quoted above, and `ok: true`, `sec: 192`,
   `lifts: []`.
5. Add an **Answer** node after the Code node with the text
   `{{#code.text#}}`, and **Preview** the chat. Ask the three questions below.

| ask this | expect |
|---|---|
| `library entrance to lg 1 canteen` | a route, 3 min 12 s, no lift |
| `where is the nearest toilet from the piazza` | "Nearest restroom to Entrance Piazza", 5 min 26 s |
| `hello` | "Try: \"I am at the Library entrance, how do I get to LT-1?\" …" |

**Report back one of these three**, and we go to Phase 1:

* *(a)* it worked → nothing to do, keep going;
* *(b)* Dify rejected the paste (too large / error shown) → send me the exact
  message; the fallback is `dist/dify-engine.min.js` (74 KB) in the same
  wrapper, and if that also fails, plan B2 (a 40-line serverless
  `api/route.mjs` + an HTTP Request node) — the engine is already known to run
  headless in ~11 ms;
* *(c)* it loaded but a query returned `ok: false` with a stack trace → the
  sandbox lacks something; send me `Engine.version` plus the error.

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
| Start | Start | only `sys.query` is used |
| Code「engine」 | Code, JavaScript | inputs `query` = `{{#sys.query#}}`, `lang` = *(empty)*; body = `dist/dify-code-node.js` |
| If「rules answered?」 | If/Else | condition `{{#code.ok#}}` **is** `true` → TRUE |
| Answer「route」 | Answer | `{{#code.text#}}` |
| LLM「front desk」 | LLM | model **deepseek-v4-pro**, temperature **0**, max tokens **240**, no thinking mode |
| Answer「reply」 | Answer | `{{#llm.text#}}` |

Two rules that make this an honest demo:

1. **The TRUE branch prints the engine text verbatim.** No model, no
   reformatting. If the model is down, if the credits are gone, if the
   provider rate-limits — the route still comes out, with the right numbers.
2. **The LLM branch never sees a route.** On the FALSE branch the engine found
   nothing to draw, so there is nothing for the model to get wrong.

### Model

Dify Cloud → **Settings → Model Provider → DeepSeek**; paste the API key
(`base_url` is `https://api.deepseek.com`, OpenAI-compatible). The model ids
the DeepSeek docs list today are `deepseek-v4-pro` (DeepSeek-V4-Pro-0813) and
`deepseek-flash` (V4.1-Flash-1017); `deepseek-v4-flash` is still accepted as a
legacy alias. Use **`deepseek-v4-pro`** here — it is the one that follows the
"do not invent a walking time" instruction.

If Dify's list shows `deepseek-v4-pro` with no thinking toggle, that is the
plain endpoint and is what we want. If it offers a reasoning variant as a
separate entry, pick the plain one: the answer is at most 60 words.

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

1. **Publish → Publish Update**. In **Overview**, set the icon, name
   (`HKUST Campus Guide`) and description; under **Web App** fill in the
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
| 7 | **model off** — delete the LLM node or empty the DeepSeek key, republish | checks 1–4 still pass unchanged. This is the fallback path |
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
