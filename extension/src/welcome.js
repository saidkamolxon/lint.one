/* lint.one extension — the welcome page: the ways in, a few files to try,
   and the one setting worth choosing up front. */
(function () {
  'use strict';
  var F = self.LintFormats;
  var BASE = self.LINT_BASE;
  var $ = function (id) { return document.getElementById(id); };

  /* the suite, one tile each, rising in turn */
  $('suite').innerHTML = F.TOOLS.map(function (t, i) {
    return '<span class="tool-tile dot-' + t.id + '" style="animation-delay:' + (i * 40) + 'ms"></span>';
  }).join('');

  /* the shortcut as Chrome has it now */
  chrome.commands.getAll().then(function (cmds) {
    var c = cmds.filter(function (x) { return x.name === 'open-here'; })[0];
    if (!c || !c.shortcut) { $('bigKeys').innerHTML = '<kbd>Set a shortcut</kbd>'; return; }
    var keys = c.shortcut.split('+').map(function (k) { return k === 'Command' ? '⌘' : k; });
    $('bigKeys').innerHTML = keys.map(function (k) { return '<kbd>' + k + '</kbd>'; }).join('');
    $('keyText').innerHTML = keys.map(function (k) { return '<kbd>' + k + '</kbd>'; }).join(' ');
  }).catch(function () {});

  /* ---------- try it ---------- */
  var SAMPLES = [
    { tool: 'json', name: 'order.json', note: 'A tree with paths',
      text: JSON.stringify({ id: 1042, status: 'paid', placedAt: '2026-03-14T09:31:07Z',
        customer: { name: 'Dilnoza', city: 'Tashkent', email: 'dilnoza@example.com' },
        items: [{ sku: 'KB-75', title: 'Keyboard', qty: 1, price: 119 }, { sku: 'MS-02', title: 'Mouse', qty: 2, price: 49 }],
        shipping: { method: 'courier', eta: '2026-03-16' }, total: 217 }, null, 2) },
    { tool: 'env', name: '.env', note: 'Finds what breaks',
      text: '# local\nNODE_ENV=development\nPORT=80 80\nDATABASE_URL=postgres://app:p@ss#2024@localhost:5432/app\nAPI_URL=http//api.example.com\nDEBUG=yes \nAPI_URL=https://api.example.com\n' },
    { tool: 'log', name: 'checkout.log', note: 'Filter by severity',
      text: [
        '2026-03-14T09:31:00.895Z INFO  [api] Starting checkout-api 2.4.1 on port 8080',
        '2026-03-14T09:31:01.702Z INFO  [api] Connected to postgres at db:5432',
        '2026-03-14T09:31:04.120Z DEBUG [api] Cache hit cart:1062',
        '2026-03-14T09:31:05.311Z WARN  [api] Retrying payment provider, attempt 1 of 3',
        '2026-03-14T09:31:07.639Z ERROR [api] Payment provider did not answer: user=1010',
        'System.Net.Http.HttpRequestException: The SSL connection could not be established',
        '   at Shop.Payments.StripeClient.ChargeAsync(Charge charge) in /src/Payments/StripeClient.cs:line 112',
        '   at Shop.Checkout.CheckoutHandler.Handle(CheckoutRequest request) in /src/Checkout/CheckoutHandler.cs:line 71',
        '2026-03-14T09:31:08.098Z INFO  [api] POST /v2/cart/items 201 in 158ms user=1045',
        '2026-03-14T09:31:09.873Z ERROR [api] POST /v2/checkout 500 in 72ms user=1076'
      ].join('\n') },
    { tool: 'csv', name: 'endpoints.csv', note: 'A sortable table',
      text: 'endpoint,method,auth,p99_ms,rate_limit\n/v2/cart,GET,required,84,120\n/v2/cart,POST,required,97,120\n/v2/checkout,POST,required,212,30\n/v2/orders,GET,required,143,60\n/health,GET,none,3,\n/v2/search,GET,optional,318,45\n' }
  ];
  $('try').innerHTML = SAMPLES.map(function (s, i) {
    return '<button type="button" class="try-btn" data-i="' + i + '" style="--tool-hue:' + F.BY_ID[s.tool].hue + '">' +
      '<span class="tool-tile dot-' + s.tool + '" aria-hidden="true"></span>' +
      '<span><span class="try-name">' + s.name + '</span><span class="try-note">' + s.note + '</span></span></button>';
  }).join('');
  $('try').addEventListener('click', function (e) {
    var b = e.target.closest('.try-btn');
    if (!b) return;
    var s = SAMPLES[+b.dataset.i];
    chrome.runtime.sendMessage({ kind: 'text', text: s.text, tool: s.tool, name: s.name }).catch(function () {});
  });

  /* ---------- the one choice ---------- */
  var timer = null;
  LintPageMode.mount($('data'), function () {
    var el = $('saved');
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(function () { el.classList.remove('show'); }, 1400);
  });

  $('settings').addEventListener('click', function (e) { e.preventDefault(); chrome.runtime.openOptionsPage(); });
  document.querySelectorAll('[data-href]').forEach(function (a) {
    a.href = BASE + a.dataset.href;
    a.target = '_blank';
    a.rel = 'noopener';
  });
})();
