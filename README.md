# NSFWDL Video Downloader (userscript)

Download adult videos as **MP4** without leaving the page. Open the panel,
pick a real quality with its file size, watch the live progress, and the
file goes straight to your browser's downloads. Powered by
[NSFWDL](https://nsfwdl.com/), the free downloader with no pop-ups.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or
   [Violentmonkey](https://violentmonkey.github.io/). On Android, use them
   in Firefox (or Tampermonkey in Microsoft Edge). On iPhone and iPad, use
   Safari with the free Userscripts app or Stay.
2. Install the script from [Sleazy Fork](https://sleazyfork.org/en/scripts/597630)
   or a mirror:
   - [GitHub raw](https://raw.githubusercontent.com/samrtulethtb/nsfwdl-download-button/main/nsfwdl-download-button.user.js)
   - [GitLab raw](https://gitlab.com/smartulet-group/nsfwdl-download-button/-/raw/main/nsfwdl-download-button.user.js)

## What you get

- **In-page downloads.** A small Download button sits in the corner of a
  video page. Choose a quality and the MP4 is saved without opening a tab.
- **Real formats only.** Every quality comes from the actual video, with
  NSFWDL's file size (exact or estimated, marked with ~). Nothing invented.
- **Live progress.** Waiting, preparing (with a real percentage when the
  size is known), handed to your browser, saved. You can close the panel
  while it runs: the button shows the progress.
- **Buttons on thumbnails** (desktop). Hover a video on a listing, search or
  profile page and press ⬇ NSFWDL, without opening the video.
- **RedGifs feeds too:** scroll the home feed, a niche, a profile or the
  clips under a video, and the button takes the clip on screen (the page
  link doesn't change there, so the script reads which clip is playing).
- **xHamster mirrors too:** the button also appears on video pages of
  xHamster's mirror domains (xhspot.com, xhaccess.com and the like).
- **Preferred quality.** Set Best, 1080p, 720p, 480p or Smallest in ⚙
  Settings, and one click on Download starts it straight away.
- **Several downloads at once**, each with its own progress row. Start as
  many as you like: four run at a time and the rest wait their turn in the
  panel, then start on their own.
- **Already downloaded?** Videos you saved get a green outline on their
  thumbnails, "✓ Downloaded" on the button, and "✓ Again" on the hover
  button. The list stays in your userscript manager; turn it off or clear it
  in ⚙ Settings.
- **Works in a background tab.** The tab title shows the progress
  ("⬇ 45% · …"), and a notification tells you when a file is saved, or when
  it is ready and needs one tap.
- **Shortcut:** Alt+Shift+D opens the downloader on a video page.
- **Minimize** to a small round button, left or right corner; both are
  remembered.
- Falls back to opening the video in NSFWDL in a new tab when your
  userscript manager doesn't provide `GM_xmlhttpRequest`.

## Supported sites

Each link opens that site's downloader on nsfwdl.com, which works without
the script too.

- [PornHub](https://nsfwdl.com/pornhub-downloader) (videos and Shorties)
- [xHamster](https://nsfwdl.com/xhamster-downloader) (and its mirror domains)
- [XVideos](https://nsfwdl.com/xvideos-downloader)
- [XNXX](https://nsfwdl.com/xnxx-downloader)
- [RedGifs](https://nsfwdl.com/redgifs-downloader)
- [Eporner](https://nsfwdl.com/eporner-downloader)
- [SpankBang](https://nsfwdl.com/spankbang-downloader)
- [Erome](https://nsfwdl.com/erome-downloader)
- [YouJizz](https://nsfwdl.com/youjizz-downloader)
- [PornTop](https://nsfwdl.com/porntop-downloader)
- [RedTube](https://nsfwdl.com/redtube-downloader)
- [YouPorn](https://nsfwdl.com/youporn-downloader)
- [TNAFlix](https://nsfwdl.com/tnaflix-downloader)
- [Porntrex](https://nsfwdl.com/porntrex-downloader)
- [NoodleMagazine](https://nsfwdl.com/noodlemagazine-downloader)
- [The TXXX network](https://nsfwdl.com/txxx-downloader) (TXXX, Upornia, VJAV, HClips, HDZog, HotMovs, InPorn,
  VoyeurHit, VXXX and more)
- [Nuvid](https://nsfwdl.com/nuvid-downloader)
- [Rule34Video](https://nsfwdl.com/rule34video-downloader)
- [NSFW.xxx](https://nsfwdl.com/nsfwxxx-downloader)
- [ThisVid](https://nsfwdl.com/thisvid-downloader)

Any other link: the [universal downloader](https://nsfwdl.com/universal-nsfw-downloader). Full
list: [supported sites](https://nsfwdl.com/supported-sites).

## Free and Supporter

Downloads are free. Files over 500 MB need a paid
[NSFWDL Supporter key](https://nsfwdl.com/supporter); the panel shows those
qualities with a 🔒 and never starts them for a free session. This is
declared as `@antifeature payment`. Have a key? Enter it once in the panel's
⚙ Settings → Supporter key, and the large qualities unlock in the script.

## Privacy and permissions

- `@grant GM_xmlhttpRequest` (+ `GM.xmlHttpRequest`) with
  `@connect nsfwdl.com` and `@connect dl.nsfwdl.com` only: requests go to
  NSFWDL and nowhere else.
- **Nothing is sent until you click.** Hovering thumbnails or browsing
  sends nothing. When you open the panel, the video's public page link goes
  to nsfwdl.com to list its formats; choosing one starts the job and
  follows its status. The requests carry a fixed `/userscript` marker so
  NSFWDL can count downloads made from the script. Like any visit, they
  reach NSFWDL from your IP address.
- Supporter key (optional): userscript managers don't send nsfwdl.com
  cookies, so a key entered in Settings is exchanged once on nsfwdl.com for
  a session token. The script stores that token (never the key) in your
  userscript manager and sends it only to nsfwdl.com, in an
  `X-NSFWDL-Supporter` header. "Remove from this browser" ends the session.
- The script stores only its settings, whether you minimized the button, how
  many files it saved (for one rating reminder) and, unless you turn it off,
  the IDs of the videos you saved (to mark them), with
  `GM_getValue`/`GM_setValue`. None of it is ever sent anywhere.
- `@grant GM_notification` shows a notification when a download finishes
  while the tab is in the background. Nothing else.
- No analytics, ads or tracking code in the script. The interface is built
  from text nodes only (no `innerHTML`), inside a Shadow DOM.
- Links use `noopener`, `noreferrer` and `referrerPolicy="no-referrer"`.

The script doesn't bypass logins, private videos or paywalls. Download only
videos you are allowed to save.

## Development (in the NSFWDL repository)

```sh
node --test tests/frontend/userscript.test.mjs      # logic and header limits
NODE_PATH=/path/to/node_modules CHROME_BIN=/usr/bin/google-chrome \
  node tools/userscript/browser.test.cjs             # mocked browser checks
```

The browser suite answers every page and NSFWDL API call in-process; it
never contacts an adult site or NSFWDL. The site list is generated from
NSFWDL's source registry (`app/sources/registry.py`), and
`tests/test_seo_master.py::test_userscript_covers_exactly_the_registry_sources_and_routes`
fails when they drift apart. Bump `@version` on every change, then run
`tools/userscript/publish.sh`. It copies the script, README, listing text
and browser test to the public repository and pushes it to GitHub (which
Sleazy Fork syncs from) and GitLab.

## License

MIT
