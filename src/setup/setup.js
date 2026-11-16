// First-run setup: welcome, connect (browser, CLI or token), approve, done.
const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const query = new URLSearchParams(location.search);
const mock = query.has("mock");

/** Preview builds (screenshots) have no bridge; give them a quiet stand-in. */
const api =
  /** @type {any} */ (window).setup ??
  /** @type {any} */ ({
    info: async () => ({ version: "1.2.0", deviceFlow: true, openAtLogin: true }),
    start() {},
    cancel() {},
    token: async () => ({ ok: true }),
    cli: async () => ({ ok: true }),
    open() {},
    finish() {},
    close() {},
    on() {},
  });

// ---------- the door's graph: the product's own artifact, quiet until it's thinking ----------
const cells = $("cells");
for (let i = 0; i < 18 * 7; i++) {
  const c = document.createElement("i");
  const v = Math.sin(i / 9) + ((i * 7919) % 11) / 7;
  c.style.setProperty("--o", String(v > 1.5 ? 0.55 : v > 1.1 ? 0.28 : v > 0.7 ? 0.12 : 0.05));
  c.style.setProperty("--d", `${((i % 18) * 0.06 + Math.floor(i / 18) * 0.03).toFixed(2)}s`);
  cells.append(c);
}

// ---------- panes ----------
const card = $("card");
/** @type {Record<string, HTMLElement>} */
const panes = {};
for (const p of document.querySelectorAll(".pane"))
  panes[/** @type {HTMLElement} */ (p).dataset.pane ?? ""] = /** @type {HTMLElement} */ (p);
let current = "";

/** @param {string} name */
function show(name) {
  if (name === current || !panes[name]) return;
  const from = card.getBoundingClientRect().height;
  for (const [k, el] of Object.entries(panes)) el.classList.toggle("on", k === name);
  const to = card.getBoundingClientRect().height;
  if (current && from !== to && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    card.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 420,
      easing: "cubic-bezier(0.2, 0.9, 0.25, 1.02)",
    });
  }
  current = name;
  document.body.classList.toggle("thinking", name === "code");
  // focus the field if there is one, otherwise the heading, so no ring lights up a button on arrival
  const focus = /** @type {HTMLElement | null} */ (panes[name]?.querySelector("input, h1"));
  focus?.focus({ preventScroll: true });
}

function shake() {
  card.classList.remove("shake");
  void card.offsetWidth;
  card.classList.add("shake");
}

/** Busy buttons speak in the present tense. @param {HTMLButtonElement} b @param {string | null} label */
function busy(b, label) {
  if (label) {
    if (b.dataset.idle === undefined) b.dataset.idle = b.innerHTML; // keeps the GitHub mark
    b.textContent = label;
    b.disabled = true;
  } else if (b.dataset.idle !== undefined) {
    b.innerHTML = b.dataset.idle;
    delete b.dataset.idle;
    b.disabled = false;
  }
}

/** @param {HTMLElement} el @param {string} [text] */
function say(el, text) {
  el.hidden = !text;
  el.textContent = text ?? "";
}

async function copy(/** @type {HTMLButtonElement} */ b, /** @type {string} */ text) {
  try {
    await navigator.clipboard.writeText(text);
    b.textContent = "Copied";
    b.classList.add("done");
    setTimeout(() => {
      b.textContent = "Copy";
      b.classList.remove("done");
    }, 1500);
  } catch {}
}

document.addEventListener("click", (e) => {
  const t = /** @type {HTMLElement} */ (e.target);
  const go = /** @type {HTMLElement | null} */ (t.closest("[data-go]"))?.dataset.go;
  if (go) {
    if (current === "code" || current === "start") api.cancel();
    busy(/** @type {HTMLButtonElement} */ ($("browser")), null);
    show(go);
  }
  const copyBtn = /** @type {HTMLButtonElement | null} */ (t.closest("[data-copy]"));
  if (copyBtn) copy(copyBtn, copyBtn.dataset.copy ?? "");
  const link = /** @type {HTMLAnchorElement | null} */ (t.closest("a[href]"));
  if (link) {
    e.preventDefault();
    api.open(link.href);
  }
});

$("close").addEventListener("click", () => {
  api.cancel();
  api.close();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("close").click();
});

// ---------- browser sign in (device flow) ----------
/** @type {{ userCode: string, verificationUri: string, expiresIn: number } | null} */
let grant = null;
/** @type {ReturnType<typeof setInterval> | undefined} */
let countdown;

$("browser").addEventListener("click", () => {
  busy(/** @type {HTMLButtonElement} */ ($("browser")), "One moment");
  api.start();
});

api.on("code", (/** @type {typeof grant} */ g) => {
  if (current !== "start") return; // the person already moved on
  grant = g;
  busy(/** @type {HTMLButtonElement} */ ($("browser")), null);
  if (!g) return;
  $("userCode").textContent = g.userCode;
  navigator.clipboard.writeText(g.userCode).catch(() => {});
  const ends = Date.now() + g.expiresIn * 1000;
  clearInterval(countdown);
  const tick = () => {
    const s = Math.max(0, Math.round((ends - Date.now()) / 1000));
    $("waitText").textContent =
      `Code copied. Waiting for GitHub · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  tick();
  countdown = setInterval(tick, 1000);
  show("code");
});

$("copyCode").addEventListener(
  "click",
  () => grant && copy(/** @type {HTMLButtonElement} */ ($("copyCode")), grant.userCode),
);
$("reopen").addEventListener("click", () => grant && api.open(grant.verificationUri));
$("cancelCode").addEventListener("click", () => {
  api.cancel();
  clearInterval(countdown);
  show("start");
});

const ERRORS = {
  expired: ["That code expired.", "Codes last 15 minutes. Get a fresh one and try again."],
  denied: ["Access was declined.", "Nothing was shared with Commit Notch. Try again whenever you're ready."],
  offline: ["Can't reach GitHub.", "Check your internet connection, then try again."],
};

api.on("error", (/** @type {{ code: string, message: string }} */ e) => {
  clearInterval(countdown);
  busy(/** @type {HTMLButtonElement} */ ($("browser")), null);
  const [title, text] = ERRORS[/** @type {keyof typeof ERRORS} */ (e.code)] ?? [
    "Sign in didn't finish.",
    `${e.message}. Try again.`,
  ];
  $("errTitle").textContent = title;
  $("errText").textContent = text;
  show("error");
  shake();
});

// ---------- GitHub CLI ----------
$("cliCheck").addEventListener("click", async () => {
  const b = /** @type {HTMLButtonElement} */ ($("cliCheck"));
  busy(b, "Checking");
  say($("cliError"));
  let res;
  try {
    res = await api.cli();
  } catch {
    res = { error: "Something stopped the sign in. Try again." };
  } finally {
    busy(b, null);
  }
  if (res.error) {
    say($("cliError"), res.error);
    shake();
  }
});

// ---------- token ----------
$("tokenForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = /** @type {HTMLButtonElement} */ ($("tokenGo"));
  busy(b, "Checking");
  say($("tokenError"));
  let res;
  try {
    res = await api.token(/** @type {HTMLInputElement} */ ($("token")).value);
  } catch {
    res = { error: "Something stopped the sign in. Try again." };
  } finally {
    busy(b, null);
  }
  if (res.error) {
    say($("tokenError"), res.error);
    shake();
  }
});

// ---------- done ----------
api.on("done", (/** @type {{ name: string, login: string, avatar?: string }} */ who) => {
  clearInterval(countdown);
  const first = who.name.split(" ")[0] || who.login;
  $("doneTitle").textContent = `You're in, ${first}.`;
  const av = $("avatar");
  av.textContent = first.charAt(0).toUpperCase();
  if (who.avatar) {
    const img = new Image();
    img.alt = "";
    img.onload = () => av.replaceChildren(img);
    img.src = who.avatar;
  }
  show("done");
});
$("finish").addEventListener("click", () => api.finish(/** @type {HTMLInputElement} */ ($("atLogin")).checked));

// ---------- boot ----------
api
  .info()
  .then(
    (
      /** @type {{ version: string, deviceFlow: boolean, openAtLogin: boolean, firstRun: boolean, store: boolean }} */ info,
    ) => {
      // Store installs start with Windows through a startup task that Windows Settings controls
      if (info.store) /** @type {HTMLElement} */ ($("atLogin").closest("label")).hidden = true;
      $("version").textContent = `v${info.version}`;
      /** @type {HTMLInputElement} */ ($("atLogin")).checked = info.firstRun || info.openAtLogin;
      if (!info.deviceFlow) {
        // no OAuth app configured in this build: the CLI becomes the main way in
        $("browser").hidden = true;
      }
      const start = query.get("pane") ?? "start";
      if (mock && start === "code") api.on("code", () => {});
      show(start);
      if (mock && start === "code") {
        $("userCode").textContent = "8F3K-2QXW";
        $("waitText").textContent = "Code copied. Waiting for GitHub · 14:52";
      }
      if (mock && start === "done") {
        $("doneTitle").textContent = "You're in, Ritesh.";
        $("avatar").textContent = "R";
      }
      if (mock && start === "error") {
        $("errTitle").textContent = ERRORS.expired[0];
        $("errText").textContent = ERRORS.expired[1];
      }
    },
  );
