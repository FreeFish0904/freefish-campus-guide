# Test log

## What was tested

Everything runs locally; there is no backend.

- `node tests/run_tests.js` runs 49 cases / 599 assertions against the same
  scripts the browser loads and writes `docs/TEST_RESULTS.md`.
- `node tests/check_graph.js` validates the data alone: 214 nodes, 300 edges,
  one connected graph, all 57 points of interest reachable without stairs, no
  orphan nodes, every indoor edge inside its footprint.
- `tests/smoke.html` drives the real interface: five cards, three languages,
  a step click, a floor tab, the player, the step-free switch, a question with
  no origin, and gibberish — 17 checks, 0 JavaScript errors.
- `tests/layout_check.html` re-renders every floor in every language with and
  without a route (72 renders, ~1300 `<text>` nodes), measures each label with
  `getBBox()` and fails if one touches another label, a lift box, the route
  line, the canvas edge, or the walls of its own building.

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

## Still weak

57 POIs only; constant walking speed and lift waits; no voice input.


