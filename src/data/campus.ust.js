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
      ['lg7 canteen', 'lg 7 canteen', 'lg7', 'lg 7', 'canteen', 'lg7 食堂', 'lg 7 食堂', '科大全餐', '全餐', '食堂'], 'LG7 Canteen', true),
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
      ['lg1 canteen', 'lg 1 canteen', 'canteen', 'maxims', 'maxim', 'lg1 食堂', 'lg 1 食堂', '美心', '食堂', '烧鸭'], 'LG1 Canteen', true),
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
