(() => {
  "use strict";

  const root = document.querySelector("[data-live-monitor]");
  if (!root) return;

  const isArchive = root.dataset.monitorType === "archive";
  const gameId = (document.body.dataset.gameId || root.dataset.gameId || "").toUpperCase();
  const endpoint = isArchive
    ? `https://results.teeronline.com/api/game-history?game=${encodeURIComponent(gameId)}`
    : `https://results.teeronline.com/api/game-result?game=${encodeURIComponent(gameId)}`;

  const el = (name) => root.querySelector(`[data-monitor-${name}]`);
  const summary = el("summary");
  const connection = el("connection");
  const freshness = el("freshness");
  const sync = el("sync");
  const state = el("state");
  const note = el("note");
  const retry = root.querySelector("[data-monitor-retry]");

  let lastSuccessAt = 0;
  let lastPayloadAt = 0;
  let lastError = "";
  let checking = false;
  let timer = 0;

  const formatTime = (time) => time
    ? new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
      }).format(new Date(time))
    : "Not checked";

  const formatAge = (ms) => {
    if (!Number.isFinite(ms) || ms < 0) return "Unknown";
    const seconds = Math.floor(ms / 1000);
    if (seconds < 10) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const parseDate = (value) => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const findRecord = (payload) => {
    if (!payload || !gameId) return null;
    if (payload.record && typeof payload.record === "object") return payload.record;
    if (payload.records && !Array.isArray(payload.records)) {
      return payload.records[gameId] || null;
    }
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.records)
        ? payload.records
        : Array.isArray(payload.results)
          ? payload.results
          : [];
    return rows.find((row) =>
      String(row.gameId || row.game || row.g || "").toUpperCase() === gameId
    ) || null;
  };

  const displayedResultState = () => {
    if (isArchive) {
      const count = document.getElementById("resultsCount");
      const table = document.getElementById("resultsTable");
      const rows = table ? table.querySelectorAll("tbody tr").length : 0;
      const text = count ? count.textContent.trim() : "";
      return text || (rows ? `${rows} rows displayed` : "Archive waiting");
    }
    const prefix = gameId.toLowerCase();
    const fr = document.getElementById(`${prefix}-fr`);
    const sr = document.getElementById(`${prefix}-sr`);
    const status = document.getElementById(`${prefix}-status`);
    const frValue = fr ? fr.textContent.trim() : "XX";
    const srValue = sr ? sr.textContent.trim() : "XX";
    const statusText = status ? status.textContent.trim() : "";
    return statusText || `FR ${frValue} • SR ${srValue}`;
  };

  const update = () => {
    const now = Date.now();
    const online = navigator.onLine;
    const age = lastPayloadAt ? now - lastPayloadAt : (lastSuccessAt ? now - lastSuccessAt : NaN);
    const stale = Number.isFinite(age) && age > (isArchive ? 24 * 60 * 60 * 1000 : 15 * 60 * 1000);

    let health = "warning";
    let headline = checking ? "Checking" : "Waiting for data";
    if (!online || lastError) {
      health = "error";
      headline = online ? "Monitoring issue" : "Offline";
    } else if (lastSuccessAt && !stale) {
      health = "healthy";
      headline = "Live monitoring healthy";
    } else if (lastSuccessAt && stale) {
      headline = "Data may be stale";
    }

    root.dataset.health = health;
    summary.textContent = headline;
    connection.textContent = online ? (lastError ? "Reachable, check failed" : "Online") : "Browser offline";
    freshness.textContent = lastPayloadAt ? formatAge(now - lastPayloadAt) : "Awaiting timestamp";
    sync.textContent = formatTime(lastSuccessAt);
    state.textContent = document.hidden ? "Paused while hidden" : displayedResultState();
    note.textContent = lastError
      ? `Last check failed: ${lastError}. Existing result display remains unchanged.`
      : isArchive
        ? "Monitoring checks archive availability and the rendered historical table."
        : "Monitoring reads the existing result card and checks the cached public JSON endpoint; it does not publish or alter results.";
  };

  const extractPayloadTime = (payload, record) => {
    const candidates = [
      record && record.lastUpdatedAt,
      record && record.updatedAt,
      record && record.frUpdatedAt,
      record && record.srUpdatedAt,
      payload && payload.lastUpdatedAt,
      payload && payload.updatedAt,
      record && record.date,
      payload && payload.date
    ].map(parseDate).filter(Boolean);
    return candidates.length ? Math.max(...candidates) : Date.now();
  };

  const check = async (force = false) => {
    if (checking || document.hidden || !navigator.onLine) {
      update();
      return;
    }
    const minGap = force ? 0 : (isArchive ? 5 * 60 * 1000 : 60 * 1000);
    if (lastSuccessAt && Date.now() - lastSuccessAt < minGap) {
      update();
      return;
    }

    checking = true;
    lastError = "";
    if (retry) retry.disabled = true;
    update();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const record = isArchive ? null : findRecord(payload);
      if (!isArchive && !record) throw new Error(`Record ${gameId || "unknown"} missing`);
      lastSuccessAt = Date.now();
      lastPayloadAt = extractPayloadTime(payload, record);
    } catch (error) {
      lastError = error && error.name === "AbortError"
        ? "request timed out"
        : (error && error.message) || "unknown error";
    } finally {
      clearTimeout(timeout);
      checking = false;
      if (retry) retry.disabled = false;
      update();
    }
  };

  const schedule = () => {
    clearInterval(timer);
    timer = setInterval(() => {
      update();
      check(false);
    }, isArchive ? 5 * 60 * 1000 : 60 * 1000);
  };

  const observer = new MutationObserver(update);
  const observedTarget = isArchive
    ? document.getElementById("resultsTable") || document.body
    : document.getElementById(`result-${gameId}`) || document.body;
  observer.observe(observedTarget, { childList: true, subtree: true, characterData: true });

  window.addEventListener("online", () => check(true));
  window.addEventListener("offline", update);
  document.addEventListener("visibilitychange", () => {
    update();
    if (!document.hidden) check(false);
  });
  if (retry) retry.addEventListener("click", () => check(true));

  update();
  check(true);
  schedule();
})();
