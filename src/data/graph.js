/* =====================================================================
 * Campus graph builder.
 * ---------------------------------------------------------------------
 * A campus is *data*: a spec object with levels, building footprints,
 * one horizontal spine per building, vertical cores (lifts, stairs,
 * escalators), rooms and links between buildings. This file turns a spec
 * into the walking graph the router and the plan use.
 *
 * Two specs ship with the app:
 *   src/data/campus.js      the AISC1000A demo campus (fictional)
 *   src/data/campus.ust.js  HKUST, Clear Water Bay (real place names)
 * Both are built by the same code, so a data bug shows up in one test
 * run and the renderer never has to care which campus it is drawing.
 *
 * Geometry convention: a spec owns its own map units (demo: 0.32 m per
 * unit). Buildings keep one footprint on every floor, so "the plan of
 * floor f" is just "the footprints of the buildings that exist on f".
 * ===================================================================== */
(function () {
  'use strict';

  function buildCampus(spec) {
    var LEVELS = spec.LEVELS;
    var BUILDINGS = spec.BUILDINGS;
    var OUTLINES = spec.OUTLINES || {};
    var FLOORS = spec.FLOORS;
    var SPINES = spec.SPINES;
    var CORES = spec.CORES;
    var ROOMS = spec.ROOMS;
    var LINKS = spec.LINKS || [];
    var M_PER_UNIT = spec.M_PER_UNIT;
    var WALK_SPEED = spec.WALK_SPEED;
    var STAIR_SEC_PER_FLOOR = spec.STAIR_SEC_PER_FLOOR;

    /* ---- build the graph ---------------------------------------------- */
    var nodes = [], edges = [], nodeById = {}, byCoord = {};

    function ckey(b, f, x, y) { return b + '|' + f + '|' + x + '|' + y; }

    function addNode(b, f, x, y, props) {
      var k = ckey(b, f, x, y);
      if (byCoord[k]) {
        var ex = byCoord[k];
        if (props) { for (var p in props) { if (props.hasOwnProperty(p) && ex[p] === undefined) { ex[p] = props[p]; } } }
        return ex;
      }
      var n = { id: (props && props.id) || (b + '-' + f + '-' + x + '-' + y),
                b: b, f: f, x: x, y: y, kind: 'junction', poi: null,
                names: null, aliases: [], core: null, coreKind: null, coreLabel: null, coreNames: null };
      if (props) { for (var q in props) { if (props.hasOwnProperty(q)) { n[q] = props[q]; } } }
      nodes.push(n); byCoord[k] = n; nodeById[n.id] = n;
      return n;
    }

    function euclid(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

    function addEdge(a, b, kind, opts) {
      opts = opts || {};
      var metres = euclid(a, b) * M_PER_UNIT;
      var sec = (opts.sec !== undefined) ? opts.sec : metres / WALK_SPEED;
      var e = {
        id: a.id + '>' + b.id,
        a: a.id, b: b.id, kind: kind,
        m: Math.round(metres * 10) / 10,
        sec: Math.round(sec),
        accessible: opts.accessible !== false,
        core: opts.core || null
      };
      edges.push(e);
      return e;
    }

    function spineNode(b, f, x) { return byCoord[ckey(b, f, x, SPINES[b].y)]; }

    function nearestSpine(b, f, node) {
      var sp = SPINES[b], best = null, bd = Infinity;
      sp.xs.forEach(function (x) {
        var s = spineNode(b, f, x);
        if (!s) { return; }
        var d = euclid(node, s);
        if (d < bd) { bd = d; best = s; }
      });
      return best;
    }

    function endpoint(p) {
      var n = byCoord[ckey(p.b, p.f, p.x, p.y)];
      if (n) { return n; }
      n = addNode(p.b, p.f, p.x, p.y, { kind: 'junction' });
      var s = nearestSpine(p.b, p.f, n);
      if (s) { addEdge(n, s, 'junction'); }
      return n;
    }

    /* 1. horizontal spines - one per building per floor */
    Object.keys(FLOORS).forEach(function (b) {
      var sp = SPINES[b];
      if (!sp) { return; }
      FLOORS[b].forEach(function (f) {
        var prev = null;
        sp.xs.forEach(function (x) {
          var n = addNode(b, f, x, sp.y, { kind: 'spine' });
          if (prev && prev !== n) { addEdge(prev, n, 'corridor'); }
          prev = n;
        });
      });
    });

    /* 2. rooms hang off the nearest spine node */
    ROOMS.forEach(function (r) {
      var n = addNode(r.b, r.f, r.x, r.y, {
        id: r.id, kind: 'room', poi: r.poi, names: r.names, aliases: r.aliases, short: r.short,
        verified: r.verified === undefined ? true : r.verified
      });
      var s = nearestSpine(r.b, r.f, n);
      if (s) { addEdge(n, s, 'room'); }
    });

    /* 3. vertical cores (lifts / stairs / escalator)
          Lifts connect every pair of served floors directly, so the waiting
          time is counted once per ride instead of once per floor. */
    CORES.forEach(function (c) {
      var floorNodes = c.floors.map(function (f) {
        var n = addNode(c.b, f, c.x, c.y, { kind: 'core' });
        n.kind = 'core';
        n.core = c.id;
        n.coreKind = c.kind;
        n.coreLabel = (c.label === undefined) ? null : c.label;
        n.coreNames = c.names;
        if (c.verified === false) { n.verified = false; }
        return n;
      });

      var i, j;
      if (c.kind === 'lift') {
        for (i = 0; i < floorNodes.length; i++) {
          for (j = i + 1; j < floorNodes.length; j++) {
            var df = Math.abs(LEVELS.indexOf(c.floors[j]) - LEVELS.indexOf(c.floors[i]));
            addEdge(floorNodes[i], floorNodes[j], 'lift', { sec: c.wait + c.perFloor * df, core: c.id });
          }
        }
      } else {
        for (i = 1; i < floorNodes.length; i++) {
          var df2 = Math.abs(LEVELS.indexOf(c.floors[i]) - LEVELS.indexOf(c.floors[i - 1]));
          if (c.kind === 'stairs') {
            addEdge(floorNodes[i - 1], floorNodes[i], 'stairs', { sec: STAIR_SEC_PER_FLOOR * df2, accessible: false, core: c.id });
          } else if (c.kind === 'escalator') {
            addEdge(floorNodes[i - 1], floorNodes[i], 'escalator', { sec: (c.sec || 22) * df2, accessible: false, core: c.id });
          }
        }
      }
    });

    /* 4. building-to-building links. A link may carry an explicit `sec`
          when the drawing compresses a long or uphill path - the halls are
          a ten minute climb, not the twenty metres they are drawn apart. */
    LINKS.forEach(function (l) {
      var A = endpoint(l.a), B = endpoint(l.b);
      if (A && B && A !== B) { addEdge(A, B, l.kind, { sec: l.sec }); }
    });

    /* ---- adjacency + helpers ------------------------------------------ */
    var adjacency = {};
    nodes.forEach(function (n) { adjacency[n.id] = []; });
    edges.forEach(function (e) {
      adjacency[e.a].push({ to: e.b, edge: e });
      adjacency[e.b].push({ to: e.a, edge: e });
    });

    var coreById = {};
    CORES.forEach(function (c) { coreById[c.id] = c; });

    return {
      id: spec.id || 'campus',
      meta: spec.meta || {},
      QUIRKS: spec.QUIRKS || [],
      M_PER_UNIT: M_PER_UNIT,
      WALK_SPEED: WALK_SPEED,
      LEVELS: LEVELS,
      BUILDINGS: BUILDINGS,
      OUTLINES: OUTLINES,
      outlineOf: function (b) { return OUTLINES[b] || null; },
      FLOORS: FLOORS,
      SPINES: SPINES,
      CORES: CORES,
      ROOMS: ROOMS,
      LINKS: LINKS,
      nodes: nodes,
      edges: edges,
      adjacency: adjacency,
      nodeById: nodeById,
      coreById: coreById,
      levelIndex: function (f) { return LEVELS.indexOf(f); },
      node: function (id) { return nodeById[id] || null; },
      buildingsOn: function (f) {
        return Object.keys(FLOORS).filter(function (b) { return FLOORS[b].indexOf(f) >= 0; });
      },
      roomsOn: function (b, f) {
        return nodes.filter(function (n) { return n.kind === 'room' && n.b === b && n.f === f; });
      },
      nodesOn: function (f) {
        return nodes.filter(function (n) { return n.f === f; });
      },
      poiNodes: function (poi) {
        return nodes.filter(function (n) { return n.poi === poi; });
      }
    };
  }

  globalThis.FUST = globalThis.FUST || {};
  globalThis.FUST.buildCampus = buildCampus;
})();
