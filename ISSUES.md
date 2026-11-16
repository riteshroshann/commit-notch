# Issue log

Field reports, what caused them, and what fixed them. Newest first.

## 4. Updating meant reinstalling

**Reported** 16 Nov 2026, version 1.3.0.
**Symptom** Every new version had to be downloaded and installed by hand, so most people stayed on whatever they first installed.
**Cause** The app had no updater. Releases were uploaded by hand without the `latest.yml` manifest an updater reads.
**Fix** 1.4.0 adds `electron-updater` against GitHub Releases, with a tag-driven build in `.github/workflows/release.yml`. Patches install on next restart; minor and major releases ask with a dialog. The process is in [RELEASING.md](RELEASING.md). People on 1.3.0 or older install 1.4.0 by hand once; every release after that arrives on its own.
**Also fixed** The uninstall hook ran during updates too, which would have switched off Open at login on every update. It now skips itself when `isUpdated`.

## 3. Windows warns before installing

**Reported** 16 Nov 2026, friends installing 1.3.0.
**Symptom** Microsoft Defender SmartScreen shows "Windows protected your PC" and suggests not running the installer.
**Cause** The installer is unsigned and new, so SmartScreen has no publisher and no reputation to go on.
**Fix** Sign every build with the code signing certificate (wired into the release workflow through two repository secrets, see [RELEASING.md](RELEASING.md#signing)), then submit the signed installer to Microsoft as a false positive if it's still flagged. Reputation builds per certificate, so warnings fade as signed downloads accumulate. Status: waiting on the certificate being added as secrets.

## 2. Profile photo falls back to the orange initial

**Reported** 16 Nov 2026, once, after the app had been running for a while. Reopening the app fixed it.
**Symptom** Signed in, but the contributions island shows the orange initial instead of the GitHub photo.
**Cause** Every 15-minute refresh in `setAvatar` (`src/renderer/app.js`) cleared the photo, showed the initial, then loaded the photo again. If that load failed (PC just woke from sleep, network not back yet, a CDN hiccup) there was no error handler and no retry, so the initial stayed until a later refresh happened to succeed.
**Fix** 1.4.0 keeps a photo that's already showing when the URL hasn't changed, only swaps once the new photo has loaded, and retries a failed load with backoff (5 s up to 80 s), on top of the next refresh.

## 1. "A JavaScript error occurred in the main process: Object has been destroyed"

**Reported** 16 Nov 2026, a user on 1.3.0. Stack: `App.<anonymous> (src/main.js:…:45)` from `App.emit`.
**Symptom** Error dialog from the main process.
**Cause** The islands window is focused while the mouse is over it, so Alt+F4 closed and destroyed it while the app kept running in the tray (`window-all-closed` does nothing). Opening Commit Notch again fires `second-instance`, whose handler called `win.webContents.send` on the destroyed window and threw. The same throw was possible from the tray click, the screen-change handler, and while an installer starts the new app as the old one is shutting down.
**Fix** 1.4.0: the islands window refuses to close unless the app is quitting; every message to it goes through one guarded `send`; if the window is ever gone it is recreated rather than used; `second-instance` is ignored while quitting; a crashed renderer reloads; and uncaught errors go to `main.log` instead of a dialog.
