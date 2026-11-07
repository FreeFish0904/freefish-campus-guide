# Submission sheet

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
in three languages. The LLM (DeepSeek) only handles the sentences the rules
refuse to guess at, and the route branch never touches the model: with the
model switched off, every wayfinding answer still works.

> Dify Web App link: *pending — Phase 0 of `docs/DIFY.md`*


## 2. Test log (~300 words)

`docs/TEST_LOG.md` — what was tested, how to re-run it, and the five bugs the
tests caught. Raw output: `docs/TEST_RESULTS.md` (49 cases, 566 assertions,
0 failures).

```bash
node tests/check_graph.js     # data integrity
node tests/run_tests.js       # 49 cases -> docs/TEST_RESULTS.md
open tests/smoke.html         # 17 UI checks in a real browser
```

## 3. Five sample queries

`docs/SAMPLE_QUERIES.md` — each one lists the exact wording in EN / 中文 /
粵語, what it is meant to prove, and the answer the current build returns.
Those five are written against the fictional demo campus; the five HKUST
questions are the cards on screen, e.g. *Library entrance → LG1 Canteen*
(3 min 12 s, no lift) and *LG7 Canteen → LT-A* (two lift banks).

1. `I am at the Library main entrance, how do I get to LT-1?`
2. `我在学生活动中心 LG1 的咖啡店，要去工程附楼 7 楼的高级机器人实验室，不想走楼梯`
3. `Where's the nearest restroom? I'm in the Atrium.`
4. `圖書館去 Lab 402 最快點行？`
5. `libary entraince to lt 1 pls`

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
