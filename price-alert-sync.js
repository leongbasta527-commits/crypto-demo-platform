/* ===== Full-site Price Alert Runtime v2 =====
   Shared by Markets / Trading / News / Assets / Profile.
   Alerts are UID-scoped and created/managed in trading.html.
   Phase 1: works while any customer page is open. */
(function(){
  'use strict';

  const SUPPORTED=new Set([
    'BTC','ETH','BNB','SOL','XRP','DOGE','ADA','TRX',
    'AVAX','LINK','DOT','BCH','LTC','UNI','XLM','TON',
    'SHIB','HBAR','SUI','APT','NEAR','ICP','ETC','FIL',
    'ATOM','ARB','OP','AAVE','PEPE','POL'
  ]);

  const CG_IDS={
    BTC:'bitcoin',
    ETH:'ethereum',
    BNB:'binancecoin',
    SOL:'solana',
    XRP:'ripple',
    DOGE:'dogecoin',
    ADA:'cardano',
    TRX:'tron',
    AVAX:'avalanche-2',
    LINK:'chainlink',
    DOT:'polkadot',
    BCH:'bitcoin-cash',
    LTC:'litecoin',
    UNI:'uniswap',
    XLM:'stellar',
    TON:'the-open-network',
    SHIB:'shiba-inu',
    HBAR:'hedera-hashgraph',
    SUI:'sui',
    APT:'aptos',
    NEAR:'near',
    ICP:'internet-computer',
    ETC:'ethereum-classic',
    FIL:'filecoin',
    ATOM:'cosmos',
    ARB:'arbitrum',
    OP:'optimism',
    AAVE:'aave',
    PEPE:'pepe',
    POL:'polygon-ecosystem-token'
  };

  function uid(){
    const v=String(
      localStorage.getItem('demoCustomerUid') ||
      localStorage.getItem('demoUid') ||
      ''
    ).trim();

    return /^DEMO-\d{6}$/.test(v) ? v : null;
  }

  function key(){
    return 'tradingPriceAlerts::' + (uid() || '__NO_AUTH__');
  }

  function read(){
    try{
      const a=JSON.parse(localStorage.getItem(key()) || '[]');
      return Array.isArray(a) ? a : [];
    }catch(_){
      return [];
    }
  }

  function write(a){
    localStorage.setItem(key(),JSON.stringify(a));
  }

  function fmt(n){
    n=Number(n);

    if(!Number.isFinite(n)){
      return '--';
    }

    return n>=1
      ? n.toLocaleString(undefined,{
          minimumFractionDigits:2,
          maximumFractionDigits:2
        })
      : n.toFixed(8);
  }

  /* =========================
     GLOBAL TOAST
  ========================= */

  function ensureToast(){

    if(document.getElementById('globalPriceAlertToast')){
      return;
    }

    const style=document.createElement('style');

    style.textContent=`
      #globalPriceAlertToast{
        position:fixed;
        left:50%;
        top:18px;
        z-index:2147483647;
        transform:translate(-50%,-18px);
        opacity:0;
        pointer-events:none;
        width:min(430px,92vw);
        padding:13px 15px;
        border:1px solid #315d8e;
        border-radius:11px;
        background:#101923;
        color:#eef3f8;
        box-shadow:0 16px 45px rgba(0,0,0,.55);
        font:600 12px/1.5 Arial,Helvetica,sans-serif;
        transition:.22s;
      }

      #globalPriceAlertToast.show{
        transform:translate(-50%,0);
        opacity:1;
      }

      #globalPriceAlertToast b{
        color:#67adff;
      }
    `;

    document.head.appendChild(style);

    const el=document.createElement('div');

    el.id='globalPriceAlertToast';

    document.body.appendChild(el);
  }

  let toastTimer=null;

  function toast(a,current){

    ensureToast();

    const el=document.getElementById(
      'globalPriceAlertToast'
    );

    const s=String(
      a.symbol || ''
    ).toUpperCase();

    const verb=
      a.direction==='below'
        ? 'fell to'
        : 'reached';

    el.innerHTML=
      '🔔 <b>' +
      s +
      '/USDT Price Alert</b><br>' +
      s +
      ' ' +
      verb +
      ' ' +
      fmt(a.target) +
      ' USDT · Current ' +
      fmt(current);

    el.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer=setTimeout(()=>{
      el.classList.remove('show');
    },6500);
  }

  /* =========================
     FETCH
  ========================= */

  async function fetchJson(
    url,
    timeout=5000
  ){

    const controller=
      new AbortController();

    const timer=
      setTimeout(
        ()=>controller.abort(),
        timeout
      );

    try{

      const response=
        await fetch(url,{
          cache:'no-store',
          signal:controller.signal
        });

      if(!response.ok){
        throw new Error(
          'HTTP ' + response.status
        );
      }

      return await response.json();

    }finally{

      clearTimeout(timer);

    }
  }

  /* =========================
     BINANCE PRICE
  ========================= */

  async function binancePrice(symbol){

    const pair=
      encodeURIComponent(
        symbol + 'USDT'
      );

    const urls=[

      'https://data-api.binance.vision/api/v3/ticker/price?symbol=' +
      pair,

      'https://api1.binance.com/api/v3/ticker/price?symbol=' +
      pair,

      'https://api.binance.com/api/v3/ticker/price?symbol=' +
      pair

    ];

    for(const url of urls){

      try{

        const data=
          await fetchJson(url);

        const price=
          Number(
            data &&
            data.price
          );

        if(
          Number.isFinite(price) &&
          price>0
        ){
          return price;
        }

      }catch(_){}

    }

    return null;
  }

  /* =========================
     COINGECKO FALLBACK
  ========================= */

  async function coinGeckoPrices(
    symbols
  ){

    const wanted=
      symbols.filter(
        symbol=>CG_IDS[symbol]
      );

    if(!wanted.length){
      return {};
    }

    const ids=[
      ...new Set(
        wanted.map(
          symbol=>CG_IDS[symbol]
        )
      )
    ].join(',');

    try{

      const data=
        await fetchJson(
          'https://api.coingecko.com/api/v3/simple/price?ids=' +
          encodeURIComponent(ids) +
          '&vs_currencies=usd',
          6500
        );

      const out={};

      for(const symbol of wanted){

        const price=
          Number(
            data &&
            data[CG_IDS[symbol]] &&
            data[CG_IDS[symbol]].usd
          );

        if(
          Number.isFinite(price) &&
          price>0
        ){
          out[symbol]=price;
        }
      }

      return out;

    }catch(_){

      return {};

    }
  }

  /* =========================
     GET MULTIPLE PRICES
  ========================= */

  async function getPrices(
    symbols
  ){

    const prices={};

    await Promise.all(
      symbols.map(
        async symbol=>{

          const price=
            await binancePrice(
              symbol
            );

          if(price){
            prices[symbol]=price;
          }

        }
      )
    );

    const missing=
      symbols.filter(
        symbol=>!prices[symbol]
      );

    if(missing.length){

      Object.assign(
        prices,
        await coinGeckoPrices(
          missing
        )
      );

    }

    return prices;
  }

  /* =========================
     ALERT CHECK
  ========================= */

  let busy=false;

  async function check(){

    if(
      busy ||
      !uid()
    ){
      return;
    }

    const alerts=
      read();

    const active=
      alerts.filter(
        alert=>
          !alert.triggered &&
          SUPPORTED.has(
            String(
              alert.symbol || ''
            ).toUpperCase()
          )
      );

    if(!active.length){
      return;
    }

    busy=true;

    try{

      const symbols=[
        ...new Set(
          active.map(
            alert=>
              String(
                alert.symbol
              ).toUpperCase()
          )
        )
      ];

      const prices=
        await getPrices(
          symbols
        );

      let changed=false;

      for(const alert of alerts){

        if(alert.triggered){
          continue;
        }

        const symbol=
          String(
            alert.symbol || ''
          ).toUpperCase();

        const current=
          prices[symbol];

        const target=
          Number(
            alert.target
          );

        if(
          !Number.isFinite(current) ||
          !Number.isFinite(target) ||
          target<=0
        ){
          continue;
        }

        const hit=
          alert.direction==='below'
            ? current<=target
            : current>=target;

        if(hit){

          alert.triggered=true;

          alert.triggeredAt=
            Date.now();

          alert.triggerPrice=
            current;

          changed=true;

          toast(
            alert,
            current
          );
        }
      }

      if(changed){

        write(alerts);

        window.dispatchEvent(
          new CustomEvent(
            'demo-price-alerts-updated',
            {
              detail:{
                alerts
              }
            }
          )
        );

        if(
          typeof window.renderPriceAlerts
          ===
          'function'
        ){
          try{
            window.renderPriceAlerts();
          }catch(_){}
        }

        if(
          typeof window.updatePriceAlertButton
          ===
          'function'
        ){
          try{
            window.updatePriceAlertButton();
          }catch(_){}
        }

      }

    }finally{

      busy=false;

    }
  }

  /* =========================
     START
  ========================= */

  function start(){

    ensureToast();

    /* First check shortly after page loads */
    setTimeout(
      check,
      600
    );

    /* Check every 5 seconds */
    setInterval(
      check,
      5000
    );

    /* Check again when user returns to page */
    document.addEventListener(
      'visibilitychange',
      ()=>{
        if(!document.hidden){
          check();
        }
      }
    );

    window.addEventListener(
      'focus',
      check
    );

    /* Sync alert changes between tabs */
    window.addEventListener(
      'storage',
      event=>{
        if(event.key===key()){
          check();
        }
      }
    );

    /* Trading can request immediate check */
    window.addEventListener(
      'demo-price-alert-created',
      check
    );
  }

  if(
    document.readyState==='loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      start
    );

  }else{

    start();

  }

  /* =========================
     PUBLIC API
  ========================= */

  window.DemoPriceAlertSync={
    check,
    readAlerts:read,
    getPrices
  };

})();
