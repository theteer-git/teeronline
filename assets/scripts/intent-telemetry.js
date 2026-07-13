(() => {
  "use strict";
  const gameId = String(document.body?.dataset?.gameId || "").toUpperCase();
  if (!gameId) return;
  const SAMPLE_RATE = 0.01;
  const selected = Math.random() < SAMPLE_RATE;
  if (!selected) return;
  const endpoint = "https://live.teeronline.com/intent-sample";
  const page = location.pathname || "/";
  const sent = new Set();
  function send(event, section="page", extra={}) {
    const payload = JSON.stringify({ event, section, gameId, page, sampleRate:SAMPLE_RATE, ...extra });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(endpoint, new Blob([payload], {type:"application/json"}));
      else fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:payload,keepalive:true,credentials:"omit"}).catch(()=>{});
    } catch (_) {}
  }
  send("page_view");
  const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.35) continue;
      const section = entry.target.dataset.semanticSection || "page";
      if (sent.has(section)) continue;
      sent.add(section);
      send("section_view", section, { visibleRatio:Number(entry.intersectionRatio.toFixed(2)) });
      observer.unobserve(entry.target);
    }
  },{threshold:[0.35]}) : null;
  document.querySelectorAll("[data-semantic-section]").forEach(el => observer?.observe(el));
  document.addEventListener("click", event => {
    if (event.target.closest(".refresh-btn")) send("manual_refresh","live_result");
  },{passive:true});

  const prefix = gameId.toLowerCase();
  const values = [document.getElementById(`${prefix}-fr`), document.getElementById(`${prefix}-sr`)];
  const seenValues = new Set();
  function inspectResult(node, round) {
    const value=String(node?.textContent||"").trim();
    if (!/^\d{2}$/.test(value)) return;
    const key=`${round}:${value}`;
    if (seenValues.has(key)) return;
    seenValues.add(key);
    fetch(`https://results.teeronline.com/latest-results.json?t=${Date.now()}`,{cache:"no-store"})
      .then(r=>r.json()).then(data=>{
        const record=data?.records?.[gameId]||{};
        const capturedAt=record?.[`${round}UpdatedAt`]||record?.lastCheckedAt||"";
        const capturedMs=Date.parse(capturedAt);
        const delay=Number.isFinite(capturedMs)?Math.max(0,Date.now()-capturedMs):0;
        send("result_display","live_result",{round,displayDelayMs:delay});
      }).catch(()=>send("result_display","live_result",{round,displayDelayMs:0}));
  }
  const mutation = new MutationObserver(()=>{ inspectResult(values[0],"fr"); inspectResult(values[1],"sr"); });
  values.filter(Boolean).forEach(node=>mutation.observe(node,{childList:true,subtree:true,characterData:true}));
  setTimeout(()=>{inspectResult(values[0],"fr");inspectResult(values[1],"sr");},2500);
})();
