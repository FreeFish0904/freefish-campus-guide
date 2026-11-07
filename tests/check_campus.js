/* Shared data checks for any campus spec built by src/data/graph.js.
   `checkCampus` returns a list of human readable problems; the caller
   decides how to print them and what to exit with. */
'use strict';

function checkCampus(C, label) {
  const problems = [];
  const ok = (cond, msg) => { if (!cond) problems.push(msg); };

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

  // 4. step-free subgraph reaches (almost) everything
  const stepFree = reach(e => e.accessible);
  const notStepFree = C.nodes.filter(n => !stepFree.has(n.id));
  ok(stepFree.size > C.nodes.length * 0.95,
    'step-free graph lost too many nodes (' + stepFree.size + '/' + C.nodes.length + ')');

  // 5. every POI must be reachable step-free
  C.ROOMS.forEach(r => {
    const n = C.nodeById[r.id];
    ok(n, 'missing room node ' + r.id);
    ok(stepFree.has(r.id), 'room not reachable step-free: ' + r.id);
  });

  // 6. door lengths: a room must hang off its corridor (<= 45 m); a link
  //    pigtail is a corridor stub and may legitimately be longer (<= 120 m)
  C.edges.filter(e => e.kind === 'room').forEach(e => {
    ok(e.m <= 45, 'room more than 45 m from the corridor: ' + e.id + ' (' + e.m + ' m)');
  });
  C.edges.filter(e => e.kind === 'junction').forEach(e => {
    ok(e.m <= 120, 'link stub longer than 120 m: ' + e.id + ' (' + e.m + ' m)');
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

  // 10. every stack of more than one floor has a step-free core
  Object.keys(C.FLOORS).forEach(b => {
    if ((C.BUILDINGS[b] || {}).kind === 'open') return;
    if (C.FLOORS[b].length < 2) return;
    const lifts = C.CORES.filter(c => c.b === b && c.kind === 'lift');
    ok(lifts.length > 0, 'building without a lift: ' + b);
  });

  // 11. declared quirks (the facts the demo or the guide depends on)
  (C.QUIRKS || []).forEach(q => {
    if (q.kind === 'core-absent') {
      const hit = C.nodes.find(n => n.b === q.b && n.f === q.f && n.core === q.core);
      ok(!hit, 'quirk broken: ' + q.core + ' should not reach ' + q.b + ' ' + q.f);
    } else if (q.kind === 'no-link-level') {
      const hit = C.edges.find(e => {
        const A = C.nodeById[e.a], B = C.nodeById[e.b];
        return [e.kind === 'skybridge' || e.kind === 'walkway' || e.kind === 'outdoor',
                A.f === q.f && B.f === q.f,
                (A.b === q.a && B.b === q.b) || (A.b === q.b && B.b === q.a)].every(Boolean);
      });
      ok(!hit, 'quirk broken: ' + q.a + '/' + q.b + ' should not be linked on ' + q.f);
    }
  });

  // 12. no orphan nodes
  C.nodes.forEach(n => ok(C.adjacency[n.id].length > 0, 'orphan node ' + n.id));

  return { label: label, problems: problems, notStepFree: notStepFree };
}

/* The newcomer checklist is data like the campus: a typo in a room id turns
   a "Go" button into a button that does nothing, and a missing translation
   shows up as an empty row. Checked separately so the failure names the
   task, not the campus. */
function checkTasks(T, C) {
  const problems = [];
  const ok = (cond, msg) => { if (!cond) problems.push(msg); };
  const LANGS = ['en', 'zh', 'yue'];

  const groupIds = new Set((T.groups || []).map(g => g.id));
  const ids = new Set();

  (T.items || []).forEach(it => {
    ok(!ids.has(it.id), 'duplicate task id ' + it.id);
    ids.add(it.id);
    ok(groupIds.has(it.group), it.id + ': unknown group ' + it.group);
    ok(!!it.src, it.id + ': no source section');
    LANGS.forEach(l => {
      ok(!!(it.title && it.title[l]), it.id + ': title missing ' + l);
      ok(!!(it.note && it.note[l]), it.id + ': note missing ' + l);
    });
    if (it.at) {
      const n = C.nodeById && C.nodeById[it.at];
      ok(!!n, it.id + ': at=' + it.at + ' is not a place on this campus');
      if (n) { ok(n.kind === 'room' || n.kind === 'core', it.id + ': at=' + it.at + ' is not a room'); }
      ok(!it.offsite, it.id + ': off campus and on the map at the same time');
    }
  });

  (T.groups || []).forEach(g => {
    const n = (T.items || []).filter(i => i.group === g.id).length;
    ok(n > 0, 'empty group ' + g.id);
    LANGS.forEach(l => ok(!!(g.title && g.title[l]) && !!(g.note && g.note[l]),
      'group ' + g.id + ': missing ' + l));
  });

  (T.tips || []).forEach(tip => {
    LANGS.forEach(l => ok(!!(tip.text && tip.text[l]), 'tip ' + tip.id + ': missing ' + l));
    ok(!!tip.src, 'tip ' + tip.id + ': no source section');
  });

  /* deliberately a golden number: the header badge and the progress bar are
     read as "n of 22" in screenshots, so a silent addition is a change the
     check should make you notice */
  ok((T.items || []).length === 22, 'expected 22 tasks, found ' + (T.items || []).length);

  return { problems: problems, count: (T.items || []).length };
}

module.exports = { checkCampus: checkCampus, checkTasks: checkTasks };
