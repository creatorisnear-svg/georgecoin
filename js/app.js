// Watches the chain for buys and turns each one into a pancake.
//
// Where the buys come from (no API keys needed, everything runs in the visitor's browser):
//   DexScreener  -> how many buys happened in the last 24 hours (the starting stack) + market stats
//   GeckoTerminal -> the actual trades, so each new buy drops a pancake sized by its SOL amount
//   Jupiter swap box -> buys made on this page land right away with a flag on them
(function () {
  const C = window.STACK_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const NAME = C.name || "George";
  const SITE = C.site || "Georgecoin.fun";
  const TZ = C.timezone || "America/Phoenix";
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // today's date in the kitchen's time zone, so every visitor sees the same day and the same coin
  function kitchenToday() {
    const parts = {};
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
        .formatToParts(new Date())
        .forEach((p) => { parts[p.type] = p.value; });
    } catch (e) {
      const d = new Date();
      parts.year = String(d.getFullYear());
      parts.month = String(d.getMonth() + 1).padStart(2, "0");
      parts.day = String(d.getDate()).padStart(2, "0");
      parts.weekday = DAY_KEYS[d.getDay()];
    }
    return {
      iso: `${parts.year}-${parts.month}-${parts.day}`,
      dow: DAY_KEYS.indexOf(parts.weekday),
      y: Number(parts.year), m: Number(parts.month), d: Number(parts.day),
    };
  }
  const TODAY = kitchenToday();

  // a new coin every day: the plate follows the newest launch that is live
  const LAUNCHES = (C.launches || [])
    .filter((l) => l && l.date && l.ticker)
    .map((l) => ({ date: String(l.date), ticker: String(l.ticker).replace(/^\$/, ""), contract: String(l.contract || "").trim() }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const current = params.get("ca")
    ? { date: TODAY.iso, ticker: params.get("ticker") || "TEST", contract: params.get("ca").trim() }
    : [...LAUNCHES].reverse().find((l) => l.date <= TODAY.iso && l.contract) || null;
  const named = current || LAUNCHES.find((l) => l.date === TODAY.iso) || [...LAUNCHES].reverse().find((l) => l.date <= TODAY.iso) || LAUNCHES[0];
  const CA = current ? current.contract : "";
  const TICKER = "$" + (named ? named.ticker : "STACK");
  const DEMO = params.has("demo")
    ? params.get("demo") !== "0"
    : C.demo === true || (C.demo !== false && !CA);

  const DEX_EVERY = 15000;
  const TRADES_EVERY = 12000;
  const SIZE_NAMES = { silver: "Silver dollar", butter: "Buttermilk", fluffy: "Fluffy", big: "The Big One" };

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- names everywhere ----------

  document.querySelectorAll("[data-name]").forEach((n) => { n.textContent = NAME; });
  document.querySelectorAll("[data-ticker]").forEach((n) => { n.textContent = TICKER; });
  document.querySelectorAll("[data-site]").forEach((n) => { n.textContent = SITE; });
  document.title = `${SITE} · Sunday is pancake day`;

  Scene.init($("scene"));

  // ---------- what day is it ----------

  const DAYLINES = [
    "It's Sunday. Pancake day is on.",
    `It's Monday. Pancake day is over. ${NAME} is still hungry.`,
    `It's Tuesday. The plate is out. Feed ${NAME}.`,
    "It's Wednesday. Halfway to pancake day.",
    `It's Thursday. ${NAME} can smell Sunday from here.`,
    "It's Friday. Two more sleeps till pancake day.",
    "It's Saturday. Pancake day is tomorrow.",
  ];

  function isoPlus(days) {
    const t = new Date(Date.UTC(TODAY.y, TODAY.m - 1, TODAY.d + days));
    return t.toISOString().slice(0, 10);
  }

  function setDay() {
    const d = TODAY.dow;
    Scene.setDay(d, TODAY.d);
    $("dayline").textContent = DAYLINES[d];
    $("sundayBar").hidden = d !== 0;
    const todayIdx = d === 0 ? 7 : d;
    document.querySelectorAll("#week li").forEach((li) => {
      const ld = Number(li.dataset.day);
      const idx = ld === 0 ? 7 : ld;
      li.classList.toggle("today", idx === todayIdx);
      li.classList.toggle("past", idx < todayIdx);
      if (idx === todayIdx) li.setAttribute("aria-current", "date"); else li.removeAttribute("aria-current");
      // that day's coin, if there is one
      const slot = li.querySelector(".wk-ticker");
      const launch = LAUNCHES.find((l) => l.date === isoPlus(idx - todayIdx));
      slot.textContent = "";
      if (!launch) return;
      if (launch.contract) {
        const a = document.createElement("a");
        a.href = `https://dexscreener.com/solana/${launch.contract}`;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "$" + launch.ticker;
        slot.append(a);
      } else {
        slot.textContent = "$" + launch.ticker;
      }
    });
  }
  setDay();
  // new day in the kitchen means a new coin: start fresh
  setInterval(() => { if (kitchenToday().iso !== TODAY.iso) location.reload(); }, 60000);

  // ---------- counter and caption ----------

  let landed = 0;

  function renderCount(bump) {
    const n = $("countNum");
    n.textContent = landed.toLocaleString("en-US");
    if (bump) {
      n.classList.remove("bump");
      void n.offsetWidth;
      n.classList.add("bump");
    }
  }

  function updateCaption() { $("caption").textContent = Scene.caption(NAME); }

  // ---------- sound (off until someone turns it on) ----------

  let audio = null;
  let soundOn = false;
  let lastPlop = 0;

  function plop(size) {
    if (!soundOn || !audio) return;
    const now = performance.now();
    if (now - lastPlop < 70) return;
    lastPlop = now;
    const t = audio.currentTime;
    const o = audio.createOscillator();
    const g = audio.createGain();
    const f = { silver: 560, butter: 440, fluffy: 340, big: 250 }[size] || 420;
    o.type = "sine";
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.42, t + 0.13);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + 0.22);
  }

  $("soundBtn").addEventListener("click", () => {
    soundOn = !soundOn;
    if (soundOn && !audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audio = new Ctx();
    }
    if (audio && audio.state === "suspended") audio.resume();
    $("soundBtn").textContent = soundOn ? "Sound on" : "Sound off";
    $("soundBtn").setAttribute("aria-pressed", String(soundOn));
    if (soundOn) plop("butter");
  });

  // ---------- the pancake line ----------

  const queue = [];
  let pumping = false;
  let lastDrop = Promise.resolve();

  Scene.onLand = (p) => {
    landed++;
    renderCount(true);
    updateCaption();
    plop(p.size);
  };

  function enqueue(p) {
    queue.push(p);
    pump();
  }

  async function pump() {
    if (pumping) return;
    pumping = true;
    while (queue.length) {
      // a pile-up (tab was in the background, or a burst of buys): place most of them instantly
      if (document.hidden || queue.length > 14) {
        await Promise.race([lastDrop, sleep(1500)]);
        const keep = document.hidden ? 0 : 4;
        const batch = queue.splice(0, queue.length - keep);
        Scene.placeMany(batch);
        landed += batch.length;
        renderCount(true);
        updateCaption();
        continue;
      }
      const p = queue.shift();
      lastDrop = Scene.drop(p);
      await sleep(p.intro ? 110 : queue.length > 5 ? 140 : 300);
    }
    pumping = false;
  }

  function randomSize() {
    const r = Math.random();
    return r < 0.35 ? "silver" : r < 0.75 ? "butter" : r < 0.95 ? "fluffy" : "big";
  }

  // fill the plate on page load: most of it instantly, the last dozen drop in
  function fillInitial(n) {
    const list = Array.from({ length: n }, () => ({ size: randomSize() }));
    const dropCount = Math.min(12, n);
    const instant = list.slice(0, n - dropCount);
    if (instant.length) {
      Scene.placeMany(instant);
      landed += instant.length;
      renderCount(false);
    }
    list.slice(n - dropCount).forEach((p) => { p.intro = true; enqueue(p); });
    updateCaption();
  }

  // ---------- order tickets ----------

  const ticketList = $("tickets");
  const MAX_TICKETS = 8;

  function short(addr) {
    return addr && addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr || "someone";
  }

  function ago(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  function addTicket(t, fresh) {
    const empty = ticketList.querySelector(".ticket-empty");
    if (empty) empty.remove();
    const li = document.createElement("li");
    const card = document.createElement(t.tx ? "a" : "div");
    card.className = "ticket" + (fresh ? " new" : "") + (t.size === "big" ? " big" : "") + (t.mine ? " mine" : "");
    if (t.tx) {
      card.href = `https://solscan.io/tx/${t.tx}`;
      card.target = "_blank";
      card.rel = "noopener";
    }
    const no = document.createElement("span");
    no.className = "ticket-no";
    no.textContent = `#${String(t.no).padStart(4, "0")}`;
    const what = document.createElement("span");
    what.className = "ticket-what";
    const b = document.createElement("b");
    b.textContent = SIZE_NAMES[t.size] || "Buttermilk";
    what.append(b, t.mine ? ", yours" : "");
    const sol = document.createElement("span");
    sol.className = "ticket-sol";
    sol.textContent = t.sol > 0 ? `${t.sol < 0.01 ? t.sol.toFixed(4) : t.sol.toFixed(2)} SOL` : "";
    const who = document.createElement("span");
    who.className = "ticket-who";
    who.textContent = t.mine ? "ordered on this page" : `ordered by ${short(t.wallet)}`;
    const when = document.createElement("span");
    when.className = "ticket-when";
    when.dataset.time = String(t.time || Date.now());
    when.textContent = ago(t.time || Date.now());
    card.append(no, what, sol, who, when);
    li.append(card);
    if (fresh) ticketList.prepend(li); else ticketList.append(li);
    while (ticketList.children.length > MAX_TICKETS) ticketList.lastElementChild.remove();
  }

  setInterval(() => {
    ticketList.querySelectorAll(".ticket-when").forEach((w) => { w.textContent = ago(Number(w.dataset.time)); });
  }, 5000);

  function setLive(state, text) {
    const n = $("liveState");
    n.className = "live" + (state ? " " + state : "");
    n.textContent = text;
  }

  // ---------- toast ----------

  let toastTimer = 0;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- contract box, links ----------

  async function copyCa() {
    if (!CA) { toast("The contract gets posted here at launch"); return; }
    try {
      await navigator.clipboard.writeText(CA);
      toast("Contract copied");
    } catch (e) {
      toast(CA);
    }
  }
  $("copyCa").addEventListener("click", copyCa);
  $("caBox").addEventListener("click", copyCa);
  if (CA) $("caText").textContent = CA; else $("caHint").textContent = "";

  (function buildLinks() {
    const L = C.links || {};
    const list = [];
    if (CA && /pump$/.test(CA)) list.push(["pump.fun", `https://pump.fun/coin/${CA}`]);
    if (CA) list.push(["Chart", `https://dexscreener.com/solana/${CA}`]);
    if (L.x) list.push(["X", L.x]);
    if (L.telegram) list.push(["Telegram", L.telegram]);
    const ul = $("links");
    if (!list.length) { ul.hidden = true; return; }
    for (const [label, href] of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = label;
      li.append(a);
      ul.append(li);
    }
  })();

  // ---------- the kitchen: turn buys into pancakes ----------

  const K = {
    base: null,     // buys in the last 24h when the page opened
    live: 0,        // buys seen one by one since then
    dexGain: 0,     // growth in the 24h buy count since then (catches anything the trade feed missed)
    enqueued: 0,    // pancakes handed to the scene so far
    seen: new Set(),
    pools: [],
    polled: new Set(),
    solUsd: 0,
    lastOk: 0,
  };

  // DexScreener's count only fills in for buys the trade feed still hasn't shown after 25s,
  // so a buy never lands twice and most pancakes keep their real size.
  const dexHist = [];
  function settledDexGain() {
    const cutoff = Date.now() - 25000;
    let g = 0;
    for (const [t, v] of dexHist) if (t <= cutoff && v > g) g = v;
    return g;
  }

  function target() { return K.base + Math.max(K.live, settledDexGain()); }

  function reconcile() {
    if (K.base == null) return;
    const t = target();
    while (K.enqueued < t) {
      K.enqueued++;
      enqueue({ size: "butter", label: "+1" });
    }
  }

  function buyLanded(b) {
    if (b.tx && K.seen.has(b.tx)) return;
    if (b.tx) K.seen.add(b.tx);
    K.live++;
    const size = Scene.sizeFor(b.sol);
    // if the DexScreener count already put this buy on the plate, just print the ticket
    if (K.enqueued < target() || b.mine) {
      K.enqueued++;
      const label = b.mine ? "yours!" : b.sol > 0 ? `+${b.sol < 0.1 ? b.sol.toFixed(3) : b.sol.toFixed(2)} SOL` : "+1";
      enqueue({ size, label, mine: b.mine });
    }
    addTicket({ no: K.base + K.live, wallet: b.wallet, sol: b.sol, size, tx: b.tx, time: b.time, mine: b.mine }, true);
  }

  function usd(n) {
    if (!(n >= 0)) return "-";
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }

  async function getJson(url) {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }

  async function pollDex() {
    let buys = 0;
    let sells = 0;
    let vol = 0;
    let mcap = 0;
    let pools = [];
    try {
      const j = await getJson(`https://api.dexscreener.com/latest/dex/tokens/${CA}`);
      const pairs = (j.pairs || []).filter((p) => p.chainId === "solana" && p.baseToken && p.baseToken.address === CA);
      if (!pairs.length) throw new Error("no pairs yet");
      // poll the pools that are busy right now (a graduated coin's old bonding curve goes quiet)
      pairs.sort((a, b) => (b.txns.h1.buys + b.txns.h1.sells) - (a.txns.h1.buys + a.txns.h1.sells));
      for (const p of pairs) {
        buys += p.txns.h24.buys || 0;
        sells += p.txns.h24.sells || 0;
        vol += (p.volume && p.volume.h24) || 0;
      }
      mcap = pairs[0].marketCap || pairs[0].fdv || 0;
      if (pairs[0].quoteToken && pairs[0].quoteToken.address === SOL_MINT && pairs[0].priceNative > 0) {
        K.solUsd = pairs[0].priceUsd / pairs[0].priceNative;
      }
      pools = pairs.slice(0, 2).filter((p, i) => i === 0 || p.txns.h1.buys > 0).map((p) => p.pairAddress);
    } catch (e) {
      // brand new coins can take a minute to show up on DexScreener; GeckoTerminal is the backup
      const j = await getJson(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${CA}/pools`);
      const list = (j.data || []).map((d) => d.attributes);
      if (!list.length) throw e;
      list.sort((a, b) => (b.transactions.h1.buys + b.transactions.h1.sells) - (a.transactions.h1.buys + a.transactions.h1.sells));
      for (const a of list) {
        buys += a.transactions.h24.buys || 0;
        sells += a.transactions.h24.sells || 0;
        vol += Number(a.volume_usd.h24) || 0;
      }
      mcap = Number(list[0].market_cap_usd || list[0].fdv_usd) || 0;
      K.solUsd = Number(list[0].quote_token_price_usd) || K.solUsd;
      pools = list.slice(0, 2).filter((a, i) => i === 0 || a.transactions.h1.buys > 0).map((a) => a.address);
    }

    K.lastOk = Date.now();
    K.pools = pools;
    $("statMcap").textContent = usd(mcap);
    $("statVol").textContent = usd(vol);
    $("statTx").textContent = `${buys.toLocaleString("en-US")} / ${sells.toLocaleString("en-US")}`;

    if (K.base == null) {
      K.base = buys;
      K.enqueued = buys;
      fillInitial(buys);
    } else {
      K.dexGain = Math.max(K.dexGain, buys - K.base);
      dexHist.push([Date.now(), K.dexGain]);
      if (dexHist.length > 30) dexHist.shift();
      reconcile();
    }
  }

  async function pollTrades(pool) {
    const j = await getJson(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/trades`);
    const buys = (j.data || [])
      .map((d) => d.attributes)
      .filter((a) => a.kind === "buy")
      .reverse();
    const first = !K.polled.has(pool);
    K.polled.add(pool);
    K.lastOk = Date.now();

    for (const a of buys) {
      let sol = 0;
      if (a.from_token_address === SOL_MINT) sol = Number(a.from_token_amount) || 0;
      else if (K.solUsd > 0) sol = (Number(a.volume_in_usd) || 0) / K.solUsd;
      const b = { tx: a.tx_hash, wallet: a.tx_from_address, sol, time: Date.parse(a.block_timestamp) || Date.now() };
      if (first) {
        // already part of the starting stack; show the latest few as tickets only
        K.seen.add(b.tx);
        continue;
      }
      if (!K.seen.has(b.tx)) buyLanded(b);
    }
    if (first) {
      const recent = buys.slice(-6).reverse();
      recent.forEach((a, i) => {
        let sol = 0;
        if (a.from_token_address === SOL_MINT) sol = Number(a.from_token_amount) || 0;
        else if (K.solUsd > 0) sol = (Number(a.volume_in_usd) || 0) / K.solUsd;
        if (ticketList.querySelectorAll(".ticket").length < MAX_TICKETS) {
          addTicket({
            no: Math.max(1, (K.base || 0) - i), wallet: a.tx_from_address, sol, size: Scene.sizeFor(sol),
            tx: a.tx_hash, time: Date.parse(a.block_timestamp),
          }, false);
        }
      });
    }
  }

  async function dexLoop() {
    for (;;) {
      try {
        await pollDex();
      } catch (e) {
        if (K.base == null) setLive("", "looking for the coin");
      }
      await sleep(DEX_EVERY);
    }
  }

  // GeckoTerminal allows a few calls a minute per visitor: the busiest pool every 12s,
  // a second busy pool (if any) every third round, and a long pause after any error
  async function tradeLoop() {
    while (K.base == null) await sleep(500);
    for (let round = 0; ; round++) {
      let wait = TRADES_EVERY;
      const pools = K.pools.filter((p, i) => i === 0 || round % 3 === 0);
      for (const pool of pools) {
        try {
          await pollTrades(pool);
        } catch (e) {
          wait = 30000;
          break;
        }
      }
      await sleep(wait);
    }
  }

  setInterval(() => {
    if (DEMO) return;
    if (K.lastOk && Date.now() - K.lastOk < 60000) setLive("on", "live from the chain");
    else if (K.base != null) setLive("", "reconnecting");
  }, 2000);

  // ---------- buying right on the page ----------

  function siteBuy(res) {
    const txid = res && res.txid;
    let sol = 0;
    try {
      const q = res.quoteResponseMeta && res.quoteResponseMeta.quoteResponse;
      if (q && q.inputMint === SOL_MINT) sol = Number(q.inAmount) / 1e9;
    } catch (e) { /* size is a nice-to-have */ }
    buyLanded({ tx: txid, sol, mine: true, time: Date.now() });
    toast(`Your pancake is on ${NAME}'s plate`);
    document.getElementById("top").scrollIntoView({ behavior: "smooth" });
  }

  function loadJupiter() {
    $("swapOff").hidden = true;
    const box = $("jupiter-plugin");
    box.hidden = false;
    const s = document.createElement("script");
    s.src = "https://plugin.jup.ag/plugin-v1.js";
    s.setAttribute("data-preload", "");
    s.onload = () => {
      window.Jupiter.init({
        displayMode: "integrated",
        integratedTargetId: "jupiter-plugin",
        formProps: { initialInputMint: SOL_MINT, initialOutputMint: CA, fixedMint: CA },
        branding: { name: TICKER, logoUri: new URL("img/icon-192.png", location.href).href },
        containerStyles: { width: "100%", height: "100%" },
        onSuccess: siteBuy,
      });
    };
    s.onerror = () => {
      box.hidden = true;
      $("swapOff").hidden = false;
      $("swapOff").querySelector(".swap-off-big").textContent = "The swap box didn't load.";
      $("swapOff").querySelector("p:last-child").textContent = "Use one of the links on the right to buy instead.";
    };
    document.head.appendChild(s);
  }

  if (CA) {
    const target = $("order");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); loadJupiter(); }
      }, { rootMargin: "700px 0px" });
      io.observe(target);
    } else {
      loadJupiter();
    }
  }

  // ---------- pretend kitchen (before launch) ----------

  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function fakeWallet() {
    let s = "";
    for (let i = 0; i < 44; i++) s += B58[Math.floor(Math.random() * B58.length)];
    return s;
  }
  function fakeSol() {
    // mostly small buys, now and then a big one
    const x = Math.exp(rand(-3.2, 1.2));
    return Math.random() < 0.04 ? rand(5, 18) : x;
  }

  function startDemo() {
    setLive("demo", "pretend orders");
    $("countNote").textContent = "pretend orders until the coin goes live";
    $("demoNote").hidden = false;
    K.base = 9;
    K.enqueued = 9;
    fillInitial(9);
    for (let i = 0; i < 4; i++) {
      const sol = fakeSol();
      addTicket({ no: 9 - i, wallet: fakeWallet(), sol, size: Scene.sizeFor(sol), time: Date.now() - (i + 1) * 23000 }, false);
    }
    (async function loop() {
      await sleep(2600);
      for (;;) {
        if (!document.hidden) buyLanded({ wallet: fakeWallet(), sol: fakeSol(), time: Date.now() });
        await sleep(rand(1300, 5200));
      }
    })();
  }

  updateCaption();
  if (DEMO) {
    startDemo();
  } else {
    setLive("", "connecting");
    $("countNote").textContent = `one for every buy of ${TICKER} in the last 24 hours`;
    dexLoop();
    tradeLoop();
  }
})();
