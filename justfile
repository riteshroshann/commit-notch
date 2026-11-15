set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default: check

# Run the widget
dev:
    $env:ELECTRON_RUN_AS_NODE=$null; bun x electron .

# Format check, lint, types, tests
check:
    bun x biome check .
    bun x tsc --noEmit
    bun test

# Fix formatting and autofixable lint
fmt:
    bun x biome check --write .

# Installer and portable zip into dist/
dist:
    $env:ELECTRON_RUN_AS_NODE="1"; node_modules/electron/dist/electron.exe scripts/dist.js
