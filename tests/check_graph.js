/* Data self-check: run with `node tests/check_graph.js`
   Verifies the hand-written campus data before any UI depends on it. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'src/data/campus.js'), 'utf8'), sandbox, { filename: 'campus.js' });

const C = sandbox.FUST.Campus;
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL ' + msg); } };

console.log('nodes=' + C.nodes.length + '  edges=' + C.edges.length + '  rooms=' + C.ROOMS.length);

const kinds = {};
C.edges.forEach(e => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
console.log('edge kinds: ' + JSON.stringify(kinds));

// 1. every edge endpoint exists
C.edges.forEach(e => ok(C.nodeById[e.a] && C.nodeById[e.b], 'dangling edge ' + e.id));

// 2. no duplicate edges between the same pair
const seen = new Set();
C.edges.forEach(e => {
  const k = [e.a, e.b].sort().join('|') + '|' + e.kind;
  ok(!seen.has(k), 'duplicate edge ' + k);
  seen.add(k);
});

// 3. full connectivity (walking graph)
const reach = (filter) => {
  const start = C.nodes[0].id;
  const back = new Set([start]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    C.adjacency[cur].forEach(l => {
      const e = l.edge;
      if (filter && !filter(e)) return;
      if (!back.has(l.to)) { back.add(l.to); q.push(l.to); }
    });
  }
  return back;
};
const all = reach(null);
ok(all.size === C.nodes.length, 'graph not connected: reached ' + all.size + '/' + C.nodes.length);

// 4. step-free subgraph reaches everything except stair-only nodes
const stepFree = reach(e => e.accessible);
const notStepFree = C.nodes.filter(n => !stepFree.has(n.id));
console.log('step-free reach: ' + stepFree.size + '/' + C.nodes.length +
  (notStepFree.length ? '  (not step-free: ' + notStepFree.map(n => n.id).join(', ') + ')' : ''));
ok(stepFree.size > C.nodes.length * 0.95, 'step-free graph lost too many nodes');

// 5. every POI must be reachable step-free
C.ROOMS.forEach(r => {
  const n = C.nodeById[r.id];
  ok(n, 'missing room node ' + r.id);
  ok(stepFree.has(r.id), 'room not reachable step-free: ' + r.id);
});

// 6. room door length sanity (<= 140 units = 45 m)
C.edges.filter(e => e.kind === 'room' || e.kind === 'junction').forEach(e => {
  ok(e.m <= 45, 'very long door edge ' + e.id + ' (' + e.m + ' m)');
});

// 7. indoor edges stay inside their building footprint
const inside = (b, x, y) => {
  const [bx, by, bw, bh] = C.BUILDINGS[b].rect;
  return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
};
C.edges.filter(e => e.kind === 'corridor' || e.kind === 'room' || e.kind === 'junction').forEach(e => {
  const A = C.nodeById[e.a], B = C.nodeById[e.b];
  if (A.b !== B.b) return;
  ok(inside(A.b, A.x, A.y) && inside(A.b, B.x, B.y), 'edge leaves footprint ' + e.id);
});

// 8. building links join different buildings, on the same floor
C.edges.filter(e => ['skybridge', 'walkway', 'outdoor'].includes(e.kind)).forEach(e => {
  const A = C.nodeById[e.a], B = C.nodeById[e.b];
  ok(A.b !== B.b, 'link inside one building ' + e.id);
  ok(A.f === B.f, 'link crosses floors ' + e.id);
});

// 9. every core is present on all of its floors
C.CORES.forEach(c => {
  c.floors.forEach(f => {
    const n = C.nodes.find(n => n.b === c.b && n.f === f && n.x === c.x && n.y === c.y);
    ok(n, 'core ' + c.id + ' missing on ' + c.b + ' ' + f);
  });
});

// 10. every building has a step-free core
Object.keys(C.FLOORS).forEach(b => {
  const lifts = C.CORES.filter(c => c.b === b && c.kind === 'lift');
  ok(lifts.length > 0, 'building without a lift: ' + b);
});

// 11. the intended quirk: Lift 2 skips LG1
const lg1Lift2 = C.nodes.find(n => n.b === 'AT' && n.f === 'LG1' && n.core === 'L2');
ok(!lg1Lift2, 'Lift 2 should not reach LG1');

// 12. no orphan nodes
C.nodes.forEach(n => ok(C.adjacency[n.id].length > 0, 'orphan node ' + n.id));

console.log(fails === 0 ? '\nDATA OK - all checks passed' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails === 0 ? 0 : 1);
