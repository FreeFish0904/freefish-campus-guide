/* Test runner - `node tests/run_tests.js`
   Loads the same plain scripts the browser uses, runs tests/cases.json and
   writes docs/TEST_RESULTS.md. Exit code 1 if anything fails. */
'use strict';

const fs = require('fs');
const path = require('path');
const { load, root } = require('./load');

const F = load();
const I = F.I18N, R = F.Router, S = F.Steps, N = F.NLU, C = F.Campus;

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));

let passed = 0;
const failures = [];
const results = {};

function ok(id, cond, msg) {
  if (cond) { passed++; return true; }
  failures.push({ id: id, msg: msg });
  if (results[id]) { results[id].failed++; }
  return false;
}

function eqArr(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }

function runNlu(c) {
  const p = N.parse(c.q);
  const e = c.expect;
  if (e.status) { ok(c.id, p.status === e.status, 'status ' + p.status + ' != ' + e.status); }
  if (e.intent) { ok(c.id, p.intent === e.intent, 'intent ' + p.intent + ' != ' + e.intent); }
  if (e.origin) { ok(c.id, !!p.origin && p.origin.node.id === e.origin, 'origin ' + (p.origin && p.origin.node.id) + ' != ' + e.origin); }
  if (e.dest) { ok(c.id, !!p.dest && p.dest.node.id === e.dest, 'dest ' + (p.dest && p.dest.node.id) + ' != ' + e.dest); }
  if (e.poi) { ok(c.id, p.poi === e.poi, 'poi ' + p.poi + ' != ' + e.poi); }
  if ('stepFree' in e) { ok(c.id, p.stepFree === e.stepFree, 'stepFree ' + p.stepFree + ' != ' + e.stepFree); }
  if ('fastest' in e) { ok(c.id, p.fastest === e.fastest, 'fastest ' + p.fastest + ' != ' + e.fastest); }
  if (e.lang) { ok(c.id, p.lang === e.lang, 'lang ' + p.lang + ' != ' + e.lang); }
  if (e.correction) {
    const got = p.corrections.map(function (x) { return x.from + '>' + x.to; }).join(',');
    ok(c.id, got.indexOf(e.correction.from + '>' + e.correction.to) >= 0, 'corrections [' + got + ']');
    ok(c.id, p.status === 'ok', 'correction case should still resolve');
  }
}

function routeFor(c) {
  const p = N.parse(c.q);
  if (c.group === 'nearest') {
    const list = R.nearestPoi(p.origin.node.id, p.poi, { stepFree: c.opts.stepFree !== false });
    return { p: p, route: list.length ? list[0].route : null, steps: list.length ? S.build(list[0].route) : [], hit: list[0] };
  }
  const stepFree = c.opts.stepFree !== false;
  const plan = R.plan(p.origin.node.id, p.dest.node.id, { stepFree: stepFree });
  return { p: p, plan: plan, route: plan.primary, steps: plan.primary ? S.build(plan.primary) : [] };
}

function runRoute(c) {
  const r = routeFor(c);
  const e = c.expect;
  if (!ok(c.id, !!r.route, 'no route computed')) { return; }
  const st = r.steps;

  if (e.dest) { ok(c.id, r.p.dest.node.id === e.dest, 'dest ' + r.p.dest.node.id + ' != ' + e.dest); }
  if (e.timeMin !== undefined) { ok(c.id, r.route.sec >= e.timeMin, 'time ' + Math.round(r.route.sec) + ' < ' + e.timeMin); }
  if (e.timeMax !== undefined) { ok(c.id, r.route.sec <= e.timeMax, 'time ' + Math.round(r.route.sec) + ' > ' + e.timeMax); }
  if (e.lifts) { ok(c.id, eqArr(r.route.lifts, e.lifts), 'lifts [' + r.route.lifts + '] != [' + e.lifts + ']'); }
  if (e.liftCount !== undefined) { ok(c.id, r.route.lifts.length === e.liftCount, 'liftCount ' + r.route.lifts.length + ' != ' + e.liftCount); }
  if (e.noStairs) {
    ok(c.id, st.every(function (s) { return s.type !== 'stairs' && s.type !== 'escalator'; }), 'route uses stairs');
  }
  if (e.hasStairs) {
    ok(c.id, st.some(function (s) { return s.type === 'stairs' || s.type === 'escalator'; }), 'route has no stairs');
  }
  if (e.stepsMin !== undefined) { ok(c.id, st.length >= e.stepsMin, 'steps ' + st.length + ' < ' + e.stepsMin); }
  if (e.stepsMax !== undefined) { ok(c.id, st.length <= e.stepsMax, 'steps ' + st.length + ' > ' + e.stepsMax); }
  if (e.floors) {
    const seen = st.reduce(function (acc, s) { return acc.concat([s.fromF, s.toF]); }, []);
    e.floors.forEach(function (f) { ok(c.id, seen.indexOf(f) >= 0, 'route never visits ' + f); });
  }
  if (e.landmark) {
    ok(c.id, st.some(function (s) { return s.landmark === e.landmark; }), 'landmark ' + e.landmark + ' not used');
  }
  if (e.textHas) {
    const lang = e.textHas.lang || 'en';
    const texts = st.map(function (s) { return I.stepText(s, lang); });
    ok(c.id, texts.some(function (t) { return t.indexOf(e.textHas.text) >= 0; }), 'no step text contains "' + e.textHas.text + '" in ' + lang);
  }
  if (e.altFasterThan !== undefined) {
    ok(c.id, !!r.plan.alternative && r.plan.alternative.sec < r.route.sec, 'expected a faster alternative');
    if (r.plan.alternative) {
      ok(c.id, Math.round(r.route.sec - r.plan.alternative.sec) >= e.altFasterThan, 'alternative saves too little');
    }
  }
  if (e.nearestIs) { ok(c.id, r.hit && r.hit.node.id === e.nearestIs, 'nearest ' + (r.hit && r.hit.node.id) + ' != ' + e.nearestIs); }
}

function runI18n(c) {
  const e = c.expect;
  if (e.allKeysTranslated) {
    Object.keys(I.DICT).forEach(function (k) {
      ['en', 'zh', 'yue'].forEach(function (l) {
        ok(c.id, !!I.DICT[k][l], 'missing ' + l + ' for ' + k);
      });
    });
  }
  if (e.floorName) {
    ok(c.id, I.floorName(e.floorName.f, e.floorName.lang) === e.floorName.expect, 'floorName mismatch');
  }
  if (e.duration) {
    ok(c.id, I.duration(e.duration.sec, e.duration.lang) === e.duration.expect, 'duration "' + I.duration(e.duration.sec, e.duration.lang) + '"');
  }
  if (e.stepTextDiffers) {
    const p = N.parse(c.q);
    const plan = R.plan(p.origin.node.id, p.dest.node.id, { stepFree: true });
    const st = S.build(plan.primary);
    const en = st.map(function (s) { return I.stepText(s, 'en'); }).join(' ');
    const zh = st.map(function (s) { return I.stepText(s, 'zh'); }).join(' ');
    const yue = st.map(function (s) { return I.stepText(s, 'yue'); }).join(' ');
    ok(c.id, en !== zh && zh !== yue && en !== yue, 'translations are identical');
    ok(c.id, en.indexOf('Lift') >= 0, 'English step text lost the lift name');
  }
}

function runData(c) {
  const e = c.expect;
  if (e.liftServes) {
    const core = C.coreById[e.liftServes.core];
    ok(c.id, (core.floors.indexOf(e.liftServes.floor) >= 0) === e.liftServes.expect, 'lift floor service mismatch');
  }
  if (e.everyRoomNamed) {
    C.ROOMS.forEach(function (r) {
      ['en', 'zh', 'yue'].forEach(function (l) { ok(c.id, !!r.names[l], r.id + ' missing ' + l); });
    });
  }
  if (e.everyBuildingLift) {
    Object.keys(C.FLOORS).forEach(function (b) {
      ok(c.id, C.CORES.some(function (x) { return x.b === b && x.kind === 'lift'; }), b + ' has no lift');
    });
  }
  if (e.nodeCount) {
    ok(c.id, C.nodes.length >= e.nodeCount, 'only ' + C.nodes.length + ' nodes');
  }
}

const started = Date.now();
const byGroup = {};

cases.forEach(function (c) {
  byGroup[c.group] = (byGroup[c.group] || 0) + 1;
  results[c.id] = { failed: 0 };
  if (c.group === 'nlu') { runNlu(c); }
  else if (c.group === 'route' || c.group === 'nearest') { runRoute(c); }
  else if (c.group === 'i18n') { runI18n(c); }
  else if (c.group === 'data') { runData(c); }
});

const ms = Date.now() - started;
const total = passed + failures.length;

console.log('');
failures.forEach(function (f) { console.log('  FAIL ' + f.id + '  ' + f.msg); });
console.log('');
console.log('cases: ' + cases.length + '   checks: ' + total + '   passed: ' + passed +
            '   failed: ' + failures.length + '   (' + ms + ' ms)');
console.log('groups: ' + JSON.stringify(byGroup));

/* ---- results file ---- */
const lines = [];
lines.push('# Test results');
lines.push('');
lines.push('Generated by `node tests/run_tests.js` on ' + new Date().toISOString().slice(0, 10) + '.');
lines.push('');
lines.push('| | |');
lines.push('|---|---|');
lines.push('| Test cases | ' + cases.length + ' |');
lines.push('| Assertions | ' + total + ' |');
lines.push('| Passed | ' + passed + ' |');
lines.push('| Failed | ' + failures.length + ' |');
lines.push('| Runtime | ' + ms + ' ms |');
lines.push('');
lines.push('Groups: ' + Object.keys(byGroup).map(function (k) { return k + ' (' + byGroup[k] + ')'; }).join(', ') + '.');
lines.push('');
lines.push('Reproduce with `node tests/run_tests.js` (and `node tests/check_graph.js` for the data checks).');
lines.push('');
lines.push('## Cases');
lines.push('');
lines.push('| # | case | group | input / target | result |');
lines.push('|---|---|---|---|---|');
cases.forEach(function (c, i) {
  var label = c.q ? c.q : (c.note || '');
  label = String(label).split('|').join('\|');
  if (label.length > 64) { label = label.slice(0, 61) + '...'; }
  var res = results[c.id] && results[c.id].failed ? 'FAIL' : 'pass';
  lines.push('| ' + (i + 1) + ' | `' + c.id + '` | ' + c.group + ' | ' + label + ' | ' + res + ' |');
});
lines.push('');
if (failures.length) {
  lines.push('## Failures');
  lines.push('');
  failures.forEach(function (f) { lines.push('- `' + f.id + '` ' + f.msg); });
} else {
  lines.push('All assertions passed.');
}
fs.writeFileSync(path.join(root, 'docs/TEST_RESULTS.md'), lines.join('\n') + '\n');

process.exit(failures.length === 0 ? 0 : 1);
