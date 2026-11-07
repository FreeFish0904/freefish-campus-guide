/* Data self-check: run with `node tests/check_graph.js`
   Verifies both hand-written campus specs (the fictional demo campus and
   HKUST) before any UI depends on them, using the same checks. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { checkCampus, checkTasks } = require('./check_campus');

const root = path.join(__dirname, '..');
const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
['src/data/graph.js', 'src/data/campus.js', 'src/data/campus.ust.js', 'src/data/tasks.js'].forEach(f => {
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

/* the checklist names places on the HKUST map, so it is checked against
   that campus - a task pointing at a room that does not exist would give
   the user a "Go" button that goes nowhere */
if (sandbox.FUST.Tasks) {
  const T = sandbox.FUST.Tasks;
  console.log('\n== newcomer checklist');
  console.log('tasks=' + T.items.length + '  groups=' + T.groups.length + '  tips=' + T.tips.length);
  const tr = checkTasks(T, sandbox.FUST.CampusUST);
  if (tr.problems.length) {
    fails += tr.problems.length;
    tr.problems.slice(0, 25).forEach(p => console.log('  FAIL ' + p));
  } else {
    console.log('OK - all checks passed');
  }
}

console.log(fails === 0 ? '\nDATA OK - both campuses pass' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails === 0 ? 0 : 1);
