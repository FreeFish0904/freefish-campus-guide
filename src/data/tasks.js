/* =====================================================================
 * Newcomer checklist - the "what do I actually have to do" layer.
 * ---------------------------------------------------------------------
 * The route planner answers "how do I get there"; this answers "what is
 * there to get done". Both come from the same source: the newcomer guide
 * in data/ust-newcomer.txt, plus hkust.edu.hk and the registry pages.
 *
 * Each item carries a `src` (the section of the guide it came from) and,
 * where the guide names a place that exists on this map, an `at` room id.
 * `at` is what turns a checkbox into a "Go" button: the checklist asks
 * the same planner the chat box asks, so a task and a question can never
 * disagree about where something is.
 *
 * `offsite: true` means the step happens off campus (immigration office,
 * bank branch). The map cannot help, so the UI does not pretend it can.
 * ===================================================================== */
(function () {
  'use strict';

  var GROUPS = [
    { id: 'offer', when: 'before',
      title: { en: 'Before you arrive', zh: '入学前', yue: '入學前' },
      note: { en: 'Paperwork that has a deadline attached.',
              zh: '这些都有截止日期。',
              yue: '呢啲都有截止日期。' } },

    { id: 'cards', when: 'week1',
      title: { en: 'Four cards, one ID', zh: '四卡一证', yue: '四卡一證' },
      note: { en: 'What everyone asks about in the first week.',
              zh: '开学第一周问得最多的就是这个。',
              yue: '開學第一週問得最多就係呢個。' } },

    { id: 'courses', when: 'before',
      title: { en: 'Course selection (SIS)', zh: '选课（SIS）', yue: '選課（SIS）' },
      note: { en: 'Shopping Cart, then your appointment, then Add/Drop.',
              zh: '先放购物车，再按预约时间提交，最后 Add/Drop。',
              yue: '先放購物車，再按預約時間提交，最後 Add/Drop。' } },

    { id: 'campus', when: 'week1',
      title: { en: 'First days on campus', zh: '到校头几天', yue: '到校頭幾日' },
      note: { en: 'The places worth knowing before week one ends.',
              zh: '开学第一周结束前值得先摸清的地方。',
              yue: '開學第一週完之前值得先摸清嘅地方。' } },

    { id: 'life', when: 'term',
      title: { en: 'Money, software, apps', zh: '省钱、软件、App', yue: '慳錢、軟件、App' },
      note: { en: 'Small wins that add up over a term.',
              zh: '一学期下来能省下不少。',
              yue: '一個學期落嚟慳到唔少。' } }
  ];

  function T(id, group, at, en, zh, yue, noteEn, noteZh, noteYue, opt) {
    opt = opt || {};
    return {
      id: id,
      group: group,
      at: at || null,
      offsite: !!opt.offsite,
      src: opt.src || '',
      tag: opt.tag || null,
      title: { en: en, zh: zh, yue: yue || zh },
      note: { en: noteEn, zh: noteZh, yue: noteYue || noteZh }
    };
  }

  var ITEMS = [];

  /* ---- before you arrive ------------------------------------------- */
  ITEMS.push(
    T('accept-offer', 'offer', null,
      'Accept the offer and upload the documents',
      '接受 offer，上传换取 firm offer 的文件',
      '接受 offer，上載換取 firm offer 嘅文件',
      'Degree certificate, transcript, language score, and the CHSI verification. Missing the deadline can cost you the place.',
      '学位证、毕业证、成绩单、语言成绩，并同步提交学信网认证。逾期可能直接撤回名额。',
      '學位證、畢業證、成績單、語言成績，同時提交學信網認證。逾期可能直接撤回名額。',
      { src: '§2 入学前准备' }),

    T('student-account', 'offer', 'ust-lg1-itsc',
      'Register the ITSC account and Duo Mobile',
      '注册 ITSC 账号并装好 Duo Mobile',
      '註冊 ITSC 帳號並裝好 Duo Mobile',
      'One account opens SIS, Canvas, the mail and the lab machines. Duo is the second factor - set it up before the first quiz.',
      '同一个账号进 SIS、Canvas、邮箱和机房电脑；Duo 是二次验证，第一次小测前一定要装好。',
      '同一個帳號入 SIS、Canvas、電郵同機房電腦；Duo 係二次驗證，第一次小測前一定要裝好。',
      { src: '§2, §13 必备 APP' }),

    T('visa', 'offer', null,
      'Student visa, NOL, then the D endorsement',
      '学生签注、NOL，再办逗留签（D 签）',
      '學生簽注、NOL，再辦逗留簽（D 簽）',
      'The visa comes as an e-visa with a No Objection Letter. The D endorsement can only be applied for after it, and takes about 15 days.',
      '学生签注现在是电子签，会附不反对信（NOL）；D 签要拿到学生签之后再办，约 15 天。',
      '學生簽注依家係電子簽，會附不反對信（NOL）；D 簽要拿到學生簽之後再辦，約 15 天。',
      { offsite: true, src: '§3 四卡一证' }),

    T('fees', 'offer', null,
      'Pay tuition and the deposit',
      '缴学费和押金',
      '繳學費同押金',
      'Tuition is due before each term. The deposit is a float the library and other services draw on, not a fee you lose.',
      '每学期开学前缴学费；押金是图书馆等扣费的预付款，不是白交的钱。',
      '每學期開學前繳學費；押金係圖書館等扣費嘅預付款，唔係白交嘅錢。',
      { src: '§2 入学前准备' })
  );

  /* ---- four cards, one ID ------------------------------------------ */
  ITEMS.push(
    T('hkid', 'cards', null,
      'Apply for the HKID within 30 days',
      '抵港 30 天内办香港身份证',
      '抵港 30 日內辦香港身份證',
      'Book first, then go in person; about seven working days to collect. Carry it (the paper one counts) - the police can fine you without it.',
      '要先预约再线下办理，约 7 个工作日可取。出门随身带，临时纸本也算，否则可能被罚。',
      '要先預約再線下辦理，約 7 個工作天可取。出街隨身帶，臨時紙本都算，否則可能被罰。',
      { offsite: true, tag: '一证', src: '§3 四卡一证' }),

    T('student-card', 'cards', null,
      'Collect the student card',
      '领学生卡',
      '領學生卡',
      'Needs the full registration pack: ID, visa, landing slip, and a photo. It opens the library, the pool and the printers.',
      '要课程注册文件齐全：身份证明、签证、入境标签、证件照。图书馆、游泳池、打印机都靠它。',
      '要課程註冊文件齊全：身份證明、簽證、入境標籤、證件相。圖書館、泳池、打印機都靠佢。',
      { tag: '卡 1', src: '§3 四卡一证' }),

    T('octopus', 'cards', null,
      'Get an Octopus with student concession',
      '办一张学生八达通',
      '辦一張學生八達通',
      'Physical or virtual, either works. The student rate halves the 91M fare to the MTR, and the shuttle to the station is free.',
      '实体卡或虚拟卡都行。学生价坐 91M 去地铁站半价，去地铁站的接驳车不要钱。',
      '實體卡或虛擬卡都得。學生價坐 91M 去地鐵站半價，去地鐵站嘅接駁車唔使錢。',
      { offsite: true, tag: '卡 2', src: '§3, §4 交通' }),

    T('sim-card', 'cards', null,
      'Buy a local SIM',
      '办一张本地电话卡',
      '辦一張本地電話卡',
      'Needed for the bank and app verification codes. Do it the same week as the bank account, not after.',
      '银行和 App 的验证码都要它。跟银行卡同一周办，别拖。',
      '銀行同 App 嘅驗證碼都要佢。同銀行卡同一週辦，唔好拖。',
      { offsite: true, tag: '卡 3', src: '§3 四卡一证' }),

    T('bank', 'cards', 'ust-lg1-atm',
      'Open a Hong Kong bank account',
      '开香港银行账户',
      '開香港銀行戶口',
      'A branch job, but the ATM on LG1 covers cash until then - useful the day the canteen stops taking your card.',
      '开户要去分行，但 LG1 有柜员机可以先取现金，食堂刷不了卡的那天很有用。',
      '開戶要去分行，但 LG1 有櫃員機可以先攞現金，食堂刷唔到卡嗰日好有用。',
      { tag: '卡 4', src: '§3 四卡一证' })
  );

  /* ---- course selection -------------------------------------------- */
  ITEMS.push(
    T('shopping-cart', 'courses', null,
      'Fill the Shopping Cart and Validate',
      '把课放进购物车并 Validate',
      '將課放入購物車並 Validate',
      'Validation only checks the prerequisites - it does not reserve a seat. 26Fall opened on 21 Aug.',
      'Validate 只检查选课条件，不占位子。26Fall 是 8 月 21 日开放。',
      'Validate 只檢查選課條件，唔會留位。26Fall 係 8 月 21 日開放。',
      { src: '§6 选课' }),

    T('enrollment', 'courses', null,
      'Find your own Enrollment Appointment',
      '查自己的选课预约时间',
      '查自己嘅選課預約時間',
      'SIS - Student Center - Enrollment Dates. Year 1 undergraduates were 26 Aug, and everyone gets a different clock time.',
      'SIS → Student Center → Enrollment Dates。本科 Year 1 是 8 月 26 日，每个人具体时间不一样。',
      'SIS → Student Center → Enrollment Dates。本科 Year 1 係 8 月 26 日，每個人具體時間唔同。',
      { src: '§6 选课' }),

    T('pre-enrolled', 'courses', null,
      'Check what you are already enrolled in',
      '先看学校已经帮你选了什么',
      '先睇學校已經幫你揀咗乜',
      'Pre-enrolled courses are already confirmed - do not put them in the cart again. Dropping a required course may need approval.',
      'Pre-enrolled 的课已经是 Confirmed Enrollment，不用再放购物车；必修课要 drop 可能要申请审批。',
      'Pre-enrolled 嘅課已經係 Confirmed Enrollment，唔使再放購物車；必修課要 drop 可能要申請審批。',
      { src: '§6 选课' }),

    T('add-drop', 'courses', null,
      'Keep 1-2 plan Bs for Add/Drop',
      '每门课备 1-2 个 Plan B',
      '每門課備 1-2 個 Plan B',
      'Add/Drop ran 1-14 Sep. Use the Timetable Planner, join the waitlist, and Swap rather than Drop so you keep the seat until the new one lands.',
      'Add/Drop 是 9 月 1–14 日。用 Timetable Planner 排时间，满课进 Waitlist，换课用 Swap 而不是先 Drop。',
      'Add/Drop 係 9 月 1–14 日。用 Timetable Planner 排時間，滿課入 Waitlist，換課用 Swap 而唔係先 Drop。',
      { src: '§6 选课' })
  );

  /* ---- first days on campus ---------------------------------------- */
  ITEMS.push(
    T('canteens', 'campus', 'ust-lg1-canteen',
      'Find all three canteens',
      '把三个食堂都找到',
      '將三個食堂都搵到',
      'LG1 (Maxim\'s), LG5 (McDonald\'s, open all night in exam weeks) and LG7, where the "UST set meal" is two dishes, rice and a drink for HK$38.',
      'LG1 美心、LG5 麦当劳（考试周通宵）、LG7。「科大全餐」两菜一饭一饮料 38 港币。',
      'LG1 美心、LG5 麥當勞（考試週通宵）、LG7。「科大全餐」兩菜一飯一飲品 38 蚊。',
      { src: '§8 餐饮' }),

    T('study-24h', 'campus', 'ust-lib-24h',
      'Bookmark the 24-hour study area',
      '认一下 24 小时自习区',
      '認一下 24 小時自習區',
      'Library G/F, plenty of sockets and an air-conditioning system set to fridge. Bring a jacket.',
      '图书馆 G 层，插座多，冷气像冰窖。记得带外套。',
      '圖書館 G 層，插座多，冷氣似雪櫃。記得帶外套。',
      { src: '§9 自习地点' }),

    T('sea-view', 'campus', 'ust-lib-seaview',
      'Get a sea-view seat at least once',
      '至少抢一次海景座位',
      '至少搶一次海景座位',
      'Top floor of the library. They go by 8am, so this is a morning task, not an afternoon one.',
      '图书馆顶楼。早上 8 点就没了，所以这是早上的任务。',
      '圖書館頂樓。朝早 8 點就冇晒，所以呢個係朝早嘅任務。',
      { src: '§9 自习地点' }),

    T('pool', 'campus', 'ust-spt-pool',
      'Book the pool (it is free)',
      '预约体育馆游泳池（免费）',
      '預約體育館泳池（免費）',
      'Booking is the only thing between you and a free swim. Sports Centre, 1/F.',
      '只要预约就能免费游。体育馆 1 楼。',
      '只要預約就可以免費游。體育館 1 樓。',
      { src: '§9, §10 福利' }),

    T('print', 'campus', 'ust-lib-print',
      'Top up and print something',
      '先充值，打印一次试试',
      '先增值，打印一次試下',
      'Printers are on library G/F. Do one page before the morning you actually need forty.',
      '打印机在图书馆 G 层。别等到真要打四十页那天才试。',
      '打印機喺圖書館 G 層。唔好等到真係要打四十頁嗰日先試。',
      { src: '§9 设施' }),

    T('typhoon', 'campus', 'ust-lg3-store',
      'Buy a proper umbrella before typhoon season',
      '台风季前买把扎实的伞',
      '颱風季前買把紮實嘅遮',
      'The Students\' Union store on LG3 sells folding umbrellas that survive Clear Water Bay wind. Cheaper than replacing three bad ones.',
      'LG3 学生会便利店的折叠伞扛得住清水湾的风，比换三把烂伞划算。',
      'LG3 學生會便利店嘅摺遮頂得住清水灣嘅風，比換三把爛遮划算。',
      { src: '§12 生活小贴士' })
  );


  /* ---- money, software, apps --------------------------------------- */
  ITEMS.push(
    T('discounts', 'life', 'ust-g-bookstore',
      'Use the student discounts',
      '把学生优惠用上',
      '將學生優惠用上',
      'Su store takes 10% off, the G/F bookstore has a student price, and ParknShop discounts bread and salad after 8pm. The student card is the coupon.',
      'Su store 学生 9 折，G 层书店有学生价，百佳晚上 8 点后面包沙拉打折。学生卡就是优惠券。',
      'Su store 學生 9 折，G 層書店有學生價，百佳夜晚 8 點後麵包沙律打折。學生卡就係優惠券。',
      { src: '§8, §10 福利' }),

    T('software', 'life', 'ust-lg1-itsc',
      'Activate Microsoft 365 and MATLAB',
      '激活 Microsoft 365 和 MATLAB',
      '啟用 Microsoft 365 同 MATLAB',
      'Both come with the school account. Asking ITSC on LG1 is faster than reading the licence page.',
      '两个都跟学校账号走。直接去 LG1 问 ITSC 比看授权页面快。',
      '兩個都跟學校帳號走。直接去 LG1 問 ITSC 比睇授權頁面快。',
      { src: '§10 福利' }),

    T('apps', 'life', null,
      'Install the six apps',
      '装好六个 App',
      '裝好六個 App',
      'Canvas (courses), Duo Mobile (login), HKUST Student (grades, wallet, bookings), USTing (timetable, library rooms, laundry), iLearn (SFQ and iPRS), Path Advisor (the official map).',
      'Canvas（上课）、Duo Mobile（登录）、HKUST Student（成绩、钱包、订场）、USTing（课表、图书馆小房间、洗衣）、iLearn（SFQ、iPRS）、Path Advisor（官方地图）。',
      'Canvas（上課）、Duo Mobile（登入）、HKUST Student（成績、錢包、訂場）、USTing（時間表、圖書館細房、洗衣）、iLearn（SFQ、iPRS）、Path Advisor（官方地圖）。',
      { src: '§13 必备 APP' })
  );

  /* Advice that is not a checkbox: no deadline, no place, but a newcomer
     should still hear it. Kept separate so the progress counter stays
     honest - "18 of 22 tasks" should mean 18 things actually done. */
  var TIPS = [
    { id: 'boar',
      text: { en: 'The most senior alumnus you will meet is a wild boar. He is on the merchandise, and he visits often.',
              zh: '你会在科大喝到最重要的一位“老学长”——一头野猪。它出现在文创上，也常回母校。',
              yue: '你會喺科大遇到最重要嘅「老學長」——一隻野豬。佢出現喺文創上，都常返母校。' },
      src: '§12' },

    { id: 'career',
      text: { en: 'The Career Center hands out LinkedIn Premium and referrals; the referral matters more than the Premium.',
              zh: 'Career Center 给 LinkedIn Premium，也给内推；内推比 Premium 值钱。',
              yue: 'Career Center 派 LinkedIn Premium，亦派內推；內推比 Premium 值錢。' },
      src: '§11' },

    { id: 'books',
      text: { en: 'Textbooks: the campus pop-up shop runs 3-4 weeks a term, but second-hand is cheaper.',
              zh: '教材：校内临时书店每学期开 3–4 周，但二手更便宜。',
              yue: '教材：校內臨時書店每學期開 3–4 週，但二手更平。' },
      src: '§7' },

    { id: 'lsk',
      text: { en: 'LSK study rooms are quiet and the Wi-Fi there is the fastest on campus.',
              zh: 'LSK 自习室人少安静，Wi-Fi 是全校最快的。',
              yue: 'LSK 自習室人少安靜，Wi-Fi 係全校最快。' },
      src: '§9' },

    { id: 'calendar',
      text: { en: 'Set the academic calendar wallpaper now; holidays are easier to plan around when you can see them.',
              zh: '先把校历壁纸换上，看得到假期才排得动计划。',
              yue: '先換上校曆壁紙，睇得到假期先排得到計劃。' },
      src: '§12' }
  ];

  globalThis.FUST = globalThis.FUST || {};
  globalThis.FUST.Tasks = {
    id: 'newcomer',
    campus: 'ust-cwb',
    groups: GROUPS,
    items: ITEMS,
    tips: TIPS
  };
  /* FUST.TASKS is what the checks and the font check look for */
  globalThis.FUST.TASKS = globalThis.FUST.Tasks;
})();

