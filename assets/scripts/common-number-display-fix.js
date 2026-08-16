(() => {
  "use strict";
  const validNumber = value => /^(?:\d{1,2})$/.test(String(value ?? "").trim());
  const normalizeDate = value => {
    const text = String(value ?? "").trim();
    let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  };
  const displayDate = value => {
    const iso = normalizeDate(value); if (!iso) return "--";
    const [y,m,d] = iso.split("-"); return `${d}-${m}-${y}`;
  };
  function removeLeadingZeroesFromDigits() {
    document.querySelectorAll(".common-side .two-col .digit").forEach(el => {
      const value = el.textContent.trim(); if (validNumber(value)) el.textContent = String(Number(value));
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
    const gameId = String(document.body.dataset.gameId || "").toUpperCase(); if (!gameId) return;
    try {
      const origin = "https://results.teeronline.com";
      const [latestResponse, historyResponse] = await Promise.all([
        fetch(`${origin}/api/game-result?game=${encodeURIComponent(gameId)}`, {cache:"no-store", referrerPolicy:"no-referrer"}),
        fetch(`${origin}/api/game-history?game=${encodeURIComponent(gameId)}`, {cache:"no-store", referrerPolicy:"no-referrer"})
      ]);
      if (!latestResponse.ok || !historyResponse.ok) return;
      const latestPayload = await latestResponse.json();
      const history = await historyResponse.json();
      const latest = latestPayload?.record || null;
      const currentDate = normalizeDate(latest?.date || latestPayload?.date);
      const records = (Array.isArray(history) ? history : [])
        .map(item => ({date:normalizeDate(item?.date), fr:String(item?.fr ?? ""), sr:String(item?.sr ?? "")}))
        .filter(item => item.date && validNumber(item.fr) && validNumber(item.sr))
        .sort((a,b) => b.date.localeCompare(a.date));
      const previous = currentDate ? records.find(r => r.date < currentDate) : records[0];
      updatePreviousResult(previous || records[0]);
    } catch (error) { console.warn("[COMMON NUMBERS] Previous-result refresh failed", error); }
  }
  function init() { removeLeadingZeroesFromDigits(); refreshPreviousResult(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true}); else init();
})();
