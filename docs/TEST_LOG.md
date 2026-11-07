# Test log

## What was tested

Everything runs locally; there is no backend.

- `node tests/run_tests.js` runs 49 cases / 566 assertions against the same
  scripts the browser loads and writes `docs/TEST_RESULTS.md`.
- `node tests/check_graph.js` validates the data alone: 214 nodes, 300 edges,
  one connected graph, all 57 points of interest reachable without stairs, no
  orphan nodes, every indoor edge inside its footprint.
- `tests/smoke.html` drives the real interface: five cards, three languages,
  a step click, a floor tab, the player, the step-free switch, a question with
  no origin, and gibberish — 17 checks, 0 JavaScript errors.

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

## Still weak

57 POIs only; ETA assumes a constant walking speed; lift waiting times are
constants rather than live data; there is no voice input.


