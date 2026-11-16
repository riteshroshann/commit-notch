# Microsoft Store

The Store build is the same app with three differences: Microsoft signs it (so Windows never warns), the Store delivers updates (the built-in updater stays off), and a startup task starts it with Windows (people switch it in Settings > Apps > Startup). The GitHub installer keeps working alongside it.

## What only you can do

These need your Microsoft account in a browser. Nothing here can be done from the command line until they're done once.

1. **Register as a developer.** Go to https://storedeveloper.microsoft.com, choose Individual, and sign in with your Microsoft account. Registration is free for individuals; it asks for an ID check, which can take a few days.
2. **Reserve the name.** In Partner Center (https://partner.microsoft.com/dashboard/apps-and-games/overview) choose New product > MSIX or PWA app and reserve **Commit Notch**.
3. **Copy the product identity.** Open the app > Product management > Product identity, and send me these three lines:
   - `Package/Identity/Name`
   - `Package/Identity/Publisher` (starts with `CN=`)
   - `Package/Properties/PublisherDisplayName`

## What happens next

With those three values:

1. They go into `build.appx` in `package.json` (`identityName`, `publisher`, `publisherDisplayName`).
2. `just store` builds `dist/Commit-Notch-win.appx`.
3. In Partner Center, start a submission and fill it in from the listing below. Upload the `.appx` under Packages, the PNGs in `store/` under Screenshots, and answer the age rating questionnaire (no violence, no user-generated content, no purchases: it rates 3+).
4. Submit. Certification usually takes one to three days.

For later versions, bump the version as usual, run `just store`, and upload the new `.appx` as a new submission. Store and GitHub versions share one version number.

## Listing

**Name** Commit Notch

**Category** Developer tools

**Short description**
Your GitHub contributions and an atomic world clock, hanging from the top of your screen.

**Description**
Commit Notch puts your GitHub year where you'll actually see it: three small black islands along the top edge of your screen.

Click the middle one and your contribution calendar opens, private repositories included, with your current and longest streak. Turn the page with the arrow keys to see the repositories you pushed to last, where your commits went this year, and how your work splits between commits, pull requests, reviews and issues.

The right island is a clock synced to atomic time, with the cities you work with and how far ahead or behind they are.

It's built to feel like hardware: springy, quiet and never in the way. Mouse clicks pass straight through when you're not using it, and it refreshes every fifteen minutes on its own.

Sign in once with GitHub in your browser, or reuse the GitHub CLI if you already have it. Your sign in is encrypted with Windows and never leaves your PC except to talk to GitHub. Commit Notch only reads; it never writes to GitHub.

Requires a GitHub account.

**Features**
- Your GitHub contribution calendar, private work included
- Current and longest streak at a glance
- Recently pushed repositories and where your commits went
- Atomic-time world clock for four cities
- Starts with Windows and stays out of your way

**Keywords** GitHub, contributions, streak, commits, developer, clock, world clock, widget

**Privacy policy URL** https://riteshroshann.github.io/commit-notch/privacy.html

**Website** https://riteshroshann.github.io/commit-notch/

**Support contact** riteshroshansahoo01@gmail.com

**Copyright** © 2026 Ritesh Roshan

**Restricted capability (runFullTrust) justification**
Commit Notch is a desktop app built with Electron. It needs full trust to show an always-on-top, click-through window at the top of the screen, to store the user's GitHub sign in with Windows data protection, and to read an existing GitHub CLI sign in when the user chooses that option.
