# Freefish Campus Guide

An indoor campus wayfinding prototype: you type where you are and where you
want to go, and it answers with a numbered, lift-aware route plus a floor
plan that follows along.

Built for **AISC1000A (LA12) — Group 16**. The campus, its buildings, lift
numbers and room codes are **fictional demo data**.

![Desktop](docs/screenshots/desktop-en.png)

## What it does

- **Understands three languages** — English, 中文 and 粵語 (traditional,
  Hong Kong style) — in one box, with typo tolerance and synonym/alias
  matching. Room codes (`LT-1`, `CR-101`, `Lab 402`) and building + floor
  ("工程附樓 7 樓") both work.
- **Plans real indoor routes** — Dijkstra over a hand-built graph of
  corridors, stairs, an escalator, six lift shafts, a skybridge and a
  covered walkway.
- **Takes accessibility seriously** — a *Step-free* mode that refuses stairs
  and escalators, plus a side-by-side time comparison with the fastest route.
- **Explains the odd bits** — "Lift 2 does not serve LG1", "Lift 4 is the
  only step-free way into the Annex", "the Library has no ground-level door".
- **Draws the answer** — SVG floor plan per level, route highlighted, floors
  switching automatically during the walkthrough animation.
- **Re-translates live** — switching language re-renders the route that is
  already on screen instead of starting over.

## Run it

No build, no dependencies, no backend.

```bash
# simplest: just open the file
open index.html            # macOS
# or serve it
python3 -m http.server 8000
```

The app uses plain `<script>` tags on purpose, so it also works from
`file://` without a server.

## Try these

| Query | What it demonstrates |
|---|---|
| `I am at the Library main entrance, how do I get to LT-1?` | two lifts + the 2/F skybridge |
| `我在学生活动中心 LG1 的咖啡店，要去工程附楼 7 楼的高级机器人实验室，不想走楼梯` | three lifts, no stairs |
| `Where's the nearest restroom? I'm in the Atrium.` | nearest-POI search |
| `圖書館去 Lab 402 最快點行？` | fastest vs step-free |
| `libary entraince to lt 1 pls` | typo rescue |

More detail in [`docs/SAMPLE_QUERIES.md`](docs/SAMPLE_QUERIES.md).

## How it is put together

```
index.html            one page, eight <script> tags
styles.css            all styling, including the SVG floor plan
src/data/campus.js    the campus: buildings, floors, rooms, lifts, links
src/data/scenarios.js the five demo queries, in three languages
src/i18n.js           every UI string in EN / 中文 / 粵語
src/nlu.js            normalisation, segmentation, entity matching, typos
src/router.js         Dijkstra, step-free filter, nearest-POI search
src/steps.js          path -> walk / lift / stairs segments with landmarks
src/map.js            SVG floor plans + walkthrough player
src/app.js            state, chat thread, wiring
tests/                graph checker, 49-case suite, screenshot script
docs/                 test log, sample queries, deploy guide, screenshots
```

**Data model.** `campus.js` declares buildings with a fixed footprint, one
horizontal *spine* per building, a list of rooms that hang off the nearest
spine node, vertical *cores* (lifts/stairs) with the floors they serve, and a
handful of building-to-building links. Everything else — the 214-node graph,
the 300 edges, walking distances — is derived from those declarations, so
timetables and maps can never disagree. Swap this one file to describe a
different campus.

**Cost model.** Walking is `metres / 1.35 m/s`; stairs are 16 s per floor;
a lift ride is `wait + per-floor` with the wait charged once per ride; an
escalator is 22 s. Step-free mode removes every edge flagged
`accessible: false`.

## Tests

```bash
node tests/check_graph.js     # data integrity: connectivity, footprints, lifts
node tests/run_tests.js       # 49 cases / 566 assertions -> docs/TEST_RESULTS.md
open tests/smoke.html         # 17 UI checks, driven in a real browser
python3 tests/screenshots.py  # regenerate docs/screenshots
```

Current status: **49 cases, 566 assertions, 0 failures**. Details and the
bugs that were found on the way are in
[`docs/TEST_LOG.md`](docs/TEST_LOG.md).

## Screenshots

| | |
|---|---|
| ![Skybridge](docs/screenshots/desktop-skybridge.png) | ![Chinese](docs/screenshots/desktop-zh.png) |
| 2/F skybridge, route highlighted | 中文, three-lift step-free route |
| ![Fastest](docs/screenshots/desktop-fastest.png) | ![Phone](docs/screenshots/mobile-390.png) |
| Fastest route with the step-free alternative | 390 × 844 phone layout |

## Known limitations

- 57 points of interest across six buildings; the demo is a slice of a campus,
  not a whole campus.
- Lift waiting times, walking speed and floor heights are constants, not live
  data, so ETAs are estimates.
- No voice input, no turn-by-turn GPS, no live lift status.
- The floor plan is schematic: it shows topology, not surveyed geometry.

## Deploying

Static hosting only — [`docs/DEPLOY.md`](docs/DEPLOY.md) has the drag-and-drop
GitHub Pages steps.

---

Group 16 · AISC1000A (LA12) · course prototype, fictional campus data.
