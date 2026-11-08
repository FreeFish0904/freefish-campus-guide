/* =====================================================================
 * Build dist/dify-engine.js
 * ---------------------------------------------------------------------
 *     node tools/bundle_engine.js [--check]
 *
 * The app is plain <script> tags, so "bundling" is just concatenation in
 * load order plus one glue file (tools/engine_api.js). That is deliberate:
 * the Dify Code node then runs *the same code* the browser runs, not a
 * re-implementation that can drift.
 *
 * Load order is the one in index.html:
 *   graph.js            makes buildCampus()
 *   campus.ust.js       builds the HKUST spec
 *   active.js           picks FUST.Campus from ?data= (absent -> ust)
 *   i18n / router / steps / nlu   all capture FUST.Campus at load time,
 *                                 so they must come after active.js
 *   engine_api.js       the Engine wrapper (parse / route / answer)
 *
 * --check rebuilds in memory and exits 1 if dist/ is stale, without writing.
 *
 * After a rebuild, run `node tools/make_dsl.js`: it re-embeds the new
 * dist/dify-code-node.js in the two importable DSL files.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');

const SOURCES = [
  'src/data/graph.js',
  'src/data/campus.ust.js',
  'src/data/active.js',
  'src/i18n.js',
  'src/router.js',
  'src/steps.js',
  'src/nlu.js'
];

const API = 'tools/engine_api.js';
const OUT = path.join(root, 'dist/dify-engine.js');
const OUT_MIN = path.join(root, 'dist/dify-engine.min.js');
const OUT_NODE = path.join(root, 'dist/dify-code-node.js');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/\s+$/, '') + '\n';
}

/* The version is a hash of the exact inputs, so a stale dist/ is provable:
   tests/check_bundle.js rebuilds and compares. */
function version() {
  const h = crypto.createHash('sha1');
  SOURCES.concat([API]).forEach(function (rel) {
    h.update(rel + '\n' + read(rel));
  });
  return h.digest('hex').slice(0, 12);
}

const GUARD = [
  '  /* A server sandbox has no `location`, so active.js falls through to',
  '     the real campus anyway; this line only says so out loud. */',
  '  if (!root.FUST.Campus) { root.FUST.Campus = root.FUST.CampusUST; }',
  ''
].join('\n');

function build() {
  const v = version();
  return (
    '/* =====================================================================\n' +
    ' * Dify engine - GENERATED FILE, do not edit.\n' +
    ' *\n' +
    ' *   node tools/bundle_engine.js\n' +
    ' *\n' +
    ' * Sources (in load order): ' + SOURCES.concat([API]).join(', ') + '\n' +
    ' * Engine version: ' + v + '\n' +
    ' *\n' +
    ' * Standalone: run it and it hands you globalThis.Engine (and returns it).\n' +
    ' * For a Dify Code node use dist/dify-code-node.js instead - same code,\n' +
    ' * already wrapped in the function main(inputs) a Code node expects.\n' +
    ' * ===================================================================== */\n' +
    '(function () {\n' +
    "  'use strict';\n\n" +
    "  var root = (typeof globalThis !== 'undefined') ? globalThis : this;\n" +
    '  root.FUST = root.FUST || {};\n' +
    body(v) +
    '\n  return root.Engine;\n' +
    '})();\n'
  );
}

function body(v) {
  const parts = [];
  SOURCES.forEach(function (rel) {
    parts.push('\n  /* ---- ' + rel + ' ---- */\n');
    parts.push(read(rel).replace(/^/gm, '  ').replace(/^ {2}$/gm, ''));
    if (rel === 'src/data/active.js') { parts.push('\n' + GUARD); }
    if (rel === SOURCES[SOURCES.length - 1]) { parts.push('\n'); }
  });
  parts.push('\n  /* ---- ' + API + ' ---- */\n');
  parts.push(read(API).replace(/__ENGINE_VERSION__/g, v).replace(/^/gm, '  ').replace(/^ {2}$/gm, ''));
  return parts.join('');
}

/* Whole-line comments and indentation only. Nothing is removed from inside
   a line, so a string that happens to contain "//" (a URL, a room code)
   cannot be mangled - the saving comes from the 3-6 spaces per line and
   the block comments above every function. */
function minify(src) {
  const out = [];
  let inBlock = false;
  src.split('\n').forEach(function (line) {
    const t = line.trim();
    if (inBlock) {
      if (t.indexOf('*/') >= 0) { inBlock = false; }
      return;
    }
    if (t.indexOf('/*') === 0) {
      if (t.indexOf('*/') < 0) { inBlock = true; }
      return;
    }
    if (t.indexOf('//') === 0) { return; }
    if (!t) { return; }
    out.push(t);
  });
  return out.join('\n') + '\n';
}

function kb(s) { return (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1) + ' KB'; }

/* The exact text a Dify JavaScript Code node wants: everything evaluated
   once, `main(inputs)` returns the object Dify can accept. `var __ENGINE`
   at the top of the node file means the 90 KB of data is parsed on the
   first call and reused after that (a Code node is a cached module, but
   this also works if a sandbox re-evaluates it every time).

   `main` returns exactly three keys, not the whole answer: CodeNode.
   _transform_result counts them (api/core/workflow/nodes/code/code_node.py)

       # check if all output parameters are validated
       if len(parameters_validated) != len(result):
           raise CodeNodeError("Not all output parameters are validated.")

   and Engine.answer() returns 21 keys for a route but 12 for a clarify, so
   no fixed output list can ever match it. Three declared, three returned. */
function nodeCode() {
  const v = version();
  const src = minify(body(v));
  return [
    '/* =====================================================================',
    ' * Dify Code node (JavaScript) - GENERATED FILE, do not edit.',
    ' *   node tools/bundle_engine.js',
    ' * Engine version: ' + v,
    ' *',
    ' * Declare these as the node inputs:',
    ' *   query     string   what the user typed',
    ' *   lang      string   en | zh | yue | auto',
    ' *   stepFree  boolean  the toggle (optional)',
    ' *   originId  string   place id from an earlier turn (optional)',
    ' *   destId    string   place id from an earlier turn (optional)',
    ' *',
    ' * Declare exactly these three outputs - Dify compares the count with the',
    ' * keys main() returns and fails the node with',
    ' *   "Not all output parameters are validated."',
    ' * if they differ:',
    ' *   text      string   the answer, markdown, in the language asked',
    ' *   kind      string   route | nearest | clarify   <- branch on this',
    ' *   ok        boolean  true when a route or a nearest POI was found',
    ' * ===================================================================== */',
    'var __ENGINE = null;',
    '',
    'function __boot() {',
    '  if (__ENGINE) { return __ENGINE; }',
    '  __ENGINE = (function () {',
    "    var root = (typeof globalThis !== 'undefined') ? globalThis : this;",
    '    root.FUST = root.FUST || {};',
    src.replace(/^/gm, '    ').replace(/^ +$/gm, ''),
    '    return root.Engine;',
    '  }).call({});',
    '  return __ENGINE;',
    '}',
    '',
    'function main(inputs) {',
    '  var r = answerFull(inputs);',
    '  return {',
    "    text: String(r.text == null ? '' : r.text),",
    "    kind: String(r.kind == null ? 'clarify' : r.kind),",
    '    ok: r.ok === true',
    '  };',
    '}',
    '',
    "/* main()'s input mapping, with the whole answer object left intact.",
    '   Dify never reaches this - the outputs would not match - but the tests',
    '   use it to see lang / stepFree / originId / destId. */',
    'function answerFull(inputs) {',
    '  inputs = inputs || {};',
    "  var lang = inputs.lang || 'auto';",
    '  var stepFree = inputs.stepFree;',
    "  return __boot().answer(String(inputs.query === undefined ? '' : inputs.query), {",
    "    lang: (lang === 'en' || lang === 'zh' || lang === 'yue') ? lang : '',",
    "    stepFree: !(stepFree === false || stepFree === 'false'),",
    '    originId: inputs.originId || null,',
    '    destId: inputs.destId || null',
    '  });',
    '}',
    ''
  ].join('\n');
}

module.exports = { build, body, version, minify, nodeCode,
                   SOURCES, API, OUT, OUT_MIN, OUT_NODE, root };

if (require.main === module) {
  const src = build();
  const min = minify(src);
  const node = nodeCode();
  const check = process.argv.indexOf('--check') >= 0;

  if (check) {
    const pairs = [[OUT, src], [OUT_MIN, min], [OUT_NODE, node]];
    let ok = true;
    pairs.forEach(function (p) {
      const have = fs.existsSync(p[0]) ? fs.readFileSync(p[0], 'utf8') : '';
      if (have !== p[1]) { ok = false; }
      console.log((have === p[1] ? 'up to date  ' : 'STALE       ') +
                  path.relative(root, p[0]));
    });
    console.log('engine version ' + version());
    process.exit(ok ? 0 : 1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, src);
  fs.writeFileSync(OUT_MIN, min);
  fs.writeFileSync(OUT_NODE, node);
  console.log('wrote dist/dify-engine.js      ' + kb(src));
  console.log('wrote dist/dify-engine.min.js  ' + kb(min));
  console.log('wrote dist/dify-code-node.js   ' + kb(node) + '   <- paste into the Code node');
  console.log('engine version ' + version());
}
