"use strict";

(() => {
  const GAME_ID = "JWD";

  const LATEST_URL =
    "https://results.teeronline.com/latest-results.json";

  const RECENT_URL =
    "https://results.teeronline.com/recent-results.json";

  const POLLING_PLAN_URL =
    "https://results.teeronline.com/polling-plan.json";

  let loadingLatest = null;
  let loadingRecent = null;
  let timer = null;
  let pollingPlan = null;

  const valid = value =>
    /^\d{1,2}$/.test(String(value ?? "").trim());

  const num = value =>
    valid(value)
      ? String(value).padStart(2, "0")
      : "XX";

  const dateValue = value =>
    Date.parse(`${String(value || "")}T00:00:00`) || 0;

  const fmtDate = value => {
    if (!value) return "--";

    const [year, month, day] = String(value).split("-");

    return year && month && day
      ? `${day}-${month}-${year}`
      : String(value);
  };

  const fmtTime = value => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date
      .toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
      .toUpperCase();
  };

  const normalize = data => {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.results)) {
      return data.results;
    }

    if (Array.isArray(data?.records)) {
      return data.records;
    }

    return Object.values(data || {}).filter(
      value => value && typeof value === "object"
    );
  };

  const getGameId = item =>
    item?.gameId ||
    item?.g ||
    item?.game ||
    "";

  const normalizeItem = item => ({
    ...(item || {}),
    gameId: getGameId(item),
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

      if (!response.ok) {
        throw new Error(
          `Latest results request failed: ${response.status}`
        );
      }

      const data = await response.json();

      const record =
        data?.records?.[GAME_ID] ??
        data?.[GAME_ID] ??
        {};

      return normalizeItem(record);
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

      if (!response.ok) {
        throw new Error(
          `Recent results request failed: ${response.status}`
        );
      }

      const data = await response.json();

      return normalize(data)
        .map(normalizeItem)
        .filter(
          item =>
            item.gameId === GAME_ID &&
            item.date &&
            valid(item.fr) &&
            valid(item.sr)
        )
        .sort(
          (first, second) =>
            dateValue(second.date) - dateValue(first.date)
        );
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

    const frTime =
      fmtTime(record.frUpdatedAt) ||
      record.frDeclaredTime ||
      "2:30 PM";

    const srTime =
      fmtTime(record.srUpdatedAt) ||
      record.srDeclaredTime ||
      "Updating";

    const dateElement =
      document.getElementById("jwd-date");

    const frTimeElement =
      document.getElementById("jwd-fr-time");

    const srTimeElement =
      document.getElementById("jwd-sr-time");

    const frElement =
      document.getElementById("jwd-fr");

    const srElement =
      document.getElementById("jwd-sr");

    const frBadge =
      document.getElementById("jwd-fr-badge");

    const srBadge =
      document.getElementById("jwd-sr-badge");

    const statusElement =
      document.getElementById("jwd-status");

    if (dateElement) {
      dateElement.textContent =
        `📅 ${fmtDate(record.date)}`;
    }

    if (frTimeElement) {
      frTimeElement.textContent =
        `🏹 FR: ${frTime}`;
    }

    if (srTimeElement) {
      srTimeElement.textContent =
        `🎯 SR: ${srTime}`;
    }

    if (frElement) {
      frElement.textContent = fr;
    }

    if (srElement) {
      srElement.textContent = sr;
    }

    if (frBadge) {
      frBadge.textContent = frTime;
    }

    if (srBadge) {
      srBadge.textContent = srTime;
    }

    if (statusElement) {
      statusElement.textContent =
        fr !== "XX" && sr !== "XX"
          ? "Completed"
          : fr !== "XX" || sr !== "XX"
            ? "Partial"
            : "Pending";
    }
  }

  function renderHistory(records = []) {
    const historyElement =
      document.getElementById("jwd-history");

    if (!historyElement) {
      return;
    }

    const today = new Date().toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Kolkata"
      }
    );

    const rows = records
      .filter(item => item.date !== today)
      .slice(0, 7)
      .map(
        item => `
          <div class="mini-history-row">
            <span class="mini-history-date">
              ${fmtDate(item.date)}
            </span>
            <span class="mini-history-result">
              ${num(item.fr)}-${num(item.sr)}
            </span>
          </div>
        `
      );

    while (rows.length < 7) {
      rows.push(`
        <div
          class="mini-history-row"
          aria-hidden="true"
        >
          <span class="mini-history-date">
            --
          </span>
          <span class="mini-history-result">
            XX-XX
          </span>
        </div>
      `);
    }

    historyElement.innerHTML = rows.join("");
  }

  async function refreshCommonCard() {
    try {
      const response = await fetch(
        "/common-numbers.html",
        {
          cache: "no-store",
          referrerPolicy: "no-referrer"
        }
      );

      if (!response.ok) {
        throw new Error(
          `Common numbers request failed: ${response.status}`
        );
      }

      const html = await response.text();

      const documentResult =
        new DOMParser().parseFromString(
          html,
          "text/html"
        );

      const card = documentResult.querySelector(
        'article.game-card[data-game="JWD"]'
      );

      const target =
        document.getElementById(
          "jwd-common-card"
        );

      if (card && target) {
        target.replaceChildren(card);
      }
    } catch (error) {
      console.warn(
        "JWD common card refresh failed:",
        error
      );
    }
  }

  function bindPopup() {
    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(".mini-chip");

        if (!button) {
          return;
        }

        const popup =
          document.getElementById(
            "numberPopup"
          );

        if (!popup) {
          return;
        }

        const title =
          document.getElementById(
            "popupTitle"
          );

        const meta =
          document.getElementById(
            "popupMeta"
          );

        const numbers =
          document.getElementById(
            "popupNumbers"
          );

        if (title) {
          title.textContent =
            button.dataset.popupTitle ||
            "Details";
        }

        if (meta) {
          meta.textContent =
            `${button.dataset.popupDays || "—"} days missing`;
        }

        if (numbers) {
          numbers.innerHTML = String(
            button.dataset.popupNums || ""
          )
            .split(",")
            .filter(Boolean)
            .map(
              value =>
                `<span>${value}</span>`
            )
            .join("");
        }

        popup.classList.add("show");
        popup.setAttribute(
          "aria-hidden",
          "false"
        );
      }
    );

    document.addEventListener(
      "click",
      event => {
        const popup =
          document.getElementById(
            "numberPopup"
          );

        if (!popup) {
          return;
        }

        if (
          event.target === popup ||
          event.target.closest(
            "[data-close-popup], .modal-close"
          )
        ) {
          popup.classList.remove("show");

          popup.setAttribute(
            "aria-hidden",
            "true"
          );
        }
      }
    );
  }

  async function loadPlan() {
    try {
      const response = await fetch(
        POLLING_PLAN_URL,
        {
          cache: "no-store",
          referrerPolicy: "no-referrer"
        }
      );

      if (response.ok) {
        pollingPlan = await response.json();
      }
    } catch (error) {
      console.warn(
        "JWD polling plan request failed:",
        error
      );
    }
  }

  function intervalMs() {
    const fallback = 60000;

    const entries = Array.isArray(
      pollingPlan
    )
      ? pollingPlan
      : Array.isArray(
          pollingPlan?.games
        )
        ? pollingPlan.games
        : Object.values(
            pollingPlan || {}
          );

    const plan = entries.find(
      item =>
        (
          item?.gameId ||
          item?.g ||
          item?.game
        ) === GAME_ID
    );

    const seconds = Number(
      plan?.pollEverySeconds ||
      plan?.intervalSeconds ||
      plan?.pollSeconds
    );

    return Number.isFinite(seconds) &&
      seconds >= 5
      ? Math.max(
          5000,
          seconds * 1000
        )
      : fallback;
  }

  function schedule() {
    clearTimeout(timer);

    if (document.hidden) {
      return;
    }

    timer = setTimeout(
      async () => {
        await refresh(false);
        schedule();
      },
      intervalMs()
    );
  }

  async function refresh(
    manual = true
  ) {
    const [
      latestResult,
      recentResult
    ] = await Promise.allSettled([
      fetchLatest(),
      fetchRecent()
    ]);

    const latest =
      latestResult.status ===
      "fulfilled"
        ? latestResult.value
        : {};

    const recent =
      recentResult.status ===
      "fulfilled"
        ? recentResult.value
        : [];

    if (
      latestResult.status ===
      "rejected"
    ) {
      console.warn(
        "JWD latest result refresh failed:",
        latestResult.reason
      );
    }

    if (
      recentResult.status ===
      "rejected"
    ) {
      console.warn(
        "JWD recent result refresh failed:",
        recentResult.reason
      );
    }

    const current =
      latest &&
      Object.keys(latest).length
        ? latest
        : recent[0] || {};

    renderResult(current);
    renderHistory(recent);

    if (manual) {
      await refreshCommonCard();
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    async () => {
      bindPopup();

      document
        .getElementById(
          "jwd-refresh"
        )
        ?.addEventListener(
          "click",
          () => refresh(true)
        );

      await Promise.all([
        loadPlan(),
        refresh(false),
        refreshCommonCard()
      ]);

      schedule();
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        clearTimeout(timer);
        return;
      }

      refresh(false);
      schedule();
    }
  );
})();