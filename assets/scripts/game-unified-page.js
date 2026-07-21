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
  const COMMON_NUMBERS_URL = config.endpoints.commonNumbers;

  let loadingLatest = null;
  let loadingRecent = null;
  let timer = null;
  let pollingPlan = null;
  let loadingCommonNumbers = null;

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
    normal: { label: "Normal", icon: "🟢" },
    above_average: { label: "Above Average", icon: "🟡" },
    near_max: { label: "Near Historical Max", icon: "🟠" },
    max_reached: { label: "Historical Max Reached", icon: "🔴" },
    new_record: { label: "New Historical Record", icon: "🔵" },
    insufficient_history: { label: "Limited History", icon: "⚪" }
  });

  function days(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${Math.max(0, Math.ceil(n))} days` : "—";
  }

  const GROUP_STATUS_PRIORITY = Object.freeze({ new_record: 6, max_reached: 5, near_max: 4, above_average: 3, insufficient_history: 2, normal: 1 });
  const GROUP_ROUND_PRIORITY = Object.freeze({ BOTH: 3, FR: 2, SR: 1 });

  function topMissingGroups(groupAnalysis = {}) {
    if (Array.isArray(groupAnalysis.topMissing) && groupAnalysis.topMissing.length) return groupAnalysis.topMissing.slice(0, 5);
    const groups = [...(groupAnalysis.eightNumber || []), ...(groupAnalysis.fourNumber || [])];
    return groups.map(group => {
      const analyses = ["fr", "sr", "both"].map(key => group.rounds?.[key]).filter(Boolean).sort((a, b) =>
        (Number(b.currentGap) || 0) - (Number(a.currentGap) || 0) ||
        (GROUP_STATUS_PRIORITY[b.status] || 0) - (GROUP_STATUS_PRIORITY[a.status] || 0) ||
        (GROUP_ROUND_PRIORITY[String(b.round || "").toUpperCase()] || 0) - (GROUP_ROUND_PRIORITY[String(a.round || "").toUpperCase()] || 0)
      );
      return { ...group, round: analyses[0]?.round || "", analysis: analyses[0] || {} };
    }).sort((a, b) =>
      (Number(b.analysis?.currentGap) || 0) - (Number(a.analysis?.currentGap) || 0) ||
      (GROUP_STATUS_PRIORITY[b.analysis?.status] || 0) - (GROUP_STATUS_PRIORITY[a.analysis?.status] || 0) ||
      String(a.label || "").localeCompare(String(b.label || ""), undefined, { numeric: true })
    ).slice(0, 5).map((item, index) => ({ ...item, rank: index + 1 }));
  }

  function renderGroupCards(groups = []) {
    return groups.slice(0, 5).map((group, index) => {
      const item = group.analysis || {};
      const statusKey = String(item.status || "normal");
      const status = GROUP_STATUS[statusKey] || GROUP_STATUS.normal;
      const round = String(group.round || item.round || "").toUpperCase();
      const roundClass = round.toLowerCase();
      const numbers = (group.numbers || []).map(number => `<span>${escapeHtml(number)}</span>`).join("");
      const rank = Math.max(1, Number(group.rank) || index + 1);
      return `<article class="formula-gap-card" data-gap-status="${escapeHtml(statusKey)}"><span class="formula-rank">${rank}</span><div class="formula-gap-top"><strong>${escapeHtml(group.label)}</strong><span class="formula-round-badge round-${escapeHtml(roundClass)}">${escapeHtml(round)} • ${days(item.currentGap)}</span></div><div class="formula-number-grid">${numbers}</div><dl class="formula-gap-meta"><div><dt>Last Seen</dt><dd>${escapeHtml(fmtDate(item.lastSeen))}</dd></div><div><dt>Average Gap</dt><dd>${days(item.averageGap)}</dd></div><div><dt>Status</dt><dd><span class="group-status group-status-${escapeHtml(statusKey)}">${status.icon}<span>${escapeHtml(status.label)}</span></span></dd></div></dl></article>`;
    }).join("") || '<p class="empty">Insufficient historical data.</p>';
  }

  function renderGroupAnalysis(groups = []) {
    return `<section class="group-analysis-panel"><div class="group-analysis-heading"><div><span class="performance-kicker">Completed result-days only</span><h4>Most Missing Formula Groups</h4></div><span class="metric-badge">${groups.length} groups</span></div><div class="formula-gap-grid">${renderGroupCards(groups)}</div><p class="group-analysis-note">The five longest-missing formula groups are ranked across FR, SR and BOTH. Weekly off-days and incomplete result dates are excluded.</p></section>`;
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
      <div class="game-head"><div><h2>${escapeHtml(game.name)} Common Numbers and Statistics for ${escapeHtml(fmtDate(data.sourceDate))}</h2><div class="result-line">Historical reference prepared from completed records</div></div><span class="game-id">${escapeHtml(GAME_ID)}</span></div>
      <div class="game-body">
        <section class="common-side">
          <div class="panel-label">🔢 Common Numbers</div>
          <div class="previous-card"><div><div class="prev-label">Previous Result</div><div class="prev-result">${escapeHtml(previous.fr || "XX")} - ${escapeHtml(previous.sr || "XX")}</div><div class="prev-date">${escapeHtml(fmtDate(previous.date))}</div></div><div class="mini-timer">FR Time<br><span class="unlock-badge">${escapeHtml(fmtClock(game.rounds.fr))}</span></div></div>
          <div class="two-col"><div class="box"><h3>House</h3><div class="num-row">${chips(common.house, "digit", true)}</div></div><div class="box"><h3>Ending</h3><div class="num-row">${chips(common.ending, "digit", true)}</div></div></div>
          <div class="box"><h3>Direct Common Numbers</h3><div class="direct-grid">${chips(common.direct, "direct")}</div></div>
          <div class="accuracy"><div class="accuracy-top"><b>Historical sample</b><span>${Number(sample.total) || 0} checks · ${Number(sample.rate) || 0}%</span></div><div class="bar"><i style="width:${Math.max(0, Math.min(100, Number(sample.rate) || 0))}%"></i></div></div>
          <section class="performance-panel" aria-labelledby="${prefix}-performance-title">
            <div class="performance-heading"><div><span class="performance-kicker">Recent validation</span><h3 id="${prefix}-performance-title">Last 7 Results Performance</h3></div><span class="performance-count">${(data.performance || []).length} records</span></div>
            <div class="performance-table-wrap"><table class="performance-table"><thead><tr><th>Date</th><th>FR</th><th>SR</th><th>Performance</th></tr></thead><tbody>${performanceRows}</tbody></table></div>
          </section>
          <section class="trend-chart flow-panel" aria-label="Last 7 FR result flow">
            <div class="flow-heading"><div><span class="performance-kicker">Number movement</span><h4>Last 7 FR Result Flow</h4></div><span class="flow-range">${flowMin}–${flowMax}</span></div>
            <div class="flow-grid">${flow}</div>
          </section>
        </section>
        <section class="stats-side">
          <div class="panel-label">📊 Statistics</div>
          <div class="stats-main"><div class="metric-title"><h3>Most Frequent Historical Numbers</h3><span class="metric-badge">All records</span></div><div class="stats-grid">${chips(stats.frequent, "statnum")}</div><div class="note-strip">Historical statistics only — not a guaranteed prediction.</div></div>
          <div class="substats">
            <div class="subbox"><div class="metric-title"><h4>Same Date History</h4><span class="metric-badge">Past years</span></div>${sameDate || '<small class="empty">No historical data</small>'}</div>
            <div class="subbox"><div class="metric-title"><h4>${escapeHtml(stats.weekday || "Weekday")} Pattern</h4><span class="metric-badge">Same weekday</span></div>${chips(stats.weekdayPattern, "pattern-item")}</div>
            <div class="subbox"><div class="metric-title"><h4>Last 7 Days Trend</h4><span class="metric-badge">Recent</span></div>${chips(stats.recentTrend, "history-item")}</div>
            <div class="subbox"><div class="metric-title"><h4>Repeated Numbers</h4><span class="metric-badge">Recent</span></div>${chips(stats.repeated)}</div>
            <div class="subbox pair-block span-2"><h4>Repeated FR-SR Pairs</h4>${chips(stats.repeatedPairs, "chip pair")}</div>
          </div>
          <div class="insight-grid"><div class="insight-box"><h4>🔥 Hot Numbers</h4>${chips(stats.hot)}</div><div class="insight-box"><h4>❄️ Long-Missing Numbers</h4>${chips(stats.cold, "chip cold")}</div></div>
          <div class="analytics-wide">
            <div class="blocked-panel"><h4>🚫 Longest Missing by Round</h4><div class="missing-grid">${renderMissing("FR", stats.missing?.fr)}${renderMissing("SR", stats.missing?.sr)}${renderMissing("Both", stats.missing?.both)}</div></div>
            <div class="group-analysis-stack">${renderGroupAnalysis(topMissingGroups(stats.groupAnalysis))}</div>
          </div>
        </section>
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
    const [latestResult, recentResult, commonResult] = await Promise.allSettled([
      fetchLatest(),
      fetchRecent(),
      fetchCommonNumbers()
    ]);
    const latest = latestResult.status === "fulfilled" ? latestResult.value : {};
    const recent = recentResult.status === "fulfilled" ? recentResult.value : [];
    if (latestResult.status === "rejected") console.warn(`${GAME_ID} latest result refresh failed:`, latestResult.reason);
    if (recentResult.status === "rejected") console.warn(`${GAME_ID} recent result refresh failed:`, recentResult.reason);
    if (commonResult.status === "fulfilled") renderCommonNumbers(commonResult.value);
    else console.warn(`${GAME_ID} common numbers refresh failed:`, commonResult.reason);
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
