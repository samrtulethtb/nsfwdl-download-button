// ==UserScript==
// @name         NSFWDL – Download button for adult video sites
// @namespace    https://nsfwdl.com/
// @version      1.0.0
// @description  Adds a Download button to video pages on PornHub, xHamster, XVideos, XNXX, RedGifs, Eporner, SpankBang and 13 more sites. It opens the video in NSFWDL, the free downloader with no pop-ups, to save it as MP4.
// @author       NSFWDL
// @homepageURL  https://nsfwdl.com/
// @supportURL   https://nsfwdl.com/contact
// @license      MIT
// @match        *://*.xnxx.com/*
// @match        *://*.xvideos.com/*
// @match        *://*.xhamster.com/*
// @match        *://*.xhamster.one/*
// @match        *://*.xhamster.desi/*
// @match        *://*.xhms.pro/*
// @match        *://*.xhday.com/*
// @match        *://*.xhvid.com/*
// @match        *://*.eporner.com/*
// @match        *://*.erome.com/*
// @match        *://*.redgifs.com/*
// @match        *://*.youjizz.com/*
// @match        *://*.porntop.com/*
// @match        *://*.redtube.com/*
// @match        *://*.youporn.com/*
// @match        *://*.tnaflix.com/*
// @match        *://*.porntrex.com/*
// @match        *://*.noodlemagazine.com/*
// @match        *://*.txxx.com/*
// @match        *://*.txxx.tube/*
// @match        *://*.upornia.com/*
// @match        *://*.upornia.tube/*
// @match        *://*.vjav.com/*
// @match        *://*.vjav.tube/*
// @match        *://*.hclips.com/*
// @match        *://*.hdzog.com/*
// @match        *://*.hdzog.tube/*
// @match        *://*.hotmovs.com/*
// @match        *://*.hotmovs.tube/*
// @match        *://*.inporn.com/*
// @match        *://*.privatehomeclips.com/*
// @match        *://*.tubepornclassic.com/*
// @match        *://*.voyeurhit.com/*
// @match        *://*.voyeurhit.tube/*
// @match        *://*.vxxx.com/*
// @match        *://*.nuvid.com/*
// @match        *://*.rule34video.com/*
// @match        *://*.spankbang.com/*
// @match        *://*.nsfw.xxx/*
// @match        *://*.thisvid.com/*
// @match        *://*.pornhub.com/*
// @match        *://*.pornhub.org/*
// @include      /^https?:\/\/(?:[a-z0-9-]+\.)*xhamster[0-9]{1,3}\.(?:com|desi)\//
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

// What it does: on a single-video page of a supported site it shows one
// small "Download" button. Clicking it opens that video's NSFWDL downloader
// page in a new tab, with the link filled in through the #url= fragment
// (never sent to any server by the browser). No tracking, no network
// requests, no permissions (@grant none).
(function () {
  "use strict";

  const NSFWDL = "https://nsfwdl.com";
  const SITES = [
    {id: "xnxx", name: "XNXX", route: "/xnxx-downloader", hosts: ['xnxx.com'], hostPatterns: [], video: /^\/video-/},
    {id: "xvideos", name: "XVideos", route: "/xvideos-downloader", hosts: ['xvideos.com'], hostPatterns: [], video: /^\/video[.\d]/},
    {id: "xhamster", name: "xHamster", route: "/xhamster-downloader", hosts: ['xhamster.com', 'xhamster.one', 'xhamster.desi', 'xhms.pro', 'xhday.com', 'xhvid.com'], hostPatterns: [/(?:[a-z0-9-]+\.)*xhamster[0-9]{1,3}\.(?:com|desi)/], video: /^\/videos\//},
    {id: "eporner", name: "Eporner", route: "/eporner-downloader", hosts: ['eporner.com'], hostPatterns: [], video: /^\/(?:video-|hd-porn\/)/},
    {id: "erome", name: "Erome", route: "/erome-downloader", hosts: ['erome.com'], hostPatterns: [], video: /^\/a\//},
    {id: "redgifs", name: "RedGifs", route: "/redgifs-downloader", hosts: ['redgifs.com'], hostPatterns: [], video: /^\/watch\//},
    {id: "youjizz", name: "YouJizz", route: "/youjizz-downloader", hosts: ['youjizz.com'], hostPatterns: [], video: /^\/videos\//},
    {id: "porntop", name: "PornTop", route: "/porntop-downloader", hosts: ['porntop.com'], hostPatterns: [], video: /^\/video\//},
    {id: "redtube", name: "RedTube", route: "/redtube-downloader", hosts: ['redtube.com'], hostPatterns: [], video: /^\/\d+/},
    {id: "youporn", name: "YouPorn", route: "/youporn-downloader", hosts: ['youporn.com'], hostPatterns: [], video: /^\/watch\/\d+/},
    {id: "tnaflix", name: "TNAFlix", route: "/tnaflix-downloader", hosts: ['tnaflix.com'], hostPatterns: [], video: /\/video\d+/},
    {id: "porntrex", name: "Porntrex", route: "/porntrex-downloader", hosts: ['porntrex.com'], hostPatterns: [], video: /^\/video\/\d+/},
    {id: "noodlemagazine", name: "NoodleMagazine", route: "/noodlemagazine-downloader", hosts: ['noodlemagazine.com'], hostPatterns: [], video: /^\/watch\//},
    {id: "txxx", name: "TXXX", route: "/txxx-downloader", hosts: ['txxx.com', 'txxx.tube', 'upornia.com', 'upornia.tube', 'vjav.com', 'vjav.tube', 'hclips.com', 'hdzog.com', 'hdzog.tube', 'hotmovs.com', 'hotmovs.tube', 'inporn.com', 'privatehomeclips.com', 'tubepornclassic.com', 'voyeurhit.com', 'voyeurhit.tube', 'vxxx.com'], hostPatterns: [], video: /^\/(?:videos\/\d+|video-\d+)/},
    {id: "nuvid", name: "Nuvid", route: "/nuvid-downloader", hosts: ['nuvid.com'], hostPatterns: [], video: /^\/video\/\d+/},
    {id: "rule34video", name: "Rule34Video", route: "/rule34video-downloader", hosts: ['rule34video.com'], hostPatterns: [], video: /^\/video\/\d+/},
    {id: "spankbang", name: "SpankBang", route: "/spankbang-downloader", hosts: ['spankbang.com'], hostPatterns: [], video: /^\/[a-z0-9]+\/video\//},
    {id: "nsfwxxx", name: "NSFW.xxx", route: "/nsfwxxx-downloader", hosts: ['nsfw.xxx'], hostPatterns: [], video: /^\/post\/\d+/},
    {id: "thisvid", name: "ThisVid", route: "/thisvid-downloader", hosts: ['thisvid.com'], hostPatterns: [], video: /^\/videos\//},
    {id: "pornhub", name: "PornHub", route: "/pornhub-downloader", hosts: ['pornhub.com', 'pornhub.org'], hostPatterns: [], video: /^\/view_video\.php\?(?:.*&)?viewkey=/},
  ];

  function siteFor(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
    return SITES.find((site) =>
      site.hosts.some((base) => host === base || host.endsWith("." + base)) ||
      site.hostPatterns.some((pattern) => new RegExp("^" + pattern.source + "$").test(host))
    ) || null;
  }

  function isVideoPage(site, url) {
    return Boolean(site) && site.video.test(url.pathname + url.search);
  }

  function targetUrl(site, pageUrl) {
    return NSFWDL + site.route + "?ref=userscript#url=" + encodeURIComponent(pageUrl);
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {SITES, siteFor, isVideoPage, targetUrl};
    return;
  }

  const site = siteFor(location.hostname);
  if (!site) return;

  const button = document.createElement("a");
  button.id = "nsfwdl-download-button";
  button.target = "_blank";
  button.rel = "noopener";
  button.textContent = "⬇ Download";
  button.title = "Save this " + site.name + " video as MP4 with NSFWDL (free, no pop-ups)";
  button.setAttribute("aria-label", button.title);
  Object.assign(button.style, {
    position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647",
    padding: "10px 16px", borderRadius: "999px", font: "700 14px/1.2 system-ui, sans-serif",
    color: "#fff", background: "linear-gradient(135deg, #6f46ff, #fa2abf)", textDecoration: "none",
    boxShadow: "0 8px 24px -10px rgba(250, 42, 191, .7)", cursor: "pointer",
  });

  // Sites like RedGifs change pages without reloading, so keep the button in
  // step with the current address.
  let lastHref = "";
  function update() {
    if (location.href === lastHref) return;
    lastHref = location.href;
    const onVideo = isVideoPage(site, new URL(location.href));
    if (onVideo) {
      button.href = targetUrl(site, location.href);
      if (!button.isConnected) document.body.appendChild(button);
    } else if (button.isConnected) {
      button.remove();
    }
  }
  update();
  setInterval(update, 1000);
})();
