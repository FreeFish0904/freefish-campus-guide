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
    'clarify.help':      { en: 'Try: "I am at the Library entrance, how do I get to LT-1?" or "where is the nearest restroom?"',
                           zh: '可以这样说：“我在图书馆正门，怎么去 LT-1？”或者“最近的洗手间在哪？”',
                           yue: '可以咁講：「我喺圖書館正門，點去 LT-1？」或者「最近嘅洗手間喺邊？」' },
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
