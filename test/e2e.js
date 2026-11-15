// End-to-end run against the real window: real clicks, keys and wheel events,
// then checks both the DOM state and the actual pixels of the open island.
// Run: just e2e
const fs = require("node:fs");
const path = require("node:path");

/** @param {import("electron").BrowserWindow} win @param {string} out */
module.exports = async function run(win, out) {
  const wc = win.webContents;
  const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
  const js = (/** @type {string} */ s) => wc.executeJavaScript(s);
  fs.mkdirSync(out, { recursive: true });
  /** @type {{ name: string, ok: boolean, why?: string }[]} */
  const results = [];

  const rect = (/** @type {string} */ id) =>
    js(`(() => { const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);

  async function click(/** @type {string} */ id) {
    const r = await rect(id);
    const x = Math.round(r.x + Math.min(r.w / 2, 60));
    const y = Math.round(r.y + 16);
    wc.sendInputEvent({ type: "mouseMove", x, y });
    wc.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount: 1 });
    wc.sendInputEvent({ type: "mouseUp", x, y, button: "left", clickCount: 1 });
  }
  function key(/** @type {string} */ k) {
    wc.sendInputEvent({ type: "keyDown", keyCode: k });
    wc.sendInputEvent({ type: "keyUp", keyCode: k });
  }
  async function wheel(/** @type {number} */ dy) {
    const r = await rect("pages");
    wc.sendInputEvent({ type: "mouseWheel", x: Math.round(r.x + 40), y: Math.round(r.y + 40), deltaX: 0, deltaY: -dy });
  }
  async function burst(/** @type {() => any} */ fn, /** @type {number} */ n, /** @type {number} */ gap) {
    for (let i = 0; i < n; i++) {
      await fn();
      await sleep(gap);
    }
  }

  const state = () =>
    js(`(() => {
      const o = document.querySelector('.island.open');
      if (!o) return { open: null };
      const full = o.querySelector('.full');
      const cs = getComputedStyle(full);
      const pages = [...o.querySelectorAll('.page')].map((p) => ({ vis: getComputedStyle(p).visibility, op: +getComputedStyle(p).opacity }));
      const anims = full.getAnimations().map((a) => ({ ps: a.playState, kf: a.effect.getKeyframes().map((k) => k.opacity), fill: a.effect.getTiming().fill }));
      return { open: o.id, fullOp: +cs.opacity, fullDisp: cs.display, pages, anims, cls: full.className + " style=" + full.style.cssText };
    })()`);

  /** Share of bright pixels inside the island: text, cells and bars. A blank panel scores ~0. */
  async function lit(/** @type {string} */ id) {
    const r = await rect(id);
    const img = await wc.capturePage({
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.w),
      height: Math.round(r.h),
    });
    const bmp = img.toBitmap();
    let n = 0;
    for (let i = 0; i < bmp.length; i += 4) if ((bmp[i] ?? 0) + (bmp[i + 1] ?? 0) + (bmp[i + 2] ?? 0) > 120) n++;
    return { ratio: n / (bmp.length / 4), img };
  }

  async function expectOpen(/** @type {string} */ name, /** @type {string} */ id) {
    await sleep(1100);
    const s = await state();
    const { ratio, img } = await lit(id);
    let why = "";
    if (s.open !== id) why = `expected ${id} open, got ${s.open}`;
    else if (s.fullDisp === "none" || s.fullOp < 0.99)
      why = `panel content hidden (opacity ${s.fullOp}, ${s.cls}, ${JSON.stringify(s.anims)})`;
    else if (id === "gh" && s.pages.filter((/** @type {any} */ p) => p.vis === "visible" && p.op > 0.99).length !== 1)
      why = `pages ${JSON.stringify(s.pages)}`;
    else if (ratio < 0.015) why = `panel looks blank (${(ratio * 100).toFixed(2)}% lit)`;
    const ok = !why;
    results.push({ name, ok, why: why || `${(ratio * 100).toFixed(1)}% lit` });
    fs.writeFileSync(
      path.join(
        out,
        `${results.length.toString().padStart(2, "0")}-${ok ? "ok" : "FAIL"}-${name.replace(/\W+/g, "-")}.png`,
      ),
      img.toPNG(),
    );
  }
  async function expectClosed(/** @type {string} */ name) {
    await sleep(900);
    const s = await state();
    results.push({ name, ok: s.open === null, why: s.open ? `${s.open} still open` : "closed" });
  }

  await sleep(2500); // data from cache or network
  win.focus();
  wc.focus();

  await click("gh");
  await expectOpen("open contributions", "gh");

  await burst(() => key("Right"), 12, 25);
  await expectOpen("12 fast right arrows", "gh");

  await burst(() => key("Left"), 30, 8);
  await expectOpen("30 held left arrows", "gh");

  let flip = false;
  await burst(() => key((flip = !flip) ? "Right" : "Left"), 24, 12);
  await expectOpen("alternating arrows", "gh");

  await burst(() => key("Down"), 7, 160);
  await expectOpen("arrows at reading pace", "gh");

  await burst(() => wheel(120), 14, 20);
  await expectOpen("wheel burst", "gh");

  key("Escape");
  await expectClosed("escape closes");
  await click("gh");
  await expectOpen("reopen after escape", "gh");

  await burst(() => key("Right"), 2, 300);
  key("Escape");
  await sleep(60);
  await click("gh");
  await expectOpen("reopen mid-transition on page 3", "gh");

  await click("clk");
  await expectOpen("switch to clock", "clk");
  await click("gh");
  await expectOpen("switch back to contributions", "gh");

  await burst(() => click("gh"), 7, 45);
  await sleep(900);
  if ((await state()).open !== "gh") await click("gh");
  await expectOpen("seven rapid clicks", "gh");

  wc.send("collapse");
  await sleep(40);
  await click("gh");
  await expectOpen("focus loss then instant reopen", "gh");

  await burst(
    async () => {
      key("Right");
      await click("clk");
      await click("gh");
    },
    6,
    30,
  );
  await sleep(900);
  if ((await state()).open !== "gh") await click("gh");
  await expectOpen("arrows mixed with island switching", "gh");

  const failed = results.filter((r) => !r.ok);
  const report = results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.why})`).join("\n");
  fs.writeFileSync(path.join(out, "report.txt"), report);
  console.log(`${report}\n\n${results.length - failed.length}/${results.length} passed`);
  return failed.length;
};
