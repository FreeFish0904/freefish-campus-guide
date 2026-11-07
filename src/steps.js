/* =====================================================================
 * Steps - turn a raw node path into human-sized segments:
 *   walk (indoor / skybridge / walkway / outdoor) - merged, with a landmark
 *   lift / stairs / escalator - merged across floors for the same core
 * ===================================================================== */
(function () {
  'use strict';

  var C = globalThis.FUST.Campus;

  var WALK_SUB = {
    corridor: 'indoor', room: 'indoor', junction: 'indoor',
    skybridge: 'skybridge', walkway: 'walkway', outdoor: 'outdoor'
  };

  /* Nearest named room on the same floor, used for "past the coffee shop".
     Restrooms are skipped: "turn left past the toilet" reads badly. */
  function landmarkFor(b, f, x, y) {
    var best = null, bd = Infinity;
    C.nodes.forEach(function (n) {
      if (n.kind !== 'room' || n.b !== b || n.f !== f) { return; }
      if (n.poi === 'restroom' || n.poi === 'entrance') { return; }
      var dx = n.x - x, dy = n.y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bd) { bd = d; best = n; }
    });
    return (best && bd <= 80) ? best.id : null;
  }

  function build(route) {
    if (!route || !route.ok) { return []; }
    var out = [];
    var i = 0;
    while (i < route.edges.length) {
      var e = route.edges[i];
      var sub = WALK_SUB[e.kind];

      if (sub) {
        var m = 0, sec = 0, j = i, segNodes = [route.nodes[i]];
        while (j < route.edges.length && WALK_SUB[route.edges[j].kind] === sub) {
          m += route.edges[j].m;
          sec += route.edges[j].sec;
          segNodes.push(route.nodes[j + 1]);
          j++;
        }
        var a = C.node(route.nodes[i]), b = C.node(route.nodes[j]);
        out.push({
          type: 'walk', sub: sub,
          m: Math.round(m), sec: Math.round(sec),
          fromId: a.id, toId: b.id,
          fromB: a.b, fromF: a.f, toB: b.b, toF: b.f,
          landmark: sub === 'indoor' ? landmarkFor(a.b, a.f, (a.x + b.x) / 2, (a.y + b.y) / 2) : null,
          nodes: segNodes
        });
        i = j;
        continue;
      }

      /* vertical: merge consecutive edges of the same kind AND same core */
      var kind = e.kind, core = e.core, sec2 = 0, k = i, vNodes = [route.nodes[i]];
      while (k < route.edges.length &&
             route.edges[k].kind === kind &&
             route.edges[k].core === core) {
        sec2 += route.edges[k].sec;
        vNodes.push(route.nodes[k + 1]);
        k++;
      }
      var a2 = C.node(route.nodes[i]), b2 = C.node(route.nodes[k]);
      var di = C.levelIndex(b2.f) - C.levelIndex(a2.f);
      out.push({
        type: kind, core: core,
        sec: Math.round(sec2),
        floors: Math.abs(di),
        dir: di > 0 ? 'up' : 'down',
        fromId: a2.id, toId: b2.id,
        fromB: a2.b, fromF: a2.f, toB: b2.b, toF: b2.f,
        nodes: vNodes
      });
      i = k;
    }
    return out;
  }

  /* Flatten a route into animation key-frames: one entry per node with the
     cumulative "distance" used by the map player. Vertical moves get a fixed
     visual weight so the marker waits at the lift instead of jumping. */
  function timeline(route, steps) {
    if (!route || !route.ok) { return []; }
    var frames = [];
    var t = 0;
    var stepStart = 0, stepIdx = 0;
    var stepEnd = steps.length ? steps[0].nodes.length - 1 : -1;

    for (var i = 0; i < route.nodes.length; i++) {
      while (stepIdx < steps.length - 1 && i > stepEnd) {
        stepStart = stepEnd;
        stepIdx++;
        stepEnd = stepStart + steps[stepIdx].nodes.length - 1;
      }
      var n = C.node(route.nodes[i]);
      var e = route.edges[i - 1];
      var weight = 0;
      if (i > 0) { weight = (e && WALK_SUB[e.kind]) ? e.m : 10; }
      t += weight;
      frames.push({
        id: n.id, x: n.x, y: n.y, f: n.f, b: n.b, t: t,
        kind: e ? e.kind : null,
        core: e ? e.core : null,
        walk: !!(e && WALK_SUB[e.kind]),
        stepIndex: stepIdx
      });
    }
    return frames;
  }


  globalThis.FUST = globalThis.FUST || {};
  globalThis.FUST.Steps = {
    build: build,
    timeline: timeline,
    landmarkFor: landmarkFor,
    WALK_SUB: WALK_SUB
  };
})();
