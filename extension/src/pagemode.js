/* lint.one extension — the "data pages" chooser, on the settings page and
   the welcome page alike.

   Three choices for a tab that shows raw JSON, XML, YAML or CSV: leave it,
   format it in place, or open it in lint.one. The two that act on a page
   need access to every site, asked for here on the click that chooses
   them; turning them off gives that access back. */
(function (global) {
  'use strict';
  var S = global.LintSettings;
  var ALL_SITES = ['http://*/*', 'https://*/*'];
  var FORMATS = [['json', 'JSON'], ['xml', 'XML'], ['yaml', 'YAML'], ['csv', 'CSV']];

  var MODES = [
    { id: 'off', title: 'Leave it', note: 'Chrome shows the raw text. Open it from the menu or the button when you want.',
      pic: '{"id":1042,"status":"paid","items":[{"sku":"KB-75","qty":1}],"total":217}' },
    { id: 'view', title: 'Format it here', badge: 'Popular',
      note: 'JSON becomes a tree you can fold and copy from, in the same tab. One click opens it in lint.one.' },
    { id: 'open', title: 'Open in lint.one', note: 'The page opens in the tool that reads it, in its place. Back shows the raw page.' }
  ];

  function pic(id) {
    if (id === 'off') return '<div class="pic" style="white-space:normal;word-break:break-all">' + MODES[0].pic + '</div>';
    if (id === 'view') {
      return '<div class="pic">▾ {\n  <span class="k">"id"</span>: <span class="n">1042</span>,\n' +
        '  <span class="k">"status"</span>: <span class="s">"paid"</span>,\n  ▸ <span class="k">"items"</span>: [ 1 item ]</div>';
    }
    return '<div class="pic tool"><span class="side"></span><span class="body">' +
      '<span class="bar" style="width:70%"></span><span class="bar" style="width:45%"></span>' +
      '<span class="bar" style="width:60%"></span><span class="bar" style="width:35%"></span></span></div>';
  }

  function mount(root, onChange) {
    var modesEl = root.querySelector('[data-modes]');
    var formatsEl = root.querySelector('[data-formats]');
    var accessEl = root.querySelector('[data-access]');
    var state = null;

    modesEl.setAttribute('role', 'radiogroup');
    modesEl.setAttribute('aria-label', 'On a raw data page');
    modesEl.innerHTML = MODES.map(function (m) {
      return '<button type="button" class="mode" role="radio" data-mode="' + m.id + '">' +
        '<span class="radio" aria-hidden="true"></span>' + pic(m.id) +
        '<span class="mode-title">' + m.title + (m.badge ? ' <span class="badge">' + m.badge + '</span>' : '') + '</span>' +
        '<span class="mode-note">' + m.note + '</span></button>';
    }).join('');

    formatsEl.innerHTML = '<span class="lbl">Applies to</span>' + FORMATS.map(function (f) {
      return '<button type="button" class="chip" data-format="' + f[0] + '"><span class="tool-tile dot-' + f[0] +
        '" aria-hidden="true"></span>' + f[1] + '</button>';
    }).join('');

    function paint() {
      modesEl.querySelectorAll('.mode').forEach(function (b) {
        b.setAttribute('aria-checked', String(b.dataset.mode === state.pageMode));
      });
      formatsEl.querySelectorAll('.chip').forEach(function (b) {
        b.setAttribute('aria-pressed', String(!!state.pageFormats[b.dataset.format]));
      });
      if (state.pageMode === 'off') formatsEl.setAttribute('data-off', '');
      else formatsEl.removeAttribute('data-off');
      if (accessEl) {
        accessEl.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
          '<span>' + (state.pageMode === 'off'
            ? 'This needs no access to any site.'
            : 'Chrome lists this as “read and change all your data on all websites”. lint.one only looks at tabs that are raw data files, and what it reads never leaves your browser.') +
          '</span>';
      }
    }

    function choose(mode) {
      if (mode === state.pageMode) return;
      var before = state.pageMode;
      if (mode === 'off') {
        state.pageMode = 'off';
        paint();
        S.set({ pageMode: 'off' }).then(function () {
          return chrome.permissions.remove({ origins: ALL_SITES });
        }).catch(function () {}).then(function () { if (onChange) onChange(); });
        return;
      }
      /* the wish is saved first: the worker finishes the job when the
         access arrives, whatever happens to this page meanwhile */
      state.pageMode = mode;
      paint();
      S.set({ pageMode: mode }).then(function () {
        return chrome.permissions.request({ origins: ALL_SITES });
      }).then(function (ok) {
        if (!ok) {
          state.pageMode = before;
          paint();
          return S.set({ pageMode: before });
        }
        chrome.runtime.sendMessage({ kind: 'sync-auto' }).catch(function () {});
        if (onChange) onChange();
      }, function () {
        state.pageMode = before;
        paint();
        S.set({ pageMode: before });
      });
    }

    modesEl.addEventListener('click', function (e) {
      var b = e.target.closest('.mode');
      if (b && state) choose(b.dataset.mode);
    });
    modesEl.addEventListener('keydown', function (e) {
      if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      e.preventDefault();
      var ids = MODES.map(function (m) { return m.id; });
      var i = ids.indexOf(state.pageMode) + (/Right|Down/.test(e.key) ? 1 : -1);
      var next = ids[(i + ids.length) % ids.length];
      choose(next);
      modesEl.querySelector('[data-mode="' + next + '"]').focus();
    });
    formatsEl.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b || !state) return;
      state.pageFormats[b.dataset.format] = !state.pageFormats[b.dataset.format];
      paint();
      S.set({ pageFormats: state.pageFormats }).then(function () { if (onChange) onChange(); });
    });

    /* access taken back in Chrome's own settings shows here as Leave it */
    return Promise.all([S.get(), chrome.permissions.contains({ origins: ALL_SITES })]).then(function (r) {
      state = r[0];
      if (state.pageMode !== 'off' && !r[1]) state.pageMode = 'off';
      paint();
    });
  }

  global.LintPageMode = { mount: mount };
})(self);
