# Commit Notch

Your GitHub year, hanging off the top of your screen like it pays rent there.

Three tiny black islands sit on the top edge of Windows. The left one shows your last seven days and how much you've shipped today. The middle one springs open into your whole year: the contribution graph, your latest pushes, the repos you lived in, and the year in four numbers. Private repos count, because your best work is usually the stuff nobody can see. The right one is a clock synced to actual atomic time, so you'll know exactly how late it is to still be committing.

It bloops when it opens. It boops when it closes. Nobody asked for that, and it's the best part.

**[Download for Windows](https://github.com/riteshroshann/commit-notch/releases/latest/download/Commit-Notch-win.exe)** · [Portable zip](https://github.com/riteshroshann/commit-notch/releases/latest/download/Commit-Notch-win.zip) · [Website](https://riteshroshann.github.io/commit-notch/) · [Developer docs](https://riteshroshann.github.io/commit-notch/developers.html)

## Sixty-second setup

1. Run the installer. Windows will clutch its pearls ("Windows protected your PC") because the app isn't code-signed. Click **More info**, then **Run anyway**.
2. The setup window opens. Hit **Sign in with GitHub**, paste the code (it's already on your clipboard) and approve. Done. Your login stays on your machine, encrypted.
3. Want private work in the graph? On GitHub, turn on **Include private contributions on my profile**.

Terminal person? `winget install GitHub.cli` then `gh auth login --web --scopes "repo,read:user"`, and Commit Notch signs itself in.

Click the middle island to open it, then scroll or use the arrow keys to flip pages. Right-click any island for settings, or hit the power button to quit.

**Breaking up?** Settings → Apps → Commit Notch → Uninstall. It takes everything with it: the app, the start-at-login entry, your encrypted login, the cache. No clingy leftovers.

## For the curious

```
bun install
just dev     # run it
just check   # lint, types, unit tests
just e2e     # the robot that clicks everything really fast
just dist    # installer + zip
```

It's plain JavaScript in one transparent Electron window. Springs are real physics baked into CSS, sounds are synthesised live (zero audio files), and the clock speaks NTP to Cloudflare. The [developer docs](https://riteshroshann.github.io/commit-notch/developers.html) explain every piece.

Your token stays on your machine, encrypted. The app talks to GitHub and a time server, and that's the whole guest list.

[Privacy](https://riteshroshann.github.io/commit-notch/privacy.html) · [Terms](https://riteshroshann.github.io/commit-notch/terms.html) · MIT licensed. Not affiliated with GitHub, Inc.

Engineered by Ritesh Roshan.
