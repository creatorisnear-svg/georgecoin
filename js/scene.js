// The illustration: George, the plate, and the pancake stack.
// app.js decides when pancakes arrive; this file only draws them.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const INK = "#2E1B0E";
  const SYRUP = "#8E4416";

  const BASE_W = 600;
  const BASE_H = 800;
  const PLATE_X = 405;
  const PLATE_Y = 640;
  const MAX_ZOOM = 2.6;
  const TOP_MARGIN = 95;
  const HAT_TOP = 236;
  const CEILING = -712;
  const CAP_TOP = BASE_H - BASE_H * MAX_ZOOM + 60;
  const FALL_MS = 720;

  // one pancake per buy; the size follows the order size
  const SIZES = {
    silver: { rx: 64, h: 7, top: "#F3BE62", side: "#CF8235" },
    butter: { rx: 78, h: 9, top: "#EFB255", side: "#C97A2F" },
    fluffy: { rx: 86, h: 12, top: "#ECAA4C", side: "#C2722A" },
    big: { rx: 95, h: 15, top: "#E6A044", side: "#B66626" },
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let svg, stackLayer, fxLayer, toppings, pupils, eyes, brows, monkeyParts;
  const st = {
    top: PLATE_Y - 3,
    count: 0,
    lastX: PLATE_X,
    topRx: 0,
    topX: PLATE_X,
    zoom: 1,
    zoomTarget: 1,
    sunday: false,
    raf: 0,
    onLand: null,
  };

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function pancakeEl(cx, ty, s, opts) {
    const rx = s.rx;
    const ry = rx * 0.17;
    const g = el("g", { class: "pc" });
    el("path", {
      d: `M${cx - rx} ${ty}v${s.h}a${rx} ${ry} 0 0 0 ${2 * rx} 0v${-s.h}a${rx} ${ry} 0 0 1 ${-2 * rx} 0z`,
      fill: s.side, stroke: INK, "stroke-width": 3.5, "stroke-linejoin": "round",
    }, g);
    el("path", {
      d: `M${cx - rx + 8} ${ty + s.h * 0.55 + ry * 0.5}q${rx - 8} ${ry * 0.9} ${2 * rx - 16} 0`,
      fill: "none", stroke: "#E2A04E", "stroke-width": 2, "stroke-linecap": "round", opacity: 0.7,
    }, g);
    el("ellipse", { cx, cy: ty, rx, ry, fill: s.top, stroke: INK, "stroke-width": 3.5 }, g);
    // a few browned spots so they look cooked
    for (let i = 0; i < 3; i++) {
      el("ellipse", {
        cx: cx + rand(-rx * 0.55, rx * 0.55), cy: ty + rand(-ry * 0.4, ry * 0.4),
        rx: rand(5, 11), ry: rand(1.6, 3), fill: "#D58E3E", opacity: 0.55,
      }, g);
    }
    if (opts && opts.mine) {
      const fx = cx + rx * 0.45;
      el("path", { d: `M${fx} ${ty}v-46`, stroke: INK, "stroke-width": 3, "stroke-linecap": "round" }, g);
      el("path", { d: `M${fx} ${ty - 46}l34 9-34 9z`, fill: "#F2C14E", stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" }, g);
    }
    return g;
  }

  function nextX() {
    const x = PLATE_X + (st.lastX - PLATE_X) * 0.5 + rand(-5, 5);
    st.lastX = x;
    return x;
  }

  // ---------- butter and syrup ride on the top pancake ----------

  function drawToppings() {
    toppings.textContent = "";
    if (st.count === 0) return;
    const rx = st.topRx;
    const ry = rx * 0.17;
    const g = el("g", { transform: `translate(${st.topX} ${st.top})` }, toppings);

    const drips = st.sunday
      ? [[-0.55, 30], [-0.2, 44], [0.12, 24], [0.42, 38]]
      : [[-0.3, 22], [0.25, 30]];
    for (const [fxr, len] of drips) {
      const x = rx * fxr;
      const yEdge = ry * Math.sqrt(Math.max(0, 1 - fxr * fxr));
      el("path", {
        d: `M${x - 5} ${yEdge - 4}v${len}q5 9 10 0v${-len}z`,
        fill: SYRUP, stroke: INK, "stroke-width": 2.5, "stroke-linejoin": "round",
      }, g);
    }
    const pr = st.sunday ? 0.78 : 0.6;
    el("ellipse", { cx: -4, cy: 1, rx: rx * pr, ry: ry * pr, fill: SYRUP, stroke: INK, "stroke-width": 2.5 }, g);
    el("ellipse", { cx: -rx * 0.25, cy: -ry * 0.15, rx: rx * 0.16, ry: ry * 0.18, fill: "#FFF1D6", opacity: 0.35 }, g);

    // butter pat
    el("path", { d: "M-16 -3l20-7 18 6-20 7z", fill: "#FCE7A2", stroke: INK, "stroke-width": 2.5, "stroke-linejoin": "round" }, g);
    el("path", { d: "M-16 -3l18 6v8l-18-6z", fill: "#F2CF6B", stroke: INK, "stroke-width": 2.5, "stroke-linejoin": "round" }, g);
    el("path", { d: "M2 3l20-7v8l-20 7z", fill: "#E6BB52", stroke: INK, "stroke-width": 2.5, "stroke-linejoin": "round" }, g);
  }

  // ---------- camera ----------

  function updateZoomTarget() {
    const neededTop = st.top - TOP_MARGIN;
    st.zoomTarget = Math.min(MAX_ZOOM, Math.max(1, (BASE_H - neededTop) / BASE_H));
    if (!st.raf) st.raf = requestAnimationFrame(tick);
  }

  function applyView(z) {
    const h = BASE_H * z;
    const w = BASE_W * z;
    svg.setAttribute("viewBox", `${(BASE_W / 2 - w / 2).toFixed(2)} ${(BASE_H - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
  }

  function tick() {
    const diff = st.zoomTarget - st.zoom;
    if (Math.abs(diff) < 0.002 || reduceMotion) {
      st.zoom = st.zoomTarget;
      applyView(st.zoom);
      st.raf = 0;
      return;
    }
    st.zoom += diff * 0.07;
    applyView(st.zoom);
    st.raf = requestAnimationFrame(tick);
  }

  function viewTop() { return BASE_H - BASE_H * st.zoomTarget; }

  // ---------- George ----------

  function look(x, y) {
    const centers = [[162, 398], [208, 398]];
    pupils.forEach((p, i) => {
      const dx = x - centers[i][0];
      const dy = y - centers[i][1];
      const len = Math.hypot(dx, dy) || 1;
      const off = Math.min(7, len);
      p.style.transform = `translate(${(dx / len * off).toFixed(2)}px, ${(dy / len * off * 0.85).toFixed(2)}px)`;
    });
  }

  function lookAtStack() { look(st.topX, st.top); }

  function hop() {
    if (reduceMotion) return;
    const frames = [{ transform: "translateY(0)" }, { transform: "translateY(-11px)" }, { transform: "translateY(0)" }];
    monkeyParts.forEach((m) => m.animate(frames, { duration: 300, easing: "ease-out" }));
    brows.animate([{ transform: "translateY(0)" }, { transform: "translateY(-7px)" }, { transform: "translateY(0)" }], { duration: 520, easing: "ease-out" });
  }

  function blinkLoop() {
    setTimeout(() => {
      if (!reduceMotion && !document.hidden) {
        eyes.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(.08)" }, { transform: "scaleY(1)" }], { duration: 190 });
      }
      blinkLoop();
    }, rand(2400, 6200));
  }

  function floatLabel(text, x, y) {
    if (!text) return;
    const size = 21 * st.zoomTarget;
    const t = el("text", { x, y, "text-anchor": "middle", class: "fx-label", style: `font-size:${size}px;stroke-width:${5 * st.zoomTarget}px` }, fxLayer);
    t.textContent = text;
    const a = t.animate(
      [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-46 * st.zoomTarget}px)`, opacity: 0 }],
      { duration: 1500, easing: "ease-out" }
    );
    a.onfinish = () => t.remove();
  }

  function updateCeiling() {
    const broken = st.top < CEILING;
    document.getElementById("beamWhole").toggleAttribute("hidden", broken);
    document.getElementById("beamBroken").toggleAttribute("hidden", !broken);
  }

  // ---------- adding pancakes ----------

  function settle(cx, s) {
    st.topX = cx;
    st.topRx = s.rx;
    drawToppings();
    updateCeiling();
  }

  // Place a pancake with no animation (used to fill the plate on page load).
  function place(p) {
    st.count++;
    const s = SIZES[p.size] || SIZES.butter;
    const ty = st.top - s.h;
    if (ty < CAP_TOP) return false;
    const cx = nextX();
    st.top = ty;
    stackLayer.appendChild(pancakeEl(cx, ty, s, p));
    st.topX = cx;
    st.topRx = s.rx;
    return true;
  }

  function placeMany(list) {
    for (const p of list) place(p);
    drawToppings();
    updateCeiling();
    updateZoomTarget();
    lookAtStack();
  }

  // Drop one pancake from above. Resolves when it lands.
  function drop(p) {
    st.count++;
    const s = SIZES[p.size] || SIZES.butter;
    let ty = st.top - s.h;
    const capped = ty < CAP_TOP;
    const cx = capped ? st.topX : nextX();
    if (capped) ty = st.top - s.h; else st.top = ty;
    updateZoomTarget();

    const g = pancakeEl(cx, ty, s, p);
    g.style.transformBox = "fill-box";
    g.style.transformOrigin = "50% 100%";
    fxLayer.appendChild(g);

    const fall = ty - viewTop() + s.h + 80;
    look(cx, viewTop() + 60);
    setTimeout(() => look(cx, ty), FALL_MS * 0.45);

    const finish = () => {
      if (capped) {
        const fade = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260 });
        fade.onfinish = () => g.remove();
      } else {
        stackLayer.appendChild(g);
        settle(cx, s);
      }
      floatLabel(p.label, cx, ty - (s.rx * 0.17 + 16) * st.zoomTarget);
      hop();
      lookAtStack();
      if (st.onLand) st.onLand(p);
    };

    if (reduceMotion) {
      finish();
      return Promise.resolve();
    }
    const anim = g.animate([
      { transform: `translateY(${-fall}px)`, easing: "cubic-bezier(.55,0,1,.5)" },
      { transform: "translateY(0)", offset: 0.74 },
      { transform: "translateY(0) scale(1.08,.74)", offset: 0.86 },
      { transform: "translateY(0) scale(1,1)" },
    ], { duration: FALL_MS });
    return new Promise((resolve) => {
      anim.onfinish = () => { finish(); resolve(); };
    });
  }

  // ---------- calendar and captions ----------

  // d = day of week (0 is Sunday), dateNum = day of the month
  function setDay(d, dateNum) {
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    st.sunday = d === 0;
    document.getElementById("calDay").textContent = days[d];
    document.getElementById("calDate").textContent = String(dateNum);
    document.getElementById("calRing").toggleAttribute("hidden", d !== 0);
    const left = (7 - d) % 7;
    document.getElementById("calNote").textContent =
      d === 0 ? "pancake day!" : left === 1 ? "1 day to Sunday" : `${left} days to Sunday`;
    drawToppings();
  }

  function caption(name) {
    const n = st.count;
    if (n === 0) return `The plate is empty. ${name} is waiting, fork up.`;
    if (n === 1) return `One pancake. ${name} is pretending to be patient.`;
    if (n < 6) return "A short stack. Not even close to enough.";
    if (st.top > HAT_TOP) return `A proper breakfast. ${name} wants more.`;
    if (st.top > -60) return `The stack is taller than ${name}'s hat.`;
    if (st.top > -380) return "Taller than the whole kitchen wall. The neighbors are taking pictures.";
    if (st.top > CEILING) return `Almost at the ceiling. ${name} has not blinked once.`;
    if (st.top - 16 > CAP_TOP) return `It went through the ceiling. ${name} is thrilled.`;
    return "It's still going up. Somebody call the roof guy.";
  }

  function init(svgEl) {
    svg = svgEl;
    stackLayer = svg.querySelector("#stack");
    fxLayer = svg.querySelector("#fx");
    toppings = svg.querySelector("#toppings");
    eyes = svg.querySelector("#eyes");
    brows = svg.querySelector("#brows");
    pupils = [svg.querySelector("#pupilL"), svg.querySelector("#pupilR")];
    monkeyParts = [svg.querySelector("#monkeyBack"), svg.querySelector("#monkeyFront")];
    eyes.style.transformOrigin = "50% 50%";
    brows.style.transformOrigin = "50% 50%";
    applyView(1);
    lookAtStack();
    blinkLoop();
  }

  window.Scene = {
    init,
    drop,
    placeMany,
    setDay,
    caption,
    get count() { return st.count; },
    set onLand(fn) { st.onLand = fn; },
    sizeFor(sol) {
      if (!(sol > 0)) return "butter";
      if (sol < 0.25) return "silver";
      if (sol < 1) return "butter";
      if (sol < 5) return "fluffy";
      return "big";
    },
  };
})();
