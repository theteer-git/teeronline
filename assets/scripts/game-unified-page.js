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
    SHN2: "6:10 PM"
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
  const ALL_RESULTS_URL = config.endpoints.allResults || RECENT_URL.replace(/recent-results\.json(?:\?.*)?$/i, "all-results.json");

  let loadingLatest = null;
  let loadingLatestVersion = null;
  let latestVersion = null;
  let loadingRecent = null;
  let timer = null;
  let pollingPlan = null;
  let loadingCommonNumbers = null;
  let loadingAllResults = null;
  let allResultRecords = [];
  let latestCommonData = null;
  let latestResultRecord = null;

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

  const CACHE_SCHEMA = 2;
  const CACHE_PREFIX = `teeronline:${CACHE_SCHEMA}:${GAME_ID}:`;
  const CACHE_TTL = Object.freeze({
    latest: 36 * 60 * 60 * 1000,
    recent: 7 * 24 * 60 * 60 * 1000,
    common: 7 * 24 * 60 * 60 * 1000,
    all: 7 * 24 * 60 * 60 * 1000
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
      const record = normalizeItem(data?.records?.[GAME_ID] ?? data?.[GAME_ID] ?? {});
      latestResultRecord = record?.date ? record : latestResultRecord;
      return record;
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

  function renderResult(record = {}, options = {}) {
    if (record?.date) latestResultRecord = normalizeItem(record);
    const fr = num(record.fr);
    const sr = num(record.sr);

    // A new pending record is created in latest-results.json before the page's
    // scheduled publication window. Do not let that background placeholder
    // overwrite the still-current static page. The GitHub page and the due
    // game's common-number payload are published together; once their dates
    // match, the pending date/XX-XX may be shown. Real partial/completed results
    // are never hidden.
    const fullyPending = fr === "XX" && sr === "XX";
    const publishedDate = String(latestCommonData?.publicationDate || latestCommonData?.sourceDate || "");
    if (fullyPending && record?.date && publishedDate !== String(record.date)) return;
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

    // The weekly table is rendered from the common-numbers panel. Re-render it
    // whenever the live record changes so today's row immediately receives the
    // latest FR/SR values, including partial results.
    if (options.refreshCommon !== false && latestCommonData) renderCommonNumbers(latestCommonData);
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



  const DAY_GAMES_WITH_SUNDAY_OFF = new Set(["SHD", "KH", "JWD"]);
  const WEEKDAYS = Object.freeze(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);

  function parseLocalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isoLocalDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function startOfWeek(value) {
    const date = parseLocalDate(value) || new Date();
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(date.getDate() + mondayOffset);
    return monday;
  }

  function normaliseResultRecord(item = {}) {
    return {
      date: String(item.date || item.d || ""),
      fr: num(item.fr ?? item.f),
      sr: num(item.sr ?? item.s)
    };
  }

  function currentWeekRows(referenceDate, records = []) {
    const monday = startOfWeek(referenceDate);
    const recordMap = new Map((records || []).map(item => {
      const row = normaliseResultRecord(item);
      return [row.date, row];
    }));
    return WEEKDAYS.map((dayName, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const dateKey = isoLocalDate(date);
      const record = recordMap.get(dateKey);
      const off = index === 6 && DAY_GAMES_WITH_SUNDAY_OFF.has(GAME_ID);
      return {
        dayName,
        date: dateKey,
        fr: off ? "OFF" : (record?.fr || "XX"),
        sr: off ? "OFF" : (record?.sr || "XX"),
        off
      };
    });
  }

  function renderWeekTable(rows = []) {
    return `<div class="week-table-wrap"><table class="week-table"><thead><tr><th>Day</th><th>FR</th><th>SR</th></tr></thead><tbody>${rows.map(row => `<tr${row.off ? ' class="off-day"' : ""}><td><strong>${escapeHtml(row.dayName)}</strong><small>${escapeHtml(fmtDate(row.date).slice(0, 5))}</small></td><td>${escapeHtml(row.fr)}</td><td>${escapeHtml(row.sr)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function valueAndCount(item) {
    if (item && typeof item === "object") {
      const value = item.number ?? item.value ?? item.pair ?? item.label ?? item.result ?? "";
      const count = Number(item.count ?? item.frequency ?? item.occurrences ?? item.times ?? 0);
      return { value: String(value), count: Number.isFinite(count) ? count : 0 };
    }
    const text = String(item ?? "");
    const match = text.match(/^(.+?)\s*(?:\(|\[)?(\d+)\s*[x×](?:\)|\])?$/i);
    return match ? { value: match[1].trim(), count: Number(match[2]) } : { value: text, count: 0 };
  }

  function countedValues(items = [], formatter = value => value) {
    const counts = new Map();
    for (const item of items || []) {
      const parsed = valueAndCount(item);
      if (!parsed.value) continue;
      const key = formatter(parsed.value);
      const increment = parsed.count > 0 ? parsed.count : 1;
      counts.set(key, (counts.get(key) || 0) + increment);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
      .map(([value, count]) => ({ value, count }));
  }

  function renderCountedChips(items = [], className = "chip") {
    const rows = countedValues(items, value => value.includes("-") ? value.split("-").map(part => num(part)).join("-") : num(value));
    return rows.length ? rows.map(item => `<span class="${className}"><b>${escapeHtml(item.value)}</b><small>${item.count}×</small></span>`).join("") : '<small class="empty">No repeated values in the available range.</small>';
  }

  function sameDateHistoryRows(items = []) {
    return (items || []).map(item => {
      const date = String(item?.date || item?.year || "");
      const yearMatch = date.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : "";
      const fr = num(item?.fr ?? item?.f);
      const sr = num(item?.sr ?? item?.s);
      return year ? `<span class="history-item history-with-year"><b>${escapeHtml(year)}</b><i>→</i><span>${escapeHtml(fr)}-${escapeHtml(sr)}</span></span>` : "";
    }).filter(Boolean).join("");
  }

  function extractGameRecords(payload) {
    const candidates = [];
    if (Array.isArray(payload)) candidates.push(...payload);
    if (Array.isArray(payload?.records)) candidates.push(...payload.records);
    if (Array.isArray(payload?.results)) candidates.push(...payload.results);
    if (Array.isArray(payload?.games?.[GAME_ID])) candidates.push(...payload.games[GAME_ID]);
    if (Array.isArray(payload?.[GAME_ID])) candidates.push(...payload[GAME_ID]);

    return candidates
      .filter(item => {
        const itemGameId = String(item?.gameId || item?.game || item?.g || "").toUpperCase();
        return !itemGameId || itemGameId === GAME_ID;
      })
      .map(normaliseResultRecord)
      .filter(item => item.date && /^\d{2}$/.test(item.fr) && /^\d{2}$/.test(item.sr));
  }

  function saturdayHistoryRows(records = []) {
    const rows = (records || [])
      .map(normaliseResultRecord)
      .filter(item => {
        const date = parseLocalDate(item.date);
        return date && date.getDay() === 6 && /^\d{2}$/.test(item.fr) && /^\d{2}$/.test(item.sr);
      })
      .sort((a, b) => dateValue(b.date) - dateValue(a.date))
      .filter((item, index, list) => index === list.findIndex(other => other.date === item.date))
      .slice(0, 6);

    if (!rows.length) return '<small class="empty">No completed Saturday FR/SR history available.</small>';

    return `<div class="saturday-table-wrap"><table class="saturday-table"><thead><tr><th>Date</th><th>FR</th><th>SR</th></tr></thead><tbody>${rows.map(item => `<tr><td><strong>${escapeHtml(fmtDate(item.date).slice(0, 5))}</strong></td><td>${escapeHtml(item.fr)}</td><td>${escapeHtml(item.sr)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function completedWeekNumbers(rows = []) {
    return rows.flatMap(row => [row.fr, row.sr]).filter(value => /^\d{2}$/.test(String(value)));
  }

  function renderWeeklyInsights(rows = []) {
    const values = completedWeekNumbers(rows);
    if (values.length < 2) return '<p class="empty">Not enough completed results this week.</p>';
    const numberCounts = new Map();
    const houseCounts = new Map();
    let even = 0;
    let odd = 0;
    let low = 0;
    let high = 0;
    values.forEach(value => {
      numberCounts.set(value, (numberCounts.get(value) || 0) + 1);
      const house = value.charAt(0);
      houseCounts.set(house, (houseCounts.get(house) || 0) + 1);
      const n = Number(value);
      n % 2 === 0 ? even++ : odd++;
      n <= 49 ? low++ : high++;
    });
    const repeated = [...numberCounts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0])).slice(0, 4);
    const activeHouse = [...houseCounts.entries()].sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0];
    return `<div class="weekly-insight-grid"><article><span>Most Repeated Numbers</span><strong>${repeated.length ? repeated.map(([value, count]) => `${escapeHtml(value)} (${count}×)`).join(", ") : "No repeats yet"}</strong></article><article><span>Most Active House</span><strong>${activeHouse ? `House ${escapeHtml(activeHouse[0])} · ${activeHouse[1]} appearances` : "—"}</strong></article><article><span>Even vs Odd</span><strong>Even ${even} · Odd ${odd}</strong></article><article><span>High vs Low</span><strong>00–49: ${low} · 50–99: ${high}</strong></article></div>`;
  }

  function renderCommonNumbers(data = {}) {
    latestCommonData = data;
    if (latestResultRecord?.date) renderResult(latestResultRecord, { refreshCommon: false });
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
    // Merge historical, common-number performance and the live result. The
    // live record is intentionally last so it wins for today's date and can
    // supply FR-only or FR+SR without waiting for all-results.json to refresh.
    const weekSource = [
      ...allResultRecords,
      ...(data.performance || []),
      ...(data.flow || []),
      ...(latestResultRecord?.date ? [latestResultRecord] : [])
    ];
    const weekReferenceDate = latestResultRecord?.date || data.publicationDate || data.sourceDate || previous.date;
    const weekRows = currentWeekRows(weekReferenceDate, weekSource);
    const sameDate = sameDateHistoryRows(stats.sameDateHistory || []);
    const saturdayPattern = saturdayHistoryRows(allResultRecords);

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
          <section class="week-results-panel" aria-labelledby="${prefix}-week-results-title">
            <div class="flow-heading"><div><span class="performance-kicker">Monday → Sunday</span><h4 id="${prefix}-week-results-title">This Week’s Results</h4></div><span class="flow-range">FR · SR</span></div>
            ${renderWeekTable(weekRows)}
          </section>
          <div class="substats enhanced-substats">
            <div class="subbox"><div class="metric-title"><h4>Same Date History</h4><span class="metric-badge">Past years</span></div>${sameDate || '<small class="empty">No historical data</small>'}</div>
            <div class="subbox"><div class="metric-title"><h4>Last 6 Saturdays</h4><span class="metric-badge">FR · SR history</span></div>${saturdayPattern}</div>
            <div class="subbox span-2 weekly-insights"><div class="metric-title"><h4>This Week’s Insights</h4><span class="metric-badge">Completed rounds</span></div>${renderWeeklyInsights(weekRows)}</div>
            <div class="subbox"><div class="metric-title"><h4>Repeated Numbers</h4><span class="metric-badge">With frequency</span></div><div class="frequency-chip-row">${renderCountedChips(stats.repeated)}</div></div>
            <div class="subbox pair-block"><div class="metric-title"><h4>Repeated FR-SR Pairs</h4><span class="metric-badge">With frequency</span></div><div class="frequency-chip-row">${renderCountedChips(stats.repeatedPairs, "chip pair frequency-chip")}</div></div>
          </div>
        </section>
        <section class="stats-side">
          <div class="panel-label">📊 Statistics</div>
          <div class="stats-main"><div class="metric-title"><div><h3>Most Frequent Historical Numbers</h3><p class="metric-explanation">Numbers with the highest occurrence across all available historical records.</p></div><span class="metric-badge">All records</span></div><div class="stats-grid">${chips(stats.frequent, "statnum")}</div></div>
          <div class="insight-grid"><div class="insight-box"><h4>🔥 Hot Numbers</h4><p class="metric-explanation">Numbers appearing most frequently in recent completed draws.</p>${chips(stats.hot)}</div><div class="insight-box"><h4>❄️ Long-Missing Numbers</h4><p class="metric-explanation">Numbers that have not appeared for an extended period in the available records.</p>${chips(stats.cold, "chip cold")}</div></div>
          <div class="group-analysis-stack">${renderGroupAnalysis(topMissingGroups(stats.groupAnalysis))}</div>
        </section>
      </div>
      <div class="analytics-wide">
        <div class="blocked-panel analytics-full"><h4>🚫 Longest Missing by Round</h4><div class="missing-grid">${renderMissing("FR", stats.missing?.fr)}${renderMissing("SR", stats.missing?.sr)}${renderMissing("Both", stats.missing?.both)}</div></div>
      </div>
    </article>`;
  }

  async function fetchAllResults() {
    if (loadingAllResults) return loadingAllResults;
    loadingAllResults = (async () => {
      const response = await fetch(ALL_RESULTS_URL, { cache: "no-store", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error(`All results request failed: ${response.status}`);
      return extractGameRecords(await response.json());
    })();
    try {
      return await loadingAllResults;
    } finally {
      loadingAllResults = null;
    }
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
    const adaptive = adaptivePollingInterval(latestResultRecord);
    if (adaptive === TASK12_POLL.HOT_MS) return adaptive;
    const gamePlan = pollingPlan?.games?.[GAME_ID];
    const activeIntervals = Object.values(gamePlan?.rounds || {})
      .filter(round => round?.active)
      .map(round => Number(round.intervalMs))
      .filter(value => Number.isFinite(value) && value > 0);
    const planned = activeIntervals.length ? Math.min(...activeIntervals) : TASK12_POLL.IDLE_MS;
    return Math.max(TASK12_POLL.HOT_MS, Math.min(TASK12_POLL.IDLE_MS, planned));
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
    const all = readCache("all");

    if (Array.isArray(all)) allResultRecords = all;
    if (latest && typeof latest === "object") renderResult(latest);
    if (Array.isArray(recent)) renderHistory(recent);
    if (common && typeof common === "object") renderCommonNumbers(common);
  }

  async function refresh(manual = true) {
    const initialLoad = latestVersion === null;
    let versionChanged = manual || initialLoad;

    // Initial rendering should not wait for a version round-trip. The full payload and
    // fingerprint are requested together, allowing the result card to update first.
    if (!manual && !initialLoad) {
      try {
        const nextVersion = await fetchLatestVersion();
        versionChanged = nextVersion !== latestVersion;
        latestVersion = nextVersion;
      } catch (error) {
        // Safe fallback: preserve live updates even if the tiny version object is unavailable.
        versionChanged = true;
        console.warn(`${GAME_ID} latest version check failed; falling back to latest results:`, error);
      }
    }

    if (!versionChanged) return;

    const latestPromise = fetchLatest();
    const recentPromise = fetchRecent();
    const commonPromise = manual || initialLoad ? fetchCommonNumbers() : null;
    const allResultsPromise = manual || initialLoad ? fetchAllResults() : null;
    const versionPromise = manual || initialLoad ? fetchLatestVersion() : null;

    let latestRendered = false;
    try {
      const latest = await latestPromise;
      if (latest && Object.keys(latest).length) {
        renderResult(latest);
        writeCache("latest", latest);
        latestRendered = true;
      }
    } catch (error) {
      console.warn(`${GAME_ID} latest result refresh failed:`, error);
    }

    try {
      const recent = await recentPromise;
      renderHistory(recent);
      writeCache("recent", recent);
      if (!latestRendered && recent[0]) {
        renderResult(recent[0]);
      }
    } catch (error) {
      console.warn(`${GAME_ID} recent result refresh failed:`, error);
    }

    if (allResultsPromise) {
      try {
        allResultRecords = await allResultsPromise;
        writeCache("all", allResultRecords);
        if (latestCommonData) renderCommonNumbers(latestCommonData);
      } catch (error) {
        console.warn(`${GAME_ID} all-results refresh failed:`, error);
      }
    }

    if (commonPromise) {
      try {
        const common = await commonPromise;
        if (common) {
          renderCommonNumbers(common);
          writeCache("common", common);
        }
      } catch (error) {
        console.warn(`${GAME_ID} common numbers refresh failed:`, error);
      }
    }

    if (versionPromise) {
      try {
        latestVersion = await versionPromise;
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
