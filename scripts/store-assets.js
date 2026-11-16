// Renders the Microsoft Store tiles (build/appx/) and listing screenshots (store/) with Electron.
// Run: just store-assets
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const tiles = path.join(root, "build", "appx");
const shots = path.join(root, "store");

// the favicon's grid of squares, without its rounded black plate: the tile itself is black
const svg = fs.readFileSync(path.join(root, "docs", "favicon.svg"), "utf8");
const grid = svg
  .replace(/<rect width="64" height="64"[^>]*\/>/, "")
  .replace('viewBox="0 0 64 64"', 'viewBox="10 10 44 44"');
const gridUri = `data:image/svg+xml;base64,${Buffer.from(grid).toString("base64")}`;

/** A tile: black, grid centred, `share` of the shorter side. */
const tile = (/** @type {number} */ w, /** @type {number} */ h, /** @type {number} */ share) => {
  const s = Math.round(Math.min(w, h) * share);
  return `<!doctype html><body style="margin:0;width:${w}px;height:${h}px;background:#000;display:grid;place-items:center">
<img src="${gridUri}" width="${s}" height="${s}">`;
};

// base size of every tile the manifest names; written at three scales for crisp Start menus
const TILES = [
  ["StoreLogo", 50, 50, 0.72],
  ["Square44x44Logo", 44, 44, 0.78],
  ["Square150x150Logo", 150, 150, 0.46],
  ["Wide310x150Logo", 310, 150, 0.46],
];
const SCALES = [100, 200, 400];

/** @param {string} url @param {number} w @param {number} h @param {(win: BrowserWindow) => Promise<void>} [prepare] */
async function capture(url, w, h, prepare) {
  const win = new BrowserWindow({
    width: w,
    height: h,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: true, zoomFactor: 1 },
  });
  await win.loadURL(url).catch(() => {});
  if (prepare) await prepare(win);
  await new Promise((r) => setTimeout(r, 500));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
  win.destroy();
  return img.resize({ width: w, height: h, quality: "best" }).toPNG();
}

const html = (/** @type {string} */ doc) => `data:text/html;charset=utf-8,${encodeURIComponent(doc)}`;
const wait = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

// the demo page runs the real islands on sample data; open one island and photograph the desktop
const SCREENS = [
  ["1-contributions", "gh", 0, "Your GitHub year, hanging from the top of your screen."],
  ["2-repositories", "gh", 2, "Private repositories count too. Arrow keys turn the page."],
  ["3-world-clock", "clk", 0, "An atomic clock for the cities you work with."],
];

/** Caption across the empty sky below the islands, in the site's type. @param {string} text */
const caption = (text) => `(() => {
  const c = document.createElement("div");
  c.textContent = ${JSON.stringify(text)};
  c.style.cssText = "position:fixed;left:0;right:0;bottom:22%;text-align:center;color:#fff;font:600 38px/1.2 'Segoe UI Variable Display','Segoe UI',sans-serif;letter-spacing:-.03em;text-shadow:0 2px 24px rgba(0,40,90,.25)";
  document.body.append(c);
})()`;

async function screenshot(/** @type {string} */ island, /** @type {number} */ page, /** @type {string} */ text) {
  const demo = `file:///${path.join(root, "docs", "demo", "index.html").replaceAll("\\", "/")}`;
  return capture(demo, 1920, 1080, async (win) => {
    await win.webContents.insertCSS(
      "html,body{background:linear-gradient(160deg,#3d7fc4 0%,#6aa6dd 45%,#a9cdef 100%) !important}",
    );
    win.webContents.setZoomFactor(1.5);
    await win.webContents.executeJavaScript(caption(text));
    await wait(3000); // the profile photo comes from GitHub
    await win.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(island)}).click()`);
    await wait(900);
    for (let i = 0; i < page; i++) {
      await win.webContents.executeJavaScript(
        "document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))",
      );
      await wait(500);
    }
    await wait(800);
  });
}

app.on("window-all-closed", () => {}); // keep running between captures
app.whenReady().then(async () => {
  fs.mkdirSync(tiles, { recursive: true });
  fs.mkdirSync(shots, { recursive: true });
  for (const [name, w, h, share] of TILES) {
    for (const scale of SCALES) {
      const f = scale / 100;
      const png = await capture(html(tile(+w * f, +h * f, +share)), +w * f, +h * f);
      fs.writeFileSync(path.join(tiles, `${name}.scale-${scale}.png`), png);
    }
  }
  for (const [name, island, page, text] of SCREENS) {
    const png = await screenshot(String(island), Number(page), String(text));
    fs.writeFileSync(path.join(shots, `${name}.png`), png);
  }
  console.log("store tiles and screenshots written");
  app.quit();
});
