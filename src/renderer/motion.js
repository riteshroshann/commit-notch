// Spring physics baked into CSS linear() easings, so WAAPI runs real springs on the compositor.
const Motion = (() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /**
   * Simulate a damped spring from 0 to 1 and sample it.
   * @param {number} stiffness @param {number} damping @param {number} mass
   */
  function spring(stiffness = 260, damping = 22, mass = 1) {
    const dt = 1 / 120;
    let x = 0;
    let v = 0;
    const pts = [];
    let t = 0;
    let settled = 0;
    while (t < 2 && settled < 12) {
      const a = (-stiffness * (x - 1) - damping * v) / mass;
      v += a * dt;
      x += v * dt;
      t += dt;
      pts.push(x);
      settled = Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01 ? settled + 1 : 0;
    }
    const step = Math.max(1, Math.floor(pts.length / 60));
    const sampled = pts.filter((_, i) => i % step === 0);
    sampled[sampled.length - 1] = 1;
    return { easing: `linear(0, ${sampled.map((p) => p.toFixed(4)).join(", ")})`, duration: Math.round(t * 1000) };
  }

  const bouncy = spring(300, 21);
  const snappy = spring(420, 34);
  const soft = spring(180, 24);

  /**
   * Morph an island between its chip and its panel.
   * @param {HTMLElement} el @param {boolean} open
   */
  function morph(el, open) {
    const from = el.getBoundingClientRect();
    const fromRadius = getComputedStyle(el).borderBottomLeftRadius;
    const outgoing = /** @type {HTMLElement} */ (el.querySelector(open ? ".chip" : ".full"));
    const incoming = /** @type {HTMLElement} */ (el.querySelector(open ? ".full" : ".chip"));
    el.getAnimations().forEach((a) => a.cancel());
    el.querySelectorAll(".layer").forEach((l) => {
      l.getAnimations().forEach((a) => a.cancel());
      l.classList.remove("ghost");
    });

    el.classList.toggle("open", open);
    const to = el.getBoundingClientRect();
    const toRadius = getComputedStyle(el).borderBottomLeftRadius;
    if (reduced) return;

    const s = open ? bouncy : snappy;
    el.animate(
      [
        {
          width: `${from.width}px`,
          height: `${from.height}px`,
          borderBottomLeftRadius: fromRadius,
          borderBottomRightRadius: fromRadius,
        },
        {
          width: `${to.width}px`,
          height: `${to.height}px`,
          borderBottomLeftRadius: toRadius,
          borderBottomRightRadius: toRadius,
        },
      ],
      { duration: s.duration, easing: s.easing },
    );

    outgoing.classList.add("ghost");
    outgoing
      .animate(
        [
          { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
          { opacity: 0, filter: "blur(6px)", transform: `scale(${open ? 1.08 : 0.94})` },
        ],
        { duration: 160, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
      )
      .finished.then(() => outgoing.classList.remove("ghost"))
      .catch(() => {});

    incoming.animate(
      [
        { opacity: 0, filter: "blur(10px)", transform: `scale(${open ? 0.92 : 1.06}) translateY(${open ? -8 : 0}px)` },
        { opacity: 1, filter: "blur(0px)", transform: "scale(1) translateY(0)" },
      ],
      { duration: soft.duration, easing: soft.easing, delay: open ? 70 : 40, fill: "backwards" },
    );

    if (open) stagger(incoming);
  }

  /** Children of an opening panel arrive one after another. */
  function stagger(root) {
    const items = root.querySelectorAll(".head, .pages, .foot, .dots, .big, .sync, .city");
    items.forEach((n, i) =>
      n.animate(
        [
          { opacity: 0, transform: "translateY(-6px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: soft.duration, easing: soft.easing, delay: 110 + i * 35, fill: "backwards" },
      ),
    );
  }

  /** @param {HTMLElement} el @param {number} scale */
  function press(el, scale) {
    if (reduced) return;
    el.animate(
      [
        { transform: getComputedStyle(el).transform === "none" ? "scale(1)" : getComputedStyle(el).transform },
        { transform: `scale(${scale})` },
      ],
      {
        duration: bouncy.duration,
        easing: bouncy.easing,
        fill: "forwards",
        composite: "replace",
      },
    );
  }

  /** Slide between panel pages. @param {HTMLElement[]} pages @param {number} index @param {number} dir */
  function page(pages, index, dir) {
    pages.forEach((p, i) => {
      const active = i === index;
      p.style.visibility = "visible";
      const a = p.animate(
        active
          ? [
              { opacity: 0, transform: `translateX(${dir * 40}px)`, filter: "blur(4px)" },
              { opacity: 1, transform: "none", filter: "blur(0)" },
            ]
          : [
              { opacity: Number(getComputedStyle(p).opacity) },
              { opacity: 0, transform: `translateX(${-dir * 40}px)`, filter: "blur(4px)" },
            ],
        { duration: reduced ? 0 : soft.duration, easing: soft.easing, fill: "forwards" },
      );
      if (!active) a.finished.then(() => (p.style.visibility = "hidden")).catch(() => {});
    });
  }

  /** Grow bars or cells in from nothing. @param {Element[]} nodes @param {string} prop */
  function grow(nodes, prop) {
    if (reduced) return;
    nodes.forEach((n, i) =>
      n.animate([{ transform: `${prop}(0)` }, { transform: `${prop}(1)` }], {
        duration: bouncy.duration,
        easing: bouncy.easing,
        delay: 120 + i * 40,
        fill: "backwards",
      }),
    );
  }

  return { morph, press, page, grow, spring };
})();
