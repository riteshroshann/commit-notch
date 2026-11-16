const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, safeStorage, screen, shell } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ghCliToken, fetchContributions } = require("./github.js");
const { requestCode, waitForToken } = require("./auth.js");
const ntp = require("./ntp.js");
const updater = require("./updater.js");
const pkg = require("../package.json");

const WIDTH = 1240;
const HEIGHT = 380;
const REFRESH_MS = 15 * 60 * 1000;
const RESYNC_MS = 10 * 60 * 1000;
const SITE = "https://riteshroshann.github.io/commit-notch/";
const CLIENT_ID = process.env.COMMIT_NOTCH_CLIENT_ID || pkg.githubClientId || "";

const arg = (/** @type {string} */ name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const shotPath = arg("shot");
const e2eOut = arg("e2e");
const setupShots = arg("setup-shot");
const rendererDir = arg("renderer") ?? path.join(__dirname, "renderer");
const tooling = Boolean(shotPath || e2eOut || setupShots);
if (!tooling && !app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// tests point the app at a throwaway profile
if (arg("profile")) app.setPath("userData", /** @type {string} */ (arg("profile")));
const store = (/** @type {string} */ name) => path.join(app.getPath("userData"), name);

/** @returns {{ sound: boolean, useGhCli: boolean, cities: string[][], version?: string }} */
function loadSettings() {
  const defaults = {
    sound: true,
    useGhCli: true,
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
const firstRun = !fs.existsSync(path.join(app.getPath("userData"), "settings.json"));
const settings = loadSettings();
const saveSettings = () => fs.writeFileSync(store("settings.json"), JSON.stringify(settings, null, 2));

/** Settings remember the version that last ran, so an upgrade can repair what an older one broke. */
function migrate() {
  // 1.3.0 and older removed start at login while updating; setup has it on by default, so restore it once
  if (app.isPackaged && !firstRun && !settings.version) app.setLoginItemSettings({ openAtLogin: true });
  if (settings.version === pkg.version) return;
  settings.version = pkg.version;
  saveSettings();
}

// ---------- log ----------
// One small file in the profile folder, so a crash becomes a line someone can send instead of a dialog.

const LOG_MAX = 512 * 1024;

/** @param {"info" | "warn" | "error"} level @param {...unknown} parts */
function log(level, ...parts) {
  try {
    const file = store("main.log");
    if (fs.existsSync(file) && fs.statSync(file).size > LOG_MAX) fs.renameSync(file, store("main.old.log"));
    const text = parts.map((p) => (p instanceof Error ? (p.stack ?? p.message) : String(p))).join(" ");
    fs.appendFileSync(file, `${new Date().toISOString()} ${level} ${text}\n`);
  } catch {
    // logging must never be the thing that breaks the app
  }
}
if (!tooling) {
  process.on("uncaughtException", (e) => log("error", "uncaught", e));
  process.on("unhandledRejection", (e) => log("error", "unhandled rejection", e));
}

// ---------- who is signed in ----------
// `epoch` changes on every sign in and sign out; work that started under an older epoch is dropped.

/** @type {string | null} */
let token = null;
let epoch = 0;
const keyOf = (/** @type {string} */ t) => crypto.createHash("sha256").update(t).digest("hex").slice(0, 16);

function savedToken() {
  try {
    return safeStorage.decryptString(fs.readFileSync(store("token.bin")));
  } catch {
    return null;
  }
}

/** Saved sign in first, then the GitHub CLI unless the person signed out of this app. */
async function resolveToken() {
  if (token) return token;
  const started = epoch;
  const found = savedToken() || (settings.useGhCli ? await ghCliToken() : null);
  if (started !== epoch) return token;
  token = found;
  return token;
}

/** The last good data, but only if it belongs to the account signed in now. */
function cachedContributions() {
  try {
    const c = JSON.parse(fs.readFileSync(store("cache.json"), "utf8"));
    return token && c.key === keyOf(token) ? c.data : null;
  } catch {
    return null;
  }
}

/** @param {string} t @param {any} data */
function writeCache(t, data) {
  fs.writeFile(store("cache.json"), JSON.stringify({ key: keyOf(t), data }), () => {});
}

function signOut() {
  signIn?.abort();
  epoch++;
  token = null;
  for (const f of ["token.bin", "cache.json"]) fs.rmSync(store(f), { force: true });
  settings.useGhCli = false;
  saveSettings();
  send("contributions", { error: "signin" });
}

// ---------- data ----------

/** @returns {Promise<{ data?: any, error?: string, stale?: boolean }>} */
async function loadContributions() {
  const started = epoch;
  const t = await resolveToken();
  if (started !== epoch) return { stale: true };
  if (!t) return { error: "signin" };
  try {
    const data = await fetchContributions(t);
    if (started !== epoch) return { stale: true };
    writeCache(t, data);
    return { data };
  } catch (e) {
    if (started !== epoch) return { stale: true };
    const err = /** @type {Error & { auth?: boolean }} */ (e);
    if (err.auth) {
      // the token was revoked: forget it and everything fetched with it
      epoch++;
      token = null;
      for (const f of ["token.bin", "cache.json"]) fs.rmSync(store(f), { force: true });
      return { error: "signin" };
    }
    return { error: err.message };
  }
}

async function pushContributions() {
  const res = await loadContributions();
  if (!res.stale) send("contributions", res);
  return res;
}

async function pushTime() {
  try {
    send("time", await ntp.sync());
  } catch (e) {
    send("time", { error: /** @type {Error} */ (e).message });
  }
}

/** Keep every window on its own page; links go to the browser, and only to places we trust. */
function lockDown(/** @type {BrowserWindow} */ w) {
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (safeUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  w.webContents.on("will-navigate", (e) => e.preventDefault());
}

/** Only GitHub and our own site ever open from the app. @param {string} url */
function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ["github.com", "riteshroshann.github.io"].includes(u.hostname);
  } catch {
    return false;
  }
}

// ---------- the islands window ----------

/** @type {BrowserWindow | null} */
let win = null;
/** @type {Tray} */
let tray;
let quitting = false;
app.on("before-quit", () => {
  quitting = true;
});

/** @param {BrowserWindow | null} w @returns {w is BrowserWindow} */
const alive = (w) => w !== null && !w.isDestroyed();

/** Talk to the islands; a window that's gone (quitting, closed) is skipped, never thrown on. */
function send(/** @type {string} */ channel, /** @type {any} */ value) {
  if (alive(win)) win.webContents.send(channel, value);
}

/** Open the contributions island, bringing the window back first if something closed it. */
function showIslands() {
  if (alive(win)) return send("open", "gh");
  createWindow().webContents.once("did-finish-load", () => {
    pushContributions();
    pushTime();
    setTimeout(() => send("open", "gh"), 450);
  });
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const w = new BrowserWindow({
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
  win = w;
  lockDown(w);
  w.setAlwaysOnTop(true, "pop-up-menu");
  w.setIgnoreMouseEvents(true, { forward: true });
  // Alt+F4 on a focused island used to destroy the window while the app lived on in the tray
  w.on("close", (e) => {
    if (!quitting && !tooling) e.preventDefault();
  });
  w.on("session-end", () => {
    quitting = true;
  });
  w.on("closed", () => {
    if (win === w) win = null;
  });
  w.webContents.on("render-process-gone", (_e, details) => {
    log("error", "renderer gone", details.reason);
    if (!quitting && details.reason !== "clean-exit") setTimeout(() => alive(w) && w.reload(), 1000);
  });
  w.loadFile(path.join(rendererDir, "index.html"), {
    query: shotPath ? { shot: arg("open") ?? "gh", page: arg("page") ?? "0" } : {},
  });
  w.once("ready-to-show", () => w.showInactive());
  if (e2eOut) {
    // real mouse passes through; the suite drives the page with synthetic events only
    w.webContents.once("did-finish-load", async () => {
      const failed = await require("../test/e2e.js")(w, e2eOut);
      app.exit(failed ? 1 : 0);
    });
  }
  w.on("blur", () => !tooling && send("collapse"));
  if (shotPath) {
    w.webContents.once("did-finish-load", () =>
      setTimeout(async () => {
        fs.writeFileSync(shotPath, (await w.webContents.capturePage()).toPNG());
        app.quit();
      }, 2500),
    );
  }
  return w;
}

// ---------- the setup window ----------

/** @type {BrowserWindow | null} */
let setup = null;
/** @type {AbortController | null} */
let signIn = null;

function openSetup(/** @type {Record<string, string>} */ query = {}) {
  if (setup && !setup.isDestroyed()) {
    setup.focus();
    return setup;
  }
  setup = new BrowserWindow({
    width: 940,
    height: 600,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    center: true,
    backgroundColor: "#f4f5f7",
    title: "Commit Notch",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "setup", "preload.js") },
  });
  lockDown(setup);
  setup.loadFile(path.join(__dirname, "setup", "index.html"), { query });
  setup.once("ready-to-show", () => setup?.show());
  setup.on("closed", () => {
    signIn?.abort();
    signIn = null;
    setup = null;
  });
  return setup;
}

const tell = (/** @type {string} */ channel, /** @type {any} */ value) => {
  if (setup && !setup.isDestroyed()) setup.webContents.send(channel, value);
};

/**
 * Verify a token before it replaces anything, then make it the signed-in account.
 * @param {string} t @param {AbortSignal} [signal]
 * @returns {Promise<{ ok?: boolean, error?: string }>}
 */
async function finishSignIn(t, signal) {
  if (!safeStorage.isEncryptionAvailable()) return { error: "Windows can't encrypt your login on this PC right now." };
  let data;
  try {
    data = await fetchContributions(t);
  } catch (e) {
    const err = /** @type {Error & { auth?: boolean }} */ (e);
    return { error: err.auth ? "GitHub didn't accept that sign in." : "Can't reach GitHub right now." };
  }
  if (signal?.aborted) return { error: "cancelled" };
  fs.writeFileSync(store("token.bin"), safeStorage.encryptString(t));
  settings.useGhCli = true;
  saveSettings();
  epoch++;
  token = t;
  writeCache(t, data);
  send("contributions", { data });
  tell("setup:done", { name: data.name, login: data.login, avatar: data.avatar });
  return { ok: true };
}

ipcMain.handle("setup:info", () => ({
  version: pkg.version,
  deviceFlow: Boolean(CLIENT_ID),
  openAtLogin: app.getLoginItemSettings().openAtLogin,
  firstRun,
}));

ipcMain.on("setup:start", async () => {
  signIn?.abort();
  const ctl = new AbortController();
  signIn = ctl;
  try {
    const grant = await requestCode(CLIENT_ID, { signal: ctl.signal });
    if (ctl.signal.aborted) return;
    if (!safeUrl(grant.verificationUri)) throw new Error("GitHub sent an unexpected address");
    tell("setup:code", {
      userCode: grant.userCode,
      verificationUri: grant.verificationUri,
      expiresIn: grant.expiresIn,
    });
    shell.openExternal(grant.verificationUri);
    const t = await waitForToken(CLIENT_ID, grant, { signal: ctl.signal });
    if (ctl.signal.aborted) return;
    const res = await finishSignIn(t, ctl.signal);
    if (res.error && res.error !== "cancelled") tell("setup:error", { code: "error", message: res.error });
  } catch (e) {
    const err = /** @type {Error & { code?: string, name?: string }} */ (e);
    if (err.code === "cancelled" || ctl.signal.aborted) return;
    const offline = err.name === "TimeoutError" || err.name === "TypeError";
    tell("setup:error", { code: err.code ?? (offline ? "offline" : "error"), message: err.message });
  } finally {
    if (signIn === ctl) signIn = null;
  }
});

ipcMain.on("setup:cancel", () => {
  signIn?.abort();
  signIn = null;
});

ipcMain.handle("setup:token", async (_e, raw) => {
  signIn?.abort();
  const t = String(raw ?? "").trim();
  if (!t) return { error: "Paste a token first." };
  try {
    const res = await finishSignIn(t);
    return res.error === "GitHub didn't accept that sign in."
      ? { error: "GitHub didn't accept that token. Check it has the repo and read:user scopes." }
      : res;
  } catch {
    return { error: "Something stopped the sign in. Try again." };
  }
});

ipcMain.handle("setup:cli", async () => {
  signIn?.abort();
  try {
    const t = await ghCliToken();
    if (!t) return { error: "No GitHub CLI sign in found yet. Run the command above, then check again." };
    return await finishSignIn(t);
  } catch {
    return { error: "Something stopped the sign in. Try again." };
  }
});

ipcMain.on("setup:open", (_e, url) => safeUrl(url) && shell.openExternal(url));
ipcMain.on("setup:finish", (_e, openAtLogin) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(openAtLogin) });
  setup?.close();
  setTimeout(() => send("open", "gh"), 450);
});
ipcMain.on("setup:close", () => setup?.close());

// ---------- menu and tray ----------

function trayIcon() {
  const img = nativeImage.createFromPath(path.join(__dirname, "..", "build", "icon.png"));
  return img.isEmpty() ? img : img.resize({ width: 16, height: 16 });
}

/** Same menu for the tray and a right-click on any island; rebuilt so it's always current. */
function appMenu() {
  const signedIn = Boolean(token);
  return Menu.buildFromTemplate([
    signedIn
      ? { label: "Refresh now", click: pushContributions }
      : { label: "Connect GitHub…", click: () => openSetup() },
    { type: "separator" },
    {
      label: "Sounds",
      type: "checkbox",
      checked: settings.sound,
      click: (i) => {
        settings.sound = i.checked;
        saveSettings();
        send("settings", settings);
      },
    },
    {
      label: "Open at login",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }),
    },
    updater.menuItem(),
    { type: "separator" },
    ...(signedIn ? [{ label: "Sign out of GitHub", click: signOut }] : []),
    { label: "Help and privacy", click: () => shell.openExternal(SITE) },
    { label: "Uninstall…", click: () => shell.openExternal("ms-settings:appsfeatures") },
    { type: "separator" },
    { label: "Quit Commit Notch", click: () => app.quit() },
  ]);
}

function buildTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip("Commit Notch");
  tray.on("right-click", () => tray.popUpContextMenu(appMenu()));
  tray.on("click", () => (token ? showIslands() : openSetup()));
}

ipcMain.on("menu", () => alive(win) && appMenu().popup({ window: win }));
ipcMain.on("quit", () => app.quit());
ipcMain.on("setup", () => openSetup());
ipcMain.on("hover", (_e, inside) => {
  if (e2eOut || !alive(win)) return;
  win.setIgnoreMouseEvents(!inside, { forward: true });
  if (inside) win.focus();
});
ipcMain.handle("init", () => settings);
ipcMain.on("refresh", pushContributions);

// ---------- boot ----------

app.on("second-instance", () => {
  if (quitting) return; // an installer can start the new app while this one is still closing
  if (token) showIslands();
  else openSetup();
});
app.on("window-all-closed", () => {}); // closing setup never quits the widget

app.whenReady().then(async () => {
  if (setupShots) return require("../test/setup-shots.js")(openSetup, setupShots);
  if (!tooling) migrate();
  const first = createWindow();
  if (!tooling) buildTray();
  first.webContents.once("did-finish-load", async () => {
    if (await resolveToken()) {
      const cached = cachedContributions();
      if (cached) send("contributions", { data: cached });
    }
    const res = await pushContributions();
    pushTime();
    if (tooling) return;
    // signed in through the GitHub CLI already: no setup, so start with Windows by default
    if (firstRun && res.data) app.setLoginItemSettings({ openAtLogin: true });
    if (res.error === "signin") openSetup();
    updater.start(log);
  });
  setInterval(pushContributions, REFRESH_MS);
  setInterval(pushTime, RESYNC_MS);
  screen.on("display-metrics-changed", () => {
    if (!alive(win)) return;
    const { workArea } = screen.getPrimaryDisplay();
    win.setPosition(Math.round(workArea.x + (workArea.width - WIDTH) / 2), workArea.y);
  });
});
