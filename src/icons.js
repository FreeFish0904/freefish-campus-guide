/* =====================================================================
 * Icons - the small vocabulary the plan speaks in.
 * ---------------------------------------------------------------------
 * Every POI is reduced to one of seven categories ("what am I looking
 * for on this floor") and every category owns one line icon. Icons are
 * inline SVG symbols, not emoji: emoji change shape between Windows,
 * macOS and a lecture-room projector, which is exactly when this demo
 * gets shown. Line art renders identically everywhere.
 *
 * The paths are drawn on a 24x24 grid with no stroke/fill attributes of
 * their own, so the <use> element decides the colour (currentColor) and
 * the same symbol works white-on-colour or grey-on-paper.
 * ===================================================================== */
(function () {
  'use strict';

  /* poi type (as written in campus.js) -> category --------------------- */
  var POI_CAT = {
    food: 'food',
    cafe: 'food',
    study: 'study',
    classroom: 'study',
    lecture: 'study',
    lab: 'study',
    admin: 'admin',
    meeting: 'admin',
    service: 'admin',
    gym: 'sport',
    lobby: 'transport',
    entrance: 'transport',
    restroom: 'facility',
    lounge: 'hall'
  };

  /* legend order: the things a newcomer looks for first come first ----- */
  var CATS = ['food', 'study', 'admin', 'sport', 'transport', 'hall', 'facility'];

  /* 24x24 line glyphs -------------------------------------------------- */
  var GLYPHS = {
    /* cup with a handle */
    food: 'M6 7h10v6a5 5 0 0 1-10 0z M16 8h2.2a2.4 2.4 0 0 1 0 4.8H16 M5 21h13',
    /* open book */
    study: 'M4 6.5A2.5 2.5 0 0 1 6.5 4H12v16H6.5A2.5 2.5 0 0 0 4 22z ' +
           'M20 6.5A2.5 2.5 0 0 0 17.5 4H12v16h5.5A2.5 2.5 0 0 1 20 22z',
    /* briefcase: paperwork, counters, offices */
    admin: 'M4 8h16v11H4z M9 8V6h6v2 M4 12h16',
    /* dumbbell */
    sport: 'M3 10v4 M6 8v8 M18 8v8 M21 10v4 M6 12h12',
    /* bus: the way in and out */
    transport: 'M5 5h14v11H5z M5 16v3 M19 16v3 M5 10.5h14 ' +
               'M8 19.5a1.6 1.6 0 1 0 0-3.2 M16 19.5a1.6 1.6 0 1 0 0-3.2',
    /* house: residence / lounge */
    hall: 'M4 11l8-6.5 8 6.5 M6.5 9.5V20h11V9.5 M10 20v-5h4v5',
    /* info disc: restrooms, lockers, everything else */
    facility: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8v.01 M12 11v6'
  };

  function catOf(poi) { return POI_CAT[poi] || 'facility'; }

  /* <defs> holding one <symbol> per glyph. Built fresh on every render,
     because the map clears the whole <svg> before drawing. */
  function defs(doc) {
    var NS = 'http://www.w3.org/2000/svg';
    var d = doc.createElementNS(NS, 'defs');
    CATS.forEach(function (cat) {
      var sym = doc.createElementNS(NS, 'symbol');
      sym.setAttribute('id', 'ico-' + cat);
      sym.setAttribute('viewBox', '0 0 24 24');
      var p = doc.createElementNS(NS, 'path');
      p.setAttribute('d', GLYPHS[cat]);
      sym.appendChild(p);
      d.appendChild(sym);
    });
    return d;
  }

  globalThis.FUST = globalThis.FUST || {};
  globalThis.FUST.Icons = {
    POI_CAT: POI_CAT,
    CATS: CATS,
    GLYPHS: GLYPHS,
    catOf: catOf,
    defs: defs
  };
})();
