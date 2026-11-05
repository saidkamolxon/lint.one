# lint.one for Chrome

Opens what you find in the browser (a selection, a link, a raw JSON page,
pasted text, a tab's sound) in the lint.one tool that reads it. Nothing is uploaded:
the file goes from the page to the extension to the tool's tab, all inside
the browser.

## Try it

```bash
npm run build:extension     # extension/dist, talking to https://lint.one
```

1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. **Load unpacked** → choose `extension/dist`.
3. Pin it from the puzzle-piece menu so its button stays in the toolbar.

After changing a file, run the build again and press ↻ on the extension's
card.

To work on the site and the extension together, run `npm run dev` (the site
at `localhost:8787`) and build with `npm run dev:extension`: that build
opens files in the local site instead of lint.one, and is named
"lint.one (dev)" so the two can sit side by side.

## How it fits together

| File | Runs in | What it does |
| :-- | :-- | :-- |
| `background.js` | the service worker | Right-click menu, omnibox, messages; decides the tool, opens its tab, passes the file on |
| `grab.js` | the page a file comes from | Reads a link or the page itself, with that page's cookies, and streams it to the worker |
| `bridge.js` | lint.one | Receives the file and hands it to the page (`takeHandoff` in `shared/app.js`); remembers lint.one's theme |
| `audio/public/index.html` | the Audio tool | Takes the tab's sound from the stream id the bridge passes on (`listenTab`) |
| `grant.*` | a small window | Asks for tab capture the first time someone listens, on a click Chrome accepts, then reopens the playing tab once |
| `fullscreen.js` | a tab being listened to | Tells the worker when its video goes fullscreen, so the window can follow |
| `page.js` | every site, only when "Raw data pages" asks for it | On a raw JSON/XML/YAML/CSV tab: formats it in place, offers a button, or opens it in lint.one |
| `viewer.js` | a raw JSON tab | The in-place tree: lazy branches, a preview of each closed one, paths copied on click, Raw view, Open in lint.one |
| `popup.*` | the toolbar button | This page, what was just copied, the tab's sound, paste, recently opened, every tool |
| `options.*` | the settings page | Raw data pages, the clipboard, recents, the toolbar mark, shortcuts |
| `welcome.*` | a tab, once, on install | The four ways in, files to try, and the raw-data-page choice |
| `pagemode.js` | settings and welcome | The raw-data-page chooser both pages show |
| `pages.css` | settings and welcome | Their frame, rows, switches and the chooser |
| `settings.js` | everywhere | Every setting's default, in one place |
| `formats.js` | all of the above | Which tool reads what, the same table the landing page uses |
| `ui.css`, `ui-theme.js` | the extension's pages | The few pieces `shared/` doesn't have; lint.one's theme |

### What it does beyond opening files

- **The popup offers what is at hand.** The page you are on when it is a
  file, what you just copied (once you allow it), the tab's sound, and
  the last few files you opened. Enter opens the first.
- **Recently opened** is kept in `chrome.storage.session`: in memory,
  gone when Chrome closes, never on disk. Files over 2 MB are listed but
  not kept.
- **The toolbar icon marks a file.** On `/users.json` the mark carries
  JSON's colour. `declarativeContent` does it by the address alone, with
  no access to the page and no line in the install dialog.
- **Alt+Shift+O** opens the selection, or the page when it is a file, or
  the popup on any other page.
- **Raw data pages** (Settings): leave them, format JSON in place (the
  others get a button), or open them in lint.one. Either of the last two
  asks for access to every site, on the click that chooses it, and gives
  it back when switched off.
- **A welcome page** on install shows the ways in and asks the one
  question worth asking up front.

The popup loads `shared/theme.css` and `shared/app.css`, which
the build copies in, so they share the tools' tokens, components, fonts
and glyphs rather than a copy that drifts. `icons/` holds the mark rendered
from `shared/glyph.svg` at the sizes Chrome asks for.

## Publishing to the Chrome Web Store

`npm run build:extension` also writes `extension/lint.one-extension-<version>.zip`,
which is what the store takes. Bump `version` in `src/manifest.json` for
every upload.

One-time setup, in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole):
register (a one-time fee), then pick `lint.one` as the item's
**Official URL**. That needs the same Google account to be an owner of
lint.one in Search Console.

### Listing

**Name:** lint.one

**Summary** (132 characters max; the manifest's `description`):
Read the data you find on the web in a private viewer. Raw JSON is formatted where it opens. Nothing is uploaded.

**Description:**

> lint.one opens the data you come across while browsing, such as an API
> response, a file behind a link or text you just copied, in a viewer made
> for it.
>
> Raw JSON pages become a tree you can fold, with a preview of every branch
> and the path to any value one click away. Other files open in the
> matching lint.one tool, where you can search, filter, convert and check
> them.
>
> Ways to open something:
> - Right-click a link, a selection or a file page and choose Open in lint.one
> - Click the toolbar button: it offers the page you are on and what you just copied
> - Select text and press Alt+Shift+O
> - In the address bar, type "lint", a space, and paste
>
> The toolbar icon takes on a colour when the page you are on is a file
> lint.one can open, and the files you opened recently stay in the popup
> until Chrome closes.
>
> Private by design: lint.one runs entirely in your browser. Files go from
> the page to the lint.one tab inside the browser, never in a URL and never
> through a server. No analytics, no accounts, no remote code.

The store rejected 0.4.0 for keyword spam ("Yellow Argon") because the
summary was a list of formats. Keep the summary and the description in
sentences, and name formats sparingly.

**Category:** Developer Tools

**Images:** [`store/`](store/) holds them, ready to upload:
`screenshot-1..5.png` (1280×800), `promo-small.png` (440×280) and
`promo-marquee.png` (1400×560). `store/shoot.mjs` draws them again from the
tools' own samples, the real popup and the in-page viewer:

```bash
npm run build && npm run dev:extension && node extension/store/shoot.mjs
```

**Privacy policy URL:** https://lint.one/privacy/ (`site/public/privacy/`)

### What the install dialog says

*"Read and change your data on lint.one"*, and nothing else (checked with
`chrome.management.getPermissionWarningsByManifest`). Two things would
turn that into *"Read and change all your data on all websites"*, so
neither is in the manifest as a requirement (`declarativeContent` and
`commands` add no line at all):

- `tabCapture` is an optional permission, asked for the first time someone
  listens to a tab. Chrome only asks after a click on the extension's own
  page, and a menu item does not count, so a small window (`grant.html`)
  asks, says beforehand how Chrome will word it, and then reopens the
  playing tab once: Chrome only lets an extension hear a tab that was
  clicked while the permission was already held.
- There is no DevTools panel: `devtools_page` alone brings that line. The
  panel that was here (commit `d708c3d`, `extension/src/panel.*`) can come
  back as a separate extension for developers.

### Permission justifications

The dashboard asks for one line per permission:

| Permission | Why |
| :-- | :-- |
| `activeTab` | Reads the selection, link or page the person chose, in the tab they chose it in, only when they click. |
| `contextMenus` | Adds "Open in lint.one" to the right-click menu. |
| `scripting` | Reads the chosen selection, link or page from inside that page, so a link behind a login works with the page's own cookies. |
| `storage` | Remembers the settings and the theme picked on lint.one, and, in memory until Chrome closes, the files opened recently so the popup can open them again. |
| `declarativeContent` | Colours the toolbar icon on a page whose address is a file lint.one reads (`/users.json`), without access to the page. |
| `clipboardRead` (optional) | Asked for only when the person turns on "Offer what I just copied": the popup reads the clipboard while it is open, to offer it in one click. Nothing is kept or sent. |
| `tabCapture` (optional) | Asked for the first time the person chooses "Listen to this tab": lets the lint.one Audio tab hear the tab the person chose, only when they click, to draw its live spectrum. Nothing is recorded or sent. |
| Content script on `https://lint.one/*` | Hands the file to the lint.one page that shows it. |
| Optional access to all sites | Asked for only when the person chooses, under "Raw data pages", to format raw JSON in place or to open such pages in lint.one; the script looks only at tabs that are raw JSON, XML, YAML or CSV. Also lets links to other sites be read. |

**Single purpose:** open files and data found in the browser in the
lint.one viewers.

**Data usage:** collects no user data; nothing is sold, transferred or used
for anything but opening the file the person chose; remote code: none.
