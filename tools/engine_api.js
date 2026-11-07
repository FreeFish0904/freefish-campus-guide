/* =====================================================================
 * Engine API - the only surface a Dify Code node touches.
 * ---------------------------------------------------------------------
 * Everything here is glue over the same NLU / Router / Steps / I18N the web
 * app loads from index.html. No routing logic lives in this file, so the
 * browser and the Dify app cannot drift apart: change src/router.js and
 * both change, change src/data/campus.ust.js and both change.
 *
 *   Engine.parse(query[, opts])         what the sentence means
 *   Engine.route(fromId, toId[, opts])  one route, already rendered
 *   Engine.nearest(fromId, poi[, opts]) closest POI + the walk to it
 *   Engine.answer(query[, opts])        parse + route in one call
 *   Engine.hasPlace(id)                 whitelist check for an LLM guess
 *   Engine.suggest(text)                place ids a fuzzy string looks like
 *   Engine.place(id) / Engine.places()  labels for prompting or checking
 *   Engine.version                      hash of the sources it was built from
 *
 * opts: { lang: 'en'|'zh'|'yue', stepFree: bool, originId, destId, poi }
 *
 * Every return value is JSON-safe - plain objects, strings, numbers,
 * booleans and arrays only - so it survives being a Dify node output.
 * ===================================================================== */
(function () {
  'use strict';

  var G = (typeof globalThis !== 'undefined') ? globalThis : this;
  var F = G.FUST;
  var C = F.Campus;
  var I = F.I18N;
  var N = F.NLU;
  var R = F.Router;
  var S = F.Steps;

  /* replaced by tools/bundle_engine.js at build time */
  var VERSION = '__ENGINE_VERSION__';

  /* ---- small helpers -------------------------------------------------- */

  function pickLang(lang, fallback) {
    if (lang === 'en' || lang === 'zh' || lang === 'yue') { return lang; }
    return fallback || 'en';
  }

  function ref(node, lang) {
    if (!node) { return null; }
    return {
      id: node.id,
      label: I.placeName(node, lang),
      kind: node.kind,
      b: node.b,
      f: node.f,
      poi: node.poi || null
    };
  }

  function refAll(ids, lang) {
    return ids.map(function (id) { return ref(C.node(id), lang); })
              .filter(function (x) { return !!x; });
  }

  function unique(list) {
    var seen = {}, out = [];
    list.forEach(function (v) {
      if (v && !seen[v]) { seen[v] = 1; out.push(v); }
    });
    return out;
  }

  function noRoute(lang) {
    return I.t('route.noRoute', lang);
  }

  /* ---- render one route the way the app's answer card does ------------ */
  /* title / summary line / steps / arrival / alternative, in the same order
     and with the same strings as src/app.js. tests/check_bundle.js compares
     this against an independent implementation of the card, so a wording
     change has to be made deliberately in both places. */
  function render(plan, lang, extra) {
    var r = plan.primary;
    var steps = S.build(r);
    var sum = I.summary(r, lang);

    var title = (extra && extra.title)
      ? extra.title
      : I.placeName(C.node(r.from), lang) + ' → ' + I.placeName(C.node(r.to), lang);

    var meta = [
      sum.time,
      sum.dist,
      sum.lifts,
      I.t(plan.stepFree ? 'route.stepFreeTag' : 'route.fastestTag', lang)
    ].join(' · ');

    var items = steps.map(function (st, i) {
      return { n: i + 1, type: st.type, text: I.stepText(st, lang) };
    });

    var arrive = I.t('step.arrive', lang, { place: I.placeName(C.node(r.to), lang) });

    var floors = unique(steps.reduce(function (acc, st) {
      return acc.concat([st.fromF, st.toF]);
    }, []));

    var alt = null;
    if (plan.alternative) {
      var diff = Math.round(plan.alternative.sec - r.sec);
      alt = diff < 0
        ? I.t('route.altFaster', lang, {
            time: I.duration(plan.alternative.sec, lang),
            save: I.duration(-diff, lang)
          })
        : I.t('route.altStepFree', lang, {
            time: I.duration(plan.alternative.sec, lang),
            extra: I.duration(diff, lang)
          });
    }

    var notes = (extra && extra.notes) || [];
    var also = (extra && extra.alsoClose) || [];

    var lines = ['**' + title + '**', meta];
    notes.forEach(function (n) { lines.push('_' + n + '_'); });
    lines.push('');
    items.forEach(function (it) { lines.push(it.n + '. ' + it.text); });
    lines.push('✓ ' + arrive);
    if (alt) { lines.push('', '_' + alt + '_'); }
    if (also.length) {
      lines.push('', '_' + I.t('msg.nearAlt', lang, {
        list: also.map(function (x) { return x.label; }).join(' · ')
      }) + '_');
    }

    return {
      ok: true,
      kind: 'route',
      lang: lang,
      fromId: r.from,
      toId: r.to,
      title: title,
      sec: Math.round(r.sec),
      metres: r.m,
      floors: floors,
      lifts: r.lifts,
      stepFree: !!plan.stepFree,
      fellBack: !!plan.fellBack,
      summary: { time: sum.time, dist: sum.dist, lifts: sum.lifts, meta: meta },
      steps: items,
      arrive: arrive,
      alt: alt,
      text: lines.join('\n')
    };
  }

  /* ---- public API ----------------------------------------------------- */

  function parse(query, opts) {
    opts = opts || {};
    var p = N.parse(query);
    var lang = pickLang(opts.lang, p.lang);

    var out = {
      status: p.status,
      intent: p.intent,
      lang: lang,
      said: p.text,
      stepFree: (p.stepFree === null || p.stepFree === undefined) ? null : !!p.stepFree,
      fastest: !!p.fastest,
      origin: ref(p.origin && p.origin.node, lang),
      dest: ref(p.dest && p.dest.node, lang),
      poi: p.poi || null,
      unknown: p.unknown || '',
      corrections: (p.corrections || []).map(function (c) {
        return I.t('clarify.corrected', lang, { from: c.from, to: c.to });
      }),
      candidates: []
    };

    if (p.status === 'need_dest') {
      var ids = p.unknown ? N.suggestIds(p.unknown) : [];
      N.POPULAR.dest.forEach(function (id) { if (ids.indexOf(id) < 0) { ids.push(id); } });
      out.candidates = refAll(ids.slice(0, 4), lang);
    } else if (p.status === 'need_origin') {
      out.candidates = refAll(N.POPULAR.origin.slice(0, 3), lang);
    }
    return out;
  }

  function route(fromId, toId, opts) {
    opts = opts || {};
    var lang = pickLang(opts.lang, 'en');
    if (!C.node(fromId) || !C.node(toId)) {
      return { ok: false, kind: 'route', lang: lang, fromId: fromId, toId: toId,
               text: noRoute(lang), error: 'unknown place id' };
    }
    var plan = R.plan(fromId, toId, { stepFree: opts.stepFree !== false });
    if (!plan.primary) {
      return { ok: false, kind: 'route', lang: lang, fromId: fromId, toId: toId,
               text: noRoute(lang) };
    }
    return render(plan, lang, null);
  }

  /* Nearest POI of a kind: same call the app makes when the sentence is
     "where is the nearest toilet?", rendered the same way. */
  function nearest(fromId, poi, opts) {
    opts = opts || {};
    var lang = pickLang(opts.lang, 'en');
    var from = C.node(fromId);
    if (!from || !poi) {
      return { ok: false, kind: 'nearest', lang: lang, text: noRoute(lang) };
    }
    var list = R.nearestPoi(fromId, poi, { stepFree: opts.stepFree !== false });
    if (!list.length) {
      return { ok: false, kind: 'nearest', lang: lang, text: noRoute(lang) };
    }
    var hit = list[0];
    var plan = { primary: hit.route, alternative: null,
                 stepFree: opts.stepFree !== false, fellBack: false };
    var alsoClose = list.slice(1, 3).map(function (x) {
      return { id: x.node.id, label: I.placeName(x.node, lang), sec: Math.round(x.sec) };
    });
    var title = I.t('clarify.nearest', lang, {
      poi: I.t('poi.' + poi, lang),
      place: I.placeName(from, lang)
    });

    var out = render(plan, lang, { title: title, alsoClose: alsoClose });
    out.kind = 'nearest';
    out.poi = poi;
    out.fromId = fromId;
    out.toId = hit.node.id;
    out.alsoClose = alsoClose;
    return out;
  }

  /* "I could not work out the destination - which of these did you mean?"
     The candidate list is the app's chip row, as text plus ids, so a Dify
     conversation can either show the labels or store the id it picks. */
  function clarify(p, lang) {
    var lines = [];
    if (p.status === 'need_origin') {
      lines.push(I.t('clarify.needOrigin', lang));
    } else if (p.status === 'need_dest') {
      /* src/app.js says "I could not work out the destination, which did you
         mean?" only when something was said but not understood; otherwise it
         just asks for a destination. Same distinction here. */
      lines.push(p.unknown ? I.t('clarify.needDest', lang)
                           : I.t('clarify.pickDest', lang));
    } else {
      lines.push(I.t('clarify.help', lang));
    }
    p.corrections.forEach(function (n) { lines.push(n); });
    if (p.unknown) {
      lines.push(I.t('clarify.unknown', lang, { text: p.unknown }));
    }
    if (p.candidates.length) {
      lines.push('');
      p.candidates.forEach(function (c) {
        lines.push('- ' + c.label + '  `' + c.id + '`');
      });
    }
    return {
      ok: false,
      kind: 'clarify',
      status: p.status,
      need: p.status === 'need_origin' ? 'origin'
          : (p.status === 'need_dest' ? 'dest' : 'none'),
      sentence: lines[0],
      lang: lang,
      candidates: p.candidates,
      text: lines.join('\n')
    };
  }

  /* One call for a Dify Code node: sentence in, everything the Answer node
     needs out. `opts.originId` / `opts.destId` carry what a previous turn
     collected ("Got it - where are you starting from?"). */
  function answer(query, opts) {
    opts = opts || {};
    var p = parse(query, opts);
    var lang = p.lang;
    var stepFree = (p.stepFree === null) ? (opts.stepFree !== false) : p.stepFree;
    var originId = p.origin ? p.origin.id : (opts.originId || null);
    var destId = p.dest ? p.dest.id : (opts.destId || null);
    var poi = p.poi || opts.poi || null;
    /* "where is the nearest loo" wins; but an explicit destId outranks a POI
       word that only appeared in passing ("I am at the library entrance"
       mentions an entrance, but that is where you already are). A workflow
       only passes destId when a turn actually resolved a destination. */
    var wantsPoi = !!poi && !destId &&
                   (p.intent === 'nearest' || (p.status !== 'ok' && !p.dest));

    var out;
    if (originId && wantsPoi) {
      out = nearest(originId, poi, { lang: lang, stepFree: stepFree });
    } else if (originId && destId) {
      out = route(originId, destId, { lang: lang, stepFree: stepFree });
    } else {
      out = clarify(p, lang);
    }
    out.understood = p;
    out.originId = originId;
    out.destId = destId;
    out.stepFreeRequested = stepFree;
    return out;
  }

  /* Named rooms and cores: the whitelist an LLM's place guess is checked
     against, and the list a prompt can offer to a model. */
  function places() {
    return C.nodes
      .filter(function (n) { return !!n.names; })
      .map(function (n) {
        return { id: n.id, en: I.name(n, 'en'), zh: I.name(n, 'zh'),
                 yue: I.name(n, 'yue'), kind: n.kind, b: n.b, f: n.f,
                 poi: n.poi || null };
      });
  }

  var Engine = {
    version: VERSION,
    campus: C.id,
    lang: { detect: N.detectLang, normalize: N.normalizeText },
    meta: {
      name: C.meta.name || null,
      real: !!C.meta.real,
      levels: C.LEVELS,
      buildings: Object.keys(C.BUILDINGS)
    },
    parse: parse,
    route: route,
    nearest: nearest,
    answer: answer,
    places: places,
    place: function (id) { return ref(C.node(id), 'en'); },
    hasPlace: function (id) { return !!C.node(id); },
    suggest: function (text) { return N.suggestIds(text); }
  };

  G.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) { module.exports = Engine; }
})();
