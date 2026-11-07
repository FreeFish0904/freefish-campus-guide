/* =====================================================================
 * Freefish University of Science and Technology (FUST)
 * Riverside Campus - DEMO DATA (fictional)
 * ---------------------------------------------------------------------
 * Every building, floor plan, lift number and room code below was
 * invented for the AISC1000A (LA12) Group 16 project. It does NOT
 * describe a real campus. It is kept in the repo because the test suite
 * asserts exact routes on it, and because it is the smallest worked
 * example of a campus spec: copy this file, keep the shape, and
 * `src/data/graph.js` builds the rest.
 *
 * Geometry: the map viewBox is 1000 x 660 "map units", 1 unit = 0.32 m.
 * Every building keeps the same footprint on every floor, so a floor
 * plan is "the footprints of the buildings that exist on that level".
 * ===================================================================== */
(function () {
  'use strict';

  var M_PER_UNIT = 0.32;          // metres per map unit
  var WALK_SPEED = 1.35;          // m/s on the flat
  var STAIR_SEC_PER_FLOOR = 16;   // seconds per floor when walking stairs

  var LEVELS = ['LG1', 'G', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F'];

  /* `aliases` are the words a visitor actually types for the whole building,
     `entry` is the node someone lands on when they name the building without
     a floor. Both live here rather than in the NLU so a new campus stays
     data-only. */
  var BUILDINGS = {
    AT:  { short: 'AT',  names: { en: 'Academic Tower',    zh: '学术楼',       yue: '學術樓' },        rect: [330,  90, 210, 230],
           aliases: ['academic tower', 'academic', 'the tower', 'tower', '主楼', '教学主楼', '學術樓', '学术楼'],
           entry: 'at-south' },
    LIB: { short: 'LIB', names: { en: 'Library',           zh: '图书馆',       yue: '圖書館' },        rect: [ 80, 110, 190, 230],
           aliases: ['library', 'the library', 'lib', '图书馆', '圖書館'],
           entry: 'lib-entrance' },
    EA:  { short: 'EA',  names: { en: 'Engineering Annex', zh: '工程附楼',     yue: '工程附樓' },      rect: [620,  70, 190, 250],
           aliases: ['engineering annex', 'annex', 'engineering', 'ea', '工程附楼', '工程附樓'],
           entry: null },
    HUB: { short: 'HUB', names: { en: 'Student Hub',       zh: '学生活动中心', yue: '學生活動中心' },  rect: [350, 400, 200, 180],
           aliases: ['student hub', 'hub', 'student centre', 'student center', '学生活动中心', '學生活動中心', '活动中心', '活動中心'],
           entry: 'hub-lobby' },
    SPT: { short: 'SPT', names: { en: 'Sports Centre',     zh: '体育馆',       yue: '體育館' },        rect: [ 90, 400, 200, 160],
           aliases: ['sports centre', 'sports center', 'sports', 'sports complex', 'gym building', 'spt', '体育馆', '體育館'],
           entry: 'spt-gym' },
    RES: { short: 'RES', names: { en: 'Residence Hall',    zh: '宿舍楼',       yue: '宿舍樓' },        rect: [650, 400, 180, 200],
           aliases: ['residence hall', 'residence', 'dorm', 'dormitory', 'hall', 'res', '宿舍楼', '宿舍樓', '宿舍'],
           entry: 'res-lobby' }
  };

  /* Footprints. `rect` above stays the bounding box (labels are bounded by
     it, and simple buildings are still drawn straight from it); `outline`
     is the real thing the renderer draws when it is present - a closed
     polygon in the same map units. Buildings are never plain rectangles
     in real life: they step, chamfer and wrap around a plaza, and drawing
     that shape is most of what makes a plan read as a place. */
  var OUTLINES = {
    /* stepped north wing, chamfered south-east corner */
    AT:  [[330, 110], [372, 90], [455, 90], [455, 130], [540, 130],
          [540, 296], [514, 320], [330, 320]],
    /* rounded stack with the entrance cut back at the south-west */
    LIB: [[80, 122], [92, 110], [258, 110], [270, 122], [270, 340],
          [152, 340], [152, 320], [80, 320]],
    /* tower on a wider base */
    EA:  [[620, 70], [782, 70], [782, 96], [810, 96], [810, 302],
          [790, 320], [620, 320]],
    /* plaza cut into the north-west corner, chamfer at the south-east */
    HUB: [[350, 422], [422, 400], [550, 400], [550, 558], [520, 580], [350, 580]],
    /* hall with a rounded east end */
    SPT: [[90, 422], [112, 400], [268, 400], [290, 422], [290, 538],
          [268, 560], [90, 560]],
    /* two blocks, the east one set back */
    RES: [[650, 400], [760, 400], [760, 428], [830, 428], [830, 600], [650, 600]]
  };

  var FLOORS = {
    AT:  ['LG1', 'G', '1F', '2F', '3F', '4F'],
    LIB: ['G', '1F', '2F'],
    EA:  ['3F', '4F', '5F', '6F', '7F'],
    HUB: ['LG1', 'G', '1F', '2F'],
    SPT: ['G', '1F'],
    RES: ['G', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F']
  };

  /* Horizontal circulation of each building. y is fixed per building, so a
     spine node is simply (building, floor, x). Rooms hang off the nearest
     spine node - that keeps the hand-written data short and impossible to
     get inconsistent. */
  var SPINES = {
    AT:  { y: 200, xs: [345, 375, 420, 455, 480, 510, 535] },
    LIB: { y: 200, xs: [110, 150, 200, 240, 265] },
    HUB: { y: 480, xs: [350, 370, 410, 450, 490, 550] },
    SPT: { y: 480, xs: [110, 160, 210, 260, 290] },
    EA:  { y: 200, xs: [640, 690, 740, 790] },
    RES: { y: 480, xs: [650, 670, 720, 770, 810] }
  };

  /* Vertical circulation. Lift numbers are deliberately non-obvious:
     Lift 2 is the fast Academic Tower lift but it skips LG1, so a step-free
     trip out of LG1 has to change lifts. */
  var CORES = [
    { id: 'L1', kind: 'lift', label: 1, b: 'AT', x: 480, y: 200, floors: FLOORS.AT,
      wait: 50, perFloor: 6,
      names: { en: 'Lift 1', zh: '1号升降机', yue: '1號𨋢' },
      note: { en: 'stops at every floor LG1-4F (slowest)', zh: 'LG1–4F 每层都停（最慢）', yue: 'LG1–4F 每層都停（最慢）' } },

    { id: 'L2', kind: 'lift', label: 2, b: 'AT', x: 510, y: 200,
      floors: ['G', '1F', '2F', '3F', '4F'], wait: 25, perFloor: 4,
      names: { en: 'Lift 2', zh: '2号升降机', yue: '2號𨋢' },
      note: { en: 'express G-4F, does not serve LG1', zh: 'G–4F 直达，不停 LG1', yue: 'G–4F 直達，唔停 LG1' } },

    { id: 'S1', kind: 'stairs', b: 'AT', x: 345, y: 200, floors: FLOORS.AT,
      names: { en: 'West Stairs', zh: '西楼梯', yue: '西樓梯' } },
    { id: 'S2', kind: 'stairs', b: 'AT', x: 535, y: 200, floors: FLOORS.AT,
      names: { en: 'East Stairs', zh: '东楼梯', yue: '東樓梯' } },

    { id: 'L3', kind: 'lift', label: 3, b: 'LIB', x: 240, y: 200, floors: FLOORS.LIB,
      wait: 35, perFloor: 5,
      names: { en: 'Lift 3', zh: '3号升降机', yue: '3號𨋢' },
      note: { en: 'serves G-2F', zh: '停靠 G–2F', yue: '停 G–2F' } },
    { id: 'S3', kind: 'stairs', b: 'LIB', x: 110, y: 200, floors: FLOORS.LIB,
      names: { en: 'Library Stairs', zh: '图书馆楼梯', yue: '圖書館樓梯' } },

    { id: 'L5', kind: 'lift', label: 5, b: 'HUB', x: 490, y: 480, floors: FLOORS.HUB,
      wait: 30, perFloor: 5,
      names: { en: 'Lift 5', zh: '5号升降机', yue: '5號𨋢' },
      note: { en: 'serves LG1-2F', zh: '停靠 LG1–2F', yue: '停 LG1–2F' } },
    { id: 'ESC', kind: 'escalator', b: 'HUB', x: 450, y: 480, floors: ['G', '1F'], sec: 22,
      names: { en: 'Escalator', zh: '扶梯', yue: '扶手電梯' },
      note: { en: 'G <-> 1F only, not step-free', zh: '只在 G 与 1F 之间，不适合轮椅', yue: '只喺 G 同 1F 之間，輪椅用唔到' } },
    { id: 'S4', kind: 'stairs', b: 'HUB', x: 370, y: 480, floors: FLOORS.HUB,
      names: { en: 'Hub Stairs', zh: '活动中心楼梯', yue: '活動中心樓梯' } },

    { id: 'L7', kind: 'lift', label: 7, b: 'SPT', x: 260, y: 480, floors: FLOORS.SPT,
      wait: 20, perFloor: 5,
      names: { en: 'Lift 7', zh: '7号升降机', yue: '7號𨋢' },
      note: { en: 'serves G-1F', zh: '停靠 G–1F', yue: '停 G–1F' } },
    { id: 'S5', kind: 'stairs', b: 'SPT', x: 110, y: 480, floors: FLOORS.SPT,
      names: { en: 'Sports Centre Stairs', zh: '体育馆楼梯', yue: '體育館樓梯' } },

    { id: 'L4', kind: 'lift', label: 4, b: 'EA', x: 640, y: 200, floors: FLOORS.EA,
      wait: 45, perFloor: 6,
      names: { en: 'Lift 4', zh: '4号升降机', yue: '4號𨋢' },
      note: { en: 'the only step-free way into the Annex (3F-7F)', zh: '工程附楼唯一无障碍通道（3F–7F）', yue: '工程附樓唯一無障礙通道（3F–7F）' } },
    { id: 'S6', kind: 'stairs', b: 'EA', x: 790, y: 200, floors: FLOORS.EA,
      names: { en: 'Annex Stairs', zh: '附楼楼梯', yue: '附樓樓梯' } },

    { id: 'L6', kind: 'lift', label: 6, b: 'RES', x: 810, y: 480, floors: FLOORS.RES,
      wait: 30, perFloor: 4,
      names: { en: 'Lift 6', zh: '6号升降机', yue: '6號𨋢' },
      note: { en: 'serves G-8F', zh: '停靠 G–8F', yue: '停 G–8F' } },
    { id: 'S7', kind: 'stairs', b: 'RES', x: 670, y: 480, floors: FLOORS.RES,
      names: { en: 'Hall Stairs', zh: '宿舍楼梯', yue: '宿舍樓梯' } }
  ];

  /* ---- points of interest ------------------------------------------------
     R(id, building, floor, x, y, poiType, english, chinese, cantonese, aliases)
     Rooms are attached to the nearest spine node of the same floor.       */
  function R(id, b, f, x, y, poi, en, zh, yue, aliases, short) {
    return { id: id, b: b, f: f, x: x, y: y, poi: poi, short: short || null,
             names: { en: en, zh: zh, yue: yue }, aliases: aliases || [] };
  }

  var ROOMS = [
    /* Academic Tower ---------------------------------------------------- */
    R('at-print',    'AT', 'LG1', 390, 160, 'service',  'Print Centre',            '打印中心',        '打印中心',        ['printing']),
    R('at-lockers',  'AT', 'LG1', 455, 250, 'service',  'Locker Room',             '储物柜区',        '儲物櫃區',        ['lockers']),
    R('at-wc-lg1',   'AT', 'LG1', 510, 160, 'restroom', 'Restroom (LG1)',          '洗手间（LG1）',   '洗手間（LG1）',   ['toilet']),
    R('at-registry', 'AT', 'G',   390, 160, 'admin',    'Registry Counter',        '教务处柜台',      '教務處櫃檯',      ['registry','administration office'], 'Registry'),
    R('at-atrium',   'AT', 'G',   455, 250, 'lobby',    'Atrium',                  '中庭大堂',        '中庭大堂',        ['lobby','中庭','大堂']),
    R('at-wc-g',     'AT', 'G',   510, 160, 'restroom', 'Restroom (G/F)',          '洗手间（G/F）',   '洗手間（G/F）',   ['toilet']),
    R('at-south',    'AT', 'G',   420, 318, 'entrance', 'South Entrance',          '南门',            '南門'),
    R('at-cr101',    'AT', '1F',  375, 160, 'classroom','CR-101',                  'CR-101 教室',     'CR-101 課室'),
    R('at-cr102',    'AT', '1F',  420, 160, 'classroom','CR-102',                  'CR-102 教室',     'CR-102 課室'),
    R('at-cr103',    'AT', '1F',  455, 160, 'classroom','CR-103',                  'CR-103 教室',     'CR-103 課室'),
    R('at-cr104',    'AT', '1F',  535, 160, 'classroom','CR-104',                  'CR-104 教室',     'CR-104 課室'),
    R('at-st201',    'AT', '2F',  390, 160, 'study',    'ST-201',                  'ST-201 研讨室',   'ST-201 研討室'),
    R('at-st202',    'AT', '2F',  455, 160, 'study',    'ST-202',                  'ST-202 研讨室',   'ST-202 研討室'),
    R('at-wc-2f',    'AT', '2F',  510, 250, 'restroom', 'Restroom (2/F)',          '洗手间（2/F）',   '洗手間（2/F）',   ['toilet']),
    R('at-lt1',      'AT', '3F',  455, 255, 'lecture',  'LT-1 Lecture Theatre',    'LT-1 演讲厅',     'LT-1 演講廳',     ['lt1','lt-1','lecture theatre 1','lecture theater 1']),
    R('at-sr301',    'AT', '3F',  390, 160, 'meeting',  'SR-301 Seminar Room',     'SR-301 研讨室',   'SR-301 研討室',   null, 'SR-301'),
    R('at-lt2',      'AT', '4F',  455, 255, 'lecture',  'LT-2 Lecture Theatre',    'LT-2 演讲厅',     'LT-2 演講廳',     ['lt2','lt-2','lecture theatre 2','lecture theater 2']),
    R('at-office',   'AT', '4F',  390, 160, 'admin',    'Staff Offices',           '教职员办公室',    '教職員辦公室',    ['office'], 'Staff Office'),
    R('at-wc-4f',    'AT', '4F',  510, 160, 'restroom', 'Restroom (4/F)',          '洗手间（4/F）',   '洗手間（4/F）',   ['toilet']),

    /* Library ----------------------------------------------------------- */
    R('lib-counter', 'LIB','G',   150, 160, 'service',  'Borrow & Return Counter','借还书柜台',      '借還書櫃檯',      null, 'Borrow Desk'),
    R('lib-entrance','LIB','G',   110, 320, 'entrance', 'Library Main Entrance',   '图书馆正门',      '圖書館正門',      ['library entrance'], 'Main Entrance'),
    R('lib-wc-g',    'LIB','G',   200, 250, 'restroom', 'Restroom (Library G/F)',  '洗手间（图书馆 G/F）','洗手間（圖書館 G/F）', ['toilet']),
    R('lib-silent',  'LIB','1F',  150, 160, 'study',    'Silent Study Zone',       '静音自习区',      '靜音自習區',      ['quiet study']),
    R('lib-dr101',   'LIB','1F',  200, 160, 'meeting',  'Discussion Room DR-101',  '讨论室 DR-101',   '討論室 DR-101',   null, 'DR-101'),
    R('lib-print',   'LIB','1F',  240, 160, 'service',  'Print Station',           '打印站',          '打印站'),
    R('lib-dr201',   'LIB','2F',  150, 160, 'meeting',  'Discussion Room DR-201',  '讨论室 DR-201',   '討論室 DR-201',   null, 'DR-201'),
    R('lib-journals','LIB','2F',  200, 160, 'study',    'Journal Collection',      '期刊区',          '期刊區'),

    /* Student Hub ------------------------------------------------------- */
    R('hub-coffee',  'HUB','LG1', 390, 430, 'cafe',     'Coffee Shop',             '咖啡店',          '咖啡店',          ['cafe','coffee','starbucks']),
    R('hub-canteen', 'HUB','LG1', 470, 430, 'food',     'Food Court',              '学生食堂',        '學生食堂',        ['canteen','cafeteria']),
    R('hub-wc-lg1',  'HUB','LG1', 430, 540, 'restroom', 'Restroom (Hub LG1)',      '洗手间（活动中心 LG1）','洗手間（活動中心 LG1）', ['toilet']),
    R('hub-lobby',   'HUB','G',   470, 540, 'lobby',    'Student Hub Lobby',       '学生中心大堂',    '學生活動中心大堂', ['hub lobby'], 'Hub Lobby'),
    R('hub-wc-g',    'HUB','G',   390, 540, 'restroom', 'Restroom (Hub G/F)',      '洗手间（活动中心 G/F）','洗手間（活動中心 G/F）', ['toilet']),
    R('hub-union',   'HUB','G',   510, 430, 'admin',    'Student Union Office',    '学生会办公室',    '學生會辦公室',    null, 'Union Office'),
    R('hub-lounge',  'HUB','1F',  390, 430, 'study',    'Study Lounge',            '自习休息区',      '自習休息區'),
    R('hub-wc-1f',   'HUB','1F',  470, 540, 'restroom', 'Restroom (Hub 1/F)',      '洗手间（活动中心 1/F）','洗手間（活動中心 1/F）', ['toilet']),
    R('hub-mr201',   'HUB','2F',  390, 430, 'meeting',  'Meeting Room MR-201',     '会议室 MR-201',   '會議室 MR-201',   null, 'MR-201'),
    R('hub-music',   'HUB','2F',  470, 430, 'meeting',  'Music Room',              '音乐室',          '音樂室'),

    /* Sports Centre ----------------------------------------------------- */
    R('spt-gym',     'SPT','G',   160, 440, 'gym',      'Gym Entrance',            '体育馆入口',      '體育館入口',      ['gym']),
    R('spt-equip',   'SPT','G',   210, 440, 'gym',      'Equipment Room',          '器材室',          '器材室'),
    R('spt-change',  'SPT','1F',  160, 440, 'gym',      'Changing Rooms',          '更衣室',          '更衣室',          ['locker room','changing room']),
    R('spt-wc',      'SPT','1F',  210, 440, 'restroom', 'Restroom (Sports Centre)','洗手间（体育馆）','洗手間（體育館）', ['toilet']),

    /* Engineering Annex -------------------------------------------------- */
    R('ea-cl301',    'EA', '3F',  690, 160, 'lab',      'Computer Lab CL-301',     '机房 CL-301',     '機房 CL-301',     ['computer room'], 'CL-301'),
    R('ea-helpdesk', 'EA', '3F',  740, 160, 'service',  'IT Help Desk',            '信息技术服务台',  '資訊科技服務台',  ['it support']),
    R('ea-lab401',   'EA', '4F',  690, 160, 'lab',      'Lab 401',                 '401 实验室',      '401 實驗室'),
    R('ea-lab402',   'EA', '4F',  740, 160, 'lab',      'Lab 402',                 '402 实验室',      '402 實驗室'),
    R('ea-lab501',   'EA', '5F',  690, 160, 'lab',      'Lab 501',                 '501 实验室',      '501 實驗室'),
    R('ea-sr501',    'EA', '5F',  740, 240, 'meeting',  'Seminar Room SR-501',     '研讨室 SR-501',   '研討室 SR-501',   null, 'SR-501'),
    R('ea-lab601',   'EA', '6F',  690, 160, 'lab',      'Lab 601',                 '601 实验室',      '601 實驗室'),
    R('ea-offices',  'EA', '6F',  740, 160, 'admin',    'Annex Staff Offices',     '附楼办公室',      '附樓辦公室',      null, 'Annex Office'),
    R('ea-server',   'EA', '7F',  690, 160, 'service',  'Server Room',             '服务器机房',      '伺服器機房'),
    R('ea-robot',    'EA', '7F',  740, 160, 'lab',      'Advanced Robotics Lab',   '高级机器人实验室','高級機械人實驗室', ['robotics lab','robot lab'], 'Robotics Lab'),

    /* Residence Hall ----------------------------------------------------- */
    R('res-lobby',   'RES','G',   690, 540, 'lobby',    'Residence Lobby',         '宿舍大堂',        '宿舍大堂',        ['hall lobby'], 'Hall Lobby'),
    R('res-laundry', 'RES','G',   770, 440, 'service',  'Laundry Room',            '洗衣房',          '洗衣房',          ['laundry'], 'Laundry'),
    R('res-common',  'RES','1F',  690, 440, 'lounge',   'Common Room',             '公共休息室',      '公共休息室'),
    R('res-wc-1f',   'RES','1F',  770, 540, 'restroom', 'Restroom (Hall 1/F)',     '洗手间（宿舍 1/F）','洗手間（宿舍 1/F）', ['toilet']),
    R('res-str201',  'RES','2F',  690, 440, 'study',    'Study Room R-201',        '自习室 R-201',    '自習室 R-201',    null, 'R-201'),
    R('res-str301',  'RES','3F',  690, 440, 'study',    'Study Room R-301',        '自习室 R-301',    '自習室 R-301',    null, 'R-301')
  ];

  /* Building-to-building links. Endpoints are coordinates: if a spine node
     already exists there it is reused, otherwise a junction node is created
     and hooked onto the nearest spine node of that floor.
     Note: the Library has NO ground-level door to the plaza - the podium
     path is fenced off - so the 2/F skybridge is the only direct link to
     the Academic Tower. That is why some routes seem to go up first. */
  var LINKS = [
    { kind: 'skybridge', a: { b: 'AT',  f: '2F', x: 345, y: 200 }, b: { b: 'LIB', f: '2F', x: 265, y: 200 } },
    { kind: 'walkway',   a: { b: 'AT',  f: '3F', x: 535, y: 200 }, b: { b: 'EA',  f: '3F', x: 640, y: 200 } },
    { kind: 'outdoor',   a: { b: 'AT',  f: 'G',  x: 420, y: 318 }, b: { b: 'HUB', f: 'G',  x: 410, y: 400 } },
    { kind: 'corridor',  a: { b: 'HUB', f: '1F', x: 350, y: 480 }, b: { b: 'SPT', f: '1F', x: 290, y: 480 } },
    { kind: 'outdoor',   a: { b: 'HUB', f: 'G',  x: 550, y: 480 }, b: { b: 'RES', f: 'G',  x: 650, y: 480 } }
  ];

  /* ---- the spec ---------------------------------------------------------
     Everything above is data. `buildCampus` (src/data/graph.js) turns it
     into nodes, edges and the lookups the rest of the app uses, so the
     same renderer, router and NLU run on this campus and on HKUST. */
  var SPEC = {
    id: 'fust-demo',
    meta: {
      name: { en: 'Freefish University of Science and Technology',
              zh: 'Freefish 科技大学', yue: 'Freefish 科技大學' },
      note: { en: 'Fictional campus built for AISC1000A (LA12) Group 16.',
              zh: 'AISC1000A（LA12）第 16 组的虚构校园数据。',
              yue: 'AISC1000A（LA12）第 16 組嘅虛構校園數據。' },
      dataSource: { en: 'fictional', zh: '虚构', yue: '虛構' },
      geometry: 'schematic',
      /* the three origins / five destinations offered before the user has
         typed anything - the demo's favourite teaching examples */
      popular: {
        origin: ['at-atrium', 'lib-entrance', 'hub-lobby'],
        dest: ['at-lt1', 'lib-silent', 'hub-canteen', 'ea-robot', 'res-lobby']
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

    /* Deliberate facts the data check asserts, so a careless edit to the
       lift table cannot quietly delete the demo's whole point. */
    QUIRKS: [
      { kind: 'core-absent', core: 'L2', b: 'AT', f: 'LG1',
        why: 'Lift 2 is the fast tower lift and skips LG1, which is what forces the two-lift route' }
    ]
  };

  globalThis.FUST = globalThis.FUST || {};
  globalThis.FUST.CampusDemo = globalThis.FUST.buildCampus(SPEC);
  globalThis.FUST.Campus = globalThis.FUST.CampusDemo;
})();
