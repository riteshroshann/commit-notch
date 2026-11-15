// Renders every setup pane to PNG for review: electron . --setup-shot=out/setup
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const PANES = ["start", "code", "cli", "token", "done", "error"];

/** @param {(q: Record<string, string>) => import("electron").BrowserWindow} open @param {string} out */
module.exports = async function shoot(open, out) {
  fs.mkdirSync(out, { recursive: true });
  for (const pane of PANES) {
    const win = open({ pane, mock: "1" });
    await new Promise((r) => /** @type {any} */ (win.webContents).once("did-finish-load", r));
    await new Promise((r) => setTimeout(r, 1400));
    fs.writeFileSync(path.join(out, `setup-${pane}.png`), (await win.webContents.capturePage()).toPNG());
    win.destroy();
    await new Promise((r) => setTimeout(r, 150));
  }
  app.quit();
};
