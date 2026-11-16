# Commit Notch

Windows desktop widget: GitHub contributions (private included) and an NTP-synced world clock as three black islands at the top of the screen. Good means it feels like hardware: springy, quiet, never in the way.

## Commands
- `just dev`: run it (clears ELECTRON_RUN_AS_NODE, which VS Code sets)
- `just check`: biome, tsc (checkJs on src/*.js), bun test
- `just fmt`: fix formatting
- `just dist`: installer + zip via Electron's bundled Node (no Node installed here; electron-builder breaks under bun)
- `just store`: Microsoft Store .appx (needs the Partner Center identity; see STORE.md); `just store-assets` renders its tiles and screenshots

## Layout
- `src/main.js`: window, tray, IPC, settings, token storage
- `src/github.js`, `src/stats.js`, `src/ntp.js`: data; stats.js is pure and tested
- `src/renderer/`: islands UI; `motion.js` springs, `sound.js` Web Audio synth, `app.js` wiring
- `--shot=<png> --open=gh|clk` captures the window and quits, for visual checks

## Conventions
- Islands are div role=button, never <button>: the sign-in form sits inside one.
- No sound files or fonts shipped; everything synthesised or system.
