# NSFWDL download button

A userscript that adds a **⬇ Download** button to single-video pages on the
adult video sites [NSFWDL](https://nsfwdl.com/) supports. One click opens the
video in NSFWDL with the link already filled in, so you only pick a quality
and save the MP4.

**Supported sites:** PornHub, xHamster (including official mirrors), XVideos,
XNXX, RedGifs, Eporner, SpankBang, RedTube, YouPorn, TNAFlix, PornTrex,
NoodleMagazine, YouJizz, PornTop, Erome, Nuvid, Rule34Video, NSFW.xxx,
ThisVid, and the TXXX network (UPornia, HClips, HDZog, HotMovs, VJAV, VXXX
and more).

## Install

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/)
   or [Violentmonkey](https://violentmonkey.github.io/). On Android, use
   Firefox or Kiwi Browser with one of them.
2. Open [`nsfwdl-download-button.user.js`](nsfwdl-download-button.user.js)
   and click **Raw**. Your manager offers to install it.

## What it does, and what it doesn't

- It shows the button **only on single-video pages**, never on listings,
  searches or profiles. On sites that change pages without reloading, such
  as RedGifs, the button follows along.
- A click opens `nsfwdl.com/<site>-downloader` in a new tab and passes the
  video's address in the `#url=` fragment. Browsers never send that part of
  an address to a server, and NSFWDL removes it from the address bar on
  arrival.
- **No tracking, no network requests, no permissions** (`@grant none`).
  The only marker is `?ref=userscript` on the link, so NSFWDL can count
  visits that came from the button.
- It only works with public videos. NSFWDL does not get around logins,
  paywalls, private videos or copy protection. Download only what you are
  allowed to save.

## About NSFWDL

[NSFWDL](https://nsfwdl.com/) is a free online adult video downloader:
- no account, no pop-ups or redirects;
- MP4 in the qualities the uploader provided;
- free up to about 500 MB per file;
- works on iPhone, Android and desktop.

Guides: [how to save videos on iPhone and Android](https://nsfwdl.com/guides/how-to-download-nsfw-videos-on-iphone-and-android).

## License

MIT
