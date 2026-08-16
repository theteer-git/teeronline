(() => {
  "use strict";

  const LATEST_URL = "https://results.teeronline.com/latest-results.json";
  const RECENT_URL = "https://results.teeronline.com/recent-results.json";

  const validNumber = value => /^(?:\d{1,2})$/.test(String(value ?? "").trim());
  const normalizedNumber = value => String(value).trim().padStart(2, "0");

  function normalizeDate(value) {
    const text = String(value ?? "").trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const display = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (display) return `${display[3]}-${display[2]}-${display[1]}`;

    return "";
  }

  function displayDate(value) {
    const iso = normalizeDate(value);
    if (!iso) return "--";
    const [year, month, day] = iso.split("-");
    return `${day}-${month}-${year}`;
  }

  function extractLatestRecord(payload, gameId) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.records && payload.records[gameId]) return payload.records[gameId];
    if (payload[gameId] && typeof payload[gameId] === "object") return payload[gameId];
    if (Array.isArray(payload.records)) {
      return payload.records.find(item => String(item?.gameId || item?.g || "").toUpperCase() === gameId) || null;
    }
    return null;
  }

  function collectRecentRecords(payload, gameId) {
    const candidates = [];

    const add = item => {
      if (!item || typeof item !== "object") return;
      const itemGame = String(item.gameId || item.game || item.g || gameId).toUpperCase();
      if (itemGame !== gameId) return;

      const date = normalizeDate(item.date || item.d);
      const fr = item.fr ?? item.f;
      const sr = item.sr ?? item.s;

      if (!date || !validNumber(fr) || !validNumber(sr)) return;
      candidates.push({
        date,
        fr: normalizedNumber(fr),
        sr: normalizedNumber(sr)
      });
    };

    const walk = value => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(add);
        return;
      }
      if (typeof value !== "object") return;

      if (Array.isArray(value[gameId])) value[gameId].forEach(add);
      if (value.records) {
        if (Array.isArray(value.records)) value.records.forEach(add);
        else if (Array.isArray(value.records[gameId])) value.records[gameId].forEach(add);
        else if (value.records[gameId]) walk(value.records[gameId]);
      }
      if (value.games?.[gameId]) walk(value.games[gameId]);
      if (value.data?.[gameId]) walk(value.data[gameId]);
      if (Array.isArray(value.results)) value.results.forEach(add);
    };

    walk(payload);

    const unique = new Map();
    candidates.forEach(item => unique.set(item.date, item));
    return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date));
  }

  function removeLeadingZeroesFromDigits() {
    document.querySelectorAll(".common-side .two-col .digit").forEach(element => {
      const value = element.textContent.trim();
      if (validNumber(value)) element.textContent = String(Number(value));
    });
  }

  function updatePreviousResult(record) {
    if (!record) return;
    document.querySelectorAll(".common-side .previous-card").forEach(card => {
      const result = card.querySelector(".prev-result");
      const date = card.querySelector(".prev-date");
      if (result) result.textContent = `${record.fr} - ${record.sr}`;
      if (date) date.textContent = displayDate(record.date);
    });
  }

  async function refreshPreviousResult() {
    const gameId = String(document.body.dataset.gameId || "").toUpperCase();
    if (!gameId) return;

    try {
      const cacheBust = Date.now();
      const [latestResponse, recentResponse] = await Promise.all([
        fetch(`${LATEST_URL}?v=${cacheBust}`, { cache: "no-store" }),
        fetch(`${RECENT_URL}?v=${cacheBust}`, { cache: "no-store" })
      ]);

      if (!latestResponse.ok || !recentResponse.ok) return;

      const [latestPayload, recentPayload] = await Promise.all([
        latestResponse.json(),
        recentResponse.json()
      ]);

      const latestRecord = extractLatestRecord(latestPayload, gameId);
      const currentDate = normalizeDate(latestRecord?.date || latestPayload?.date);
      const records = collectRecentRecords(recentPayload, gameId);

      const previous = currentDate
        ? records.find(record => record.date < currentDate)
        : records[0];

      updatePreviousResult(previous || records[0]);
    } catch (error) {
      console.warn("[COMMON NUMBERS] Previous-result refresh failed", error);
    }
  }

  function init() {
    removeLeadingZeroesFromDigits();
    refreshPreviousResult();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();