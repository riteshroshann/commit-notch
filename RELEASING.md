# Releasing

Installed copies check GitHub Releases at start and every six hours. A release reaches people the moment its draft is published, never before.

## Versions

- **Patch** (1.4.0 → 1.4.1): fixes. Downloads quietly and installs the next time the app closes. No dialog.
- **Minor** (1.4 → 1.5): new features. Downloads, then asks "Restart now" or "Later".
- **Major** (1.x → 2.0): big changes. Same dialog.

"Later" installs on the next quit, and the tray menu shows "Restart to update" meanwhile.

## Ship a release

1. Add a `## <version>` section to the top of `CHANGELOG.md`. It becomes the release notes and the dialog text, so write it for the people using the app.
2. `just release 1.5.0` bumps `package.json`, runs `just check`, commits, tags `v1.5.0` and pushes.
3. The `release` workflow builds the installer, signs it if the certificate secrets are set, and drafts a release with the installer, zip, `latest.yml` and blockmap.
4. Install the draft's `Commit-Notch-win.exe` on a test PC and look at it.
5. `just publish 1.5.0` publishes the draft. Updates start reaching people within six hours.

To pull a bad release, `gh release edit v1.5.0 --draft` hides it from updaters again; ship the fix as the next patch. Never reuse a version number.

Keep the asset names fixed (`Commit-Notch-win.exe`): the website links to `releases/latest/download/` and the updater reads `latest.yml`.

## Signing

Signing gives the installer a named publisher, which is what stops Windows SmartScreen from warning people off.

1. Export the certificate as a `.pfx` with its private key.
2. Add two repository secrets (Settings → Secrets and variables → Actions):
   - `WIN_CSC_LINK`: the `.pfx` as base64 (`[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))` in PowerShell)
   - `WIN_CSC_KEY_PASSWORD`: its password
3. The next tagged build is signed. Check with `Get-AuthenticodeSignature .\Commit-Notch-win.exe`.

Once releases are signed, the updater checks that each new installer carries the same publisher name, so keep signing with a certificate for the same name.

If the certificate lives on a hardware token or in a cloud HSM (most certificates issued since June 2023 do), a `.pfx` can't be exported. Then sign on the machine holding the token, or use the provider's signing service, and set `win.signtoolOptions` or `win.azureSignOptions` in `package.json` instead.

If a signed build is still flagged, submit it at https://www.microsoft.com/wdsi/filesubmission as a software developer reporting an incorrect detection. Warnings also fade on their own as signed downloads build reputation.
