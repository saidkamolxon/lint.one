/* lint.one extension — the toolbar popup: what is at hand (this page, what
   was just copied, the tab's sound), anything pasted, what was opened
   recently, and every tool. */
(function () {
  'use strict';
  var F = self.LintFormats;
  var S = self.LintSettings;
  var BASE = self.LINT_BASE;
  var TEXT_TOOLS = ['json', 'yaml', 'csv', 'xml', 'log', 'env', 'cert', 'har'];
  /* the two light hues wear ink, not white, as on the site */
  var LIGHT = { cert: true, parquet: true };
  var CLIP_MAX = 4 * 1024 * 1024;
  var $ = function (id) { return document.getElementById(id); };
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function tint(el, tool) {
    if (tool && F.BY_ID[tool]) {
      el.style.setProperty('--tool-hue', F.BY_ID[tool].hue);
      if (LIGHT[tool]) el.style.setProperty('--tool-ink', '#1A1D23');
      else el.style.removeProperty('--tool-ink');
    } else {
      el.style.removeProperty('--tool-hue');
      el.style.removeProperty('--tool-ink');
    }
  }

  function tile(el, tool) {
    el.className = el.className.replace(/\bdot-\S+/g, '').trim() + ' dot-' + (tool || 'none');
  }

  function size(n) {
    if (!(n > 0)) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function ago(t) {
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 50) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' d ago';
  }

  /* hand a message to the worker and close; it answers at once, so the
     popup going away cannot cut the work short */
  function tell(msg) {
    chrome.runtime.sendMessage(msg).then(function () { window.close(); }, function () { window.close(); });
  }

  function openTab(url) {
    chrome.tabs.create({ url: url }).then(function () { window.close(); });
  }

  function kbd(keys) {
    return keys.map(function (k) { return '<kbd>' + k + '</kbd>'; }).join('');
  }

  $('home').addEventListener('click', function (e) { e.preventDefault(); openTab(BASE + '/'); });
  $('settingsBtn').addEventListener('click', function () {
    chrome.runtime.openOptionsPage().then(function () { window.close(); });
  });

  /* the first card shown takes Enter while the paste box is empty */
  var primary = null;
  function offer(card, action) {
    card.onclick = action;
    card.hidden = false;
    if (!primary) {
      primary = action;
      var go = card.querySelector('.card-go');
      go.innerHTML = go.textContent + ' ' + kbd(['↵']);
    }
  }

  /* ---------- this page ---------- */
  function nameFromUrl(url) {
    try {
      var u = new URL(url);
      var seg = u.pathname.split('/').filter(Boolean).pop();
      return seg ? decodeURIComponent(seg) : u.hostname;
    } catch (e) { return ''; }
  }

  var pageReady = chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
    var tab = tabs[0];
    /* not the Audio tool itself: it is the one listening */
    if (tab && tab.audible && (tab.url || '').indexOf(BASE + '/audio/') !== 0) {
      var where = '';
      try { where = new URL(tab.url).hostname; } catch (e) {}
      $('listenMeta').textContent = 'Live spectrum' + (where ? ' · ' + where : '');
      tint($('listen'), 'audio');
      /* without tab capture yet, the worker opens the window that asks
         for it and gets the tab ready (listenOrAsk, grant.html) */
      $('listen').hidden = false;
      $('listen').onclick = function () { tell({ kind: 'listen', tabId: tab.id }); };
    }
    if (!tab || !/^https?:/.test(tab.url || '')) return;
    var name = nameFromUrl(tab.url);
    var host = new URL(tab.url).hostname;

    function show(tool) {
      if (!tool) return;
      var t = F.BY_ID[tool];
      $('pageName').textContent = F.nameFor(name, tool);
      $('pageMeta').textContent = t.name + ' · ' + host;
      tile($('pageTile'), tool);
      tint($('page'), tool);
      $('page').setAttribute('aria-label', 'Open this page in lint.one ' + t.name);
      offer($('page'), function () { tell({ kind: 'page', tabId: tab.id }); });
    }

    /* opening the popup lets it look at this one tab (activeTab), so it
       can ask the page what it is rather than guess from the address */
    return chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () {
        var pre = document.body && document.body.querySelector(':scope > pre');
        var mine = document.getElementById('lintone-view');
        return { type: document.contentType || '',
                 head: mine ? mine.dataset.head || '' : pre ? pre.textContent.slice(0, 4096) : null };
      }
    }).then(function (r) {
      var info = r && r[0] && r[0].result;
      if (!info) { show(F.byName(name)); return; }
      if (F.isWebPage(info.type)) return;
      var tool = F.pick(name, info.type, info.head);
      if (!tool && !/^(image|video|font)\//.test(info.type) && info.head != null) tool = F.sniffText(info.head);
      show(tool);
    }, function () {
      /* a page that will not take a script — the built-in PDF viewer, a
         Chrome page: the address is all there is */
      show(F.byName(name));
    });
  }).catch(function () {});

  /* ---------- what was just copied ---------- */

  /* Only when the person turned it on (Settings, or the tip below), and
     only something that reads as one of the formats: a sentence copied
     from an article is not offered as a "log". */
  function sure(text, tool) {
    if (tool !== 'log') return true;
    var lines = text.split('\n').filter(function (l) { return l.trim(); });
    return lines.length >= 2 && /^\s*\[?(\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}|TRACE|DEBUG|INFO|WARN|ERROR)/.test(lines[0]);
  }

  function readClipboard() {
    return navigator.clipboard.readText().then(function (text) {
      if (!text || !text.trim() || text.length > CLIP_MAX || text.trim().length < 8) return;
      var tool = F.sniffText(text);
      if (!sure(text, tool)) return;
      var first = text.trim().split('\n')[0];
      $('clipName').textContent = first.length > 60 ? first.slice(0, 60) + '…' : first;
      var lines = text.split('\n').length;
      $('clipMeta').textContent = F.BY_ID[tool].name + ' · ' + size(new Blob([text]).size) +
        (lines > 1 ? ' · ' + lines.toLocaleString() + ' lines' : '');
      tile($('clipTile'), tool);
      tint($('clip'), tool);
      /* this page, when it is a file, stays first */
      return pageReady.then(function () {
        offer($('clip'), function () { tell({ kind: 'text', text: text, tool: tool, name: 'clipboard' }); });
      });
    }).catch(function () {});
  }

  var settings = S.get();
  Promise.all([settings, chrome.permissions.contains({ permissions: ['clipboardRead'] }), chrome.storage.local.get('tipClipboard')])
    .then(function (r) {
      var s = r[0], may = r[1];
      if (s.clipboard && may) { readClipboard(); return; }
      if (!r[2].tipClipboard) $('tip').hidden = false;
    });

  $('tipOn').addEventListener('click', function () {
    /* the wish first: Chrome's prompt may close the popup */
    S.set({ clipboard: true }).then(function () {
      return chrome.permissions.request({ permissions: ['clipboardRead'] });
    }).then(function (ok) {
      if (!ok) return S.set({ clipboard: false });
      $('tip').hidden = true;
      chrome.storage.local.set({ tipClipboard: 'on' });
      readClipboard();
    }, function () { S.set({ clipboard: false }); });
  });
  $('tipOff').addEventListener('click', function () {
    $('tip').hidden = true;
    chrome.storage.local.set({ tipClipboard: 'dismissed' });
  });

  /* ---------- paste ---------- */
  var paste = $('paste'), asBtn = $('asBtn'), asMenu = $('asMenu'), openBtn = $('openPaste');
  var chosen = null, detected = null, timer = null;

  $('openKeys').innerHTML = kbd([IS_MAC ? '⌘' : 'Ctrl', 'Enter']);

  function current() { return chosen || detected; }

  function refresh() {
    var text = paste.value;
    detected = text.trim() ? F.sniffText(text) : null;
    if (!text.trim()) chosen = null;
    var tool = current();
    asBtn.disabled = !tool;
    openBtn.disabled = !tool;
    $('openKeys').hidden = !tool;
    $('asName').textContent = tool ? F.BY_ID[tool].name : 'Detects the format';
    asBtn.title = tool ? (chosen ? 'Opening as ' : 'Looks like ') + F.BY_ID[tool].name + ' — choose another' : '';
    tile($('asTile'), tool);
    tint(document.querySelector('.paste'), tool);
    openBtn.textContent = tool ? 'Open in ' + F.BY_ID[tool].name : 'Open';
  }

  paste.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(refresh, 80);
  });

  function openPasted() {
    var tool = current();
    if (!tool || !paste.value.trim()) return;
    tell({ kind: 'text', text: paste.value, tool: tool, name: 'pasted' });
  }
  openBtn.addEventListener('click', openPasted);
  paste.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); refresh(); openPasted(); return; }
    /* Enter in an empty box takes the first card */
    if (e.key === 'Enter' && !e.shiftKey && !paste.value && primary) { e.preventDefault(); primary(); }
  });

  /* the format menu: detection is a guess, and the person has the last word */
  function closeMenu() {
    asMenu.classList.remove('open');
    asBtn.setAttribute('aria-expanded', 'false');
  }
  function buildMenu() {
    asMenu.textContent = '';
    var label = document.createElement('div');
    label.className = 'menu-label';
    label.textContent = 'Open as';
    asMenu.appendChild(label);
    TEXT_TOOLS.forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'menu-item';
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', String(current() === id));
      b.innerHTML = '<span class="tool-tile dot-' + id + '" aria-hidden="true"></span><span></span>' +
        '<span class="tick" aria-hidden="true">✓</span>';
      b.children[1].textContent = F.BY_ID[id].name + (detected === id ? ' (detected)' : '');
      b.addEventListener('click', function () {
        chosen = id === detected ? null : id;
        closeMenu();
        refresh();
        paste.focus();
      });
      asMenu.appendChild(b);
    });
  }
  asBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (asMenu.classList.contains('open')) { closeMenu(); return; }
    buildMenu();
    asMenu.classList.add('open');
    asBtn.setAttribute('aria-expanded', 'true');
    var first = asMenu.querySelector('[aria-checked="true"]') || asMenu.querySelector('.menu-item');
    if (first) first.focus();
  });
  document.addEventListener('click', function (e) { if (!asMenu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && asMenu.classList.contains('open')) { e.preventDefault(); closeMenu(); asBtn.focus(); }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && asMenu.classList.contains('open')) {
      e.preventDefault();
      var items = Array.prototype.slice.call(asMenu.querySelectorAll('.menu-item'));
      var i = items.indexOf(document.activeElement);
      i = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[i].focus();
    }
  });

  refresh();
  paste.focus();

  /* ---------- recent ---------- */
  function showRecent(list) {
    var rows = $('recentRows');
    rows.textContent = '';
    (list || []).slice(0, 5).forEach(function (r) {
      if (!F.BY_ID[r.tool]) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rrow';
      b.style.setProperty('--tool-hue', F.BY_ID[r.tool].hue);
      b.innerHTML = '<span class="tool-tile dot-' + r.tool + '" aria-hidden="true"></span>' +
        '<span class="rrow-text"><span class="rrow-name"></span><span class="rrow-meta"></span></span>';
      b.querySelector('.rrow-name').textContent = r.name;
      b.querySelector('.rrow-meta').textContent = [size(r.size), ago(r.at)].filter(Boolean).join(' · ');
      b.title = (r.stored ? 'Open again' : 'Too large to keep — opens the ' + F.BY_ID[r.tool].name + ' tool') +
        (r.from ? ' · from ' + r.from : '');
      if (!r.stored) b.dataset.gone = '';
      b.addEventListener('click', function () { tell({ kind: 'reopen', id: r.id }); });
      rows.appendChild(b);
    });
    $('recent').hidden = !rows.children.length;
  }
  settings.then(function (s) {
    if (!s.recents) return;
    chrome.storage.session.get('recents').then(function (v) { showRecent(v.recents); }, function () {});
  });
  $('clearRecent').addEventListener('click', function () {
    chrome.runtime.sendMessage({ kind: 'clear-recents' }).catch(function () {});
    $('recent').hidden = true;
    paste.focus();
  });

  /* ---------- tools ---------- */
  var grid = $('tools');
  F.TOOLS.forEach(function (t) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool-btn';
    b.style.setProperty('--tool-hue', t.hue);
    b.innerHTML = '<span class="tool-tile tile-md dot-' + t.id + '" aria-hidden="true"></span><span></span>';
    b.children[1].textContent = t.name;
    b.title = 'Open the ' + t.name + ' tool';
    b.addEventListener('click', function () { openTab(BASE + '/' + t.id + '/'); });
    grid.appendChild(b);
  });

  /* ---------- the shortcut, as Chrome has it now ---------- */
  chrome.commands.getAll().then(function (cmds) {
    var c = cmds.filter(function (x) { return x.name === 'open-here'; })[0];
    var link = $('shortcut');
    if (c && c.shortcut) {
      var keys = c.shortcut.split('+').map(function (k) { return k === 'Command' ? '⌘' : k; });
      link.innerHTML = '<span>Selection</span>' + kbd(keys);
    } else {
      link.textContent = 'Set a shortcut';
    }
    link.addEventListener('click', function (e) {
      e.preventDefault();
      openTab('chrome://extensions/shortcuts');
    });
  }).catch(function () {});
})();
