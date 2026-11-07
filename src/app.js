/* =====================================================================
 * App - glue: chat input -> NLU -> router -> steps -> map.
 * Everything on screen is re-built from `state`, so switching language
 * re-translates the route that is already displayed.
 * ===================================================================== */
(function () {
  'use strict';

  var C = globalThis.FUST.Campus;
  var I = globalThis.FUST.I18N;
  var N = globalThis.FUST.NLU;
  var R = globalThis.FUST.Router;
  var S = globalThis.FUST.Steps;

  var state = {
    lang: 'en',
    stepFree: true,
    log: [],
    current: null,
    pending: null,
    activeStep: -1,
    map: null
  };

  var dom = {};

  function t(key, vars) { return I.t(key, state.lang, vars); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pname(id) { return I.placeName(C.node(id), state.lang); }

  function cacheDom() {
    dom.thread = document.getElementById('thread');
    dom.input = document.getElementById('askInput');
    dom.form = document.getElementById('askForm');
    dom.chips = document.getElementById('scenarioChips');
    dom.tabs = document.getElementById('floorTabs');
    dom.playBtn = document.getElementById('playBtn');
    dom.playStatus = document.getElementById('playStatus');
    dom.toggle = document.getElementById('stepFreeToggle');
    dom.lang = document.getElementById('langSwitch');
  }

  function applyStatic() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-ph]'), function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    document.documentElement.lang = state.lang === 'zh' ? 'zh-Hans'
      : (state.lang === 'yue' ? 'zh-Hant-HK' : 'en');
  }

  /* ---- scenario chips -------------------------------------------------- */
  function renderScenarios() {
    dom.chips.innerHTML = '';
    globalThis.FUST.SCENARIOS.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.innerHTML = '<span class="chip-title">' + esc(s.title[state.lang]) + '</span>' +
                    '<span class="chip-note">' + esc(s.note[state.lang]) + '</span>';
      b.onclick = function () { ask(s.query[state.lang]); };
      dom.chips.appendChild(b);
    });
  }

  /* ---- chat thread ----------------------------------------------------- */
  function renderThread() {
    dom.thread.innerHTML = '';
    state.log.forEach(function (entry) {
      var wrap = document.createElement('div');
      wrap.className = 'msg ' + (entry.role === 'you' ? 'you' : 'bot');

      var who = document.createElement('div');
      who.className = 'who';
      who.textContent = entry.role === 'you' ? t('chat.you') : t('chat.bot');
      wrap.appendChild(who);

      var bubble = document.createElement('div');
      bubble.className = 'bubble';

      if (entry.role === 'you') {
        bubble.textContent = entry.text;
      } else if (entry.kind === 'line') {
        bubble.textContent = t(entry.key, entry.vars);
      } else if (entry.kind === 'clarify') {
        clarifyBubble(entry, bubble);
      } else if (entry.kind === 'route') {
        bubble.appendChild(routeCard(entry));
      }

      wrap.appendChild(bubble);
      dom.thread.appendChild(wrap);
    });

    /* a freshly computed route should start at its heading, not at the
       bottom of a long step list */
    var last = state.log[state.log.length - 1];
    var cards = dom.thread.querySelectorAll('.card');
    if (last && last.kind === 'route' && cards.length) {
      revealCard(cards[cards.length - 1]);
    } else {
      dom.thread.scrollTop = dom.thread.scrollHeight;
    }
  }

  /* the thread scrolls internally on desktop; on phones the page grows
     instead and the answer card lands directly under the scenario cards,
     so no window scrolling is needed */
  function revealCard(card) {
    if (dom.thread.scrollHeight <= dom.thread.clientHeight + 4) { return; }
    /* include the "Guide" label above the card so nothing is clipped */
    var target = (card.closest && card.closest('.msg')) || card;
    var top = target.getBoundingClientRect().top -
              dom.thread.getBoundingClientRect().top + dom.thread.scrollTop;
    dom.thread.scrollTop = Math.max(0, top - 10);
  }

  function clarifyBubble(entry, bubble) {
    var p = document.createElement('p');
    p.className = 'say';
    p.textContent = t(entry.key, entry.vars);
    bubble.appendChild(p);

    (entry.extra || []).forEach(function (x) {
      var q = document.createElement('p');
      q.className = 'say small';
      q.textContent = t(x.key, x.vars);
      bubble.appendChild(q);
    });

    if (entry.chips && entry.chips.length) {
      var row = document.createElement('div');
      row.className = 'chip-row';
      entry.chips.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mini';
        b.textContent = c.id ? pname(c.id) : t(c.key);
        b.onclick = function () { onChip(c); };
        row.appendChild(b);
      });
      bubble.appendChild(row);
    }
  }

  function routeCard(entry) {
    var d = entry.data;
    var sum = I.summary(d.route, state.lang);
    var card = document.createElement('div');
    card.className = 'card';

    var title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = d.nearest
      ? t('clarify.nearest', { poi: t('poi.' + d.nearest.poi), place: pname(d.originId) })
      : pname(d.originId) + ' → ' + pname(d.destId);
    card.appendChild(title);

    var meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.innerHTML =
      '<span class="m-time">' + esc(sum.time) + '</span>' +
      '<span>' + esc(sum.dist) + '</span>' +
      '<span>' + esc(sum.lifts) + '</span>' +
      '<span class="tag">' + esc(t(d.stepFree ? 'route.stepFreeTag' : 'route.fastestTag')) + '</span>';
    card.appendChild(meta);

    (entry.notes || []).forEach(function (x) {
      var q = document.createElement('div');
      q.className = 'note';
      q.textContent = t(x.key, x.vars);
      card.appendChild(q);
    });

    var ol = document.createElement('ol');
    ol.className = 'steps';
    d.steps.forEach(function (st, i) { ol.appendChild(stepLi(st, i, false, d)); });
    ol.appendChild(stepLi({ type: 'arrive', id: d.destId }, d.steps.length, true, d));
    card.appendChild(ol);

    if (d.plan && d.plan.alternative) {
      var alt = document.createElement('div');
      alt.className = 'alt';
      var diff = Math.round(d.plan.alternative.sec - d.route.sec);
      alt.textContent = diff < 0
        ? t('route.altFaster', {
            time: I.duration(d.plan.alternative.sec, state.lang),
            save: I.duration(-diff, state.lang)
          })
        : t('route.altStepFree', {
            time: I.duration(d.plan.alternative.sec, state.lang),
            extra: I.duration(diff, state.lang)
          });
      card.appendChild(alt);
    }

    if (d.nearest && d.nearest.alsoClose && d.nearest.alsoClose.length) {
      var also = document.createElement('div');
      also.className = 'alt';
      also.textContent = t('msg.nearAlt', { list: d.nearest.alsoClose.map(pname).join(' · ') });
      card.appendChild(also);
    }

    return card;
  }

  function stepLi(st, i, isArrive, data) {
    var li = document.createElement('li');
    li.className = 'step step-' + st.type + (isArrive ? ' step-arrive' : '');

    var num = document.createElement('span');
    num.className = 'num';
    num.textContent = isArrive ? '✓' : String(i + 1);

    var body = document.createElement('div');
    body.className = 'step-body';

    var txt = document.createElement('div');
    txt.className = 'step-text';
    txt.textContent = I.stepText(st, state.lang);
    body.appendChild(txt);

    var sub = '';
    if (st.type === 'lift') {
      var core = C.coreById[st.core];
      if (core && core.note) { sub = I.name(core.note, state.lang); }
    } else if (st.type === 'walk') {
      sub = I.buildingName(st.fromB, state.lang) + ' · ' + I.floorName(st.fromF, state.lang);
    } else if (st.type === 'stairs' || st.type === 'escalator') {
      sub = I.buildingName(st.fromB, state.lang);
    }
    if (sub) {
      var s2 = document.createElement('div');
      s2.className = 'step-sub';
      s2.textContent = sub;
      body.appendChild(s2);
    }

    li.appendChild(num);
    li.appendChild(body);

    if (!isArrive) {
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li._data = data;
      li.onclick = function () { focusStep(i, li); };
      li.onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusStep(i, li); }
      };
    }
    return li;
  }

  /* ---- request flow ---------------------------------------------------- */
  function ask(text) {
    text = String(text || '').trim();
    if (!text) { return; }
    dom.input.value = '';
    state.log.push({ role: 'you', text: text });
    renderThread();
    handle(N.parse(text));
  }

  function handle(p) {
    var stepFree = (p.stepFree === null || p.stepFree === undefined) ? state.stepFree : p.stepFree;
    /* a query that says "no stairs" or "fastest" also flips the switch,
       so the control always matches the route on screen */
    if (p.stepFree !== null && p.stepFree !== undefined && dom.toggle.checked !== p.stepFree) {
      state.stepFree = p.stepFree;
      dom.toggle.checked = p.stepFree;
    }
    var notes = (p.corrections || []).map(function (c) {
      return { key: 'clarify.corrected', vars: { from: c.from, to: c.to } };
    });

    if (p.status === 'ok' && p.intent === 'nearest') {
      runNearest(p.origin.node.id, p.poi, stepFree, notes);
      return;
    }

    if (p.status === 'ok' && p.dest) {
      runRoute(p.origin.node.id, p.dest.node.id, stepFree, notes);
      return;
    }
    if (p.status === 'need_origin') {
      state.pending = {
        originId: null,
        destId: p.dest ? p.dest.node.id : null,
        poi: p.poi || null,
        stepFree: stepFree
      };
      state.log.push({
        role: 'bot', kind: 'clarify', key: 'clarify.needOrigin', extra: notes,
        chips: N.POPULAR.origin.map(function (id) { return { id: id, action: 'origin' }; })
      });
      renderThread();
      return;
    }
    if (p.status === 'need_dest') {
      state.pending = {
        originId: p.origin ? p.origin.node.id : null,
        destId: null, poi: null, stepFree: stepFree
      };
      var extra = notes.slice();
      if (p.unknown) { extra.push({ key: 'clarify.unknown', vars: { text: p.unknown } }); }
      state.log.push({
        role: 'bot', kind: 'clarify',
        key: p.unknown ? 'clarify.needDest' : 'clarify.pickDest',
        extra: extra, chips: destSuggestions(p)
      });
      renderThread();
      return;
    }

    state.log.push({
      role: 'bot', kind: 'clarify', key: 'clarify.help',
      chips: N.POPULAR.dest.slice(0, 3).map(function (id) { return { id: id, action: 'dest' }; })
    });
    renderThread();
  }

  function destSuggestions(p) {
    var ids = p.unknown ? N.suggestIds(p.unknown) : [];
    N.POPULAR.dest.forEach(function (id) { if (ids.indexOf(id) < 0) { ids.push(id); } });
    return ids.slice(0, 4).map(function (id) { return { id: id, action: 'dest' }; });
  }

  function runRoute(originId, destId, stepFree, notes, replaceLast) {
    var plan = R.plan(originId, destId, { stepFree: stepFree });
    if (!plan.primary) {
      state.log.push({ role: 'bot', kind: 'line', key: 'route.noRoute' });
      renderThread();
      return;
    }
    var steps = S.build(plan.primary);
    state.current = {
      originId: originId, destId: destId,
      route: plan.primary, steps: steps, plan: plan,
      stepFree: plan.stepFree, nearest: null
    };
    state.pending = null;
    state.map.setRoute(plan.primary, steps);
    pushEntry({ role: 'bot', kind: 'route', data: state.current, notes: notes || [] }, replaceLast);
    renderThread();
    updateUrl();
  }

  function runNearest(originId, poi, stepFree, notes, replaceLast) {
    var list = R.nearestPoi(originId, poi, { stepFree: stepFree });
    if (!list.length) {
      state.log.push({ role: 'bot', kind: 'line', key: 'route.noRoute' });
      renderThread();
      return;
    }
    var hit = list[0];
    var steps = S.build(hit.route);
    state.current = {
      originId: originId, destId: hit.node.id,
      route: hit.route, steps: steps,
      plan: { primary: hit.route, alternative: null, stepFree: stepFree },
      stepFree: stepFree,
      nearest: {
        poi: poi,
        alsoClose: list.slice(1, 3).map(function (x) { return x.node.id; })
      }
    };
    state.pending = null;
    state.map.setRoute(hit.route, steps);
    pushEntry({ role: 'bot', kind: 'route', data: state.current, notes: notes || [] }, replaceLast);
    renderThread();
    updateUrl();
  }

  function pushEntry(entry, replaceLast) {
    if (replaceLast) {
      for (var i = state.log.length - 1; i >= 0; i--) {
        if (state.log[i].kind === 'route') { state.log.splice(i, 1); break; }
      }
    }
    state.log.push(entry);
  }

  function onChip(c) {
    var pend = state.pending || {};
    if (c.action === 'origin' && c.id) {
      if (pend.poi) { runNearest(c.id, pend.poi, pend.stepFree, []); return; }
      if (pend.destId) { runRoute(c.id, pend.destId, pend.stepFree, []); return; }
    }
    if (c.action === 'dest' && c.id) {
      if (pend.originId) { runRoute(pend.originId, c.id, pend.stepFree, []); return; }
      state.pending = { originId: null, destId: c.id, poi: null, stepFree: pend.stepFree };
      state.log.push({
        role: 'bot', kind: 'clarify', key: 'clarify.needOrigin',
        chips: N.POPULAR.origin.map(function (id) { return { id: id, action: 'origin' }; })
      });
      renderThread();
    }
  }

  /* clicking a step loads that card's route into the map first, so older
     answers in the thread stay usable */
  function focusStep(i, el) {
    var data = el && el._data;
    if (data && state.current !== data) {
      state.map.setRoute(data.route, data.steps);
      state.current = data;
    }
    state.activeStep = i;
    state.map.showStep(i);
    highlightStep(i, el);
  }

  function highlightStep(i, el) {
    var card = (el && el.closest) ? el.closest('.card') : null;
    if (!card) {
      var cards = dom.thread.querySelectorAll('.card');
      card = cards[cards.length - 1];
    }
    if (!card) { return; }
    var lis = card.querySelectorAll('.step');
    Array.prototype.forEach.call(lis, function (li) { li.classList.remove('active'); });
    if (i >= 0 && lis[i]) { lis[i].classList.add('active'); }
  }

  /* ---- map + language + wiring ---------------------------------------- */
  function buildMap() {
    state.map = globalThis.FUST.MapView.create(document.getElementById('map'), {
      lang: state.lang,
      onRender: function (routeFloors, floor) { renderFloorTabs(routeFloors, floor); },
      onStatus: function (s) { dom.playStatus.textContent = s || ''; },
      onStep: function (i) { highlightStep(i); },
      onPlaying: function (playing) {
        dom.playBtn.textContent = t(playing ? 'map.pause' : 'map.play');
        dom.playBtn.classList.toggle('playing', playing);
        if (!playing) { dom.playStatus.textContent = ''; }
      }
    });
  }

  function renderFloorTabs(routeFloors, activeFloor) {
    dom.tabs.innerHTML = '';
    C.LEVELS.forEach(function (f) {
      if (!C.buildingsOn(f).length) { return; }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'floor' +
        (f === activeFloor ? ' active' : '') +
        (routeFloors && routeFloors.indexOf(f) >= 0 ? ' on-route' : '');
      b.textContent = I.floorName(f, state.lang);
      b.onclick = function () { state.map.setFloor(f); };
      dom.tabs.appendChild(b);
    });
  }

  function setLang(l, silent) {
    if (I.LANGS.indexOf(l) < 0) { return; }
    state.lang = l;
    Array.prototype.forEach.call(dom.lang.querySelectorAll('button'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === l);
    });
    applyStatic();
    renderScenarios();
    renderThread();
    if (state.map) {
      state.map.setLang(l);
      dom.playBtn.textContent = t(state.map.isPlaying() ? 'map.pause' : 'map.play');
    }
    if (!silent) { updateUrl(); }
  }

  function detectLang() {
    var n = String(navigator.language || 'en').toLowerCase();
    if (n.indexOf('zh') === 0) {
      return (n.indexOf('hant') >= 0 || n.indexOf('hk') >= 0 || n.indexOf('tw') >= 0) ? 'yue' : 'zh';
    }
    return 'en';
  }

  function updateUrl() {
    try {
      var u = new URL(window.location.href);
      var last = null;
      for (var i = state.log.length - 1; i >= 0; i--) {
        if (state.log[i].role === 'you') { last = state.log[i].text; break; }
      }
      if (last) { u.searchParams.set('q', last); }
      u.searchParams.set('lang', state.lang);
      u.searchParams.set('sf', state.stepFree ? '1' : '0');
      window.history.replaceState(null, '', u.toString());
    } catch (e) {
      /* file:// in some browsers refuses replaceState - harmless */
    }
  }

  function deepLink() {
    var params = null;
    try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }
    if (!params) { return; }
    var lang = params.get('lang');
    if (lang && I.LANGS.indexOf(lang) >= 0) { setLang(lang, true); }
    if (params.get('sf') === '0') { state.stepFree = false; dom.toggle.checked = false; }
    var q = params.get('q');
    if (q) { ask(q); }
    var f = params.get('floor');
    if (f && C.LEVELS.indexOf(f) >= 0 && state.map) { state.map.setFloor(f); }
  }

  function bind() {
    dom.form.addEventListener('submit', function (e) {
      e.preventDefault();
      ask(dom.input.value);
    });

    Array.prototype.forEach.call(dom.lang.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });

    dom.toggle.addEventListener('change', function () {
      state.stepFree = dom.toggle.checked;
      if (state.current) {
        if (state.current.nearest) {
          runNearest(state.current.originId, state.current.nearest.poi, state.stepFree, [], true);
        } else {
          runRoute(state.current.originId, state.current.destId, state.stepFree, [], true);
        }
      }
      updateUrl();
    });

    dom.playBtn.addEventListener('click', function () { state.map.play(); });
  }

  function init() {
    cacheDom();
    buildMap();
    bind();
    setLang(detectLang(), true);
    state.log.push({ role: 'bot', kind: 'line', key: 'app.tagline' });
    renderThread();
    deepLink();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
