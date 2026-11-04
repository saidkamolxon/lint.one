/* lint.one extension — the settings, in one place.

   Loaded by the service worker (importScripts), the popup, the settings
   page, the welcome page and the content script on data pages, so every
   one of them reads the same defaults. Kept in chrome.storage.local:

     pageMode     what happens on a raw JSON, XML, YAML or CSV page:
                  'off'   nothing (the default; needs no site access)
                  'view'  JSON is shown formatted in place, the others get
                          an "Open in lint.one" button
                  'open'  the page opens in lint.one in its place
     pageFormats  which of those formats pageMode applies to
     clipboard    the popup offers what was just copied (needs the
                  optional clipboardRead permission)
     recents      the popup lists what was opened, until Chrome closes
     markIcon     the toolbar icon carries the format's colour on a page
                  that is a file lint.one reads

   The old single switch, `auto`, meant pageMode 'open'. */
(function (global) {
  'use strict';

  var DEFAULTS = {
    pageMode: 'off',
    pageFormats: { json: true, xml: true, yaml: true, csv: true },
    clipboard: false,
    recents: true,
    markIcon: true
  };
  var KEYS = Object.keys(DEFAULTS).concat('auto');

  function merge(v) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = v[k] === undefined ? DEFAULTS[k] : v[k];
    });
    if (v.pageMode === undefined && v.auto) out.pageMode = 'open';
    out.pageFormats = Object.assign({}, DEFAULTS.pageFormats, out.pageFormats || {});
    return out;
  }

  function get() {
    return chrome.storage.local.get(KEYS).then(merge, function () { return merge({}); });
  }

  function set(patch) {
    return chrome.storage.local.set(patch);
  }

  /* the old switch becomes the new setting, once (the worker calls this
     when the extension is installed or updated) */
  function migrate() {
    return chrome.storage.local.get(['auto', 'pageMode']).then(function (v) {
      if (v.auto === undefined) return;
      var patch = {};
      if (v.pageMode === undefined && v.auto) patch.pageMode = 'open';
      return chrome.storage.local.set(patch).then(function () { return chrome.storage.local.remove('auto'); });
    }).catch(function () {});
  }

  global.LintSettings = { DEFAULTS: DEFAULTS, KEYS: KEYS, get: get, set: set, merge: merge, migrate: migrate };
})(self);
