# Commit Notch

Your GitHub year and an atomic world clock, hanging from the top of your Windows screen. Three small black islands sit at the top edge. The left one shows what you've shipped today and a seven-day sparkline. The centre one springs open into your contribution graph, private repos included, plus your top repos and a breakdown of commits, pull requests, reviews and issues. The right one is a clock synced to atomic time, with four cities beside it. Every open, close and page turn has its own small synthesised sound.

## Use it

Download `Commit Notch-1.0.0-win.exe` from Releases and run it. Or unzip `Commit Notch-1.0.0-win.zip` anywhere and run `Commit Notch.exe`. Windows SmartScreen may warn on first launch because the app isn't code-signed: click **More info**, then **Run anyway**.

It signs in through the GitHub CLI if you've run `gh auth login`. Otherwise, paste a classic token with `repo` and `read:user` scopes into the panel. It's stored encrypted with Windows DPAPI. For private work to count, turn on **Include private contributions on my profile** in your GitHub settings.

Right-click the tray icon to refresh, mute sounds, toggle open-at-login or sign out. To change the cities, edit `%APPDATA%\Commit Notch\settings.json`.

## Build it

```
bun install
just dev     # run
just dist    # installer + portable zip in dist/
```

## How it works

A transparent, always-on-top Electron window spans the top-centre of the screen and ignores the mouse everywhere except over an island. GitHub data comes from one GraphQL call to `contributionsCollection`, refreshed every 15 minutes. The clock runs an SNTP exchange with `time.cloudflare.com` every 10 minutes and applies the measured offset. Motion uses real spring physics baked into CSS `linear()` easings. Sounds are generated live with Web Audio, so the app ships no audio files.

Engineered by Ritesh Roshan.
