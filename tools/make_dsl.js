/* =====================================================================
 * Build the importable Dify DSL files
 * ---------------------------------------------------------------------
 *     node tools/make_dsl.js [--check]
 *
 * Dify can import an app from a YAML file (Studio -> Import DSL), which
 * skips the eight-node hand-build in docs/DIFY.md entirely. Two files,
 * because the one thing a DSL cannot decide for you is which model your
 * workspace actually has:
 *
 *   dist/hkust-guide.dsl.yml           3 nodes, no model at all
 *   dist/hkust-guide-chatgpt.dsl.yml   6 nodes, rules branch + model fallback
 *
 * Both embed dist/dify-code-node.js verbatim as the Code node body, so the
 * imported app runs the same engine the browser runs - the whole point of
 * the bundle. tests/check_dsl.js parses these files with PyYAML, compares
 * the parsed code with the file on disk byte for byte, and then executes it.
 *
 * ON `version:`
 * Dify compares an imported DSL version with its own
 * (api/services/dsl_version.py):
 *
 *     imported > current       -> PENDING  (nothing is created; the payload
 *                                           is parked in Redis instead)
 *     different major          -> PENDING
 *     lower minor              -> COMPLETED_WITH_WARNINGS
 *     equal                    -> COMPLETED
 *
 * Dify's main branch declares 0.7.0. Cloud may lag, and PENDING means the
 * import silently does not happen, so we write 0.2.0: low enough to be <=
 * whatever Cloud runs. It is also above 0.1.5, the cut-off below which
 * Dify re-derives plugin dependencies from the graph
 * (`_extract_dependencies_from_workflow_graph`) and can stop at an
 * "install these plugins" step naming a model provider we cannot know.
 * There is no per-version migration code, so the number only affects that
 * status check - the node shape below is the current one.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const CODE_FILE = path.join(root, 'dist/dify-code-node.js');

const OUT_PLAIN = path.join(root, 'dist/hkust-guide.dsl.yml');
const OUT_MODEL = path.join(root, 'dist/hkust-guide-chatgpt.dsl.yml');

const VERSION = '0.2.0';

/* The model baked into the second file. If the dropdown in your workspace
   shows something else, change it there (one click) - or tell me the id and
   rebuild. Nothing else in the app depends on it. */
const MODEL_PROVIDER = 'openai';
const MODEL_NAME = 'gpt-5.6-sol';

/* Fixed node ids. They are what the Answer templates and the If/Else
   condition point at, so tests/check_dsl.js can prove every reference
   resolves to a node that exists. Real Dify ids are timestamps; any string
   works, and fixed ones make these files diffable. */
const ID = {
  start: '9000000000001',
  code: '9000000000002',
  ifelse: '9000000000003',
  answerRoute: '9000000000004',
  llm: '9000000000005',
  answerReply: '9000000000006'
};

const SYSTEM_PROMPT = [
  'You are the front desk of a HKUST campus wayfinding app.',
  '',
  'A deterministic routing engine answers the real route questions and its',
  'reply is shown at the end of this message. You only handle what it could',
  'not work out.',
  '',
  'Rules:',
  '1. Never invent a route, a distance, a floor or a walking time. If the',
  '   user wants a route, ask for the one thing that is missing: the starting',
  '   point, the destination, or a choice between the places listed.',
  '2. Keep place names exactly as the engine wrote them, including the ids in',
  '   backticks - the user can paste an id back and the engine will use it.',
  '3. Reply in the language of the user\'s last message (English, 简体中文,',
  '   or 粵語). At most three sentences.',
  '4. If the user only greets you, ask for a start and a destination and give',
  '   one example: "library entrance to LG1 canteen".',
  '5. You may answer a non-routing campus question (what is on a floor, which',
  '   lift is step-free) only if the engine\'s reply already says it. If it',
  '   does not, say you do not know rather than guess.'
].join('\n');

const USER_PROMPT = [
  'User: {{#sys.query#}}',
  '',
  'Engine: {{#9000000000002.text#}}'
].join('\n');

function q(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

/* Literal block scalar. The value has to come back byte-identical, so a
   blank line inside the engine stays a blank line (no trailing spaces to
   trip YAML), and exactly one trailing newline is assumed - with `|` clip
   that is what YAML gives back. */
function block(text, indent) {
  const pad = ' '.repeat(indent);
  return text.replace(/\n$/, '').split('\n')
    .map(function (line) { return line.trim() === '' ? '' : pad + line; })
    .join('\n');
}


function tail(id, x, y, h) {
  return '      height: ' + h + '\n' +
         "      id: '" + id + "'\n" +
         '      position:\n        x: ' + x + '\n        y: ' + y + '\n' +
         '      positionAbsolute:\n        x: ' + x + '\n        y: ' + y + '\n' +
         '      selected: false\n' +
         '      sourcePosition: right\n' +
         '      targetPosition: left\n' +
         '      type: custom\n' +
         '      width: 244\n';
}

function startNode(x, y) {
  return '    - data:\n' +
         "        desc: ''\n" +
         '        selected: false\n' +
         '        title: 开始 start\n' +
         '        type: start\n' +
         '        variables: []\n' + tail(ID.start, x, y, 54);
}

function codeNode(codeText, x, y) {
  return '    - data:\n' +
         '        code: |\n' + block(codeText, 10) + '\n' +
         '        code_language: javascript\n' +
         '        desc: ' + q('The routing engine, pasted verbatim from ' +
                           'dist/dify-code-node.js. No network, no model, ' +
                           'no randomness.') + '\n' +
         '        outputs:\n' +
         '          kind:\n            children: null\n            type: string\n' +
         '          ok:\n            children: null\n            type: boolean\n' +
         '          text:\n            children: null\n            type: string\n' +
         '        selected: false\n' +
         '        title: 引擎 engine\n' +
         '        type: code\n' +
         '        variables:\n' +
         '        - value_selector:\n          - sys\n          - query\n' +
         '          variable: query\n' + tail(ID.code, x, y, 120);
}

/* The engine sets kind = 'clarify' exactly when it could not work out a
   route; 'route' and 'nearest' are answers. Branching on a string rather
   than on the boolean `ok` is deliberate: a boolean has to be coerced
   through YAML and the condition engine, a string comparison has no
   coercion at all. */
function ifElseNode(x, y) {
  return '    - data:\n' +
         '        _targetBranches:\n' +
         "        - id: 'true'\n          name: IF\n" +
         "        - id: 'false'\n          name: ELSE\n" +
         '        cases:\n' +
         "        - case_id: 'true'\n" +
         '          conditions:\n' +
         "          - comparison_operator: 'is not'\n" +
         '            id: 6b1f0d2c-3f3e-4a2b-9c11-000000000001\n' +
         '            value: clarify\n' +
         '            varType: string\n' +
         '            variable_selector:\n' +
         "            - '" + ID.code + "'\n" +
         '            - kind\n' +
         "          id: 'true'\n" +
         '          logical_operator: and\n' +
         '        desc: ' + q('The engine already answered - do not let a ' +
                           'model reword it. Only "I did not understand" ' +
                           'goes to the model.') + '\n' +
         '        selected: false\n' +
         '        title: 规则命中了吗 rules\n' +
         '        type: if-else\n' + tail(ID.ifelse, x, y, 120);
}

function answerNode(id, title, answer, x, y) {
  return '    - data:\n' +
         '        answer: ' + q(answer) + '\n' +
         "        desc: ''\n" +
         '        selected: false\n' +
         '        title: ' + title + '\n' +
         '        type: answer\n' +
         '        variables: []\n' + tail(id, x, y, 90);
}

function llmNode(x, y) {
  return '    - data:\n' +
         '        context:\n          enabled: false\n          variable_selector: []\n' +
         '        desc: ' + q('Only reached when the engine could not parse ' +
                           'the sentence.') + '\n' +
         '        memory:\n' +
         "          query_prompt_template: ''\n" +
         '          role_prefix:\n' +
         "            assistant: ''\n            user: ''\n" +
         '          window:\n            enabled: false\n            size: 10\n' +
         '        model:\n' +
         '          completion_params:\n' +
         '            max_tokens: 240\n            temperature: 0\n' +
         '          mode: chat\n' +
         '          name: ' + MODEL_NAME + '\n' +
         '          provider: ' + MODEL_PROVIDER + '\n' +
         '        prompt_template:\n' +
         '        - role: system\n' +
         '          text: |-\n' + block(SYSTEM_PROMPT, 12) + '\n' +
         '        - role: user\n' +
         '          text: |-\n' + block(USER_PROMPT, 12) + '\n' +
         '        selected: false\n' +
         '        title: 前台 front desk\n' +
         '        type: llm\n' +
         '        variables: []\n' +
         '        vision:\n          enabled: false\n' + tail(ID.llm, x, y, 120);
}

function edge(srcType, src, tgtType, tgt, handle) {
  const h = handle || 'source';
  return '    - data:\n' +
         '        isInIteration: false\n' +
         '        sourceType: ' + srcType + '\n' +
         '        targetType: ' + tgtType + '\n' +
         '      id: ' + src + '-' + h + '-' + tgt + '-target\n' +
         '      selected: false\n' +
         "      source: '" + src + "'\n" +
         '      sourceHandle: ' + (handle ? "'" + handle + "'" : 'source') + '\n' +
         "      target: '" + tgt + "'\n" +
         '      targetHandle: target\n' +
         '      type: custom\n' +
         '      zIndex: 0\n';
}

function header(name, description, opening, questions) {
  let out = 'app:\n' +
            '  description: ' + q(description) + '\n' +
            '  icon: 🧭\n' +
            "  icon_background: '#E0F2FE'\n" +
            '  mode: advanced-chat\n' +
            '  name: ' + q(name) + '\n' +
            '  use_icon_as_answer_icon: false\n' +
            'kind: app\n' +
            'version: ' + VERSION + '\n' +
            'workflow:\n' +
            '  conversation_variables: []\n' +
            '  environment_variables: []\n' +
            '  features:\n' +
            '    file_upload:\n' +
            '      enabled: false\n' +
            '      image:\n' +
            '        enabled: false\n' +
            '        number_limits: 3\n' +
            '        transfer_methods:\n' +
            '        - local_file\n' +
            '        - remote_url\n' +
            '      number_limits: 3\n' +
            '    opening_statement: ' + q(opening) + '\n' +
            '    retriever_resource:\n      enabled: false\n' +
            '    sensitive_word_avoidance:\n      enabled: false\n' +
            '    speech_to_text:\n      enabled: false\n' +
            '    suggested_questions:\n';
  questions.forEach(function (s) { out += '    - ' + q(s) + '\n'; });
  out += '    suggested_questions_after_answer:\n      enabled: false\n' +
         '    text_to_speech:\n      enabled: false\n' +
         "      language: ''\n      voice: ''\n";
  return out;
}

function graph(edges, nodes) {
  return '  graph:\n    edges:\n' + edges.join('') +
         '    nodes:\n' + nodes.join('') +
         '    viewport:\n      x: 0\n      y: 0\n      zoom: 0.7\n';
}

const OPENING = '问我怎么在校园里走 —— English / 简体中文 / 粵語。' +
                '路线由代码节点算出来，不编造。';

const QUESTIONS = [
  'Library entrance to LG1 canteen',
  '圖書館去 LG1 飯堂點行',
  'LG7 食堂去 LG1 食堂，不想走楼梯',
  '图书馆去游泳池',
  'where is the nearest toilet from the piazza'
];

const DESC = 'HKUST campus wayfinding. Every route, floor and walking time ' +
             'comes from the JavaScript engine in the Code node; no model ' +
             'writes a number.';

function buildPlain(codeText) {
  const nodes = [
    startNode(40, 300),
    codeNode(codeText, 384, 268),
    answerNode(ID.answerRoute, '路线 route', '{{#' + ID.code + '.text#}}', 728, 284)
  ];
  const edges = [
    edge('start', ID.start, 'code', ID.code),
    edge('code', ID.code, 'answer', ID.answerRoute)
  ];
  return header('HKUST Campus Guide', DESC, OPENING, QUESTIONS) +
         graph(edges, nodes);
}

function buildModel(codeText) {
  const nodes = [
    startNode(40, 300),
    codeNode(codeText, 384, 268),
    ifElseNode(728, 268),
    answerNode(ID.answerRoute, '路线 route', '{{#' + ID.code + '.text#}}', 1072, 180),
    llmNode(1072, 420),
    answerNode(ID.answerReply, '兜底 reply', '{{#' + ID.llm + '.text#}}', 1416, 440)
  ];
  const edges = [
    edge('start', ID.start, 'code', ID.code),
    edge('code', ID.code, 'if-else', ID.ifelse),
    edge('if-else', ID.ifelse, 'answer', ID.answerRoute, 'true'),
    edge('if-else', ID.ifelse, 'llm', ID.llm, 'false'),
    edge('llm', ID.llm, 'answer', ID.answerReply)
  ];
  return header('HKUST Campus Guide (ChatGPT)', DESC, OPENING, QUESTIONS) +
         graph(edges, nodes);
}

function main() {
  const check = process.argv.indexOf('--check') !== -1;
  const codeText = fs.readFileSync(CODE_FILE, 'utf8');
  const out = [
    [OUT_PLAIN, buildPlain(codeText)],
    [OUT_MODEL, buildModel(codeText)]
  ];
  let stale = 0;
  out.forEach(function (pair) {
    const file = pair[0];
    const text = pair[1];
    const rel = path.relative(root, file);
    if (check) {
      const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (old !== text) {
        stale++;
        console.log('STALE ' + rel + ' (run: node tools/make_dsl.js)');
      } else {
        console.log('ok    ' + rel + '  ' + Buffer.byteLength(text) + ' bytes');
      }
    } else {
      fs.writeFileSync(file, text);
      console.log('wrote ' + rel + '  ' + Buffer.byteLength(text) + ' bytes');
    }
  });
  if (check && !stale) { console.log('DSL OK: both files are current'); }
  process.exit(stale ? 1 : 0);
}

main();
