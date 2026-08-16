(function initGamePage() {
  "use strict";

  const config = window.TEER_GAME_CONFIG;
  const gameId = String(document.body?.dataset?.gameId || "").toUpperCase();
  const game = config?.getGame(gameId);
  if (!config || !game) return;

  const MIN_POLL_MS = 5000;
  const IDLE_POLL_MS = 60000;
  const PLAN_REFRESH_MS = 60000;

  const TASK12_POLL = Object.freeze({
    HOT_MS: 1000,
    IDLE_MS: 45000,
    PRE_WINDOW_MS: 5 * 60 * 1000,
    POST_WINDOW_MS: 20 * 60 * 1000
  });

  function istClockMinutes(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return Number(values.hour) * 60 + Number(values.minute) + Number(values.second) / 60;
  }

  function roundDistanceMs(time, now = new Date()) {
    const match = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return Number.POSITIVE_INFINITY;
    let target = Number(match[1]) * 60 + Number(match[2]);
    const current = istClockMinutes(now);
    let minutes = target - current;
    if (minutes < -12 * 60) minutes += 24 * 60;
    if (minutes > 12 * 60) minutes -= 24 * 60;
    return minutes * 60 * 1000;
  }

  function adaptivePollingInterval(record, now = new Date()) {
    const rounds = [["fr", game.rounds?.fr], ["sr", game.rounds?.sr]];
    for (const [key, declaredTime] of rounds) {
      const published = /^\d{2}$/.test(String(record?.[key] || ""));
      if (published) continue;
      const distance = roundDistanceMs(declaredTime, now);
      if (distance <= TASK12_POLL.PRE_WINDOW_MS && distance >= -TASK12_POLL.POST_WINDOW_MS) {
        return TASK12_POLL.HOT_MS;
      }
    }
    return TASK12_POLL.IDLE_MS;
  }
  let latestRecord = null;
  let recentRecords = [];
  let pollingPlan = null;
  let loadingLatest = null;
  let loadingRecent = null;
  let loadingPlan = null;
  let resultTimer = null;
  let planTimer = null;
  let lastSignature = "";

  const $ = (id) => document.getElementById(id);
  const validNumber = (value) => /^\d{1,2}$/.test(String(value ?? "").trim());
  const n2 = (value) => validNumber(value) ? String(Number(value)).padStart(2, "0") : "";

  function emit(eventName, detail = {}) {
    if (Math.random() > 0.1) return;
    const payload = { eventName, gameId, path: location.pathname, ...detail };
    if (window.teerAnalytics && typeof window.teerAnalytics.track === "function") window.teerAnalytics.track(payload);
    window.dispatchEvent(new CustomEvent("teer:analytics", { detail: payload }));
  }

  function flatten(value) {
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (!value || typeof value !== "object") return [];
    for (const key of ["records", "results", "data"]) {
      if (Array.isArray(value[key])) return flatten(value[key]);
      if (value[key] && typeof value[key] === "object") return flatten(Object.values(value[key]));
    }
    if (value.g || value.gameId || value.game_id || value.game || value.name) return [value];
    return Object.values(value).flatMap(flatten);
  }

  function normalize(item) {
    if (!item || typeof item !== "object") return null;
    const id = config.normalizeGameId(item.g ?? item.gameId ?? item.game_id ?? item.game ?? item.name ?? item.title);
    const date = String(item.d ?? item.date ?? item.resultDate ?? "").trim();
    if (!id || !date) return null;
    const fr = n2(item.f ?? item.fr ?? item.first_round ?? item.firstRound ?? item.first);
    const sr = n2(item.s ?? item.sr ?? item.second_round ?? item.secondRound ?? item.second);
    return { ...item, gameId: id, date, fr, sr, status: String(item.status || (fr && sr ? "completed" : fr || sr ? "partial" : "pending")).toLowerCase() };
  }

  function normalizedList(payload) { return flatten(payload).map(normalize).filter(Boolean); }
  function dateValue(value) { const time = new Date(`${value}T00:00:00+05:30`).getTime(); return Number.isFinite(time) ? time : 0; }
  function displayDate(value) { const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : value; }
  function displayTime(value) { const d = value ? new Date(value) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase() : ""; }
  function roundTime(record, round) { return displayTime(record?.[`${round}UpdatedAt`]) || record?.[`${round}DeclaredTime`] || "Awaiting publication"; }

  function extractLatest(payload) {
    const direct = payload?.records?.[gameId];
    if (direct) return normalize({ ...direct, gameId });
    return normalizedList(payload).filter((row) => row.gameId === gameId).sort((a,b) => dateValue(b.date) - dateValue(a.date))[0] || null;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  async function loadLatest() {
    if (loadingLatest) return loadingLatest;
    loadingLatest = (async () => {
      const previous = latestRecord;
      const latestPayload = await fetchJson(`${config.endpoints.latestResults}?game=${encodeURIComponent(gameId)}`);
      latestRecord = latestPayload?.record || extractLatest(latestPayload);
      const signature = latestRecord ? `${latestRecord.date}|${latestRecord.fr}|${latestRecord.sr}` : "none";
      if (lastSignature && signature !== lastSignature) emit("result_changed", { status: latestRecord?.status || "missing" });
      lastSignature = signature;
      renderLive();
      if (!previous && latestRecord) emit("result_seen", { status: latestRecord.status });
    })().catch((error) => renderError("Unable to load the latest result.", error)).finally(() => { loadingLatest = null; });
    return loadingLatest;
  }

  async function loadRecent() {
    if (loadingRecent) return loadingRecent;
    loadingRecent = (async () => {
      recentRecords = normalizedList((await fetchJson(`${config.endpoints.recentResults}?game=${encodeURIComponent(gameId)}`))?.records || []).filter((row) => row.gameId === gameId).sort((a,b) => dateValue(b.date) - dateValue(a.date)).slice(0,7);
      renderPrevious(); renderStats();
    })().catch((error) => renderError("Unable to load recent results.", error)).finally(() => { loadingRecent = null; });
    return loadingRecent;
  }

  async function loadPlan() {
    if (loadingPlan) return loadingPlan;
    loadingPlan = fetchJson(`${config.endpoints.pollingPlan}?game=${encodeURIComponent(gameId)}`).then((value) => { pollingPlan = value?.plan || value; scheduleResultPoll(); }).catch((error) => console.warn("Polling plan unavailable; using idle interval.", error)).finally(() => { loadingPlan = null; });
    return loadingPlan;
  }

  function ownPollingInterval() {
    const adaptive = adaptivePollingInterval(latestRecord);
    if (adaptive === TASK12_POLL.HOT_MS) return adaptive;
    const rounds = pollingPlan?.games?.[gameId]?.rounds || {};
    const active = [rounds.fr, rounds.sr].filter((round) => round?.active === true && Number(round.intervalMs) > 0);
    const planned = active.length ? Math.min(...active.map((round) => Number(round.intervalMs))) : TASK12_POLL.IDLE_MS;
    return Math.max(TASK12_POLL.HOT_MS, Math.min(TASK12_POLL.IDLE_MS, planned));
  }

  function scheduleResultPoll() {
    clearTimeout(resultTimer);
    if (document.hidden) return;
    resultTimer = setTimeout(async () => { await loadLatest(); scheduleResultPoll(); }, ownPollingInterval());
  }

  function renderLive() {
    const fr = latestRecord?.fr || "XX";
    const sr = latestRecord?.sr || "XX";
    $("fr-value").textContent = fr; $("sr-value").textContent = sr;
    $("fr-time").textContent = roundTime(latestRecord, "fr"); $("sr-time").textContent = roundTime(latestRecord, "sr");
    $("result-date").textContent = latestRecord?.date ? `Result date: ${displayDate(latestRecord.date)}` : "No current result record is available.";
    const status = fr !== "XX" && sr !== "XX" ? "completed" : fr !== "XX" || sr !== "XX" ? "partial" : "pending";
    const badge = $("publication-status"); badge.textContent = status[0].toUpperCase() + status.slice(1); badge.className = `status-badge ${status}`;
    $("status-detail").textContent = status === "completed" ? "Both rounds have been published." : status === "partial" ? "One round is published; the remaining round is still awaited." : "The result is not yet published for the current business date.";
  }

  function renderPrevious() {
    const body = $("previous-results"); body.textContent = "";
    if (!recentRecords.length) { body.innerHTML = '<tr><td colspan="3">No recent result is available.</td></tr>'; return; }
    for (const row of recentRecords) { const tr = document.createElement("tr"); for (const value of [displayDate(row.date), row.fr || "XX", row.sr || "XX"]) { const td = document.createElement("td"); td.textContent = value; tr.appendChild(td); } body.appendChild(tr); }
  }

  function frequency(values) { const map = new Map(); for (const value of values) map.set(value, (map.get(value) || 0) + 1); return [...map.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
  function renderStats() {
    const numbers = recentRecords.flatMap((row) => [row.fr, row.sr]).filter(Boolean);
    const repeated = frequency(numbers).filter(([, count]) => count > 1).map(([value]) => value);
    const endings = frequency(numbers.map((value) => value[1])); const houses = frequency(numbers.map((value) => value[0]));
    $("stat-completed").textContent = String(recentRecords.filter((row) => row.fr && row.sr).length);
    $("stat-ending").textContent = endings[0]?.[0] ?? "—"; $("stat-house").textContent = houses[0]?.[0] ?? "—"; $("stat-repeated").textContent = repeated.slice(0,4).join(", ") || "None";
    const common = frequency(numbers).slice(0,6).map(([value]) => value); const host = $("common-number-list"); host.textContent = "";
    if (!common.length) host.innerHTML = '<span class="number-chip muted">Unavailable</span>'; else for (const value of common) { const span = document.createElement("span"); span.className = "number-chip"; span.textContent = value; host.appendChild(span); }
  }

  function renderError(message, error) { console.error(message, error); $("status-detail").textContent = message; }
  function renderNavigation() {
    const nav = $("primary-nav"); const current = location.pathname.replace(/\/$/, "") || "/";
    for (const item of config.navigation) { const a = document.createElement("a"); a.href = item.path; a.textContent = item.label; if ((item.path.replace(/\/$/, "") || "/") === current) a.setAttribute("aria-current", "page"); nav.appendChild(a); }
    for (const item of config.footerLinks) { const a = document.createElement("a"); a.href = item.path; a.textContent = item.label; $("footer-links").appendChild(a); }
    for (const id of config.gameOrder.filter((id) => id !== gameId)) { const item = config.games[id]; const a = document.createElement("a"); a.href = item.canonicalPath; a.textContent = item.name; $("related-game-links").appendChild(a); }
  }

  function observeSections() {
    if (!("IntersectionObserver" in window)) return;
    const seen = new Set(); const observer = new IntersectionObserver((entries) => { for (const entry of entries) { const section = entry.target.dataset.semanticSection; if (entry.isIntersecting && !seen.has(section)) { seen.add(section); emit("section_visible", { section }); } } }, { threshold: 0.45 });
    document.querySelectorAll("[data-semantic-section]").forEach((node) => observer.observe(node));
  }

  async function refreshAll(manual = false) {
    const button = $("manual-refresh"); if (manual) { button.disabled = true; emit("manual_refresh"); }
    await Promise.all([loadLatest(), loadRecent(), loadPlan()]);
    if (manual) button.disabled = false;
  }

  $("nav-toggle").addEventListener("click", () => { const open = $("primary-nav").classList.toggle("open"); $("nav-toggle").setAttribute("aria-expanded", String(open)); });
  $("manual-refresh").addEventListener("click", () => refreshAll(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) { clearTimeout(resultTimer); clearInterval(planTimer); } else { refreshAll(false); planTimer = setInterval(loadPlan, PLAN_REFRESH_MS); } });
  window.addEventListener("pageshow", (event) => { if (event.persisted) refreshAll(false); });
  $("copyright-year").textContent = String(new Date().getFullYear());
  renderNavigation(); observeSections(); emit("page_load"); refreshAll(false); planTimer = setInterval(loadPlan, PLAN_REFRESH_MS);
})();
