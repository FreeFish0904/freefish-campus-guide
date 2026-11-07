/* =====================================================================
 * Router - Dijkstra over the campus graph.
 *
 * Cost = seconds (walking metres / 1.35 m/s, lift waits, stair flights).
 * opts.stepFree  : drop stair and escalator edges (wheelchair / luggage)
 * opts.bannedCores: { L2: true } to force a different vertical core
 * ===================================================================== */
(function () {
  'use strict';

  var C = globalThis.FUST.Campus;

  var idx = {};
  C.nodes.forEach(function (n, i) { idx[n.id] = i; });

  function edgeAllowed(e, opts) {
    if (opts.stepFree && !e.accessible) { return false; }
    if (e.core && opts.bannedCores && opts.bannedCores[e.core]) { return false; }
    return true;
  }

  function dijkstra(fromId, opts) {
    opts = opts || {};
    var n = C.nodes.length;
    var dist = new Array(n), prev = new Array(n), prevEdge = new Array(n), done = new Array(n);
    for (var i = 0; i < n; i++) { dist[i] = Infinity; prev[i] = -1; prevEdge[i] = null; done[i] = false; }
    var s = idx[fromId];
    if (s === undefined) { return null; }
    dist[s] = 0;
    for (var round = 0; round < n; round++) {
      var u = -1, best = Infinity;
      for (var j = 0; j < n; j++) { if (!done[j] && dist[j] < best) { best = dist[j]; u = j; } }
      if (u === -1) { break; }
      done[u] = true;
      var links = C.adjacency[C.nodes[u].id];
      for (var k = 0; k < links.length; k++) {
        var e = links[k].edge;
        if (!edgeAllowed(e, opts)) { continue; }
        var v = idx[links[k].to];
        var nd = dist[u] + e.sec;
        if (nd < dist[v] - 1e-9) { dist[v] = nd; prev[v] = u; prevEdge[v] = e; }
      }
    }
    return { dist: dist, prev: prev, prevEdge: prevEdge };
  }

  function buildRoute(res, fromId, toId) {
    if (!res) { return null; }
    var t = idx[toId];
    if (t === undefined || res.dist[t] === Infinity) { return null; }
    var nodes = [], edges = [];
    var cur = t;
    while (cur !== -1) {
      nodes.unshift(C.nodes[cur].id);
      if (res.prevEdge[cur]) { edges.unshift(res.prevEdge[cur]); }
      cur = res.prev[cur];
    }
    var metres = 0, lifts = [], liftSeen = {};
    edges.forEach(function (e) {
      metres += e.m;
      if (e.kind === 'lift' && !liftSeen[e.core]) { liftSeen[e.core] = true; lifts.push(e.core); }
    });
    return {
      ok: true,
      from: fromId,
      to: toId,
      sec: res.dist[t],
      m: Math.round(metres),
      nodes: nodes,
      edges: edges,
      lifts: lifts
    };
  }

  function shortestPath(fromId, toId, opts) {
    return buildRoute(dijkstra(fromId, opts || {}), fromId, toId);
  }

  /* Compute the requested route plus the alternative, so the UI can say
     "the step-free way costs 1 min 20 s more" or "the stairs save 40 s". */
  function plan(fromId, toId, opts) {
    opts = opts || {};
    var wantStepFree = !!opts.stepFree;
    var primary = shortestPath(fromId, toId, { stepFree: wantStepFree });
    var other = shortestPath(fromId, toId, { stepFree: !wantStepFree });
    var fellBack = false;
    if (!primary && other) { primary = other; wantStepFree = !wantStepFree; fellBack = true; }
    var alt = null;
    if (primary && other && Math.abs(other.sec - primary.sec) > 5) { alt = other; }
    return { primary: primary, alternative: alt, stepFree: wantStepFree, fellBack: fellBack };
  }

  /* Nearest node of a given POI type, walking. */
  function nearestPoi(fromId, poiType, opts) {
    var nodes = C.poiNodes(poiType);
    if (!nodes.length) { return []; }
    var res = dijkstra(fromId, opts || {});
    if (!res) { return []; }
    var out = [];
    nodes.forEach(function (n) {
      var d = res.dist[idx[n.id]];
      if (d === Infinity) { return; }
      out.push({ node: n, sec: d, route: buildRoute(res, fromId, n.id) });
    });
    out.sort(function (a, b) { return a.sec - b.sec; });
    return out;
  }

  globalThis.FUST = globalThis.FUST || {};
  globalThis.FUST.Router = {
    shortestPath: shortestPath,
    plan: plan,
    nearestPoi: nearestPoi
  };
})();
