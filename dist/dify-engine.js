/* =====================================================================
 * Dify engine - GENERATED FILE, do not edit.
 *
 *   node tools/bundle_engine.js
 *
 * Sources (in load order): src/data/graph.js, src/data/campus.ust.js, src/data/active.js, src/i18n.js, src/router.js, src/steps.js, src/nlu.js, tools/engine_api.js
 * Engine version: a2762b3892aa
 *
 * Standalone: run it and it hands you globalThis.Engine (and returns it).
 * For a Dify Code node use dist/dify-code-node.js instead - same code,
 * already wrapped in the function main(inputs) a Code node expects.
 * ===================================================================== */
(function () {
  'use strict';

  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  root.FUST = root.FUST || {};

  /* ---- src/data/graph.js ---- */
  /* =====================================================================
   * Campus graph builder.
   * ---------------------------------------------------------------------
   * A campus is *data*: a spec object with levels, building footprints,
   * one horizontal spine per building, vertical cores (lifts, stairs,
   * escalators), rooms and links between buildings. This file turns a spec
   * into the walking graph the router and the plan use.
   *
   * Two specs ship with the app:
   *   src/data/campus.js      the AISC1000A demo campus (fictional)
   *   src/data/campus.ust.js  HKUST, Clear Water Bay (real place names)
   * Both are built by the same code, so a data bug shows up in one test
   * run and the renderer never has to care which campus it is drawing.
   *
   * Geometry convention: a spec owns its own map units (demo: 0.32 m per
   * unit). Buildings keep one footprint on every floor, so "the plan of
   * floor f" is just "the footprints of the buildings that exist on f".
   * ===================================================================== */
  (function () {
    'use strict';

    function buildCampus(spec) {
      var LEVELS = spec.LEVELS;
      var BUILDINGS = spec.BUILDINGS;
      var OUTLINES = spec.OUTLINES || {};
      var FLOORS = spec.FLOORS;
      var SPINES = spec.SPINES;
      var CORES = spec.CORES;
      var ROOMS = spec.ROOMS;
      var LINKS = spec.LINKS || [];
      var M_PER_UNIT = spec.M_PER_UNIT;
      var WALK_SPEED = spec.WALK_SPEED;
      var STAIR_SEC_PER_FLOOR = spec.STAIR_SEC_PER_FLOOR;

      /* ---- build the graph ---------------------------------------------- */
      var nodes = [], edges = [], nodeById = {}, byCoord = {};

      function ckey(b, f, x, y) { return b + '|' + f + '|' + x + '|' + y; }

      function addNode(b, f, x, y, props) {
        var k = ckey(b, f, x, y);
        if (byCoord[k]) {
          var ex = byCoord[k];
          if (props) { for (var p in props) { if (props.hasOwnProperty(p) && ex[p] === undefined) { ex[p] = props[p]; } } }
          return ex;
        }
        var n = { id: (props && props.id) || (b + '-' + f + '-' + x + '-' + y),
                  b: b, f: f, x: x, y: y, kind: 'junction', poi: null,
                  names: null, aliases: [], core: null, coreKind: null, coreLabel: null, coreNames: null };
        if (props) { for (var q in props) { if (props.hasOwnProperty(q)) { n[q] = props[q]; } } }
        nodes.push(n); byCoord[k] = n; nodeById[n.id] = n;
        return n;
      }

      function euclid(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

      function addEdge(a, b, kind, opts) {
        opts = opts || {};
        var metres = euclid(a, b) * M_PER_UNIT;
        var sec = (opts.sec !== undefined) ? opts.sec : metres / WALK_SPEED;
        var e = {
          id: a.id + '>' + b.id,
          a: a.id, b: b.id, kind: kind,
          m: Math.round(metres * 10) / 10,
          sec: Math.round(sec),
          accessible: opts.accessible !== false,
          core: opts.core || null
        };
        edges.push(e);
        return e;
      }

      function spineNode(b, f, x) { return byCoord[ckey(b, f, x, SPINES[b].y)]; }

      function nearestSpine(b, f, node) {
        var sp = SPINES[b], best = null, bd = Infinity;
        sp.xs.forEach(function (x) {
          var s = spineNode(b, f, x);
          if (!s) { return; }
          var d = euclid(node, s);
          if (d < bd) { bd = d; best = s; }
        });
        return best;
      }

      function endpoint(p) {
        var n = byCoord[ckey(p.b, p.f, p.x, p.y)];
        if (n) { return n; }
        n = addNode(p.b, p.f, p.x, p.y, { kind: 'junction' });
        var s = nearestSpine(p.b, p.f, n);
        if (s) { addEdge(n, s, 'junction'); }
        return n;
      }

      /* 1. horizontal spines - one per building per floor */
      Object.keys(FLOORS).forEach(function (b) {
        var sp = SPINES[b];
        if (!sp) { return; }
        FLOORS[b].forEach(function (f) {
          var prev = null;
          sp.xs.forEach(function (x) {
            var n = addNode(b, f, x, sp.y, { kind: 'spine' });
            if (prev && prev !== n) { addEdge(prev, n, 'corridor'); }
            prev = n;
          });
        });
      });

      /* 2. rooms hang off the nearest spine node */
      ROOMS.forEach(function (r) {
        var n = addNode(r.b, r.f, r.x, r.y, {
          id: r.id, kind: 'room', poi: r.poi, names: r.names, aliases: r.aliases, short: r.short,
          verified: r.verified === undefined ? true : r.verified
        });
        var s = nearestSpine(r.b, r.f, n);
        if (s) { addEdge(n, s, 'room'); }
      });

      /* 3. vertical cores (lifts / stairs / escalator)
            Lifts connect every pair of served floors directly, so the waiting
            time is counted once per ride instead of once per floor. */
      CORES.forEach(function (c) {
        var floorNodes = c.floors.map(function (f) {
          var n = addNode(c.b, f, c.x, c.y, { kind: 'core' });
          n.kind = 'core';
          n.core = c.id;
          n.coreKind = c.kind;
          n.coreLabel = (c.label === undefined) ? null : c.label;
          n.coreNames = c.names;
          if (c.verified === false) { n.verified = false; }
          return n;
        });

        var i, j;
        if (c.kind === 'lift') {
          for (i = 0; i < floorNodes.length; i++) {
            for (j = i + 1; j < floorNodes.length; j++) {
              var df = Math.abs(LEVELS.indexOf(c.floors[j]) - LEVELS.indexOf(c.floors[i]));
              addEdge(floorNodes[i], floorNodes[j], 'lift', { sec: c.wait + c.perFloor * df, core: c.id });
            }
          }
        } else {
          for (i = 1; i < floorNodes.length; i++) {
            var df2 = Math.abs(LEVELS.indexOf(c.floors[i]) - LEVELS.indexOf(c.floors[i - 1]));
            if (c.kind === 'stairs') {
              addEdge(floorNodes[i - 1], floorNodes[i], 'stairs', { sec: STAIR_SEC_PER_FLOOR * df2, accessible: false, core: c.id });
            } else if (c.kind === 'escalator') {
              addEdge(floorNodes[i - 1], floorNodes[i], 'escalator', { sec: (c.sec || 22) * df2, accessible: false, core: c.id });
            }
          }
        }
      });

      /* 4. building-to-building links. A link may carry an explicit `sec`
            when the drawing compresses a long or uphill path - the halls are
            a ten minute climb, not the twenty metres they are drawn apart. */
      LINKS.forEach(function (l) {
        var A = endpoint(l.a), B = endpoint(l.b);
        if (A && B && A !== B) { addEdge(A, B, l.kind, { sec: l.sec }); }
      });

      /* ---- adjacency + helpers ------------------------------------------ */
      var adjacency = {};
      nodes.forEach(function (n) { adjacency[n.id] = []; });
      edges.forEach(function (e) {
        adjacency[e.a].push({ to: e.b, edge: e });
        adjacency[e.b].push({ to: e.a, edge: e });
      });

      var coreById = {};
      CORES.forEach(function (c) { coreById[c.id] = c; });

      return {
        id: spec.id || 'campus',
        meta: spec.meta || {},
        QUIRKS: spec.QUIRKS || [],
        M_PER_UNIT: M_PER_UNIT,
        WALK_SPEED: WALK_SPEED,
        LEVELS: LEVELS,
        BUILDINGS: BUILDINGS,
        OUTLINES: OUTLINES,
        outlineOf: function (b) { return OUTLINES[b] || null; },
        FLOORS: FLOORS,
        SPINES: SPINES,
        CORES: CORES,
        ROOMS: ROOMS,
        LINKS: LINKS,
        nodes: nodes,
        edges: edges,
        adjacency: adjacency,
        nodeById: nodeById,
        coreById: coreById,
        levelIndex: function (f) { return LEVELS.indexOf(f); },
        node: function (id) { return nodeById[id] || null; },
        buildingsOn: function (f) {
          return Object.keys(FLOORS).filter(function (b) { return FLOORS[b].indexOf(f) >= 0; });
        },
        roomsOn: function (b, f) {
          return nodes.filter(function (n) { return n.kind === 'room' && n.b === b && n.f === f; });
        },
        nodesOn: function (f) {
          return nodes.filter(function (n) { return n.f === f; });
        },
        poiNodes: function (poi) {
          return nodes.filter(function (n) { return n.poi === poi; });
        }
      };
    }

    globalThis.FUST = globalThis.FUST || {};
    globalThis.FUST.buildCampus = buildCampus;
  })();

  /* ---- src/data/campus.ust.js ---- */
  /* =====================================================================
   * HKUST, Clear Water Bay - REAL PLACE DATA (schematic plan)
   * ---------------------------------------------------------------------
   * What is real here, and what is not, because a guide that quietly makes
   * things up is worse than no guide:
   *
   *  REAL, sourced
   *    - building and facility names (Academic Building, Lee Shau Kee
   *      Library, Lee Shau Kee Business Building, Cheng Yu Tung Building,
   *      Shaw Auditorium, Sports Center, UG Halls, Lo Ka Chung Building)
   *    - the newcomer-relevant facts in data/ust-newcomer.txt: LG1 canteen,
   *      LG5 McDonald's, LG7 canteen, the G/F 24-hour study area, the
   *      Library's top-floor sea-view seats, the LSK canteen and study room,
   *      the CYT Bloomberg terminals, the E2 computer room, the free pool,
   *      ParknShop, the bookstore, Su store, the SU store
   *    - transport: 11 (Choi Hung), 11M (Hang Hau), 104 (Ngau Tau Kok),
   *      792M (Tiu Keng Leng / Sai Kung), 91M (Po Lam), 91 (Clear Water Bay),
   *      all dropping off at the southern entrance (hkust.edu.hk/visit)
   *    - Library services: Learning Commons, group study rooms, nap pods,
   *      3D printing, print/copy station (library.hkust.edu.hk)
   *
   *  NOT VERIFIED -> those POIs carry `verified: false` and the app prints a
   *  "未核实" chip on them. Those are the *positions*, the *floor* of a place
   *  and the lift numbers. HKUST numbers its lifts campus-wide and splits the
   *  Academic Building over LG7/LG5/LG3/LG1/G/1F-4F, which is why walking
   *  from LG7 to a 3/F classroom costs two lifts here: one bank serves the
   *  LG concourse, another the upper floors. The *pattern* is right; the
   *  individual numbers are a first pass to be checked on site.
   *
   * The plan is schematic: buildings sit in their true relative position
   * (seaward edge at the top, halls up the hill, entrance at the bottom) but
   * the drawing is compressed, so walking times come from the data - one map
   * unit is one metre and long paths carry an explicit `sec`.
   * ===================================================================== */
  (function () {
    'use strict';

    var M_PER_UNIT = 1.0;           // 1 map unit = 1 metre
    var WALK_SPEED = 1.35;          // m/s on the flat
    var STAIR_SEC_PER_FLOOR = 16;

    /* LG7 is the deepest concourse, 4F the top teaching floor. Order matters:
       the router counts lift time as "levels travelled". */
    var LEVELS = ['LG7', 'LG5', 'LG3', 'LG1', 'G', '1F', '2F', '3F', '4F'];

    var BUILDINGS = {
      ACA: { short: 'ACA', kind: 'building',
             names: { en: 'Academic Building',     zh: '学术大楼',       yue: '學術大樓' },
             rect: [360, 230, 310, 200],
             aliases: ['academic building', 'academic', 'aca', 'lecture theatres', '学术大楼', '學術大樓', '教学楼', '教學樓'],
             entry: 'ust-g-concourse' },

      LIB: { short: 'LIB', kind: 'building',
             names: { en: 'Lee Shau Kee Library',  zh: '李兆基图书馆',   yue: '李兆基圖書館' },
             rect: [90, 240, 210, 190],
             aliases: ['library', 'the library', 'lee shau kee library', 'lib', '图书馆', '圖書館', '李兆基图书馆', '李兆基圖書館'],
             entry: 'ust-lib-entrance' },

      LSK: { short: 'LSK', kind: 'building',
             names: { en: 'Lee Shau Kee Business Building', zh: '李兆基商学大楼', yue: '李兆基商學大樓' },
             rect: [690, 100, 210, 140],
             aliases: ['lsk', 'business building', 'business school', 'lee shau kee business building', '商学院', '商學院', '商学大楼', '商學大樓'],
             entry: 'ust-lsk-lobby' },

      CYT: { short: 'CYT', kind: 'building',
             names: { en: 'Cheng Yu Tung Building', zh: '郑裕彤楼',      yue: '鄭裕彤樓' },
             rect: [690, 270, 180, 170],
             aliases: ['cyt', 'cheng yu tung', 'cheng yu tung building', '郑裕彤楼', '鄭裕彤樓'],
             entry: 'ust-cyt-lobby' },

      SHAW: { short: 'SHAW', kind: 'building',
              names: { en: 'Shaw Auditorium',      zh: '逸夫演艺中心',   yue: '逸夫演藝中心' },
              rect: [890, 270, 100, 170],
              aliases: ['shaw', 'shaw auditorium', 'auditorium', '逸夫演艺中心', '逸夫演藝中心', '邵氏'],
              entry: 'ust-shaw-hall' },

      SPT: { short: 'SPT', kind: 'building',
             names: { en: 'Sports Center',        zh: '体育中心',       yue: '體育中心' },
             rect: [60, 480, 240, 130],
             aliases: ['sports center', 'sports centre', 'sports', 'gym', 'pool', 'swimming pool', '体育中心', '體育中心', '体育馆', '體育館', '游泳池'],
             entry: 'ust-spt-entrance' },

      HALL: { short: 'HALL', kind: 'building',
              names: { en: 'UG Halls (I-VII)',    zh: '本科生宿舍',     yue: '本科生宿舍' },
              rect: [60, 116, 210, 94],
              aliases: ['halls', 'ug halls', 'hall', 'dorm', 'dormitory', 'residence', '宿舍', '宿舍楼', '宿舍樓'],
              entry: 'ust-hall-lobby' },

      IAS: { short: 'IAS', kind: 'building',
             names: { en: 'Lo Ka Chung Building', zh: '高等研究院',     yue: '高等研究院' },
             rect: [300, 116, 130, 84],
             aliases: ['ias', 'institute for advanced study', 'lo ka chung', '高等研究院'],
             entry: 'ust-ias-lobby' },

      /* Open zones: drawn dashed and unfilled, because they are ground, not
         buildings - the entrance piazza with every bus stop, and the
         sea-front promenade behind the library. */
      PLZ: { short: 'PLZ', kind: 'open',
             names: { en: 'Entrance Piazza',      zh: '大学广场',       yue: '大學廣場' },
             rect: [360, 480, 310, 130],
             aliases: ['piazza', 'plaza', 'entrance', 'south entrance', '广场', '廣場', '南门', '南門'],
             entry: 'ust-plz-piazza' },

      SEA: { short: 'SEA', kind: 'open',
             names: { en: 'Seafront Promenade',   zh: '海边步道',       yue: '海邊步道' },
             rect: [40, 20, 920, 72],
             aliases: ['seafront', 'promenade', 'sea front', 'waterfront', '海边', '海邊', '海边步道', '海邊步道'],
             entry: 'ust-sea-promenade' }
    };

    var OUTLINES = {
      /* the academic building: a long stepped slab following the slope */
      ACA:  [[360, 250], [410, 230], [620, 230], [670, 262], [670, 400],
             [640, 430], [400, 430], [360, 398]],
      LIB:  [[90, 262], [112, 240], [278, 240], [300, 262], [300, 408],
             [278, 430], [150, 430], [90, 406]],
      LSK:  [[690, 120], [720, 100], [870, 100], [900, 126], [900, 240], [690, 240]],
      CYT:  [[690, 292], [712, 270], [848, 270], [870, 294], [870, 418], [848, 440], [690, 440]],
      SHAW: [[890, 292], [912, 270], [968, 270], [990, 298], [990, 412], [968, 440], [890, 440]],
      SPT:  [[60, 502], [84, 480], [276, 480], [300, 506], [300, 584], [276, 610], [60, 610]],
      HALL: [[60, 138], [84, 116], [246, 116], [270, 142], [270, 210], [60, 210]],
      IAS:  [[300, 138], [322, 116], [408, 116], [430, 140], [430, 200], [300, 200]],
      PLZ:  [[360, 500], [380, 480], [650, 480], [670, 500], [670, 610], [360, 610]],
      SEA:  [[40, 20], [960, 20], [960, 92], [40, 92]]
    };

    /* which floors each place actually occupies ------------------------- */
    var FLOORS = {
      ACA:  LEVELS.slice(),                 // the LG concourse up to 4F
      LIB:  ['LG1', 'G', '1F', '2F', '3F'], // entrance on the LG1 concourse
      LSK:  ['G', '1F', '2F'],
      CYT:  ['G', '1F'],
      SHAW: ['G', '1F'],
      SPT:  ['G', '1F'],
      HALL: ['G', '1F'],
      IAS:  ['G', '1F'],
      PLZ:  ['G'],
      SEA:  ['G']
    };

    /* one horizontal corridor per building per floor; y is fixed so a spine
       node is just (building, floor, x) and every room hangs off the nearest
       one - hand-written data cannot drift out of sync */
    var SPINES = {
      ACA:  { y: 330, xs: [380, 430, 480, 530, 580, 630, 665] },
      LIB:  { y: 330, xs: [110, 150, 200, 250, 290] },
      LSK:  { y: 170, xs: [710, 750, 800, 850, 890] },
      CYT:  { y: 350, xs: [710, 750, 800, 850] },
      SHAW: { y: 350, xs: [905, 940, 975] },
      SPT:  { y: 545, xs: [80, 120, 170, 220, 280] },
      HALL: { y: 155, xs: [80, 120, 170, 220, 255] },
      IAS:  { y: 150, xs: [320, 360, 400] },
      PLZ:  { y: 545, xs: [380, 430, 480, 530, 580, 640] },
      SEA:  { y: 56,  xs: [100, 200, 300, 400, 500, 600, 700, 800, 900] }
    };

    /* Vertical circulation. Lift numbers are campus-wide unique at HKUST, so
       the numbers below do not repeat across buildings. The Academic Building
       is split into banks by height: 1-4 serve the LG concourse, 13-16 the
       upper teaching floors, which is what makes "LG7 to 3/F" a two-lift
       trip instead of one. */
    var CORES = [
      { id: 'L1', kind: 'lift', label: 1, b: 'ACA', x: 430, y: 330,
        floors: ['LG7', 'LG5', 'LG3', 'LG1', 'G'], wait: 40, perFloor: 5,
        names: { en: 'Lift 1', zh: '1号升降机', yue: '1號𨋢' },
        note: { en: 'LG7-G, the only lift down to the canteens',
                zh: '停 LG7–G，是去食堂那几层的唯一升降机',
                yue: '停 LG7–G，係去食堂嗰幾層嘅唯一𨋢' },
        verified: false },

      { id: 'L2', kind: 'lift', label: 2, b: 'ACA', x: 480, y: 330,
        floors: ['G', '1F', '2F', '3F', '4F'], wait: 30, perFloor: 4,
        names: { en: 'Lift 2', zh: '2号升降机', yue: '2號𨋢' },
        note: { en: 'G-4F express, does not stop at the LG levels',
                zh: 'G–4F 直达，不停 LG 层',
                yue: 'G–4F 直達，唔停 LG 層' },
        verified: false },

      { id: 'L13', kind: 'lift', label: 13, b: 'ACA', x: 630, y: 330,
        floors: ['LG1', 'G', '1F', '2F'], wait: 45, perFloor: 5,
        names: { en: 'Lift 13', zh: '13号升降机', yue: '13號𨋢' },
        note: { en: 'east bank, LG1-2F', zh: '东翼，停 LG1–2F', yue: '東翼，停 LG1–2F' },
        verified: false },

      { id: 'S1', kind: 'stairs', b: 'ACA', x: 380, y: 330, floors: LEVELS.slice(),
        names: { en: 'West Stairs', zh: '西楼梯', yue: '西樓梯' } },
      { id: 'S2', kind: 'stairs', b: 'ACA', x: 665, y: 330, floors: LEVELS.slice(),
        names: { en: 'East Stairs', zh: '东楼梯', yue: '東樓梯' } },

      { id: 'L7', kind: 'lift', label: 7, b: 'LIB', x: 290, y: 330,
        floors: ['LG1', 'G', '1F', '2F', '3F'], wait: 35, perFloor: 5,
        names: { en: 'Lift 7', zh: '7号升降机', yue: '7號𨋢' },
        note: { en: 'library lift, LG1-3F', zh: '图书馆升降机，停 LG1–3F', yue: '圖書館𨋢，停 LG1–3F' },
        verified: false },
      { id: 'S3', kind: 'stairs', b: 'LIB', x: 110, y: 330,
        floors: ['LG1', 'G', '1F', '2F', '3F'],
        names: { en: 'Library Stairs', zh: '图书馆楼梯', yue: '圖書館樓梯' } },

      { id: 'L29', kind: 'lift', label: 29, b: 'LSK', x: 890, y: 170,
        floors: ['G', '1F', '2F'], wait: 30, perFloor: 4,
        names: { en: 'Lift 29', zh: '29号升降机', yue: '29號𨋢' },
        note: { en: 'business building, G-2F', zh: '商学大楼，停 G–2F', yue: '商學大樓，停 G–2F' },
        verified: false },
      { id: 'S4', kind: 'stairs', b: 'LSK', x: 710, y: 170, floors: ['G', '1F', '2F'],
        names: { en: 'LSK Stairs', zh: '商学大楼楼梯', yue: '商學大樓樓梯' } },

      { id: 'L21', kind: 'lift', label: 21, b: 'CYT', x: 850, y: 350,
        floors: ['G', '1F'], wait: 25, perFloor: 5,
        names: { en: 'Lift 21', zh: '21号升降机', yue: '21號𨋢' },
        note: { en: 'Cheng Yu Tung Building, G-1F', zh: '郑裕彤楼，停 G–1F', yue: '鄭裕彤樓，停 G–1F' },
        verified: false },
      { id: 'S5', kind: 'stairs', b: 'CYT', x: 710, y: 350, floors: ['G', '1F'],
        names: { en: 'CYT Stairs', zh: '郑裕彤楼楼梯', yue: '鄭裕彤樓樓梯' } },

      { id: 'L22', kind: 'lift', label: 22, b: 'SHAW', x: 975, y: 350,
        floors: ['G', '1F'], wait: 25, perFloor: 5,
        names: { en: 'Lift 22', zh: '22号升降机', yue: '22號𨋢' },
        note: { en: 'auditorium, G-1F', zh: '演艺中心，停 G–1F', yue: '演藝中心，停 G–1F' },
        verified: false },
      { id: 'S6', kind: 'stairs', b: 'SHAW', x: 905, y: 350, floors: ['G', '1F'],
        names: { en: 'Auditorium Stairs', zh: '演艺中心楼梯', yue: '演藝中心樓梯' } },

      { id: 'L9', kind: 'lift', label: 9, b: 'SPT', x: 280, y: 545,
        floors: ['G', '1F'], wait: 20, perFloor: 5,
        names: { en: 'Lift 9', zh: '9号升降机', yue: '9號𨋢' },
        note: { en: 'sports centre, pool level', zh: '体育中心，直达泳池层', yue: '體育中心，直達泳池層' },
        verified: false },
      { id: 'S7', kind: 'stairs', b: 'SPT', x: 80, y: 545, floors: ['G', '1F'],
        names: { en: 'Sports Centre Stairs', zh: '体育中心楼梯', yue: '體育中心樓梯' } },

      { id: 'L10', kind: 'lift', label: 10, b: 'HALL', x: 255, y: 155,
        floors: ['G', '1F'], wait: 30, perFloor: 5,
        names: { en: 'Lift 10', zh: '10号升降机', yue: '10號𨋢' },
        note: { en: 'halls, G-1F', zh: '宿舍，停 G–1F', yue: '宿舍，停 G–1F' },
        verified: false },
      { id: 'S8', kind: 'stairs', b: 'HALL', x: 80, y: 155, floors: ['G', '1F'],
        names: { en: 'Hall Stairs', zh: '宿舍楼梯', yue: '宿舍樓梯' } },

      { id: 'L23', kind: 'lift', label: 23, b: 'IAS', x: 400, y: 150,
        floors: ['G', '1F'], wait: 25, perFloor: 5,
        names: { en: 'Lift 23', zh: '23号升降机', yue: '23號𨋢' },
        note: { en: 'Lo Ka Chung Building, G-1F', zh: '高等研究院，停 G–1F', yue: '高等研究院，停 G–1F' },
        verified: false },
      { id: 'S9', kind: 'stairs', b: 'IAS', x: 320, y: 150, floors: ['G', '1F'],
        names: { en: 'IAS Stairs', zh: '高等研究院楼梯', yue: '高等研究院樓梯' } }
    ];

    /* ---- points of interest ------------------------------------------------
       R(id, building, floor, x, y, poiType, en, zh, yue, aliases, short, verified)
       `verified: false` means the place is real but its position or floor still
       needs a walk-through; the app prints a 未核实 chip on those. */
    function R(id, b, f, x, y, poi, en, zh, yue, aliases, short, verified) {
      return { id: id, b: b, f: f, x: x, y: y, poi: poi, short: short || null,
               verified: verified === undefined ? true : verified,
               names: { en: en, zh: zh, yue: yue || zh }, aliases: aliases || [] };
    }

    var ROOMS = [
      /* Academic Building: the LG concourse (the canteens live down here) */
      R('ust-lg7-canteen', 'ACA', 'LG7', 480, 365, 'food',
        'LG7 Canteen', 'LG7 食堂', 'LG7 食堂',
        ['lg7 canteen', 'lg 7 canteen', 'lg7', 'lg 7', 'canteen', 'lg7 食堂', 'lg 7 食堂', 'lg7 飯堂', '科大全餐', '全餐', '食堂'], 'LG7 Canteen', true),
      R('ust-lg7-wc', 'ACA', 'LG7', 630, 365, 'restroom',
        'Restroom (LG7)', '洗手间（LG7）', '洗手間（LG7）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      R('ust-lg5-mcd', 'ACA', 'LG5', 480, 295, 'food',
        "McDonald's", '麦当劳', '麥當勞',
        ['lg5 mcdonalds', 'lg 5 mcdonalds', 'mcdonalds', 'mcd', 'lg5', 'lg 5', '麦当劳', '麥當勞'], "McDonald's", true),
      R('ust-lg5-wc', 'ACA', 'LG5', 630, 295, 'restroom',
        'Restroom (LG5)', '洗手间（LG5）', '洗手間（LG5）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      R('ust-lg3-su', 'ACA', 'LG3', 480, 365, 'admin',
        "Students' Union", '学生会', '學生會',
        ['student union', 'su', '学生会', '學生會', '法律顾问'], 'SU Office', false),
      R('ust-lg3-store', 'ACA', 'LG3', 480, 295, 'service',
        "Students' Union Store", '学生会便利店', '學生會便利店',
        ['su store', 'su shop', 'convenience store', '便利店', 'umbrella'], 'SU Store', false),
      R('ust-lg3-wc', 'ACA', 'LG3', 630, 295, 'restroom',
        'Restroom (LG3)', '洗手间（LG3）', '洗手間（LG3）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      R('ust-lg1-canteen', 'ACA', 'LG1', 480, 365, 'food',
        "LG1 Canteen (Maxim's)", 'LG1 食堂（美心）', 'LG1 食堂（美心）',
        ['lg1 canteen', 'lg 1 canteen', 'canteen', 'maxims', 'maxim', 'lg1 食堂', 'lg 1 食堂', 'lg1 飯堂', '美心', '食堂', '烧鸭'], 'LG1 Canteen', true),
      R('ust-lg1-parknshop', 'ACA', 'LG1', 560, 295, 'service',
        'ParknShop Supermarket', '百佳超市', '百佳超市',
        ['parknshop', 'park n shop', 'supermarket', '百佳', '超市'], 'ParknShop', false),
      R('ust-lg1-itsc', 'ACA', 'LG1', 400, 295, 'admin',
        'ITSC Service Desk', '资讯科技服务中心', '資訊科技服務中心',
        ['itsc', 'it service desk', 'it support', 'duo', '资讯科技'], 'ITSC', false),
      R('ust-lg1-health', 'ACA', 'LG1', 630, 365, 'service',
        'University Health Service', '大学保健处', '大學保健處',
        ['clinic', 'health centre', 'health center', 'medical', '保健处', '诊所'], 'Health', false),
      R('ust-lg1-atm', 'ACA', 'LG1', 400, 365, 'service',
        'ATM', '自动柜员机', '自動櫃員機', ['atm', 'bank', 'cash', '柜员机'], 'ATM', false),
      R('ust-lg1-wc', 'ACA', 'LG1', 630, 295, 'restroom',
        'Restroom (LG1)', '洗手间（LG1）', '洗手間（LG1）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      /* Academic Building: ground floor, where a newcomer lands ---------- */
      R('ust-g-concourse', 'ACA', 'G', 530, 295, 'lobby',
        'Academic Concourse', '学术大楼大堂', '學術大樓大堂',
        ['concourse', 'atrium', 'lobby', '大堂', '中庭'], 'Concourse', true),
      R('ust-g-bookstore', 'ACA', 'G', 400, 295, 'service',
        'Bookstore', '书店', '書店', ['bookstore', 'bookshop', '书店', '書店'], 'Bookstore', true),
      R('ust-g-souvenir', 'ACA', 'G', 560, 295, 'service',
        'Souvenir Shop', '纪念品店', '紀念品店',
        ['souvenir', 'souvenir shop', 'gift shop', '纪念品', '紀念品'], 'Souvenir', false),
      R('ust-g-wc', 'ACA', 'G', 630, 365, 'restroom',
        'Restroom (G/F)', '洗手间（G/F）', '洗手間（G/F）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      /* Academic Building: teaching floors ------------------------------- */
      R('ust-1f-lta', 'ACA', '1F', 480, 295, 'lecture',
        'LT-A Lecture Theatre', 'LT-A 演讲厅', 'LT-A 演講廳',
        ['lt-a', 'lta', 'lt a', 'lecture theatre a', 'lecture theater a', '演讲厅'], 'LT-A', false),
      R('ust-1f-ltb', 'ACA', '1F', 560, 295, 'lecture',
        'LT-B Lecture Theatre', 'LT-B 演讲厅', 'LT-B 演講廳',
        ['lt-b', 'ltb', 'lt b', 'lecture theatre b', 'lecture theater b'], 'LT-B', false),
      R('ust-1f-wc', 'ACA', '1F', 630, 365, 'restroom',
        'Restroom (1/F)', '洗手间（1/F）', '洗手間（1/F）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      R('ust-2f-ltc', 'ACA', '2F', 480, 295, 'lecture',
        'LT-C Lecture Theatre', 'LT-C 演讲厅', 'LT-C 演講廳',
        ['lt-c', 'ltc', 'lt c', 'lecture theatre c', 'lecture theater c'], 'LT-C', false),
      R('ust-2f-e2', 'ACA', '2F', 560, 365, 'lab',
        'E2 Computer Room (24h)', 'E2 电脑室（通宵开放）', 'E2 電腦室（通宵開放）',
        ['e2', 'computer room', 'computer lab', '电脑室', '電腦室', '通宵'], 'E2 Lab', false),
      R('ust-2f-wc', 'ACA', '2F', 630, 295, 'restroom',
        'Restroom (2/F)', '洗手间（2/F）', '洗手間（2/F）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      R('ust-3f-engineering', 'ACA', '3F', 480, 295, 'admin',
        'School of Engineering', '工学院', '工學院',
        ['engineering school', 'school of engineering', '工学院', '工學院'], 'Engineering', false),
      R('ust-3f-wc', 'ACA', '3F', 630, 365, 'restroom',
        'Restroom (3/F)', '洗手间（3/F）', '洗手間（3/F）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      R('ust-4f-urop', 'ACA', '4F', 480, 295, 'admin',
        'UROP Office', '本科生研究计划办公室', '本科生研究計劃辦公室',
        ['urop', 'undergraduate research', '研究计划'], 'UROP', false),
      R('ust-4f-study', 'ACA', '4F', 560, 365, 'study',
        'Quiet Study Area', '安静自习区', '安靜自習區',
        ['study area', 'quiet study', '自习', '自習'], 'Study', false),

      /* Lee Shau Kee Library --------------------------------------------- */
      R('ust-lib-entrance', 'LIB', 'LG1', 290, 295, 'entrance',
        'Library Entrance', '图书馆入口', '圖書館入口',
        ['library entrance', 'library', '图书馆', '圖書館', 'lib'], 'Library', true),
      R('ust-lib-counter', 'LIB', 'LG1', 200, 295, 'service',
        'Borrow & Return Counter', '借还书柜台', '借還書櫃檯',
        ['borrow', 'return', 'counter', '借书', '还书'], 'Counter', false),
      R('ust-lib-lc', 'LIB', 'G', 150, 295, 'study',
        'Learning Commons', '学习共享空间', '學習共享空間',
        ['learning commons', 'commons', '共享空间', '學習共享'], 'Commons', true),
      R('ust-lib-24h', 'LIB', 'G', 250, 365, 'study',
        '24-Hour Study Area', '24 小时自习区', '24 小時自習區',
        ['24 hour study', '24h', '24小时自习', '通宵自习'], '24h Study', true),
      R('ust-lib-print', 'LIB', 'G', 150, 365, 'service',
        'Print & Copy Station', '打印复印站', '打印複印站',
        ['printing', 'print', 'copy', '打印', '复印'], 'Print', true),
      R('ust-lib-wc', 'LIB', 'G', 110, 365, 'restroom',
        'Restroom (Library)', '洗手间（图书馆）', '洗手間（圖書館）', ['toilet', '洗手间', '洗手間'], 'WC', false),
      R('ust-lib-3d', 'LIB', '1F', 110, 295, 'lab',
        '3D Printing Studio', '3D 打印室', '3D 打印室',
        ['3d printing', '3d print', '3d打印'], '3D Print', true),
      R('ust-lib-group', 'LIB', '2F', 250, 295, 'meeting',
        'Group Study Rooms', '小组讨论室', '小組討論室',
        ['group study', 'discussion room', 'study room', '讨论室'], 'Group Rooms', true),
      R('ust-lib-nap', 'LIB', '2F', 150, 365, 'facility',
        'Nap Pods', '小睡舱', '小睡艙', ['nap pod', 'nap', 'sleep pod', '小睡'], 'Nap Pods', true),
      R('ust-lib-seaview', 'LIB', '3F', 200, 295, 'study',
        'Sea-View Seats', '海景座位', '海景座位',
        ['sea view', 'seaview', 'sea view seats', '海景'], 'Sea View', true),

      /* Lee Shau Kee Business Building ----------------------------------- */
      R('ust-lsk-lobby', 'LSK', 'G', 750, 135, 'lobby',
        'LSK Lobby', '李兆基商学大楼大堂', '李兆基商學大樓大堂',
        ['lsk lobby', 'business building', '商学院', '商學院'], 'LSK Lobby', false),
      R('ust-lsk-canteen', 'LSK', '1F', 800, 135, 'food',
        'LSK Canteen', 'LSK 食堂', 'LSK 食堂',
        ['lsk canteen', 'lsk 食堂', 'canteen', 'wrap', '卷饼'], 'LSK Canteen', false),
      R('ust-lsk-study', 'LSK', '1F', 850, 200, 'study',
        'LSK Study Room', 'LSK 自习室', 'LSK 自習室',
        ['lsk study', 'study room', '自习室', '自習室'], 'LSK Study', false),
      R('ust-lsk-wc', 'LSK', '2F', 710, 200, 'restroom',
        'Restroom (LSK)', '洗手间（LSK）', '洗手間（LSK）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      /* Cheng Yu Tung Building ------------------------------------------- */
      R('ust-cyt-lobby', 'CYT', 'G', 750, 315, 'lobby',
        'Cheng Yu Tung Lobby', '郑裕彤楼大堂', '鄭裕彤樓大堂',
        ['cyt lobby', 'cheng yu tung', '郑裕彤', '鄭裕彤'], 'CYT Lobby', false),
      R('ust-cyt-bloomberg', 'CYT', '1F', 750, 315, 'study',
        'Bloomberg Terminals', '彭博终端', '彭博終端',
        ['bloomberg', 'bloomberg terminal', '彭博'], 'Bloomberg', true),
      R('ust-cyt-seaview', 'CYT', '1F', 800, 385, 'study',
        'Sea-View Study Area', '海景学习区', '海景學習區',
        ['sea view', 'sea view study', '海景'], 'Sea View', true),
      R('ust-cyt-wc', 'CYT', 'G', 850, 385, 'restroom',
        'Restroom (CYT)', '洗手间（郑裕彤楼）', '洗手間（鄭裕彤樓）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      /* Shaw Auditorium --------------------------------------------------- */
      R('ust-shaw-hall', 'SHAW', 'G', 940, 315, 'entrance',
        'Shaw Auditorium Main Hall', '逸夫演艺中心主厅', '逸夫演藝中心主廳',
        ['shaw', 'shaw auditorium', 'auditorium', 'main hall', '逸夫', '演艺中心'], 'Main Hall', true),
      R('ust-shaw-foyer', 'SHAW', 'G', 940, 385, 'lobby',
        'Shaw Auditorium Foyer', '演艺中心大堂', '演藝中心大堂',
        ['foyer', 'lobby', '大堂'], 'Foyer', false),
      R('ust-shaw-wc', 'SHAW', '1F', 905, 315, 'restroom',
        'Restroom (Auditorium)', '洗手间（演艺中心）', '洗手間（演藝中心）', ['toilet', '洗手间', '洗手間'], 'WC', false),

      /* Sports Center ----------------------------------------------------- */
      R('ust-spt-entrance', 'SPT', 'G', 280, 510, 'gym',
        'Sports Center Entrance', '体育中心入口', '體育中心入口',
        ['sports center', 'sports centre', 'gym', '体育馆', '體育館'], 'Sports Center', true),
      R('ust-spt-gym', 'SPT', 'G', 120, 580, 'gym',
        'Fitness Room', '健身室', '健身室',
        ['gym', 'fitness', 'fitness room', '健身室'], 'Fitness', true),
      R('ust-spt-change', 'SPT', 'G', 220, 580, 'facility',
        'Changing Rooms', '更衣室', '更衣室',
        ['changing room', 'locker room', '更衣室'], 'Changing', false),
      R('ust-spt-pool', 'SPT', '1F', 170, 510, 'gym',
        'Swimming Pool', '游泳池', '游泳池',
        ['pool', 'swimming pool', 'swim', '游泳池', '泳池'], 'Pool', true),

      /* UG Halls ---------------------------------------------------------- */
      R('ust-hall-lobby', 'HALL', 'G', 170, 120, 'lobby',
        'Hall Lobby', '宿舍大堂', '宿舍大堂',
        ['hall lobby', 'halls', 'dorm', '宿舍', '宿舍大堂'], 'Hall Lobby', true),
      R('ust-hall-laundry', 'HALL', 'G', 220, 190, 'service',
        'Laundry Room', '洗衣房', '洗衣房',
        ['laundry', 'laundry room', '洗衣房'], 'Laundry', false),
      R('ust-hall-common', 'HALL', '1F', 120, 190, 'lounge',
        'Common Room', '公共休息室', '公共休息室',
        ['common room', 'lounge', '休息室'], 'Common Room', false),

      /* Lo Ka Chung Building (IAS) ---------------------------------------- */
      R('ust-ias-lobby', 'IAS', 'G', 360, 120, 'lobby',
        'IAS Lobby', '高等研究院大堂', '高等研究院大堂',
        ['ias lobby', 'institute for advanced study', '高等研究院'], 'IAS', false),

      /* Entrance Piazza (open air) ---------------------------------------- */
      R('ust-plz-piazza', 'PLZ', 'G', 480, 510, 'lobby',
        'Entrance Piazza', '大学广场', '大學廣場',
        ['piazza', 'plaza', 'entrance piazza', '广场', '廣場'], 'Piazza', true),
      R('ust-plz-visitor', 'PLZ', 'G', 580, 510, 'service',
        'Visitor Information Center', '访客中心', '訪客中心',
        ['visitor centre', 'visitor center', 'visitor information', '访客中心'], 'Visitor Centre', true),
      R('ust-plz-bus', 'PLZ', 'G', 430, 580, 'entrance',
        'Bus Stop (91 / 91M / 792M)', '巴士站（91 / 91M / 792M）', '巴士站（91 / 91M / 792M）',
        ['bus stop', 'bus', '91', '91m', '792m', '巴士', '巴士站'], 'Bus 91/91M', true),
      R('ust-plz-minibus', 'PLZ', 'G', 530, 580, 'entrance',
        'Minibus Stop (11 / 11M / 104)', '小巴站（11 / 11M / 104）', '小巴站（11 / 11M / 104）',
        ['minibus', 'minibus stop', '11', '11m', '104', '小巴', '小巴站'], 'Minibus 11/11M', true),
      R('ust-plz-taxi', 'PLZ', 'G', 580, 580, 'entrance',
        'Taxi Stand', '的士站', '的士站',
        ['taxi', 'taxi stand', '的士', '的士站'], 'Taxi', true),
      R('ust-plz-southgate', 'PLZ', 'G', 640, 580, 'entrance',
        'South Gate', '南门', '南門',
        ['south gate', 'south entrance', '南门', '南門'], 'South Gate', true),

      /* Seafront Promenade (open air) ------------------------------------- */
      R('ust-sea-promenade', 'SEA', 'G', 500, 68, 'entrance',
        'Seafront Promenade', '海边步道', '海邊步道',
        ['seafront', 'promenade', 'sea front', 'waterfront', '海边', '海邊', '海边步道'], 'Seafront', true),
      R('ust-sea-northgate', 'SEA', 'G', 120, 68, 'entrance',
        'North Gate (Minibus 11M)', '北门（小巴 11M）', '北門（小巴 11M）',
        ['north gate', 'north entrance', '11m', '北门', '北門'], 'North Gate', false)
    ];

    /* Building-to-building links. Endpoints are coordinates: a spine node at
       that spot is reused, otherwise a junction is created and hooked onto the
       nearest spine node. `sec` overrides the walked time when the drawing
       compresses a long or uphill path. */
    var LINKS = [
      /* the Library is entered from the LG1 concourse - there is no ground
         level door, so a trip from G/F has to drop a level first */
      { kind: 'walkway', a: { b: 'ACA', f: 'LG1', x: 360, y: 330 }, b: { b: 'LIB', f: 'LG1', x: 300, y: 330 } },
      /* covered bridge across to the business building at 1/F */
      { kind: 'walkway', a: { b: 'ACA', f: '1F', x: 670, y: 240 }, b: { b: 'LSK', f: '1F', x: 690, y: 240 } },
      /* same podium: CYT and the auditorium open off the academic building */
      { kind: 'walkway', a: { b: 'ACA', f: 'G', x: 670, y: 300 }, b: { b: 'CYT', f: 'G', x: 690, y: 300 } },
      { kind: 'corridor', a: { b: 'CYT', f: 'G', x: 870, y: 320 }, b: { b: 'SHAW', f: 'G', x: 890, y: 320 } },
      /* open air: piazza, sports centre, and the climb to the halls */
      { kind: 'outdoor', a: { b: 'ACA', f: 'G', x: 500, y: 430 }, b: { b: 'PLZ', f: 'G', x: 500, y: 480 } },
      { kind: 'outdoor', a: { b: 'PLZ', f: 'G', x: 360, y: 545 }, b: { b: 'SPT', f: 'G', x: 300, y: 545 } },
      { kind: 'outdoor', a: { b: 'LIB', f: 'G', x: 150, y: 240 }, b: { b: 'HALL', f: 'G', x: 150, y: 210 }, sec: 240 },
      { kind: 'outdoor', a: { b: 'IAS', f: 'G', x: 390, y: 200 }, b: { b: 'ACA', f: 'G', x: 390, y: 230 }, sec: 90 },
      { kind: 'outdoor', a: { b: 'HALL', f: 'G', x: 150, y: 116 }, b: { b: 'SEA', f: 'G', x: 150, y: 92 } }
    ];

    var SPEC = {
      id: 'ust-cwb',
      meta: {
        name: { en: 'HKUST, Clear Water Bay', zh: '香港科技大学（清水湾）', yue: '香港科技大學（清水灣）' },
        note: { en: 'Real place names, schematic plan. Places marked 未核实 still need a walk-through.',
                zh: '真实地点名称，示意图平面。标注「未核实」的位置仍需实地核对。',
                yue: '真實地點名稱，示意圖平面。標示「未核實」嘅位置仍需實地核對。' },
        dataSource: { en: 'hkust.edu.hk + newcomer guide', zh: 'hkust.edu.hk + 新生指南', yue: 'hkust.edu.hk + 新生指南' },
        geometry: 'schematic',
        real: true,
        sources: [
          'data/ust-newcomer.txt (newcomer guide, floor-level food and study facts)',
          'hkust.edu.hk/visit (minibus 11 / 11M, bus 91 / 91M / 792M / 104, entrance)',
          'library.hkust.edu.hk (Learning Commons, study rooms, nap pods, 3D printing)'
        ],
        popular: {
          origin: ['ust-g-concourse', 'ust-plz-piazza', 'ust-lib-entrance'],
          dest: ['ust-lg1-canteen', 'ust-lib-24h', 'ust-spt-pool', 'ust-plz-bus', 'ust-lsk-canteen']
        }
      },
      M_PER_UNIT: M_PER_UNIT,
      WALK_SPEED: WALK_SPEED,
      STAIR_SEC_PER_FLOOR: STAIR_SEC_PER_FLOOR,
      LEVELS: LEVELS,
      BUILDINGS: BUILDINGS,
      OUTLINES: OUTLINES,
      FLOORS: FLOORS,
      SPINES: SPINES,
      CORES: CORES,
      ROOMS: ROOMS,
      LINKS: LINKS,

      /* Facts the data check asserts, so a careless edit cannot silently turn
         the two-lift LG trip into a one-lift trip and make the guide wrong. */
      QUIRKS: [
        { kind: 'core-absent', core: 'L2', b: 'ACA', f: 'LG1',
          why: 'Lift 2 runs G-4F only, so every canteen trip needs Lift 1' },
        { kind: 'core-absent', core: 'L1', b: 'ACA', f: '1F',
          why: 'the LG bank stops at G/F, so going up needs Lift 2 or 13' },
        { kind: 'no-link-level', a: 'ACA', b: 'LIB', f: 'G',
          why: 'the library is entered from the LG1 concourse, not from G/F' }
      ]
    };

    globalThis.FUST = globalThis.FUST || {};
    globalThis.FUST.CampusUST = globalThis.FUST.buildCampus(SPEC);
  })();

  /* ---- src/data/active.js ---- */
  /* =====================================================================
   * Which campus the app runs on.
   * ---------------------------------------------------------------------
   * `?data=demo` keeps the fictional AISC1000A campus - the test suite and
   * the assignment screenshots use it, and it is the smallest worked example
   * of a campus spec. Anything else runs the real HKUST data.
   * This file must be loaded after both specs and before anything that
   * captures FUST.Campus at load time (i18n, NLU, router).
   * ===================================================================== */
  (function () {
    'use strict';

    var F = globalThis.FUST;
    var search = (globalThis.location && globalThis.location.search) || '';
    var m = /[?&]data=(demo|ust)\b/.exec(search);

    F.dataset = (m && m[1]) || 'ust';
    F.Campus = F.dataset === 'demo' ? F.CampusDemo : F.CampusUST;
  })();

  /* A server sandbox has no `location`, so active.js falls through to
     the real campus anyway; this line only says so out loud. */
  if (!root.FUST.Campus) { root.FUST.Campus = root.FUST.CampusUST; }

  /* ---- src/i18n.js ---- */
  /* =====================================================================
   * i18n - English / 中文 / 粵語 (Hong Kong Traditional).
   * Every user-visible string lives here, so switching language re-renders
   * the route that is already on screen instead of restarting the app.
   * ===================================================================== */
  (function () {
    'use strict';

    var C = globalThis.FUST.Campus;

    var DICT = {
      'app.title':      { en: 'Campus Guide', zh: '校园指引', yue: '校園指引' },
      'app.university': { en: 'Freefish University of Science and Technology',
                          zh: 'Freefish University of Science and Technology',
                          yue: 'Freefish University of Science and Technology' },
      'app.demo':       { en: 'DEMO DATA · fictional campus',
                          zh: '演示数据 · 虚构校园',
                          yue: '示範數據 · 虛構校園' },
      'app.realData':   { en: 'REAL CAMPUS · {n} to verify',
                          zh: '真实校园 · {n} 处待核实',
                          yue: '真實校園 · {n} 處待核實' },
      'app.tagline':    { en: 'Tell me where you are and where you want to go. I work out the floors, the lifts, and the walk in between.',
                          zh: '告诉我你在哪、要去哪，我帮你算出楼层、电梯号和中间的走法。',
                          yue: '話我知你喺邊、要去邊度，我幫你計出樓層、𨋢號同中間點行。' },

      'cards.title':    { en: 'Try one of these first', zh: '可以先试试这几个', yue: '可以先試下呢幾個' },
      'cards.hint':     { en: 'These five queries are the ones this prototype was built for.',
                          zh: '这五个问法就是这个原型专门设计来处理的。',
                          yue: '呢五個問法就係呢個原型專門設計嚟處理嘅。' },

      'chat.placeholder': { en: 'Where do you want to go? (EN / 中文 / 粵語)',
                            zh: '你要去哪里？（可输入中／英／粤）',
                            yue: '你想去邊度？（可以打中／英／粵）' },
      'chat.send':      { en: 'Go', zh: '出发', yue: '出發' },
      'chat.you':       { en: 'You', zh: '你', yue: '你' },
      'chat.bot':       { en: 'Guide', zh: '指引', yue: '指引' },

      'opt.stepFree':   { en: 'Step-free', zh: '无障碍', yue: '無障礙' },
      'opt.stepFreeHint': { en: 'no stairs, no escalator', zh: '不走楼梯和扶梯', yue: '唔行樓梯同扶手電梯' },

      'route.summary':  { en: '{time} · {dist} · {lifts}',
                          zh: '{time} · {dist} · {lifts}',
                          yue: '{time} · {dist} · {lifts}' },
      'route.dist':     { en: '{m} m on foot', zh: '步行 {m} 米', yue: '行 {m} 米' },
      'route.lifts.0':  { en: 'no lift', zh: '不用电梯', yue: '唔使𨋢' },
      'route.lifts.1':  { en: '1 lift', zh: '1 次电梯', yue: '1 次𨋢' },
      'route.lifts.n':  { en: '{n} lifts', zh: '{n} 次电梯', yue: '{n} 次𨋢' },
      'route.stepFreeTag': { en: 'Step-free', zh: '无障碍', yue: '無障礙' },
      'route.fastestTag':  { en: 'Fastest', zh: '最快', yue: '最快' },
      'route.altFaster':   { en: 'Faster but uses stairs: {time} (saves {save})',
                             zh: '走楼梯更快：{time}（省 {save}）',
                             yue: '行樓梯快啲：{time}（慳 {save}）' },
      'route.altStepFree': { en: 'Step-free alternative: {time} (+{extra})',
                             zh: '无障碍备选：{time}（多 {extra}）',
                             yue: '無障礙備選：{time}（多 {extra}）' },
      'route.noRoute':  { en: 'There is no step-free route between those two places in this map.',
                          zh: '在这份地图里，这两点之间没有无障碍路线。',
                          yue: '喺呢份地圖入面，呢兩點之間冇無障礙路線。' },
      'route.fellBack': { en: 'Step-free routing failed, so here is the fastest route instead.',
                          zh: '无障碍路线计算失败，先显示最快路线。',
                          yue: '無障礙路線計唔到，住先顯示最快路線。' },
      'route.found':    { en: 'Route found:', zh: '找到路线：', yue: '搵到路線：' },
      'route.to':       { en: 'to', zh: '到', yue: '去' },
      'route.steps':    { en: '{n} steps', zh: '{n} 步', yue: '{n} 步' },

      'step.walk':      { en: 'Walk {dist} m along the {building} {floor} corridor',
                          zh: '在{building}{floor}沿走廊直行 {dist} 米',
                          yue: '喺{building}{floor}沿走廊行 {dist} 米' },
      'step.walkPast':  { en: ', past {landmark}', zh: '，经过{landmark}', yue: '，經過{landmark}' },
      'step.skybridge': { en: 'Cross the skybridge into {building} ({dist} m)',
                          zh: '走空中连廊进入{building}（{dist} 米）',
                          yue: '行天橋過去{building}（{dist} 米）' },
      'step.walkway':   { en: 'Follow the covered walkway to {building} ({dist} m)',
                          zh: '沿有盖连廊走到{building}（{dist} 米）',
                          yue: '沿有蓋連廊行去{building}（{dist} 米）' },
      'step.outdoor':   { en: 'Go outside and walk to {building} ({dist} m)',
                          zh: '走到室外，前往{building}（{dist} 米）',
                          yue: '行出室外，去{building}（{dist} 米）' },
      'step.lift':      { en: 'Take {lift} from {fromFloor} to {toFloor} ({sec})',
                          zh: '乘{lift}，由{fromFloor}到{toFloor}（{sec}）',
                          yue: '搭{lift}，由{fromFloor}上{toFloor}（{sec}）' },
      'step.stairs':    { en: 'Take the stairs {dir} {n} floor(s) to {floor} ({sec})',
                          zh: '走楼梯{dir}{n}层到{floor}（{sec}）',
                          yue: '行樓梯{dir}{n}層到{floor}（{sec}）' },
      'step.escalator': { en: 'Take the escalator to {floor} ({sec})',
                          zh: '乘扶梯到{floor}（{sec}）',
                          yue: '搭扶手電梯上{floor}（{sec}）' },
      'step.arrive':    { en: 'You have arrived at {place}', zh: '到达{place}', yue: '到達{place}' },
      'step.up':        { en: 'up', zh: '上', yue: '上' },
      'step.down':      { en: 'down', zh: '下', yue: '下' },

      'clarify.needDest':  { en: 'I could not work out the destination. Which of these did you mean?',
                             zh: '我没看懂要去哪里。你是想去下面哪一个？',
                             yue: '我睇唔明你想去邊。你想去邊一個？' },
      'clarify.needOrigin':{ en: 'Got it - but where are you starting from?',
                             zh: '明白了，不过你现在在哪里？',
                             yue: '明白，不過你依家喺邊？' },
      'clarify.unknown':   { en: 'I cannot find "{text}" in this campus map.',
                             zh: '这份地图里没有“{text}”。',
                             yue: '呢份地圖入面冇「{text}」。' },
      'clarify.corrected': { en: 'I read "{from}" as {to}.', zh: '我把“{from}”理解为{to}。', yue: '我將「{from}」當成{to}。' },
      'clarify.assumed':   { en: 'Assuming you are at {place}.', zh: '我先当你在{place}。', yue: '我當你喺{place}。' },
      'clarify.pickOrigin':{ en: 'Pick a starting point:', zh: '选一个起点：', yue: '揀一個起點：' },
      'clarify.pickDest':  { en: 'Pick a destination:', zh: '选一个终点：', yue: '揀一個終點：' },
      /* Both examples have to work on both campuses as typed - they are the
         app's own suggestion, and a suggestion it cannot parse is the worst
         possible first impression. "LT-1" is demo-only, and a bare "nearest
         restroom" has no origin, so it asks instead of answering. */
      'clarify.help':      { en: 'Try: "I am at the Library entrance, how do I get to LG1 canteen?" or "nearest restroom from the library entrance"',
                             zh: '可以这样说：“我在图书馆正门，怎么去 LG1 食堂？”或者“我在图书馆正门，最近的洗手间在哪？”',
                             yue: '可以咁講：「我喺圖書館正門，點去 LG1 食堂？」或者「我喺圖書館正門，最近嘅洗手間喺邊？」' },
      'clarify.nearest':   { en: 'Nearest {poi} to {place}:', zh: '离{place}最近的{poi}：', yue: '離{place}最近嘅{poi}：' },

      'poi.restroom':   { en: 'restroom', zh: '洗手间', yue: '洗手間' },
      'poi.cafe':       { en: 'café', zh: '咖啡店', yue: '咖啡店' },
      'poi.food':       { en: 'food', zh: '食堂', yue: '食堂' },
      'poi.study':      { en: 'study space', zh: '自习空间', yue: '自習空間' },
      'poi.print':      { en: 'printer', zh: '打印站', yue: '打印站' },
      'poi.gym':        { en: 'gym', zh: '体育馆', yue: '體育館' },
      'poi.entrance':   { en: 'entrance', zh: '入口', yue: '入口' },
      'poi.admin':      { en: 'office', zh: '办公室', yue: '辦公室' },

      'msg.nearAlt':    { en: 'Also close: {list}', zh: '附近还有：{list}', yue: '附近仲有：{list}' },
      'msg.understood': { en: 'Understood as {origin} → {dest}.', zh: '理解为：{origin} → {dest}。', yue: '理解為：{origin} → {dest}。' },

      'map.title':      { en: 'Floor plan', zh: '楼层平面图', yue: '樓層平面圖' },
      'map.floor':      { en: 'Floor', zh: '楼层', yue: '樓層' },
      'map.you':        { en: 'You are here', zh: '你在这里', yue: '你喺呢度' },
      'map.goal':       { en: 'Destination', zh: '终点', yue: '終點' },
      'map.lift':       { en: 'Lift', zh: '电梯', yue: '𨋢' },
      'map.stairs':     { en: 'Stairs', zh: '楼梯', yue: '樓梯' },
      'map.esc':        { en: 'Escalator', zh: '扶梯', yue: '扶手電梯' },
      'map.play':       { en: 'Play walkthrough', zh: '播放路线', yue: '播放路線' },
      'map.pause':      { en: 'Pause', zh: '暂停', yue: '暫停' },
      'map.reset':      { en: 'Reset', zh: '重置', yue: '重設' },
      'map.walking':    { en: 'Walking…', zh: '行走中…', yue: '行緊…' },
      'map.rideLift':   { en: 'In {lift}…', zh: '正在乘{lift}…', yue: '搭緊{lift}…' },
      'map.onStairs':   { en: 'On the stairs…', zh: '正在走楼梯…', yue: '行緊樓梯…' },
      'map.onEsc':      { en: 'On the escalator…', zh: '正在乘扶梯…', yue: '搭緊扶手電梯…' },
      'map.crossing':   { en: 'Crossing the campus…', zh: '穿过校园中…', yue: '過緊校園…' },
      'map.noRoute':    { en: 'No route to show', zh: '暂无路线', yue: '暫時冇路線' },
      'map.legend':     { en: 'Floors change automatically while the walkthrough plays',
                          zh: '播放时楼层会自动切换',
                          yue: '播放時樓層會自動切換' },
      'map.zoomIn':     { en: 'Zoom in', zh: '放大', yue: '放大' },
      'map.zoomOut':    { en: 'Zoom out', zh: '缩小', yue: '縮細' },
      'map.fit':        { en: 'Fit to campus', zh: '显示全校区', yue: '顯示全校園' },
      'map.filterHint': { en: 'Click a category to fade the rest', zh: '点击分类可淡出其他地点',
                          yue: '撳分類可以淡出其他地點' },

      'cat.food':       { en: 'Food', zh: '餐饮', yue: '餐飲' },
      'cat.study':      { en: 'Study', zh: '学习', yue: '學習' },
      'cat.admin':      { en: 'Admin', zh: '办事', yue: '辦事' },
      'cat.sport':      { en: 'Sport', zh: '运动', yue: '運動' },
      'cat.transport':  { en: 'Access', zh: '出入', yue: '出入' },
      'cat.hall':       { en: 'Hall', zh: '住宿', yue: '住宿' },
      'cat.facility':   { en: 'Facilities', zh: '设施', yue: '設施' },

      /* ---- newcomer checklist ------------------------------------------ */
      'tasks.open':     { en: 'Checklist', zh: '任务清单', yue: '任務清單' },
      'tasks.title':    { en: 'Newcomer checklist', zh: '新生任务清单', yue: '新生任務清單' },
      'tasks.sub':      { en: 'HKUST · what to sort out before and after you land',
                          zh: '科大 · 落地前后要办的事',
                          yue: '科大 · 落地前後要辦嘅事' },
      'tasks.progress': { en: '{done} of {total} done', zh: '已完成 {done} / {total}', yue: '已完成 {done} / {total}' },
      'tasks.reset':    { en: 'Reset', zh: '清空', yue: '清空' },
      'tasks.saved':    { en: 'Ticks are saved in this browser only', zh: '勾选只存在这台浏览器里',
                          yue: '勾選只存在呢部瀏覽器入面' },
      'tasks.go':       { en: 'Go', zh: '带我去', yue: '帶我去' },
      'tasks.offsite':  { en: 'off campus', zh: '校外办理', yue: '校外辦理' },
      'tasks.goingTo':  { en: 'Heading to {place} - where are you starting from?',
                          zh: '要去{place}——你现在从哪里出发？',
                          yue: '要去{place}——你依家由邊度出發？' },
      'tasks.tips':     { en: 'Worth knowing', zh: '顺带一提', yue: '順帶一提' },
      'tasks.src':      { en: 'From', zh: '出处', yue: '出處' },
      'tasks.close':    { en: 'Close', zh: '关闭', yue: '關閉' },
      'tasks.allDone':  { en: 'All {total} done. Nothing left but the semester.',
                          zh: '{total} 项全部完成，剩下的就是上课了。',
                          yue: '{total} 項全部完成，剩返嘅就係上堂。' },

      'footer.group':   { en: 'Group 16 · AISC1000A (LA12)', zh: '第 16 组 · AISC1000A (LA12)', yue: '第 16 組 · AISC1000A (LA12)' },
      'footer.note':    { en: 'Course prototype. Campus, buildings, lift numbers and room codes are fictional demo data.',
                          zh: '课程原型。校园、建筑、电梯编号和房间编号都是虚构的演示数据。',
                          yue: '課程原型。校園、建築、𨋢號同房號都係虛構示範數據。' }
    };

    var FLOOR_NAMES = {
      LG1: { en: 'LG1', zh: 'LG1 地库', yue: 'LG1 地庫' },
      G:   { en: 'G/F', zh: '地下 G/F', yue: '地下 G/F' }
    };

    function t(key, lang, vars) {
      var entry = DICT[key];
      var s = entry ? (entry[lang] || entry.en) : key;
      if (vars) {
        Object.keys(vars).forEach(function (k) {
          s = s.split('{' + k + '}').join(String(vars[k]));
        });
      }
      return s;
    }

    function name(obj, lang) {
      if (!obj) { return ''; }
      var n = obj.names || obj;
      if (!n) { return ''; }
      return n[lang] || n.en || '';
    }

    function floorName(f, lang) {
      if (FLOOR_NAMES[f]) { return FLOOR_NAMES[f][lang] || FLOOR_NAMES[f].en; }
      var num = f.replace(/F$/, '');
      if (lang === 'zh') { return num + ' 楼'; }
      if (lang === 'yue') { return num + ' 樓'; }
      return num + '/F';
    }

    function buildingName(b, lang) { return name(C.BUILDINGS[b], lang); }

    /* Label for any node: rooms and cores use their own name, plain corridor
       nodes fall back to "Building floor". */
    function placeName(node, lang) {
      if (!node) { return ''; }
      if (node.names) { return name(node, lang); }
      if (node.core && node.coreNames) { return name({ names: node.coreNames }, lang); }
      return buildingName(node.b, lang) + ' ' + floorName(node.f, lang);
    }

    function shortName(node, lang) {
      if (!node) { return ''; }
      if (node.kind === 'room' && node.names) { return name(node, lang); }
      if (node.core && node.coreNames) { return name({ names: node.coreNames }, lang); }
      return '';
    }

    function duration(sec, lang) {
      sec = Math.max(0, Math.round(sec));
      var m = Math.floor(sec / 60), s = sec % 60;
      if (m === 0) {
        if (lang === 'en') { return s + ' s'; }
        return s + ' 秒';
      }
      if (s === 0) {
        if (lang === 'en') { return m + ' min'; }
        return m + ' 分';
      }
      if (lang === 'en') { return m + ' min ' + s + ' s'; }
      return m + ' 分 ' + s + ' 秒';
    }

    function stepText(step, lang) {
      switch (step.type) {
        case 'walk': {
          var s;
          if (step.sub === 'skybridge') {
            s = t('step.skybridge', lang, { building: buildingName(step.toB, lang), dist: step.m });
          } else if (step.sub === 'walkway') {
            s = t('step.walkway', lang, { building: buildingName(step.toB, lang), dist: step.m });
          } else if (step.sub === 'outdoor') {
            s = t('step.outdoor', lang, { building: buildingName(step.toB, lang), dist: step.m });
          } else {
            s = t('step.walk', lang, { dist: step.m, building: buildingName(step.fromB, lang), floor: floorName(step.fromF, lang) });
          }
          if (step.landmark && step.sub === 'indoor') {
            s += t('step.walkPast', lang, { landmark: placeName(C.node(step.landmark), lang) });
          }
          return s;
        }
        case 'lift': {
          var core = C.coreById[step.core];
          return t('step.lift', lang, {
            lift: name(core, lang),
            fromFloor: floorName(step.fromF, lang),
            toFloor: floorName(step.toF, lang),
            sec: duration(step.sec, lang)
          });
        }
        case 'stairs':
          return t('step.stairs', lang, {
            dir: t('step.' + step.dir, lang),
            n: step.floors,
            floor: floorName(step.toF, lang),
            sec: duration(step.sec, lang)
          });
        case 'escalator':
          return t('step.escalator', lang, { floor: floorName(step.toF, lang), sec: duration(step.sec, lang) });
        case 'arrive':
          return t('step.arrive', lang, { place: placeName(C.node(step.id), lang) });
        default:
          return '';
      }
    }

    function summary(route, lang) {
      var n = route.lifts.length;
      var key = n === 0 ? 'route.lifts.0' : (n === 1 ? 'route.lifts.1' : 'route.lifts.n');
      return {
        time: duration(route.sec, lang),
        dist: t('route.dist', lang, { m: route.m }),
        lifts: t(key, lang, { n: n })
      };
    }

    globalThis.FUST = globalThis.FUST || {};
    globalThis.FUST.I18N = {
      LANGS: ['en', 'zh', 'yue'],
      LANG_LABEL: { en: 'EN', zh: '中文', yue: '粵語' },
      t: t,
      name: name,
      floorName: floorName,
      buildingName: buildingName,
      placeName: placeName,
      shortName: shortName,
      duration: duration,
      stepText: stepText,
      summary: summary,
      DICT: DICT
    };
  })();

  /* ---- src/router.js ---- */
  /* =====================================================================
   * Router - Dijkstra over the campus graph.
   *
   * Cost = seconds (walking metres / 1.35 m/s, lift waits, stair flights).
   * opts.stepFree  : drop stair and escalator edges (wheelchair / luggage)
   * opts.bannedCores: { L2: true } to force a different vertical core
   * ===================================================================== */
  (function () {
    'use strict';

    var C = globalThis.FUST.Campus;

    var idx = {};
    C.nodes.forEach(function (n, i) { idx[n.id] = i; });

    function edgeAllowed(e, opts) {
      if (opts.stepFree && !e.accessible) { return false; }
      if (e.core && opts.bannedCores && opts.bannedCores[e.core]) { return false; }
      return true;
    }

    function dijkstra(fromId, opts) {
      opts = opts || {};
      var n = C.nodes.length;
      var dist = new Array(n), prev = new Array(n), prevEdge = new Array(n), done = new Array(n);
      for (var i = 0; i < n; i++) { dist[i] = Infinity; prev[i] = -1; prevEdge[i] = null; done[i] = false; }
      var s = idx[fromId];
      if (s === undefined) { return null; }
      dist[s] = 0;
      for (var round = 0; round < n; round++) {
        var u = -1, best = Infinity;
        for (var j = 0; j < n; j++) { if (!done[j] && dist[j] < best) { best = dist[j]; u = j; } }
        if (u === -1) { break; }
        done[u] = true;
        var links = C.adjacency[C.nodes[u].id];
        for (var k = 0; k < links.length; k++) {
          var e = links[k].edge;
          if (!edgeAllowed(e, opts)) { continue; }
          var v = idx[links[k].to];
          var nd = dist[u] + e.sec;
          if (nd < dist[v] - 1e-9) { dist[v] = nd; prev[v] = u; prevEdge[v] = e; }
        }
      }
      return { dist: dist, prev: prev, prevEdge: prevEdge };
    }

    function buildRoute(res, fromId, toId) {
      if (!res) { return null; }
      var t = idx[toId];
      if (t === undefined || res.dist[t] === Infinity) { return null; }
      var nodes = [], edges = [];
      var cur = t;
      while (cur !== -1) {
        nodes.unshift(C.nodes[cur].id);
        if (res.prevEdge[cur]) { edges.unshift(res.prevEdge[cur]); }
        cur = res.prev[cur];
      }
      var metres = 0, lifts = [], liftSeen = {};
      edges.forEach(function (e) {
        metres += e.m;
        if (e.kind === 'lift' && !liftSeen[e.core]) { liftSeen[e.core] = true; lifts.push(e.core); }
      });
      return {
        ok: true,
        from: fromId,
        to: toId,
        sec: res.dist[t],
        m: Math.round(metres),
        nodes: nodes,
        edges: edges,
        lifts: lifts
      };
    }

    function shortestPath(fromId, toId, opts) {
      return buildRoute(dijkstra(fromId, opts || {}), fromId, toId);
    }

    /* Compute the requested route plus the alternative, so the UI can say
       "the step-free way costs 1 min 20 s more" or "the stairs save 40 s". */
    function plan(fromId, toId, opts) {
      opts = opts || {};
      var wantStepFree = !!opts.stepFree;
      var primary = shortestPath(fromId, toId, { stepFree: wantStepFree });
      var other = shortestPath(fromId, toId, { stepFree: !wantStepFree });
      var fellBack = false;
      if (!primary && other) { primary = other; wantStepFree = !wantStepFree; fellBack = true; }
      var alt = null;
      if (primary && other && Math.abs(other.sec - primary.sec) > 5) { alt = other; }
      return { primary: primary, alternative: alt, stepFree: wantStepFree, fellBack: fellBack };
    }

    /* Nearest node of a given POI type, walking. */
    function nearestPoi(fromId, poiType, opts) {
      var nodes = C.poiNodes(poiType);
      if (!nodes.length) { return []; }
      var res = dijkstra(fromId, opts || {});
      if (!res) { return []; }
      var out = [];
      nodes.forEach(function (n) {
        var d = res.dist[idx[n.id]];
        if (d === Infinity) { return; }
        out.push({ node: n, sec: d, route: buildRoute(res, fromId, n.id) });
      });
      out.sort(function (a, b) { return a.sec - b.sec; });
      return out;
    }

    globalThis.FUST = globalThis.FUST || {};
    globalThis.FUST.Router = {
      shortestPath: shortestPath,
      plan: plan,
      nearestPoi: nearestPoi
    };
  })();

  /* ---- src/steps.js ---- */
  /* =====================================================================
   * Steps - turn a raw node path into human-sized segments:
   *   walk (indoor / skybridge / walkway / outdoor) - merged, with a landmark
   *   lift / stairs / escalator - merged across floors for the same core
   * ===================================================================== */
  (function () {
    'use strict';

    var C = globalThis.FUST.Campus;

    var WALK_SUB = {
      corridor: 'indoor', room: 'indoor', junction: 'indoor',
      skybridge: 'skybridge', walkway: 'walkway', outdoor: 'outdoor'
    };

    /* Nearest named room on the same floor, used for "past the coffee shop".
       Restrooms are skipped: "turn left past the toilet" reads badly. */
    function landmarkFor(b, f, x, y) {
      var best = null, bd = Infinity;
      C.nodes.forEach(function (n) {
        if (n.kind !== 'room' || n.b !== b || n.f !== f) { return; }
        if (n.poi === 'restroom' || n.poi === 'entrance') { return; }
        var dx = n.x - x, dy = n.y - y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bd) { bd = d; best = n; }
      });
      return (best && bd <= 80) ? best.id : null;
    }

    function build(route) {
      if (!route || !route.ok) { return []; }
      var out = [];
      var i = 0;
      while (i < route.edges.length) {
        var e = route.edges[i];
        var sub = WALK_SUB[e.kind];

        if (sub) {
          var m = 0, sec = 0, j = i, segNodes = [route.nodes[i]];
          while (j < route.edges.length && WALK_SUB[route.edges[j].kind] === sub) {
            m += route.edges[j].m;
            sec += route.edges[j].sec;
            segNodes.push(route.nodes[j + 1]);
            j++;
          }
          var a = C.node(route.nodes[i]), b = C.node(route.nodes[j]);
          out.push({
            type: 'walk', sub: sub,
            m: Math.round(m), sec: Math.round(sec),
            fromId: a.id, toId: b.id,
            fromB: a.b, fromF: a.f, toB: b.b, toF: b.f,
            landmark: sub === 'indoor' ? landmarkFor(a.b, a.f, (a.x + b.x) / 2, (a.y + b.y) / 2) : null,
            nodes: segNodes
          });
          i = j;
          continue;
        }

        /* vertical: merge consecutive edges of the same kind AND same core */
        var kind = e.kind, core = e.core, sec2 = 0, k = i, vNodes = [route.nodes[i]];
        while (k < route.edges.length &&
               route.edges[k].kind === kind &&
               route.edges[k].core === core) {
          sec2 += route.edges[k].sec;
          vNodes.push(route.nodes[k + 1]);
          k++;
        }
        var a2 = C.node(route.nodes[i]), b2 = C.node(route.nodes[k]);
        var di = C.levelIndex(b2.f) - C.levelIndex(a2.f);
        out.push({
          type: kind, core: core,
          sec: Math.round(sec2),
          floors: Math.abs(di),
          dir: di > 0 ? 'up' : 'down',
          fromId: a2.id, toId: b2.id,
          fromB: a2.b, fromF: a2.f, toB: b2.b, toF: b2.f,
          nodes: vNodes
        });
        i = k;
      }
      return out;
    }

    /* Flatten a route into animation key-frames: one entry per node with the
       cumulative "distance" used by the map player. Vertical moves get a fixed
       visual weight so the marker waits at the lift instead of jumping. */
    function timeline(route, steps) {
      if (!route || !route.ok) { return []; }
      var frames = [];
      var t = 0;
      var stepStart = 0, stepIdx = 0;
      var stepEnd = steps.length ? steps[0].nodes.length - 1 : -1;

      for (var i = 0; i < route.nodes.length; i++) {
        while (stepIdx < steps.length - 1 && i > stepEnd) {
          stepStart = stepEnd;
          stepIdx++;
          stepEnd = stepStart + steps[stepIdx].nodes.length - 1;
        }
        var n = C.node(route.nodes[i]);
        var e = route.edges[i - 1];
        var weight = 0;
        if (i > 0) { weight = (e && WALK_SUB[e.kind]) ? e.m : 10; }
        t += weight;
        frames.push({
          id: n.id, x: n.x, y: n.y, f: n.f, b: n.b, t: t,
          kind: e ? e.kind : null,
          core: e ? e.core : null,
          walk: !!(e && WALK_SUB[e.kind]),
          stepIndex: stepIdx
        });
      }
      return frames;
    }


    globalThis.FUST = globalThis.FUST || {};
    globalThis.FUST.Steps = {
      build: build,
      timeline: timeline,
      landmarkFor: landmarkFor,
      WALK_SUB: WALK_SUB
    };
  })();

  /* ---- src/nlu.js ---- */
  /* =====================================================================
   * NLU - rule based, three languages, no network calls.
   *
   * Pipeline: normalize -> split into origin/destination segments using
   * wayfinding markers -> match places (aliases, room codes, then fuzzy)
   * -> resolve building+floor -> read preferences (step-free / fastest).
   *
   * Everything is deterministic, so the test suite can assert exact results.
   * ===================================================================== */
  (function () {
    'use strict';

    var C = globalThis.FUST.Campus;

    /* ---- 1. normalisation ------------------------------------------------ */
    /* Traditional -> Simplified fold. Applied to BOTH the user text and the
       keyword/alias tables, so 圖書館 / 图书馆，樓梯 / 楼梯 behave the same.
       Only characters used by this campus and by wayfinding questions are
       listed; anything else is passed through untouched. */
    var T2S = {
      圖: '图', 書: '书', 術: '术', 學: '学', 樓: '楼', 館: '馆', 電: '电', 體: '体',
      廁: '厕', 間: '间', 飯: '饭', 廳: '厅', 辦: '办', 處: '处', 務: '务', 無: '无',
      礙: '碍', 輪: '轮', 會: '会', 動: '动', 門: '门', 點: '点', 樣: '样', 麼: '么',
      這: '这', 邊: '边', 個: '个', 裡: '里', 時: '时', 開: '开', 閉: '闭', 轉: '转',
      層: '层', 衛: '卫', 產: '产', 業: '业', 訓: '训', 練: '练', 機: '机', 場: '场',
      際: '际', 議: '议', 討: '讨', 論: '论', 課: '课', 講: '讲', 實: '实', 驗: '验',
      級: '级', 資: '资', 訊: '讯', 檯: '台', 櫃: '柜', 儲: '储', 區: '区', 飲: '饮',
      東: '东', 導: '导', 帶: '带', 從: '从', 過: '过', 進: '进', 內: '内',
      買: '买', 賣: '卖', 價: '价', 錢: '钱', 幾: '几', 號: '号', 嘅: '的'
    };
    var T2S_RE = new RegExp('[' + Object.keys(T2S).join('') + ']', 'g');

    function normalizeText(s) {
      s = String(s === undefined || s === null ? '' : s);
      s = s.replace(/[\uFF01-\uFF5E]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
      });
      s = s.replace(/\u3000/g, ' ');
      s = s.toLowerCase();
      s = s.replace(T2S_RE, function (ch) { return T2S[ch] || ch; });
      s = s.replace(/['\u2018\u2019\u0060\u00B4]/g, '');
      s = s.replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ');
      return s.replace(/\s+/g, ' ').trim();
    }

    function isLatin(f) { return /^[a-z0-9 ]+$/.test(f); }

    function lev(a, b) {
      if (a === b) { return 0; }
      var m = a.length, n = b.length;
      if (!m || !n) { return m || n; }
      var prev = new Array(n + 1), cur = new Array(n + 1), i, j;
      for (j = 0; j <= n; j++) { prev[j] = j; }
      for (i = 1; i <= m; i++) {
        cur[0] = i;
        for (j = 1; j <= n; j++) {
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        }
        var tmp = prev; prev = cur; cur = tmp;
      }
      return prev[n];
    }

    /* ---- 2. place index -------------------------------------------------- */
    var ENTITIES = [];       // { id, kind, forms, node }
    var TOKEN_INDEX = {};    // single latin word -> [entityIndex]

    function entityForms(node) {
      var forms = [], seen = {};
      function add(f) {
        f = normalizeText(f);
        if (!f || seen[f]) { return; }
        seen[f] = 1;
        forms.push(f);
      }
      if (node.names) {
        ['en', 'zh', 'yue'].forEach(function (l) { if (node.names[l]) { add(node.names[l]); } });
      }
      (node.aliases || []).forEach(add);
      if (node.names && node.names.en) {
        var codes = node.names.en.match(/[A-Za-z]{1,4}[-\s]?\d{2,3}/g) || [];
        codes.forEach(add);
      }
      return forms;
    }

    function registerEntity(node, kind, extraForms) {
      var forms = entityForms(node);
      (extraForms || []).forEach(function (f) {
        var nf = normalizeText(f);
        if (forms.indexOf(nf) < 0) { forms.push(nf); }
      });
      if (!forms.length) { return; }
      /* Chinese is written without spaces: 去LG1食堂 has to match the alias
         "lg1 食堂" just as 去 LG1 食堂 does. A compact copy of every form that
         contains a space costs nothing and only ever adds a match. */
      var compact = [];
      forms.forEach(function (f) {
        if (f.indexOf(' ') < 0) { return; }
        var c = f.replace(/ /g, '');
        if (forms.indexOf(c) < 0 && compact.indexOf(c) < 0) { compact.push(c); }
      });
      forms = forms.concat(compact);
      var idx = ENTITIES.length;
      ENTITIES.push({ id: node.id, kind: kind, forms: forms, node: node });
      forms.forEach(function (f) {
        if (isLatin(f) && f.indexOf(' ') < 0 && f.length >= 4) {
          (TOKEN_INDEX[f] = TOKEN_INDEX[f] || []).push(idx);
        }
      });
    }

    C.nodes.forEach(function (n) {
      if (n.kind === 'room') { registerEntity(n, 'room'); }
    });

    /* Building aliases live in the campus data (BUILDINGS[b].aliases) so a
       new campus is data-only. Two-letter codes (AT, EA...) are only accepted
       when the user actually typed them in capitals, otherwise "I am at the
       Atrium" would be read as the Academic Tower - that rule lives in
       parse(), the aliases themselves are just word lists. */
    Object.keys(C.BUILDINGS).forEach(function (b) {
      var spec = C.BUILDINGS[b] || {};
      var pseudo = { id: 'B-' + b, kind: 'building', names: spec.names, aliases: spec.aliases || [] };
      registerEntity(pseudo, 'building');
    });

    /* ---- 3. markers, floors, poi types ---------------------------------- */
    var DEST_MARKERS = [
      'how do i get to', 'how can i get to', 'how to get to', 'how do i get',
      'how can i get', 'how do i go to', 'how to go to', 'directions to',
      'route to', 'way to', 'get to', 'go to', 'walk to', 'take me to',
      'i want to go to', 'i need to go to', 'where is', 'where s', 'wheres',
      'where can i find', '带我去', '帶我去', '前往', '通往', '到達', '到达', '去', '到'
    ];

    /* "how do I get there" words that are questions, not destinations.
       Cantonese puts them at the end: 圖書館去 Lab 402 點行? */
    var QUESTION_MARKERS = [
      'how do i get', 'how can i get', 'how to get', 'how do i go',
      '点去', '怎麼去', '怎么去', '怎样去', '怎樣去', '如何去', '點去',
      '點樣去', '點行', '點樣行', '怎麼走', '怎么走', 'where is', 'where s', 'wheres'
    ];


    var ORIGIN_MARKERS = [
      'i am at', 'i m at', 'im at', 'i am in', 'i m in', 'im in',
      'i am near', 'im near', 'currently at', 'starting from', 'start from',
      'from', '我在', '我喺', '我响', '我響', '依家喺', '我现在在', '我現在在',
      '喺', '由', '从', '從'
    ];

    var NEAREST_MARKERS = [
      'nearest', 'closest', 'where is the nearest', 'where s the nearest',
      'where can i find', '最近', '最近的', '邊度有', '边度有', '哪里有', '哪裡有',
      '喺邊', '在哪儿', '在哪', '邊度', '哪里', '哪裡'
    ];

    var WEAK_DEST = [' to '];

    var STEPFREE_MARKERS = [
      'no stairs', 'without stairs', 'avoid stairs', 'not use stairs', 'step free',
      'stepfree', 'wheelchair', 'accessible route', 'lift only', 'use the lift',
      '不走楼梯', '不走樓梯', '不想走楼梯', '不想走樓梯', '不要走楼梯', '无障碍',
      '無障礙', '轮椅', '輪椅', '坐电梯', '坐電梯', '搭𨋢', '坐𨋢', '電梯優先', '电梯优先',
      '唔想行樓梯', '唔行樓梯', '唔好行樓梯'
    ];

    var FASTEST_MARKERS = ['fastest', 'quickest', 'as fast as possible', '最快', '快啲', '快点', '快點'];

    var FLOOR_ALIASES = {};
    function fa(alias, floor) { FLOOR_ALIASES[normalizeText(alias)] = floor; }

    fa('lg1', 'LG1'); fa('lg 1', 'LG1'); fa('b1', 'LG1'); fa('basement 1', 'LG1');
    fa('lower ground', 'LG1'); fa('lg', 'LG1'); fa('地库', 'LG1'); fa('地庫', 'LG1');
    fa('地库1', 'LG1'); fa('地庫1', 'LG1'); fa('负一层', 'LG1'); fa('負一層', 'LG1');
    /* HKUST splits its lower concourse into odd levels: LG1, LG3, LG5, LG7 */
    fa('lg3', 'LG3'); fa('lg 3', 'LG3'); fa('地库3', 'LG3'); fa('地庫3', 'LG3');
    fa('lg5', 'LG5'); fa('lg 5', 'LG5'); fa('地库5', 'LG5'); fa('地庫5', 'LG5');
    fa('lg7', 'LG7'); fa('lg 7', 'LG7'); fa('地库7', 'LG7'); fa('地庫7', 'LG7');
    fa('g', 'G'); fa('gf', 'G'); fa('g f', 'G'); fa('ground', 'G'); fa('ground floor', 'G');
    fa('ug', 'G'); fa('ug f', 'G'); fa('地下', 'G'); fa('地面', 'G'); fa('大堂层', 'G'); fa('大堂層', 'G');

    (function () {
      var CN = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八' };
      var EN = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth' };
      [1, 2, 3, 4, 5, 6, 7, 8].forEach(function (d) {
        var F = d + 'F';
        fa(d + 'f', F); fa(d + ' f', F); fa('floor ' + d, F); fa('level ' + d, F);
        fa('f' + d, F); fa(d + '楼', F); fa(d + '樓', F); fa(d + '层', F); fa(d + '層', F);
        fa(CN[d] + '楼', F); fa(CN[d] + '樓', F); fa(CN[d] + '层', F); fa(CN[d] + '層', F);
        fa(EN[d] + ' floor', F);
      });
    })();

    var FLOOR_KEYS = Object.keys(FLOOR_ALIASES).sort(function (a, b) { return b.length - a.length; });

    var POI_WORDS = {
      restroom: ['restroom', 'restrooms', 'toilet', 'toilets', 'washroom', 'washrooms', 'bathroom',
                 'bathrooms', 'wc', 'loo', '洗手间', '洗手間', '厕所', '廁所', '卫生间', '衛生間'],
      cafe: ['coffee shop', 'coffee', 'cafe', '咖啡店', '咖啡厅', '咖啡廳', '咖啡'],
      food: ['food court', 'food', 'canteen', 'cafeteria', '食堂', '饭堂', '飯堂', '餐厅', '餐廳'],
      study: ['study room', 'study', '自习室', '自習室', '温书', '溫書'],
      print: ['printing', 'print', 'printer', '打印', '影印'],
      gym: ['gym', 'fitness', 'gymnasium', '健身室', '健身'],
      entrance: ['main entrance', 'entrance', '正门', '正門', '入口', '大门', '大門'],
      admin: ['registry', 'office', '教务处', '教務處', '办公室', '辦公室']
    };

    /* Keyword tables go through the same normalisation as the user text,
       otherwise 樓梯 and 楼梯 would be two different words. */
    [DEST_MARKERS, ORIGIN_MARKERS, NEAREST_MARKERS, QUESTION_MARKERS,
     STEPFREE_MARKERS, FASTEST_MARKERS].forEach(function (arr) {
      for (var i = 0; i < arr.length; i++) { arr[i] = normalizeText(arr[i]); }
    });
    Object.keys(POI_WORDS).forEach(function (k) {
      POI_WORDS[k] = POI_WORDS[k].map(function (w) { return normalizeText(w); });
    });

    /* ---- 4. searching helpers ------------------------------------------- */
    function markerSearch(seg, marker, from) {
      var start = from || 0;
      if (isLatin(marker)) {
        var re = new RegExp('(^| )' + marker + '(?= |$)', 'g');
        re.lastIndex = start;
        var m = re.exec(seg);
        return m ? m.index + (m[1] ? 1 : 0) : -1;
      }
      return seg.indexOf(marker, start);
    }

    function findMarker(seg, markers, wantLast) {
      var best = null;
      markers.forEach(function (mk) {
        var from = 0, p;
        while ((p = markerSearch(seg, mk, from)) >= 0) {
          if (!best) { best = { pos: p, len: mk.length, marker: mk }; }
          else if (wantLast ? (p > best.pos) : (p < best.pos)) { best = { pos: p, len: mk.length, marker: mk }; }
          else if (p === best.pos && mk.length > best.len) { best = { pos: p, len: mk.length, marker: mk }; }
          from = p + 1;
        }
      });
      return best;
    }

    function hasAny(seg, markers) {
      for (var i = 0; i < markers.length; i++) {
        if (markerSearch(seg, markers[i], 0) >= 0) { return true; }
      }
      return false;
    }

    /* ---- 5. matching ----------------------------------------------------- */
    function matchSegment(segment) {
      if (!segment) { return null; }
      var hits = [];
      ENTITIES.forEach(function (ent, ei) {
        ent.forms.forEach(function (f) {
          if (!f) { return; }
          if (isLatin(f)) {
            var re = new RegExp('(^| )' + f + '(?= |$)', 'g'), m;
            while ((m = re.exec(segment)) !== null) {
              hits.push({ ei: ei, pos: m.index + (m[1] ? 1 : 0), len: f.length });
              if (m.index === re.lastIndex) { re.lastIndex++; }
            }
          } else {
            var p = segment.indexOf(f);
            while (p >= 0) {
              hits.push({ ei: ei, pos: p, len: f.length });
              p = segment.indexOf(f, p + 1);
            }
          }
        });
      });
      if (!hits.length) { return null; }
      hits.sort(function (a, b) {
        var ra = ENTITIES[a.ei].kind === 'room' ? 1 : 0;
        var rb = ENTITIES[b.ei].kind === 'room' ? 1 : 0;
        return (rb - ra) || (b.len - a.len) || (b.pos - a.pos);
      });
      return hits[0];
    }

    function fuzzySegment(segment, contextBuilding) {
      if (!segment) { return null; }
      var words = segment.split(' ').filter(function (w) { return w.length >= 5 && /^[a-z]+$/.test(w); });
      var best = null;
      words.forEach(function (w) {
        if (TOKEN_INDEX[w]) { return; }
        Object.keys(TOKEN_INDEX).forEach(function (key) {
          if (Math.abs(key.length - w.length) > 2) { return; }
          var d = lev(w, key);
          var max = w.length >= 6 ? 2 : 1;
          if (d > max) { return; }
          var weight = d / w.length;
          if (!best || weight < best.weight - 1e-9) { best = { word: w, key: key, d: d, weight: weight }; }
        });
      });
      if (!best) { return null; }
      var list = TOKEN_INDEX[best.key].map(function (i) { return ENTITIES[i]; });
      if (contextBuilding) {
        var same = list.filter(function (e) { return e.node && e.node.b === contextBuilding; });
        if (same.length) { list = same; }
      }
      best.entities = list;
      return best;
    }

    function findFloor(segment) {
      if (!segment) { return null; }
      for (var i = 0; i < FLOOR_KEYS.length; i++) {
        var k = FLOOR_KEYS[i];
        if (isLatin(k)) {
          if (new RegExp('(^| )' + k + '(?= |$)').test(segment)) { return FLOOR_ALIASES[k]; }
        } else if (segment.indexOf(k) >= 0) {
          return FLOOR_ALIASES[k];
        }
      }
      return null;
    }

    function detectPoi(segment) {
      var best = null;
      Object.keys(POI_WORDS).forEach(function (type) {
        POI_WORDS[type].forEach(function (w) {
          var p;
          if (isLatin(w)) {
            var re = new RegExp('(^| )' + w + '(?= |$)');
            var m = re.exec(segment);
            p = m ? m.index + (m[1] ? 1 : 0) : -1;
          } else {
            p = segment.indexOf(w);
          }
          if (p >= 0 && (!best || p < best.pos)) { best = { type: type, pos: p }; }
        });
      });
      return best;
    }

    function buildingFloorNode(b, f) {
      if (!C.FLOORS[b] || C.FLOORS[b].indexOf(f) < 0) { return null; }
      var sp = C.SPINES[b];
      var mid = sp.xs[Math.floor(sp.xs.length / 2)];
      for (var i = 0; i < C.nodes.length; i++) {
        var n = C.nodes[i];
        if (n.b === b && n.f === f && n.x === mid && n.y === sp.y) { return n; }
      }
      return null;
    }

    function entityNode(ent) {
      if (ent.kind === 'building') {
        var b = ent.id.slice(2);
        var spec = C.BUILDINGS[b] || {};
        if (spec.entry && C.node(spec.entry)) { return C.node(spec.entry); }
        return buildingFloorNode(b, C.FLOORS[b][0]);
      }
      return C.node(ent.id);
    }

    function resolvePlace(text, ctx) {
      ctx = ctx || {};
      var hit = matchSegment(text);
      var floor = findFloor(text);

      if (hit) {
        var ent = ENTITIES[hit.ei];
        if (ent.kind === 'room') {
          return { node: C.node(ent.id), confidence: 1, ent: ent, building: (C.node(ent.id) || {}).b };
        }
        var b = ent.id.slice(2);
        if (floor) {
          var byFloor = buildingFloorNode(b, floor);
          if (byFloor) { return { node: byFloor, confidence: 0.95, ent: ent, via: 'building+floor', building: b }; }
        }
        return { node: entityNode(ent), confidence: 0.85, ent: ent, via: 'building', building: b };
      }

      var fz = fuzzySegment(text, ctx.building);
      if (fz && fz.entities.length) {
        var ent2 = fz.entities[0];
        var node2 = entityNode(ent2);
        return {
          node: node2, confidence: 0.7, ent: ent2,
          corrected: { from: fz.word, to: fz.key },
          building: node2 ? node2.b : null
        };
      }

      if (floor && ctx.building) {
        var byCtx = buildingFloorNode(ctx.building, floor);
        if (byCtx) { return { node: byCtx, confidence: 0.8, via: 'floor-only', building: ctx.building }; }
      }
      return null;
    }

    /* ---- 6. segmentation + parse ---------------------------------------- */
    /* Finds the destination boundary in seg, starting the search at `from`.
       Strong markers ("go to", 去) win; otherwise a bare " to " is used. */
    function findDest(seg, from) {
      var start = from || 0;
      var sub = seg.slice(start);
      var d = findMarker(sub, DEST_MARKERS, true);
      var w = sub.lastIndexOf(' to ');
      var best = null;
      if (d) { best = { pos: d.pos, len: d.len, strong: true }; }
      if (w > 0 && (!best || w + 4 > best.pos + best.len)) {
        best = { pos: w, len: 4, strong: false };
      }
      if (best) { best.pos += start; }
      return best;
    }

    function segmentText(seg) {
      var o = findMarker(seg, ORIGIN_MARKERS, false);
      var originStart = o ? o.pos + o.len : -1;

      var d = findDest(seg, originStart > 0 ? originStart : 0);
      if (!d && o) { d = findDest(seg, 0); }

      var destStart = d ? d.pos + d.len : -1;
      var destEnd = seg.length;
      var originEnd = seg.length;

      if (o) {
        if (d && d.pos >= originStart) { originEnd = d.pos; }
        if (d && o.pos > destStart) { destEnd = o.pos; }
      }

      var destText, originText = '';
      if (destStart >= 0) { destText = seg.slice(destStart, destEnd); }
      else { destText = seg.slice(0, o ? o.pos : seg.length); }
      if (originStart >= 0) { originText = seg.slice(originStart, originEnd); }
      else if (d && d.pos > 0) { originText = seg.slice(0, d.pos); }

      return {
        dest: destText.replace(/\s+/g, ' ').trim(),
        origin: originText.replace(/\s+/g, ' ').trim(),
        hasDest: !!d,
        weakDest: !!(d && !d.strong),
        hasOrigin: !!o
      };
    }

    function detectLang(raw) {
      if (/[\u4e00-\u9fff]/.test(raw)) {
        if (/[喺唔嘅邊點𨋢嗰咁咗]/.test(raw)) { return 'yue'; }
        if (/[圖書學術樓電體育館廁間飯]/.test(raw)) { return 'yue'; }
        return 'zh';
      }
      return 'en';
    }

    /* Suggested origins/destinations for the empty state. The campus data
       supplies them (`meta.popular`) because only the campus knows which
       places are the useful ones for a newcomer. */
    var POPULAR = (C.meta && C.meta.popular) || { origin: [], dest: [] };

    function parse(text) {
      var rawIn = String(text === undefined || text === null ? '' : text);
      var capsLock = rawIn.length > 8 && rawIn === rawIn.toUpperCase() && /[A-Z]/.test(rawIn);
      var raw = capsLock ? rawIn : rawIn.replace(/\bAT\b/g, 'academic tower');
      var seg = normalizeText(raw);

      var out = {
        status: 'help', intent: 'help',
        origin: null, dest: null, poi: null,
        stepFree: hasAny(seg, STEPFREE_MARKERS) ? true : null,
        fastest: hasAny(seg, FASTEST_MARKERS),
        lang: detectLang(rawIn),
        corrections: [], unknown: '', text: rawIn, seg: seg
      };
      if (out.fastest && out.stepFree === null) { out.stepFree = false; }
      if (!seg) { return out; }

      var parts = segmentText(seg);
      var poi = detectPoi(seg);
      var nearestAsk = hasAny(seg, NEAREST_MARKERS);
      var question = hasAny(seg, QUESTION_MARKERS);

      var origin = parts.origin ? resolvePlace(parts.origin, {}) : null;
      var dest = parts.dest ? resolvePlace(parts.dest, { building: origin ? origin.building : null }) : null;

      if (origin && origin.corrected) { out.corrections.push(origin.corrected); }
      if (dest && dest.corrected) { out.corrections.push(dest.corrected); }

      /* "nearest toilet?" - the poi word wins over any room name */
      if (poi && (nearestAsk || !dest)) {
        out.intent = 'nearest';
        out.poi = poi.type;
        if (!origin) { out.status = 'need_origin'; return out; }
        out.origin = origin;
        out.status = 'ok';
        return out;
      }

      out.intent = 'route';
      if (origin && dest) {
        out.origin = origin; out.dest = dest; out.status = 'ok';
        return out;
      }
      if (dest && !origin) {
        out.dest = dest; out.status = 'need_origin';
        return out;
      }
      if (!dest && origin) {
        out.origin = origin; out.status = 'need_dest'; out.unknown = parts.dest || '';
        return out;
      }

      /* nothing matched: maybe the whole sentence is one place name */
      var solo = resolvePlace(seg, {});
      if (solo) {
        out.origin = solo;
        out.status = 'need_dest';
        out.unknown = seg;
        return out;
      }
      if (question || poi || nearestAsk) {
        out.status = 'need_dest';
        out.unknown = parts.dest || seg;
        return out;
      }
      return out;
    }

    function suggestIds(text, ctx) {
      var ids = [];
      var fz = fuzzySegment(normalizeText(text || ''), (ctx || {}).building);
      if (fz) {
        fz.entities.forEach(function (e) {
          var n = entityNode(e);
          if (n && ids.indexOf(n.id) < 0) { ids.push(n.id); }
        });
      }
      return ids.slice(0, 3);
    }

    globalThis.FUST = globalThis.FUST || {};
    globalThis.FUST.NLU = {
      parse: parse,
      suggestIds: suggestIds,
      normalizeText: normalizeText,
      detectLang: detectLang,
      segmentText: segmentText,
      POPULAR: POPULAR
    };
  })();


  /* ---- tools/engine_api.js ---- */
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
    var VERSION = 'a2762b3892aa';

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

  return root.Engine;
})();
