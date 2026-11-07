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
