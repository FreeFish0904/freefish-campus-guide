/* Loads the browser-side modules into a sandbox so tests can run in Node
   without a bundler (the app itself is plain <script> tags). */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

const FILES = [
  'src/data/graph.js',
  'src/data/campus.js',
  'src/i18n.js',
  'src/router.js',
  'src/steps.js',
  'src/nlu.js',
  'src/data/scenarios.js'
];

function load() {
  const sandbox = {};
  vm.createContext(sandbox);
  FILES.forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
  });
  return sandbox.FUST;
}

module.exports = { load: load, root: root };
