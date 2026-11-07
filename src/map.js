/* =====================================================================
 * Map - draws one floor of the campus as an SVG floor plan and animates
 * a walkthrough along the route (switching floors automatically).
 * ===================================================================== */
(function () {
  'use strict';

  var C = globalThis.FUST.Campus;
  var I = globalThis.FUST.I18N;
  var ICON = globalThis.FUST.Icons || {
    catOf: function () { return 'facility'; },
    CATS: [],
    defs: null
  };

  var NS = 'http://www.w3.org/2000/svg';

  /* the world the data is drawn in - zooming moves a window over it, it
     never rescales the data */
  var WORLD = { x: 0, y: 0, w: 1000, h: 660 };
  var MIN_ZOOM = 0.7;
  var MAX_ZOOM = 4.5;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* A plan is read at three distances: "which building is that", "what is
     in this building", "which door". Text that is right at one distance is
     noise at another, so the renderer draws a different label set per
     level instead of showing everything and hoping. */
  function lodFor(scale) { return scale < 0.92 ? 'far' : (scale < 1.7 ? 'mid' : 'near'); }

  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] !== null && attrs[k] !== undefined) { e.setAttribute(k, attrs[k]); }
      });
    }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function labelFor(node, lang) {
    var s = (lang === 'en' && node && node.short) ? node.short : I.shortName(node, lang);
    if (!s) { return ''; }
    var strip = s.split('(')[0].split('（')[0].trim();
    return clip(strip, lang === 'en' ? 16 : 10);
  }

  /* ---- collision-aware label placement --------------------------------
   * Every label is measured with getBBox() and scored against what is
   * already on the plan (route, lift boxes, other labels). The first
   * candidate with a clean score wins, so nothing is painted on top of
   * something else unless the space genuinely does not exist.
   * ------------------------------------------------------------------- */
  var PAD = 1.5;

  function bboxOf(node, pad) {
    var b;
    try { b = node.getBBox(); } catch (e) { return null; }
    if (!b || (!b.width && !b.height)) { return null; }
    pad = pad || 0;
    return { x: b.x - pad, y: b.y - pad, w: b.width + 2 * pad, h: b.height + 2 * pad };
  }

  function hit(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  /* if the plan is not being laid out (hidden tab, display:none) getBBox()
     comes back empty - fall back to a width estimate so the labels still
     avoid each other instead of all collapsing onto one spot */
  function estimateBox(lines, at, c, fs, lh) {
    fs = fs || 13;
    lh = lh || Math.round(fs) + 1;
    var w = 0;
    lines.forEach(function (line) {
      var lw = 0;
      for (var i = 0; i < line.length; i++) {
        var code = line.charCodeAt(i);
        lw += (code >= 0x2e80 || (code >= 0x3000 && code <= 0x9fff)) ? fs : fs * 0.55;
      }
      w = Math.max(w, lw);
    });
    var asc = fs * 0.95;
    var x = c.a === 'middle' ? at.x - w / 2 : (c.a === 'end' ? at.x - w : at.x);
    return {
      x: x - PAD, y: at.y + c.dy - asc - PAD,
      w: w + PAD * 2,
      h: (lines.length - 1) * lh + asc + fs * 0.25 + PAD * 2
    };
  }

  function create(svg, opts) {
    opts = opts || {};

    var state = {
      floor: 'G',
      lang: opts.lang || 'en',
      route: null,
      steps: [],
      marker: null,
      timer: null,
      activeStep: -1,
      view: { x: WORLD.x, y: WORLD.y, w: WORLD.w, h: WORLD.h },
      lod: 'mid',
      focus: null,
      userZoom: false
    };

    /* ---- viewport ------------------------------------------------------
       The world is 1000x660 map units; the view is the window onto it.
       Zoom keeps the point under the cursor fixed - that is the whole
       trick to a map that does not feel seasick. */
    function elementBox() {
      var r = svg.getBoundingClientRect();
      return { w: r.width || WORLD.w, h: r.height || WORLD.h };
    }

    function applyView() {
      var v = state.view;
      svg.setAttribute('viewBox', v.x.toFixed(2) + ' ' + v.y.toFixed(2) + ' ' +
        v.w.toFixed(2) + ' ' + v.h.toFixed(2));
      var lod = lodFor(WORLD.w / v.w);
      svg.setAttribute('data-zoom', lod);
      var changed = lod !== state.lod;
      state.lod = lod;
      return changed;
    }

    /* the world is 1000x660, but the campus only fills part of it: fit the
       footprints (plus a margin for the names above them) rather than the
       whole world, otherwise the buildings are drawn 25% too small */
    function contentBox() {
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      Object.keys(C.BUILDINGS).forEach(function (b) {
        var r = C.BUILDINGS[b].rect;
        x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]);
        x1 = Math.max(x1, r[0] + r[2]); y1 = Math.max(y1, r[1] + r[3]);
      });
      return { x: x0 - 26, y: y0 - 38, w: (x1 - x0) + 52, h: (y1 - y0) + 66 };
    }

    /* The buildings that exist on this floor: the camera should never leave
       them behind. On HKUST's LG1 that is just the library and the academic
       building, so the plan zooms in instead of showing empty paper. */
    function floorBox(floor) {
      var bs = C.buildingsOn(floor || state.floor);
      if (!bs.length) { return null; }
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      bs.forEach(function (b) {
        var r = C.BUILDINGS[b].rect;
        x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]);
        x1 = Math.max(x1, r[0] + r[2]); y1 = Math.max(y1, r[1] + r[3]);
      });
      return { x: x0 - 30, y: y0 - 40, w: (x1 - x0) + 60, h: (y1 - y0) + 76 };
    }

    /* fill the pane with the floor, keeping its aspect ratio so nothing is
       cropped - the leftover strip stays paper, not white */
    function fitView() {
      var box = elementBox();
      var ar = box.w / box.h;
      var c = floorBox(state.floor) || contentBox();
      var w = c.w, h = c.h;
      if (w / h < ar) { w = h * ar; } else { h = w / ar; }
      state.view = {
        x: c.x + (c.w - w) / 2,
        y: c.y + (c.h - h) / 2,
        w: w, h: h
      };
      state.userZoom = false;
      return applyView();
    }

    /* Switching floor can bring buildings in that the current view has
       cropped - follow the floor until the user takes over the camera. */
    function ensureVisible() {
      if (state.userZoom) { return false; }
      var need = floorBox(state.floor);
      if (!need) { return false; }
      var v = state.view;
      var covers = v.x <= need.x + 4 && v.y <= need.y + 4 &&
                   v.x + v.w >= need.x + need.w - 4 &&
                   v.y + v.h >= need.y + need.h - 4;
      if (covers) { return false; }
      return fitView();
    }

    function toWorld(cx, cy) {
      var m = svg.getScreenCTM();
      if (!m) { return { x: WORLD.x + WORLD.w / 2, y: WORLD.y + WORLD.h / 2 }; }
      var p = svg.createSVGPoint();
      p.x = cx; p.y = cy;
      var q = p.matrixTransform(m.inverse());
      return { x: q.x, y: q.y };
    }

    function zoomAt(pt, factor) {
      var v = state.view;
      var z = clamp((WORLD.w / v.w) * factor, MIN_ZOOM, MAX_ZOOM);
      var nw = WORLD.w / z;
      var nh = nw * (v.h / v.w);
      var kx = v.w ? (pt.x - v.x) / v.w : 0.5;
      var ky = v.h ? (pt.y - v.y) / v.h : 0.5;
      var nx = pt.x - kx * nw;
      var ny = pt.y - ky * nh;
      /* the window may reach a strip of paper around the campus, not the
         other side of the world */
      var pad = 260;
      if (nw < WORLD.w + pad * 2) {
        nx = clamp(nx, WORLD.x - pad, WORLD.x + WORLD.w + pad - nw);
      }
      if (nh < WORLD.h + pad * 2) {
        ny = clamp(ny, WORLD.y - pad, WORLD.y + WORLD.h + pad - nh);
      }
      state.view = { x: nx, y: ny, w: nw, h: nh };
      state.userZoom = true;
      if (applyView()) { render(); } else { scheduleRender(); }
    }

    function zoomBy(factor) {
      var v = state.view;
      zoomAt({ x: v.x + v.w / 2, y: v.y + v.h / 2 }, factor);
    }

    /* type and markers are sized in screen px, so they only match the new
       scale after a re-render. One render per zoom gesture is cheap; one
       per wheel tick is not, so wait for the gesture to settle. */
    var zoomTimer = null;
    function scheduleRender() {
      if (zoomTimer) { clearTimeout(zoomTimer); }
      zoomTimer = setTimeout(function () { zoomTimer = null; render(); }, 90);
    }

    /* rectangles already taken on this render: route, corridors, lift
       boxes, building names, dots and labels */
    var occ = [];

    function reserve(b) { if (b) { occ.push(b); } }

    function collisions(b) {
      var n = 0;
      for (var i = 0; i < occ.length; i++) { if (hit(b, occ[i])) { n++; } }
      return n;
    }

    function inside(b, r, m) {
      return b.x >= r.x + m && b.y >= r.y + m &&
             b.x + b.w <= r.x + r.w - m && b.y + b.h <= r.y + r.h - m;
    }

    /* One label = one <text> of one or two <tspan> lines. Every tspan needs
       its own x, otherwise the second line would continue where the first
       one ended instead of starting back at the anchor. */
    function buildText(at, lines, cfg) {
      var node = el('text', {
        x: at.x, y: at.y, class: cfg.cls, 'text-anchor': 'middle', 'data-role': cfg.role
      });
      if (cfg.node) { node.setAttribute('data-node', cfg.node); }
      if (cfg.cat) { node.setAttribute('data-cat', cfg.cat); }
      lines.forEach(function (line, k) {
        node.appendChild(el('tspan', { x: at.x, dy: k ? (cfg.lh || 13) : 0 }, line));
      });
      return node;
    }

    function moveText(node, x, y, anchor) {
      node.setAttribute('x', x);
      node.setAttribute('y', y);
      node.setAttribute('text-anchor', anchor);
      for (var t = node.firstChild; t; t = t.nextSibling) {
        if (t.setAttribute) { t.setAttribute('x', x); }
      }
    }

    /* split a name over two lines at the space nearest its middle; CJK has
       no spaces, so fall back to splitting between two characters */
    function wrapPair(txt) {
      if (txt.length < 7) { return null; }
      var mid = txt.length / 2, cut = -1;
      for (var i = 1; i < txt.length - 1; i++) {
        if (txt.charAt(i) !== ' ') { continue; }
        if (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid)) { cut = i; }
      }
      if (cut > 0) { return [txt.slice(0, cut), txt.slice(cut + 1)]; }
      var cjk = txt.charCodeAt(Math.floor(mid)) >= 0x2e80;
      if (!cjk) { return null; }
      cut = Math.floor(mid);
      return [txt.slice(0, cut), txt.slice(cut)];
    }

    /* try each candidate offset, keep the one that touches the least */
    function placeLabel(g, txt, at, cands, cfg) {
      var lines = [txt];

      function measure(node, text, list, step) {
        list = list || cands;
        step = step == null ? 0.4 : step;
        var best = null;
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          moveText(node, at.x + c.dx, at.y + c.dy, c.a);
          var b = bboxOf(node, PAD) || estimateBox(text, at, c, cfg.fs, cfg.lh);
          var hits = collisions(b);
          var fits = !cfg.bounds || inside(b, cfg.bounds, 1);
          var score = hits * 10 + i * step + (fits ? 0 : 12);
          if (!best || score < best.score) {
            best = { score: score, c: c, b: b, hits: hits, fits: fits };
          }
        }
        return best;
      }

      var node = buildText(at, lines, cfg);
      g.appendChild(node);
      var best = measure(node, lines);

      /* a name that cannot be placed on one line inside its own building
         (narrow basement floor, route hugging the dot) is wrapped instead
         of being pushed out through the wall. The two lines are half as
         wide, so they also get a finer sideways grid to slot into the gap
         between a wall and the route; the step is smaller because a lane a
         few units further out is worth taking when it keeps the text home. */
      if (cfg.wrap && best && !best.fits) {
        var pair = wrapPair(txt);
        if (pair) {
          node.remove();
          node = buildText(at, pair, cfg);
          g.appendChild(node);
          var alt = measure(node, pair, wrapCandidates(cands, state.u), 0.12);
          if (alt && alt.fits) {
            lines = pair;
            best = alt;
          } else {
            node.remove();
            node = buildText(at, lines, cfg);
            g.appendChild(node);
          }
        }
      }

      if (best) {
        var fx = at.x + best.c.dx, fy = at.y + best.c.dy;

        /* Every candidate can collide - a small building full of rooms and
           a lift leaves no clean lane. The least-bad spot is then often a
           label that grazes a dot by half a pixel, which reads as a
           strikethrough on the first character. Nudge away from it in
           small steps, and only accept the move if it clears everything
           and stays inside the building. */
        if (best.hits > 0) {
          /* straight up/down first (that is where a label lane lives), then
             sideways, then the diagonals - a 2-unit graze only needs a
             2-unit step */
          var dirs = [[0, 1], [0, -1], [-1, 0], [1, 0],
            [-1, 1], [1, 1], [-1, -1], [1, -1], [0, 2], [0, -2]];
          var moved = null;
          for (var d = 0; d < dirs.length && !moved; d++) {
            for (var st = 1; st <= 6 && !moved; st++) {
              var tx = fx + dirs[d][0] * st * state.u;
              var ty = fy + dirs[d][1] * st * state.u;
              moveText(node, tx, ty, best.c.a);
              var nb = bboxOf(node, PAD);
              if (!nb) { continue; }
              if (collisions(nb) === 0 && (!cfg.bounds || inside(nb, cfg.bounds, 1))) {
                moved = { x: tx, y: ty, b: nb };
              }
            }
          }
          if (moved) { fx = moved.x; fy = moved.y; best.b = moved.b; }
        }

        /* A room label that still lands on something after the nudge is
           not drawn at all. Small panes make `--u` big, so every label
           covers more of the map: past that point the honest answer is
           dots and the hover tooltip, not a pile of overlapping words.
           Building names and pins are never optional. */
        if (cfg.optional && (collisions(best.b) > 0 ||
            (cfg.bounds && !inside(best.b, cfg.bounds, 1)))) {
          node.remove();
          state.dropped++;
          return null;
        }

        moveText(node, fx, fy, best.c.a);
        reserve(best.b);
      }
      return node;
    }

    /* route geometry grouped per floor */
    function polylines() {
      if (!state.route) { return []; }
      var groups = [], cur = null;
      state.route.nodes.forEach(function (id) {
        var n = C.node(id);
        if (!n) { return; }
        if (!cur || cur.floor !== n.f) {
          cur = { floor: n.f, pts: [] };
          groups.push(cur);
        }
        cur.pts.push({ x: n.x, y: n.y });
      });
      return groups.filter(function (g) { return g.pts.length > 1; });
    }

    function routeFloors() { return polylines().map(function (g) { return g.floor; }); }

    /* symbols and the grid live in <defs>. They are rebuilt on every render
       because render() clears the whole <svg>; two nodes are cheaper than
       forty grid lines. */
    function drawDefs() {
      var d = ICON.defs ? ICON.defs(document) : el('defs');
      var pat = el('pattern', { id: 'grid', width: 40, height: 40, patternUnits: 'userSpaceOnUse' });
      pat.appendChild(el('path', { d: 'M40 0H0V40', class: 'grid-line' }));
      d.appendChild(pat);
      svg.appendChild(d);
    }

    function drawPaper(g) {
      g.appendChild(el('rect', { x: -1600, y: -1200, width: 4200, height: 3060, class: 'paper' }));
      g.appendChild(el('rect', {
        x: -1600, y: -1200, width: 4200, height: 3060, fill: 'url(#grid)'
      }));
    }

    /* real footprints are polygons; a building without an outline still
       falls back to its bounding rectangle, so simple data keeps working */
    function buildingPath(b) {
      var pts = C.outlineOf ? C.outlineOf(b) : null;
      if (pts && pts.length) {
        return 'M' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' L') + ' Z';
      }
      var r = C.BUILDINGS[b].rect;
      return 'M' + r[0] + ',' + r[1] + ' h' + r[2] + ' v' + r[3] + ' h' + (-r[2]) + ' Z';
    }

    function drawLinks(g, floor, activeBs) {
      C.LINKS.forEach(function (l) {
        if (l.a.f !== floor) { return; }
        var active = activeBs[l.a.b] && activeBs[l.b];
        var cls = 'link' + ((l.kind === 'skybridge' || l.kind === 'walkway') ? ' link-bridge' : '') +
                  (active ? ' link-active' : '');
        var line = el('line', { x1: l.a.x, y1: l.a.y, x2: l.b.x, y2: l.b.y, class: cls });
        line.appendChild(el('title', null,
          I.buildingName(l.a.b, state.lang) + ' — ' + I.buildingName(l.b.b, state.lang)));
        g.appendChild(line);
      });
    }

    function drawBuildings(g, floor, activeBs) {
      C.buildingsOn(floor).forEach(function (b) {
        var r = C.BUILDINGS[b].rect;
        var open = C.BUILDINGS[b].kind === 'open';
        var shape = el('path', {
          d: buildingPath(b),
          class: 'bld' + (open ? ' bld-open' : '') + (activeBs[b] ? ' bld-active' : ''),
          'data-bld': b
        });
        shape.appendChild(el('title', null,
          I.buildingName(b, state.lang) + ' · ' + I.floorName(floor, state.lang)));
        g.appendChild(shape);
      });
    }

    /* Building names are the last words on the plan. Drawn after the rooms
       and the pins they can be scored against everything already on the
       floor, so a name slides to whichever side of its footprint is free -
       important once a campus stacks ten buildings in four rows.
       A name too long for its footprint wraps onto two lines rather than
       running into the next building. */
    function splitLabel(txt) {
      var words = txt.split(' ');
      if (words.length < 2) { return [txt]; }
      var best = null;
      for (var i = 1; i < words.length; i++) {
        var a = words.slice(0, i).join(' ');
        var b = words.slice(i).join(' ');
        var worst = Math.max(a.length, b.length);
        if (!best || worst < best.worst) { best = { a: a, b: b, worst: worst }; }
      }
      return [best.a, best.b];
    }

    function drawBuildingNames(g, floor) {
      C.buildingsOn(floor).forEach(function (b) {
        var r = C.BUILDINGS[b].rect;
        var open = C.BUILDINGS[b].kind === 'open';
        var label = I.buildingName(b, state.lang);

        /* A building name belongs to the map, not to the screen: it is a
           17-map-unit word whatever the pane is, so the same floor lays out
           the same way in a 1000px pane and in a 520px one. Room labels are
           the opposite - they are sized in screen px, so they shrink in map
           units as the pane grows and are dropped when they no longer fit.

           0.9em per character is what this bold face actually measures, and
           a footprint has to hold the text plus a little air on both sides */
        var baseFs = 17;
        var room6 = (r[2] - 8);
        var lines = [label];
        if (label.length * 0.9 * baseFs > room6) { lines = splitLabel(label); }
        var longest = Math.max.apply(null, lines.map(function (l) { return l.length; }));
        var cap = room6 / (0.9 * longest);   /* the largest this name may be */

        var name = el('text', {
          x: r[0], y: r[1],
          class: 'bld-name' + (open ? ' bld-name-open' : ''),
          'text-anchor': 'middle',
          'data-role': 'bld-name', 'data-bld': b
        }, lines[0]);
        var tspans = [];
        for (var i = 1; i < lines.length; i++) {
          var t = el('tspan', { x: r[0], dy: 0 }, lines[i]);
          name.appendChild(t);
          tspans.push(t);
        }
        /* appended before it is measured: getBBox() on a detached node is
           empty, which is how every label used to score zero */
        g.appendChild(name);

        function place(p) {
          name.setAttribute('x', p.x);
          name.setAttribute('y', p.y);
          name.setAttribute('text-anchor', p.a);
          tspans.forEach(function (t) { t.setAttribute('x', p.x); });
        }

        /* Lay the name out at one font size and pick the best of the rows it
           is allowed to use. Returns null when no row even fits on the sheet. */
        function layout(fs) {
          var lineH = fs * 1.08;
          var extra = (lines.length - 1) * lineH;
          var firstY = r[1] - 9 - extra;
          /* a deep footprint reads best with its name inside, along the wall
             that has no rooms against it (the bottom strip, because every
             room label sits above its dot); a shallow one has no such strip,
             so the name goes above the walls */
          var deep = r[3] >= 120;
          var insideY = r[1] + fs + 10;
          /* a second line grows downwards from the first baseline, so the
             bottom row moves up by the extra lines - otherwise the name
             hangs off the footprint and, at the bottom of the sheet, off the
             canvas */
          var bottomY = r[1] + r[3] - 12 - extra;
          var rows = deep
            ? [bottomY, insideY, firstY, r[1] + r[3] + fs + 12]
            : [firstY, insideY, r[1] + r[3] + fs + 12];
          rows = rows.filter(function (y) {
            return y - fs >= 2 && y + extra <= WORLD.y + WORLD.h - 2;
          });

          name.style.fontSize = fs.toFixed(2) + 'px';
          tspans.forEach(function (t) { t.setAttribute('dy', lineH.toFixed(2)); });

          var multi = lines.length > 1;
          var spots = [];
          rows.forEach(function (y) {
            if (multi) {
              /* every line is left-aligned on the same x, so only the start
                 anchor makes sense */
              spots.push({ x: r[0] + 4, a: 'start', y: y });
            } else {
              spots.push({ x: r[0] + 2, a: 'start', y: y });
              spots.push({ x: r[0] + r[2] / 2, a: 'middle', y: y });
              spots.push({ x: r[0] + r[2] - 2, a: 'end', y: y });
            }
          });

          var best = null;
          spots.forEach(function (p, i) {
            place(p);
            var box = bboxOf(name, 2);
            if (!box) { return; }
            var hits = collisions(box);
            /* rows are ordered by preference: inside the footprint first */
            var score = hits * 10 + i * 0.6;
            if (!best || score < best.score) { best = { score: score, hits: hits, p: p, b: box, fs: fs }; }
          });
          return best;
        }

        /* Full size first. If the name cannot be placed without landing on
           something - a small pane makes the same floor denser - try a
           smaller one: a building must never be nameless, and shrinking to
           fit is what a printed map does. */
        var best = null;
        [1, 0.86, 0.74].forEach(function (scale) {
          if (best && best.hits === 0) { return; }
          var got = layout(Math.max(Math.min(baseFs, cap) * scale, 9));
          if (got && (!best || got.hits < best.hits)) { best = got; }
        });

        var nb = null;
        if (best) {
          layout(best.fs);   /* re-apply the size the winner was measured at */
          place(best.p);
          nb = best.b;
          reserve(nb);
        } else {
          name.style.fontSize = Math.max(Math.min(baseFs, cap), 9).toFixed(2) + 'px';
          place({ x: r[0] + r[2] / 2, a: 'middle', y: r[1] - 9 });
        }

        /* the code only goes in when it clears the name */
        var code = el('text', {
          x: r[0] + r[2] - 2, y: (best ? best.p.y : r[1] - 9), class: 'bld-code',
          'text-anchor': 'end', 'data-role': 'bld-code', 'data-bld': b
        }, b);
        g.appendChild(code);
        var cb = bboxOf(code, 2);
        /* the short code is the least important word on the plan: it only
           appears when it clears the name and everything else already
           placed on this floor */
        if (cb && (collisions(cb) > 0 || (nb && hit(nb, cb)))) { code.remove(); }
        else if (cb) { reserve(cb); }
      });
    }

    /* Two strokes: a wide soft band for the walkable width, a thin centre
       line for the direction of travel. Reads as a corridor rather than a
       highlight marker. */
    function drawCorridors(g, floor) {
      C.buildingsOn(floor).forEach(function (b) {
        var sp = C.SPINES[b];
        var pts = sp.xs.map(function (x) { return x + ',' + sp.y; }).join(' ');
        g.appendChild(el('polyline', { points: pts, class: 'corridor' }));
        g.appendChild(el('polyline', { points: pts, class: 'corridor-core' }));
        reserve({
          x: sp.xs[0] - 8, y: sp.y - 7,
          w: sp.xs[sp.xs.length - 1] - sp.xs[0] + 16, h: 14
        });
      });
    }

    /* Label rhythm, measured from the drawn text: 13px type is ~16 tall,
       so a lane starts 22 away from the dot to clear the 4.5 radius, and
       the next lane sits 20 further out. Every lane is offered centred,
       growing right and growing left, so two rooms sharing a lane can end
       up beside each other instead of on top of each other.
       Distances are screen px, so they scale with the map's own unit. */
    function laneCandidates(dir, lanes, u) {
      u = u || 1;
      var out = [];
      lanes.forEach(function (k) {
        var dy = k * dir * u;
        out.push({ a: 'middle', dx: 0, dy: dy });
        out.push({ a: 'start', dx: 12 * u, dy: dy });
        out.push({ a: 'end', dx: -12 * u, dy: dy });
      });
      out.push({ a: 'start', dx: 12 * u, dy: 3 * u });
      out.push({ a: 'end', dx: -12 * u, dy: 3 * u });
      return out;
    }

    /* a wrapped name is about half as wide, so it also gets a finer
       sideways grid - that lets it slot into the gap between a wall and
       the route running past the dot */
    function wrapCandidates(cands, u) {
      u = u || 1;
      var out = [];
      cands.forEach(function (c) {
        out.push(c);
        if (c.a !== 'middle') { return; }
        [-18, -26, 18, 26].forEach(function (dx) {
          out.push({ a: 'middle', dx: dx * u, dy: c.dy });
        });
      });
      return out;
    }

    function roomCandidates(n, sp) {
      var dir = n.y < sp.y ? -1 : 1;
      return laneCandidates(dir, [20, 40, -20, -40, 60, -60, 17, -17], state.u);
    }

    /* Rooms are drawn as bays off the corridor: a small plate running from
       the dot to the walkway, which is what a room actually looks like on
       a plan. Purely decorative - labels never land on this side. */
    function bayRect(n) {
      var sp = C.SPINES[n.b];
      if (!sp) { return null; }
      var dy = sp.y - n.y;
      if (Math.abs(dy) < 12) { return null; }
      var w = 30, h = Math.abs(dy) - 8;
      if (h < 6) { return null; }
      return {
        x: n.x - w / 2,
        y: Math.min(n.y, sp.y) + 4,
        w: w, h: h
      };
    }

    function poiMark(n) {
      var cat = ICON.catOf(n.poi);
      var u = state.u;
      var grp = el('g', { class: 'poi poi-' + cat, 'data-node': n.id, 'data-cat': cat });
      if (state.lod === 'near') {
        grp.appendChild(el('circle', { cx: n.x, cy: n.y, r: 9.5 * u, class: 'poi-disc' }));
        grp.appendChild(el('use', {
          href: '#ico-' + cat, x: n.x - 6.5 * u, y: n.y - 6.5 * u,
          width: 13 * u, height: 13 * u, class: 'poi-icon'
        }));
      } else {
        grp.appendChild(el('circle', { cx: n.x, cy: n.y, r: 4.5 * u, class: 'poi-disc' }));
      }
      grp.appendChild(el('title', null,
        I.name(n.names, state.lang) + ' · ' + I.floorName(n.f, state.lang)));
      return grp;
    }

    /* bays first: they are floor furniture, so the route runs over them */
    function drawRoomBays(g, floor) {
      if (state.lod === 'far') { return; }
      C.nodes.filter(function (n) { return n.kind === 'room' && n.f === floor; })
        .forEach(function (n) {
          var b = bayRect(n);
          if (!b) { return; }
          g.appendChild(el('rect', {
            x: b.x, y: b.y, width: b.w, height: b.h, rx: 2,
            class: 'room-bay' + (n.poi === 'restroom' ? ' room-bay-wet' : '')
          }));
        });
    }

    function drawRooms(g, floor) {
      var rooms = C.nodes.filter(function (n) { return n.kind === 'room' && n.f === floor; });
      var lod = state.lod;

      /* markers first, so no label can ever be hidden under one */
      rooms.forEach(function (n) {
        g.appendChild(poiMark(n));
        var rr = (lod === 'near' ? 11 : 6) * state.u;
        reserve({ x: n.x - rr, y: n.y - rr, w: rr * 2, h: rr * 2 });
      });

      /* zoomed out, a wall of 12px labels is noise: the building names and
         the coloured dots carry the plan, and the labels come back as soon
         as the user zooms to reading distance */
      if (lod === 'far') { return; }

      rooms.forEach(function (n) {
        var txt = labelFor(n, state.lang);
        if (!txt) { return; }
        /* the pin already sits on this room and says "you are here" /
           "destination"; its own label would only fight with the pin text */
        if (state.route && (n.id === state.route.from || n.id === state.route.to)) { return; }
        var r = C.BUILDINGS[n.b].rect;
        placeLabel(g, txt, n, roomCandidates(n, C.SPINES[n.b]), {
          cls: 'room-label', role: 'room-label', node: n.id, optional: true,
          fs: 12 * state.u, lh: 13 * state.u, wrap: true,
          cat: ICON.catOf(n.poi),
          bounds: { x: r[0], y: r[1], w: r[2], h: r[3] }
        });
      });
    }

    function drawCores(g, floor) {
      var u = state.u;
      C.nodes.filter(function (n) { return n.kind === 'core' && n.f === floor; }).forEach(function (n) {
        var isLift = n.coreKind === 'lift';
        /* a lift reads as a car you step into, so it gets a wide capsule
           that can hold two digits; stairs stay a compact square */
        var w = (isLift ? 28 : 20) * u, h = 18 * u;
        var grp = el('g', { class: 'core core-' + n.coreKind, 'data-node': n.id });
        grp.appendChild(el('rect', {
          x: n.x - w / 2, y: n.y - h / 2, width: w, height: h,
          rx: (isLift ? 9 : 5) * u, class: 'core-box'
        }));
        if (isLift) {
          grp.appendChild(el('text', {
            x: n.x, y: n.y + 4.2 * u, class: 'core-num', 'text-anchor': 'middle'
          }, n.coreLabel));
        } else if (n.coreKind === 'stairs') {
          grp.appendChild(el('path', {
            d: 'M' + (n.x - 6 * u) + ',' + (n.y + 6 * u) +
               ' h' + (4 * u) + ' v' + (-4 * u) + ' h' + (4 * u) + ' v' + (-4 * u) +
               ' h' + (4 * u) + ' v' + (-4 * u),
            class: 'core-glyph'
          }));
        } else {
          grp.appendChild(el('path', {
            d: 'M' + (n.x - 5 * u) + ',' + (n.y + 6 * u) +
               ' L' + (n.x + 5 * u) + ',' + (n.y - 6 * u),
            class: 'core-glyph'
          }));
        }
        grp.appendChild(el('title', null,
          I.name(n.coreNames, state.lang) + ' · ' + I.floorName(floor, state.lang)));
        g.appendChild(grp);
        reserve({ x: n.x - 15 * u, y: n.y - 12 * u, w: 30 * u, h: 24 * u });
      });
    }

    /* the route of the floor being drawn is reserved before any label is
       placed, so text never lands on the orange line. Segments of other
       floors are skipped on purpose: every floor shares the same coordinate
       grid, so they would push labels out of empty space here */
    function reserveRoute() {
      polylines().forEach(function (pl) {
        if (pl.floor !== state.floor) { return; }
        for (var i = 1; i < pl.pts.length; i++) {
          var a = pl.pts[i - 1], b = pl.pts[i];
          reserve({
            x: Math.min(a.x, b.x) - 8, y: Math.min(a.y, b.y) - 8,
            w: Math.abs(a.x - b.x) + 16, h: Math.abs(a.y - b.y) + 16
          });
        }
      });
    }

    /* route segments that belong to other floors. They are NOT part of the
       label collision set (same coordinate grid, different floor), but
       drawing them faintly stops the route from looking like it just
       stops in mid air when it changes level. */
    function drawGhostRoute(g, floor) {
      /* only worth drawing where the route actually is: a faint line on an
         unrelated floor reads as a route that is not there */
      if (routeFloors().indexOf(floor) < 0) { return; }
      polylines().forEach(function (pl) {
        if (pl.floor === floor) { return; }
        var pts = pl.pts.map(function (p) { return p.x + ',' + p.y; }).join(' ');
        g.appendChild(el('polyline', { points: pts, class: 'route-ghost' }));
      });
    }

    /* evenly spaced white chevrons along the whole polyline. Walking the
       polyline by cumulative distance (instead of per segment) matters:
       the router emits a node every 20-40 units, so a per-segment rule
       puts one arrow on a 250-unit corridor and none anywhere else. */
    function drawFlow(g, pts) {
      var u = state.u;
      var segs = [], total = 0, i;
      for (i = 1; i < pts.length; i++) {
        var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.5) { continue; }
        segs.push({ a: pts[i - 1], ux: dx / len, uy: dy / len, len: len, at: total });
        total += len;
      }
      if (!segs.length) { return; }

      var step = 76 * u, s = 6 * u;
      var count = Math.min(20, Math.max(1, Math.round(total / step)));
      if (count * step > total) { step = total / count; }
      for (var k = 1; k <= count; k++) {
        var d = (k - 0.5) * step;
        var j = 0;
        while (j < segs.length - 1 && segs[j].at + segs[j].len < d) { j++; }
        var sg = segs[j];
        var t = Math.min(d - sg.at, sg.len);
        var px = sg.a.x + sg.ux * t, py = sg.a.y + sg.uy * t;
        g.appendChild(el('path', {
          d: 'M' + (px + sg.ux * s) + ',' + (py + sg.uy * s) +
             ' L' + (px - sg.ux * s - sg.uy * s * 0.8) + ',' + (py - sg.uy * s + sg.ux * s * 0.8) +
             ' L' + (px - sg.ux * s + sg.uy * s * 0.8) + ',' + (py - sg.uy * s - sg.ux * s * 0.8) + ' Z',
          class: 'route-arrow'
        }));
      }
    }

    function drawRoute(g, floor) {
      polylines().forEach(function (pl) {
        if (pl.floor !== floor) { return; }
        var pts = pl.pts.map(function (p) { return p.x + ',' + p.y; }).join(' ');
        g.appendChild(el('polyline', { points: pts, class: 'route-halo' }));
        g.appendChild(el('polyline', { points: pts, class: 'route' }));
        drawFlow(g, pl.pts);
      });
    }

    function drawPins(g, floor) {
      if (!state.route) { return; }
      var u = state.u;
      var from = C.node(state.route.from), to = C.node(state.route.to);
      /* pins sit on top of the dots, so their labels get their own lanes -
         20 apart keeps the bold 13px text clear of the lane beside it.
         The view itself is the bound: a pin on the edge of the pane must
         not push its label out of the picture. */
      var cands = laneCandidates(1, [-22, 22, -42, 42], state.u);
      var vb = {
        x: state.view.x + 3, y: state.view.y + 3,
        w: state.view.w - 6, h: state.view.h - 6
      };
      if (from && from.f === floor) {
        g.appendChild(el('circle', { cx: from.x, cy: from.y, r: 9 * u, class: 'pin pin-start' }));
        reserve({ x: from.x - 11 * u, y: from.y - 11 * u, w: 22 * u, h: 22 * u });
        placeLabel(g, I.t('map.you', state.lang), from, cands,
          { cls: 'pin-label pin-label-start', role: 'pin-label', node: state.route.from,
            fs: 13 * u, lh: 13 * u, bounds: vb });
      }
      if (to && to.f === floor) {
        g.appendChild(el('circle', { cx: to.x, cy: to.y, r: 9 * u, class: 'pin pin-end' }));
        reserve({ x: to.x - 11 * u, y: to.y - 11 * u, w: 22 * u, h: 22 * u });
        placeLabel(g, I.t('map.goal', state.lang), to, cands,
          { cls: 'pin-label pin-label-end', role: 'pin-label', node: state.route.to,
            fs: 13 * u, lh: 13 * u, bounds: vb });
      }
    }

    function drawMarker(g) {
      state.markerEls = null;
      if (!state.marker || state.marker.f !== state.floor) { return; }
      var u = state.u;
      var halo = el('circle', { cx: state.marker.x, cy: state.marker.y, r: 12 * u, class: 'marker-halo' });
      var dot = el('circle', { cx: state.marker.x, cy: state.marker.y, r: 6 * u, class: 'marker' });
      g.appendChild(halo);
      g.appendChild(dot);
      state.markerEls = { halo: halo, dot: dot };
    }

    function render() {
      ensureVisible();
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      occ = [];
      state.dropped = 0;
      /* layer order is the picture: paper, then what is under the walker,
         then the walls, then the route, then the words */
      drawDefs();
      applyView();
      /* how many map units one CSS pixel is worth: markers and type are
         sized in screen px, so they keep their size while the geometry
         zooms - the difference between "a drawing that scales" and a map */
      var pane = svg.getBoundingClientRect();
      state.u = clamp(state.view.w / (pane.width || 1000), 0.28, 3);
      svg.style.setProperty('--u', state.u.toFixed(4));
      /* the group has to be in the document before anything is drawn:
         getBBox() only measures nodes that are being laid out */
      var g = el('g');
      svg.appendChild(g);

      var activeBs = {};
      if (state.route) {
        state.route.nodes.forEach(function (id) {
          var n = C.node(id);
          if (n && n.f === state.floor) { activeBs[n.b] = true; }
        });
      }

      reserveRoute();
      drawPaper(g);
      drawLinks(g, state.floor, activeBs);
      drawBuildings(g, state.floor, activeBs);
      drawCorridors(g, state.floor);
      drawRoomBays(g, state.floor);
      drawGhostRoute(g, state.floor);
      drawRoute(g, state.floor);
      drawCores(g, state.floor);
      drawRooms(g, state.floor);
      drawPins(g, state.floor);
      drawMarker(g);
      drawBuildingNames(g, state.floor);
      applyFocus();

      if (opts.onRender) { opts.onRender(routeFloors(), state.floor); }
    }

    /* category focus: the legend fades everything the user is not looking
       for. CSS does the fading, so labels keep their positions and the
       plan does not jump around while filtering. */
    function applyFocus() {
      var cat = state.focus;
      if (cat) { svg.setAttribute('data-focus', cat); }
      else { svg.removeAttribute('data-focus'); }
      var marks = svg.querySelectorAll('.poi, .room-label');
      for (var i = 0; i < marks.length; i++) {
        var m = marks[i];
        var on = !cat || m.getAttribute('data-cat') === cat;
        if (on) { m.classList.remove('is-dim'); }
        else { m.classList.add('is-dim'); }
      }
    }

    function buildLegend() {
      var box = document.getElementById('mapLegend');
      if (!box || !ICON.CATS.length) { return; }
      box.innerHTML = '';
      ICON.CATS.forEach(function (cat) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'lg lg-' + cat + (state.focus === cat ? ' on' : '');
        b.innerHTML = '<i></i><span></span>';
        b.querySelector('span').textContent = I.t('cat.' + cat, state.lang);
        b.title = I.t('map.filterHint', state.lang);
        b.onclick = function () {
          state.focus = state.focus === cat ? null : cat;
          buildLegend();
          applyFocus();
        };
        box.appendChild(b);
      });
    }

    /* hover a dot, get a name; hover the map, get nothing in the way */
    function wireTip() {
      var tip = document.getElementById('mapTip');
      if (!tip) { return; }
      var host = tip.parentNode;
      svg.addEventListener('pointerover', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('[data-node]') : null;
        if (!t) { return; }
        var n = C.node(t.getAttribute('data-node'));
        if (!n || !n.names) { return; }
        tip.textContent = I.name(n.names, state.lang) + ' · ' + I.floorName(n.f, state.lang);
        tip.hidden = false;
      });
      svg.addEventListener('pointerout', function () { tip.hidden = true; });
      svg.addEventListener('pointermove', function (e) {
        if (tip.hidden) { return; }
        var r = host.getBoundingClientRect();
        tip.style.left = (e.clientX - r.left + 14) + 'px';
        tip.style.top = (e.clientY - r.top + 16) + 'px';
      });
    }

    /* ---- viewport wiring --------------------------------------------- */
    function wireView() {
      var drag = null;

      svg.addEventListener('wheel', function (e) {
        e.preventDefault();
        var step = e.deltaMode === 1 ? 0.06 : 0.0017;
        zoomAt(toWorld(e.clientX, e.clientY), Math.exp(-e.deltaY * step));
      }, { passive: false });

      svg.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) { return; }
        var m = svg.getScreenCTM();
        drag = { x: e.clientX, y: e.clientY, sx: m ? m.a : 1, sy: m ? m.d : 1, moved: false };
        if (svg.setPointerCapture) { svg.setPointerCapture(e.pointerId); }
        svg.classList.add('is-dragging');
      });

      svg.addEventListener('pointermove', function (e) {
        if (!drag) { return; }
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) { return; }
        drag.moved = true;
        var v = state.view;
        state.view = { x: v.x - dx / drag.sx, y: v.y - dy / drag.sy, w: v.w, h: v.h };
        drag.x = e.clientX; drag.y = e.clientY;
        state.userZoom = true;
        applyView();
        scheduleRender();
      });

      function endDrag(e) {
        if (!drag) { return; }
        drag = null;
        svg.classList.remove('is-dragging');
        if (svg.releasePointerCapture && e.pointerId !== undefined) {
          try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* gone */ }
        }
      }
      svg.addEventListener('pointerup', endDrag);
      svg.addEventListener('pointercancel', endDrag);

      svg.addEventListener('dblclick', function (e) {
        zoomAt(toWorld(e.clientX, e.clientY), 1.7);
      });

      var zi = document.getElementById('zoomIn');
      var zo = document.getElementById('zoomOut');
      var zf = document.getElementById('zoomFit');
      if (zi) { zi.onclick = function () { zoomBy(1.35); }; }
      if (zo) { zo.onclick = function () { zoomBy(1 / 1.35); }; }
      if (zf) {
        zf.onclick = function () { fitView(); render(); };
      }
      [zi, zo, zf].forEach(function (b, i) {
        if (!b) { return; }
        b.title = I.t(i === 0 ? 'map.zoomIn' : (i === 1 ? 'map.zoomOut' : 'map.fit'), state.lang);
        b.setAttribute('aria-label', b.title);
      });

      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('resize', function () {
          if (state.userZoom) { return; }
          if (fitView()) { render(); }
        });
      }
    }

    /* ---- walkthrough player ------------------------------------------ */
    function positionAt(frames, target) {
      var i;
      for (i = 1; i < frames.length; i++) {
        if (target <= frames[i].t) { break; }
      }
      if (i >= frames.length) { i = frames.length - 1; }
      var b = frames[i], a = frames[i - 1] || b;
      if (a.f === b.f && b.t > a.t) {
        var r = (target - a.t) / (b.t - a.t);
        return {
          x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r,
          f: b.f, walk: b.walk, kind: b.kind, core: b.core, stepIndex: b.stepIndex
        };
      }
      return { x: b.x, y: b.y, f: b.f, walk: b.walk, kind: b.kind, core: b.core, stepIndex: b.stepIndex };
    }

    function statusFor(pos) {
      if (pos.walk) { return I.t('map.walking', state.lang); }
      if (pos.kind === 'lift' && pos.core) {
        return I.t('map.rideLift', state.lang, { lift: I.name(C.coreById[pos.core], state.lang) });
      }
      if (pos.kind === 'stairs') { return I.t('map.onStairs', state.lang); }
      if (pos.kind === 'escalator') { return I.t('map.onEsc', state.lang); }
      return '';
    }

    function pause() {
      state.playing = false;
      if (state.timer) { cancelAnimationFrame(state.timer); state.timer = null; }
      if (opts.onPlaying) { opts.onPlaying(false); }
    }

    function stop() {
      pause();
      state.marker = null;
      state.markerEls = null;
      if (opts.onStatus) { opts.onStatus(''); }
    }

    function play() {
      if (!state.route) { return; }
      if (state.playing) { pause(); return; }
      var frames = globalThis.FUST.Steps.timeline(state.route, state.steps);
      if (frames.length < 2) { return; }

      state.playing = true;
      if (opts.onPlaying) { opts.onPlaying(true); }

      var total = frames[frames.length - 1].t || 1;
      var duration = Math.max(5000, Math.min(26000, total * 95));
      var start = null;

      function tick(ts) {
        if (!state.playing) { return; }
        if (start === null) { start = ts; }
        var p = Math.min(1, (ts - start) / duration);
        var pos = positionAt(frames, p * total);

        if (pos.f !== state.floor || !state.markerEls) {
          state.marker = { x: pos.x, y: pos.y, f: pos.f };
          state.floor = pos.f;
          render();
        } else {
          state.marker = { x: pos.x, y: pos.y, f: pos.f };
          state.markerEls.halo.setAttribute('cx', pos.x);
          state.markerEls.halo.setAttribute('cy', pos.y);
          state.markerEls.dot.setAttribute('cx', pos.x);
          state.markerEls.dot.setAttribute('cy', pos.y);
        }

        if (opts.onStatus) { opts.onStatus(statusFor(pos)); }
        if (opts.onStep) { opts.onStep(pos.stepIndex, true); }

        if (p < 1) {
          state.timer = requestAnimationFrame(tick);
        } else {
          pause();
          if (opts.onStatus) { opts.onStatus(''); }
          if (opts.onStep) { opts.onStep(-1, true); }
        }
      }
      state.timer = requestAnimationFrame(tick);
    }

    buildLegend();
    wireView();
    wireTip();
    fitView();
    render();

    return {
      render: render,
      setFloor: function (f) { state.floor = f; render(); },
      getFloor: function () { return state.floor; },
      setLang: function (l) { state.lang = l; buildLegend(); render(); },
      setRoute: function (route, steps) {
        stop();
        state.route = route || null;
        state.steps = steps || [];
        state.activeStep = -1;
        if (route) {
          var fl = routeFloors();
          if (fl.length) { state.floor = fl[0]; }
        }
        render();
      },
      showStep: function (i) {
        state.activeStep = i;
        var st = state.steps[i];
        if (!st) { return; }
        var node = C.node(st.toId);
        if (node) { state.floor = node.f; }
        render();
      },
      play: play,
      pause: pause,
      isPlaying: function () { return !!state.playing; },
      floors: routeFloors,
      zoomIn: function () { zoomBy(1.35); },
      zoomOut: function () { zoomBy(1 / 1.35); },
      fit: function () { fitView(); render(); },
      zoom: function () { return WORLD.w / state.view.w; },
      lod: function () { return state.lod; },
      /* labels the renderer had to drop because they could not be placed
         without landing on something else (used by the layout check) */
      stats: function () { return { dropped: state.dropped || 0, u: state.u }; },
      focus: function (cat) {
        state.focus = cat || null;
        buildLegend();
        applyFocus();
      }
    };
  }

  globalThis.FUST = globalThis.FUST || {};
  globalThis.FUST.MapView = { create: create };
})();
