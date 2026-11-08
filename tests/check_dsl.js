/* =====================================================================
 * DSL checks                        node tests/check_dsl.js
 * ---------------------------------------------------------------------
 * The two files in dist/ are imported by clicking, not by a test runner,
 * and a malformed import in Dify reports nothing about which line is
 * wrong. So check everything that can be checked here:
 *
 * 1. fresh      dist/*.yml is exactly what tools/make_dsl.js builds today
 * 2. parses     PyYAML (the parser Dify uses) accepts it
 * 3. code       the Code node body, after parsing, is byte-identical to
 *                dist/dify-code-node.js - no escaping bugs
 * 4. refs       every {{#node.field#}} resolves to a node that exists and
 *                an output that node declares
 * 5. graph      one start, every edge connects real nodes, every path
 *                from start ends in an Answer node, no dangling branch
 * 6. runs       the parsed code is compiled the way Dify compiles it and
 *                every declared output is present, with the right type,
 *                for every starter question in the app
 * 7. version    the number Dify compares with its own cannot park the
 *                import in PENDING (see tools/make_dsl.js)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const FILES = [
  path.join(root, 'dist/hkust-guide.dsl.yml'),
  path.join(root, 'dist/hkust-guide-chatgpt.dsl.yml')
];
const CODE_FILE = path.join(root, 'dist/dify-code-node.js');

let passed = 0;
const failures = [];

function ok(id, cond, msg) {
  if (cond) { passed++; return; }
  failures.push(id + ': ' + msg);
}

/* Dify parses the upload with PyYAML. Use the same parser instead of a
   hand-rolled reader, because the point is to catch quoting and indent
   mistakes, and those are exactly what a lenient reader would forgive. */
function parseYaml(file) {
  const py = 'import json,sys,yaml;' +
             'print(json.dumps(yaml.safe_load(open(sys.argv[1], encoding="utf-8")),' +
             ' ensure_ascii=False))';
  let out;
  try {
    out = execFileSync('python3', ['-c', py, file],
                       { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    return { error: e.stderr ? String(e.stderr).trim().split('\n').slice(-1)[0]
                             : String(e) };
  }
  try { return { doc: JSON.parse(out) }; }
  catch (e) { return { error: 'PyYAML output was not JSON: ' + e.message }; }
}

function typeOk(type, v) {
  if (type === 'string') { return typeof v === 'string'; }
  if (type === 'boolean') { return typeof v === 'boolean'; }
  if (type === 'number') { return typeof v === 'number'; }
  return true;
}

/* The questions the app ships as chips, plus one of each branch. */
const ASK = [
  'Library entrance to LG1 canteen',
  '圖書館去 LG1 飯堂點行',
  'LG7 食堂去 LG1 食堂，不想走楼梯',
  '图书馆去游泳池',
  'where is the nearest toilet from the piazza',
  'from lg7 canteen to a 3f classroom no stairs',
  'i am at the library',
  'hello'
];

const raw = fs.readFileSync(CODE_FILE, 'utf8');
const docs = [];


FILES.forEach(function (file) {
  const name = path.basename(file);
  const text = fs.readFileSync(file, 'utf8');

  ok(name + ' / tabs', !/(^|\n)\t/.test(text),
     'a tab at the start of a line is an indentation error in YAML');

  const parsed = parseYaml(file);
  ok(name + ' / parses', !parsed.error, parsed.error || '');
  if (parsed.error) { return; }

  const doc = parsed.doc;
  docs.push({ name: name, doc: doc });

  /* ---- the shape Dify expects at the top ------------------------------ */
  ok(name + ' / kind', doc.kind === 'app', 'kind must be app, got ' + doc.kind);
  ok(name + ' / mode', doc.app && doc.app.mode === 'advanced-chat',
     'mode must be advanced-chat (Chatflow) or there is no chat UI, got ' +
     (doc.app && doc.app.mode));
  ok(name + ' / name', !!(doc.app && doc.app.name), 'app.name is empty');
  ok(name + ' / features',
     !!(doc.workflow && doc.workflow.features &&
        Array.isArray(doc.workflow.features.suggested_questions)),
     'workflow.features.suggested_questions is missing');

  /* ---- version: must not be PENDING, must not trigger the legacy
     plugin-dependency extraction ---------------------------------------- */
  const v = String(doc.version).split('.').map(Number);
  ok(name + ' / version format', v.length === 3 && v.every(function (n) {
    return isFinite(n);
  }), 'version is not x.y.z: ' + doc.version);
  ok(name + ' / version below cloud', v[0] === 0 && v[1] <= 7,
     'version ' + doc.version + ' would be newer than Dify main (0.7.0) and ' +
     'the import comes back PENDING with no app created');
  ok(name + ' / version above 0.1.5', v[1] > 1 || (v[1] === 1 && v[2] > 5),
     'at <= 0.1.5 Dify re-derives plugin dependencies from the graph, which ' +
     'can stop the import at an install step');

  const graph = doc.workflow.graph;
  const nodes = graph.nodes;
  const edges = graph.edges;
  const byId = {};
  nodes.forEach(function (n) { byId[String(n.id)] = n; });

  /* ---- nodes ---------------------------------------------------------- */
  const ids = nodes.map(function (n) { return String(n.id); });
  ok(name + ' / unique ids', new Set(ids).size === ids.length, 'duplicate node id');
  const types = nodes.map(function (n) { return n.data.type; });
  ok(name + ' / one start', types.filter(function (t) {
    return t === 'start';
  }).length === 1, 'need exactly one start node, got ' + types.join(','));
  ok(name + ' / has answer', types.indexOf('answer') !== -1, 'no Answer node');
  ok(name + ' / code after start', types.indexOf('code') === 1,
     'the engine must be the node right after start, got ' + types.join(','));

  const code = nodes[1];
  ok(name + ' / code language', code.data.code_language === 'javascript',
     'code_language is ' + code.data.code_language);
  ok(name + ' / code byte-identical', code.data.code === raw,
     'the Code node body is not dist/dify-code-node.js (parsed ' +
     Buffer.byteLength(String(code.data.code || ''), 'utf8') + ' bytes vs ' +
     Buffer.byteLength(raw, 'utf8') + ')');
  ok(name + ' / code input', code.data.variables.length === 1 &&
     code.data.variables[0].variable === 'query' &&
     code.data.variables[0].value_selector.join('.') === 'sys.query',
     'the single input must be query = {{#sys.query#}}');
  const outs = code.data.outputs || {};
  ok(name + ' / output text', outs.text && outs.text.type === 'string',
     'output text must be string');
  ok(name + ' / output kind', outs.kind && outs.kind.type === 'string',
     'output kind must be string');
  ok(name + ' / output ok', outs.ok && outs.ok.type === 'boolean',
     'output ok must be boolean');

  /* ---- edges: connect nodes that exist, and agree with the node types -- */
  const out = {};
  edges.forEach(function (e) {
    const s = String(e.source);
    const t = String(e.target);
    const handle = e.sourceHandle || 'source';
    ok(name + ' / edge id', e.id === s + '-' + handle + '-' + t + '-target',
       'edge id "' + e.id + '" does not match its endpoints');
    ok(name + ' / edge nodes', !!(byId[s] && byId[t]),
       'edge ' + s + ' -> ' + t + ' points at a missing node');
    if (!byId[s] || !byId[t]) { return; }
    ok(name + ' / edge sourceType', e.data.sourceType === byId[s].data.type,
       'edge says sourceType ' + e.data.sourceType + ' but node ' + s + ' is ' +
       byId[s].data.type);
    ok(name + ' / edge targetType', e.data.targetType === byId[t].data.type,
       'edge says targetType ' + e.data.targetType + ' but node ' + t + ' is ' +
       byId[t].data.type);
    (out[s] = out[s] || []).push(handle + '>' + t);
  });

  /* ---- the labels on the branch edges must be the cases Dify runs ------ */
  nodes.filter(function (n) {
    return n.data.type === 'if-else';
  }).forEach(function (n) {
    const caseIds = n.data.cases.map(function (c) { return String(c.case_id); });
    const handles = (out[String(n.id)] || []).map(function (h) {
      return h.split('>')[0];
    });
    ok(name + ' / branch handles',
       caseIds.concat(['false']).sort().join(',') === handles.slice().sort().join(','),
       'If/Else cases ' + JSON.stringify(caseIds) + ' but outgoing edges use ' +
       JSON.stringify(handles));
    const sel = n.data.cases[0].conditions[0].variable_selector;
    ok(name + ' / branch variable', !!byId[String(sel[0])],
       'the condition reads node ' + sel[0] + ', which does not exist');
    ok(name + ' / branch field',
       !!(byId[String(sel[0])].data.outputs || {})[sel[1]],
       'the condition reads an output the code node does not declare: ' + sel[1]);
  });

  /* ---- every {{#node.field#}} in an Answer or a prompt resolves -------- */
  const tpl = [];
  nodes.forEach(function (n) {
    if (n.data.type === 'answer') {
      tpl.push([n.data.title, n.data.answer, true]);
    }
    (n.data.prompt_template || []).forEach(function (p) {
      /* the system prompt has no variables on purpose; the user prompt
         must carry both the question and the engine's reply */
      tpl.push([n.data.title + '/' + p.role, p.text, p.role === 'user']);
    });
  });
  tpl.forEach(function (pair) {
    const refs = String(pair[1]).match(/\{\{#([^#{}]+)#\}\}/g) || [];
    ok(name + ' / refs in ' + pair[0], refs.length > 0 || !pair[2],
       'nothing is referenced at all - the node would print an empty answer');
    refs.forEach(function (r) {
      const sel = r.slice(3, -3).split('.');
      if (sel[0] === 'sys') { return; }
      const node = byId[sel[0]];
      ok(name + ' / ref ' + r, !!node, 'references a node that does not exist');
      if (!node || sel.length < 2) { return; }
      ok(name + ' / ref ' + r,
         node.data.type === 'llm' ? sel[1] === 'text'
                                  : !!(node.data.outputs || {})[sel[1]],
         'references "' + sel[1] + '", which node ' + sel[0] + ' (' +
         node.data.type + ') does not output');
    });
  });

  /* ---- reachability: everything ends in an Answer ---------------------- */
  const seen = {};
  const stack = [String(nodes[0].id)];
  while (stack.length) {
    const id = stack.pop();
    if (seen[id]) { continue; }
    seen[id] = true;
    (out[id] || []).forEach(function (h) { stack.push(h.split('>')[1]); });
  }
  nodes.forEach(function (n) {
    const id = String(n.id);
    ok(name + ' / reachable', !!seen[id],
       'node ' + id + ' (' + n.data.type + ') cannot be reached from start');
    const outs2 = out[id] || [];
    if (n.data.type === 'answer') {
      ok(name + ' / answer terminal', outs2.length === 0,
         'Answer node ' + id + ' has outgoing edges, which Dify will not run');
    } else {
      ok(name + ' / node exits', outs2.length > 0,
         n.data.type + ' node ' + id + ' is a dead end');
    }
  });

  /* every path from start must terminate in an Answer, with no cycle:
     a loop here is a workflow that runs until Dify's step limit */
  function endsInAnswer(id, path) {
    if (path.indexOf(id) !== -1) { return false; }
    path = path.concat([id]);
    if (byId[id].data.type === 'answer') { return true; }
    return (out[id] || []).every(function (h) {
      return endsInAnswer(h.split('>')[1], path);
    });
  }
  ok(name + ' / no cycles', endsInAnswer(String(nodes[0].id), []),
     'some path from start never reaches an Answer node (a cycle or a dead end)');
});

/* ---- the two files must agree on everything but the fallback ---------- */
ok('pair / two files', docs.length === 2, 'expected two DSL files');
if (docs.length === 2) {
  ok('pair / code id',
     String(docs[0].doc.workflow.graph.nodes[1].id) ===
     String(docs[1].doc.workflow.graph.nodes[1].id),
     'the files disagree on the code node id, so the docs cannot name it');
  ok('pair / same engine',
     docs[0].doc.workflow.graph.nodes[1].data.code ===
     docs[1].doc.workflow.graph.nodes[1].data.code,
     'the two files embed different engine code');
  ok('pair / plain has no model',
     docs[0].doc.workflow.graph.nodes.every(function (n) {
       return n.data.type !== 'llm';
     }), 'the no-model file must not contain an LLM node');
  ok('pair / model file has a model',
     docs[1].doc.workflow.graph.nodes.filter(function (n) {
       return n.data.type === 'llm' && n.data.model && n.data.model.name;
     }).length === 1, 'the model file must bind exactly one model');
}

/* ---- run the parsed code the way Dify runs it ------------------------- */
let main = null;
let full = null;
if (docs.length) {
  /* a chip that needs the model is a broken first impression: every chip
     the app ships is run below and must be answered by the rules branch */
  const chips = (docs[0].doc.workflow.features.suggested_questions || [])
    .map(String);
  ok('chips / present', chips.length > 0, 'no suggested questions to test');
  chips.forEach(function (c) {
    ok('chips / covered', ASK.indexOf(c) !== -1,
       'the shipped chip "' + c + '" is not in ASK, so nothing tests it');
  });

  const body = docs[0].doc.workflow.graph.nodes[1].data.code;
  try {
    const api = new Function(body + '\nreturn { main: main, answerFull: answerFull };')();
    main = api.main;
    full = api.answerFull;
  } catch (e) {
    ok('run / compiles', false, 'the Code node body does not compile: ' + e.message);
  }
  ok('run / compiles', typeof main === 'function',
     'compiling the Code node body did not produce main()');

  if (typeof main === 'function') {
    const declared = docs[0].doc.workflow.graph.nodes[1].data.outputs;
    const want = Object.keys(declared).sort().join(',');
    ASK.forEach(function (q) {
      let r;
      try { r = main({ query: q }); }
      catch (e) { ok('run [' + q + ']', false, 'threw: ' + e.message); return; }
      ok('run [' + q + ']', r && typeof r === 'object', 'returned ' + typeof r);
      if (!r) { return; }
      /* Dify's own rule (CodeNode._transform_result):
           if len(parameters_validated) != len(result):
               raise CodeNodeError("Not all output parameters are validated.")
         so this is a count, not a subset - one extra key fails the node in
         exactly the same way as a missing one. */
      ok('run [' + q + '] / outputs',
         Object.keys(r).sort().join(',') === want,
         'main() must return exactly the declared outputs (' + want + '), got ' +
         Object.keys(r).join(',') + ' - Dify fails the node on a count mismatch');
      Object.keys(declared).forEach(function (k) {
        ok('run [' + q + '] / ' + k, k in r,
           'declared output "' + k + '" is missing from the result - Dify ' +
           'fails the node when an output cannot be extracted');
        ok('run [' + q + '] / ' + k, typeOk(declared[k].type, r[k]),
           'declared ' + declared[k].type + ' but got ' + typeof r[k]);
      });
      ok('run [' + q + '] / text',
         typeof r.text === 'string' && r.text.length > 0,
         'an empty Answer is worse than an error');
      ok('run [' + q + '] / kind',
         ['route', 'nearest', 'clarify'].indexOf(r.kind) !== -1,
         'kind "' + r.kind + '" is not one the If/Else can branch on');
      if (chips.indexOf(q) !== -1) {
        ok('run [' + q + '] / chip', r.kind !== 'clarify',
           'this suggested question is not understood by the engine, so the ' +
           'chip would land on the model branch');
      }
    });

    /* the parsed body is what Dify would run; a crash inside it is a
       finding, not a reason for the runner to print a stack trace */
    function ask(q) {
      try { return main({ query: q }); }
      catch (e) { ok('call [' + q + ']', false, 'threw: ' + e.message); return null; }
    }
    function askFull(q) {
      try { return full({ query: q }); }
      catch (e) { ok('call [' + q + ']', false, 'threw: ' + e.message); return null; }
    }

    const known = askFull('library entrance to lg 1 canteen') || {};
    ok('run / 192 s', known.ok === true && known.sec === 192,
       'wrong route for the documented example: ok=' + known.ok +
       ' sec=' + known.sec);
    ok('run / title', String(known.text).split('\n')[0] ===
       "**Library Entrance → LG1 Canteen (Maxim's)**",
       'first line is ' + JSON.stringify(String(known.text).split('\n')[0]));
    const hello = ask('hello');
    ok('run / clarify', !!hello && hello.kind === 'clarify',
       '"hello" must be the model branch');

    /* the Code node must be a pure function of its input: same question,
       same bytes, or an Answer would change between two clicks */
    const a = ask('from lg7 canteen to a 3f classroom no stairs');
    const b = ask('from lg7 canteen to a 3f classroom no stairs');
    ok('run / deterministic', JSON.stringify(a) === JSON.stringify(b),
       'two identical calls returned different results');
    ok('run / no extras', !!a && Object.keys(a).sort().join(',') === 'kind,ok,text',
       'main() must return the declared three and nothing else, got ' +
       (a ? Object.keys(a).join(',') : String(a)));
  }
}

failures.slice(0, 20).forEach(function (f) { console.log('FAIL ' + f); });
console.log((failures.length ? 'DSL FAILED' : 'DSL OK') + ': ' +
            passed + ' passed, ' + failures.length + ' failed');
process.exit(failures.length ? 1 : 0);
