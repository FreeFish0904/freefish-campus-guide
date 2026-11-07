/* Data self-check: run with `node tests/check_graph.js`
   Verifies both hand-written campus specs (the fictional demo campus and
   HKUST) before any UI depends on them, using the same checks. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { checkCampus } = require('./check_campus');

const root = path.join(__dirname, '..');
const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
['src/data/graph.js', 'src/data/campus.js', 'src/data/campus.ust.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});

const CAMPUSES = [
  ['demo', sandbox.FUST.CampusDemo],
  ['ust', sandbox.FUST.CampusUST]
];

let fails = 0;

CAMPUSES.forEach(([label, C]) => {
  console.log('\n== ' + label + ' (' + C.id + ')');
  console.log('nodes=' + C.nodes.length + '  edges=' + C.edges.length +
    '  rooms=' + C.ROOMS.length + '  levels=' + C.LEVELS.length);

  const kinds = {};
  C.edges.forEach(e => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
  console.log('edge kinds: ' + JSON.stringify(kinds));

  const res = checkCampus(C, label);
  console.log('step-free reach: ' + (C.nodes.length - res.notStepFree.length) + '/' + C.nodes.length +
    (res.notStepFree.length ? '  (not step-free: ' + res.notStepFree.map(n => n.id).join(', ') + ')' : ''));

  if (res.problems.length) {
    fails += res.problems.length;
    res.problems.slice(0, 25).forEach(p => console.log('  FAIL ' + p));
    if (res.problems.length > 25) console.log('  ... ' + (res.problems.length - 25) + ' more');
  } else {
    console.log('OK - all checks passed');
  }
});

console.log(fails === 0 ? '\nDATA OK - both campuses pass' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails === 0 ? 0 : 1);
