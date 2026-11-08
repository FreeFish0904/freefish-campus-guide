/* =====================================================================
 * Hostile-sandbox checks            node tests/check_sandbox.js
 * ---------------------------------------------------------------------
 * check_bundle.js proves the engine is right. This proves it survives the
 * box it will be dropped into: Dify runs a Code node somewhere we cannot
 * see, and every difference between that box and Node-on-a-laptop is a
 * way the demo can fail in front of a grader. So load the exact file that
 * gets pasted and treat it badly:
 *
 * 1. strict    loaded behind "use strict", in case the sandbox wraps it
 * 2. bare      a context with no console, no window, no process
 * 3. shapes    whatever Dify hands over as `inputs` - undefined, null, a
 *              number, an object, 20 000 characters of Chinese
 * 4. limits    output depth <= 5, <= 400 000 characters, plain JSON
 * 5. truth     deterministic: the same question twice, byte for byte
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const NODE_FILE = path.join(root, 'dist/dify-code-node.js');
const ENGINE_FILE = path.join(root, 'dist/dify-engine.js');

let passed = 0;
const failures = [];

function ok(id, cond, msg) {
  if (cond) { passed++; return true; }
  failures.push(id + ': ' + msg);
  return false;
}

function depthOf(v, n) {
  if (!v || typeof v !== 'object') { return n; }
  const keys = Object.keys(v);
  if (!keys.length) { return n; }
  return Math.max.apply(null, keys.map(function (k) { return depthOf(v[k], n + 1); }));
}

function hasUndefined(v, seen) {
  if (!v || typeof v !== 'object') { return false; }
  seen = seen || [];
  if (seen.indexOf(v) >= 0) { return false; }
  seen.push(v);
  return Object.keys(v).some(function (k) {
    return v[k] === undefined || hasUndefined(v[k], seen);
  });
}

/* A Code node context: the language, and nothing else. `console` is deleted
   because some sandboxes only give you a logger object, and a stray
   console.log at load time would then be a ReferenceError, not a log line. */
function loadNode() {
  const ctx = vm.createContext({});
  vm.runInContext('delete globalThis.console;', ctx);
  const src = '"use strict";\n' + fs.readFileSync(NODE_FILE, 'utf8');
  vm.runInContext(src, ctx, { filename: 'dify-code-node.js' });
  return ctx;
}

const ctx = loadNode();


/* ---- 1. the box ------------------------------------------------------ */

ok('strict', typeof ctx.main === 'function',
   'dify-code-node.js must define main() even when evaluated strictly');
ok('strict', typeof ctx.console === 'undefined', 'the probe context really has no console');
ok('strict', ctx.__ENGINE === null,
   'nothing may be built at load time - a Code node pays that cost per request');

const main = ctx.main;
const full = ctx.answerFull;
if (typeof main !== 'function') {
  console.log('SANDBOX FAILED: no main() in dist/dify-code-node.js');
  process.exit(1);
}
ok('strict', typeof full === 'function',
   'answerFull() is the input mapping without main()\'s output filter; the ' +
   'tests read lang / stepFree / originId / destId from it');

/* ---- 2. a real question ---------------------------------------------- */

const t0 = process.hrtime.bigint();
const cold = main({ query: '圖書館去 LG1 飯堂點行', lang: 'auto' });
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
const a = full({ query: '圖書館去 LG1 飯堂點行', lang: 'auto' });

ok('answer', a.ok === true && a.toId === 'ust-lg1-canteen', 'expected LG1 canteen, got ' + a.toId);
ok('answer', a.sec === 192 && a.lifts.length === 0,
   'expected 192 s and no lift, got ' + a.sec + ' s / ' + a.lifts.join(','));
ok('answer', ms < 1000,
   'a cold answer took ' + Math.round(ms) + ' ms');

/* ---- 2b. exactly the outputs the node declares ------------------------ */
/* CodeNode._transform_result counts the keys main() returns against the
   outputs the node declares and fails the run with "Not all output
   parameters are validated." when the two differ. Engine.answer() returns
   21 keys for a route but 12 for a clarify, so main() must reduce it to
   the declared three on every branch - that is the contract a pasted node
   actually has to keep, and the one that broke the first import. */
[['route', { query: 'library entrance to lg 1 canteen' }],
 ['nearest', { query: 'nearest toilet', originId: 'ust-lg7-canteen' }],
 ['clarify', { query: '' }]].forEach(function (c) {
  const r = main(c[1]);
  ok('shape', r.kind === c[0] && Object.keys(r).sort().join(',') === 'kind,ok,text',
     c[0] + ' must return exactly text/kind/ok, got ' + Object.keys(r).join(','));
  ok('shape', typeof r.text === 'string' && typeof r.kind === 'string' &&
              typeof r.ok === 'boolean',
     c[0] + ' output types must be string / string / boolean');
});

/* ---- 3. what Dify may hand us as inputs ------------------------------ */

const EDGE = [
  ['undefined query', undefined],
  ['undefined inputs', null],
  ['null query', { query: null }],
  ['number query', { query: 42 }],
  ['empty query', { query: '' }],
  ['object query', { query: { a: 1 } }],
  ['20000 characters', { query: '图'.repeat(20000) }],
  ['script tag', { query: '<script>alert(1)</script> library' }],
  ['emoji', { query: '图书馆 🚀 去 LG1 食堂' }],
  ['lang as a number', { query: 'library to lg1 canteen', lang: 7 }],
  ['extra unknown inputs', { query: 'library to lg1 canteen', foo: { bar: [1, 2] } }]
];

EDGE.forEach(function (e) {
  let r = null;
  let err = null;
  try { r = main(e[1]); } catch (x) { err = x; }
  const shaped = r && typeof r === 'object' && typeof r.text === 'string' &&
                 r.text.length > 0 && typeof r.ok === 'boolean' &&
                 typeof r.kind === 'string';
  ok('input', !err && !!shaped,
     e[0] + (err ? ' threw ' + err.message : ' returned ' + JSON.stringify(r).slice(0, 120)));
});


/* ---- 4. the limits a Code node enforces ------------------------------ */

ok('limits', depthOf(cold, 1) <= 5, 'main() nests ' + depthOf(cold, 1) + ' deep; Dify allows 5');
ok('limits', !hasUndefined(cold),
   'main() must never return undefined - it would vanish in transit and the ' +
   'key count would then not match the declared outputs');
ok('limits', depthOf(a, 1) <= 5, 'the answer object nests ' + depthOf(a, 1) + ' deep; Dify allows 5');
ok('limits', a.text.length <= 400000,
   'the answer text is ' + a.text.length + ' characters; Dify allows 400 000');
ok('limits', !hasUndefined(a),
   'undefined values do not survive a JSON round-trip into the node output');

let roundTrip = null;
try { roundTrip = JSON.parse(JSON.stringify(a)); } catch (x) { roundTrip = null; }
ok('limits', !!roundTrip && JSON.stringify(roundTrip) === JSON.stringify(a),
   'the answer must survive JSON.stringify/parse unchanged');

/* ---- 5. determinism -------------------------------------------------- */

ok('truth', JSON.stringify(full({ query: '圖書館去 LG1 飯堂點行' })) === JSON.stringify(a),
   'the same question must give the same bytes twice - no Date.now, no Math.random');
ok('truth', JSON.stringify(main({ query: '圖書館去 LG1 飯堂點行' })) === JSON.stringify(cold),
   'main() must be just as repeatable');

const inputs = { query: 'library to lg7 canteen' };
const before = JSON.stringify(inputs);
main(inputs);
ok('truth', JSON.stringify(inputs) === before,
   'main() must not mutate the inputs object Dify owns');

/* ---- 6. the switches the If/Else branch depends on ------------------- */

ok('switch', full({ query: 'from lg7 canteen to a 3f classroom', stepFree: false }).stepFree === false,
   'stepFree:false must reach the router as false');
ok('switch', full({ query: 'from lg7 canteen to a 3f classroom', stepFree: 'false' }).stepFree === false,
   "Dify may deliver booleans as the string 'false'");
const sfOn = full({ query: 'library to lsk canteen' });
const sfOff = full({ query: 'library to lsk canteen', stepFree: false });
ok('switch', sfOn.sec > sfOff.sec,
   'step-free must cost time where stairs exist: ' + sfOn.sec + ' s vs ' + sfOff.sec + ' s');

ok('switch', full({ query: '图书馆去LG1食堂', lang: 'en' }).lang === 'en',
   'an explicit lang must win over the script the text is written in');
ok('switch', full({ query: '图书馆去LG1食堂', lang: '' }).lang === 'zh',
   "an empty lang must fall back to detection ('' is what an unfilled Dify input looks like)");

const turn1 = full({ query: 'I am at the library entrance' });
ok('switch', turn1.kind === 'nearest' && turn1.originId === 'ust-lib-entrance',
   'a first turn with only a place must still yield an originId, got ' +
   turn1.kind + ' / ' + turn1.originId);
const turn2 = full({ query: 'lg1 canteen', originId: turn1.originId, destId: turn1.destId });
ok('switch', turn2.ok === true && turn2.toId === 'ust-lg1-canteen',
   'a destId carried from an earlier turn must be honoured, got ' + turn2.toId);

/* ---- report ---------------------------------------------------------- */

/* Engine leaks onto the sandbox global on the first answer (that is how the
   bundle shares one campus between files); harmless in a throwaway context,
   but it must not be there before the first call. It is not: `__ENGINE` was
   still null above, so a Code node does no work at import time. */
ok('entry', typeof ctx.Engine === 'object',
   'after the first call the shared Engine object exists - expected, it is how the files share state');
const engineCtx = vm.createContext({});
vm.runInContext(fs.readFileSync(ENGINE_FILE, 'utf8'), engineCtx,
                { filename: 'dist/dify-engine.js' });
ok('entry', typeof engineCtx.Engine === 'object' && typeof engineCtx.main === 'undefined',
   'dist/dify-engine.js is the unwrapped engine - it has Engine and no main()');

failures.slice(0, 20).forEach(function (f) { console.log('FAIL ' + f); });
console.log((failures.length ? 'SANDBOX FAILED' : 'SANDBOX OK') + ': ' +
            passed + ' passed, ' + failures.length + ' failed' +
            '  (cold answer ' + Math.round(ms) + ' ms)');
process.exit(failures.length ? 1 : 0);
