// Renders docs/og.png and the PNG favicons with Electron. Run: just assets
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const docs = path.join(__dirname, "..", "docs");
const svg = fs.readFileSync(path.join(docs, "favicon.svg"), "utf8");
const cells = Array.from({ length: 53 * 7 }, (_, i) => {
  const v = Math.sin(i / 37) + ((i * 7919) % 13) / 8;
  const c = v < 0.8 ? "#121214" : v < 1.2 ? "#0f3f53" : v < 1.5 ? "#145a74" : v < 1.8 ? "#2b8fb4" : "#4fc3e8";
  return `<i style="background:${c}"></i>`;
}).join("");

const og = `<!doctype html><html><body style="margin:0;width:1200px;height:630px;background:#000;color:#f5f5f7;
font-family:'Segoe UI Variable Display','Segoe UI',sans-serif;overflow:hidden;position:relative">
<div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:760px;padding:30px 34px 28px;background:#000;
border-radius:0 0 34px 34px;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 30px 80px rgba(79,195,232,.12)">
<div style="display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,10.6px);grid-auto-columns:10.6px;gap:2.6px">${cells.replaceAll("<i ", '<i style="border-radius:2.5px" ').replaceAll('" style="', ";")}</div></div>
<div style="position:absolute;left:0;right:0;bottom:92px;text-align:center">
<div style="font-size:68px;font-weight:650;letter-spacing:-.045em">Commit Notch</div>
<div style="font-size:27px;color:#98989f;margin-top:10px">Your GitHub year, hanging from the top of your screen.</div></div></body></html>`;

async function shoot(html, w, h, file) {
  const win = new BrowserWindow({
    width: Math.max(w, 240),
    height: Math.max(h, 240),
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
  fs.writeFileSync(path.join(docs, file), img.resize({ width: w, height: h }).toPNG());
  win.destroy();
}

const icon = (s) =>
  `<!doctype html><body style="margin:0;background:#000"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${s}" height="${s}" style="display:block">`;

app.on("window-all-closed", () => {}); // keep running between captures
app.whenReady().then(async () => {
  await shoot(og, 1200, 630, "og.png");
  await shoot(icon(32), 32, 32, "favicon-32.png");
  await shoot(icon(180), 180, 180, "apple-touch-icon.png");
  console.log("docs assets written");
  app.quit();
});
