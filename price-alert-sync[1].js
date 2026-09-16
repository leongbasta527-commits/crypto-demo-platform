/* ===== Full-site Price Alert Runtime =====
   Reads the same UID-scoped alerts created in trading.html.
   Works while any customer page is open. Background phone push is phase 2. */
(function(){
  'use strict';
  const SUPPORTED=new Set(['BTC','ETH','BNB','SOL','XRP','DOGE','ADA','TRX','AVAX','LINK','DOT','BCH','LTC','UNI','XLM','TON','SHIB','HBAR','SUI','APT','NEAR','ICP','ETC','FIL','ATOM','ARB','OP','AAVE','PEPE','POL']);
  function uid(){const v=String(localStorage.getItem('demoCustomerUid')||localStorage.getItem('demoUid')||'').trim();return /^DEMO-\d{6}$/.test(v)?v:null}
  function key(){const u=uid();return 'tradingPriceAlerts::'+(u||'__NO_AUTH__')}
  function read(){try{const a=JSON.parse(localStorage.getItem(key())||'[]');return Array.isArray(a)?a:[]}catch(_){return[]}}
  function write(a){localStorage.setItem(key(),JSON.stringify(a))}
  function ensureToast(){
    if(document.getElementById('globalPriceAlertToast'))return;
    const style=document.createElement('style');style.textContent=`#globalPriceAlertToast{position:fixed;left:50%;top:18px;z-index:2147483647;transform:translate(-50%,-18px);opacity:0;pointer-events:none;width:min(430px,92vw);padding:13px 15px;border:1px solid #315d8e;border-radius:11px;background:#101923;color:#eef3f8;box-shadow:0 16px 45px rgba(0,0,0,.55);font:600 12px/1.5 Arial,Helvetica,sans-serif;transition:.22s}#globalPriceAlertToast.show{transform:translate(-50%,0);opacity:1}#globalPriceAlertToast b{color:#67adff}`;document.head.appendChild(style);
    const el=document.createElement('div');el.id='globalPriceAlertToast';document.body.appendChild(el);
  }
  let toastTimer=null;
  function toast(symbol,target,current){ensureToast();const el=document.getElementById('globalPriceAlertToast');const dir=current>=target?'reached':'fell to';el.innerHTML='🔔 <b>'+symbol+'/USDT Price Alert</b><br>'+symbol+' '+dir+' '+fmt(target)+' USDT · Current '+fmt(current);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),6500)}
  function fmt(n){n=Number(n);if(!Number.isFinite(n))return '--';return n>=1?n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):n.toFixed(8)}
  let busy=false;
  async function check(){
    if(busy||!uid())return; const alerts=read(); const active=alerts.filter(a=>!a.triggered&&SUPPORTED.has(String(a.symbol||'').toUpperCase())); if(!active.length)return;
    busy=true;
    try{
      const symbols=[...new Set(active.map(a=>String(a.symbol).toUpperCase()))];
      const prices={};
      await Promise.all(symbols.map(async s=>{try{const r=await fetch('https://api.binance.com/api/v3/ticker/price?symbol='+encodeURIComponent(s+'USDT'),{cache:'no-store'});if(!r.ok)return;const d=await r.json();const p=Number(d.price);if(Number.isFinite(p)&&p>0)prices[s]=p}catch(_){}}));
      let changed=false;
      for(const a of alerts){if(a.triggered)continue;const s=String(a.symbol||'').toUpperCase(),p=prices[s],t=Number(a.target);if(!Number.isFinite(p)||!Number.isFinite(t)||t<=0)continue;const hit=a.direction==='below'?p<=t:p>=t;if(hit){a.triggered=true;a.triggeredAt=Date.now();a.triggerPrice=p;changed=true;toast(s,t,p)}}
      if(changed){write(alerts);window.dispatchEvent(new CustomEvent('demo-price-alerts-updated',{detail:{alerts}}));}
    }finally{busy=false}
  }
  function start(){ensureToast();check();setInterval(check,10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});window.addEventListener('storage',e=>{if(e.key===key())check()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.DemoPriceAlertSync={check,readAlerts:read};
})();
