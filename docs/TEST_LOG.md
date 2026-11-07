# Test log

## What was tested

Everything runs locally; there is no backend.

- `node tests/run_tests.js` runs 49 cases / 602 assertions against the same
  scripts the browser loads and writes `docs/TEST_RESULTS.md`.
- `node tests/check_graph.js` validates both data sets alone with the same
  checks (`tests/check_campus.js`): demo 214 nodes / 300 edges / 57 places,
  HKUST 240 nodes / 291 edges / 64 places - each one a connected graph, every
  place reachable without stairs, no orphan nodes, every indoor edge inside its
  footprint, and every declared quirk still true.
- `tests/smoke.html` drives the real interface: five cards, three languages,
  a step click, a floor tab, the player, the step-free switch, a question with
  no origin, and gibberish — 17 checks, 0 JavaScript errors.
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

## Still weak

Two data sets to keep in step; 47 places still marked 未核实; constant walking
speed and lift waits; no voice input. The newcomer to-do checklist (the tasks
and tips in `data/ust-newcomer.txt`) is not wired into the UI yet.


