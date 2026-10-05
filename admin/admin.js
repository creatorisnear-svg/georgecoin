// Owner page: change the daily coin and links without touching any files.
// It saves data/site.json in the GitHub repo; Cloudflare Pages then republishes the site.
(function () {
  const C = window.STACK_CONFIG || {};
  const SH = window.StackShared;
  const REPO = C.repo || "creatorisnear-svg/georgecoin";
  const OWNER = REPO.split("/")[0];
  const TZ = C.timezone || "America/Phoenix";
  const API = `https://api.github.com/repos/${REPO}/contents/data/site.json`;
  const KEY = "georgecoin_owner_key";
  const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let token = "";
  try { token = localStorage.getItem(KEY) || ""; } catch (e) { /* private mode: ask every time */ }
  let data = { launches: [], links: {} };
  let sha = null;
  let login = "";
  const today = SH.kitchenToday(TZ);

  $("makeKey").href = "https://github.com/settings/personal-access-tokens/new?" + new URLSearchParams({
    name: "Georgecoin owner page",
    description: "Lets georgecoin.fun/admin save the daily coin",
    target_name: OWNER,
    expires_in: "none",
    contents: "write",
  });

  // ---------- small helpers ----------

  function say(id, text, kind) {
    const n = $(id);
    n.textContent = text || "";
    n.className = "msg" + (kind ? " " + kind : "");
  }

  function b64encode(str) {
    let bin = "";
    new TextEncoder().encode(str).forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function b64decode(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  function dayLabel(iso, opts) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", Object.assign({ timeZone: "UTC" }, opts)).format(new Date(Date.UTC(y, m - 1, d, 12)));
  }

  function short(ca) { return ca.length > 14 ? `${ca.slice(0, 6)}...${ca.slice(-6)}` : ca; }

  // ---------- GitHub ----------

  async function api(method, body) {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (body) headers["Content-Type"] = "application/json";
    return fetch(method === "GET" ? `${API}?ref=main&t=${Date.now()}` : API, {
      method, headers, cache: "no-store", body: body ? JSON.stringify(body) : undefined,
    });
  }

  function fail(status) {
    if (status === 401) return new Error("key");
    if (status === 403 || status === 404) return new Error("access");
    return new Error(`GitHub said ${status}`);
  }

  async function load() {
    const r = await api("GET");
    if (!r.ok) throw fail(r.status);
    const j = await r.json();
    sha = j.sha;
    data = JSON.parse(b64decode(j.content));
    data.launches = SH.normalizeLaunches(data.launches);
    data.links = data.links || {};
  }

  async function save(change, message) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await load();
      change(data);
      data.launches = SH.normalizeLaunches(data.launches);
      const content = JSON.stringify(data, null, 2) + "\n";
      const r = await api("PUT", { message, content: b64encode(content), sha, branch: "main" });
      if (r.ok) {
        sha = (await r.json()).content.sha;
        return;
      }
      if (r.status !== 409 && r.status !== 422) throw fail(r.status);
    }
    throw new Error("GitHub was busy, try again");
  }

  function explain(e) {
    if (e.message === "key") return "That key didn't work. Make a new one and connect again.";
    if (e.message === "access") return "The key can't save to georgecoin. Make a new one and pick the georgecoin repo with Contents: Read and write.";
    if (e instanceof TypeError) return "No connection. Check your internet and try again.";
    return e.message;
  }

  // after a save, watch the live site until it shows the change
  async function waitLive(isLive, msgId) {
    for (let i = 0; i < 36; i++) {
      await sleep(5000);
      const d = await SH.loadSiteData("../");
      if (d && isLive(d)) {
        say(msgId, "Live on the site now.", "ok");
        return;
      }
    }
    say(msgId, "Saved. The site should catch up within a couple of minutes.", "ok");
  }

  // ---------- screens ----------

  function showConnect(message) {
    $("connect").hidden = false;
    ["editor", "listSheet", "linksSheet", "who"].forEach((id) => { $(id).hidden = true; });
    say("connectMsg", message || "", message ? "bad" : "");
  }

  function showEditor() {
    $("connect").hidden = true;
    ["editor", "listSheet", "linksSheet", "who"].forEach((id) => { $(id).hidden = false; });
    const who = $("who");
    who.textContent = `Connected${login ? " as " + login : ""}. `;
    const out = document.createElement("button");
    out.type = "button";
    out.textContent = "Disconnect this browser";
    out.addEventListener("click", () => {
      try { localStorage.removeItem(KEY); } catch (e) { /* nothing stored */ }
      token = "";
      showConnect("");
    });
    who.append(out);
    render();
  }

  function render() {
    const current = SH.pickCurrent(data.launches, today.iso);
    const now = $("nowLine");
    now.className = "now" + (current ? "" : " off");
    now.textContent = current
      ? `On the plate now: $${current.ticker}${current.date === today.iso ? "" : " (from " + dayLabel(current.date, { weekday: "long" }) + ")"}`
      : "Nothing on the plate yet. The site is showing pretend orders.";

    const ul = $("coins");
    ul.textContent = "";
    const list = [...data.launches].reverse();
    if (!list.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No coins yet.";
      ul.append(li);
    }
    for (const l of list.slice(0, 21)) {
      const li = document.createElement("li");
      li.className = "coin" + (current && l.date === current.date ? " plate" : "");
      const day = document.createElement("div");
      day.className = "coin-day";
      day.textContent = l.date === today.iso ? "Today" : dayLabel(l.date, { weekday: "short" });
      const small = document.createElement("small");
      small.textContent = dayLabel(l.date, { month: "short", day: "numeric" });
      day.append(small);

      const main = document.createElement("div");
      main.className = "coin-main";
      const b = document.createElement("b");
      b.textContent = "$" + l.ticker;
      const code = document.createElement("code");
      code.textContent = l.contract ? short(l.contract) : "";
      const state = document.createElement("span");
      state.className = "coin-state";
      state.textContent = current && l.date === current.date ? "on the plate"
        : l.date > today.iso ? "coming up"
        : !l.contract ? "no contract yet" : "";
      main.append(b, code, state);

      const actions = document.createElement("div");
      actions.className = "coin-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Change";
      edit.addEventListener("click", () => {
        setDate(l.date);
        $("editor").scrollIntoView({ behavior: "smooth" });
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.textContent = "Remove";
      let armed = 0;
      del.addEventListener("click", async () => {
        if (!armed) {
          del.classList.add("armed");
          del.textContent = "Tap again";
          armed = setTimeout(() => { armed = 0; del.classList.remove("armed"); del.textContent = "Remove"; }, 3500);
          return;
        }
        clearTimeout(armed);
        del.disabled = true;
        del.textContent = "Removing";
        try {
          await save((d) => { d.launches = d.launches.filter((x) => x.date !== l.date); }, `Remove the coin for ${l.date}`);
          render();
          if ($("dateInput").value === l.date) setDate(l.date);
        } catch (e) {
          del.disabled = false;
          del.textContent = "Remove";
          say("saveMsg", explain(e), "bad");
        }
      });
      actions.append(edit, del);
      li.append(day, main, actions);
      ul.append(li);
    }

    $("xInput").value = data.links.x || "";
    $("tgInput").value = data.links.telegram || "";
  }

  // ---------- the coin form ----------

  let autoTicker = "";
  let lookupSeq = 0;
  let lookupTimer = 0;

  function setDate(iso) {
    $("dateInput").value = iso;
    document.querySelectorAll(".day-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(SH.isoPlus(today, Number(btn.dataset.offset)) === iso));
    });
    const title = iso === today.iso ? "Today's coin"
      : iso === SH.isoPlus(today, 1) ? "Tomorrow's coin"
      : `Coin for ${dayLabel(iso, { weekday: "short", month: "short", day: "numeric" })}`;
    $("formTitle").textContent = title;
    $("formDate").textContent = `${dayLabel(iso, { weekday: "long", month: "long", day: "numeric" })}, Arizona time`;
    const existing = data.launches.find((l) => l.date === iso);
    $("caInput").value = existing ? existing.contract : "";
    $("tickerInput").value = existing ? existing.ticker : "";
    autoTicker = "";
    $("found").textContent = "";
    say("saveMsg", "");
  }

  document.querySelectorAll(".day-btn").forEach((btn) => {
    btn.addEventListener("click", () => setDate(SH.isoPlus(today, Number(btn.dataset.offset))));
  });
  $("dateInput").addEventListener("change", () => { if ($("dateInput").value) setDate($("dateInput").value); });

  async function lookup() {
    const ca = $("caInput").value.trim();
    const found = $("found");
    if (!ca) { found.textContent = ""; return; }
    if (!CA_RE.test(ca)) { found.textContent = "That doesn't look like a Solana contract yet."; return; }
    const seq = ++lookupSeq;
    found.textContent = "Looking it up...";
    try {
      const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(ca)}`);
      const list = r.ok ? await r.json() : [];
      if (seq !== lookupSeq) return;
      const t = (list || []).find((x) => x.id === ca);
      found.textContent = "";
      if (!t) {
        found.textContent = "Not found yet (brand new coins can take a minute). Type the ticker yourself.";
        return;
      }
      if (t.icon) {
        const img = document.createElement("img");
        img.src = t.icon;
        img.alt = "";
        img.onerror = () => img.remove();
        found.append(img);
      }
      found.append(`Found: ${t.name || t.symbol} ($${t.symbol})`);
      const tk = $("tickerInput");
      if (!tk.value.trim() || tk.value.trim().toUpperCase() === autoTicker.toUpperCase()) {
        tk.value = t.symbol;
        autoTicker = t.symbol;
      }
    } catch (e) {
      if (seq === lookupSeq) found.textContent = "Couldn't look it up. Type the ticker yourself.";
    }
  }

  $("caInput").addEventListener("input", () => {
    clearTimeout(lookupTimer);
    lookupTimer = setTimeout(lookup, 350);
  });

  $("pasteBtn").addEventListener("click", async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        $("caInput").value = text;
        lookup();
      }
    } catch (e) {
      $("caInput").focus();
      $("found").textContent = "Press and hold the box, then tap Paste.";
    }
  });

  $("coinForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const date = $("dateInput").value;
    const ticker = $("tickerInput").value.trim().replace(/^\$/, "").toUpperCase();
    const contract = $("caInput").value.trim();
    if (!date) return say("saveMsg", "Pick a day.", "bad");
    if (!ticker) return say("saveMsg", "Add the ticker.", "bad");
    if (contract && !CA_RE.test(contract)) return say("saveMsg", "That contract doesn't look right. Paste it again.", "bad");

    const btn = $("saveBtn");
    btn.disabled = true;
    btn.textContent = "Saving...";
    say("saveMsg", "");
    try {
      await save((d) => {
        d.launches = d.launches.filter((l) => l.date !== date).concat([{ date, ticker, contract }]);
      }, `Coin for ${date}: $${ticker}`);
      render();
      $("tickerInput").value = ticker;
      const plate = SH.pickCurrent(data.launches, today.iso);
      const onPlate = plate && plate.date === date;
      say("saveMsg", onPlate ? "Saved. Putting it on the plate..." : "Saved. Updating the site...", "ok");
      waitLive((d) => SH.normalizeLaunches(d.launches).some((l) => l.date === date && l.ticker === ticker && l.contract === contract), "saveMsg");
    } catch (e) {
      say("saveMsg", explain(e), "bad");
    } finally {
      btn.disabled = false;
      btn.textContent = "Put it on the plate";
    }
  });

  // ---------- links ----------

  function cleanUrl(v) {
    v = v.trim();
    if (!v) return "";
    return /^https?:\/\//i.test(v) ? v : "https://" + v.replace(/^\/+/, "");
  }

  $("linksForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const links = { x: cleanUrl($("xInput").value), telegram: cleanUrl($("tgInput").value) };
    say("linksMsg", "Saving...", "");
    try {
      await save((d) => { d.links = links; }, "Update links");
      render();
      say("linksMsg", "Saved. Updating the site...", "ok");
      waitLive((d) => d.links && d.links.x === links.x && d.links.telegram === links.telegram, "linksMsg");
    } catch (e) {
      say("linksMsg", explain(e), "bad");
    }
  });

  // ---------- connecting ----------

  async function whoAmI() {
    try {
      const r = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
      if (r.ok) login = (await r.json()).login || "";
    } catch (e) { /* the name is only for show */ }
  }

  $("connectForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const value = $("tokenInput").value.trim();
    if (!value) return say("connectMsg", "Paste the key first.", "bad");
    token = value;
    say("connectMsg", "Checking the key...", "");
    try {
      await load();
      await whoAmI();
      try { localStorage.setItem(KEY, token); } catch (e) { /* works for this visit only */ }
      $("tokenInput").value = "";
      showEditor();
      setDate(today.iso);
    } catch (e) {
      token = "";
      say("connectMsg", explain(e), "bad");
    }
  });

  (async function start() {
    if (!token) return showConnect("");
    try {
      await load();
      await whoAmI();
      showEditor();
      setDate(today.iso);
    } catch (e) {
      if (e.message === "key") {
        try { localStorage.removeItem(KEY); } catch (x) { /* nothing stored */ }
        token = "";
        showConnect("That key stopped working. Make a new one.");
      } else {
        showConnect(explain(e));
      }
    }
  })();
})();
