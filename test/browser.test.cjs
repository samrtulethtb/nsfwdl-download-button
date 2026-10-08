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
  window.__notes = [];
  window.GM_notification = (details) => window.__notes.push(details);
`;

const VIDEO_PAGE = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>Mock video page</main></body></html>';
const LISTING_PAGE = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
  <a id="thumb1" href="/view_video.php?viewkey=listing1" style="display:inline-block;margin:40px"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="320" height="180" alt=""></a>
  <a id="small" href="/view_video.php?viewkey=tiny" style="display:inline-block"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="40" height="40" alt=""></a>
  <div id="xv" style="position:relative;display:inline-block;margin:40px"><a href="/view_video.php?viewkey=overlay1"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="320" height="180" alt=""></a><a id="xv-overlay" href="/view_video.php?viewkey=overlay1" style="position:absolute;left:0;right:0;bottom:0;height:90px;display:block"></a></div>
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

// Several downloads: each POST /api/download gets its own id; a job stays
// "preparing" until window-side release (gate.open) and, when asked, the
// first hand-over of one id is refused for the active-download limit.
function multiApi({formats, refuseFirst} = {}) {
  let next = 0;
  const jobs = new Map();
  const gate = {open: false};
  const handler = async (route, url, calls) => {
    if (url.pathname === "/api/route") return json(route, {route: "/pornhub-downloader", source: "pornhub", mode: "validated"});
    if (url.pathname === "/api/extract") return json(route, Object.assign({}, EXTRACT, {formats: formats || EXTRACT.formats}));
    if (url.pathname === "/api/download") {
      next += 1;
      const id = ("job" + next).padEnd(24, "x");
      jobs.set(id, {refused: false, n: next});
      return json(route, {download_id: id, state: "queued", mode: "prepared_temp_artifact", download_url: `https://dl.nsfwdl.com/d/${id}`, expires_in: 3600});
    }
    const status = url.pathname.match(/^\/api\/download\/([^/]+)\/status$/);
    if (status) {
      const id = status[1];
      const job = jobs.get(id);
      if (!gate.open) return json(route, {download_id: id, state: "preparing", bytes_prepared: 1_000_000, handoff: "waiting"});
      const fetched = calls.some((c) => c === `/d/${id}`);
      if (refuseFirst && job.n === 1 && fetched && !job.refused) { job.refused = true; return json(route, {download_id: id, state: "failed", error_kind: "rate_limited_active_downloads", handoff: "waiting"}); }
      if (job.refused) return json(route, {download_id: id, state: "failed", error_kind: "rate_limited_active_downloads", handoff: "waiting"});
      return json(route, {download_id: id, state: "ready", bytes_prepared: 2_000_000, handoff: fetched ? "delivered" : "waiting"});
    }
    if (url.pathname.startsWith("/d/")) return route.fulfill({status: 200, headers: {"Content-Type": "video/mp4", "Content-Disposition": 'attachment; filename="v.mp4"'}, body: "x"});
    return route.fulfill({status: 404, body: ""});
  };
  return {handler, gate};
}

const SIX_FORMATS = [2160, 1440, 1080, 720, 480, 360].map((h) => ({format_ref: `ref-${h}`.padEnd(24, "a"), quality_label: h + "p", height: h, estimated_size_bytes: h * 10000, size_kind: "estimated", access: "free", has_video: true}));

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
      await page.hover("#xv img", {position: {x: 160, y: 30}});
      await page.waitForTimeout(100);
      await page.mouse.move(page.viewportSize().width, 0);
      const xvBox = await page.locator("#xv").boundingBox();
      await page.mouse.move(xvBox.x + 160, xvBox.y + 30);
      await page.mouse.move(xvBox.x + 160, xvBox.y + 150, {steps: 4});
      await page.waitForTimeout(400);
      check("a second link laid over the thumbnail keeps the button (XVideos/XNXX)", await thumb.isVisible());
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

    // 7. Queue: never more than 4 downloads at once; the rest wait in line.
    {
      const {handler, gate} = multiApi({formats: SIX_FORMATS});
      const {context, page, calls, errors} = await setup(browser, {api: handler});
      await page.goto("https://www.pornhub.com/view_video.php?viewkey=abc123");
      await inject(page);
      await page.evaluate(() => { document.title = "Mock video"; });
      await widget(page, ".dock .btn-primary").click();
      await widget(page, ".card").first().waitFor();
      for (const card of await widget(page, ".card").all()) await card.click();
      await page.waitForTimeout(1500);
      const starts = calls.filter((c) => c === "/api/download").length;
      check("only 4 of 6 downloads start at once", starts === 4, starts);
      const waiting = await widget(page, ".job .line").allTextContents();
      check("the others say they wait their turn", waiting.filter((t) => /Waiting its turn/.test(t)).length === 2, waiting);
      check("the tab title shows the downloads running", (await page.title()) === "⬇ 6 running · Mock video", await page.title());
      await page.evaluate(() => Object.defineProperty(document, "hidden", {configurable: true, get: () => true}));
      gate.open = true;
      await page.waitForFunction(() => [...document.querySelector("#nsfwdl-download-widget").shadowRoot.querySelectorAll(".job .line")].filter((l) => /Saved/.test(l.textContent)).length === 6, null, {timeout: 30000})
        .then(() => check("all six finish, the waiting ones once a slot frees up", true), () => check("all six finish, the waiting ones once a slot frees up", false));
      check("each was started exactly once", calls.filter((c) => c === "/api/download").length === 6);
      check("the title is restored when nothing runs", (await page.title()) === "Mock video", await page.title());
      const notes = await page.evaluate(() => window.__notes.map((n) => n.text));
      check("a background tab gets a notification per saved file", notes.filter((t) => t.startsWith("Saved: ")).length === 6, notes);
      const history = await page.evaluate(() => Object.keys(window.__gmStore.history || {}));
      check("the saved video is remembered by its viewkey", JSON.stringify(history) === JSON.stringify(["pornhub:abc123"]), history);
      check("no page errors with the queue", errors.length === 0, errors);
      await context.close();
    }

    // 8. The active-download limit refuses a hand-over: retried, not failed.
    {
      const {handler, gate} = multiApi({refuseFirst: true});
      gate.open = true;
      const {context, page, calls} = await setup(browser, {api: handler});
      await page.goto("https://www.pornhub.com/view_video.php?viewkey=abc123");
      await inject(page);
      await widget(page, ".dock .btn-primary").click();
      await widget(page, ".card").filter({hasText: "720p"}).click();
      await page.waitForFunction(() => /Waiting its turn/.test(document.querySelector("#nsfwdl-download-widget").shadowRoot.querySelector(".job .line").textContent), null, {timeout: 8000})
        .then(() => check("a refused hand-over goes back in line", true), () => check("a refused hand-over goes back in line", false));
      await page.waitForFunction(() => /Saved/.test(document.querySelector("#nsfwdl-download-widget").shadowRoot.querySelector(".job .line").textContent), null, {timeout: 20000})
        .then(() => check("and finishes on the next try", true), () => check("and finishes on the next try", false));
      check("it was started again once", calls.filter((c) => c === "/api/download").length === 2);
      check("one row, not a failed one plus a new one", await widget(page, ".job").count() === 1);
      await context.close();
    }

    // 9. Downloaded marks: thumbnail outline, hover label, dock, clearing.
    {
      const store = {history: {"pornhub:listing1": 20000, "pornhub:abc123": 20000}};
      const {context, page, errors} = await setup(browser, {api: defaultApi(), pageHtml: LISTING_PAGE});
      await page.goto("https://www.pornhub.com/video");
      await inject(page, {store});
      await page.waitForTimeout(700);
      check("a downloaded video's thumbnail is marked", await page.locator("#thumb1 img[data-nsfwdl-saved]").count() === 1);
      check("other thumbnails are not", await page.locator("#xv img[data-nsfwdl-saved]").count() === 0);
      const outline = await page.locator("#thumb1 img").evaluate((img) => getComputedStyle(img).outlineStyle);
      check("the mark is an outline (no layout change)", outline === "solid", outline);
      await page.hover("#thumb1 img");
      await page.waitForTimeout(100);
      check("the hover button says it was downloaded", (await page.locator("#nsfwdl-thumb-button button").textContent()).includes("Again"));
      await page.evaluate(() => { const a = document.createElement("a"); a.id = "late"; a.href = "/view_video.php?viewkey=listing1"; a.innerHTML = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="320" height="180">'; document.body.append(a); });
      await page.waitForTimeout(1800);
      check("thumbnails loaded later are marked too", await page.locator("#late img[data-nsfwdl-saved]").count() === 1);
      check("no page errors with marks", errors.length === 0, errors);
      await context.close();

      const video = await setup(browser, {api: defaultApi()});
      await video.page.goto("https://www.pornhub.com/view_video.php?viewkey=abc123");
      await inject(video.page, {store});
      check("the dock says the video was downloaded before", (await widget(video.page, ".brand small").textContent()).includes("Downloaded"));
      await widget(video.page, ".dock .btn-primary").click();
      await widget(video.page, "text=⚙ Settings").click();
      await widget(video.page, "text=Clear the list").click();
      check("clearing empties the stored list", await video.page.evaluate(() => Object.keys(window.__gmStore.history).length === 0));
      check("and the dock forgets it", !(await widget(video.page, ".brand small").textContent()).includes("Downloaded"));
      await video.context.close();
    }

    // 10. An xHamster mirror's video page gets the button.
    {
      const {context, page, bodies} = await setup(browser, {api: defaultApi()});
      await page.goto("https://xhspot.com/videos/some-title-9357877");
      await inject(page);
      check("a mirror video page gets the button", await widget(page, ".dock").isVisible());
      check("the dock names xHamster", (await widget(page, ".brand small").textContent()) === "xHamster");
      await widget(page, ".dock .btn-primary").click();
      await widget(page, ".card").first().waitFor();
      check("the mirror link is sent as is (NSFWDL rewrites it)", bodies.some((b) => b.url === "https://xhspot.com/videos/some-title-9357877"), bodies);
      await context.close();
    }

    // 11. Supporter key: entered in Settings, exchanged for a session token
    // that unlocks the large formats and travels in its own header.
    {
      const TOKEN = "session-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const KEY = "NSFW-DLAB-CD12-EF34";
      const EXPIRES = Math.floor(Date.now() / 1000) + 15 * 86400;
      const seen = [];
      const base = defaultApi();
      const api = async (route, url, calls) => {
        const header = route.request().headers()["x-nsfwdl-supporter"] || "";
        seen.push({path: url.pathname, header});
        if (url.pathname === "/api/supporter/activate") {
          const body = JSON.parse(route.request().postData());
          if (body.key !== KEY) return json(route, {error_kind: "supporter_key_invalid", message: "This supporter key is invalid.", transient: false}, 401);
          return json(route, {tier: "supporter", expires_at: EXPIRES, session_token: body.client === "userscript" ? TOKEN : undefined});
        }
        if (url.pathname === "/api/supporter/status") {
          if (header === TOKEN) return json(route, {tier: "supporter", expires_at: EXPIRES});
          if (header) return json(route, {error_kind: "supporter_session_expired", message: "This supporter session has expired.", transient: false}, 401);
          return json(route, {tier: "free", expires_at: null});
        }
        if (url.pathname === "/api/supporter/logout") return json(route, {tier: "free", expires_at: null});
        return base(route, url, calls);
      };
      const {context, page, bodies, errors} = await setup(browser, {api});
      await page.goto("https://www.pornhub.com/view_video.php?viewkey=abc123");
      await inject(page);
      await widget(page, ".dock .btn-primary").click();
      await widget(page, ".card").first().waitFor();
      check("free: the 4K format is locked", await widget(page, ".card.locked").count() === 1);
      check("free: no session check without a stored token", !seen.some((c) => c.path === "/api/supporter/status"));
      await widget(page, "text=Enter it in Settings").click();
      await widget(page, ".keyform input").fill("NSFW-DLZZ-ZZZZ-ZZZZ");
      await widget(page, ".keyform button").click();
      await widget(page, "text=This supporter key is invalid.").waitFor({timeout: 5000});
      check("a wrong key shows the server's message", true);
      check("a wrong key stores nothing", await page.evaluate(() => !window.__gmStore.supporter));
      await widget(page, ".keyform input").fill(KEY);
      await widget(page, ".keyform button").click();
      await widget(page, "text=Supporter active until").waitFor({timeout: 5000});
      check("activation asks for a userscript session", bodies.some((b) => b.key === KEY && b.client === "userscript"));
      const stored = await page.evaluate(() => window.__gmStore.supporter);
      check("only the session token is stored, never the key", stored && stored.token === TOKEN && !JSON.stringify(stored).includes(KEY), stored);
      await widget(page, "text=⚙ Settings").click();
      check("the 4K format is unlocked", await widget(page, ".card.locked").count() === 0);
      await widget(page, ".card", {hasText: "2160p"}).first().click();
      await page.waitForTimeout(400);
      check("the 4K download carries the session header", seen.some((c) => c.path === "/api/download" && c.header === TOKEN), seen.filter((c) => c.path === "/api/download"));
      const afterActivation = seen.slice(seen.findLastIndex((c) => c.path === "/api/supporter/activate") + 1).filter((c) => c.path.startsWith("/api/"));
      check("every API call after activation carries it", afterActivation.length > 0 && afterActivation.every((c) => c.header === TOKEN), afterActivation);
      await widget(page, "text=⚙ Settings").click();
      await widget(page, "text=Remove from this browser").click();
      await widget(page, ".keyform input").waitFor({timeout: 5000});
      check("removing logs the session out on nsfwdl.com", seen.some((c) => c.path === "/api/supporter/logout" && c.header === TOKEN));
      check("and forgets it locally", await page.evaluate(() => !window.__gmStore.supporter));
      check("no page errors in the Supporter flow", errors.length === 0, errors);
      await context.close();

      // A stored session the server no longer accepts is dropped before the formats load.
      const stale = await setup(browser, {api});
      await stale.page.goto("https://www.pornhub.com/view_video.php?viewkey=abc123");
      await inject(stale.page, {store: {supporter: {token: "revoked-token", expiresAt: EXPIRES}}});
      await widget(stale.page, ".dock .btn-primary").click();
      await widget(stale.page, ".card").first().waitFor();
      check("a revoked session is dropped", await stale.page.evaluate(() => !window.__gmStore.supporter));
      check("and the 4K format stays locked", await widget(stale.page, ".card.locked").count() === 1);
      await stale.context.close();

      // A stored session that is still valid unlocks straight away.
      const kept = await setup(browser, {api});
      await kept.page.goto("https://www.pornhub.com/view_video.php?viewkey=abc123");
      await inject(kept.page, {store: {supporter: {token: TOKEN, expiresAt: EXPIRES}}});
      await widget(kept.page, ".dock .btn-primary").click();
      await widget(kept.page, ".card").first().waitFor();
      check("a stored valid session unlocks the 4K format", await widget(kept.page, ".card.locked").count() === 0);
      await kept.context.close();
    }

    // 12. RedGifs feed: one URL while clips scroll by; the active clip decides.
    {
      const FEED_PAGE = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="previewFeed">
        <div class="GifPreview GifPreview_isActive GifPreview_isVideo" data-feed-item-id="firstclipone"><video muted></video></div>
        <div class="GifPreview GifPreview_isVideo" data-feed-item-id="secondcliptwo"></div>
        <div class="GifPreview" data-feed-item-id="aphotothree"></div>
      </div></body></html>`;
      const activate = (page, id) => page.evaluate((id) => {
        document.querySelectorAll(".GifPreview").forEach((g) => g.classList.toggle("GifPreview_isActive", g.dataset.feedItemId === id));
        const active = document.querySelector(".GifPreview_isActive");
        if (active.classList.contains("GifPreview_isVideo")) active.append(document.querySelector("video"));
        else document.querySelector("video").remove();
      }, id);
      const {context, page, bodies, errors} = await setup(browser, {api: defaultApi(), pageHtml: FEED_PAGE});
      await page.goto("https://www.redgifs.com/");
      await inject(page);
      check("RedGifs feed: the dock shows on the home feed", await widget(page, ".dock").isVisible());
      await activate(page, "secondcliptwo");
      await widget(page, ".dock .btn-primary").click();
      await widget(page, ".card").first().waitFor();
      const extracted = bodies.filter((b) => b.url && b.mode).map((b) => b.url);
      check("RedGifs feed: the clip on screen is the one sent", extracted[extracted.length - 1] === "https://www.redgifs.com/watch/secondcliptwo", extracted);
      await activate(page, "firstclipone");
      await widget(page, "text=Show the clip on screen now").waitFor({timeout: 3000});
      check("RedGifs feed: the open panel says the clip changed", true);
      await widget(page, "text=Show the clip on screen now").click();
      await widget(page, ".card").first().waitFor();
      const again = bodies.filter((b) => b.url && b.mode).map((b) => b.url);
      check("RedGifs feed: and loads the new clip on request", again[again.length - 1] === "https://www.redgifs.com/watch/firstclipone", again);
      await widget(page, ".btn-icon[aria-label=Close]").click();
      await activate(page, "aphotothree");
      await page.waitForTimeout(1300);
      check("RedGifs feed: no button while a photo is on screen", !(await page.locator("#nsfwdl-download-widget").isVisible().catch(() => false)));
      check("RedGifs feed: no page errors", errors.length === 0, errors);
      await context.close();

      const watch = await setup(browser, {api: defaultApi(), pageHtml: FEED_PAGE});
      await watch.page.goto("https://www.redgifs.com/watch/firstclipone");
      await inject(watch.page);
      await activate(watch.page, "secondcliptwo");
      await watch.page.waitForTimeout(1200);
      await widget(watch.page, ".dock .btn-primary").click();
      await widget(watch.page, ".card").first().waitFor();
      const sent = watch.bodies.filter((b) => b.url && b.mode).map((b) => b.url);
      check("RedGifs /watch/ page scrolled down: the clip on screen, not the URL's", sent[sent.length - 1] === "https://www.redgifs.com/watch/secondcliptwo", sent);
      await watch.context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
