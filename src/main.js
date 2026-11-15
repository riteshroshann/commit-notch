const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, safeStorage, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { ghCliToken, fetchContributions } = require("./github.js");
const ntp = require("./ntp.js");

const WIDTH = 1240;
const HEIGHT = 380;
const REFRESH_MS = 15 * 60 * 1000;
const RESYNC_MS = 10 * 60 * 1000;

const shotPath = process.argv.find((a) => a.startsWith("--shot="))?.slice(7);
if (!shotPath && !app.requestSingleInstanceLock()) app.quit();

const store = (name) => path.join(app.getPath("userData"), name);

/** @returns {{ sound: boolean, cities: string[][] }} */
function loadSettings() {
  const defaults = {
    sound: true,
    cities: [
      ["San Francisco", "America/Los_Angeles"],
      ["New York", "America/New_York"],
      ["London", "Europe/London"],
      ["Tokyo", "Asia/Tokyo"],
    ],
  };
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(store("settings.json"), "utf8")) };
  } catch {
    return defaults;
  }
}
const settings = loadSettings();
const saveSettings = () => fs.writeFileSync(store("settings.json"), JSON.stringify(settings, null, 2));

function savedToken() {
  try {
    return safeStorage.decryptString(fs.readFileSync(store("token.bin")));
  } catch {
    return null;
  }
}

/** @type {BrowserWindow} */
let win;
/** @type {Tray} */
let tray;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: Math.round(workArea.x + (workArea.width - WIDTH) / 2),
    y: workArea.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, "pop-up-menu");
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "renderer", "index.html"), {
    query: shotPath ? { shot: process.argv.find((a) => a.startsWith("--open="))?.slice(7) ?? "gh" } : {},
  });
  win.once("ready-to-show", () => win.showInactive());
  win.on("blur", () => win.webContents.send("collapse"));
  if (shotPath) {
    win.webContents.once("did-finish-load", () =>
      setTimeout(async () => {
        fs.writeFileSync(shotPath, (await win.webContents.capturePage()).toPNG());
        app.quit();
      }, 2500),
    );
  }
}

async function loadContributions() {
  const token = (await ghCliToken()) || savedToken();
  if (!token) return { error: "signin" };
  try {
    return { data: await fetchContributions(token) };
  } catch (e) {
    const err = /** @type {Error & { auth?: boolean }} */ (e);
    return { error: err.auth ? "signin" : err.message };
  }
}

async function pushContributions() {
  win?.webContents.send("contributions", await loadContributions());
}

async function pushTime() {
  try {
    win?.webContents.send("time", await ntp.sync());
  } catch (e) {
    win?.webContents.send("time", { error: /** @type {Error} */ (e).message });
  }
}

function trayIcon() {
  const img = nativeImage.createFromPath(path.join(__dirname, "..", "build", "icon.png"));
  return img.isEmpty() ? img : img.resize({ width: 16, height: 16 });
}

function buildTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip("Commit Notch");
  const render = () =>
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Refresh now", click: pushContributions },
        {
          label: "Sounds",
          type: "checkbox",
          checked: settings.sound,
          click: (i) => {
            settings.sound = i.checked;
            saveSettings();
            win.webContents.send("settings", settings);
          },
        },
        {
          label: "Open at login",
          type: "checkbox",
          checked: app.getLoginItemSettings().openAtLogin,
          click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }),
        },
        { type: "separator" },
        {
          label: "Sign out of GitHub",
          click: () => {
            fs.rmSync(store("token.bin"), { force: true });
            pushContributions();
          },
        },
        { label: "Quit", role: "quit" },
      ]),
    );
  render();
}

ipcMain.on("hover", (_e, inside) => {
  win.setIgnoreMouseEvents(!inside, { forward: true });
  if (inside) win.focus();
});
ipcMain.handle("init", () => settings);
ipcMain.handle("save-token", async (_e, token) => {
  const trimmed = String(token).trim();
  try {
    await fetchContributions(trimmed);
  } catch (e) {
    return { error: /** @type {Error} */ (e).message };
  }
  fs.writeFileSync(store("token.bin"), safeStorage.encryptString(trimmed));
  pushContributions();
  return { ok: true };
});
ipcMain.on("refresh", pushContributions);

app.on("second-instance", () => win?.webContents.send("open", "gh"));
app.whenReady().then(() => {
  if (!shotPath && !app.getLoginItemSettings().openAtLogin && !fs.existsSync(store("settings.json"))) {
    app.setLoginItemSettings({ openAtLogin: true });
    saveSettings();
  }
  createWindow();
  if (!shotPath) buildTray();
  win.webContents.once("did-finish-load", () => {
    pushContributions();
    pushTime();
  });
  setInterval(pushContributions, REFRESH_MS);
  setInterval(pushTime, RESYNC_MS);
  screen.on("display-metrics-changed", () => {
    const { workArea } = screen.getPrimaryDisplay();
    win.setPosition(Math.round(workArea.x + (workArea.width - WIDTH) / 2), workArea.y);
  });
});
