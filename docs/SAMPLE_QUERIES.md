# Five sample queries

Type any of these into the box at the bottom left (or tap the matching
card above it). Numbers were taken from the current build; times are the
planner's own estimate, not a stopwatch.

> These five are written against the **fictional demo campus** - append
> `&data=demo` to the URL to load it. The app ships on the real HKUST data;
> its five questions are the cards on screen, e.g. *Library entrance to the
> LG1 Canteen* and *LG7 canteen to LT-A* (two lift banks, because the LG bank
> stops at G/F).

---

## 1. Cross-building, two lifts and a skybridge

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

## 2. Long step-free chain with a hard constraint

> **中文** `我在学生活动中心 LG1 的咖啡店，要去工程附楼 7 楼的高级机器人实验室，不想走楼梯`
> **粵語** `我喺學生活動中心 LG1 嘅咖啡店，要去工程附樓 7 樓嘅高級機械人實驗室，唔想行樓梯`
> **EN** `I am at the coffee shop in the Hub LG1, how do I get to the robotics lab on 7F of the Engineering Annex without stairs?`

**Tests:** floor + building + room in one sentence, Cantonese "唔想行樓梯",
and a route that is only possible with three different lifts.

**Expected:** Coffee Shop → Advanced Robotics Lab, **5 min 51 s**, **286 m**,
**3 lifts** (Lift 5 → Lift 2 → Lift 4), 10 steps, no stairs and no escalator.
The fastest alternative is 4 min 56 s but uses the Hub stairs.

---

## 3. Nearest facility, no room code

> **EN** `Where's the nearest restroom? I'm in the Atrium.`
> **中文** `最近的洗手间在哪里？我在中庭`
> **粵語** `最近嘅洗手間喺邊？我喺中庭大堂`

**Tests:** point-of-interest search by type instead of by name, and an
abbreviated place name ("中庭" for 中庭大堂).

**Expected:** nearest restroom to the Atrium = **Restroom (G/F)**, a 34 s
walk (46 m). The card also lists the next two closest: Restroom (LG1) and
Restroom (2/F).

---

## 4. Fastest versus step-free, side by side

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

## 5. Typos and a missing verb

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

The address bar keeps the last query, so any of these can be shared:

```
index.html?q=I%20am%20at%20the%20Library%20main%20entrance%2C%20how%20do%20I%20get%20to%20LT-1%3F&lang=en&sf=1
```

`lang` is `en`, `zh` or `yue`; `sf=0` starts with step-free routing off;
`floor=2F` opens a specific floor of the plan.
