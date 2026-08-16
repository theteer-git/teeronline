(() => {
  "use strict";

  const CONFIG = {
    SHD:{name:"Shillong Teer",fr:975,sr:1035,off:[0]},
    KH:{name:"Khanapara Teer",fr:985,sr:1020,off:[0]},
    JWD:{name:"Juwai Teer",fr:840,sr:880,off:[0]},
    SHM:{name:"Shillong Morning Teer",fr:630,sr:690,off:[]},
    KHM:{name:"Khanapara Morning Teer",fr:660,sr:720,off:[]},
    JWM:{name:"Juwai Morning Teer",fr:630,sr:690,off:[]},
    SHN1:{name:"Shillong Night Teer",fr:1245,sr:1305,off:[]},
    SHN2:{name:"Shillong Night Teer 2",fr:1390,sr:1450,off:[]}
  };
  const ENDPOINT="https://results.teeronline.com/api/game-result";
  const root=document.querySelector("[data-result-monitor-ribbon]");
  if(!root)return;
  const gameId=String(document.body.dataset.gameId||"").toUpperCase();
  const cfg=CONFIG[gameId];
  const p=gameId.toLowerCase();
  const frEl=document.getElementById(`${p}-fr`);
  const srEl=document.getElementById(`${p}-sr`);
  const statusEl=document.getElementById(`${p}-status`);
  const card=document.getElementById(`result-${gameId}`)||document.querySelector(".result-card");
  const icon=root.querySelector("[data-rm-icon]");
  const title=root.querySelector("[data-rm-title]");
  const message=root.querySelector("[data-rm-message]");
  const badge=root.querySelector("[data-rm-badge]");
  let record=null, loading=false, lastSignature="";

  const set=(state,i,t,m,b)=>{root.dataset.state=state;icon.textContent=i;title.textContent=t;message.textContent=m;badge.textContent=b};
  if(!cfg){set("offline","!","Monitoring unavailable","The page game identifier could not be matched.","CHECK CONFIG");return;}
  const text=e=>String(e?.textContent||"").trim();
  const ready=v=>/^\d{1,2}$/.test(v)||/^\d{1,2}\s*[-–]\s*\d{1,2}$/.test(v);
  const ist=()=>{const a=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());const g=k=>a.find(x=>x.type===k)?.value||"";return{day:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[g("weekday")],min:Number(g("hour"))*60+Number(g("minute"))}};
  const clock=v=>{if(!v)return"";const d=new Date(v);if(Number.isNaN(d.getTime()))return"";return new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true}).format(d)+" IST"};
  const stamp=round=>clock(round==="fr"?record?.frUpdatedAt:record?.srUpdatedAt);
  const fmt=t=>{const n=t%1440,d=new Date(2000,0,1,Math.floor(n/60),n%60);return new Intl.DateTimeFormat("en-IN",{hour:"numeric",minute:"2-digit",hour12:true}).format(d)};
  const refreshRecord=async()=>{if(loading)return;loading=true;try{const r=await fetch(`${ENDPOINT}?game=${encodeURIComponent(gameId)}`,{cache:"no-store",credentials:"omit",headers:{Accept:"application/json"}});if(r.ok){const j=await r.json();record=j?.record||j?.records?.[gameId]||null}}catch(_){/* banner remains functional without timestamp */}finally{loading=false;evaluate()}};

  function evaluate(){
    if(!navigator.onLine){set("offline","!","Connection Interrupted","Your browser is offline. The displayed result remains unchanged until the connection returns.","OFFLINE");return}
    const fr=text(frEl),sr=text(srEl),status=text(statusEl).toLowerCase();
    const sig=`${fr}|${sr}|${status}`;
    if(sig!==lastSignature){lastSignature=sig;refreshRecord()}
    const frDone=ready(fr),srDone=ready(sr),now=ist();
    if(cfg.off.includes(now.day)||/off|closed|holiday|no game/.test(status)){set("off","▣","Scheduled Off Day",`${cfg.name} is not conducted today. Live monitoring will resume on the next scheduled game day.`,"OFF DAY");return}

    if(frDone&&srDone){const s=stamp("sr");set("updated","✓","Result Updated","The Second Round result has been received and displayed automatically.",s?`Updated ${s}`:"UPDATED");return}

    const lead=5,extended=15;
    if(!frDone){
      if(now.min>=cfg.fr-lead&&now.min<=cfg.fr+extended){set("live","◉","Live FR Result Monitoring","Results will appear automatically as soon as they are published. Auto updating instantly.","● LIVE");return}
      if(now.min>cfg.fr+extended){set("extended","◷","Monitoring Extended","The First Round result has not yet been published. Automatic monitoring continues.","MONITORING");return}
      set("waiting","◷","Waiting for Live Monitoring","Live monitoring will begin automatically before the next scheduled result. Results will update automatically.",`UPCOMING ${fmt(cfg.fr)}`);return
    }

    if(frDone&&!srDone){
      if(now.min>=((cfg.sr%1440)-lead)&&now.min<=((cfg.sr%1440)+extended) || (cfg.sr>=1440&&now.min<=extended)){set("live","◉","Live SR Result Monitoring","Results will appear automatically as soon as they are published. Auto updating instantly.","● LIVE");return}
      if((cfg.sr<1440&&now.min>cfg.sr+extended)||(cfg.sr>=1440&&now.min>extended&&now.min<cfg.fr)){set("extended","◷","Monitoring Extended","The Second Round result has not yet been published. Automatic monitoring continues.","MONITORING");return}
      const s=stamp("fr");set("fr-updated","✓","First Round Result Updated","The First Round result has been received and displayed automatically. Second Round is still pending.",s?`Updated ${s}`:"UPDATED");return
    }
  }

  const observer=new MutationObserver(evaluate);
  if(card)observer.observe(card,{childList:true,subtree:true,characterData:true});
  window.addEventListener("online",()=>{refreshRecord();evaluate()});
  window.addEventListener("offline",evaluate);
  refreshRecord();evaluate();setInterval(evaluate,15000);
})();
