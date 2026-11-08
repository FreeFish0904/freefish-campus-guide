# Submission sheet

What the brief asks for, and where it is:

| # | item | where |
|---|---|---|
| 1 | a working demo, one click, no login | **§1** — the GitHub Pages link, live now; the Dify chat link is the last line of §1 |
| 2 | a test log, ~300 words | `docs/TEST_LOG.md` — §2 says how to re-run every check in it |
| 3 | five sample queries | `docs/SAMPLE_QUERIES.md`, repeated in §3 |
| 4 | a three-sentence blurb | the last section |

Everything above is a file in <https://github.com/FreeFish0904/freefish-campus-guide>,
next to the code it describes, so the log can be re-run rather than believed.

## 1. Demo link

**<https://freefish0904.github.io/freefish-campus-guide/>**

Live on GitHub Pages, deployed from `main` (repo:
<https://github.com/FreeFish0904/freefish-campus-guide>). The site is fully
static — `index.html` at the repository root, no build step — so the same
folder also runs offline:

```
open index.html                          # double-click also works
python3 -m http.server 8000              # or serve it locally
```

Handy deep links to paste into a demo (all checked against the shipped data):

| | |
|---|---|
| Library → LG1 canteen | `?q=library+entrance+to+lg1+canteen&lang=en` |
| 图书馆 → 游泳池 | `?q=图书馆去游泳池&lang=zh` |
| 粵語, same trip | `?q=圖書館去 LG1 飯堂點行&lang=yue` |
| Step-free turned off | `?q=library+to+lsk+canteen&sf=0` |
| Jump straight to 3/F | `?q=library+to+3f+classroom&floor=3F` |
| The fictional demo campus | `?data=demo&q=library+to+LT-1&lang=en` |

The first five are HKUST questions, which is what the site serves by default.
`LT-1`, `Lab 402` and `附樓7樓` belong to the fictional demo campus, so they
need `&data=demo` in front of them or the app will ask which place you mean.

### Same engine, on Dify (one chat link)

`docs/DIFY.md`. The routing engine is bundled unchanged
(`node tools/bundle_engine.js` → `dist/dify-code-node.js`) and runs inside a
Dify Code node, so the Dify app and this web app return **the same route
text, byte for byte** — asserted by `tests/check_bundle.js`, twelve questions
in three languages. The Code node may return exactly the three outputs it
declares (`text`, `kind`, `ok`): Dify compares the *number* of keys returned
against the declared list, not the names, which is what failed the first
import. The LLM (`gpt-5.6-sol`) only handles the sentences the rules refuse to
guess at, and the route branch never touches the model: with the model
switched off, every wayfinding answer still works.

> Dify Web App link: **«paste `https://udify.app/chat/…` here after 发布»**
> The app is imported and every node runs (2026-11-08); the publish click is
> the only step left — `docs/DIFY.md` §5.


## 2. Test log (~300 words)

`docs/TEST_LOG.md` — what was tested, how to re-run it, and the 22 bugs the
tests caught. Raw output: `docs/TEST_RESULTS.md` (49 cases, 641 assertions,
0 failures).

```bash
node tests/check_graph.js     # data integrity, both campuses
node tests/run_tests.js       # 49 cases -> 641 assertions -> docs/TEST_RESULTS.md
node tests/check_bundle.js    # 116: the Dify Code node is byte-identical
node tests/check_sandbox.js   # 42: strict mode, no console, junk input, size limits
node tests/check_dsl.js       # 204: both DSL files parse, wire up, and run
open tests/smoke.html         # UI, in a real browser (also font + layout checks)
```

## 3. Five sample queries

`docs/SAMPLE_QUERIES.md` — each one gives the exact wording in EN / 中文 / 粵語,
what it is meant to prove, and the answer the current build returns. All five
run on the default HKUST map, so they work on the submitted link exactly as
typed:

1. `I am at the library entrance, how do I get to LG1 canteen?` —
   **3 min 12 s**, 260 m, no lift (中文 and 粵語 wordings in the file)
2. `图书馆去游泳池` — **10 min 54 s**, 790 m, Lift 1 then Lift 9
3. `nearest toilet from the library entrance` — Restroom (Library),
   **3 min 46 s**, one lift
4. `LG7 食堂去 LG1 食堂 不想走楼梯` — **3 min 1 s**, 170 m, one lift, no stairs
5. `libary to lg 1 canteen pls` — *"I read "libary" as library."*, then the same
   **3 min 12 s** as query 1

The same file also keeps five demo-campus variants under `&data=demo` (LT-1,
Lab 402), because those are the routes the 49-case suite asserts exactly.

## Blurb (three sentences)

> Freefish Campus Guide is a browser prototype that turns one sentence such as
> "我在图书馆正门，怎么去 LG1 食堂？" into a numbered indoor route: which lift to
> take, which floor to cross on, and which skybridge or covered walkway links
> the buildings. It understands English, Chinese and Cantonese (including
> typos) and plans on a real graph of corridors, stairs and six lift shafts,
> with a step-free mode that refuses stairs and compares its cost against the
> fastest route. Every answer is drawn on a floor plan that switches floors by
> itself during the walkthrough, and the whole interface can be re-read in the
> other two languages without losing the route.

---

Group 16 · AISC1000A (LA12)
