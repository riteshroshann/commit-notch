// Updates from GitHub Releases. Everything downloads in the background; a patch waits for the
// next restart, a minor or major release asks with a dialog. See RELEASING.md.
const { app, dialog, nativeImage } = require("electron");
const path = require("node:path");

const CHECK_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_MS = 30 * 1000;

/** @type {import("electron-updater").AppUpdater | null} */
let updater = null;
/** @type {string | null} version downloaded and waiting for a restart */
let ready = null;
let checking = false;
/** @type {(level: "info" | "warn" | "error", ...parts: unknown[]) => void} */
let log = () => {};

/** "major", "minor" or "patch": how far `next` is from `current`. @param {string} current @param {string} next */
function bump(current, next) {
  const [a, b] = [current, next].map((v) => v.split(/[.+-]/).map(Number));
  if (b[0] !== a[0]) return "major";
  if (b[1] !== a[1]) return "minor";
  return "patch";
}

/** GitHub sends notes as HTML; the dialog wants a few plain lines. @param {unknown} notes */
function plainNotes(notes) {
  const raw = Array.isArray(notes) ? notes.map((n) => n.note ?? "").join("\n") : String(notes ?? "");
  const text = raw
    .replace(/<\/(p|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 600 ? `${text.slice(0, 600).trimEnd()}…` : text;
}

const icon = () => nativeImage.createFromPath(path.join(__dirname, "..", "build", "icon.png"));

/** @param {string} version @param {unknown} notes */
async function askToRestart(version, notes) {
  const { response } = await dialog.showMessageBox({
    type: "info",
    icon: icon(),
    title: "Commit Notch",
    message: `Commit Notch ${version} is ready`,
    detail: `${plainNotes(notes) || "A fresh version is downloaded and waiting."}\n\nRestart now to finish, or keep going and it installs the next time Commit Notch closes.`,
    buttons: ["Restart now", "Later"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response === 0) updater?.quitAndInstall(true, true);
}

/** Start checking. Does nothing when running from source. @param {typeof log} logger */
function start(logger) {
  log = logger;
  if (!app.isPackaged || updater) return;
  const { autoUpdater } = require("electron-updater");
  updater = autoUpdater;
  autoUpdater.logger = {
    info: (m) => log("info", "update", m),
    warn: (m) => log("warn", "update", m),
    error: (m) => log("error", "update", m),
    debug: () => {},
  };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", (info) => {
    ready = info.version;
    if (bump(app.getVersion(), info.version) !== "patch") askToRestart(info.version, info.releaseNotes);
  });
  // the logger already records it; an emitter with no error listener would throw instead
  autoUpdater.on("error", () => {});
  setTimeout(check, FIRST_CHECK_MS);
  setInterval(check, CHECK_MS);
}

/** Quiet background check; offline or rate limited just means try again later. */
async function check() {
  if (!updater || checking || ready) return;
  checking = true;
  try {
    await updater.checkForUpdates();
  } catch {
    // already in the log through autoUpdater.logger
  } finally {
    checking = false;
  }
}

/** Someone asked from the menu, so answer either way. */
async function checkNow() {
  if (!updater) {
    dialog.showMessageBox({ type: "info", icon: icon(), message: "Updates work in the installed app only." });
    return;
  }
  if (ready) return askToRestart(ready, null);
  try {
    checking = true;
    const res = await updater.checkForUpdates();
    const next = res?.updateInfo.version;
    const newer = next !== undefined && next !== app.getVersion();
    await dialog.showMessageBox({
      type: "info",
      icon: icon(),
      title: "Commit Notch",
      message: newer ? `Downloading Commit Notch ${next}` : "You're up to date",
      detail: newer
        ? "It arrives in the background. You'll be asked to restart when it's ready."
        : `Commit Notch ${app.getVersion()} is the newest version.`,
      noLink: true,
    });
    // minor and major prompt on their own; a patch found by hand still deserves the prompt
    if (newer && next && bump(app.getVersion(), next) === "patch")
      updater.once("update-downloaded", (info) => askToRestart(info.version, info.releaseNotes));
  } catch (e) {
    log("warn", "manual update check failed", e);
    dialog.showMessageBox({
      type: "warning",
      icon: icon(),
      title: "Commit Notch",
      message: "Couldn't check for updates",
      detail: "GitHub couldn't be reached. Check your connection and try again.",
      noLink: true,
    });
  } finally {
    checking = false;
  }
}

/** Tray and island menu entry; shows the restart once an update is waiting. */
function menuItem() {
  return ready
    ? { label: `Restart to update to ${ready}`, click: () => updater?.quitAndInstall(true, true) }
    : { label: "Check for updates…", click: checkNow };
}

module.exports = { start, menuItem, bump, plainNotes };
