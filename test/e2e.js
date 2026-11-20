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

  // account picker: opens over the panel, keys stay inside it, picking switches only the view
  const picker = () =>
    js(`(() => {
      const box = document.getElementById("accounts");
      const rows = [...box.querySelectorAll(".acct")];
      return { open: !box.hidden && !box.classList.contains("closing"), rows: rows.map((r) => r.textContent),
        current: rows.findIndex((r) => r.getAttribute("aria-checked") === "true"),
        focused: rows.indexOf(document.activeElement), name: document.getElementById("name").textContent,
        page: document.querySelector("#gh .dots .on, #gh .dots [aria-current]")?.dataset?.page ?? null };
    })()`);
  /** @param {string} name @param {() => Promise<string>} check */
  async function expect(name, check) {
    const why = await check();
    results.push({ name, ok: !why, why: why || "ok" });
    const r = await rect("gh");
    const img = await wc.capturePage({
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.w),
      height: Math.round(r.h),
    });
    const file = `${results.length.toString().padStart(2, "0")}-${why ? "FAIL" : "ok"}-${name.replace(/\W+/g, "-")}.png`;
    fs.writeFileSync(path.join(out, file), img.toPNG());
  }

  wc.send("collapse");
  await sleep(300);
  await click("gh");
  await sleep(1100);
  await click("who");
  await sleep(1500); // accounts come from the GitHub CLI
  const before = await picker();
  await expect("photo opens the account picker", async () => {
    const s = await state();
    if (s.open !== "gh") return `island closed (${s.open})`;
    if (!before.open) return "picker not open";
    if (!before.rows.some((t) => t.includes("Add account"))) return `rows ${JSON.stringify(before.rows)}`;
    return "";
  });

  key("Down");
  await sleep(200);
  await expect("arrows move through accounts, not pages", async () => {
    const s = await picker();
    if (!s.open) return "picker closed";
    if (s.focused === before.focused) return `focus stayed on row ${s.focused}`;
    return "";
  });

  key("Escape");
  await sleep(400);
  await expect("escape closes only the picker", async () => {
    const s = await picker();
    if (s.open) return "picker still open";
    if ((await state()).open !== "gh") return "island closed too";
    return "";
  });

  const others = before.rows.filter((t, i) => i !== before.current && !t.includes("Add account"));
  if (others.length) {
    const target = /** @type {string} */ (others[0]);
    await click("who");
    await sleep(1500);
    const row = await js(`(() => { const r = [...document.querySelectorAll("#accounts .acct")]
      .find((e) => e.textContent === ${JSON.stringify(target)}).getBoundingClientRect(); return { x: r.x + 30, y: r.y + r.height / 2 }; })()`);
    const at = { x: Math.round(row.x), y: Math.round(row.y) };
    wc.sendInputEvent({ type: "mouseMove", ...at });
    wc.sendInputEvent({ type: "mouseDown", ...at, button: "left", clickCount: 1 });
    wc.sendInputEvent({ type: "mouseUp", ...at, button: "left", clickCount: 1 });
    await sleep(6000); // a fresh account loads from GitHub
    await expect(`switch to ${target}`, async () => {
      const s = await picker();
      if (s.open) return "picker still open";
      if (s.name === before.name) return `still showing ${s.name}`;
      return "";
    });
  }

  const failed = results.filter((r) => !r.ok);
  const report = results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.why})`).join("\n");
  fs.writeFileSync(path.join(out, "report.txt"), report);
  console.log(`${report}\n\n${results.length - failed.length}/${results.length} passed`);
  return failed.length;
};
