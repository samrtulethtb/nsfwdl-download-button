// Browser-level checks for nsfwdl-download-button.user.js 2.0 (in-page
// downloads). Every page and every NSFWDL API answer is answered in-process:
// no adult site and no NSFWDL endpoint is contacted. GM_xmlhttpRequest comes
// from a small polyfill on top of the intercepted network.
//
// Run (Playwright for Node from anywhere, plus a Chrome binary):
//   NODE_PATH=/path/to/node_modules CHROME_BIN=/usr/bin/google-chrome node tools/userscript/browser.test.cjs
"use strict";

const fs = require("fs");
const path = require("path");
const {chromium} = require("playwright");

const SCRIPT = fs.readFileSync(path.join(__dirname, "..", "nsfwdl-download-button.user.js"), "utf8");
let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) { console.log("[PASS] " + name); passed += 1; }
  else { console.log("[FAIL] " + name + (detail === undefined ? "" : "  (" + JSON.stringify(detail) + ")")); failed += 1; }
}

const GM_POLYFILL = (store) => `
  window.GM_xmlhttpRequest = function (opts) {
    fetch(opts.url, {method: opts.method || "GET", headers: opts.headers || {}, body: opts.data})
      .then(async (r) => opts.onload({status: r.status, responseText: await r.text()}))
      .catch(() => opts.onerror && opts.onerror({}));
  };
  window.__gmStore = ${JSON.stringify(store || {})};
  window.GM_getValue = (k, d) => (k in window.__gmStore ? window.__gmStore[k] : d);
  window.GM_setValue = (k, v) => { window.__gmStore[k] = v; };
  window.__menu = [];
  window.GM_registerMenuCommand = (name, fn) => window.__menu.push({name, fn});
`;

const VIDEO_PAGE = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>Mock video page</main></body></html>';
const LISTING_PAGE = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
  <a id="thumb1" href="/view_video.php?viewkey=listing1" style="display:inline-block;margin:40px"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="320" height="180" alt=""></a>
  <a id="small" href="/view_video.php?viewkey=tiny" style="display:inline-block"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="40" height="40" alt=""></a>
  <a id="model" href="/model/someone"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="320" height="180" alt=""></a>
</body></html>`;

const DOWNLOAD_ID = "kwFOj2X8oRpt9g0Ei36Oe7jKC88Szjwz";
const EXTRACT = {
  request_id: "r1", source: "pornhub", title: "Fixture <img src=x onerror=alert(1)> title", duration: 212,
  formats: [
    {format_ref: "ref-240-aaaaaaaaaaaaaaaa", quality_label: "240p", height: 240, estimated_size_bytes: 3_700_000, size_kind: "estimated", access: "free", has_video: true},
    {format_ref: "ref-720-aaaaaaaaaaaaaaaa", quality_label: "720p", height: 720, estimated_size_bytes: 110_000_000, size_kind: "estimated", access: "free", has_video: true, recommended: true},
    {format_ref: "ref-1080-aaaaaaaaaaaaaaa", quality_label: "1080p", height: 1080, fps: 60, estimated_size_bytes: 220_000_000, size_kind: "exact", access: "free", has_video: true},
    {format_ref: "ref-2160-aaaaaaaaaaaaaaa", quality_label: "2160p", height: 2160, estimated_size_bytes: 900_000_000, size_kind: "estimated", access: "supporter", has_video: true},
  ],
};

function json(route, body, status) {
  return route.fulfill({status: status || 200, contentType: "application/json", body: JSON.stringify(body)});
}

// Default API: route → extract → download (queued) → preparing → ready →
// browser receiving → delivered.
function defaultApi(overrides) {
  let polls = 0;
  return async (route, url, calls) => {
    const o = overrides || {};
    if (url.pathname === "/api/route") return json(route, {route: "/pornhub-downloader", source: "pornhub", mode: "validated"});
    if (url.pathname === "/api/extract") return o.extract ? o.extract(route) : json(route, EXTRACT);
    if (url.pathname === "/api/download") return json(route, {download_id: DOWNLOAD_ID, state: "queued", mode: "prepared_temp_artifact", download_url: `https://dl.nsfwdl.com/d/${DOWNLOAD_ID}`, expires_in: 3600});
    if (url.pathname === `/api/download/${DOWNLOAD_ID}/status`) {
      polls += 1;
      const delivered = calls.some((c) => c.startsWith("/d/")) && polls > 3;
      if (polls === 1) return json(route, {download_id: DOWNLOAD_ID, state: "preparing", mode: "prepared_temp_artifact", bytes_prepared: 55_000_000, handoff: "waiting"});
      return json(route, {download_id: DOWNLOAD_ID, state: "ready", mode: "prepared_temp_artifact", bytes_prepared: 110_000_000, handoff: delivered ? "delivered" : calls.some((c) => c.startsWith("/d/")) ? "receiving" : "waiting"});
    }
    if (url.pathname === `/d/${DOWNLOAD_ID}`) {
      return route.fulfill({status: 200, headers: {"Content-Type": "video/mp4", "Content-Disposition": 'attachment; filename="video.mp4"'}, body: "x".repeat(2048)});
    }
    return route.fulfill({status: 404, body: ""});
  };
}

async function setup(browser, {viewport, pageHtml, api, hasTouch}) {
  const context = await browser.newContext({viewport: viewport || {width: 1280, height: 800}, acceptDownloads: true, hasTouch: Boolean(hasTouch), isMobile: Boolean(hasTouch)});
  const calls = [];
  const bodies = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === "nsfwdl.com" || url.hostname === "dl.nsfwdl.com") {
      calls.push(url.pathname + url.search);
      if (request.postData()) bodies.push(JSON.parse(request.postData()));
      return api(route, url, calls);
    }
    if (request.isNavigationRequest()) return route.fulfill({contentType: "text/html", body: pageHtml || VIDEO_PAGE});
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  return {context, page, calls, bodies, errors};
}

async function inject(page, {gm = true, store} = {}) {
  if (gm) await page.addScriptTag({content: GM_POLYFILL(store)});
  await page.addScriptTag({content: SCRIPT});
  await page.waitForTimeout(150);
}

const widget = (page, selector) => page.locator("#nsfwdl-download-widget").locator(selector);

async function main() {
  const browser = await chromium.launch({executablePath: process.env.CHROME_BIN || undefined, headless: true});
  try {
    // 1. Pick a format, follow the job, save the file.
    {
      const {context, page, calls, bodies, errors} = await setup(browser, {api: defaultApi()});
      await page.goto("https://www.pornhub.com/view_video.php?viewkey=abc123");
      await inject(page);
      check("dock appears on a video page", await widget(page, ".dock").isVisible());
      check("nothing is requested before the panel opens", calls.length === 0, calls);
      await widget(page, ".dock .btn-primary").click();
      await widget(page, ".card").first().waitFor();
      const labels = await widget(page, ".card .q").allTextContents();
      check("formats are listed best first", JSON.stringify(labels) === JSON.stringify(["2160p", "1080p", "720p", "240p"]), labels);
      check("the 4K format is locked for a free session", await widget(page, ".card.locked").count() === 1);
      const title = await widget(page, ".title").textContent();
      check("the title is rendered as text", title.includes("<img src=x onerror=alert(1)>"), title);
      check("API calls carry the /userscript marker", bodies.length >= 2 && bodies.every((b) => b.page_path === "/userscript"), bodies);
      const downloadPromise = page.waitForEvent("download", {timeout: 15000});
      await widget(page, ".card", ).filter({hasText: "1080p"}).click();
      await widget(page, ".job").waitFor();
      const firstLine = await widget(page, ".job .line").textContent();
      check("the job row shows a starting or queued state", /Starting|Waiting|Preparing/.test(firstLine), firstLine);
      await page.waitForFunction(() => {
        const root = document.querySelector("#nsfwdl-download-widget").shadowRoot;
        const line = root.querySelector(".job .line");
        return line && /Preparing \d+%/.test(line.textContent);
      }, null, {timeout: 6000}).then(() => check("measured preparing percentage is shown", true), () => check("measured preparing percentage is shown", false));
      const download = await downloadPromise.catch(() => null);
      check("the finished file is handed to the browser's downloads", Boolean(download));
      check("the page itself stays in place", page.url().startsWith("https://www.pornhub.com/view_video.php"));
      await page.waitForFunction(() => /Saved/.test(document.querySelector("#nsfwdl-download-widget").shadowRoot.querySelector(".job .line").textContent), null, {timeout: 12000})
        .then(() => check("the job ends as saved once the server sees the file delivered", true), () => check("the job ends as saved once the server sees the file delivered", false));
      check("the dock says Saved", (await widget(page, ".dock .btn-primary").textContent()).includes("Saved"));
      check("the reserved sponsor slot never shows anything", await widget(page, ".sponsor-slot:not([hidden])").count() === 0);
      check("no page errors", errors.length === 0, errors);
      await context.close();
    }

    // 2. Preferred quality: one click starts it.
    {
      const {context, page, bodies} = await setup(browser, {api: defaultApi()});
      await page.goto("https://www.pornhub.com/shorties/68f81075af02c");
      await inject(page, {store: {settings: {quality: "720", position: "left", thumbs: true}}});
      check("Shorties pages get the button", await widget(page, ".dock").isVisible());
      const box = await page.locator("#nsfwdl-download-widget").boundingBox();
      check("the left position setting is applied", box && box.x < 100, box);
      await widget(page, ".dock .btn-primary").click();
      await widget(page, ".job").waitFor({timeout: 8000});
      const started = bodies.find((b) => b.format_ref);
      check("one click starts the preferred quality", started && started.format_ref === "ref-720-aaaaaaaaaaaaaaaa", started);
      await context.close();
    }

    // 3. A deterministic error: clear message, no retry.
    {
      const api = defaultApi({extract: (route) => json(route, {error_kind: "geo_blocked", message: "The site blocks this video in the country NSFWDL's server is in, so it can't be downloaded here.", transient: false, category: "source"}, 403)});
      const {context, page} = await setup(browser, {api});
      await page.goto("https://www.pornhub.com/view_video.php?viewkey=abc123");
      await inject(page);
      await widget(page, ".dock .btn-primary").click();
      await widget(page, ".error").waitFor();
      check("the server's message is shown", (await widget(page, ".error").textContent()).includes("blocks this video"));
      check("no Try again for a permanent error", await widget(page, "text=Try again").count() === 0);
      await context.close();
    }

    // 4. Thumbnails on a listing page.
    {
      const {context, page, bodies, errors} = await setup(browser, {api: defaultApi(), pageHtml: LISTING_PAGE});
      await page.goto("https://www.pornhub.com/video");
      await inject(page);
      check("no dock on a listing page", !(await page.locator("#nsfwdl-download-widget").isVisible().catch(() => false)));
      await page.hover("#thumb1 img");
      await page.waitForTimeout(100);
      const thumb = page.locator("#nsfwdl-thumb-button");
      check("a thumbnail gets the download button on hover", await thumb.isVisible());
      check("nothing is requested on hover", bodies.length === 0, bodies);
      await page.hover("#model img");
      await page.waitForTimeout(400);
      check("a non-video link gets no button", !(await thumb.isVisible()));
      await page.hover("#small img");
      await page.waitForTimeout(400);
      check("a tiny image gets no button", !(await thumb.isVisible()));
      await page.hover("#thumb1 img");
      await page.waitForTimeout(100);
      await thumb.locator("button").click();
      await widget(page, ".card").first().waitFor({timeout: 8000});
      check("the panel opens for the thumbnail's video", bodies.some((b) => b.url === "https://www.pornhub.com/view_video.php?viewkey=listing1"), bodies);
      check("the click did not navigate", page.url() === "https://www.pornhub.com/video");
      check("no page errors on the listing", errors.length === 0, errors);
      await context.close();
    }

    // 5. No GM_xmlhttpRequest: version 1's link.
    {
      const {context, page} = await setup(browser, {api: defaultApi()});
      await page.goto("https://xhamster.com/videos/some-title-123456");
      await inject(page, {gm: false});
      const href = await widget(page, ".dock a.btn-primary").getAttribute("href");
      check("without GM the button opens NSFWDL with the link filled in", href === "https://nsfwdl.com/xhamster-downloader?ref=userscript#url=" + encodeURIComponent("https://xhamster.com/videos/some-title-123456"), href);
      await context.close();
    }

    // 6. Phone width, shortcut, minimize, settings.
    {
      const {context, page} = await setup(browser, {api: defaultApi(), viewport: {width: 360, height: 740}, hasTouch: true});
      await page.goto("https://www.xvideos.com/video.abcdef123/some_title");
      await inject(page);
      await widget(page, ".dock .btn-primary").click();
      await widget(page, ".card").first().waitFor();
      const panelBox = await widget(page, ".panel").boundingBox();
      check("the panel fits a 360 px screen", panelBox && panelBox.x >= 0 && panelBox.x + panelBox.width <= 360, panelBox);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      check("no horizontal scroll on a phone", !overflow);
      await widget(page, "text=⚙ Settings").click();
      await widget(page, "select").first().selectOption("best");
      const stored = await page.evaluate(() => window.__gmStore.settings);
      check("settings are saved in the userscript manager", stored && stored.quality === "best", stored);
      await widget(page, "[aria-label=Close]").click();
      await widget(page, "[aria-label='Minimize the NSFWDL button']").click();
      check("minimize leaves a round button", await widget(page, ".pill").isVisible());
      check("the minimized state is remembered", await page.evaluate(() => window.__gmStore.collapsed === true));
      await page.keyboard.press("Alt+Shift+D");
      await page.waitForTimeout(300);
      check("Alt+Shift+D opens the downloader", await widget(page, ".panel").isVisible());
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
