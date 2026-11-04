/* lint.one extension — JSON, formatted where it is shown.

   Runs (through page.js) on a tab that shows raw JSON, when the person
   chose "Format it here". The page's own <pre> stays where it is, hidden,
   so "Open in lint.one" still reads exactly what the server sent; the tree
   is drawn beside it in a shadow root, so the page's styles cannot reach
   it and it reaches nothing of the page.

   Large documents stay quick: a branch's children are built only when it
   is opened, and long arrays arrive 200 at a time. */
(function (global) {
  'use strict';

  var PAGE = 200;                   // array items or keys built per step
  var RAW_MAX = 8 * 1024 * 1024;    // past this, Raw shows the text as sent

  var GLYPH = 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="227 239 760 760"><path d="M632 412L632 708A65 65 0 0 0 697 773L731 773' +
    'A22 22 0 0 1 753 795L753 831A22 22 0 0 1 731 853L638 853A95 95 0 0 1 543 758L543 522Q543 503 525 510L486 526Q461 536 461 510' +
    'L461 478Q461 458 479 448L596 389Q632 371 632 412Z"/></svg>') + '")';

  var CSS = [
    ':host { all: initial; }',
    '.v { --bg:#FBFBFC; --raised:#FFFFFF; --sunken:#F3F4F6; --ink:#1A1D23; --muted:#5F6672; --faint:#8A909C;',
    '  --line:#E4E6EB; --hover:#F1F2F5; --key:#6D28D9; --str:#0F766E; --num:#B45309; --lit:#1D4ED8; --hue:#4F46E5;',
    '  --sel:color-mix(in srgb, #4F46E5 10%, transparent);',
    '  font: 13px/1.6 "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink);',
    '  background: var(--bg); min-height: 100vh; }',
    '.v.dark { --bg:#15171C; --raised:#1B1E24; --sunken:#111317; --ink:#E6E9F0; --muted:#A0A7B4; --faint:#6E7581;',
    '  --line:#2A2E36; --hover:#22262D; --key:#C4B5FD; --str:#5EEAD4; --num:#FCD34D; --lit:#93C5FD; --hue:#818CF8; }',
    '* { box-sizing: border-box; }',
    '[hidden] { display: none !important; }',
    'button { font: inherit; color: inherit; background: none; border: 1px solid transparent; border-radius: 6px;',
    '  padding: 4px 10px; cursor: pointer; white-space: nowrap; }',
    'button:hover { background: var(--hover); }',
    'button:focus-visible, a:focus-visible { outline: 2px solid var(--hue); outline-offset: 1px; }',
    '.bar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 6px;',
    '  height: 46px; padding: 0 12px; background: var(--raised); border-bottom: 1px solid var(--line); }',
    '.brand { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; margin-right: 6px; }',
    '.mark { width: 22px; height: 22px; border-radius: 5px; background: var(--hue); position: relative; flex: none; }',
    '.mark::before { content: ""; position: absolute; inset: 0; background: #fff; -webkit-mask: ' + GLYPH + ' center / 100% no-repeat; }',
    '.tabs { display: inline-flex; padding: 2px; gap: 2px; background: var(--sunken); border: 1px solid var(--line); border-radius: 7px; }',
    '.tabs button { padding: 2px 12px; font-size: 12px; color: var(--muted); border-radius: 5px; }',
    '.tabs button[aria-selected="true"] { background: var(--raised); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgb(0 0 0 / .08); }',
    '.sep { width: 1px; height: 18px; background: var(--line); margin: 0 4px; }',
    '.tool { font-size: 12px; color: var(--muted); }',
    '.tool:hover { color: var(--ink); }',
    '.spacer { flex: 1; }',
    '.info { font-size: 12px; color: var(--faint); margin-right: 6px; }',
    '.primary { background: var(--hue); color: #fff; font-weight: 600; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }',
    '.primary:hover { background: color-mix(in srgb, var(--hue) 86%, #000); }',
    '.primary svg { width: 13px; height: 13px; }',
    '.body { padding: 10px 6px 64px; font: 13px/1.65 "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace; }',
    '.raw { margin: 0; padding: 6px 18px; white-space: pre-wrap; word-break: break-word; }',
    '.row { display: flex; align-items: baseline; gap: 0; padding: 0 8px 0 0; border-radius: 4px; white-space: nowrap; }',
    '.row:hover { background: var(--hover); }',
    '.row:hover .acts { visibility: visible; }',
    '.tw { flex: none; width: 18px; text-align: center; color: var(--faint); cursor: pointer; user-select: none; font-size: 10px; }',
    '.tw:hover { color: var(--ink); }',
    '.k { color: var(--key); cursor: pointer; }',
    '.k:hover { text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--key) 50%, transparent); }',
    '.ix { color: var(--faint); cursor: pointer; }',
    '.p { color: var(--faint); }',
    '.colon { margin-right: 0.6em; }',
    '.s { color: var(--str); white-space: pre-wrap; word-break: break-word; }',
    '.s a { color: inherit; }',
    '.n { color: var(--num); }',
    '.b, .z { color: var(--lit); }',
    '.sum { margin: 0 4px; cursor: pointer; }',
    '.sum .pv { color: var(--muted); }',
    '.sum .cnt { color: var(--faint); font-style: italic; margin-left: 8px; font-family: "IBM Plex Sans", system-ui, sans-serif; font-size: 12px; }',
    '.sum:hover .pv { color: var(--ink); }',
    '.val { min-width: 0; white-space: normal; }',
    '.acts { visibility: hidden; margin-left: 10px; display: inline-flex; gap: 2px; }',
    '.acts button { padding: 0 6px; font: 11px/18px "IBM Plex Sans", system-ui, sans-serif; color: var(--faint); border-color: var(--line); background: var(--raised); }',
    '.acts button:hover { color: var(--ink); }',
    '.kids { margin-left: 18px; border-left: 1px solid var(--line); padding-left: 0; }',
    '.kids[hidden] { display: none; }',
    '.more { margin: 2px 0 2px 18px; font-size: 12px; color: var(--hue); border-color: var(--line); font-family: "IBM Plex Sans", system-ui, sans-serif; }',
    '.foot { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2; display: flex; align-items: center; gap: 10px;',
    '  height: 30px; padding: 0 14px; font: 12px/1 "JetBrains Mono", ui-monospace, monospace; color: var(--muted);',
    '  background: var(--raised); border-top: 1px solid var(--line); }',
    '.foot .hint { margin-left: auto; font-family: "IBM Plex Sans", system-ui, sans-serif; color: var(--faint); }',
    '.toast { position: fixed; left: 50%; bottom: 44px; transform: translate(-50%, 8px); opacity: 0; z-index: 3;',
    '  padding: 6px 14px; border-radius: 999px; background: var(--ink); color: var(--bg); font-size: 12px; font-weight: 600;',
    '  transition: opacity .15s, transform .15s; pointer-events: none; }',
    '.toast.show { opacity: 1; transform: translate(-50%, 0); }',
    '@media (prefers-reduced-motion: reduce) { .toast { transition: none; } }'
  ].join('\n');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  /* orders[2].id, or ["a key"] when a key is not a plain name */
  function pathTo(parts) {
    return parts.reduce(function (p, k) {
      if (typeof k === 'number') return p + '[' + k + ']';
      return /^[A-Za-z_$][\w$]*$/.test(k) ? (p ? p + '.' : '') + k : p + '[' + JSON.stringify(k) + ']';
    }, '') || '$';
  }

  function count(v) {
    var n = 0, stack = [v];
    while (stack.length && n < 200000) {
      var x = stack.pop();
      n++;
      if (x && typeof x === 'object') {
        if (Array.isArray(x)) for (var i = 0; i < x.length; i++) stack.push(x[i]);
        else for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) stack.push(x[k]);
      }
    }
    return n;
  }

  function size(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  var URL_RE = /^(https?:\/\/[^\s"]+)$/;

  /* text: the page's text; value: it parsed; opts: { dark, onOpen } */
  function render(text, value, opts) {
    var host = el('div');
    host.id = 'lintone-view';
    host.dataset.head = text.slice(0, 4096);
    host.style.cssText = 'all: initial; display: block;';
    var root = host.attachShadow({ mode: 'open' });
    var style = el('style');
    style.textContent = CSS;
    root.appendChild(style);

    var v = el('div', 'v' + (opts.dark ? ' dark' : ''));
    root.appendChild(v);

    /* ---------- bar ---------- */
    var bar = el('div', 'bar');
    var brand = el('div', 'brand');
    brand.appendChild(el('span', 'mark'));
    brand.appendChild(el('span', null, 'JSON'));
    bar.appendChild(brand);

    var tabs = el('div', 'tabs');
    tabs.setAttribute('role', 'tablist');
    var tTree = el('button', null, 'Tree'), tRaw = el('button', null, 'Raw');
    [tTree, tRaw].forEach(function (b) { b.setAttribute('role', 'tab'); tabs.appendChild(b); });
    bar.appendChild(tabs);
    bar.appendChild(el('span', 'sep'));
    var bExpand = el('button', 'tool', 'Expand all');
    var bCollapse = el('button', 'tool', 'Collapse all');
    var bCopy = el('button', 'tool', 'Copy JSON');
    bar.appendChild(bExpand); bar.appendChild(bCollapse); bar.appendChild(bCopy);
    bar.appendChild(el('span', 'spacer'));
    var nodes = count(value);
    bar.appendChild(el('span', 'info', size(new Blob([text]).size) + ' · ' + nodes.toLocaleString() + (nodes >= 200000 ? '+' : '') + ' values'));
    var bOpen = el('button', 'primary');
    bOpen.innerHTML = 'Open in lint.one <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 5 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    bOpen.title = 'Search, compare, convert to YAML or CSV, and see the path to any value';
    bar.appendChild(bOpen);
    v.appendChild(bar);

    var body = el('div', 'body');
    v.appendChild(body);
    var foot = el('div', 'foot');
    var pathEl = el('span', null, '$');
    foot.appendChild(pathEl);
    foot.appendChild(el('span', 'hint', 'Click a key to copy its path · formatted by lint.one'));
    v.appendChild(foot);
    var toast = el('div', 'toast');
    toast.setAttribute('role', 'status');
    v.appendChild(toast);

    var toastTimer = null;
    function say(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1300);
    }
    function copy(text, msg) {
      navigator.clipboard.writeText(text).then(function () { say(msg); }, function () { say('Could not copy'); });
    }

    /* ---------- the tree ---------- */
    var tree = el('div', 'tree');
    var raw = null;

    function scalar(val) {
      var t = typeOf(val);
      if (t === 'string') {
        var s = el('span', 's');
        if (URL_RE.test(val)) {
          s.appendChild(document.createTextNode('"'));
          var a = el('a', null, val);
          a.href = val; a.target = '_blank'; a.rel = 'noopener noreferrer';
          s.appendChild(a);
          s.appendChild(document.createTextNode('"'));
        } else s.textContent = JSON.stringify(val);
        return s;
      }
      if (t === 'number') return el('span', 'n', String(val));
      if (t === 'boolean') return el('span', 'b', String(val));
      return el('span', 'z', 'null');
    }

    /* a closed branch says what is in it: its first few values, then how
       many there are — `id: 1001, status: "paid", …  4 keys` */
    function short(x) {
      var t = typeOf(x);
      if (t === 'string') return JSON.stringify(x.length > 24 ? x.slice(0, 24) + '…' : x);
      if (t === 'object') return '{…}';
      if (t === 'array') return '[…]';
      return String(x);
    }
    function summary(val) {
      var arr = Array.isArray(val);
      var keys = arr ? null : Object.keys(val);
      var n = arr ? val.length : keys.length;
      var bits = [], len = 0;
      for (var i = 0; i < Math.min(n, 6) && len < 56; i++) {
        var b = arr ? short(val[i]) : (/^[A-Za-z_$][\w$]*$/.test(keys[i]) ? keys[i] : JSON.stringify(keys[i])) + ': ' + short(val[keys[i]]);
        bits.push(b);
        len += b.length + 2;
      }
      var preview = bits.join(', ') + (bits.length < n ? ', …' : '');
      return { preview: preview, count: arr ? n + (n === 1 ? ' item' : ' items') : n + (n === 1 ? ' key' : ' keys') };
    }

    /* one row: its toggle, its key, its value or brackets, and its children */
    function node(key, val, parts, depth, open, last) {
      var wrap = el('div');
      var row = el('div', 'row');
      var t = typeOf(val);
      var branch = t === 'object' || t === 'array';
      var tw = el('span', 'tw', branch ? '▸' : '');
      row.appendChild(tw);
      if (key !== null) {
        var k = typeof key === 'number' ? el('span', 'ix', String(key)) : el('span', 'k', JSON.stringify(key));
        k.title = 'Copy the path';
        k.addEventListener('click', function () { copy(pathTo(parts), 'Copied ' + pathTo(parts)); });
        row.appendChild(k);
        row.appendChild(el('span', 'p colon', ':'));
      }
      var comma = last ? '' : ',';
      row.addEventListener('mouseenter', function () { pathEl.textContent = pathTo(parts); });

      if (!branch) {
        var valEl = el('span', 'val');
        valEl.appendChild(scalar(val));
        valEl.appendChild(el('span', 'p', comma));
        row.appendChild(valEl);
        var acts = el('span', 'acts');
        var c = el('button', null, 'Copy');
        c.addEventListener('click', function () { copy(t === 'string' ? val : JSON.stringify(val), 'Copied value'); });
        acts.appendChild(c);
        row.appendChild(acts);
        wrap.appendChild(row);
        return wrap;
      }

      var isArr = t === 'array';
      var openB = el('span', 'p', isArr ? '[' : '{');
      var sm = summary(val);
      var sum = el('span', 'sum');
      if (sm.preview) sum.appendChild(el('span', 'pv', sm.preview));
      sum.appendChild(el('span', 'cnt', sm.count));
      var closeInline = el('span', 'p', (isArr ? ']' : '}') + comma);
      row.appendChild(openB);
      row.appendChild(sum);
      row.appendChild(closeInline);
      var acts2 = el('span', 'acts');
      var c2 = el('button', null, 'Copy');
      c2.addEventListener('click', function () { copy(JSON.stringify(val, null, 2), 'Copied ' + (isArr ? 'array' : 'object')); });
      acts2.appendChild(c2);
      row.appendChild(acts2);
      wrap.appendChild(row);

      var kids = el('div', 'kids');
      kids.hidden = true;
      var closeRow = el('div', 'row');
      closeRow.appendChild(el('span', 'tw'));
      closeRow.appendChild(el('span', 'p', (isArr ? ']' : '}') + comma));
      closeRow.hidden = true;
      wrap.appendChild(kids);
      wrap.appendChild(closeRow);

      var keys = isArr ? null : Object.keys(val);
      var total = isArr ? val.length : keys.length;
      var built = 0, more = null;

      function build() {
        var end = Math.min(total, built + PAGE);
        var frag = document.createDocumentFragment();
        for (var i = built; i < end; i++) {
          var kk = isArr ? i : keys[i];
          frag.appendChild(node(kk, val[kk], parts.concat(kk), depth + 1, false, i === total - 1));
        }
        built = end;
        if (more) more.remove();
        kids.appendChild(frag);
        if (built < total) {
          more = el('button', 'more', 'Show ' + Math.min(PAGE, total - built) + ' more of ' + (total - built).toLocaleString());
          more.addEventListener('click', build);
          kids.appendChild(more);
        }
      }

      function setOpen(on) {
        if (on && !built && total) build();
        wrap.dataset.open = on ? '1' : '';
        kids.hidden = !on || !total;
        closeRow.hidden = !on || !total;
        sum.hidden = on && total > 0;
        closeInline.hidden = on && total > 0;
        tw.textContent = on ? '▾' : '▸';
      }
      wrap._setOpen = setOpen;
      wrap._isOpen = function () { return !!wrap.dataset.open; };
      tw.addEventListener('click', function () { setOpen(!wrap._isOpen()); });
      sum.addEventListener('click', function () { setOpen(true); });
      setOpen(open && total > 0);
      return wrap;
    }

    var startDepth = nodes < 3000 ? 3 : 1;
    function openTo(wrap, depth, max) {
      if (!wrap._setOpen) return;
      if (depth < max) wrap._setOpen(true);
      var kids = wrap.children[1];
      if (!kids || kids.hidden) return;
      Array.prototype.forEach.call(kids.children, function (c) { openTo(c, depth + 1, max); });
    }

    var top = node(null, value, [], 0, true, true);
    tree.appendChild(top);
    openTo(top, 0, startDepth);

    /* ---------- views ---------- */
    function show(which) {
      tTree.setAttribute('aria-selected', String(which === 'tree'));
      tRaw.setAttribute('aria-selected', String(which === 'raw'));
      body.textContent = '';
      if (which === 'tree') {
        body.appendChild(tree);
      } else {
        if (!raw) raw = el('pre', 'raw', text.length > RAW_MAX ? text : JSON.stringify(value, null, 2));
        body.appendChild(raw);
      }
      bExpand.hidden = bCollapse.hidden = which !== 'tree';
    }
    tTree.addEventListener('click', function () { show('tree'); });
    tRaw.addEventListener('click', function () { show('raw'); });

    /* Expand all opens what is already built a level at a time, so a huge
       document does not freeze the tab building every branch at once */
    bExpand.addEventListener('click', function () {
      var budget = 5000;
      (function walk(w) {
        if (budget <= 0 || !w._setOpen) return;
        budget--;
        w._setOpen(true);
        var kids = w.children[1];
        Array.prototype.forEach.call(kids.children, function (c) { walk(c); });
      })(top);
      if (budget <= 0) say('Opened the first 5,000 branches');
    });
    bCollapse.addEventListener('click', function () {
      (function walk(w) {
        if (!w._setOpen) return;
        var kids = w.children[1];
        Array.prototype.forEach.call(kids.children, function (c) { walk(c); });
        w._setOpen(w === top);
      })(top);
    });
    bCopy.addEventListener('click', function () { copy(JSON.stringify(value, null, 2), 'Copied JSON'); });
    bOpen.addEventListener('click', function () { if (opts.onOpen) opts.onOpen(); });

    show('tree');
    return host;
  }

  global.lintoneViewer = { render: render };
})(self);
