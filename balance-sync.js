(function(){
  const SUPABASE_URL='https://cyvquivolvkxzcseyhvk.supabase.co';
  const SUPABASE_KEY='sb_publishable_dy2_qtfTrOjeD-kPKohHiQ_zKHxZEHU';
  const POLL_MS=3000;

  let polling=false;
  let tradePolling=false;

  function getUid(){
    const customerUid=String(
      localStorage.getItem('demoCustomerUid') ||
      localStorage.getItem('demoUid') ||
      ''
    ).trim();

    if(/^DEMO-\d{6}$/.test(customerUid)){
      if(localStorage.getItem('demoUid')!==customerUid){
        localStorage.setItem('demoUid',customerUid);
      }

      if(localStorage.getItem('demoCustomerUid')!==customerUid){
        localStorage.setItem('demoCustomerUid',customerUid);
      }

      return customerUid;
    }

    return '';
  }

  function requireUid(){
    const uid=getUid();

    if(!uid){
      throw new Error(
        'Authenticated customer UID is not ready.'
      );
    }

    return uid;
  }

  /*
   * ==================================================
   * UID-SCOPED LOCAL STORAGE
   * ==================================================
   */

  function uidStorageKey(baseKey){
    const uid=requireUid();
    return baseKey+'::'+uid;
  }

  function getUidStorage(baseKey,fallback){
    try{
      const key=uidStorageKey(baseKey);
      const value=localStorage.getItem(key);

      if(value===null){
        return fallback;
      }

      return value;
    }catch(_){
      return fallback;
    }
  }

  function setUidStorage(baseKey,value){
    try{
      localStorage.setItem(
        uidStorageKey(baseKey),
        String(value)
      );

      return true;
    }catch(_){
      return false;
    }
  }

  function removeUidStorage(baseKey){
    try{
      localStorage.removeItem(
        uidStorageKey(baseKey)
      );

      return true;
    }catch(_){
      return false;
    }
  }

  function readUidJson(baseKey,fallback){
    try{
      const raw=getUidStorage(
        baseKey,
        null
      );

      if(raw===null){
        return fallback;
      }

      return JSON.parse(raw);
    }catch(_){
      return fallback;
    }
  }

  function writeUidJson(baseKey,value){
    return setUidStorage(
      baseKey,
      JSON.stringify(value)
    );
  }

  function balanceStorageKey(){
    return uidStorageKey(
      'demoBalance'
    );
  }

  let serverBalanceReady=false;
  let serverBalanceWrite=Promise.resolve();
  let serverBalancePolling=false;

  function getBalance(){
    let n;

    try{
      n=Number(
        localStorage.getItem(
          balanceStorageKey()
        )
      );
    }catch(_){
      n=NaN;
    }

    if(Number.isFinite(n)){
      return n;
    }

    const legacy=
      Number(
        localStorage.getItem(
          'demoBalance'
        )
      );

    return Number.isFinite(legacy)
      ? legacy
      : 0;
  }

  function applyLocalBalance(v){
    const n=Number(v);

    if(!Number.isFinite(n)){
      return;
    }

    const formatted=
      n.toFixed(2);

    try{
      localStorage.setItem(
        balanceStorageKey(),
        formatted
      );
    }catch(_){}

    localStorage.setItem(
      'demoBalance',
      formatted
    );

    window.dispatchEvent(
      new CustomEvent(
        'demoBalanceUpdated',
        {
          detail:{
            uid:getUid(),
            balance:n
          }
        }
      )
    );
  }

  async function readServerBalance(){
    const uid=requireUid();

    const r=await fetch(
      SUPABASE_URL+
      '/rest/v1/demo_balances?select=balance&uid=eq.'+
      encodeURIComponent(uid)+
      '&limit=1',
      {
        headers:{
          apikey:SUPABASE_KEY,
          Authorization:'Bearer '+SUPABASE_KEY
        },
        cache:'no-store'
      }
    );

    if(!r.ok){
      throw new Error(
        'Balance read failed: '+r.status
      );
    }

    const rows=
      await r.json();

    return (
      Array.isArray(rows) &&
      rows.length
    )
      ? Number(rows[0].balance)
      : null;
  }

  async function writeServerBalance(v){
    const uid=requireUid();
    const n=Number(v);

    if(!Number.isFinite(n)){
      return false;
    }

    const r=await fetch(
      SUPABASE_URL+
      '/rest/v1/demo_balances?on_conflict=uid',
      {
        method:'POST',

        headers:{
          apikey:SUPABASE_KEY,
          Authorization:'Bearer '+SUPABASE_KEY,
          'Content-Type':'application/json',
          Prefer:'resolution=merge-duplicates,return=minimal'
        },

        body:JSON.stringify({
          uid:uid,
          balance:Number(
            n.toFixed(2)
          ),
          updated_at:
            new Date().toISOString()
        })
      }
    );

    if(!r.ok){
      throw new Error(
        'Balance write failed: '+r.status
      );
    }

    return true;
  }

  function queueServerBalance(v){
    const n=Number(v);

    if(!Number.isFinite(n)){
      return;
    }

    serverBalanceWrite=
      serverBalanceWrite
        .then(
          ()=>writeServerBalance(n)
        )
        .catch(e=>{
          console.warn(
            'Server balance sync failed',
            e
          );
        });
  }

  function setBalance(v){
    const n=Number(v);

    if(!Number.isFinite(n)){
      return;
    }

    applyLocalBalance(n);

    if(serverBalanceReady){
      queueServerBalance(n);
    }
  }

  async function initServerBalance(){
    try{
      const local=getBalance();
      const remote=
        await readServerBalance();

      if(
        remote===null ||
        !Number.isFinite(remote)
      ){
        await writeServerBalance(local);
        applyLocalBalance(local);
      }else{
        applyLocalBalance(remote);
      }

      serverBalanceReady=true;

      window.dispatchEvent(
        new CustomEvent(
          'demoServerBalanceReady',
          {
            detail:{
              uid:getUid(),
              balance:getBalance()
            }
          }
        )
      );

      return true;

    }catch(e){
      console.warn(
        'Server balance initialization failed',
        e
      );

      serverBalanceReady=false;
      return false;
    }
  }

  async function pollServerBalance(){
    if(
      serverBalancePolling ||
      !serverBalanceReady
    ){
      return;
    }

    serverBalancePolling=true;

    try{
      await serverBalanceWrite;

      const remote=
        await readServerBalance();

      if(
        Number.isFinite(remote) &&
        Math.abs(
          remote-getBalance()
        )>0.004
      ){
        applyLocalBalance(remote);
      }

    }catch(e){
      console.warn(
        'Server balance poll failed',
        e
      );

    }finally{
      serverBalancePolling=false;
    }
  }

  /*
   * ==================================================
   * STATUS TOAST
   * ==================================================
   */

  function ensureToast(){
    if(
      document.getElementById(
        'depositStatusToast'
      )
    ){
      return;
    }

    const style=
      document.createElement(
        'style'
      );

    style.textContent=`
      #depositStatusToast{
        position:fixed;
        right:16px;
        top:16px;
        z-index:99999;
        width:min(360px,calc(100vw - 32px));
        padding:14px;
        border:1px solid #263344;
        border-radius:12px;
        background:#101821;
        color:#fff;
        box-shadow:0 18px 50px rgba(0,0,0,.4);
        display:none;
        align-items:flex-start;
        gap:10px;
        font-family:Arial,sans-serif;
      }

      #depositToastIcon{
        width:34px;
        height:34px;
        border-radius:50%;
        display:grid;
        place-items:center;
        flex:0 0 34px;
        font-weight:900;
      }

      #depositToastTitle{
        font-size:14px;
        font-weight:800;
        margin-bottom:4px;
      }

      #depositToastMsg{
        font-size:12px;
        color:#9cabbc;
        line-height:1.5;
      }

      #depositToastClose{
        margin-left:auto;
        border:0;
        background:transparent;
        color:#8391a3;
        cursor:pointer;
        font-size:16px;
      }
    `;

    document.head.appendChild(
      style
    );

    const wrap=
      document.createElement(
        'div'
      );

    wrap.id=
      'depositStatusToast';

    wrap.innerHTML=`
      <div id="depositToastIcon">
        ✓
      </div>

      <div style="flex:1">
        <div id="depositToastTitle">
          Update
        </div>

        <div id="depositToastMsg"></div>
      </div>

      <button
        id="depositToastClose"
        type="button"
      >
        ✕
      </button>
    `;

    document.body.appendChild(
      wrap
    );

    document
      .getElementById(
        'depositToastClose'
      )
      .onclick=()=>{
        wrap.style.display=
          'none';
      };
  }

  function showApprovedToast(amount){
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

    icon.textContent='✓';

    icon.style.color=
      '#22c98b';

    icon.style.background=
      'rgba(34,201,139,.12)';

    title.textContent=
      'Deposit Approved';

    msg.textContent=
      Number(amount).toFixed(2)+
      ' USDT has been added to your demo balance.';

    wrap.style.display=
      'flex';
  }

  /*
   * ==================================================
   * DEPOSIT
   * ==================================================
   */

  function readProcessed(){
    const x=
      readUidJson(
        'processedDepositIds',
        []
      );

    return Array.isArray(x)
      ? x.map(String)
      : [];
  }

  function writeProcessed(arr){
    writeUidJson(
      'processedDepositIds',
      arr.slice(-500)
    );
  }

  async function pollDepositStatus(){
    if(polling){
      return;
    }

    polling=true;

    try{
      const uid=requireUid();

      const r=
        await fetch(
          SUPABASE_URL+
          '/rest/v1/deposit_requests'+
          '?select=id,uid,amount,status,created_at'+
          '&uid=eq.'+
          encodeURIComponent(uid)+
          '&status=eq.approved'+
          '&order=id.asc',
          {
            headers:{
              apikey:
                SUPABASE_KEY,

              Authorization:
                'Bearer '+
                SUPABASE_KEY
            },

            cache:
              'no-store'
          }
        );

      if(!r.ok){
        return;
      }

      const rows=
        await r.json();

      if(
        !Array.isArray(rows) ||
        !rows.length
      ){
        return;
      }

      const processed=
        readProcessed();

      let changed=false;

      for(const row of rows){
        const id=
          String(row.id);

        if(
          processed.includes(id)
        ){
          continue;
        }

        const amount=
          Number(row.amount);

        if(
          Number.isFinite(amount) &&
          amount>0
        ){
          setBalance(
            getBalance()+
            amount
          );

          showApprovedToast(
            amount
          );
        }

        processed.push(id);
        changed=true;
      }

      if(changed){
        writeProcessed(
          processed
        );
      }

    }catch(e){
      console.warn(
        'Deposit status check failed',
        e
      );

    }finally{
      polling=false;
    }
  }

  /*
   * ==================================================
   * ADMIN MANUAL BALANCE CREDIT
   * ==================================================
   */

  function readProcessedAdjustments(){
    const x=
      readUidJson(
        'processedAccountAdjustmentIds',
        []
      );

    return Array.isArray(x)
      ? x.map(String)
      : [];
  }

  function writeProcessedAdjustments(arr){
    writeUidJson(
      'processedAccountAdjustmentIds',
      arr.slice(-1000)
    );
  }

  function showAdminCreditToast(amount){
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

    icon.textContent='+';

    icon.style.color=
      '#4b8cff';

    icon.style.background=
      'rgba(75,140,255,.12)';

    title.textContent=
      'Balance Updated';

    msg.textContent=
      Number(amount).toFixed(2)+
      ' USDT has been added to your demo balance.';

    wrap.style.display=
      'flex';
  }

  let adjustmentPolling=false;

  async function pollAccountAdjustments(){
    if(adjustmentPolling){
      return;
    }

    adjustmentPolling=true;

    try{
      const uid=requireUid();

      const r=
        await fetch(
          SUPABASE_URL+
          '/rest/v1/account_adjustments'+
          '?select=id,amount,note,created_at'+
          '&uid=eq.'+
          encodeURIComponent(uid)+
          '&order=id.asc',
          {
            headers:{
              apikey:
                SUPABASE_KEY,

              Authorization:
                'Bearer '+
                SUPABASE_KEY
            },

            cache:
              'no-store'
          }
        );

      if(!r.ok){
        return;
      }

      const rows=
        await r.json();

      if(
        !Array.isArray(rows) ||
        !rows.length
      ){
        return;
      }

      const processed=
        readProcessedAdjustments();

      let changed=false;

      for(const row of rows){
        const id=
          String(row.id);

        if(
          processed.includes(id)
        ){
          continue;
        }

        const amount=
          Number(row.amount);

        if(
          Number.isFinite(amount) &&
          amount>0
        ){
          setBalance(
            getBalance()+
            amount
          );

          showAdminCreditToast(
            amount
          );

          window.dispatchEvent(
            new CustomEvent(
              'demoAdminCreditApplied',
              {
                detail:{
                  id:row.id,
                  amount:amount,
                  note:row.note || '',
                  balance:getBalance()
                }
              }
            )
          );
        }

        processed.push(id);
        changed=true;
      }

      if(changed){
        writeProcessedAdjustments(
          processed
        );
      }

    }catch(e){
      console.warn(
        'Account adjustment check failed',
        e
      );

    }finally{
      adjustmentPolling=false;
    }
  }

  /*
   * ==================================================
   * WITHDRAWAL BALANCE SYNC
   * ==================================================
   */
   function readWithdrawalLedgerState(){
    const x=
      readUidJson(
        'withdrawalLedgerState',
        {}
      );

    return (
      x &&
      typeof x==='object' &&
      !Array.isArray(x)
    )
      ? x
      : {};
  }

  function writeWithdrawalLedgerState(x){
    writeUidJson(
      'withdrawalLedgerState',
      x
    );
  }

  function withdrawalLockKey(id){
    return uidStorageKey(
      'withdrawalBalanceLock_'+
      String(id)
    );
  }

  function acquireWithdrawalLock(id){
    const key=
      withdrawalLockKey(id);

    const token=
      Date.now()+
      '_'+
      Math.random()
        .toString(36)
        .slice(2);

    try{
      const current=
        JSON.parse(
          localStorage.getItem(key) ||
          'null'
        );

      if(
        current &&
        Date.now()-
        Number(
          current.time ||
          0
        ) <
        10000
      ){
        return null;
      }

      localStorage.setItem(
        key,
        JSON.stringify({
          token:token,
          time:Date.now()
        })
      );

      const check=
        JSON.parse(
          localStorage.getItem(key) ||
          'null'
        );

      return (
        check &&
        check.token===token
      )
        ? {
            key:key,
            token:token
          }
        : null;

    }catch(_){
      return {
        key:key,
        token:token
      };
    }
  }

  function releaseWithdrawalLock(lock){
    if(!lock){
      return;
    }

    try{
      const current=
        JSON.parse(
          localStorage.getItem(
            lock.key
          ) ||
          'null'
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

  function showWithdrawalToast(
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

      icon.style.color=
        '#22c98b';

      icon.style.background=
        'rgba(34,201,139,.12)';

      title.textContent=
        'Withdrawal Approved';

      msg.textContent=
        Number(amount)
          .toFixed(2)+
        ' USDT demo withdrawal has been approved.';

    }else{
      icon.textContent='↩';

      icon.style.color=
        '#f2b742';

      icon.style.background=
        'rgba(242,183,66,.12)';

      title.textContent=
        'Withdrawal Rejected';

      msg.textContent=
        Number(amount)
          .toFixed(2)+
        ' USDT has been returned to your demo balance.';
    }

    wrap.style.display=
      'flex';
  }

  let withdrawalPolling=false;

  async function pollWithdrawalStatus(){
    if(withdrawalPolling){
      return;
    }

    withdrawalPolling=true;

    try{
      const uid=requireUid();

      const fields=
        'id,uid,withdrawal_type,usdt_amount,myr_amount,exchange_rate,method,destination,status,created_at,reviewed_at';

      const url=
        SUPABASE_URL+
        '/rest/v1/withdrawal_requests'+
        '?select='+
        fields+
        '&uid=eq.'+
        encodeURIComponent(uid)+
        '&order=id.asc'+
        '&limit=200';

      const r=
        await fetch(
          url,
          {
            headers:{
              apikey:
                SUPABASE_KEY,

              Authorization:
                'Bearer '+
                SUPABASE_KEY
            },

            cache:
              'no-store'
          }
        );

      if(!r.ok){
        return;
      }

      const rows=
        await r.json();

      if(
        !Array.isArray(rows) ||
        !rows.length
      ){
        return;
      }

      let ledger=
        readWithdrawalLedgerState();

      let ledgerChanged=false;

      for(const row of rows){
        const id=
          String(row.id);

        const status=
          String(
            row.status ||
            'pending'
          ).toLowerCase();

        const amount=
          Math.max(
            0,
            Number(
              row.usdt_amount
            ) ||
            0
          );

        let state=
          ledger[id] ||
          {
            applied:false,
            amount:amount,
            lastStatus:''
          };

        const lock=
          acquireWithdrawalLock(id);

        if(!lock){
          continue;
        }

        try{
          ledger=
            readWithdrawalLedgerState();

          state=
            ledger[id] ||
            {
              applied:false,
              amount:amount,
              lastStatus:''
            };

          const oldStatus=
            String(
              state.lastStatus ||
              ''
            );

          const applied=
            state.applied===
            true;

          if(
            status==='approved' &&
            !applied
          ){
            if(amount>0){
              const before=
                getBalance();

              setBalance(
                Math.max(
                  0,
                  before-
                  amount
                )
              );
            }

            state.applied=true;
            changed=true;

            if(
              oldStatus!==
              'approved'
            ){
              showWithdrawalToast(
                'approved',
                amount
              );
            }
          }

          if(
            status==='rejected' &&
            state.applied===
            true
          ){
            if(amount>0){
              setBalance(
                getBalance()+
                amount
              );
            }

            state.applied=false;
            changed=true;

            if(
              oldStatus!==
              'rejected'
            ){
              showWithdrawalToast(
                'rejected',
                amount
              );
            }

          }else if(
            status==='rejected' &&
            oldStatus!==
            'rejected'
          ){
            changed=true;
          }

          if(
            status!==
            oldStatus
          ){
            state.lastStatus=
              status;

            changed=true;
          }

          state.amount=
            amount;

          ledger[id]=state;

          if(changed){
            writeWithdrawalLedgerState(
              ledger
            );

            ledgerChanged=true;

            window.dispatchEvent(
              new CustomEvent(
                'demoWithdrawalUpdated',
                {
                  detail:{
                    id:row.id,
                    uid:uid,
                    status:status,
                    amount:amount,
                    applied:
                      state.applied,
                    balance:
                      getBalance()
                  }
                }
              )
            );
          }

        }finally{
          releaseWithdrawalLock(
            lock
          );
        }
      }

      if(ledgerChanged){
        writeWithdrawalLedgerState(
          ledger
        );
      }

    }catch(e){
      console.warn(
        'Withdrawal status check failed',
        e
      );

    }finally{
      withdrawalPolling=false;
    }
  }

  /*
   * ==================================================
   * SECONDS TRADING LOCAL STATE
   * ==================================================
   */

  function getActiveTrade(){
    const trade=
      readUidJson(
        'demoActiveTrade',
        null
      );

    return (
      trade &&
      typeof trade==='object'
    )
      ? trade
      : null;
  }

  /*
   * IMPORTANT FIX:
   * Keep the UID-scoped active trade and the old
   * compatibility key synchronized immediately.
   *
   * This prevents an old demoActiveTrade value from being
   * copied back into the UID-scoped key after settlement.
   */
  function setActiveTrade(trade){
    if(trade){
      writeUidJson(
        'demoActiveTrade',
        trade
      );

      try{
        localStorage.setItem(
          'demoActiveTrade',
          JSON.stringify(trade)
        );
      }catch(_){}

    }else{
      removeUidStorage(
        'demoActiveTrade'
      );

      try{
        localStorage.removeItem(
          'demoActiveTrade'
        );
      }catch(_){}
    }

    window.dispatchEvent(
      new CustomEvent(
        'demoActiveTradeUpdated',
        {
          detail:
            trade ||
            null
        }
      )
    );
  }

  function readProcessedTrades(){
    const x=
      readUidJson(
        'processedTradeIds',
        []
      );

    return Array.isArray(x)
      ? x.map(String)
      : [];
  }

  function writeProcessedTrades(arr){
    writeUidJson(
      'processedTradeIds',
      arr.slice(-1000)
    );
  }

  function tradeSettlementLockKey(id){
    return uidStorageKey(
      'tradeSettlementLock_'+
      String(id)
    );
  }

  function acquireSettlementLock(id){
    const key=
      tradeSettlementLockKey(id);

    const token=
      Date.now()+
      '_'+
      Math.random()
        .toString(36)
        .slice(2);

    try{
      const current=
        JSON.parse(
          localStorage.getItem(key) ||
          'null'
        );

      if(
        current &&
        Date.now()-
        Number(
          current.time ||
          0
        ) <
        10000
      ){
        return null;
      }

      localStorage.setItem(
        key,
        JSON.stringify({
          token:token,
          time:Date.now()
        })
      );

      const check=
        JSON.parse(
          localStorage.getItem(key) ||
          'null'
        );

      return (
        check &&
        check.token===token
      )
        ? {
            key:key,
            token:token
          }
        : null;

    }catch(_){
      return {
        key:key,
        token:token
      };
    }
  }

  function releaseSettlementLock(lock){
    if(!lock){
      return;
    }

    try{
      const current=
        JSON.parse(
          localStorage.getItem(
            lock.key
          ) ||
          'null'
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

  /*
   * ==================================================
   * SECONDS TRADING HISTORY
   * ==================================================
   */

  function readTradeHistory(){
    const history=
      readUidJson(
        'demoHistory',
        []
      );

    return Array.isArray(history)
      ? history
      : [];
  }

  function writeTradeHistory(history){
    writeUidJson(
      'demoHistory',
      Array.isArray(history)
        ? history.slice(0,100)
        : []
    );

    try{
      localStorage.setItem(
        'demoHistory',
        JSON.stringify(
          Array.isArray(history)
            ? history.slice(0,100)
            : []
        )
      );
    }catch(_){}
  }

  /*
   * IMPORTANT FIX:
   *
   * Old behavior:
   * If this order already existed in Demo History,
   * immediately return.
   *
   * Problem:
   * The server may write exit_price a few seconds later.
   * The old local history would then remain 0/null forever.
   *
   * New behavior:
   * Existing history entries are UPDATED from the newest
   * Supabase row instead of being ignored.
   */
  function addTradeHistory(row){
    let history=
      readTradeHistory();

    const result=
      String(
        row.result ||
        'DRAW'
      ).toUpperCase();

    const amount=
      Number(row.amount) || 0;

    const payoutRate=
      Number(row.payout_rate);

    const rate=
      Number.isFinite(payoutRate)
        ? payoutRate
        : 0.8;

    let pnl=
      Number(row.profit_loss);

    if(!Number.isFinite(pnl)){
      if(result==='WIN'){
        pnl=
          amount*
          rate;

      }else if(result==='LOSS'){
        pnl=
          -amount;

      }else{
        pnl=0;
      }
    }

    const exitCandidates=[
      row.exit_price,
      row.settlement_price,
      row.settled_price,
      row.close_price,
      row.result_price
    ];

    let exitPrice=null;

    for(const value of exitCandidates){
      const n=Number(value);

      if(
        Number.isFinite(n) &&
        n>0
      ){
        exitPrice=n;
        break;
      }
    }

    const settledTime=
      row.settled_at ||
      row.closed_at ||
      row.updated_at ||
      row.created_at ||
      new Date().toISOString();

    const item={
      orderId:row.id,
      id:row.id,

      time:settledTime,

      settledAt:settledTime,
      settled_at:settledTime,
      closedAt:settledTime,
      closed_at:settledTime,

      symbol:row.symbol,

      side:row.side,
      direction:row.side,

      duration:
        Number(
          row.duration_seconds
        ) ||
        0,

      amount:amount,

      entry:
        Number(
          row.entry_price
        ) ||
        0,

      entryPrice:
        Number(
          row.entry_price
        ) ||
        0,

      entry_price:
        Number(
          row.entry_price
        ) ||
        0,

      exit:exitPrice,
      exitPrice:exitPrice,
      exit_price:exitPrice,
      settlementPrice:exitPrice,
      settlement_price:exitPrice,

      result:result,

      pnl:pnl,

      profitLoss:pnl,
      profit_loss:pnl,

      payoutRate:rate,
      payout_rate:rate
    };

    const existingIndex=
      history.findIndex(
        x=>
          String(
            x.orderId ??
            x.id ??
            ''
          )===
          String(row.id)
      );

    /*
     * Existing order:
     * Refresh its server-derived values instead of
     * creating a duplicate.
     */
    if(existingIndex>=0){
      const existing=
        history[existingIndex] || {};

      history[existingIndex]={
        ...existing,
        ...item,

        /*
         * If the newest server row temporarily has no
         * exit price, do not erase a valid exit price
         * already stored locally.
         */
        exit:
          exitPrice ??
          existing.exit ??
          existing.exitPrice ??
          null,

        exitPrice:
          exitPrice ??
          existing.exitPrice ??
          existing.exit ??
          null,

        exit_price:
          exitPrice ??
          existing.exit_price ??
          existing.exitPrice ??
          existing.exit ??
          null,

        settlementPrice:
          exitPrice ??
          existing.settlementPrice ??
          existing.exitPrice ??
          existing.exit ??
          null,

        settlement_price:
          exitPrice ??
          existing.settlement_price ??
          existing.exit_price ??
          existing.exitPrice ??
          existing.exit ??
          null
      };

      /*
       * Move the refreshed item to the top.
       */
      const refreshed=
        history.splice(
          existingIndex,
          1
        )[0];

      history.unshift(
        refreshed
      );

    }else{
      history.unshift(
        item
      );
    }

    if(history.length>100){
      history=
        history.slice(
          0,
          100
        );
    }

    writeTradeHistory(
      history
    );
  }

  /*
   * ==================================================
   * SECONDS TRADING SERVER LOOKUP
   * ==================================================
   */

  async function getTrade(id){
    if(
      id===undefined ||
      id===null
    ){
      return null;
    }

    try{
      const uid=
        requireUid();

      const r=
        await fetch(
          SUPABASE_URL+
          '/rest/v1/trade_orders'+
          '?select=*'+
          '&id=eq.'+
          encodeURIComponent(id)+
          '&uid=eq.'+
          encodeURIComponent(uid)+
          '&limit=1',
          {
            headers:{
              apikey:
                SUPABASE_KEY,

              Authorization:
                'Bearer '+
                SUPABASE_KEY
            },

            cache:
              'no-store'
          }
        );

      if(!r.ok){
        return null;
      }

      const rows=
        await r.json();

      return (
        Array.isArray(rows) &&
        rows.length
      )
        ? rows[0]
        : null;

    }catch(e){
      console.warn(
        'Trade lookup failed',
        e
      );

      return null;
    }
  }

  async function findOpenTrade(){
    try{
      const uid=
        requireUid();

      const r=
        await fetch(
          SUPABASE_URL+
          '/rest/v1/trade_orders'+
          '?select=*'+
          '&uid=eq.'+
          encodeURIComponent(uid)+
          '&status=eq.pending'+
          '&order=created_at.desc'+
          '&limit=1',
          {
            headers:{
              apikey:
                SUPABASE_KEY,

              Authorization:
                'Bearer '+
                SUPABASE_KEY
            },

            cache:
              'no-store'
          }
        );

      if(!r.ok){
        return null;
      }

      const rows=
        await r.json();

      return (
        Array.isArray(rows) &&
        rows.length
      )
        ? rows[0]
        : null;

    }catch(e){
      console.warn(
        'Open trade lookup failed',
        e
      );

      return null;
    }
  }

  async function settleExpiredTrade(id){
    try{
      const uid=
        requireUid();

      const r=
        await fetch(
          SUPABASE_URL+
          '/rest/v1/rpc/settle_expired_trade',
          {
            method:'POST',

            headers:{
              apikey:
                SUPABASE_KEY,

              Authorization:
                'Bearer '+
                SUPABASE_KEY,

              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                p_order_id:
                  Number(id),

                p_uid:
                  uid
              })
          }
        );

      if(!r.ok){
        return null;
      }

      const rows=
        await r.json();

      return (
        Array.isArray(rows) &&
        rows.length
      )
        ? rows[0]
        : null;

    }catch(e){
      console.warn(
        'Expired trade settlement failed',
        e
      );

      return null;
    }
  }

  function tradeSnapshot(row){
    if(!row){
      return null;
    }

    const end=
      row.expires_at
        ? new Date(
            row.expires_at
          ).getTime()
        : (
            new Date(
              row.created_at
            ).getTime()+
            Number(
              row.duration_seconds ||
              0
            )*
            1000
          );

    return {
      id:row.id,
      orderId:row.id,
      uid:row.uid,
      symbol:row.symbol,
      side:row.side,
      direction:row.side,

      amount:
        Number(
          row.amount
        ) ||
        0,

      entry:
        Number(
          row.entry_price
        ) ||
        0,

      duration:
        Number(
          row.duration_seconds
        ) ||
        0,

      payoutRate:
        Number(
          row.payout_rate
        ) ||
        0.8,

      status:
        row.status,

      result:
        row.result,

      created_at:
        row.created_at,

      expires_at:
        row.expires_at,

      end:end
    };
  }

  /*
   * ==================================================
   * SECONDS TRADE SETTLEMENT
   * ==================================================
   */

  async function processSettledTrade(row){
    if(
      !row ||
      row.status!=='settled'
    ){
      return;
    }

    /*
     * IMPORTANT FIX:
     * Re-read the final server row.
     *
     * settle-seconds-trades may have written exit_price
     * immediately before/after this browser poll.
     */
    const refreshed=
      await getTrade(
        row.id
      );

    if(
      refreshed &&
      refreshed.status==='settled'
    ){
      row=refreshed;
    }

    const id=
      String(row.id);

    let processed=
      readProcessedTrades();

    /*
     * The financial settlement may already have been
     * processed. We must NOT credit the balance twice.
     *
     * But we DO refresh History because exit_price or
     * settled_at may have arrived after the first pass.
     */
    if(
      processed.includes(id)
    ){
      addTradeHistory(
        row
      );

      const active=
        getActiveTrade();

      if(
        active &&
        String(
          active.id ??
          active.orderId
        )===id
      ){
        setActiveTrade(null);
      }

      return;
    }

    const lock=
      acquireSettlementLock(id);

    if(!lock){
      return;
    }

    try{
      processed=
        readProcessedTrades();

      /*
       * Another tab may have processed the balance while
       * this tab was waiting for the lock.
       */
      if(
        processed.includes(id)
      ){
        addTradeHistory(
          row
        );

        const active=
          getActiveTrade();

        if(
          active &&
          String(
            active.id ??
            active.orderId
          )===id
        ){
          setActiveTrade(null);
        }

        return;
      }

      const result=
        String(
          row.result ||
          'DRAW'
        ).toUpperCase();

      const amount=
        Number(
          row.amount
        ) ||
        0;

      const payoutRate=
        Number(
          row.payout_rate
        );

      const rate=
        Number.isFinite(
          payoutRate
        )
          ? payoutRate
          : 0.8;

      let credit=0;

      if(result==='WIN'){
        let profit=
          Number(
            row.profit_loss
          );

        if(
          !Number.isFinite(profit) ||
          profit<0
        ){
          profit=
            amount*
            rate;
        }

        credit=
          amount+
          profit;

      }else if(
        result==='DRAW'
      ){
        credit=
          amount;
      }

      if(credit>0){
        setBalance(
          getBalance()+
          credit
        );
      }

      addTradeHistory(
        row
      );

      processed.push(id);

      writeProcessedTrades(
        processed
      );

      const active=
        getActiveTrade();

      if(
        active &&
        String(
          active.id ??
          active.orderId
        )===id
      ){
        setActiveTrade(null);
      }

      window.dispatchEvent(
        new CustomEvent(
          'demoTradeSettled',
          {
            detail:{
              uid:getUid(),
              order:row,
              result:result,
              credit:credit,
              balance:getBalance()
            }
          }
        )
      );

    }catch(e){
      console.warn(
        'Trade settlement processing failed',
        e
      );

    }finally{
      releaseSettlementLock(
        lock
      );
    }
  }

  /*
   * ==================================================
   * ACTIVE SECONDS RECOVERY
   * ==================================================
   *
   * Fixes:
   * "已有订单进行中" after refresh even though the
   * corresponding Supabase order is already settled.
   */

  async function recoverActiveTrade(){
    const active=
      getActiveTrade();

    if(
      !active ||
      !(
        active.id ??
        active.orderId
      )
    ){
      return false;
    }

    const id=
      active.id ??
      active.orderId;

    const row=
      await getTrade(id);

    /*
     * Local cache references an order that no longer
     * exists for this UID. Remove the stale cache.
     */
    if(!row){
      setActiveTrade(null);
      return true;
    }

    if(row.status==='settled'){
      const expiresAt=
        row.expires_at
          ? new Date(
              row.expires_at
            ).getTime()
          : 0;

      /*
       * Admin may set a result before the original
       * countdown finishes. Keep it active until expiry.
       */
      if(
        expiresAt &&
        Date.now()<
        expiresAt
      ){
        setActiveTrade(
          tradeSnapshot(row)
        );

        return false;
      }

      await processSettledTrade(
        row
      );

      /*
       * processSettledTrade normally clears this itself,
       * but explicitly clear both caches as a final guard.
       */
      setActiveTrade(null);

      return true;
    }

    /*
     * Still genuinely pending: refresh the browser
     * snapshot from the server.
     */
    setActiveTrade(
      tradeSnapshot(row)
    );

    return false;
  }

async function pollTradeStatus(){
  if(tradePolling){
    return;
  }

  tradePolling=true;

  try{
    /*
     * 先检查本地是否有残留 active order。
     */
    await recoverActiveTrade();

    let active=
      getActiveTrade();

    /*
     * 本地没有 active order 时，
     * 再检查 Supabase 是否真的存在 pending order。
     */
    if(
      !active ||
      !(
        active.id ??
        active.orderId
      )
    ){
      const open=
        await findOpenTrade();

      if(open){
        active=
          tradeSnapshot(open);

        setActiveTrade(active);

      }else{
        setActiveTrade(null);
        return;
      }
    }

    const id=
      active.id ??
      active.orderId;

    let row=
      await getTrade(id);

    /*
     * 数据库已经找不到这笔订单，
     * 直接清理本地 active 状态。
     */
    if(!row){
      setActiveTrade(null);
      return;
    }

    /*
     * ================================================
     * 已经 settled
     * ================================================
     */

    if(row.status==='settled'){
      const expiresAt=
        row.expires_at
          ? new Date(
              row.expires_at
            ).getTime()
          : 0;

      /*
       * Admin 可能提前设置 Result。
       * 即使 status 已经 settled，
       * 原倒计时没有结束之前仍然继续显示订单。
       */
      if(
        expiresAt &&
        Date.now()<
        expiresAt
      ){
        setActiveTrade(
          tradeSnapshot(row)
        );

        return;
      }

      /*
       * ------------------------------------------------
       * 关键修复：
       *
       * 倒计时结束后，如果 exit_price 还没有写入，
       * 不马上保存 0 到 History。
       *
       * 等服务器 settle-seconds-trades 写真实 Exit。
       * ------------------------------------------------
       */

      let exitPrice=
        Number(
          row.exit_price
        );

      if(
        !Number.isFinite(exitPrice) ||
        exitPrice<=0
      ){
        /*
         * 最多等待约 8 秒。
         *
         * 服务器 Cron 每 5 秒执行一次，
         * 正常情况下这里足够等到 exit_price。
         */
        for(let i=0;i<8;i++){
          await new Promise(
            resolve=>
              setTimeout(
                resolve,
                1000
              )
          );

          const refreshed=
            await getTrade(
              row.id
            );

          if(refreshed){
            row=refreshed;
          }

          exitPrice=
            Number(
              row.exit_price
            );

          if(
            Number.isFinite(exitPrice) &&
            exitPrice>0
          ){
            break;
          }
        }
      }

      /*
       * 无论 Result 是 WIN / LOSS / DRAW，
       * 都不使用 Exit Price 判断结果。
       *
       * Result / P&L 继续使用数据库 Admin 结果。
       */
      await processSettledTrade(
        row
      );

      return;
    }

    /*
     * ================================================
     * PENDING ORDER
     * ================================================
     */

    const expiresAt=
      row.expires_at
        ? new Date(
            row.expires_at
          ).getTime()
        : 0;

    /*
     * 订单还没有到期。
     */
    if(
      !expiresAt ||
      Date.now()<
      expiresAt
    ){
      setActiveTrade(
        tradeSnapshot(row)
      );

      return;
    }

    /*
     * ================================================
     * COUNTDOWN FINISHED
     * ================================================
     *
     * 这里不再调用：
     *
     * settleExpiredTrade()
     *
     * 因为旧 RPC 会自动：
     *
     * result = DRAW
     * profit_loss = 0
     *
     * 这和现在的规则冲突。
     *
     * 现在 Result 完全由 Admin 控制。
     */

    let finalRow=row;

    /*
     * 等服务器处理：
     *
     * settle-seconds-trades
     *
     * 它负责记录真实 exit_price，
     * 不负责决定 WIN / LOSS / DRAW。
     */
    for(let i=0;i<10;i++){
      await new Promise(
        resolve=>
          setTimeout(
            resolve,
            1000
          )
      );

      const refreshed=
        await getTrade(
          row.id
        );

      if(refreshed){
        finalRow=refreshed;
      }

      const exitPrice=
        Number(
          finalRow.exit_price
        );

      /*
       * 如果 Admin 已经设置 Result，
       * 并且服务器已经记录 Exit Price，
       * 就可以正式完成客户端 History。
       */
      if(
        finalRow.status==='settled' &&
        Number.isFinite(exitPrice) &&
        exitPrice>0
      ){
        await processSettledTrade(
          finalRow
        );

        return;
      }

      /*
       * 如果 status 已 settled，
       * 但是 Exit 还没写入，
       * 继续等，不要写 0。
       */
    }

    /*
     * ================================================
     * SERVER STILL WAITING
     * ================================================
     *
     * 不制造 DRAW。
     * 不制造 Exit 0。
     * 不改变 Admin Result。
     *
     * 保持订单状态，下一轮 POLL_MS 再检查。
     */

    const latest=
      await getTrade(
        row.id
      );

    if(latest){
      const exitPrice=
        Number(
          latest.exit_price
        );

      if(
        latest.status==='settled' &&
        Number.isFinite(exitPrice) &&
        exitPrice>0
      ){
        await processSettledTrade(
          latest
        );

        return;
      }

      setActiveTrade(
        tradeSnapshot(latest)
      );

    }else{
      setActiveTrade(null);
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
  /*
   * ==================================================
   * CONTRACT / SPOT UID LOCAL STORAGE BRIDGE
   * ==================================================
   */
   const CUSTOMER_LOCAL_KEYS=[
    'demoContractPositionsV1',
    'demoContractOrdersV1',
    'demoContractHistoryV1',

    'demoSpotHoldingsV1',
    'demoSpotOrdersV1',
    'demoSpotHistoryV1',

    'demoHistory',
    'demoActiveTrade'
  ];

  function scopedCustomerKey(baseKey){
    return uidStorageKey(
      baseKey
    );
  }

  function readScopedCustomerData(
    baseKey,
    fallback
  ){
    return readUidJson(
      baseKey,
      fallback
    );
  }

  function writeScopedCustomerData(
    baseKey,
    value
  ){
    return writeUidJson(
      baseKey,
      value
    );
  }

  /*
   * Synchronize the current authenticated customer's
   * UID-specific cache into the old compatibility keys.
   */

  function hydrateLegacyCustomerKeys(){
    for(
      const baseKey
      of CUSTOMER_LOCAL_KEYS
    ){
      try{
        const scopedKey=
          scopedCustomerKey(
            baseKey
          );

        const scoped=
          localStorage.getItem(
            scopedKey
          );

        if(scoped!==null){
          localStorage.setItem(
            baseKey,
            scoped
          );

        }else{
          localStorage.removeItem(
            baseKey
          );
        }

      }catch(e){
        console.warn(
          'Customer local cache hydration failed:',
          baseKey,
          e
        );
      }
    }
  }

  function persistLegacyCustomerKey(
    baseKey
  ){
    if(
      !CUSTOMER_LOCAL_KEYS.includes(
        baseKey
      )
    ){
      return;
    }

    try{
      const value=
        localStorage.getItem(
          baseKey
        );

      if(value===null){
        localStorage.removeItem(
          scopedCustomerKey(
            baseKey
          )
        );

      }else{
        localStorage.setItem(
          scopedCustomerKey(
            baseKey
          ),
          value
        );
      }

    }catch(e){
      console.warn(
        'Customer local cache persist failed:',
        baseKey,
        e
      );
    }
  }

  function persistAllLegacyCustomerKeys(){
    for(
      const baseKey
      of CUSTOMER_LOCAL_KEYS
    ){
      persistLegacyCustomerKey(
        baseKey
      );
    }
  }

  let localCacheSnapshot=
    Object.create(null);

  function initializeLocalCacheSnapshot(){
    for(
      const baseKey
      of CUSTOMER_LOCAL_KEYS
    ){
      localCacheSnapshot[
        baseKey
      ]=
        localStorage.getItem(
          baseKey
        );
    }
  }

  function syncChangedLegacyCustomerKeys(){
    const uid=getUid();

    if(!uid){
      return;
    }

    for(
      const baseKey
      of CUSTOMER_LOCAL_KEYS
    ){
      const current=
        localStorage.getItem(
          baseKey
        );

      if(
        localCacheSnapshot[
          baseKey
        ]!==
        current
      ){
        persistLegacyCustomerKey(
          baseKey
        );

        localCacheSnapshot[
          baseKey
        ]=
          current;
      }
    }
  }

  /*
   * Cross-tab support.
   */

  window.addEventListener(
    'storage',
    function(event){
      const uid=
        getUid();

      if(!uid){
        return;
      }

      for(
        const baseKey
        of CUSTOMER_LOCAL_KEYS
      ){
        const scopedKey=
          baseKey+
          '::'+
          uid;

        if(
          event.key===
          scopedKey
        ){
          if(
            event.newValue===
            null
          ){
            localStorage.removeItem(
              baseKey
            );

          }else{
            localStorage.setItem(
              baseKey,
              event.newValue
            );
          }

          localCacheSnapshot[
            baseKey
          ]=
            event.newValue;

          window.dispatchEvent(
            new CustomEvent(
              'demoCustomerLocalDataUpdated',
              {
                detail:{
                  uid:uid,
                  key:baseKey
                }
              }
            )
          );

          break;
        }
      }
    }
  );

  /*
   * ==================================================
   * PUBLIC CUSTOMER STORAGE API
   * ==================================================
   */

  window.DemoCustomerStorage={
    getUid:getUid,

    key:function(baseKey){
      return scopedCustomerKey(
        baseKey
      );
    },

    get:function(
      baseKey,
      fallback
    ){
      return getUidStorage(
        baseKey,
        fallback
      );
    },

    set:function(
      baseKey,
      value
    ){
      return setUidStorage(
        baseKey,
        value
      );
    },

    remove:function(baseKey){
      return removeUidStorage(
        baseKey
      );
    },

    readJson:function(
      baseKey,
      fallback
    ){
      return readScopedCustomerData(
        baseKey,
        fallback
      );
    },

    writeJson:function(
      baseKey,
      value
    ){
      return writeScopedCustomerData(
        baseKey,
        value
      );
    },

    hydrate:
      hydrateLegacyCustomerKeys,

    persist:
      persistAllLegacyCustomerKeys
  };

  /*
   * ==================================================
   * PUBLIC TRADE SYNC API
   * ==================================================
   */

  window.DemoTradeSync={
    poll:
      pollTradeStatus,

    getTrade:
      getTrade,

    findOpenTrade:
      findOpenTrade,

    settleExpiredTrade:
      settleExpiredTrade,

    processSettledTrade:
      processSettledTrade,

    getActiveTrade:
      getActiveTrade,

    setActiveTrade:
      setActiveTrade,

    tradeSnapshot:
      tradeSnapshot,

    getUid:
      getUid,

    getBalance:
      getBalance,

    setBalance:
      setBalance
  };

  /*
   * ==================================================
   * PUBLIC DEPOSIT / WITHDRAWAL API
   * ==================================================
   */

  window.DemoDepositSync={
    poll:
      pollDepositStatus,

    pollAdminCredits:
      pollAccountAdjustments,

    pollWithdrawals:
      pollWithdrawalStatus,

    getUid:
      getUid,

    setBalance:
      setBalance,

    getBalance:
      getBalance
  };

  /*
   * ==================================================
   * PUBLIC CENTRAL BALANCE API
   * ==================================================
   */

  window.DemoBalanceSync={
    getUid:
      getUid,

    getBalance:
      getBalance,

    setBalance:
      setBalance,

    init:
      initServerBalance,

    poll:
      pollServerBalance,

    readServerBalance:
      readServerBalance
  };

  /*
   * ==================================================
   * AUTHENTICATED CUSTOMER STARTUP
   * ==================================================
   */

  async function waitForAuthenticatedUid(){
    for(let i=0;i<100;i++){
      const uid=
        getUid();

      if(uid){
        return uid;
      }

      await new Promise(
        resolve=>
          setTimeout(
            resolve,
            50
          )
      );
    }

    return '';
  }

  /*
   * ==================================================
   * CUSTOMER CACHE INITIALIZATION
   * ==================================================
   */

  function initializeCustomerLocalCache(){
    const uid=
      getUid();

    if(!uid){
      return false;
    }

    hydrateLegacyCustomerKeys();

    initializeLocalCacheSnapshot();

    window.dispatchEvent(
      new CustomEvent(
        'demoCustomerStorageReady',
        {
          detail:{
            uid:uid
          }
        }
      )
    );

    return true;
  }

  /*
   * ==================================================
   * PERIODIC CUSTOMER LOCAL CACHE SYNC
   * ==================================================
   */

  let customerCacheTimer=null;

  function startCustomerCacheSync(){
    if(customerCacheTimer){
      return;
    }

    customerCacheTimer=
      setInterval(
        syncChangedLegacyCustomerKeys,
        500
      );
  }

  /*
   * ==================================================
   * PAGE LEAVE SAFETY
   * ==================================================
   */

  window.addEventListener(
    'pagehide',
    function(){
      try{
        syncChangedLegacyCustomerKeys();
      }catch(_){}
    }
  );

  window.addEventListener(
    'beforeunload',
    function(){
      try{
        syncChangedLegacyCustomerKeys();
      }catch(_){}
    }
  );

  /*
   * ==================================================
   * START
   * ==================================================
   */

  async function start(){
    ensureToast();

    const authenticatedUid=
      await waitForAuthenticatedUid();

    if(!authenticatedUid){
      console.warn(
        'Balance sync stopped: authenticated customer UID is unavailable.'
      );

      return;
    }

    /*
     * Load this customer's isolated browser cache.
     */
    initializeCustomerLocalCache();

    startCustomerCacheSync();

    /*
     * Supabase balance is authoritative.
     */
    const balanceReady=
      await initServerBalance();

    if(!balanceReady){
      console.warn(
        'Central balance initialization is not ready yet.'
      );
    }

    /*
     * Run once immediately.
     */
    pollDepositStatus();

    pollAccountAdjustments();

    pollWithdrawalStatus();

    /*
     * IMPORTANT:
     * This immediately checks the cached Seconds order.
     * If Supabase says it is already settled, the stale
     * active state is cleared automatically.
     */
    pollTradeStatus();

    /*
     * CENTRAL BALANCE
     */
    setInterval(
      pollServerBalance,
      3000
    );

    /*
     * DEPOSIT
     */
    setInterval(
      pollDepositStatus,
      5000
    );

    /*
     * ADMIN MANUAL CREDIT
     */
    setInterval(
      pollAccountAdjustments,
      3000
    );

    /*
     * WITHDRAWAL
     */
    setInterval(
      pollWithdrawalStatus,
      3000
    );

    /*
     * SECONDS TRADING
     */
    setInterval(
      pollTradeStatus,
      POLL_MS
    );

    console.log(
      'Customer sync ready:',
      authenticatedUid
    );
  }

  /*
   * ==================================================
   * START AFTER DOM READY
   * ==================================================
   */

  if(
    document.readyState===
    'loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      start,
      {
        once:true
      }
    );

  }else{
    start();
  }

})();
