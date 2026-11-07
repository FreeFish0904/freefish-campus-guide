/* =====================================================================
 * Checks dist/dify-engine.js            node tests/check_bundle.js
 * ---------------------------------------------------------------------
 * 1. freshness  dist/ must be exactly what tools/bundle_engine.js builds,
 *               and its Engine.version must be the hash of the sources
 * 2. sandbox    it must run in a bare vm context - no document, window,
 *               require, process, fetch, localStorage - because that is
 *               what a Dify Code node is
 * 3. parity     twelve questions must produce the same text the browser
 *               app produces, byte for byte. The expectation is rebuilt
 *               here from FUST.I18N / Router / Steps with an independent
 *               implementation of the answer card (below), so a wording
 *               change has to be made deliberately in both places.
 * 4. contract   the facts the demo leans on: which lifts, which floors,
 *               and that a step-free route really has no stairs
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bundler = require('../tools/bundle_engine');

let passed = 0;
const failures = [];

function ok(id, cond, msg) {
  if (cond) { passed++; return true; }
  failures.push(id + ': ' + msg);
  return false;
}

/* the bundle, loaded the way a Dify Code node would load it: a context with
   nothing in it but the language itself */
function loadBundle() {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(bundler.OUT, 'utf8'), ctx,
                  { filename: 'dist/dify-engine.js' });
  return ctx.Engine;
}

/* the browser, loaded the way index.html loads it: <script> tags, with a
   `location` so active.js picks the right campus */
function loadBrowser() {
  const ctx = vm.createContext({ location: { search: '' } });
  bundler.SOURCES.forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(bundler.root, rel), 'utf8'), ctx,
                    { filename: rel });
  });
  return ctx.FUST;
}

/* ---- 1. freshness ---------------------------------------------------- */

const built = bundler.build();
const disk = fs.existsSync(bundler.OUT) ? fs.readFileSync(bundler.OUT, 'utf8') : '';
const diskMin = fs.existsSync(bundler.OUT_MIN) ? fs.readFileSync(bundler.OUT_MIN, 'utf8') : '';
const nodeSrc = fs.existsSync(bundler.OUT_NODE) ? fs.readFileSync(bundler.OUT_NODE, 'utf8') : '';

ok('fresh', disk === built, 'dist/dify-engine.js is stale - run node tools/bundle_engine.js');
ok('fresh-min', diskMin === bundler.minify(built),
   'dist/dify-engine.min.js is stale - run node tools/bundle_engine.js');
ok('fresh-node', nodeSrc === bundler.nodeCode(),
   'dist/dify-code-node.js is stale - run node tools/bundle_engine.js');

const E = loadBundle();
const F = loadBrowser();

ok('version', E && E.version === bundler.version(),
   'Engine.version ' + (E && E.version) + ' != ' + bundler.version());
ok('campus', E && E.campus === F.Campus.id,
   'Engine.campus ' + (E && E.campus) + ' != ' + F.Campus.id);
ok('places', E.places().length === F.Campus.nodes.filter(function (n) { return !!n.names; }).length,
   'Engine.places() count');

/* ---- 2. sandbox ------------------------------------------------------ */

/* scan the minified build: comments are gone, so anything left is code */
const code = bundler.minify(built);
['document.', 'window.', 'localStorage', 'XMLHttpRequest', 'fetch(',
 'require(', 'process.', 'eval('].forEach(function (word) {
  ok('sandbox', code.indexOf(word) < 0, 'bundle uses ' + word);
});


/* ---- 3. parity: the same answer, built independently ------------------ */

/* Mirrors src/app.js: handle() picks the branch, routeCard() lays the lines
   out (title, the four meta values, the numbered steps, the arrival line,
   the alternative, the "also close" line). The only choice made here that
   app.js does not make is joining the four meta values with ' · ' - the app
   puts them side by side and lets CSS space them. */
function refCard(r, steps, plan, lang, nearest) {
  const I = F.I18N, C = F.Campus;
  const sum = I.summary(r, lang);
  const title = nearest
    ? I.t('clarify.nearest', lang, {
        poi: I.t('poi.' + nearest.poi, lang),
        place: I.placeName(C.node(r.from), lang)
      })
    : I.placeName(C.node(r.from), lang) + ' → ' + I.placeName(C.node(r.to), lang);
  const meta = [
    sum.time, sum.dist, sum.lifts,
    I.t(plan.stepFree ? 'route.stepFreeTag' : 'route.fastestTag', lang)
  ].join(' · ');

  const lines = ['**' + title + '**', meta, ''];
  steps.forEach(function (st, i) { lines.push((i + 1) + '. ' + I.stepText(st, lang)); });
  lines.push('✓ ' + I.t('step.arrive', lang, { place: I.placeName(C.node(r.to), lang) }));

  if (plan.alternative) {
    const diff = Math.round(plan.alternative.sec - r.sec);
    lines.push('', '_' + (diff < 0
      ? I.t('route.altFaster', lang, {
          time: I.duration(plan.alternative.sec, lang),
          save: I.duration(-diff, lang)
        })
      : I.t('route.altStepFree', lang, {
          time: I.duration(plan.alternative.sec, lang),
          extra: I.duration(diff, lang)
        })) + '_');
  }
  if (nearest && nearest.alsoClose.length) {
    lines.push('', '_' + I.t('msg.nearAlt', lang, {
      list: nearest.alsoClose.map(function (id) { return I.placeName(C.node(id), lang); }).join(' · ')
    }) + '_');
  }
  return { text: lines.join('\n'), sec: Math.round(r.sec), lifts: r.lifts };
}

function refAnswer(q, opts) {
  const I = F.I18N, N = F.NLU, R = F.Router, S = F.Steps;
  const p = N.parse(q);
  const lang = opts.lang || p.lang;
  const stepFree = (p.stepFree === null || p.stepFree === undefined)
    ? (opts.stepFree !== false) : p.stepFree;

  if (p.status === 'ok' && p.intent === 'nearest') {
    const list = R.nearestPoi(p.origin.node.id, p.poi, { stepFree: stepFree });
    if (!list.length) { return { ok: false, kind: 'nearest', text: I.t('route.noRoute', lang) }; }
    const hit = list[0];
    const card = refCard(hit.route, S.build(hit.route), { stepFree: stepFree, alternative: null },
                         lang, { poi: p.poi, alsoClose: list.slice(1, 3).map(function (x) { return x.node.id; }) });
    return { ok: true, kind: 'nearest', text: card.text, sec: card.sec, lifts: card.lifts };
  }

  if (p.status === 'ok' && p.dest) {
    const plan = R.plan(p.origin.node.id, p.dest.node.id, { stepFree: stepFree });
    if (!plan.primary) { return { ok: false, kind: 'route', text: I.t('route.noRoute', lang) }; }
    const card = refCard(plan.primary, S.build(plan.primary), plan, lang, null);
    return { ok: true, kind: 'route', text: card.text, sec: card.sec, lifts: card.lifts };
  }

  let sentence;
  if (p.status === 'need_origin') { sentence = I.t('clarify.needOrigin', lang); }
  else if (p.status === 'need_dest') {
    sentence = p.unknown ? I.t('clarify.needDest', lang) : I.t('clarify.pickDest', lang);
  } else { sentence = I.t('clarify.help', lang); }
  return { ok: false, kind: 'clarify', status: p.status, sentence: sentence,
           text: I.t('route.noRoute', lang) };
}

const GOLDEN = [
  { q: 'libary seaview to lg 1 canteen pls', note: 'typo + mixed case' },
  { q: 'library entrance to lg 1 canteen', note: 'short route, no lift' },
  { q: 'no stairs library entrance to lg 1 canteen', note: 'step-free read from the text' },
  { q: 'from the bus stop to the swimming pool', note: 'outdoor walk' },
  { q: 'from lg7 canteen to a 3f classroom no stairs', note: 'two lift banks' },
  { q: 'where is the nearest restroom from lg7 canteen', note: 'nearest POI' },
  { q: 'from the piazza to the halls', note: 'the long climb' },
  { q: 'seaview seats to lg7 canteen fastest', note: '"fastest" allows stairs' },
  { q: 'i am at the library', note: 'asks for a destination' },
  { q: '我在图书馆，怎么去LG1 食堂', note: 'Chinese' },
  { q: '我喺圖書館，去 LG1 飯堂點行', note: 'Cantonese, traditional' },
  { q: 'hello', note: 'no place at all' }
];

function jsonProblem(v, depth, where) {
  if (v === null) { return null; }
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean') { return null; }
  if (t !== 'object') { return where + ' is ' + t; }
  if (depth >= 5) { return where + ' nests deeper than 5'; }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const p = jsonProblem(v[i], depth + 1, where + '[' + i + ']');
      if (p) { return p; }
    }
    return null;
  }
  const keys = Object.keys(v);
  for (let i = 0; i < keys.length; i++) {
    const p = jsonProblem(v[keys[i]], depth + 1, where + '.' + keys[i]);
    if (p) { return p; }
  }
  return null;
}

/* ---- 3a. parity loop ------------------------------------------------- */

GOLDEN.forEach(function (c) {
  const got = E.answer(c.q, {});
  const want = refAnswer(c.q, {});
  const id = 'parity [' + c.note + ']';

  if (want.ok) {
    ok(id, got.ok === true, 'engine found no route: ' + got.text.split('\n')[0]);
    if (!got.ok) { return; }
    ok(id, got.kind === want.kind, 'kind ' + got.kind + ' != ' + want.kind);
    ok(id, got.text === want.text,
       'text differs\n--- engine ---\n' + got.text + '\n--- browser ---\n' + want.text);
    ok(id, got.sec === want.sec, 'sec ' + got.sec + ' != ' + want.sec);
    ok(id, JSON.stringify(got.lifts) === JSON.stringify(want.lifts),
       'lifts ' + JSON.stringify(got.lifts) + ' != ' + JSON.stringify(want.lifts));
    const bad = jsonProblem(got, 0, 'answer');
    ok(id, bad === null, 'output not usable as a Dify variable: ' + bad);
  } else {
    ok(id, got.ok === false, 'engine found a route where the browser found none');
    ok(id, got.text.split('\n')[0] === want.sentence,
       'first line "' + got.text.split('\n')[0] + '" != "' + want.sentence + '"');
    const need = want.status === 'need_origin' ? 'origin'
               : (want.status === 'need_dest' ? 'dest' : 'none');
    ok(id, got.need === need, 'need ' + got.need + ' != ' + need);
  }
});

/* ---- 4. contract: the facts the demo leans on ------------------------ */

const lg1 = E.answer('library entrance to lg 1 canteen');
ok('contract', lg1.ok && lg1.toId === 'ust-lg1-canteen', 'library -> LG1 canteen');
ok('contract', lg1.lifts.length === 0, 'that walk needs no lift, got ' + JSON.stringify(lg1.lifts));
ok('contract', JSON.stringify(lg1.floors) === '["LG1"]', 'floors ' + JSON.stringify(lg1.floors));
ok('contract', lg1.text.indexOf('✓ You have arrived at LG1 Canteen') >= 0, 'arrival line');

const up = E.answer('from lg7 canteen to a 3f classroom no stairs');
ok('contract', up.stepFree === true, 'step-free was read out of the sentence');
ok('contract', up.steps.every(function (s) {
  return s.type !== 'stairs' && s.type !== 'escalator';
}), 'a step-free route must not use stairs');
ok('contract', up.lifts.length === 2,
   'LG7 -> 3/F needs two lift banks, got ' + JSON.stringify(up.lifts));

const zh = E.parse('library entrance to lg 1 canteen', { lang: 'zh' });
ok('contract', zh.lang === 'zh' && zh.dest.label.indexOf('食堂') >= 0,
   'lang override must reach the labels: ' + zh.dest.label);

ok('contract', E.hasPlace('ust-lg1-canteen'), 'hasPlace accepts a real id');
ok('contract', !E.hasPlace('lg1-canteen'), 'hasPlace rejects something that is not an id');
ok('contract', E.suggest('libary').indexOf('ust-lib-entrance') >= 0,
   'suggest(libary) = ' + JSON.stringify(E.suggest('libary')));
ok('contract', E.place('ust-lib-entrance').label === 'Library Entrance',
   'place label ' + JSON.stringify(E.place('ust-lib-entrance').label));

const unknown = E.route('nope', 'ust-lg1-canteen');
ok('contract', unknown.ok === false && unknown.error === 'unknown place id',
   'an unknown id is refused, not thrown');

/* multi-turn: the second half of a clarification */
const two = E.answer('i am at the library entrance', { destId: 'ust-lg1-canteen' });
ok('multi-turn', two.ok === true && two.toId === 'ust-lg1-canteen',
   'destId carried from the previous turn is used');
const poiTurn = E.answer('nearest toilet', { originId: 'ust-lg7-canteen' });
ok('multi-turn', poiTurn.ok === true && poiTurn.kind === 'nearest',
   'originId carried from the previous turn is used');
const greeting = E.answer('hello');
ok('multi-turn', greeting.kind === 'clarify' && greeting.need === 'none',
   'a greeting asks for help');

/* the app's own example sentence must be a sentence the app understands -
   it is the first thing a stuck user types back at it */
['en', 'zh', 'yue'].forEach(function (lang) {
  const text = E.answer('', { lang: lang }).text;
  const quoted = text.match(/["“「]([^"”」]{8,})["”」]/g) || [];
  ok('help', quoted.length >= 2, lang + ' help text quotes ' + quoted.length + ' examples');
  quoted.forEach(function (q) {
    const sentence = q.slice(1, -1);
    const r = E.answer(sentence, { lang: lang });
    ok('help', r.kind !== 'clarify',
       lang + ' help example must be understood: "' + sentence + '" -> ' + r.kind);
  });
});

/* ---- 5. the Dify Code node wrapper ----------------------------------- */
/* dist/dify-code-node.js is what gets pasted into Dify: the same engine,
   evaluated once, behind function main(inputs). Run it exactly that way. */

const nodeCtx = vm.createContext({});
vm.runInContext(nodeSrc, nodeCtx, { filename: 'dist/dify-code-node.js' });

const call1 = nodeCtx.main({ query: 'library entrance to lg 1 canteen', lang: 'auto' });
const call2 = nodeCtx.main({ query: 'library entrance to lg 1 canteen', lang: 'auto' });
ok('node', call1.text === E.answer('library entrance to lg 1 canteen').text,
   'main() must answer like Engine.answer()');
ok('node', call2.text === call1.text, 'main() must be repeatable (engine is cached)');
ok('node', nodeCtx.main({ query: 'nearest toilet', originId: 'ust-lg7-canteen' }).kind === 'nearest',
   'main() must forward originId');
ok('node', nodeCtx.main({ query: 'library entrance to lg 1 canteen', lang: 'zh' })
             .text.indexOf('食堂') >= 0, 'main() must forward lang');
ok('node', nodeCtx.main({ query: 'from lg7 canteen to a 3f classroom', stepFree: 'false' }).stepFree === false,
   "stepFree:'false' from a Dify input must turn the toggle off");
ok('node', nodeCtx.main({}).kind === 'clarify', 'an empty query must ask for help, not throw');
ok('node', jsonProblem(call1, 0, 'main') === null, 'main() output must be JSON-safe');

/* ---- report ---------------------------------------------------------- */

console.log('bundle ' + (E && E.version) + '  (' +
            (Buffer.byteLength(disk) / 1024).toFixed(1) + ' KB, ' +
            GOLDEN.length + ' golden questions)');
failures.slice(0, 20).forEach(function (f) { console.log('FAIL ' + f); });
console.log((failures.length ? 'BUNDLE FAILED' : 'BUNDLE OK') + ': ' +
            passed + ' passed, ' + failures.length + ' failed');
process.exit(failures.length ? 1 : 0);
