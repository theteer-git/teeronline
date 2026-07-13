"use strict";

(() => {
  const config = globalThis.TEER_GAME_CONFIG;
  const GAME_ID = String(document.body?.dataset?.gameId || "").toUpperCase();
  const game = config?.getGame?.(GAME_ID);

  if (!config || !game) {
    console.error("Unified game page configuration is unavailable.");
    return;
  }

  const prefix = GAME_ID.toLowerCase();
  const LATEST_URL = config.endpoints.latestResults;
  const RECENT_URL = config.endpoints.recentResults;
  const POLLING_PLAN_URL = config.endpoints.pollingPlan;

  let loadingLatest = null;
  let loadingRecent = null;
  let timer = null;
  let pollingPlan = null;

  const byId = suffix => document.getElementById(`${prefix}-${suffix}`);
  const valid = value => /^\d{1,2}$/.test(String(value ?? "").trim());
  const num = value => valid(value) ? String(value).padStart(2, "0") : "XX";
  const dateValue = value => Date.parse(`${String(value || "")}T00:00:00`) || 0;

  const fmtDate = value => {
    if (!value) return "--";
    const [year, month, day] = String(value).split("-");
    return year && month && day ? `${day}-${month}-${year}` : String(value);
  };

  const fmtClock = value => {
    if (!value) return "";
    if (/^\d{2}:\d{2}$/.test(String(value))) {
      const [hours, minutes] = String(value).split(":").map(Number);
      const period = hours >= 12 ? "PM" : "AM";
      const hour12 = hours % 12 || 12;
      return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).toUpperCase();
  };

  const normalize = data => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.records)) return data.records;
    return Object.values(data || {}).filter(value => value && typeof value === "object");
  };

  const normalizeItem = item => ({
    ...(item || {}),
    gameId: item?.gameId || item?.g || item?.game || "",
    date: item?.date || item?.d || "",
    fr: item?.fr ?? item?.f ?? "",
    sr: item?.sr ?? item?.s ?? ""
  });

  async function fetchLatest() {
    if (loadingLatest) return loadingLatest;
    loadingLatest = (async () => {
      const response = await fetch(LATEST_URL, {
        cache: "no-store",
        referrerPolicy: "no-referrer"
      });
      if (!response.ok) throw new Error(`Latest results request failed: ${response.status}`);
      const data = await response.json();
      return normalizeItem(data?.records?.[GAME_ID] ?? data?.[GAME_ID] ?? {});
    })();
    try {
      return await loadingLatest;
    } finally {
      loadingLatest = null;
    }
  }

  async function fetchRecent() {
    if (loadingRecent) return loadingRecent;
    loadingRecent = (async () => {
      const response = await fetch(RECENT_URL, {
        cache: "no-store",
        referrerPolicy: "no-referrer"
      });
      if (!response.ok) throw new Error(`Recent results request failed: ${response.status}`);
      return normalize(await response.json())
        .map(normalizeItem)
        .filter(item => item.gameId === GAME_ID && item.date && valid(item.fr) && valid(item.sr))
        .sort((a, b) => dateValue(b.date) - dateValue(a.date));
    })();
    try {
      return await loadingRecent;
    } finally {
      loadingRecent = null;
    }
  }

  function renderResult(record = {}) {
    const fr = num(record.fr);
    const sr = num(record.sr);
    const frTime = fmtClock(record.frUpdatedAt) || fmtClock(record.frDeclaredTime) || fmtClock(game.rounds.fr);
    const srTime = fmtClock(record.srUpdatedAt) || fmtClock(record.srDeclaredTime) || fmtClock(game.rounds.sr);

    if (byId("date")) byId("date").textContent = `📅 ${fmtDate(record.date)}`;
    if (byId("fr-time")) byId("fr-time").textContent = `🏹 FR: ${frTime}`;
    if (byId("sr-time")) byId("sr-time").textContent = `🎯 SR: ${srTime}`;
    if (byId("fr")) byId("fr").textContent = fr;
    if (byId("sr")) byId("sr").textContent = sr;
    if (byId("fr-badge")) byId("fr-badge").textContent = frTime;
    if (byId("sr-badge")) byId("sr-badge").textContent = srTime;
    if (byId("status")) {
      byId("status").textContent = fr !== "XX" && sr !== "XX"
        ? "Completed"
        : fr !== "XX" || sr !== "XX"
          ? "Partial"
          : "Pending";
    }
  }

  function renderHistory(records = []) {
    const target = byId("history");
    if (!target) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const rows = records
      .filter(item => item.date !== today)
      .slice(0, 7)
      .map(item => `<div class="mini-history-row"><span class="mini-history-date">${fmtDate(item.date)}</span><span class="mini-history-result">${num(item.fr)}-${num(item.sr)}</span></div>`);
    while (rows.length < 7) {
      rows.push('<div class="mini-history-row" aria-hidden="true"><span class="mini-history-date">--</span><span class="mini-history-result">XX-XX</span></div>');
    }
    target.innerHTML = rows.join("");
  }

  function bindPopup() {
    document.addEventListener("click", event => {
      const button = event.target.closest(".mini-chip");
      if (!button) return;
      const popup = document.getElementById("numberPopup");
      if (!popup) return;
      const title = document.getElementById("popupTitle");
      const meta = document.getElementById("popupMeta");
      const numbers = document.getElementById("popupNumbers");
      if (title) title.textContent = button.dataset.popupTitle || "Details";
      if (meta) meta.textContent = `${button.dataset.popupDays || "—"} days missing`;
      if (numbers) {
        numbers.innerHTML = String(button.dataset.popupNums || "")
          .split(",")
          .filter(Boolean)
          .map(value => `<span>${value}</span>`)
          .join("");
      }
      popup.classList.add("show");
      popup.setAttribute("aria-hidden", "false");
    });

    document.addEventListener("click", event => {
      const popup = document.getElementById("numberPopup");
      if (!popup) return;
      if (event.target === popup || event.target.closest("[data-close-popup], .modal-close")) {
        popup.classList.remove("show");
        popup.setAttribute("aria-hidden", "true");
      }
    });
  }

  async function loadPlan() {
    try {
      const response = await fetch(POLLING_PLAN_URL, {
        cache: "no-store",
        referrerPolicy: "no-referrer"
      });
      if (response.ok) pollingPlan = await response.json();
    } catch (error) {
      console.warn(`${GAME_ID} polling plan request failed:`, error);
    }
  }

  function intervalMs() {
    const fallback = 60000;
    const gamePlan = pollingPlan?.games?.[GAME_ID];
    if (!gamePlan) return fallback;
    const activeIntervals = Object.values(gamePlan.rounds || {})
      .filter(round => round?.active)
      .map(round => Number(round.intervalMs))
      .filter(value => Number.isFinite(value) && value >= 5000);
    if (activeIntervals.length) return Math.min(...activeIntervals);
    return fallback;
  }

  function schedule() {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = setTimeout(async () => {
      await refresh(false);
      schedule();
    }, intervalMs());
  }

  async function refresh(manual = true) {
    const [latestResult, recentResult] = await Promise.allSettled([
      fetchLatest(),
      fetchRecent()
    ]);
    const latest = latestResult.status === "fulfilled" ? latestResult.value : {};
    const recent = recentResult.status === "fulfilled" ? recentResult.value : [];
    if (latestResult.status === "rejected") console.warn(`${GAME_ID} latest result refresh failed:`, latestResult.reason);
    if (recentResult.status === "rejected") console.warn(`${GAME_ID} recent result refresh failed:`, recentResult.reason);
    renderResult(latest && Object.keys(latest).length ? latest : recent[0] || {});
    renderHistory(recent);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindPopup();
    byId("refresh")?.addEventListener("click", () => refresh(true));
    await Promise.all([loadPlan(), refresh(false)]);
    schedule();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(timer);
      return;
    }
    refresh(false);
    schedule();
  });
})();
