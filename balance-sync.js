(function(){
  const SUPABASE_URL='https://cyvquivolvkxzcseyhvk.supabase.co';
  const SUPABASE_KEY='sb_publishable_dy2_qtfTrOjeD-kPKohHiQ_zKHxZEHU';
  const POLL_MS=3000;

  function getUid(){
    let uid=localStorage.getItem('demoUid');

    if(!uid){
      uid='DEMO-'+String(
        Math.floor(100000+Math.random()*900000)
      );

      localStorage.setItem('demoUid',uid);
    }

    return uid;
  }

  function readArray(key){
    try{
      const x=JSON.parse(
        localStorage.getItem(key)||'[]'
      );

      return Array.isArray(x) ? x : [];
    }catch(_){
      return [];
    }
  }

  function writeArray(key,arr,max=500){
    localStorage.setItem(
      key,
      JSON.stringify(arr.slice(-max))
    );
  }

  function getBalance(){
    const n=Number(
      localStorage.getItem('demoBalance')
    );

    return Number.isFinite(n) ? n : 0;
  }

  function setBalance(v){
    const n=Math.max(
      0,
      Number(v)||0
    );

    localStorage.setItem(
      'demoBalance',
      String(n)
    );

    const balanceEl=
      document.getElementById('balance');

    if(balanceEl){
      balanceEl.textContent=
        n.toFixed(2)+' USDT';
    }

    const balanceValue=
      document.getElementById('balanceValue');

    if(balanceValue){
      balanceValue.textContent=
        n.toLocaleString(
          undefined,
          {
            minimumFractionDigits:2,
            maximumFractionDigits:2
          }
        );
    }

    window.dispatchEvent(
      new CustomEvent(
        'demoBalanceUpdated',
        {
          detail:{
            balance:n
          }
        }
      )
    );
  }

  /* ========================================
     DEPOSIT POPUP
  ======================================== */

  function ensureToast(){
    if(
      document.getElementById(
        'depositStatusToast'
      )
    ){
      return;
    }

    const wrap=
      document.createElement('div');

    wrap.id='depositStatusToast';

    wrap.style.cssText=
      'position:fixed;'+
      'inset:0;'+
      'display:none;'+
      'align-items:center;'+
      'justify-content:center;'+
      'background:rgba(0,0,0,.60);'+
      'z-index:99999;'+
      'padding:20px';

    wrap.innerHTML=`
      <div
        style="
          width:min(390px,100%);
          background:#111820;
          border:1px solid #283442;
          border-radius:18px;
          padding:24px;
          text-align:center;
          box-shadow:0 20px 60px rgba(0,0,0,.45)
        "
      >

        <div
          id="depositToastIcon"
          style="
            width:58px;
            height:58px;
            border-radius:50%;
            display:grid;
            place-items:center;
            margin:0 auto 14px;
            font-size:30px;
            font-weight:900;
            background:rgba(34,201,139,.12);
            color:#22c98b
          "
        >
          ✓
        </div>

        <div
          id="depositToastTitle"
          style="
            font-size:21px;
            font-weight:800;
            color:#fff;
            margin-bottom:8px
          "
        >
          Deposit Successful
        </div>

        <div
          id="depositToastMsg"
          style="
            font-size:14px;
            line-height:1.6;
            color:#9eabb9
          "
        ></div>

        <button
          id="depositToastOk"
          style="
            margin-top:18px;
            width:100%;
            height:44px;
            border:0;
            border-radius:10px;
            background:#246bfd;
            color:#fff;
            font-weight:800;
            cursor:pointer
          "
        >
          OK
        </button>

      </div>
    `;

    document.body.appendChild(wrap);

    document
      .getElementById('depositToastOk')
      .onclick=()=>{
        wrap.style.display='none';
      };

    wrap.addEventListener(
      'click',
      e=>{
        if(e.target===wrap){
          wrap.style.display='none';
        }
      }
    );
  }

  function showDepositToast(
    status,
    amount
  ){
    ensureToast();

    const wrap=
      document.getElementById(
        'depositStatusToast'
      );

    const icon=
      document.getElementById(
        'depositToastIcon'
      );

    const title=
      document.getElementById(
        'depositToastTitle'
      );

    const msg=
      document.getElementById(
        'depositToastMsg'
      );

    if(status==='approved'){

      icon.textContent='✓';
      icon.style.color='#22c98b';
      icon.style.background=
        'rgba(34,201,139,.12)';

      title.textContent=
        'Deposit Successful';

      msg.textContent=
        '+'+
        Number(amount).toFixed(2)+
        ' USDT has been credited '+
        'to your demo balance.';

    }else{

      icon.textContent='×';
      icon.style.color='#f05b6a';
      icon.style.background=
        'rgba(240,91,106,.12)';

      title.textContent=
        'Deposit Rejected';

      msg.textContent=
        'Your '+
        Number(amount).toFixed(2)+
        ' USDT deposit request '+
        'was rejected.';

    }

    wrap.style.display='flex';
  }

  /* ========================================
     DEPOSIT SYNC
  ======================================== */

  async function pollDepositStatus(){

    try{

      const uid=getUid();

      const url=
        SUPABASE_URL+
        '/rest/v1/deposit_requests'+
        '?select=id,amount,status'+
        '&uid=eq.'+
        encodeURIComponent(uid)+
        '&status=in.(approved,rejected)'+
        '&order=id.asc';

      const r=await fetch(
        url,
        {
          headers:{
            apikey:SUPABASE_KEY,
            Authorization:
              'Bearer '+SUPABASE_KEY
          },
          cache:'no-store'
        }
      );

      if(!r.ok){
        return;
      }

      const rows=await r.json();

      if(
        !Array.isArray(rows) ||
        !rows.length
      ){
        return;
      }

      const processed=
        readArray(
          'processedDepositIds'
        ).map(String);

      let changed=false;

      for(const row of rows){

        const id=
          String(row.id);

        if(
          processed.includes(id)
        ){
          continue;
        }

        if(
          row.status==='approved'
        ){

          const amount=
            Number(row.amount)||0;

          if(amount>0){

            setBalance(
              getBalance()+amount
            );

          }

          showDepositToast(
            'approved',
            amount
          );

        }else if(
          row.status==='rejected'
        ){

          showDepositToast(
            'rejected',
            Number(row.amount)||0
          );

        }

        processed.push(id);

        changed=true;
      }

      if(changed){

        writeArray(
          'processedDepositIds',
          processed
        );

      }

    }catch(e){

      console.warn(
        'Deposit status check failed',
        e
      );

    }
  }

  /* ========================================
     ACTIVE TRADE STORAGE
  ======================================== */

  function getActiveTrade(){

    try{

      const x=JSON.parse(
        localStorage.getItem(
          'demoActiveTrade'
        )||'null'
      );

      return (
        x &&
        x.remoteId
      )
        ? x
        : null;

    }catch(_){

      return null;

    }
  }

  function setActiveTrade(order){

    if(!order){

      localStorage.removeItem(
        'demoActiveTrade'
      );

      return;
    }

    localStorage.setItem(
      'demoActiveTrade',
      JSON.stringify(order)
    );

    window.dispatchEvent(
      new CustomEvent(
        'demoActiveTradeUpdated',
        {
          detail:{
            order
          }
        }
      )
    );
  }

  function clearActiveTrade(id){

    const x=getActiveTrade();

    if(
      !x ||
      id==null ||
      String(x.remoteId)===
      String(id)
    ){

      localStorage.removeItem(
        'demoActiveTrade'
      );

      window.dispatchEvent(
        new CustomEvent(
          'demoActiveTradeUpdated',
          {
            detail:{
              order:null
            }
          }
        )
      );

    }
  }

  /* ========================================
     READ TRADE
  ======================================== */

  async function getTrade(id){

    if(!id){
      return null;
    }

    const fields=
      'id,uid,symbol,side,amount,'+
      'entry_price,duration_seconds,'+
      'payout_rate,status,result,'+
      'profit_loss,created_at,'+
      'expires_at,settled_at';

    const url=
      SUPABASE_URL+
      '/rest/v1/trade_orders'+
      '?select='+fields+
      '&id=eq.'+
      encodeURIComponent(id)+
      '&uid=eq.'+
      encodeURIComponent(getUid())+
      '&limit=1';

    const r=await fetch(
      url,
      {
        headers:{
          apikey:SUPABASE_KEY,
          Authorization:
            'Bearer '+SUPABASE_KEY
        },
        cache:'no-store'
      }
    );

    if(!r.ok){
      return null;
    }

    const rows=await r.json();

    return Array.isArray(rows)
      ? rows[0]||null
      : null;
  }

  /* ========================================
     FIND ACTIVE PENDING TRADE
  ======================================== */

  async function findOpenTrade(){

    const fields=
      'id,uid,symbol,side,amount,'+
      'entry_price,duration_seconds,'+
      'payout_rate,status,result,'+
      'profit_loss,created_at,'+
      'expires_at,settled_at';

    const url=
      SUPABASE_URL+
      '/rest/v1/trade_orders'+
      '?select='+fields+
      '&uid=eq.'+
      encodeURIComponent(getUid())+
      '&status=eq.pending'+
      '&order=id.desc'+
      '&limit=1';

    const r=await fetch(
      url,
      {
        headers:{
          apikey:SUPABASE_KEY,
          Authorization:
            'Bearer '+SUPABASE_KEY
        },
        cache:'no-store'
      }
    );

    if(!r.ok){
      return null;
    }

    const rows=await r.json();

    return Array.isArray(rows)
      ? rows[0]||null
      : null;
  }

  /* ========================================
     AUTO DRAW RPC
  ======================================== */

  async function settleExpiredTrade(id){

    if(!id){
      return null;
    }

    const r=await fetch(
      SUPABASE_URL+
      '/rest/v1/rpc/'+
      'settle_expired_trade',
      {
        method:'POST',

        headers:{
          apikey:SUPABASE_KEY,
          Authorization:
            'Bearer '+SUPABASE_KEY,
          'Content-Type':
            'application/json'
        },

        body:JSON.stringify({
          p_order_id:Number(id),
          p_uid:getUid()
        })
      }
    );

    if(!r.ok){

      throw new Error(
        await r.text()
      );

    }

    const rows=await r.json();

    return Array.isArray(rows)
      ? rows[0]||null
      : rows;
  }

  /* ========================================
     TRADE HISTORY
  ======================================== */

  function addTradeHistory(
    row,
    pnl
  ){

    let h=
      readArray('demoHistory');

    const id=
      String(row.id);

    if(
      h.some(
        x=>
          String(
            x.remoteId||''
          )===id
      )
    ){
      return;
    }

    h.unshift({

      time:Date.now(),

      symbol:
        row.symbol||'BTC',

      side:
        row.side||'BUY',

      amount:
        Number(row.amount)||0,

      entry:
        Number(
          row.entry_price
        )||0,

      exit:
        Number(
          row.entry_price
        )||0,

      result:
        row.result||'DRAW',

      pnl:
        Number(pnl)||0,

      remoteId:
        row.id

    });

    localStorage.setItem(
      'demoHistory',
      JSON.stringify(
        h.slice(0,100)
      )
    );
  }

  /* ========================================
     SETTLEMENT LOCK
  ======================================== */

  function acquireTradeLock(id){

    const key=
      'tradeSettlementLock_'+id;

    const token=
      Date.now()+
      '_'+
      Math.random()
        .toString(36)
        .slice(2);

    try{

      const current=
        JSON.parse(
          localStorage.getItem(key)
          ||'null'
        );

      if(
        current &&
        Date.now()-
        Number(
          current.time||0
        )<10000
      ){

        return null;

      }

      localStorage.setItem(
        key,
        JSON.stringify({
          token,
          time:Date.now()
        })
      );

      const check=
        JSON.parse(
          localStorage.getItem(key)
          ||'null'
        );

      return (
        check &&
        check.token===token
      )
        ? {key,token}
        : null;

    }catch(_){

      return {
        key,
        token
      };

    }
  }

  function releaseTradeLock(lock){

    if(!lock){
      return;
    }

    try{

      const current=
        JSON.parse(
          localStorage.getItem(
            lock.key
          )||'null'
        );

      if(
        !current ||
        current.token===
        lock.token
      ){

        localStorage.removeItem(
          lock.key
        );

      }

    }catch(_){

      localStorage.removeItem(
        lock.key
      );

    }
  }

  /* ========================================
     APPLY SETTLED RESULT TO BALANCE
  ======================================== */

  async function processSettledTrade(row){

    if(
      !row ||
      row.status!=='settled' ||
      ![
        'WIN',
        'LOSS',
        'DRAW'
      ].includes(row.result)
    ){
      return false;
    }

    const expires=
      new Date(
        row.expires_at
      ).getTime();

    /*
      Admin can choose the result before
      countdown finishes, but customer
      balance only settles at expiry.
    */
    if(
      Number.isFinite(expires) &&
      Date.now()+500<expires
    ){
      return false;
    }

    const processed=
      readArray(
        'processedTradeIds'
      ).map(String);

    const id=
      String(row.id);

    if(
      processed.includes(id)
    ){

      clearActiveTrade(id);

      return false;
    }

    const lock=
      acquireTradeLock(id);

    if(!lock){
      return false;
    }

    try{

      const again=
        readArray(
          'processedTradeIds'
        ).map(String);

      if(
        again.includes(id)
      ){
        return false;
      }

      const amount=
        Number(row.amount)||0;

      const rate=
        Math.max(
          0,
          Number(
            row.payout_rate
          )||0
        );

      let pnl=0;
      let credit=0;

      if(
        row.result==='WIN'
      ){

        pnl=
          Number(
            row.profit_loss
          );

        if(
          !Number.isFinite(pnl) ||
          pnl<0
        ){

          pnl=
            amount*rate;

        }

        /*
          WIN:
          return principal
          + profit
        */
        credit=
          amount+pnl;

      }else if(
        row.result==='DRAW'
      ){

        pnl=0;

        /*
          DRAW:
          return principal
        */
        credit=amount;

      }else{

        /*
          LOSS:
          principal was already
          deducted when order
          was placed.
        */
        pnl=-amount;
        credit=0;

      }

      if(credit>0){

        setBalance(
          getBalance()+credit
        );

      }

      addTradeHistory(
        row,
        pnl
      );

      again.push(id);

      writeArray(
        'processedTradeIds',
        again,
        1000
      );

      clearActiveTrade(id);

      window.dispatchEvent(
        new CustomEvent(
          'demoTradeSettled',
          {
            detail:{
              row,
              pnl,
              credit,
              balance:
                getBalance()
            }
          }
        )
      );

      return true;

    }finally{

      releaseTradeLock(lock);

    }
  }

  /* ========================================
     GLOBAL TRADE POLLING

     This runs on every page that loads
     balance-sync.js.

     Markets / Trading / Assets / Profile
     can therefore continue checking the
     order instead of relying only on the
     Trading page countdown.
  ======================================== */

  let tradePolling=false;

  async function pollTradeStatus(){

    if(tradePolling){
      return;
    }

    tradePolling=true;

    try{

      const uid=getUid();

      const fields=
        'id,uid,symbol,side,amount,'+
        'entry_price,duration_seconds,'+
        'payout_rate,status,result,'+
        'profit_loss,created_at,'+
        'expires_at,settled_at';

      const url=
        SUPABASE_URL+
        '/rest/v1/trade_orders'+
        '?select='+fields+
        '&uid=eq.'+
        encodeURIComponent(uid)+
        '&order=id.desc'+
        '&limit=100';

      let r=await fetch(
        url,
        {
          headers:{
            apikey:SUPABASE_KEY,
            Authorization:
              'Bearer '+SUPABASE_KEY
          },
          cache:'no-store'
        }
      );

      if(!r.ok){
        return;
      }

      let rows=
        await r.json();

      if(
        !Array.isArray(rows)
      ){
        return;
      }

      let changed=false;

      const now=
        Date.now();

      /*
        Any pending order that has
        expired is converted to DRAW.
      */

      for(const row of rows){

        if(
          row.status!=='pending'
        ){
          continue;
        }

        const expires=
          new Date(
            row.expires_at
          ).getTime();

        if(
          Number.isFinite(expires) &&
          expires<=now
        ){

          try{

            await settleExpiredTrade(
              row.id
            );

            changed=true;

          }catch(e){

            console.warn(
              'Expired trade DRAW sync failed',
              e
            );

          }

        }
      }

      /*
        Reload rows after automatic
        DRAW changes.
      */

      if(changed){

        r=await fetch(
          url,
          {
            headers:{
              apikey:
                SUPABASE_KEY,

              Authorization:
                'Bearer '+
                SUPABASE_KEY
            },

            cache:'no-store'
          }
        );

        if(r.ok){

          const x=
            await r.json();

          if(
            Array.isArray(x)
          ){
            rows=x;
          }

        }
      }

      /*
        Apply every completed order
        exactly once.
      */

      for(const row of rows){

        await processSettledTrade(
          row
        );

      }

    }catch(e){

      console.warn(
        'Trade status check failed',
        e
      );

    }finally{

      tradePolling=false;

    }
  }

  /* ========================================
     PUBLIC API
  ======================================== */

  window.DemoDepositSync={

    poll:
      pollDepositStatus,

    getUid,

    setBalance,

    getBalance

  };

  window.DemoTradeSync={

    poll:
      pollTradeStatus,

    getUid,

    getTrade,

    findOpenTrade,

    settleExpiredTrade,

    processSettledTrade,

    getActiveTrade,

    setActiveTrade,

    clearActiveTrade,

    getBalance,

    setBalance

  };

  /* ========================================
     START
  ======================================== */

  function start(){

    ensureToast();

    pollDepositStatus();

    pollTradeStatus();

    setInterval(
      pollDepositStatus,
      5000
    );

    setInterval(
      pollTradeStatus,
      POLL_MS
    );
  }

  if(
    document.readyState===
    'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      start
    );

  }else{

    start();

  }

})();
