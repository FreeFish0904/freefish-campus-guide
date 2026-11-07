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

  /* Building aliases. Two-letter codes (AT, EA...) are only accepted when
     the user actually typed them in capitals, otherwise "I am at the
     Atrium" would be read as the Academic Tower. */
  var BUILDING_ALIASES = {
    AT:  ['academic tower', 'academic', 'the tower', 'tower', '主楼', '教学主楼', '學術樓', '学术楼'],
    LIB: ['library', 'the library', 'lib', '图书馆', '圖書館'],
    EA:  ['engineering annex', 'annex', 'engineering', 'ea', '工程附楼', '工程附樓'],
    HUB: ['student hub', 'hub', 'student centre', 'student center', 'hub', '学生活动中心', '學生活動中心', '活动中心', '活動中心'],
    SPT: ['sports centre', 'sports center', 'sports', 'sports complex', 'gym building', 'spt', '体育馆', '體育館'],
    RES: ['residence hall', 'residence', 'dorm', 'dormitory', 'hall', 'res', '宿舍楼', '宿舍樓', '宿舍']
  };

  var BUILDING_ENTRY = {
    AT: 'at-south', LIB: 'lib-entrance', HUB: 'hub-lobby',
    SPT: 'spt-gym', RES: 'res-lobby', EA: null
  };

  Object.keys(BUILDING_ALIASES).forEach(function (b) {
    var pseudo = { id: 'B-' + b, kind: 'building', names: C.BUILDINGS[b].names, aliases: BUILDING_ALIASES[b] };
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
      var entry = BUILDING_ENTRY[b];
      if (entry && C.node(entry)) { return C.node(entry); }
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

  var POPULAR = {
    origin: ['at-atrium', 'lib-entrance', 'hub-lobby'],
    dest: ['at-lt1', 'lib-silent', 'hub-canteen', 'ea-robot', 'res-lobby']
  };

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
