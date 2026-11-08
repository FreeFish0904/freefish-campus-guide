# Five sample queries

These five are the ones to type into the submitted link. Each lists the same
question in EN / 中文 / 粵語, what it is meant to prove, and the answer this build
returns — the times, distances and lift counts below were printed by
`Engine.answer()` out of `dist/dify-code-node.js`, the same file the Dify Code
node runs, so the web page and the chat link cannot disagree.

Open <https://freefish0904.github.io/freefish-campus-guide/>, type one into the
box at the bottom left, or tap the matching card above it. Everything runs on the
real HKUST map that loads by default — no `&data=` needed.

## 1. One sentence, one building hop, no lift

> **EN** `I am at the library entrance, how do I get to LG1 canteen?`
> **中文** `我在图书馆入口，怎么去 LG1 食堂？`
> **粵語** `我喺圖書館入口，點去 LG1 飯堂？`

**Tests:** origin/destination extraction in three languages, a synonym
(`飯堂` = `食堂` = canteen), cross-building routing and the step-free default.

**Expected:** Library Entrance → LG1 Canteen (Maxim's), **3 min 12 s**, **260 m**,
**no lift**, three steps — the covered walkway links the Library to the Academic
Building on LG1, so this one needs no lift at all.

## 2. Three buildings, two lift shafts

> **EN** `from the library to the swimming pool`
> **中文** `图书馆去游泳池`
> **粵語** `圖書館去游泳池`

**Tests:** a long chain — Library → Academic Building → Entrance Piazza → Sports
Center — where the planner has to change floors twice in two different shafts.

**Expected:** Library Entrance → Swimming Pool, **10 min 54 s**, **790 m**,
**2 lifts** (Lift 1 LG1→G/F, Lift 9 G/F→1/F), 11 steps. Underneath:
*"Faster but uses stairs: 10 min 25 s (saves 29 s)"* — the trade-off is shown,
not chosen silently.

## 3. Nearest facility, no room code

> **EN** `nearest toilet from the library entrance`
> **中文** `最近的洗手间在哪里？我在图书馆入口`
> **粵語** `最近嘅洗手間喺邊？我喺圖書館入口`

**Tests:** point-of-interest search by *type* instead of by name — no place
called "restroom" was typed, and the answer still names a real one.

**Expected:** Nearest restroom to Library Entrance = **Restroom (Library)**,
**3 min 46 s**, **250 m**, **1 lift** (Lift 7 LG1→G/F). The card also lists the
next two closest: Restroom (LG1) and Restroom (LG3).

## 4. A hard step-free constraint

> **EN** `LG7 canteen to LG1 canteen no stairs`
> **中文** `LG7 食堂去 LG1 食堂 不想走楼梯`
> **粵語** `LG7 飯堂去 LG1 飯堂唔想行樓梯`

**Tests:** the negative constraint ("no stairs" / "不想走楼梯" / "唔想行樓梯") is
read as an accessibility request, not as a complaint — and LG7 to LG1 is nine
floors apart in the same building.

**Expected:** LG7 Canteen → LG1 Canteen (Maxim's), **3 min 1 s**, **170 m**,
**1 lift** (Lift 1, LG7/F → LG1, 55 s), three steps, no stairs and no escalator.

## 5. Typos and abbreviations

> **EN** `libary to lg 1 canteen pls`
> **粵語** `圖書館去泳池點行`

**Tests:** fuzzy matching on a misspelled word, "A to B" without a verb, a
trailing "pls", and an abbreviation (`泳池` for `游泳池`).

**Expected:** the note *"I read "libary" as library."* above the same
**3 min 12 s** route as query 1, without a second question; `圖書館去泳池點行`
returns the query-2 route, **10 分 54 秒**, with no correction note because
nothing needed correcting.

---

## The same five on the fictional campus (`&data=demo`)

Everything below is written against the **invented** campus — append
`&data=demo` to the URL (LT-1, Lab 402 and 附樓7樓 only exist there). These are
the routes the 49-case suite asserts exactly, so the numbers are pinned by a
test rather than by a screenshot. The submitted link needs none of this; it is
here to show the engine is not tied to one data set.

The app ships on the real HKUST data; its five questions are the cards on
screen, i.e. the five above.

---

### D1. Cross-building, two lifts and a skybridge

> **EN** `I am at the Library main entrance, how do I get to LT-1?`
> **中文** `我在图书馆正门，怎么去 LT-1？`
> **粵語** `我喺圖書館正門，點去 LT-1？`

**Tests:** origin/destination extraction, room codes, cross-building routing,
lift choice, and the step-free default.

**Expected:** Library Main Entrance → LT-1 Lecture Theatre, **3 min 42 s**,
**202 m**, **2 lifts**:

1. Walk 80 m along the Library G/F corridor
2. Take **Lift 3** from G/F to 2/F (45 s)
3. Walk 8 m along the Library 2/F corridor, past Journal Collection
4. Cross the **skybridge** into Academic Tower (26 m)
5. Walk 53 m along the Academic Tower 2/F corridor, past ST-202
6. Take **Lift 2** from 2/F to 3/F (29 s) — *express G–4F, does not serve LG1*
7. Walk 35 m to LT-1 Lecture Theatre

The card also offers the stairs version: **2 min 50 s**, i.e. 52 seconds
faster but with two flights of stairs. That is what you get by switching
*Step-free* off.

---

### D2. Long step-free chain with a hard constraint

> **中文** `我在学生活动中心 LG1 的咖啡店，要去工程附楼 7 楼的高级机器人实验室，不想走楼梯`
> **粵語** `我喺學生活動中心 LG1 嘅咖啡店，要去工程附樓 7 樓嘅高級機械人實驗室，唔想行樓梯`
> **EN** `I am at the coffee shop in the Hub LG1, how do I get to the robotics lab on 7F of the Engineering Annex without stairs?`

**Tests:** floor + building + room in one sentence, Cantonese "唔想行樓梯",
and a route that is only possible with three different lifts.

**Expected:** Coffee Shop → Advanced Robotics Lab, **5 min 51 s**, **286 m**,
**3 lifts** (Lift 5 → Lift 2 → Lift 4), 10 steps, no stairs and no escalator.
The fastest alternative is 4 min 56 s but uses the Hub stairs.

---

### D3. Nearest facility, no room code

> **EN** `Where.s the nearest restroom? I'm in the Atrium.`
> **中文** `最近的洗手间在哪里？我在中庭`
> **粵語** `最近嘅洗手間喺邊？我喺中庭大堂`

**Tests:** point-of-interest search by type instead of by name, and an
abbreviated place name ("中庭" for 中庭大堂).

**Expected:** nearest restroom to the Atrium = **Restroom (G/F)**, a 34 s
walk (46 m). The card also lists the next two closest: Restroom (LG1) and
Restroom (2/F).

---

### D4. Fastest versus step-free, side by side

> **粵語** `圖書館去 Lab 402 最快點行？`
> **中文** `从图书馆去 Lab 402 最快怎么走？`
> **EN** `Fastest way from the Library to Lab 402?`

**Tests:** the word "最快 / fastest" overrides the step-free switch for this
one query, and the answer must still show the trade-off.

**Expected:** **4 min 34 s** using the Library and Academic Tower stairs and
then Lift 4 into the Annex, tagged *Fastest*. Underneath:
*"Step-free alternative: 5 min 11 s (+37 s)"*. Tapping any step highlights it
and jumps the floor plan to that floor.

---

### D5. Typos and a missing verb

> **EN** `libary entraince to lt 1 pls`

**Tests:** fuzzy matching on two misspelled words, "A to B" without a verb,
and a visible correction note instead of a silent guess.

**Expected:** the note *"I read "libary" as library"*, then the same
**3 min 42 s** route as query 1.

---

## The checklist (not a query, but the other way in)

Top right, **任务清单 / Checklist** — 22 things to get done, five groups,
five tips, and a counter that survives a reload. Anything that happens at a
place on the plan has a **Go** button:

> task *Register the ITSC account and Duo Mobile* → **Go** →
> *"Heading to ITSC Service Desk — where are you starting from?"* → pick an origin →
> the same route card the chat box produces.

What the split looks like:

| | |
|---|---|
| On the map | LG1 canteens, ITSC (twice), the ATM, the SU store, the bookstore,
  the 24-hour study area, the sea-view seats, the pool, the printers — **10 of 22** |
| Off campus | HKID, the student visa + D endorsement, the Octopus, the SIM —
  labelled *off campus*, no fake route |
| Neither | paperwork with no place on a floor plan: accepting the offer, the
  deposit, the student card, the four SIS steps, the app list — **8 of 22** |

`index.html?data=ust&tasks=1` opens the drawer directly; `?data=demo` hides the
entry point, because the demo campus is fictional and the checklist is not.

---

## Deep links

The address bar keeps the last query, so any of these can be shared as they are:

```
?q=library+entrance+to+lg1+canteen&lang=en        query 1
?q=library+entrance+to+lg1+canteen               same, in English by default
?q=图书馆去游泳池&lang=zh                           query 2, 中文
?q=圖書館去 LG1 飯堂點行&lang=yue                    query 1, 粵語
?q=lg7+canteen+to+lg1+canteen+no+stairs           query 4
?q=library+to+3f+classroom&floor=3F               opens 3/F on the plan
?data=demo&q=library+to+LT-1&lang=en              the fictional campus
```

`lang` is `en`, `zh` or `yue` (leave it out and the language is detected);
`sf=0` starts with step-free routing off; `floor=2F` opens a specific floor of
the plan; `data=demo` swaps the campus.

The five queries above are the same five that work on the Dify chat link — one
engine, one answer (`docs/DIFY.md`).
