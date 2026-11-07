/* =====================================================================
 * Map - draws one floor of the campus as an SVG floor plan and animates
 * a walkthrough along the route (switching floors automatically).
 * ===================================================================== */
(function () {
  'use strict';

  var C = globalThis.FUST.Campus;
  var I = globalThis.FUST.I18N;

  var NS = 'http://www.w3.org/2000/svg';

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
      activeStep: -1
    };

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
          var alt = measure(node, pair, wrapCandidates(cands), 0.12);
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
        moveText(node, at.x + best.c.dx, at.y + best.c.dy, best.c.a);
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

    function drawBackground(g) {
      g.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 660, fill: '#f4f6f9' }));
      for (var x = 40; x < 1000; x += 40) {
        g.appendChild(el('line', { x1: x, y1: 0, x2: x, y2: 660, class: 'grid' }));
      }
      for (var y = 40; y < 660; y += 40) {
        g.appendChild(el('line', { x1: 0, y1: y, x2: 1000, y2: y, class: 'grid' }));
      }
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
        g.appendChild(el('rect', {
          x: r[0], y: r[1], width: r[2], height: r[3], rx: 12,
          class: 'bld' + (activeBs[b] ? ' bld-active' : '')
        }));
        /* Name sits above the footprint, so it never collides with the
           rooms drawn just inside the walls. A route that comes down
           through that strip would draw straight over the text, so the
           name slides left / centre / right to wherever it stays clear. */
        var spots = [
          { x: r[0] + 2, a: 'start' },
          { x: r[0] + r[2] / 2, a: 'middle' },
          { x: r[0] + r[2] - 2, a: 'end' }
        ];
        var name = el('text', {
          x: spots[0].x, y: r[1] - 9, class: 'bld-name', 'text-anchor': spots[0].a,
          'data-role': 'bld-name', 'data-bld': b
        }, I.buildingName(b, state.lang));
        g.appendChild(name);

        var bestName = null;
        spots.forEach(function (p, i) {
          name.setAttribute('x', p.x);
          name.setAttribute('text-anchor', p.a);
          var box = bboxOf(name, 2);
          if (!box) { return; }
          var score = collisions(box) * 10 + i * 0.5;
          if (!bestName || score < bestName.score) {
            bestName = { score: score, p: p, b: box };
          }
        });
        var nb = null;
        if (bestName) {
          name.setAttribute('x', bestName.p.x);
          name.setAttribute('text-anchor', bestName.p.a);
          nb = bestName.b;
          reserve(nb);
        }

        /* the code only goes in when the name leaves room for it */
        var code = el('text', {
          x: r[0] + r[2] - 2, y: r[1] - 9, class: 'bld-code',
          'text-anchor': 'end', 'data-role': 'bld-code', 'data-bld': b
        }, b);
        g.appendChild(code);
        var cb = bboxOf(code, 2);
        if (cb && nb && hit(nb, cb)) { code.remove(); }
        else { reserve(cb); }
      });
    }

    function drawCorridors(g, floor) {
      C.buildingsOn(floor).forEach(function (b) {
        var sp = C.SPINES[b];
        var pts = sp.xs.map(function (x) { return x + ',' + sp.y; }).join(' ');
        g.appendChild(el('polyline', { points: pts, class: 'corridor' }));
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
       up beside each other instead of on top of each other. */
    function laneCandidates(dir, lanes) {
      var out = [];
      lanes.forEach(function (k) {
        var dy = k * dir;
        out.push({ a: 'middle', dx: 0, dy: dy });
        out.push({ a: 'start', dx: 12, dy: dy });
        out.push({ a: 'end', dx: -12, dy: dy });
      });
      out.push({ a: 'start', dx: 12, dy: 3 });
      out.push({ a: 'end', dx: -12, dy: 3 });
      return out;
    }

    /* a wrapped name is about half as wide, so it also gets a finer
       sideways grid - that lets it slot into the gap between a wall and
       the route running past the dot */
    function wrapCandidates(cands) {
      var out = [];
      cands.forEach(function (c) {
        out.push(c);
        if (c.a !== 'middle') { return; }
        [-18, -26, 18, 26].forEach(function (dx) {
          out.push({ a: 'middle', dx: dx, dy: c.dy });
        });
      });
      return out;
    }

    function roomCandidates(n, sp) {
      var dir = n.y < sp.y ? -1 : 1;
      return laneCandidates(dir, [20, 40, -20, -40, 60, -60, 17, -17]);
    }

    function drawRooms(g, floor) {
      var rooms = C.nodes.filter(function (n) { return n.kind === 'room' && n.f === floor; });

      /* dots first, so no label can ever be hidden under one */
      rooms.forEach(function (n) {
        var dot = el('circle', { cx: n.x, cy: n.y, r: 4.5, class: 'room', 'data-node': n.id });
        dot.appendChild(el('title', null, I.name(n.names, state.lang)));
        g.appendChild(dot);
        reserve({ x: n.x - 6, y: n.y - 6, w: 12, h: 12 });
      });

      rooms.forEach(function (n) {
        var txt = labelFor(n, state.lang);
        if (!txt) { return; }
        var r = C.BUILDINGS[n.b].rect;
        placeLabel(g, txt, n, roomCandidates(n, C.SPINES[n.b]), {
          cls: 'room-label', role: 'room-label', node: n.id, fs: 12, lh: 13, wrap: true,
          bounds: { x: r[0], y: r[1], w: r[2], h: r[3] }
        });
      });
    }

    function drawCores(g, floor) {
      C.nodes.filter(function (n) { return n.kind === 'core' && n.f === floor; }).forEach(function (n) {
        var grp = el('g', { class: 'core core-' + n.coreKind, 'data-node': n.id });
        grp.appendChild(el('rect', {
          x: n.x - 10, y: n.y - 10, width: 20, height: 20, rx: 5, class: 'core-box'
        }));
        if (n.coreKind === 'lift') {
          grp.appendChild(el('text', {
            x: n.x, y: n.y + 4.5, class: 'core-num', 'text-anchor': 'middle'
          }, n.coreLabel));
        } else if (n.coreKind === 'stairs') {
          grp.appendChild(el('path', {
            d: 'M' + (n.x - 6) + ',' + (n.y + 6) + ' h4 v-4 h4 v-4 h4 v-4',
            class: 'core-glyph'
          }));
        } else {
          grp.appendChild(el('path', {
            d: 'M' + (n.x - 5) + ',' + (n.y + 6) + ' L' + (n.x + 5) + ',' + (n.y - 6),
            class: 'core-glyph'
          }));
        }
        grp.appendChild(el('title', null,
          I.name(n.coreNames, state.lang) + ' · ' + I.floorName(floor, state.lang)));
        g.appendChild(grp);
        reserve({ x: n.x - 12, y: n.y - 12, w: 24, h: 24 });
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

    function drawRoute(g, floor) {
      polylines().forEach(function (pl) {
        if (pl.floor !== floor) { return; }
        var pts = pl.pts.map(function (p) { return p.x + ',' + p.y; }).join(' ');
        g.appendChild(el('polyline', { points: pts, class: 'route-halo' }));
        g.appendChild(el('polyline', { points: pts, class: 'route' }));
      });

      if (!state.route) { return; }
      var from = C.node(state.route.from), to = C.node(state.route.to);
      /* pins sit on top of the dots, so their labels get their own lanes -
         20 apart keeps the bold 13px text clear of the lane beside it */
      var cands = laneCandidates(1, [-22, 22, -42, 42, -62, 62]);
      if (from && from.f === floor) {
        g.appendChild(el('circle', { cx: from.x, cy: from.y, r: 9, class: 'pin pin-start' }));
        reserve({ x: from.x - 11, y: from.y - 11, w: 22, h: 22 });
        placeLabel(g, I.t('map.you', state.lang), from, cands,
          { cls: 'pin-label pin-label-start', role: 'pin-label', node: state.route.from, fs: 13 });
      }
      if (to && to.f === floor) {
        g.appendChild(el('circle', { cx: to.x, cy: to.y, r: 9, class: 'pin pin-end' }));
        reserve({ x: to.x - 11, y: to.y - 11, w: 22, h: 22 });
        placeLabel(g, I.t('map.goal', state.lang), to, cands,
          { cls: 'pin-label pin-label-end', role: 'pin-label', node: state.route.to, fs: 13 });
      }
    }

    function drawMarker(g) {
      state.markerEls = null;
      if (!state.marker || state.marker.f !== state.floor) { return; }
      var halo = el('circle', { cx: state.marker.x, cy: state.marker.y, r: 12, class: 'marker-halo' });
      var dot = el('circle', { cx: state.marker.x, cy: state.marker.y, r: 6, class: 'marker' });
      g.appendChild(halo);
      g.appendChild(dot);
      state.markerEls = { halo: halo, dot: dot };
    }

    function render() {
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      occ = [];
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
      drawBackground(g);
      drawLinks(g, state.floor, activeBs);
      drawBuildings(g, state.floor, activeBs);
      drawCorridors(g, state.floor);
      drawCores(g, state.floor);
      drawRooms(g, state.floor);
      drawRoute(g, state.floor);
      drawMarker(g);

      if (opts.onRender) { opts.onRender(routeFloors(), state.floor); }
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

    render();

    return {
      render: render,
      setFloor: function (f) { state.floor = f; render(); },
      getFloor: function () { return state.floor; },
      setLang: function (l) { state.lang = l; render(); },
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
      floors: routeFloors
    };
  }

  globalThis.FUST = globalThis.FUST || {};
  globalThis.FUST.MapView = { create: create };
})();
