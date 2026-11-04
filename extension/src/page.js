/* Raw data pages: registered on every site only while "Raw data pages"
   in Settings is not "Leave it" (background.js, syncAuto), and never
   before the person has allowed lint.one on every site. Loaded after
   settings.js and viewer.js.

   On a tab that shows a JSON, XML, YAML or CSV document raw:
   - "Format it here": JSON is drawn as a tree in place (viewer.js); the
     other formats get an "Open in lint.one" button;
   - "Open in lint.one": the page opens in the tool in this tab's place.
     Coming back (the Back button) shows the raw page with the button
     instead, so the page is never taken away twice. */
(function () {
  'use strict';
  if (window.top !== window) return;

  var type = String(document.contentType || '').toLowerCase();
  var DATA = /^(application|text)\/([\w.+-]*\+)?(json|x?-?yaml|yml|xml|csv|tab-separated-values)$/;
  var pre = document.body && document.body.querySelector(':scope > pre');
  var format = null;
  if (DATA.test(type) && type !== 'application/xhtml+xml') {
    format = /json/.test(type) ? 'json' : /ya?ml/.test(type) ? 'yaml' : /xml/.test(type) ? 'xml' : 'csv';
  } else if (type === 'text/plain' && pre && /^\s*[\[{]/.test(pre.textContent.slice(0, 64))) {
    /* JSON served as text/plain, as many APIs and raw file hosts do: taken
       as JSON only if it parses, further down */
    format = 'json-maybe';
  }
  if (!format) return;
  /* an XML document styled for reading (a feed with its own stylesheet)
     is a page, not data */
  if (format === 'xml') {
    for (var n = document.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 7 && n.target === 'xml-stylesheet') return;
    }
  }

  self.LintSettings.get().then(function (s) {
    var key = format === 'json-maybe' ? 'json' : format;
    if (s.pageMode === 'off' || !s.pageFormats[key]) return;
    if (s.pageMode === 'view') return view(s);
    if (format === 'json-maybe') {
      try { JSON.parse(pre.textContent); } catch (e) { return; }
    }
    replaceOrOffer();
  });

  /* ---------- Format it here ---------- */
  function view() {
    if (format === 'xml' || format === 'yaml' || format === 'csv' || !pre) { button('Open in lint.one', openBeside); return; }
    var text = pre.textContent, value;
    try { value = JSON.parse(text); } catch (e) {
      if (format === 'json-maybe') return;
      button('Not valid JSON \u2014 find the error in lint.one', openBeside);
      return;
    }
    chrome.storage.local.get('theme').then(function (t) {
      var dark = t.theme === 'slate' || (t.theme !== 'daylight' && matchMedia('(prefers-color-scheme: dark)').matches);
      var host = self.lintoneViewer.render(text, value, { dark: dark, onOpen: openBeside });
      /* the page's own text stays, hidden, for "Open in lint.one" and for
         anything else that reads it */
      Array.prototype.forEach.call(document.body.children, function (c) { c.style.display = 'none'; });
      document.body.style.margin = '0';
      document.body.appendChild(host);
    }, function () {});
  }

  function openBeside() {
    chrome.runtime.sendMessage({ kind: 'page-open' }).catch(function () {});
  }

  /* ---------- Open in lint.one ---------- */
  function replaceOrOffer() {
  var KEY = 'lintone-shown:' + location.href;
  var seen = false;
  try { seen = sessionStorage.getItem(KEY) === '1'; sessionStorage.removeItem(KEY); } catch (e) {}

  function open() {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    chrome.runtime.sendMessage({ kind: 'auto' }).catch(function () {});
  }

  if (!seen) { open(); return; }
  button('Open in lint.one', open);
  }

  /* a small button at the corner of the page */
  function button(label, action) {

  /* offer, don't insist. The mark is shared/glyph.svg inline, so no
     extension file has to be exposed to web pages. */
  var GLYPH = 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="227 239 760 760"><path d="M632 412L632 708A65 65 0 0 0 697 773L731 773' +
    'A22 22 0 0 1 753 795L753 831A22 22 0 0 1 731 853L638 853A95 95 0 0 1 543 758L543 522Q543 503 525 510L486 526Q461 536 461 510' +
    'L461 478Q461 458 479 448L596 389Q632 371 632 412Z"/></svg>') + '")';
  var host = document.createElement('div');
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; right: 16px; bottom: 16px;';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>' +
    'button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; cursor: pointer;' +
    ' padding: 7px 14px 7px 8px; border-radius: 10px;' +
    ' font: 600 13px/1.2 "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;' +
    ' background: #1A1D23; color: #FBFBFC; box-shadow: 0 6px 20px -6px rgb(26 29 35 / .35), 0 1px 2px rgb(26 29 35 / .1); }' +
    'button:hover { background: #2A2E36; }' +
    'button:focus-visible { outline: 2px solid #1A1D23; outline-offset: 2px; }' +
    '.m { width: 20px; height: 20px; border-radius: 4.7px; background: #FBFBFC; position: relative; }' +
    '.m::before { content: ""; position: absolute; inset: 0; background: #1A1D23;' +
    ' -webkit-mask: ' + GLYPH + ' center / 100% no-repeat; mask: ' + GLYPH + ' center / 100% no-repeat; }' +
    '.x { all: unset; cursor: pointer; margin-left: 2px; padding: 0 2px; opacity: .6; font-weight: 400; }' +
    '.x:hover { opacity: 1; }' +
    '@media (prefers-color-scheme: dark) {' +
    ' button { background: #E6E9F0; color: #15171C; } button:hover { background: #FFFFFF; }' +
    ' .m { background: #15171C; } .m::before { background: #E6E9F0; } }' +
    '</style>' +
    '<button type="button" title="Open this page in lint.one"><span class="m" aria-hidden="true"></span>' +
    '<span class="lbl"></span><span class="x" role="button" aria-label="Dismiss" title="Dismiss">✕</span></button>';
  root.querySelector('.lbl').textContent = label;
  root.querySelector('button').addEventListener('click', function (e) {
    host.remove();
    if (e.target.classList.contains('x')) return;
    action();
  });
  (document.body || document.documentElement).appendChild(host);
  }
})();
