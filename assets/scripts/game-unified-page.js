"use strict";

(() => {
  const config = globalThis.TEER_GAME_CONFIG;
  const GAME_ID = String(document.body?.dataset?.gameId || "").toUpperCase();
  const COMMON_PUBLICATION_TIMES = Object.freeze({
    SHD: "11:30 AM",
    KH: "11:45 AM",
    JWD: "10:30 AM",
    SHM: "8:30 PM",
    KHM: "9:00 PM",
    JWM: "8:30 PM",
    SHN1: "5:30 PM",
    SHN2: "5:45 PM"
  });
  const game = config?.getGame?.(GAME_ID);

  if (!config || !game) {
    console.error("Unified game page configuration is unavailable.");
    return;
  }

  const prefix = GAME_ID.toLowerCase();
  const LATEST_URL = config.endpoints.latestResults;
  const LATEST_VERSION_URL = config.endpoints.latestVersion;
  const RECENT_URL = config.endpoints.recentResults;
  const POLLING_PLAN_URL = config.endpoints.pollingPlan;
  const COMMON_NUMBERS_URL = config.endpoints.commonNumbers;

  let loadingLatest = null;
  let loadingLatestVersion = null;
  let latestVersion = null;
  let loadingRecent = null;
  let timer = null;
  let pollingPlan = null;
  let loadingCommonNumbers = null;
  let latestRecord = null;
  let initialResultState = null;
  let monitoringTimer = null;
  let transientBannerUntil = 0;
  let transientBannerRound = "";
  let initialAvailableUntil = 0;
  let initialAvailableRound = "";
  let latestRecordSignature = "";
  let historySignature = "";

  const CACHE_SCHEMA = 1;
  const CACHE_PREFIX = `teeronline:${CACHE_SCHEMA}:${GAME_ID}:`;
  const CACHE_TTL = Object.freeze({
    latest: 36 * 60 * 60 * 1000,
    recent: 7 * 24 * 60 * 60 * 1000,
    common: 7 * 24 * 60 * 60 * 1000
  });

  const readCache = (name) => {
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${name}`);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || cached.schema !== CACHE_SCHEMA || !cached.savedAt) return null;
      if (Date.now() - Number(cached.savedAt) > (CACHE_TTL[name] || 0)) {
        localStorage.removeItem(`${CACHE_PREFIX}${name}`);
        return null;
      }
      return cached.value ?? null;
    } catch {
      return null;
    }
  };

  const writeCache = (name, value) => {
    try {
      localStorage.setItem(`${CACHE_PREFIX}${name}`, JSON.stringify({
        schema: CACHE_SCHEMA,
        savedAt: Date.now(),
        value
      }));
    } catch {
      // Storage may be unavailable in private browsing or restricted contexts.
    }
  };

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



  const MONITORING_FALLBACK = Object.freeze({ before: 30, after: 45 });

  function istParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit",
      weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).reduce((out, part) => {
      if (part.type !== "literal") out[part.type] = part.value;
      return out;
    }, {});
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
      seconds: Number(parts.second),
      clock: date.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase()
    };
  }

  function addDateDays(value, days) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  }

  function currentBusinessDate(now = istParts()) {
    return game.crossesMidnight && now.minutes <= 60 ? addDateDays(now.date, -1) : now.date;
  }

  function resultState(record = {}) {
    return { fr: valid(record.fr), sr: valid(record.sr) };
  }

  function ensureMonitoringBanner() {
    let banner = byId("monitoring");
    if (banner) return banner;
    const card = document.querySelector(".result-card");
    if (!card) return null;

    let stack = card.closest(".result-live-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "result-live-stack";
      card.parentNode.insertBefore(stack, card);
      stack.appendChild(card);
    }

    banner = document.createElement("section");
    banner.id = `${prefix}-monitoring`;
    banner.className = "live-monitoring-banner";
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-atomic", "true");
    banner.innerHTML = [
      '<span class="live-monitoring-icon" aria-hidden="true"></span>',
      '<span class="live-monitoring-copy">',
      '<strong class="live-monitoring-title"></strong>',
      '<span class="live-monitoring-message"></span>',
      '</span>',
      '<span class="live-monitoring-badge"></span>'
    ].join("");
    stack.insertBefore(banner, card);
    return banner;
  }

  function showMonitoringBanner(state, title, message, badge = "", icon = "") {
    const banner = ensureMonitoringBanner();
    if (!banner) return;
    banner.dataset.state = state;
    banner.querySelector(".live-monitoring-icon").textContent = icon;
    banner.querySelector(".live-monitoring-title").textContent = title;
    banner.querySelector(".live-monitoring-message").textContent = message;
    banner.querySelector(".live-monitoring-badge").textContent = badge;
    banner.hidden = false;
  }

  function fmtExpectedTime(round) {
    return fmtClock(game.rounds?.[round]) || String(game.rounds?.[round] || "");
  }

  function roundWindow(round, now) {
    const planRound = pollingPlan?.games?.[GAME_ID]?.rounds?.[round];
    const declared = String(game.rounds?.[round] || "00:00");
    let [hour, minute] = declared.split(":").map(Number);
    let target = hour * 60 + minute;
    let current = now.minutes;
    if (game.crossesMidnight && round === "sr") {
      target += 1440;
      if (current <= 60) current += 1440;
    }
    const before = Number.isFinite(Number(planRound?.beforeMinutes)) ? Number(planRound.beforeMinutes) : MONITORING_FALLBACK.before;
    const after = Number.isFinite(Number(planRound?.afterMinutes)) ? Number(planRound.afterMinutes) : MONITORING_FALLBACK.after;
    return {
      round, current, target, before, after,
      active: planRound?.active === true || (current >= target - before && current <= target + after),
      extended: current > target + after,
      expectedDate: planRound?.expectedDate || currentBusinessDate(now),
      completed: planRound?.completed === true
    };
  }

  function updateMonitoringBanner() {
    const now = istParts();
    const state = resultState(latestRecord || {});
    const businessDate = currentBusinessDate(now);
    const recordDate = String(latestRecord?.date || "");
    const isCurrentRecord = recordDate === businessDate;
    const isOffDay = Array.isArray(game.weeklyOffDays) && game.weeklyOffDays.includes(now.weekday);

    // scheduled off-day: retain the fixed-height ribbon to prevent layout shift.
    if (isOffDay) {
      showMonitoringBanner(
        "off",
        "Scheduled Off Day",
        `${game.name} is not conducted today. Live monitoring will resume on the next scheduled game day.`,
        "OFF DAY",
        "▣"
      );
      return;
    }
    if (Date.now() < transientBannerUntil) {
      showMonitoringBanner(
        "updated",
        "Result Updated",
        `The latest ${transientBannerRound} result has been received and displayed automatically.`,
        `UPDATED ${now.clock} IST`,
        "✓"
      );
      return;
    }
    if (isCurrentRecord && state.fr && state.sr) {
      showMonitoringBanner(
        "complete",
        "Today’s Result Complete",
        "Both rounds have been received and displayed.",
        "COMPLETE",
        "★"
      );
      return;
    }

    const pendingRound = !state.fr ? "fr" : !state.sr ? "sr" : null;
    if (!pendingRound) {
      showMonitoringBanner(
        "waiting",
        "Waiting for Live Monitoring",
        "We’ll indicate here when live monitoring begins and results will update automatically.",
        "UPCOMING",
        "◷"
      );
      return;
    }

    const window = roundWindow(pendingRound, now);
    const label = pendingRound.toUpperCase();
    const expectedTime = fmtExpectedTime(pendingRound);

    if (isCurrentRecord && Date.now() < initialAvailableUntil && initialAvailableRound) {
      showMonitoringBanner(
        "available",
        `Today’s ${initialAvailableRound} Result Available`,
        "The latest result was already available when this page opened.",
        "AVAILABLE",
        "i"
      );
      return;
    }
    if (window.active) {
      showMonitoringBanner(
        "active",
        `Live ${label} Result Monitoring`,
        "Results will appear automatically as soon as they are published. Auto updating instantly.",
        "ACTIVE NOW",
        "◉"
      );
      return;
    }
    if (isCurrentRecord && window.extended) {
      showMonitoringBanner(
        "extended",
        "Monitoring Extended",
        "The result has not yet been published. Automatic monitoring is continuing.",
        "MONITORING",
        "◷"
      );
      return;
    }
    showMonitoringBanner(
      "waiting",
      "Waiting for Live Monitoring",
      `We’ll indicate here when live ${label} monitoring begins. The result will update automatically.`,
      `UPCOMING · ${expectedTime}`,
      "◷"
    );
  }

  function noteResultTransition(record) {
    const next = resultState(record);
    if (initialResultState === null) {
      initialResultState = next;
      if (next.fr !== next.sr) {
        initialAvailableRound = next.fr ? "FR" : "SR";
        initialAvailableUntil = Date.now() + 8000;
      }
      return;
    }
    const round = !initialResultState.fr && next.fr ? "FR" : !initialResultState.sr && next.sr ? "SR" : "";
    initialResultState = next;
    if (round) {
      transientBannerRound = round;
      transientBannerUntil = Date.now() + 12000;
    }
  }

  async function fetchLatestVersion() {
    if (loadingLatestVersion) return loadingLatestVersion;
    loadingLatestVersion = (async () => {
      const response = await fetch(LATEST_VERSION_URL, {
        cache: "no-store",
        referrerPolicy: "no-referrer"
      });
      if (!response.ok) throw new Error(`Latest version request failed: ${response.status}`);
      const payload = await response.json();
      const version = String(payload?.v || "").trim();
      if (!/^[a-f0-9]{64}$/i.test(version)) throw new Error("Latest version response is invalid");
      return version;
    })();
    try {
      return await loadingLatestVersion;
    } finally {
      loadingLatestVersion = null;
    }
  }

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

  function resultSignature(record = {}) {
    return [record.date || "", num(record.fr), num(record.sr), record.status || "", record.lastUpdatedAt || record.updatedAt || ""].join("|");
  }

  function recentSignature(records = []) {
    return records.map(item => [item.date || "", num(item.fr), num(item.sr)].join(":" )).join("|");
  }

  function renderResult(record = {}) {
    const signature = resultSignature(record);
    if (signature && signature === latestRecordSignature) {
      latestRecord = { ...record };
      updateMonitoringBanner();
      return false;
    }
    latestRecordSignature = signature;
    noteResultTransition(record);
    latestRecord = { ...record };
    const fr = num(record.fr);
    const sr = num(record.sr);
    const frTime = fmtClock(record.frDeclaredTime) || fmtClock(game.rounds.fr);
    const srTime = fmtClock(record.srDeclaredTime) || fmtClock(game.rounds.sr);

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
    updateMonitoringBanner();
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



  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const chips = (items, className = "chip", digitsOnly = false) => (items || [])
    .map(value => {
      const text = digitsOnly ? String(Number(value)) : String(value);
      return `<span class="${className}">${escapeHtml(text)}</span>`;
    })
    .join("");

  function renderMissing(title, items = []) {
    return `<div class="missing-col"><b>${escapeHtml(title)}</b>${items.map(item =>
      `<span class="missing-chip"><span>${escapeHtml(item.number)}</span><i>${Number(item.drawsMissing) || 0}d</i></span>`
    ).join("")}</div>`;
  }

  const GROUP_STATUS = Object.freeze({
    below_record: { label: "Below Record", icon: "🟢" },
    near_record: { label: "Near Record", icon: "🟠" },
    record_reached: { label: "Record Reached", icon: "🔴" },
    new_record: { label: "New Record in Progress", icon: "🔵" },
    limited_history: { label: "Limited History", icon: "⚪" }
  });

  function days(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${Math.max(0, Math.ceil(n))} days` : "—";
  }

  const GROUP_STATUS_PRIORITY = Object.freeze({ new_record: 5, record_reached: 4, near_record: 3, below_record: 2, limited_history: 1 });
  const GROUP_ROUND_PRIORITY = Object.freeze({ BOTH: 3, FR: 2, SR: 1 });

  function roundItem(group = {}, key = "fr") {
    const upper = key.toUpperCase();
    const direct = group?.rounds?.[key] || group?.rounds?.[upper] || group?.[key] || group?.[upper];
    if (direct && typeof direct === "object") return direct;
    const analysis = group?.analysis;
    if (analysis && String(analysis.round || group.round || "").toUpperCase() === upper) return analysis;
    return {};
  }

  function mergeRounds(primary = {}, fallback = {}) {
    return {
      fr: { ...roundItem(fallback, "fr"), ...roundItem(primary, "fr") },
      sr: { ...roundItem(fallback, "sr"), ...roundItem(primary, "sr") },
      both: { ...roundItem(fallback, "both"), ...roundItem(primary, "both") }
    };
  }

  function topMissingGroups(groupAnalysis = {}) {
    const legacyGroups = [...(groupAnalysis.eightNumber || []), ...(groupAnalysis.fourNumber || [])];
    const legacyByLabel = new Map(legacyGroups.map(group => [String(group?.label || ""), group]));
    const supplied = Array.isArray(groupAnalysis.topMissing) ? groupAnalysis.topMissing : [];
    const source = supplied.length ? supplied.map(item => {
      const legacy = legacyByLabel.get(String(item?.label || "")) || {};
      return { ...legacy, ...item, rounds: mergeRounds(item, legacy) };
    }) : legacyGroups.map(item => ({ ...item, rounds: mergeRounds(item) }));

    const compare = (a, b) => (Number(b.analysis?.currentGap) || 0) - (Number(a.analysis?.currentGap) || 0) ||
      (GROUP_STATUS_PRIORITY[b.analysis?.status] || 0) - (GROUP_STATUS_PRIORITY[a.analysis?.status] || 0) ||
      String(a.label || "").localeCompare(String(b.label || ""), undefined, { numeric: true });

    const normalized = source.map(group => {
      const both = roundItem(group, "both");
      return { ...group, round: "BOTH", analysis: both };
    }).filter(group => group.label && group.numbers?.length && Number(group.analysis?.currentGap) > 0);

    const four = normalized.filter(group => (Number(group.size) || group.numbers.length) === 4).sort(compare).slice(0, 2);
    const eight = normalized.filter(group => (Number(group.size) || group.numbers.length) === 8).sort(compare).slice(0, 3);
    return [...four, ...eight].sort(compare).slice(0, 5).map((item, index) => ({ ...item, rank: index + 1 }));
  }

  function renderRoundBadges(group = {}) {
    return ["fr", "sr", "both"].map(roundKey => {
      const item = roundItem(group, roundKey);
      const round = String(item.round || roundKey).toUpperCase();
      return `<span class="formula-round-badge round-${escapeHtml(roundKey)}">${escapeHtml(round)} • ${days(item.currentGap)}</span>`;
    }).join("");
  }

  function renderGroupCards(groups = []) {
    return groups.slice(0, 5).map((group, index) => {
      const item = group.analysis || {};
      const statusKey = String(item.status || "below_record");
      const status = GROUP_STATUS[statusKey] || GROUP_STATUS.below_record;
      const numbers = (group.numbers || []).map(number => `<span>${escapeHtml(number)}</span>`).join("");
      const rank = Math.max(1, Number(group.rank) || index + 1);
      return `<article class="formula-gap-card" data-gap-status="${escapeHtml(statusKey)}"><span class="formula-rank">${rank}</span><div class="formula-identity"><strong>${escapeHtml(group.label)}</strong><div class="formula-number-grid">${numbers}</div></div><div class="formula-rounds">${renderRoundBadges(group)}</div><dl class="formula-gap-meta"><div><dt>Last Seen</dt><dd>${escapeHtml(fmtDate(item.lastSeen))}</dd></div><div><dt>Longest Period</dt><dd>${days(item.longestPeriod ?? group.longestPeriod ?? group.categoryLongestPeriod ?? group.rounds?.both?.longestPeriod)}</dd></div><div><dt>Status</dt><dd><span class="group-status group-status-${escapeHtml(statusKey)}">${status.icon}<span>${escapeHtml(status.label)}</span></span></dd></div></dl></article>`;
    }).join("") || '<p class="empty">Insufficient historical data.</p>';
  }

  function renderGroupAnalysis(groups = []) {
    return `<section class="group-analysis-panel"><div class="group-analysis-heading"><div><h4>Most Missing Formula Groups</h4></div><span class="metric-badge">${groups.length} groups</span></div><div class="formula-gap-grid">${renderGroupCards(groups)}</div></section>`;
  }

  function renderCommonNumbers(data = {}) {
    const target = document.getElementById(`${prefix}-common-card`);
    if (!target) return;
    if (!data || data.empty) {
      target.innerHTML = '<article class="game-card"><div class="game-body"><p class="empty">Common-number statistics are temporarily unavailable.</p></div></article>';
      return;
    }

    const common = data.commonNumbers || {};
    const stats = data.statistics || {};
    const previous = data.previousResult || {};
    const sample = data.historicalSample || {};
    const performanceRows = (data.performance || []).map(item => {
      const status = String(item.status || "miss").toLowerCase();
      const statusClass = status === "miss" ? "performance-miss" : status === "hit_both" ? "performance-both" : status === "hit_fr" ? "performance-fr" : "performance-sr";
      return `<tr><td><span class="performance-date">${escapeHtml(fmtDate(item.date))}</span></td><td><span class="round-number round-fr">${escapeHtml(item.fr || "XX")}</span></td><td><span class="round-number round-sr">${escapeHtml(item.sr || "XX")}</span></td><td><span class="performance-badge ${statusClass}">${escapeHtml(item.label || "Miss")}</span></td></tr>`;
    }).join("");
    const flowItems = data.flow || [];
    const flowValues = flowItems.map(item => Number(item.fr)).filter(Number.isFinite);
    const flowMin = flowValues.length ? Math.min(...flowValues) : 0;
    const flowMax = flowValues.length ? Math.max(...flowValues) : 99;
    const flowRange = Math.max(1, flowMax - flowMin);
    const flow = flowItems.map((item, index) => {
      const value = Number(item.fr);
      const normalizedHeight = Number.isFinite(value) ? 28 + ((value - flowMin) / flowRange) * 62 : 28;
      const shortDate = item.date ? fmtDate(item.date).slice(0, 5) : `#${index + 1}`;
      return `<div class="flow-item"><span class="flow-value">${escapeHtml(item.fr || "XX")}</span><div class="flow-track"><i style="height:${Math.round(normalizedHeight)}%"></i></div><small>${escapeHtml(shortDate)}</small></div>`;
    }).join("");
    const sameDate = (stats.sameDateHistory || []).map(item =>
      `<span class="history-item">${escapeHtml(item.fr)}-${escapeHtml(item.sr)}</span>`
    ).join("");

    target.innerHTML = `<article class="game-card" data-game="${escapeHtml(GAME_ID)}">
      <div class="game-head"><div><h2>${escapeHtml(game.name)} Common Numbers and Statistics for ${escapeHtml(fmtDate(data.publicationDate || data.sourceDate))}</h2><div class="result-line">Published at ${escapeHtml(COMMON_PUBLICATION_TIMES[GAME_ID] || "")}</div></div></div>
      <div class="game-body">
        <section class="common-side">
          <div class="panel-label">🔢 Common Numbers</div>
          <div class="previous-card"><div><div class="prev-label">Previous Result</div><div class="prev-result">${escapeHtml(previous.fr || "XX")} - ${escapeHtml(previous.sr || "XX")}</div><div class="prev-date">${escapeHtml(fmtDate(previous.date))}</div></div><div class="mini-timer">FR Time<br><span class="unlock-badge">${escapeHtml(fmtClock(game.rounds.fr))}</span></div></div>
          <div class="two-col"><div class="box"><h3>House</h3><div class="num-row">${chips(common.house, "digit", true)}</div></div><div class="box"><h3>Ending</h3><div class="num-row">${chips(common.ending, "digit", true)}</div></div></div>
          <div class="box"><h3>Direct Common Numbers</h3><div class="direct-grid">${chips(common.direct, "direct")}</div></div>
          <div class="accuracy"><div class="accuracy-top"><b>Historical sample</b><span>${Number(sample.total) || 0} checks · ${Number(sample.rate) || 0}%</span></div><div class="bar"><i style="width:${Math.max(0, Math.min(100, Number(sample.rate) || 0))}%"></i></div></div>
          <section class="performance-panel" aria-labelledby="${prefix}-performance-title">
            <div class="performance-heading"><div><span class="performance-kicker">Recent validation</span><h4 id="${prefix}-performance-title">Last 7 Results Performance</h4></div><span class="performance-count">${(data.performance || []).length} records</span></div>
            <div class="performance-table-wrap"><table class="performance-table"><thead><tr><th>Date</th><th>FR</th><th>SR</th><th>Performance</th></tr></thead><tbody>${performanceRows}</tbody></table></div>
          </section>
          <section class="trend-chart flow-panel" aria-label="Last 7 FR result flow">
            <div class="flow-heading"><div><span class="performance-kicker">Number movement</span><h4>Last 7 FR Result Flow</h4></div><span class="flow-range">${flowMin}–${flowMax}</span></div>
            <div class="flow-grid">${flow}</div>
          </section>
          <div class="substats">
            <div class="subbox"><div class="metric-title"><h4>Same Date History</h4><span class="metric-badge">Past years</span></div>${sameDate || '<small class="empty">No historical data</small>'}</div>
            <div class="subbox"><div class="metric-title"><h4>${escapeHtml(stats.weekday || "Weekday")} Pattern</h4><span class="metric-badge">Same weekday</span></div>${chips(stats.weekdayPattern, "pattern-item")}</div>
            <div class="subbox"><div class="metric-title"><h4>Last 7 Days Trend</h4><span class="metric-badge">Recent</span></div>${chips(stats.recentTrend, "history-item")}</div>
            <div class="subbox"><div class="metric-title"><h4>Repeated Numbers</h4><span class="metric-badge">Recent</span></div>${chips(stats.repeated)}</div>
            <div class="subbox pair-block span-2"><h4>Repeated FR-SR Pairs</h4>${chips(stats.repeatedPairs, "chip pair")}</div>
          </div>
        </section>
        <section class="stats-side">
          <div class="panel-label">📊 Statistics</div>
          <div class="stats-main"><div class="metric-title"><h3>Most Frequent Historical Numbers</h3><span class="metric-badge">All records</span></div><div class="stats-grid">${chips(stats.frequent, "statnum")}</div></div>
          <div class="insight-grid"><div class="insight-box"><h4>🔥 Hot Numbers</h4>${chips(stats.hot)}</div><div class="insight-box"><h4>❄️ Long-Missing Numbers</h4>${chips(stats.cold, "chip cold")}</div></div>
          <div class="group-analysis-stack">${renderGroupAnalysis(topMissingGroups(stats.groupAnalysis))}</div>
        </section>
      </div>
      <div class="analytics-wide">
        <div class="blocked-panel analytics-full"><h4>🚫 Longest Missing by Round</h4><div class="missing-grid">${renderMissing("FR", stats.missing?.fr)}${renderMissing("SR", stats.missing?.sr)}${renderMissing("Both", stats.missing?.both)}</div></div>
      </div>
    </article>`;
  }

  async function fetchCommonNumbers() {
    if (loadingCommonNumbers) return loadingCommonNumbers;
    loadingCommonNumbers = (async () => {
      const response = await fetch(COMMON_NUMBERS_URL, { cache: "no-store", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error(`Common numbers request failed: ${response.status}`);
      const payload = await response.json();
      return payload?.games?.[GAME_ID] || null;
    })();
    try {
      return await loadingCommonNumbers;
    } finally {
      loadingCommonNumbers = null;
    }
  }

  async function loadPlan() {
    try {
      const response = await fetch(POLLING_PLAN_URL, {
        cache: "no-store",
        referrerPolicy: "no-referrer"
      });
      if (response.ok) { pollingPlan = await response.json(); updateMonitoringBanner(); }
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

  function restoreCachedState() {
    const latest = readCache("latest");
    const recent = readCache("recent");
    const common = readCache("common");

    if (latest && typeof latest === "object") renderResult(latest);
    if (Array.isArray(recent)) renderHistory(recent);
    if (common && typeof common === "object") renderCommonNumbers(common);
  }

  async function refresh(manual = true) {
    const initialLoad = latestVersion === null;
    let versionChanged = manual || initialLoad;

    if (!manual && !initialLoad) {
      try {
        const nextVersion = await fetchLatestVersion();
        versionChanged = nextVersion !== latestVersion;
        latestVersion = nextVersion;
      } catch (error) {
        versionChanged = true;
        console.warn(`${GAME_ID} latest version check failed; falling back to latest results:`, error);
      }
    }

    if (!versionChanged) return;

    const previousSignature = latestRecordSignature;
    let latestRendered = false;
    let gameRecordChanged = manual || initialLoad;

    // On initial load and manual refresh, start the independent data requests together.
    // Await the compact latest payload first so the live result can render before the
    // larger recent-history and common-number responses complete.
    const latestPromise = fetchLatest();
    const recentPromise = manual || initialLoad ? fetchRecent() : null;
    const commonPromise = manual || initialLoad ? fetchCommonNumbers() : null;

    try {
      const latest = await latestPromise;
      if (latest && Object.keys(latest).length) {
        const nextSignature = resultSignature(latest);
        gameRecordChanged = gameRecordChanged || nextSignature !== previousSignature;
        latestRendered = renderResult(latest) !== false;
        if (latestRendered || gameRecordChanged) writeCache("latest", latest);
      }
    } catch (error) {
      console.warn(`${GAME_ID} latest result refresh failed:`, error);
      gameRecordChanged = true;
    }

    // recent-results.json is substantially larger than latest-results.json. During
    // polling, fetch it only when this game's own record changed. Initial/manual loads
    // use the already-started independent promise above.
    if (gameRecordChanged) {
      try {
        const recent = await (recentPromise || fetchRecent());
        if (renderHistory(recent) !== false) writeCache("recent", recent);
        if (!latestRendered && recent[0] && !latestRecord) renderResult(recent[0]);
      } catch (error) {
        console.warn(`${GAME_ID} recent result refresh failed:`, error);
      }
    }

    if (manual || initialLoad) {
      try {
        const common = await commonPromise;
        if (common) {
          renderCommonNumbers(common);
          writeCache("common", common);
        }
      } catch (error) {
        console.warn(`${GAME_ID} common numbers refresh failed:`, error);
      }

      try {
        latestVersion = await fetchLatestVersion();
      } catch (error) {
        console.warn(`${GAME_ID} latest version baseline failed:`, error);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindPopup();
    restoreCachedState();
    byId("refresh")?.addEventListener("click", () => refresh(true));
    await Promise.allSettled([loadPlan(), refresh(false)]);
    updateMonitoringBanner();
    monitoringTimer = setInterval(updateMonitoringBanner, 30000);
    schedule();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(timer);
      return;
    }
    refresh(false);
    updateMonitoringBanner();
    schedule();
  });
  window.addEventListener("pagehide", () => clearInterval(monitoringTimer), { once: true });
})();
