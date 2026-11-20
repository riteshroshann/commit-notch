# Changelog

Each `## <version>` section becomes the release notes and the text in the in-app update dialog.

## 1.5.1

Smoother opening. The first click after starting no longer stalls for a moment before the island opens, and the account picker opens already filled instead of growing from an empty strip.

## 1.5.0

Click your profile photo to switch accounts. Every GitHub account on this PC is listed: the ones you signed in to here and every account the GitHub CLI holds. Pick one and Commit Notch stays on it, without changing your GitHub CLI or anything else. Add account signs in one you haven't set up yet.

## 1.4.1

Updating from 1.3.0 or older switched off Open at login. This turns it back on, once; switch it off again from the tray menu if you prefer.

## 1.4.0

Commit Notch now updates itself. New versions download quietly in the background, and when a bigger release lands you'll be asked to restart; small fixes simply install the next time the app closes. The tray menu has Check for updates too.

- Fixed a crash ("Object has been destroyed") when Commit Notch was opened again after its window had been closed.
- Your profile photo no longer slips back to the orange initial after a while; a photo that fails to load is retried.
- Updating keeps Open at login switched on.
- Errors are written to a small log in `%APPDATA%\Commit Notch\main.log` instead of interrupting you.

## 1.3.0

Setup is now one card: a short welcome and a single Sign in with GitHub button. GitHub CLI and token sign in sit behind two small links. Uninstalling removes everything it kept and leaves a short goodbye.
