"use strict";
(() => {
  const GAME_ID = "JWD";
  const RESULTS_ORIGIN = "https://results.teeronline.com";
  const LATEST_URL = `${RESULTS_ORIGIN}/latest-results.json`;
  const RECENT_URL = `${RESULTS_ORIGIN}/recent-results.json`;
  const PLAN_URL = `${RESULTS_ORIGIN}/polling-plan.json`;
  let loadingLatest = null;
  let loadingRecent = null;
  let timer = null;
  let pollingPlan = null;

  const valid = value => /^\d{1,2}$/.test(String(value ?? "").trim());
  const num = value => valid(value) ? String(value).padStart(2, "0") : "XX";
  const dateValue = value => Date.parse(String(value || "") + "T00:00:00") || 0;
  const fmtDate = value => {
    if (!value) return "--";
    const [y,m,d] = String(value).split("-");
    return y && m && d ? `${d}-${m}-${y}` : value;
  };
  const fmtTime = value => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleTimeString("en-IN", {timeZone:"Asia/Kolkata",hour:"numeric",minute:"2-digit",hour12:true}).toUpperCase();
  };
  const normalize = data => Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.records) ? data.records : Object.values(data || {}).filter(v => v && typeof v === "object");
  const gameId = item => item?.gameId || item?.g || item?.game || "";
  const normalizeItem = item => ({...item, gameId:gameId(item), date:item.date || item.d, fr:item.fr ?? item.f, sr:item.sr ?? item.s});

  async function fetchLatest() {
    if (loadingLatest) return loadingLatest;
    loadingLatest = (async () => {
      const response = await fetch(LATEST_URL, {cache:"no-store", referrerPolicy:"no-referrer"});
      if (!response.ok) throw new Error(`Latest results request failed: ${response.status}`);
      return normalize(await response.json()).map(normalizeItem).filter(x => x.gameId === GAME_ID).sort((a,b)=>dateValue(b.date)-dateValue(a.date))[0] || {};
    })();
    try { return await loadingLatest; } finally { loadingLatest = null; }
  }
  async function fetchRecent() {
    if (loadingRecent) return loadingRecent;
    loadingRecent = (async () => {
      const response = await fetch(RECENT_URL, {cache:"default", referrerPolicy:"no-referrer"});
      if (!response.ok) throw new Error(`Recent results request failed: ${response.status}`);
      return normalize(await response.json()).map(normalizeItem).filter(x => x.gameId === GAME_ID && x.date && valid(x.fr) && valid(x.sr)).sort((a,b)=>dateValue(b.date)-dateValue(a.date));
    })();
    try { return await loadingRecent; } finally { loadingRecent = null; }
  }
  function renderResult(record) {
    const fr = num(record.fr), sr = num(record.sr);
    const frTime = fmtTime(record.frUpdatedAt) || record.frDeclaredTime || "2:30 PM";
    const srTime = fmtTime(record.srUpdatedAt) || record.srDeclaredTime || "Updating";
    document.getElementById("jwd-date").textContent = `📅 ${fmtDate(record.date)}`;
    document.getElementById("jwd-fr-time").textContent = `🏹 FR: ${frTime}`;
    document.getElementById("jwd-sr-time").textContent = `🎯 SR: ${srTime}`;
    document.getElementById("jwd-fr").textContent = fr;
    document.getElementById("jwd-sr").textContent = sr;
    document.getElementById("jwd-fr-badge").textContent = frTime;
    document.getElementById("jwd-sr-badge").textContent = srTime;
    document.getElementById("jwd-status").textContent = fr !== "XX" && sr !== "XX" ? "Completed" : fr !== "XX" || sr !== "XX" ? "Partial" : "Pending";
  }
  function renderHistory(records) {
    const today = new Date().toLocaleDateString("en-CA", {timeZone:"Asia/Kolkata"});
    const rows = records.filter(x => x.date !== today).slice(0,7).map(x => `<div class="mini-history-row"><span class="mini-history-date">${fmtDate(x.date)}</span><span class="mini-history-result">${num(x.fr)}-${num(x.sr)}</span></div>`);
    while (rows.length < 7) rows.push('<div class="mini-history-row" aria-hidden="true"><span class="mini-history-date">--</span><span class="mini-history-result">XX-XX</span></div>');
    document.getElementById("jwd-history").innerHTML = rows.join("");
  }
  async function refreshCommonCard() {
    try {
      const response = await fetch("/common-numbers", {cache:"default", referrerPolicy:"no-referrer"});
      if (!response.ok) return;
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      const card = doc.querySelector('article.game-card[data-game="JWD"]');
      if (card) document.getElementById("jwd-common-card").replaceChildren(card);
    } catch (error) { console.warn("JWD common card refresh failed:", error); }
  }
  function bindPopup() {
    document.addEventListener("click", event => {
      const button = event.target.closest(".mini-chip");
      if (!button) return;
      const popup = document.getElementById("numberPopup"); if (!popup) return;
      const title = document.getElementById("popupTitle"), meta = document.getElementById("popupMeta"), nums = document.getElementById("popupNumbers");
      if (title) title.textContent = button.dataset.popupTitle || "Details";
      if (meta) meta.textContent = `${button.dataset.popupDays || "—"} days missing`;
      if (nums) nums.innerHTML = String(button.dataset.popupNums || "").split(",").filter(Boolean).map(n=>`<span>${n}</span>`).join("");
      popup.classList.add("show"); popup.setAttribute("aria-hidden","false");
    });
    document.addEventListener("click", event => {
      const popup = document.getElementById("numberPopup");
      if (!popup) return;
      if (event.target === popup || event.target.closest("[data-close-popup],.modal-close")) { popup.classList.remove("show"); popup.setAttribute("aria-hidden","true"); }
    });
  }
  async function loadPlan() { try { const r=await fetch(PLAN_URL,{cache:"default"}); if(r.ok) pollingPlan=await r.json(); } catch(e){} }
  function intervalMs() {
    const fallback=60000;
    const entries=Array.isArray(pollingPlan)?pollingPlan:Array.isArray(pollingPlan?.games)?pollingPlan.games:Object.values(pollingPlan||{});
    const p=entries.find(x=>(x.gameId||x.g||x.game)===GAME_ID);
    const seconds=Number(p?.pollEverySeconds || p?.intervalSeconds || p?.pollSeconds);
    return Number.isFinite(seconds)&&seconds>=5 ? Math.max(5000,seconds*1000) : fallback;
  }
  function schedule() { clearTimeout(timer); if (!document.hidden) timer=setTimeout(async()=>{await refresh(false);schedule();},intervalMs()); }
  async function refresh(manual=true) {
    try {
      const [latest,recent]=await Promise.all([fetchLatest(),fetchRecent()]);
      renderResult(latest && Object.keys(latest).length ? latest : recent[0] || {}); renderHistory(recent);
      if (manual) await refreshCommonCard();
    } catch(error) { console.warn("JWD unified page refresh failed:",error); }
  }
  document.addEventListener("DOMContentLoaded", async () => {
    bindPopup(); document.getElementById("jwd-refresh")?.addEventListener("click",()=>refresh(true));
    await Promise.all([loadPlan(),refresh(false),refreshCommonCard()]); schedule();
  });
  document.addEventListener("visibilitychange",()=>{ if(document.hidden) clearTimeout(timer); else { refresh(false); schedule(); } });
})();
