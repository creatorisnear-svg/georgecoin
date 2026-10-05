// Small helpers used by both the public page and the owner page (admin/).
(function () {
  const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // today's date in the kitchen's time zone, so every visitor sees the same day and the same coin
  function kitchenToday(tz) {
    const parts = {};
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
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

  function isoPlus(today, days) {
    return new Date(Date.UTC(today.y, today.m - 1, today.d + days)).toISOString().slice(0, 10);
  }

  function normalizeLaunches(list) {
    return (list || [])
      .filter((l) => l && l.date && l.ticker)
      .map((l) => ({ date: String(l.date), ticker: String(l.ticker).trim().replace(/^\$/, ""), contract: String(l.contract || "").trim() }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  // the coin on the plate: the newest launch dated today or earlier that has a contract
  function pickCurrent(launches, todayIso) {
    return [...launches].reverse().find((l) => l.date <= todayIso && l.contract) || null;
  }

  // data/site.json holds the daily coins and links; the owner page writes it
  async function loadSiteData(base) {
    try {
      const r = await fetch(`${base || ""}data/site.json?t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  window.StackShared = { kitchenToday, isoPlus, normalizeLaunches, pickCurrent, loadSiteData };
})();
