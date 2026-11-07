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
    return clip(strip, lang === 'en' ? 18 : 12);
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
        /* name sits above the footprint, so it never collides with the
           rooms drawn just inside the walls */
        g.appendChild(el('text', { x: r[0] + 2, y: r[1] - 9, class: 'bld-name' },
          I.buildingName(b, state.lang)));
        g.appendChild(el('text', {
          x: r[0] + r[2] - 2, y: r[1] - 9, class: 'bld-code', 'text-anchor': 'end'
        }, b));
      });
    }

    function drawCorridors(g, floor) {
      C.buildingsOn(floor).forEach(function (b) {
        var sp = C.SPINES[b];
        var pts = sp.xs.map(function (x) { return x + ',' + sp.y; }).join(' ');
        g.appendChild(el('polyline', { points: pts, class: 'corridor' }));
      });
    }

    function drawRooms(g, floor) {
      var rooms = C.nodes.filter(function (n) { return n.kind === 'room' && n.f === floor; });
      var sides = { up: [], down: [] };
      rooms.forEach(function (n) {
        var sp = C.SPINES[n.b];
        (n.y < sp.y ? sides.up : sides.down).push(n);
      });

      Object.keys(sides).forEach(function (side) {
        sides[side].sort(function (a, b) { return a.x - b.x; });
        sides[side].forEach(function (n, i) {
          var sp = C.SPINES[n.b];
          var dir = side === 'up' ? -1 : 1;
          var labelY = n.y + dir * (14 + (i % 2) * 15);
          var anchor = 'middle';
          if (n.x <= sp.xs[0] + 12) { anchor = 'start'; }
          if (n.x >= sp.xs[sp.xs.length - 1] - 12) { anchor = 'end'; }

          var dot = el('circle', { cx: n.x, cy: n.y, r: 4.5, class: 'room' });
          dot.appendChild(el('title', null, I.name(n.names, state.lang)));
          g.appendChild(dot);

          var txt = labelFor(n, state.lang);
          if (txt) {
            g.appendChild(el('text', {
              x: n.x, y: labelY, class: 'room-label', 'text-anchor': anchor
            }, txt));
          }
        });
      });
    }

    function drawCores(g, floor) {
      C.nodes.filter(function (n) { return n.kind === 'core' && n.f === floor; }).forEach(function (n) {
        var grp = el('g', { class: 'core core-' + n.coreKind });
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
      if (from && from.f === floor) {
        g.appendChild(el('circle', { cx: from.x, cy: from.y, r: 9, class: 'pin pin-start' }));
        g.appendChild(el('text', { x: from.x, y: from.y - 26, class: 'pin-label', 'text-anchor': 'middle' },
          I.t('map.you', state.lang)));
      }
      if (to && to.f === floor) {
        g.appendChild(el('circle', { cx: to.x, cy: to.y, r: 9, class: 'pin pin-end' }));
        g.appendChild(el('text', { x: to.x, y: to.y - 26, class: 'pin-label', 'text-anchor': 'middle' },
          I.t('map.goal', state.lang)));
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
      var g = el('g');

      var activeBs = {};
      if (state.route) {
        state.route.nodes.forEach(function (id) {
          var n = C.node(id);
          if (n && n.f === state.floor) { activeBs[n.b] = true; }
        });
      }

      drawBackground(g);
      drawLinks(g, state.floor, activeBs);
      drawBuildings(g, state.floor, activeBs);
      drawCorridors(g, state.floor);
      drawRooms(g, state.floor);
      drawCores(g, state.floor);
      drawRoute(g, state.floor);
      drawMarker(g);

      svg.appendChild(g);
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
