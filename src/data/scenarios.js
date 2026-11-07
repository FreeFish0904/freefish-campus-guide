/* =====================================================================
 * The five demo queries. Each one exercises a different part of the
 * system, and each is written natively in all three languages.
 * The list follows the campus that is loaded: ?data=ust shows the HKUST
 * questions, the default in tests is the fictional demo campus.
 * ===================================================================== */
(function () {
  'use strict';

  globalThis.FUST = globalThis.FUST || {};

  var DEMO = [
    {
      id: 'cross-building',
      title: { en: 'Library → LT-1', zh: '图书馆 → LT-1', yue: '圖書館 → LT-1' },
      note: {
        en: 'Two lifts and the 2/F skybridge.',
        zh: '两部电梯加 2 楼空中连廊。',
        yue: '兩部𨋢加 2 樓天橋。'
      },
      query: {
        en: 'I am at the Library main entrance, how do I get to LT-1?',
        zh: '我在图书馆正门，怎么去 LT-1？',
        yue: '我喺圖書館正門，點去 LT-1？'
      }
    },
    {
      id: 'step-free-chain',
      title: { en: 'Coffee → Annex 7F', zh: '咖啡店 → 附楼 7 楼', yue: '咖啡店 → 附樓 7 樓' },
      note: {
        en: 'Hub LG1 to the robotics lab with no stairs.',
        zh: '由活动中心 LG1 到 7 楼实验室，全程不走楼梯。',
        yue: '由活動中心 LG1 上 7 樓實驗室，全程唔行樓梯。'
      },
      query: {
        en: 'I am at the coffee shop in the Hub LG1, how do I get to the robotics lab on 7F of the Engineering Annex without stairs?',
        zh: '我在学生活动中心 LG1 的咖啡店，要去工程附楼 7 楼的高级机器人实验室，不想走楼梯',
        yue: '我喺學生活動中心 LG1 嘅咖啡店，要去工程附樓 7 樓嘅高級機械人實驗室，唔想行樓梯'
      }
    },
    {
      id: 'nearest-poi',
      title: { en: 'Nearest restroom', zh: '最近的洗手间', yue: '最近嘅洗手間' },
      note: {
        en: 'A point-of-interest search, not a named room.',
        zh: '按类型搜索，不用说出房间编号。',
        yue: '按類型搵，唔使講房號。'
      },
      query: {
        en: "Where's the nearest restroom? I'm in the Atrium.",
        zh: '最近的洗手间在哪里？我在中庭',
        yue: '最近嘅洗手間喺邊？我喺中庭大堂'
      }
    },
    {
      id: 'fastest-vs-stepfree',
      title: { en: 'Fastest vs step-free', zh: '最快 vs 无障碍', yue: '最快 vs 無障礙' },
      note: {
        en: 'Same trip, two routes, time cost shown.',
        zh: '同一段路两种走法，直接显示时间差。',
        yue: '同一段路兩種行法，直接顯示時間差。'
      },
      query: {
        en: 'Fastest way from the Library to Lab 402?',
        zh: '从图书馆去 Lab 402 最快怎么走？',
        yue: '圖書館去 Lab 402 最快點行？'
      }
    },
    {
      id: 'typo',
      title: { en: 'Typo rescue', zh: '错字纠正', yue: '錯字糾正' },
      note: {
        en: 'Keyboard-smash spelling still resolves.',
        zh: '打错字也能猜对，并告诉你改了什么。',
        yue: '打錯字都估得到，仲會話你知改咗乜。'
      },
      query: {
        en: 'libary entraince to lt 1 pls',
        zh: 'libary entraince to lt 1 pls',
        yue: 'libary entraince to lt 1 pls'
      }
    }
  ];

  /* HKUST: the same five kinds of question, on the real campus. */
  var UST = [
    {
      id: 'library-to-canteen',
      title: { en: 'Library → LG1 Canteen', zh: '图书馆 → LG1 食堂', yue: '圖書館 → LG1 食堂' },
      note: {
        en: 'Out of the library, along the LG1 concourse, down to the canteen.',
        zh: '出图书馆，走 LG1 连廊，下到食堂。',
        yue: '出圖書館，行 LG1 連廊，落到食堂。'
      },
      query: {
        en: "I'm at the library entrance, how do I get to the LG1 Canteen?",
        zh: '我在图书馆入口，怎么去 LG1 食堂？',
        yue: '我喺圖書館入口，點去 LG1 食堂？'
      }
    },
    {
      id: 'two-lift-banks',
      title: { en: 'LG7 → LT-A', zh: 'LG7 → LT-A', yue: 'LG7 → LT-A' },
      note: {
        en: 'The canteen bank stops at G/F, so this trip changes lifts once.',
        zh: '食堂那部升降机只到 G 层，所以要换一次电梯。',
        yue: '食堂嗰部𨋢只到 G 層，所以要換一次𨋢。'
      },
      query: {
        en: 'Fastest way from the LG7 canteen to LT-A?',
        zh: '从 LG7 食堂去 LT-A 最快怎么走？',
        yue: '由 LG7 食堂去 LT-A 最快點行？'
      }
    },
    {
      id: 'nearest-restroom',
      title: { en: 'Nearest restroom', zh: '最近的洗手间', yue: '最近嘅洗手間' },
      note: {
        en: 'A type search, not a room number.',
        zh: '按类型找，不用报房间号。',
        yue: '按類型搵，唔使講房號。'
      },
      query: {
        en: "Where's the nearest restroom? I'm in the Academic Concourse.",
        zh: '最近的洗手间在哪里？我在学术大楼大堂',
        yue: '最近嘅洗手間喺邊？我喺學術大樓大堂'
      }
    },
    {
      id: 'bus-to-mtr',
      title: { en: 'Piazza → bus stop', zh: '广场 → 巴士站', yue: '廣場 → 巴士站' },
      note: {
        en: 'The 91 / 91M / 792M stop is on the entrance side.',
        zh: '91 / 91M / 792M 在入口那一侧。',
        yue: '91 / 91M / 792M 喺入口嗰邊。'
      },
      query: {
        en: 'How do I get from the Piazza to the bus stop?',
        zh: '从大学广场怎么去巴士站？',
        yue: '由大學廣場點去巴士站？'
      }
    },
    {
      id: 'typo',
      title: { en: 'Typo rescue', zh: '错字纠正', yue: '錯字糾正' },
      note: {
        en: 'Keyboard-smash spelling still resolves.',
        zh: '打错字也能猜对，并告诉你改了什么。',
        yue: '打錯字都估得到，仲會話你知改咗乜。'
      },
      query: {
        en: 'libary seaview to lg 1 canteen pls',
        zh: 'libary seaview to lg 1 canteen pls',
        yue: 'libary seaview to lg 1 canteen pls'
      }
    }
  ];

  globalThis.FUST.SCENARIOS = (globalThis.FUST.dataset === 'ust') ? UST : DEMO;
})();
