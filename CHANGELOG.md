# Changelog

Each `## <version>` section becomes the release notes and the text in the in-app update dialog.

## 1.4.0

Commit Notch now updates itself. New versions download quietly in the background, and when a bigger release lands you'll be asked to restart; small fixes simply install the next time the app closes. The tray menu has Check for updates too.

- Fixed a crash ("Object has been destroyed") when Commit Notch was opened again after its window had been closed.
- Your profile photo no longer slips back to the orange initial after a while; a photo that fails to load is retried.
- Updating keeps Open at login switched on.
- Errors are written to a small log in `%APPDATA%\Commit Notch\main.log` instead of interrupting you.

## 1.3.0

Setup is now one card: a short welcome and a single Sign in with GitHub button. GitHub CLI and token sign in sit behind two small links. Uninstalling removes everything it kept and leaves a short goodbye.
