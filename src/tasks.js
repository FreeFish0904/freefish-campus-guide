/* =====================================================================
 * Checklist panel - the DOM half of data/tasks.js.
 * ---------------------------------------------------------------------
 * A drawer, not a page: the map and the chat are the product, and a
 * checklist you have to navigate away to is a checklist you forget.
 *
 * Two rules worth stating, because they are what makes this honest:
 *   1. A tick is stored per campus (?data=demo and ?data=ust never share
 *      state), and only in localStorage - there is no account.
 *   2. "Go" does not print a route. It asks the same planner the chat box
 *      asks (FUST.App.goTo), so a task and a question always agree.
 * ===================================================================== */
(function () {
  'use strict';

  var I = globalThis.FUST.I18N;
  var C = globalThis.FUST.Campus;
  var ICON = globalThis.FUST.Icons;
  var DATA = globalThis.FUST.Tasks;

  var KEY = 'fust.tasks.v1';
  var store = { done: {} };
  var open = false;
  var dom = {};

  /* ---- storage --------------------------------------------------------- */
  /* private mode throws on setItem; a checklist that cannot remember is
     still better than a checklist that throws */
  function load() {
    try {
      var raw = globalThis.localStorage.getItem(KEY);
      if (raw) { store = JSON.parse(raw) || { done: {} }; }
    } catch (e) { store = { done: {} }; }
    if (!store.done) { store.done = {}; }
    if (!store.done[C.id]) { store.done[C.id] = {}; }
  }

  function save() {
    try { globalThis.localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  function isDone(id) { return !!(store.done[C.id] && store.done[C.id][id]); }

  function setDone(id, on) {
    if (!store.done[C.id]) { store.done[C.id] = {}; }
    if (on) { store.done[C.id][id] = 1; } else { delete store.done[C.id][id]; }
    save();
  }

  function countDone() {
    return DATA.items.filter(function (it) { return isDone(it.id); }).length;
  }

  /* ---- text ------------------------------------------------------------ */
  function lang() {
    var App = globalThis.FUST.App;
    return (App && App.lang && App.lang()) || 'en';
  }

  function t(key, vars) { return I.t(key, lang(), vars); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---- render ---------------------------------------------------------- */
  function render() {
    if (!dom.panel) { return; }
    var items = DATA.items;
    var done = countDone();
    var total = items.length;

    dom.title.textContent = t('tasks.title');
    dom.sub.textContent = t('tasks.sub');
    dom.count.textContent = t('tasks.progress', { done: done, total: total });
    dom.tabCount.textContent = done + '/' + total;
    dom.bar.style.width = (total ? (done / total) * 100 : 0) + '%';
    dom.bar.parentNode.setAttribute('aria-valuenow', done);
    dom.bar.parentNode.setAttribute('aria-valuemax', total);
    dom.reset.textContent = t('tasks.reset');
    dom.saved.textContent = t('tasks.saved');

    var html = '';
    DATA.groups.forEach(function (g) {
      var mine = items.filter(function (it) { return it.group === g.id; });
      if (!mine.length) { return; }
      var gDone = mine.filter(function (it) { return isDone(it.id); }).length;
      html += '<section class="task-group">';
      html += '<header class="task-ghead"><h3>' + esc(I.name(g.title, lang())) + '</h3>' +
              '<span class="task-gnum" data-group="' + g.id + '">' +
              gDone + '/' + mine.length + '</span></header>';
      html += '<p class="task-gnote">' + esc(I.name(g.note, lang())) + '</p><ul class="task-rows">';
      mine.forEach(function (it) { html += itemHtml(it); });
      html += '</ul></section>';
    });

    html += '<section class="task-group task-tips"><header class="task-ghead"><h3>' +
            esc(t('tasks.tips')) + '</h3></header><ul class="tips">';
    DATA.tips.forEach(function (tip) {
      html += '<li>' + esc(I.name(tip.text, lang())) +
              '<span class="tip-src">' + esc(tip.src) + '</span></li>';
    });
    html += '</ul></section>';

    /* the all-done line always exists, so a tick can reveal it without
       rebuilding the list under the user's finger */
    html += '<p class="task-all" id="taskAll"' + (done === total ? '' : ' hidden') + '>' +
            esc(t('tasks.allDone', { total: total })) + '</p>';

    dom.list.innerHTML = html;
  }

  function itemHtml(it) {
    var on = isDone(it.id);
    var cls = 'task' + (on ? ' is-done' : '');
    var h = '<li class="' + cls + '" role="checkbox" tabindex="0" aria-checked="' + on +
            '" data-id="' + esc(it.id) + '" title="' + esc(t('tasks.src') + ' ' + it.src) + '">';
    h += '<span class="task-box" aria-hidden="true"></span>';
    h += '<span class="task-text">';
    h += '<span class="task-title">' + esc(I.name(it.title, lang())) + '</span>';
    h += '<span class="task-note">' + esc(I.name(it.note, lang())) + '</span>';
    h += '<span class="task-foot">';
    if (it.tag) { h += '<span class="task-tag">' + esc(it.tag) + '</span>'; }
    if (it.at) {
      /* the only button in the row, so the row itself can stay a checkbox */
      h += '<button type="button" class="task-go" data-go="' + esc(it.at) + '">' +
           '<span>' + esc(t('tasks.go')) + '</span>' +
           '<svg class="ico" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">' +
           '<path d="M5 12h13 M13 6l6 6-6 6"/></svg>' +
           '</button>';
    } else if (it.offsite) {
      h += '<span class="task-off">' + esc(t('tasks.offsite')) + '</span>';
    }
    h += '</span></span></li>';
    return h;
  }

  /* the tick itself: one SVG symbol reused by every row, so it is drawn
     once and never depends on a font having "✓" */
  function paintBoxes() {
    var box = dom.list.querySelectorAll('.task-box');
    for (var i = 0; i < box.length; i++) {
      if (box[i].firstChild) { continue; }
      box[i].appendChild(ICON.svg('check', 11));
    }
  }


  /* ---- behaviour ------------------------------------------------------- */
  function toggle(id, force) {
    var on = force === undefined ? !isDone(id) : !!force;
    setDone(id, on);
    var row = dom.list.querySelector('.task[data-id="' + id + '"]');
    if (row) {
      row.classList.toggle('is-done', on);
      row.setAttribute('aria-checked', String(on));
    }
    var done = countDone();
    var total = DATA.items.length;
    dom.count.textContent = t('tasks.progress', { done: done, total: total });
    dom.tabCount.textContent = done + '/' + total;
    dom.bar.style.width = (total ? (done / total) * 100 : 0) + '%';
    dom.bar.parentNode.setAttribute('aria-valuenow', done);
    var all = document.getElementById('taskAll');
    if (all) { all.hidden = done !== total; }
    /* group counters and the all-done line are cheap to redo, but rebuilding
       the list on every tick would throw away focus - so update in place */
    DATA.groups.forEach(function (g) {
      var mine = DATA.items.filter(function (it) { return it.group === g.id; });
      var head = dom.list.querySelector('[data-group="' + g.id + '"]');
      if (!head) { return; }
      head.textContent = mine.filter(function (it) { return isDone(it.id); }).length +
                         '/' + mine.length;
    });
  }

  function setOpen(on) {
    open = !!on;
    document.body.classList.toggle('tasks-open', open);
    dom.panel.classList.toggle('open', open);
    dom.panel.setAttribute('aria-hidden', String(!open));
    dom.open.setAttribute('aria-expanded', String(open));
    if (open) {
      var first = dom.panel.querySelector('.task');
      if (first && first.focus) { first.focus(); }
    } else if (dom.open.focus) {
      dom.open.focus();
    }
  }

  function bind() {
    dom.open.addEventListener('click', function () { setOpen(!open); });
    dom.close.addEventListener('click', function () { setOpen(false); });
    dom.scrim.addEventListener('click', function () { setOpen(false); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) { setOpen(false); }
    });

    /* one delegated listener: rows are rebuilt on every language change */
    dom.list.addEventListener('click', function (e) {
      var go = e.target.closest ? e.target.closest('.task-go') : null;
      if (go) {
        e.stopPropagation();
        if (globalThis.FUST.App) { globalThis.FUST.App.goTo(go.getAttribute('data-go')); }
        setOpen(false);
        return;
      }
      var row = e.target.closest ? e.target.closest('.task') : null;
      if (row) { toggle(row.getAttribute('data-id')); }
    });

    dom.list.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') { return; }
      var row = e.target.closest ? e.target.closest('.task') : null;
      if (!row) { return; }
      e.preventDefault();
      toggle(row.getAttribute('data-id'));
    });

    dom.reset.addEventListener('click', function () {
      store.done[C.id] = {};
      save();
      render();
      paintBoxes();
      if (dom.list.scrollTop !== undefined) { dom.list.scrollTop = 0; }
    });

    /* the app re-translates itself on a language switch; the panel has to
       follow, otherwise half the drawer stays in the old language */
    document.addEventListener('fust:lang', function () { render(); paintBoxes(); });
  }

  function init() {
    dom.panel = document.getElementById('taskPanel');
    dom.open = document.getElementById('taskOpen');
    if (!dom.panel || !dom.open || !DATA) { return; }
    /* the checklist is HKUST-specific: on the demo campus there is nothing
       real to check off, so the entry point stays out of the way */
    if (DATA.campus && C.id !== DATA.campus) { dom.open.hidden = true; return; }

    dom.list = document.getElementById('taskList');
    dom.title = document.getElementById('taskTitle');
    dom.sub = document.getElementById('taskSub');
    dom.count = document.getElementById('taskCount');
    dom.tabCount = document.getElementById('taskTabCount');
    dom.bar = document.getElementById('taskBar');
    dom.reset = document.getElementById('taskReset');
    dom.saved = document.getElementById('taskSaved');
    dom.close = document.getElementById('taskClose');
    dom.scrim = document.getElementById('taskScrim');

    load();
    render();
    paintBoxes();
    bind();
    dom.tabCount.textContent = countDone() + '/' + DATA.items.length;

    /* ?tasks=1 opens the drawer - for screenshots and manual checks. Handled
       here rather than in app.js because the drawer's DOM is wired up in
       this file, and app.js's deep link runs before this init does. */
    try {
      if (new URLSearchParams(window.location.search).get('tasks') === '1') { setOpen(true); }
    } catch (e) { /* file:// in old browsers - harmless */ }
  }

  globalThis.FUST.TasksPanel = {
    init: init,
    render: render,
    toggle: toggle,
    open: function () { if (dom.panel) { setOpen(true); } },
    close: function () { if (dom.panel) { setOpen(false); } },
    count: countDone
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
