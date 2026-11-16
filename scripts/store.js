// Microsoft Store package into dist/. It goes up unsigned: Microsoft signs it on ingestion.
const { build, Platform } = require("electron-builder");
const pkg = require("../package.json");
process.noAsar = true; // Electron's fs treats .asar as folders; the builder needs raw files.

const appx = pkg.build.appx ?? {};
if (!(appx.identityName && appx.publisher)) {
  console.error("package.json needs build.appx.identityName and build.appx.publisher.");
  console.error("Copy them from Partner Center: your app > Product management > Product identity.");
  process.exit(1);
}

build({ targets: Platform.WINDOWS.createTarget(["appx"]), publish: "never" })
  .then((files) => console.log(files.join("\n")))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
