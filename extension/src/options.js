/* lint.one extension — the settings page. Every change is saved as it is
   made; there is no Save button. */
(function () {
  'use strict';
  var S = self.LintSettings;
  var BASE = self.LINT_BASE;
  var $ = function (id) { return document.getElementById(id); };
  var NAMES = { daylight: 'Light', slate: 'Dark' };

  var toastTimer = null;
  function saved(text) {
    var el = $('saved');
    el.textContent = text || 'Saved';
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1400);
  }

  function setSwitch(el, on) { el.setAttribute('aria-checked', String(!!on)); }
  function isOn(el) { return el.getAttribute('aria-checked') === 'true'; }

  /* ---------- raw data pages ---------- */
  LintPageMode.mount($('data'), function () { saved(); });

  /* ---------- switches ---------- */
  Promise.all([S.get(), chrome.permissions.contains({ permissions: ['clipboardRead'] })]).then(function (r) {
    var s = r[0];
    setSwitch($('clip'), s.clipboard && r[1]);
    setSwitch($('rec'), s.recents);
    setSwitch($('mark'), s.markIcon);
    drawMark(s.markIcon);
  });

  $('clip').addEventListener('click', function () {
    var el = $('clip');
    if (isOn(el)) {
      setSwitch(el, false);
      S.set({ clipboard: false }).then(function () {
        return chrome.permissions.remove({ permissions: ['clipboardRead'] });
      }).catch(function () {}).then(function () { saved(); });
      return;
    }
    el.setAttribute('aria-busy', 'true');
    chrome.permissions.request({ permissions: ['clipboardRead'] }).then(function (ok) {
      el.removeAttribute('aria-busy');
      setSwitch(el, ok);
      if (!ok) return;
      chrome.storage.local.set({ tipClipboard: 'on' });
      S.set({ clipboard: true }).then(function () { saved(); });
    }, function () { el.removeAttribute('aria-busy'); });
  });

  $('rec').addEventListener('click', function () {
    var on = !isOn($('rec'));
    setSwitch($('rec'), on);
    S.set({ recents: on }).then(function () { saved(on ? 'Saved' : 'Saved — and forgotten'); });
  });
  $('clearRecent').addEventListener('click', function () {
    chrome.runtime.sendMessage({ kind: 'clear-recents' }).then(function () { saved('Forgotten'); }, function () {});
  });

  $('mark').addEventListener('click', function () {
    var on = !isOn($('mark'));
    setSwitch($('mark'), on);
    drawMark(on);
    S.set({ markIcon: on }).then(function () { saved(); });
  });

  /* the icon as it looks on a .json page, drawn the way the worker does */
  function drawMark(on) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = c.height = 64;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, 64, 64);
      if (on) {
        g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.arc(50, 50, 17, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#4F46E5';
        g.beginPath(); g.arc(50, 50, 13, 0, Math.PI * 2); g.fill();
      }
      $('markPreview').src = c.toDataURL();
    };
    img.src = 'icons/icon-128.png';
  }

  /* ---------- shortcuts ---------- */
  function keys(shortcut) {
    return '<span class="keys">' + shortcut.split('+').map(function (k) {
      return '<kbd>' + (k === 'Command' ? '⌘' : k) + '</kbd>';
    }).join('') + '</span>';
  }
  var EXTRA = [
    { what: 'Open anything in lint.one from the address bar', how: '<span class="keys"><kbd>lint</kbd><kbd>Space</kbd></span>' }
  ];
  chrome.commands.getAll().then(function (cmds) {
    var rows = cmds.map(function (c) {
      var what = c.name === '_execute_action' ? 'Open the lint.one popup' : c.description;
      return { what: what, how: c.shortcut ? keys(c.shortcut) : '<span class="muted small">Not set</span>' };
    }).concat(EXTRA);
    $('shortcuts').innerHTML = rows.map(function (r) {
      return '<div class="opt"><div class="opt-text"><div class="opt-title" style="font-weight:500">' + r.what +
        '</div></div><div class="opt-side">' + r.how + '</div></div>';
    }).join('') +
      '<div class="opt"><div class="opt-text"><div class="opt-note">Chrome keeps the shortcuts; change them on its own page.</div></div>' +
      '<div class="opt-side"><button type="button" class="bordered" id="changeKeys">Change shortcuts</button></div></div>';
    $('changeKeys').addEventListener('click', function () { chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); });
  });

  /* ---------- appearance ---------- */
  chrome.storage.local.get('theme').then(function (v) { $('themeName').textContent = NAMES[v.theme] || 'System'; });
  $('themeBtn').addEventListener('click', function () { chrome.tabs.create({ url: BASE + '/' }); });

  /* ---------- foot ---------- */
  $('version').textContent = 'Version ' + chrome.runtime.getManifest().version;
  $('welcome').addEventListener('click', function (e) { e.preventDefault(); chrome.tabs.create({ url: 'welcome.html' }); });
  document.querySelectorAll('[data-href]').forEach(function (a) {
    a.href = BASE + a.dataset.href;
    a.target = '_blank';
    a.rel = 'noopener';
  });
})();
