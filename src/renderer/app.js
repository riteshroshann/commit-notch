// Wires data, motion and sound to the three islands.
/* global Motion, Sound */
const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** Browser preview has no Electron bridge; feed it sample data instead. */
const bridge =
  /** @type {any} */ (window).notch ??
  (() => {
    /** @type {Record<string, (v: any) => void>} */
    const handlers = {};
    setTimeout(() => {
      handlers.contributions?.({ data: sampleData() });
      handlers.time?.({ offset: 4, rtt: 18, host: "time.cloudflare.com" });
    }, 50);
    return {
      init: async () => ({
        sound: true,
        cities: [
          ["San Francisco", "America/Los_Angeles"],
          ["New York", "America/New_York"],
          ["London", "Europe/London"],
          ["Tokyo", "Asia/Tokyo"],
        ],
      }),
      hover() {},
      setup() {},
      quit() {},
      menu() {},
      refresh() {},
      saveToken: async () => ({ ok: true }),
      on: (/** @type {string} */ c, /** @type {(v: any) => void} */ f) => (handlers[c] = f),
    };
  })();

function sampleData() {
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const days = [];
  const start = new Date();
  start.setDate(start.getDate() - 364 - start.getDay());
  for (let i = 0; i < 371; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d > new Date()) break;
    const busy = Math.sin(i / 38) + rnd() * 1.7;
    const level = busy < 0.7 ? 0 : Math.min(4, Math.floor((busy - 0.5) * 2.4));
    days.push({ date: d.toISOString().slice(0, 10), count: level ? level * 3 + Math.floor(rnd() * 3) : 0, level });
  }
  for (let i = 1; i <= 6; i++) days[days.length - i] = { ...days[days.length - i], count: 2 + i, level: 2 + (i % 3) };
  return {
    name: "Ritesh Roshan",
    login: "riteshroshann",
    avatar: "https://avatars.githubusercontent.com/riteshroshann?s=96",
    total: days.reduce((s, d) => s + d.count, 0),
    days,
    months: [],
    current: 6,
    longest: 14,
    today: 8,
    week: days.slice(-7).map((d) => d.count),
    // Made-up projects for the website demo; the app always shows the signed-in user's real repos.
    kinds: { commits: 1284, pullRequests: 96, issues: 31, reviews: 142 },
    latest: [
      {
        name: "riteshroshann/flash-kv",
        private: false,
        language: { name: "Rust", color: "#dea584" },
        pushedAt: new Date(Date.now() - 12 * 60e3).toISOString(),
      },
      {
        name: "riteshroshann/edge-infer",
        private: true,
        language: { name: "C++", color: "#f34b7d" },
        pushedAt: new Date(Date.now() - 5 * 36e5).toISOString(),
      },
      {
        name: "riteshroshann/gpt-from-scratch",
        private: false,
        language: { name: "Python", color: "#3572A5" },
        pushedAt: new Date(Date.now() - 26 * 36e5).toISOString(),
      },
      {
        name: "riteshroshann/zerocopy-rpc",
        private: true,
        language: { name: "Go", color: "#00ADD8" },
        pushedAt: new Date(Date.now() - 4 * 864e5).toISOString(),
      },
    ],
    repos: [
      { name: "riteshroshann/edge-infer", private: true, language: { name: "C++", color: "#f34b7d" }, commits: 412 },
      { name: "riteshroshann/flash-kv", private: false, language: { name: "Rust", color: "#dea584" }, commits: 318 },
      {
        name: "riteshroshann/tiny-autograd",
        private: false,
        language: { name: "Python", color: "#3572A5" },
        commits: 176,
      },
      {
        name: "riteshroshann/wasm-raytracer",
        private: false,
        language: { name: "Zig", color: "#ec915c" },
        commits: 129,
      },
    ],
  };
}

// ---------- islands ----------
const islands = /** @type {HTMLElement[]} */ ([$("gh"), $("clk")]);
/** @type {HTMLElement | null} */
let openIsland = null;
let signedOut = false;

/** @param {HTMLElement | null} el */
function setOpen(el) {
  if (el?.id === "gh" && signedOut) return bridge.setup(); // nothing to show until someone signs in
  if (el === openIsland) return;
  const prev = openIsland;
  openIsland = el;
  if (prev) {
    Motion.morph(prev, false);
    prev.setAttribute("aria-expanded", "false");
  }
  if (el) {
    Motion.morph(el, true);
    el.setAttribute("aria-expanded", "true");
    if (el.id === "gh") enterPage();
  }
  Sound.play(el ? "open" : "close");
}

for (const el of islands) {
  el.addEventListener("click", (e) => {
    if (/** @type {HTMLElement} */ (e.target).closest("form, .dots, .quit, .who, .accounts")) return;
    if (el.id === "gh" && signedOut) return bridge.setup();
    setOpen(el === openIsland ? null : el);
  });
}

for (const q of document.querySelectorAll(".quit")) {
  q.addEventListener("click", (e) => {
    e.stopPropagation();
    Sound.play("close");
    setTimeout(() => bridge.quit(), 220);
  });
}
document.addEventListener("keydown", (e) => {
  if (openIsland?.id !== "gh" || pickerOpen() || /** @type {HTMLElement} */ (e.target).closest("form")) return;
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  goPage(pageIndex + step);
});
document.addEventListener("contextmenu", (e) => {
  if (!(/** @type {HTMLElement} */ (e.target).closest(".island"))) return;
  e.preventDefault();
  bridge.menu();
});

for (const el of /** @type {HTMLElement[]} */ ([...document.querySelectorAll(".island")])) {
  el.addEventListener("pointerenter", () => {
    if (el !== openIsland) {
      Motion.press(el, 1.045);
      Sound.play("hover");
    }
  });
  el.addEventListener("pointerleave", () => Motion.press(el, 1));
  el.addEventListener("pointerdown", () => el !== openIsland && Motion.press(el, 0.96));
  el.addEventListener("pointerup", () => Motion.press(el, 1));
}

// Click-through everywhere except the islands themselves.
$("bar").addEventListener("pointermove", (e) => {
  bridge.hover(Boolean(/** @type {HTMLElement} */ (e.target).closest(".island")));
});
document.addEventListener("pointerleave", () => bridge.hover(false));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (pickerOpen()) closePicker();
  else setOpen(null);
});
bridge.on("collapse", () => {
  closePicker();
  setOpen(null);
});
bridge.on("open", (/** @type {string} */ id) => setOpen($(id)));

// ---------- contributions ----------
const pages = /** @type {HTMLElement[]} */ ([...document.querySelectorAll(".page")]);
let pageIndex = 0;

/** @param {number} i */
function goPage(i) {
  const next = (i + pages.length) % pages.length;
  if (next === pageIndex) return;
  const dir = next > pageIndex ? 1 : -1;
  pageIndex = next;
  Motion.page(pages, pageIndex, dir);
  document.querySelectorAll(".dots b").forEach((b, k) => b.classList.toggle("on", k === pageIndex));
  Sound.play("page");
  enterPage();
}

/** @type {string} */
let streakText = "";
const FOOTERS = [null, "Latest pushes", "Most commits this year", "This year at a glance"];

function enterPage() {
  $("streak").textContent = FOOTERS[pageIndex] ?? streakText;
  $("legend").style.visibility = pageIndex === 0 ? "visible" : "hidden";
  if (pageIndex === 1) Motion.grow([...document.querySelectorAll("#latest .bar-fill")], "scaleX");
  if (pageIndex === 2) Motion.grow([...document.querySelectorAll("#repos .bar-fill")], "scaleX");
  if (pageIndex === 3) Motion.grow([...document.querySelectorAll(".kind b")], "scale");
}

$("dots").addEventListener("click", (e) => {
  const go = /** @type {HTMLElement} */ (e.target).dataset.go;
  if (go !== undefined) goPage(Number(go));
});
let wheelLock = 0;
$("pages").addEventListener("wheel", (e) => {
  const now = Date.now();
  if (now - wheelLock < 450 || Math.abs(e.deltaY) + Math.abs(e.deltaX) < 8) return;
  wheelLock = now;
  goPage(pageIndex + Math.sign(e.deltaY || e.deltaX));
});
pages[0]?.classList.add("active");
document.querySelector(".dots b")?.classList.add("on");

const fmt = new Intl.NumberFormat("en");

/** @param {any} d */
function renderContributions(d) {
  currentLogin = d.login;
  $("name").textContent = d.name;
  setAvatar(d);
  $("total").textContent = `${fmt.format(d.total)} contributions in the last year`;
  streakText = `Current streak ${d.current} ${d.current === 1 ? "day" : "days"} · Longest ${d.longest} days`;
  if (pageIndex === 0) $("streak").textContent = streakText;
  $("chipStreak").textContent = `${d.current} day streak`;
  $("todayCount").textContent = String(d.today);

  const last7 = /** @type {{ level: number, count: number, date: string }[]} */ (d.days).slice(-7);
  $("week").innerHTML = last7
    .map((x) => `<i class="${x.level ? `l${x.level}` : ""}" title="${x.count} on ${x.date}"></i>`)
    .join("");

  const days = /** @type {{ date: string, count: number, level: number }[]} */ (d.days);
  $("grid").innerHTML = days
    .map((x) => `<i class="${x.level ? `l${x.level}` : ""}" title="${x.count} on ${x.date}"></i>`)
    .join("");
  const months = d.months.length ? d.months : labelsFor(days);
  $("months").innerHTML = months
    .map((/** @type {{label: string, col: number}} */ m) => `<span style="left:${m.col * 10.8}px">${m.label}</span>`)
    .join("");

  $("latest").innerHTML = (d.latest ?? [])
    .map(
      (/** @type {any} */ r) => `<div class="repo">
        <span class="nm">${esc(r.name.split("/")[1])}</span>
        <b class="tnum">${ago(r.pushedAt)}</b>
        <span class="meta"><i class="lang" style="background:${color(r.language?.color)}"></i>${esc(r.language?.name ?? "Other")}${r.private ? " · Private" : ""}</span>
        <span class="unit">${r.name.split("/")[0] === d.login ? "pushed" : r.name.split("/")[0]}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${freshness(r.pushedAt, d.latest)}%"></div></div>
      </div>`,
    )
    .join("");

  const top = Math.max(1, ...d.repos.map((/** @type {any} */ r) => r.commits));
  $("repos").innerHTML = d.repos
    .map(
      (/** @type {any} */ r) => `<div class="repo">
        <span class="nm">${esc(r.name.split("/")[1])}</span>
        <b class="tnum">${fmt.format(r.commits)}</b>
        <span class="meta"><i class="lang" style="background:${color(r.language?.color)}"></i>${esc(r.language?.name ?? "Other")}${r.private ? " · Private" : ""}</span>
        <span class="unit">commits</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(r.commits / top) * 100}%"></div></div>
      </div>`,
    )
    .join("");
  const k = d.kinds;
  $("kinds").innerHTML = [
    [k.commits, "Commits"],
    [k.pullRequests, "Pull requests"],
    [k.reviews, "Reviews"],
    [k.issues, "Issues"],
  ]
    .map(([n, label]) => `<div class="kind"><b class="tnum">${fmt.format(n)}</b><span>${label}</span></div>`)
    .join("");
}

/** @param {{ date: string }[]} days */
function labelsFor(days) {
  /** @type {{ label: string, col: number }[]} */
  const out = [];
  let last = -1;
  for (let i = 0; i < days.length; i += 7) {
    const m = Number(days[i]?.date.slice(5, 7)) - 1;
    if (m !== last && i / 7 < 50)
      out.push({ label: new Date(2000, m, 1).toLocaleString("en", { month: "short" }), col: i / 7 });
    last = m;
  }
  if (out.length > 1 && (out[1]?.col ?? 0) - (out[0]?.col ?? 0) < 3) out.shift();
  return out;
}

bridge.on("contributions", (/** @type {any} */ res) => {
  if (res.data) {
    signedOut = false;
    document.body.classList.remove("signed-out");
    renderContributions(res.data);
  } else if (res.error === "signin") {
    // nobody is signed in: no name, no graph, just an invitation
    signedOut = true;
    document.body.classList.add("signed-out");
    if (openIsland?.id === "gh") setOpen(null);
    streakText = "";
    for (const id of [
      "name",
      "av",
      "total",
      "grid",
      "months",
      "latest",
      "repos",
      "kinds",
      "week",
      "todayCount",
      "streak",
    ])
      $(id).replaceChildren();
    $("av").classList.remove("has-img");
    shownAvatar = null;
    clearTimeout(avatarRetry);
    $("chipStreak").textContent = "Connect GitHub";
  } else if (!$("grid").childElementCount) {
    $("chipStreak").textContent = "Offline";
  }
});

// ---------- clock ----------
let offset = 0;
/** @type {[string, string][]} */
let cities = [];
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

bridge.on("time", (/** @type {any} */ t) => {
  if (t.error) {
    $("syncDot").classList.add("off");
    $("syncTxt").textContent = "Using this PC's clock · atomic time unreachable";
    return;
  }
  offset = t.offset;
  $("syncDot").classList.remove("off");
  $("syncTxt").title = `Synced with ${t.host}`;
  const ms = Math.abs(t.offset);
  $("syncTxt").textContent =
    `Atomic time · ${ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(1)} s`} correction`;
});

/** @param {Date} d @param {string} tz @param {Intl.DateTimeFormatOptions} [o] */
const timeIn = (d, tz, o = {}) =>
  d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", ...o });

/** Hours between a zone and local time, from their wall clocks. @param {Date} d @param {string} tz */
function hoursFromLocal(d, tz) {
  const wall = (/** @type {string} */ z) => new Date(d.toLocaleString("en-US", { timeZone: z })).getTime();
  return Math.round(((wall(tz) - wall(localTz)) / 36e5) * 4) / 4;
}

function tick() {
  const now = new Date(Date.now() + offset);
  const full = timeIn(now, localTz, { second: "2-digit" });
  const zone = now.toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop() ?? "";
  $("chipTime").textContent = full;
  $("chipZone").textContent = zone;
  const [hms, ampm] = full.split(" ");
  $("bigTime").textContent = hms ?? "";
  $("bigMeta").textContent = `${ampm} ${zone}`;

  if (openIsland?.id === "clk" || !$("cities").childElementCount) {
    $("cities").innerHTML = cities
      .map(([city, tz]) => {
        const h = hoursFromLocal(now, tz);
        const rel = h === 0 ? "Same time" : `${Math.abs(h)} h ${h > 0 ? "ahead" : "behind"}`;
        const hour = Number(now.toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }));
        const night = hour < 6 || hour >= 21;
        return `<div class="city"><div>${city}<span>${rel}${night ? " · night" : ""}</span></div><b class="tnum${night ? " night" : ""}">${timeIn(now, tz)}</b></div>`;
      })
      .join("");
  }
  setTimeout(tick, 1000 - ((Date.now() + offset) % 1000) + 5);
}

// ---------- boot ----------
bridge.init().then((/** @type {any} */ s) => {
  Sound.setEnabled(s.sound);
  cities = s.cities;

  const shot = new URLSearchParams(location.search).get("shot");
  if (shot) setTimeout(() => setOpen($(shot)), 600);
  const page = Number(new URLSearchParams(location.search).get("page") ?? 0);
  if (page) setTimeout(() => goPage(page), 1200);
});
bridge.on("settings", (/** @type {any} */ s) => {
  Sound.setEnabled(s.sound);
  cities = s.cities;
});

for (const el of /** @type {HTMLElement[]} */ ([...document.querySelectorAll(".island[role=button]")])) {
  el.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target === el) {
      e.preventDefault();
      el.click();
    }
  });
}
if (new URLSearchParams(location.search).get("shot"))
  document.body.style.background = "linear-gradient(#4f93db, #9cc6ee)";

/** @type {string | null} the photo URL currently on screen */
let shownAvatar = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let avatarRetry;

/**
 * Profile photo when GitHub gives one; the initial is only the fallback. A refresh never wipes a
 * photo that's already showing, and a photo that fails to load (asleep, offline) is retried.
 * @param {any} d @param {number} [attempt]
 */
function setAvatar(d, attempt = 0) {
  const av = $("av");
  clearTimeout(avatarRetry);
  if (!d.avatar) {
    shownAvatar = null;
    av.classList.remove("has-img");
    av.textContent = d.name.charAt(0).toUpperCase();
    return;
  }
  if (d.avatar === shownAvatar && av.classList.contains("has-img")) return;
  if (!av.classList.contains("has-img")) av.textContent = d.name.charAt(0).toUpperCase();
  const img = new Image();
  img.alt = "";
  img.onload = () => {
    if (signedOut) return;
    shownAvatar = d.avatar;
    av.replaceChildren(img);
    av.classList.add("has-img");
  };
  img.onerror = () => {
    if (attempt < 5) avatarRetry = setTimeout(() => setAvatar(d, attempt + 1), 5000 * 2 ** attempt);
  };
  img.src = d.avatar;
}

tick();
Motion.intro([...document.querySelectorAll(".island")]);

/** "just now", "3h ago", "2d ago", or a date for anything older than a month. @param {string} iso */
function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

/** Bar length for a push: the newest is full, older ones shrink with age. @param {string} iso @param {{ pushedAt: string }[]} all */
function freshness(iso, all) {
  const age = (/** @type {string} */ t) => Date.now() - new Date(t).getTime();
  const oldest = Math.max(1, ...all.map((r) => age(r.pushedAt)));
  return Math.round(Math.max(0.08, 1 - age(iso) / (oldest * 1.15)) * 100);
}

// Website demo: outline the islands against the page and open the year after a beat.
if (new URLSearchParams(location.search).has("demo")) {
  document.body.classList.add("demo");
  setTimeout(() => !openIsland && setOpen($("gh")), 900);
}

/** Repo and language names come from the network; keep them as text. @param {string} s */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
/** @param {string | undefined} c */
function color(c) {
  return /^#[0-9a-f]{3,8}$/i.test(c ?? "") ? c : "#8e8e93";
}

// ---------- account picker ----------
// The photo opens a list of every account on this PC. Picking one pins it here only.

/** @type {string | null} login on screen now */
let currentLogin = null;
const pickerOpen = () => !$("accounts").hidden && !$("accounts").classList.contains("closing");

const avatarOf = (/** @type {string} */ login) =>
  `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=64`;

/** @param {string} login @param {number} i */
function accountRow(login, i) {
  const row = document.createElement("div");
  row.className = "acct";
  row.setAttribute("role", "menuitemradio");
  row.setAttribute("aria-checked", String(login === currentLogin));
  row.tabIndex = 0;
  row.style.setProperty("--i", String(i));
  const img = new Image();
  img.alt = "";
  img.src = avatarOf(login);
  const name = document.createElement("span");
  name.className = "login";
  name.textContent = login;
  row.append(img, name);
  if (login === currentLogin) {
    const tag = document.createElement("small");
    tag.textContent = "Viewing";
    row.append(tag);
  }
  row.addEventListener("click", () => pick(login));
  return row;
}

function addRow(/** @type {number} */ i) {
  const row = document.createElement("div");
  row.className = "acct";
  row.setAttribute("role", "menuitem");
  row.tabIndex = 0;
  row.style.setProperty("--i", String(i));
  const plus = document.createElement("span");
  plus.className = "plus";
  plus.textContent = "+";
  const label = document.createElement("span");
  label.className = "login";
  label.textContent = "Add account";
  row.append(plus, label);
  row.addEventListener("click", () => {
    closePicker();
    bridge.setup();
  });
  return row;
}

async function openPicker() {
  const box = $("accounts");
  box.classList.remove("closing");
  box.replaceChildren();
  box.hidden = false;
  $("who").setAttribute("aria-expanded", "true");
  Sound.play("open");
  const logins = /** @type {string[]} */ ((await bridge.accounts?.()) ?? []);
  if (!pickerOpen()) return;
  const rows = logins.map(accountRow);
  if (!rows.length) {
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = "No other accounts on this PC yet.";
    rows.push(note);
  }
  box.replaceChildren(...rows, document.createElement("hr"), addRow(rows.length));
  /** @type {HTMLElement | null} */ (box.querySelector('[aria-checked="true"]') ?? box.querySelector(".acct"))?.focus();
}

function closePicker() {
  const box = $("accounts");
  if (box.hidden) return;
  $("who").setAttribute("aria-expanded", "false");
  box.classList.add("closing");
  setTimeout(() => {
    if (box.classList.contains("closing")) box.hidden = true;
  }, 140);
}

function pick(/** @type {string} */ login) {
  closePicker();
  if (login === currentLogin) return;
  Sound.play("hover");
  bridge.view?.(login);
}

$("who").addEventListener("click", (e) => {
  e.stopPropagation();
  if (signedOut) return;
  pickerOpen() ? closePicker() : openPicker();
});
$("who").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  pickerOpen() ? closePicker() : openPicker();
});
$("accounts").addEventListener("keydown", (e) => {
  const rows = /** @type {HTMLElement[]} */ ([...$("accounts").querySelectorAll(".acct")]);
  const at = rows.indexOf(/** @type {HTMLElement} */ (document.activeElement));
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    rows[(at + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length]?.focus();
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    rows[at]?.click();
  }
});
document.addEventListener("pointerdown", (e) => {
  if (pickerOpen() && !(/** @type {HTMLElement} */ (e.target).closest(".accounts, .who"))) closePicker();
});
