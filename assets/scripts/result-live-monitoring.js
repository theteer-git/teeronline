(() => {
  "use strict";

  const GAME_CONFIG = {
    SHD:  { name: "Shillong Teer", fr: 975, sr: 1035, offDays: [0] },
    KH:   { name: "Khanapara Teer", fr: 985, sr: 1020, offDays: [0] },
    JWD:  { name: "Juwai Teer", fr: 870, sr: 915, offDays: [0] },
    SHM:  { name: "Shillong Morning Teer", fr: 630, sr: 690, offDays: [] },
    KHM:  { name: "Khanapara Morning Teer", fr: 660, sr: 720, offDays: [] },
    JWM:  { name: "Juwai Morning Teer", fr: 630, sr: 690, offDays: [] },
    SHN1: { name: "Shillong Night Teer", fr: 1245, sr: 1305, offDays: [] },
    SHN2: { name: "Shillong Night Teer 2", fr: 1390, sr: 1450, offDays: [] }
  };

  const root = document.querySelector("[data-result-live-monitor]");
  if (!root) return;

  const gameId = String(document.body.dataset.gameId || "").toUpperCase();
  const config = GAME_CONFIG[gameId];
  const titleEl = root.querySelector("[data-monitor-title]");
  const messageEl = root.querySelector("[data-monitor-message]");
  const badgeEl = root.querySelector("[data-monitor-badge]");
  const iconEl = root.querySelector("[data-monitor-icon]");

  const setState = (state, icon, title, message, badge) => {
    root.dataset.state = state;
    iconEl.textContent = icon;
    titleEl.textContent = title;
    messageEl.textContent = message;
    badgeEl.textContent = badge;
  };

  if (!config) {
    setState("error", "!", "Monitoring Unavailable", "The page game identifier could not be matched.", "CHECK CONFIGURATION");
    return;
  }

  const prefix = gameId.toLowerCase();
  const frEl = document.getElementById(`${prefix}-fr`);
  const srEl = document.getElementById(`${prefix}-sr`);
  const statusEl = document.getElementById(`${prefix}-status`);
  const card = document.getElementById(`result-${gameId}`) || document.querySelector(".result-card");

  let lastSignature = "";
  let lastChangedAt = Date.now();

  const validNumber = (value) => /^(?:\d{1,2}|\d{1,2}\s*[-–]\s*\d{1,2})$/.test(String(value || "").trim());
  const norm = (value) => String(value || "").trim().toLowerCase();

  const istNow = () => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      weekday: weekdays[get("weekday")],
      minutes: Number(get("hour")) * 60 + Number(get("minute"))
    };
  };

  const formatClock = (date) => new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date) + " IST";

  const formatMinutes = (total) => {
    const normalised = total % 1440;
    const hour = Math.floor(normalised / 60);
    const minute = normalised % 60;
    const d = new Date(2000, 0, 1, hour, minute);
    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(d);
  };

  const evaluate = () => {
    if (!navigator.onLine) {
      setState("error", "!", "Connection Interrupted", "Your browser is offline. The displayed result remains unchanged until the connection returns.", "OFFLINE");
      return;
    }

    const frText = frEl ? frEl.textContent.trim() : "";
    const srText = srEl ? srEl.textContent.trim() : "";
    const statusText = norm(statusEl ? statusEl.textContent : "");
    const signature = [frText, srText, statusText].join("|");

    if (signature !== lastSignature) {
      lastSignature = signature;
      lastChangedAt = Date.now();
    }

    const frReady = validNumber(frText) && !/xx|pending|live/.test(norm(frText));
    const srReady = validNumber(srText) && !/xx|pending|live/.test(norm(srText));
    const now = istNow();
    const explicitOff = /off|closed|holiday|no game/.test(statusText);
    const scheduledOff = config.offDays.includes(now.weekday);

    if (explicitOff || scheduledOff) {
      setState("off", "▣", "Off Day", `Today is a scheduled off-day for ${config.name}.`, "NO RESULT SCHEDULED");
      return;
    }

    if (frReady && srReady) {
      setState("complete", "★", "Today’s Result Complete", "Both rounds have been received and displayed.", `Completed at ${formatClock(new Date(lastChangedAt))}`);
      return;
    }

    if (frReady || srReady) {
      const received = frReady ? "First Round" : "Second Round";
      const waiting = frReady ? "Second Round" : "First Round";
      setState("updated", "✓", "Result Updated", `The ${received} result has been received and displayed automatically. ${waiting} is still pending.`, `Updated at ${formatClock(new Date(lastChangedAt))}`);
      return;
    }

    const activeLead = 5;
    const activeTail = 20;
    const waitingTail = 90;
    const frActive = now.minutes >= config.fr - activeLead && now.minutes <= config.fr + activeTail;
    const srActive = now.minutes >= config.sr - activeLead && now.minutes <= config.sr + activeTail;
    const afterFrWaiting = now.minutes > config.fr + activeTail && now.minutes <= config.fr + waitingTail && now.minutes < config.sr - activeLead;
    const afterSrWaiting = now.minutes > (config.sr % 1440) + activeTail;

    if (frActive) {
      setState("live", "◉", "Live FR Result", "Please don’t refresh the page. The First Round result will appear automatically as soon as it is published.", "● ACTIVE NOW");
      return;
    }

    if (srActive || (config.sr >= 1440 && now.minutes <= 30)) {
      setState("live", "◉", "Live SR Result", "Please don’t refresh the page. The Second Round result will appear automatically as soon as it is published.", "● ACTIVE NOW");
      return;
    }

    if (afterFrWaiting || afterSrWaiting || /waiting|delayed|late/.test(statusText)) {
      setState("waiting", "◷", "Waiting Longer", "The result has not yet been published. We are still waiting and will show it here automatically when available.", "STILL WAITING…");
      return;
    }

    const nextIsFr = now.minutes < config.fr;
    const nextRound = nextIsFr ? "First Round" : "Second Round";
    const nextMinutes = nextIsFr ? config.fr : config.sr;
    setState("scheduled", "◷", "Result Scheduled", `${nextRound} monitoring will become active around the declared result time. No refresh is required.`, `${nextRound.toUpperCase()} ${formatMinutes(nextMinutes)}`);
  };

  const observer = new MutationObserver(evaluate);
  if (card) observer.observe(card, { childList: true, subtree: true, characterData: true });

  window.addEventListener("online", evaluate);
  window.addEventListener("offline", evaluate);

  evaluate();
  setInterval(evaluate, 15000);
})();
