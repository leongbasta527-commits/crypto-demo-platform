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

  async function getAuthenticatedHeaders(){
    if(window.__customerAuthReady){
      await window.__customerAuthReady;
    }

    const auth=window.customerAuth;

    if(
      !auth ||
      !auth.client ||
      !auth.user ||
      !auth.profile
    ){
      throw new Error(
        'Authenticated customer session is not ready.'
      );
    }

    const uid=requireUid();

    const profileUid=String(
      auth.profile.uid || ''
    ).trim();

    if(
      !profileUid ||
      profileUid!==uid
    ){
      throw new Error(
        'Authenticated customer UID mismatch.'
      );
    }

    const {data,error}=
      await auth.client.auth.getSession();

    if(error){
      throw error;
    }

    const token=
      data?.session?.access_token;

    if(!token){
      throw new Error(
        'Authenticated customer access token is unavailable.'
      );
    }

    return {
      apikey:SUPABASE_KEY,
      Authorization:'Bearer '+token
    };
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
        headers:await getAuthenticatedHeaders(),
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

  // Server-owned balance: browser code is read-only.
  async function writeServerBalance(){
    throw new Error(
      'Direct browser balance writes are disabled.'
    );
  }

  function queueServerBalance(){
    // Intentionally disabled.
    // Financial mutations must use domain-specific RPCs.
  }

  function setBalance(v){
    // Compatibility API for UI-only local display.
    // Never writes demo_balances.
    const n=Number(v);

    if(Number.isFinite(n)){
      applyLocalBalance(n);
    }
  }

  async function initServerBalance(){
    try{
      const remote=
        await readServerBalance();

      if(Number.isFinite(remote)){
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
            headers:await getAuthenticatedHeaders(),

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

        /*
         * Deposit approval is server-owned and atomic.
         *
         * approve_deposit_atomic() has already updated:
         * - demo_balances
         * - balance_transactions
         *
         * Browser MUST NOT add the deposit amount again.
         * Only refresh the authoritative server balance.
         */
        if(
          Number.isFinite(amount) &&
          amount>0
        ){
          try{
            const remote=
              await readServerBalance();

            if(Number.isFinite(remote)){
              applyLocalBalance(remote);
            }
          }catch(e){
            console.warn(
              'Approved deposit balance refresh failed',
              e
            );
          }

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
            headers:await getAuthenticatedHeaders(),

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

        /*
         * Admin Credit is server-owned.
         *
         * admin_credit_demo_balance() has already:
         * - locked demo_balances
         * - credited the balance
         * - created account_adjustments
         * - created balance_transactions
         *
         * The browser MUST NOT add the amount again.
         */
        if(
          Number.isFinite(amount) &&
          amount>0
        ){
          try{
            const remote=
              await readServerBalance();

            if(Number.isFinite(remote)){
              applyLocalBalance(remote);
            }
          }catch(e){
            console.warn(
              'Admin credit balance refresh failed',
              e
            );
          }

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
        ' USDT withdrawal was rejected. Check your balance for the refund status.';
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
            headers:await getAuthenticatedHeaders(),

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

          /*
           * Withdrawal balance mutations are server-owned.
           *
           * Never debit or refund money from the browser.
           */
          let changed=false;

          if(
            status==='approved' &&
            oldStatus!=='approved'
          ){
            showWithdrawalToast(
              'approved',
              amount
            );

            try{
              const remote=
                await readServerBalance();

              if(Number.isFinite(remote)){
                applyLocalBalance(remote);
              }
            }catch(e){
              console.warn(
                'Withdrawal approved balance refresh failed',
                e
              );
            }
          }

          if(
            status==='rejected' &&
            oldStatus!=='rejected'
          ){
            showWithdrawalToast(
              'rejected',
              amount
            );

            try{
              const remote=
                await readServerBalance();

              if(Number.isFinite(remote)){
                applyLocalBalance(remote);
              }
            }catch(e){
              console.warn(
                'Withdrawal rejected balance refresh failed',
                e
              );
            }
          }

          /*
           * Legacy browser-applied flag must never cause
           * a future browser credit/debit.
           */
          if(state.applied===true){
            state.applied=false;
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
                    applied:false,
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
   * Keep UID-scoped active trade and compatibility
   * storage synchronized.
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

    if(existingIndex>=0){
      const existing=
        history[existingIndex] || {};

      history[existingIndex]={
        ...existing,
        ...item,

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
   * SECONDS HISTORY SERVER REPAIR
   * ==================================================
   *
   * Refresh recent settled Seconds orders from
   * Supabase into local demoHistory.
   *
   * IMPORTANT:
   * This is display/history synchronization only.
   * It NEVER changes customer balance.
   */

  let secondsHistoryRepairRunning=false;

  async function syncRecentSecondsHistory(){
    if(secondsHistoryRepairRunning){
      return;
    }

    secondsHistoryRepairRunning=true;

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
          '&status=eq.settled'+
          '&order=created_at.desc'+
          '&limit=30',
          {
            headers:await getAuthenticatedHeaders(),

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

      /*
       * Process oldest -> newest.
       *
       * addTradeHistory() moves refreshed rows
       * to the top, so newest remains first.
       */
      const ordered=
        rows.slice().reverse();

      for(const row of ordered){
        if(
          !row ||
          row.status!=='settled'
        ){
          continue;
        }

        const exitPrice=
          Number(
            row.exit_price
          );

        /*
         * Don't overwrite History with a temporary
         * null / zero exit price.
         */
        if(
          !Number.isFinite(exitPrice) ||
          exitPrice<=0
        ){
          continue;
        }

        /*
         * HISTORY ONLY.
         *
         * Never perform financial settlement here.
         */
        addTradeHistory(
          row
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          'demoSecondsHistorySynced',
          {
            detail:{
              uid:uid,
              count:rows.length
            }
          }
        )
      );

    }catch(e){
      console.warn(
        'Seconds History repair failed',
        e
      );

    }finally{
      secondsHistoryRepairRunning=false;
    }
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
            headers:await getAuthenticatedHeaders(),

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
            headers:await getAuthenticatedHeaders(),

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

  /*
   * ==================================================
   * LEGACY EXPIRED TRADE RPC
   * ==================================================
   *
   * Kept only as a compatibility function so older
   * pages do not crash if they reference it.
   *
   * It is intentionally NOT used by the current
   * Seconds Trading flow.
   *
   * Expiry / result / financial settlement must be
   * handled by the server.
   */

  async function settleExpiredTrade(){
    console.warn(
      'Client-side expired trade settlement is disabled.'
    );

    return null;
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
   *
   * IMPORTANT SECURITY CHANGE:
   *
   * The browser NO LONGER calculates or credits:
   *
   * WIN  -> stake + profit
   * DRAW -> stake refund
   * LOSS -> 0
   *
   * admin_settle_seconds_trade_atomic() is now the
   * authority for:
   *
   * - trade result
   * - profit_loss
   * - demo_balances
   * - balance_transactions
   *
   * This function only:
   *
   * - refreshes authoritative balance
   * - writes local History
   * - clears active-order cache
   * - dispatches UI events
   */

  async function processSettledTrade(row){
    if(
      !row ||
      row.status!=='settled'
    ){
      return;
    }

    /*
     * Re-read the final server row so History receives
     * the latest result / P&L / exit price.
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
     * Already processed financially/display-wise.
     *
     * Still refresh History because exit_price may have
     * arrived later.
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

      /*
       * Server balance remains authoritative.
       */
      try{
        const remote=
          await readServerBalance();

        if(Number.isFinite(remote)){
          applyLocalBalance(remote);
        }
      }catch(e){
        console.warn(
          'Settled trade balance refresh failed',
          e
        );
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
       * Another tab may already have processed this
       * local event while this tab waited for the lock.
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

        try{
          const remote=
            await readServerBalance();

          if(Number.isFinite(remote)){
            applyLocalBalance(remote);
          }
        }catch(e){
          console.warn(
            'Settled trade balance refresh failed',
            e
          );
        }

        return;
      }

      const result=
        String(
          row.result ||
          'DRAW'
        ).toUpperCase();

      /*
       * ==============================================
       * NO CLIENT-SIDE MONEY MOVEMENT
       * ==============================================
       *
       * OLD CODE:
       *
       * if(result==='WIN'){
       *   credit=amount+profit;
       * }
       *
       * if(result==='DRAW'){
       *   credit=amount;
       * }
       *
       * setBalance(getBalance()+credit);
       *
       * That logic has been removed.
       */

      let remoteBalance=null;

      try{
        remoteBalance=
          await readServerBalance();

        if(Number.isFinite(remoteBalance)){
          applyLocalBalance(
            remoteBalance
          );
        }

      }catch(e){
        console.warn(
          'Seconds settlement balance refresh failed',
          e
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

              /*
               * Compatibility field only.
               * Browser did NOT credit this amount.
               */
              credit:0,

              balance:
                Number.isFinite(remoteBalance)
                  ? remoteBalance
                  : getBalance(),

              serverOwned:true
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
     * exists for this UID.
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
       * Admin may set the result before the original
       * countdown finishes.
       *
       * Keep displaying the active order until expiry.
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

      setActiveTrade(null);

      return true;
    }

    /*
     * Still pending:
     * refresh browser snapshot from the server.
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
       * Repair local History from authoritative
       * settled server orders.
       *
       * This does NOT mutate balance.
       */
      await syncRecentSecondsHistory();

      /*
       * First clear/refresh stale local active state.
       */
      await recoverActiveTrade();

      let active=
        getActiveTrade();

      /*
       * No local active order:
       * check whether Supabase has a real pending order.
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
       * Order disappeared from server.
       */
      if(!row){
        setActiveTrade(null);
        return;
      }

      /*
       * ==============================================
       * ALREADY SETTLED
       * ==============================================
       */

      if(row.status==='settled'){
        const expiresAt=
          row.expires_at
            ? new Date(
                row.expires_at
              ).getTime()
            : 0;

        /*
         * Result can be assigned before countdown ends.
         * Keep order visible until its original expiry.
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

        let exitPrice=
          Number(
            row.exit_price
          );

        /*
         * Give server a short window to write
         * the final exit price.
         */
        if(
          !Number.isFinite(exitPrice) ||
          exitPrice<=0
        ){
          for(let i=0;i<8;i++){
            await new Promise(
              resolve=>
                setTimeout(
                  resolve,
                  1000
                )
            );

            const latest=
              await getTrade(
                row.id
              );

            if(latest){
              row=latest;
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
         * Server has already performed the financial
         * settlement.
         *
         * Browser only synchronizes UI/history.
         */
        await processSettledTrade(
          row
        );

        return;
      }

      /*
       * ==============================================
       * PENDING ORDER
       * ==============================================
       */

      const expiresAt=
        row.expires_at
          ? new Date(
              row.expires_at
            ).getTime()
          : 0;

      /*
       * Countdown still running.
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
       * ==============================================
       * COUNTDOWN FINISHED
       * ==============================================
       *
       * IMPORTANT:
       *
       * Browser DOES NOT call settle_expired_trade().
       * Browser DOES NOT create DRAW.
       * Browser DOES NOT refund stake.
       * Browser DOES NOT decide result.
       *
       * Wait for the server/admin settlement path.
       */

      let finalRow=row;

      for(let i=0;i<10;i++){
        await new Promise(
          resolve=>
            setTimeout(
              resolve,
              1000
            )
        );

        const latest=
          await getTrade(
            row.id
          );

        if(latest){
          finalRow=latest;
        }

        const exitPrice=
          Number(
            finalRow.exit_price
          );

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
      }

      /*
       * Server still hasn't settled it.
       *
       * Keep the active order instead of manufacturing
       * a DRAW or changing money locally.
       */
      const latest=
        await getTrade(
          row.id
        );

      if(latest){
        if(latest.status==='settled'){
          await processSettledTrade(
            latest
          );

          return;
        }

        setActiveTrade(
          tradeSnapshot(latest)
        );
      }

    }catch(e){
      console.warn(
        'Trade status polling failed',
        e
      );

    }finally{
      tradePolling=false;
    }
  }
    /*
   * ==================================================
   * ACTIVE TRADE PUBLIC HELPERS
   * ==================================================
   */

  function clearActiveTrade(){
    setActiveTrade(null);
  }

  function refreshActiveTrade(){
    return recoverActiveTrade();
  }

  /*
   * ==================================================
   * BALANCE REFRESH
   * ==================================================
   */

  async function refreshServerBalance(){
    try{
      const remote=
        await readServerBalance();

      if(Number.isFinite(remote)){
        applyLocalBalance(remote);

        return remote;
      }

      return null;

    }catch(e){
      console.warn(
        'Balance refresh failed',
        e
      );

      return null;
    }
  }

  /*
   * ==================================================
   * PAGE VISIBILITY REFRESH
   * ==================================================
   *
   * When customer returns to the page:
   *
   * - refresh authoritative server balance
   * - refresh deposit status
   * - refresh withdrawal status
   * - refresh Admin Credit notifications
   * - refresh Seconds Trading state
   *
   * No financial mutation is performed here.
   */

  async function refreshWhenVisible(){
    if(document.hidden){
      return;
    }

    try{
      await refreshServerBalance();
    }catch(_){}

    try{
      await pollDepositStatus();
    }catch(_){}

    try{
      await pollAccountAdjustments();
    }catch(_){}

    try{
      await pollWithdrawalStatus();
    }catch(_){}

    try{
      await pollTradeStatus();
    }catch(_){}
  }

  document.addEventListener(
    'visibilitychange',
    ()=>{
      if(!document.hidden){
        refreshWhenVisible();
      }
    }
  );

  window.addEventListener(
    'focus',
    ()=>{
      refreshWhenVisible();
    }
  );

  /*
   * ==================================================
   * STORAGE EVENT SYNC
   * ==================================================
   *
   * Keep multiple tabs visually synchronized.
   *
   * IMPORTANT:
   * storage events NEVER write server balances.
   */

  window.addEventListener(
    'storage',
    e=>{
      try{
        const uid=getUid();

        if(!uid){
          return;
        }

        const scopedBalanceKey=
          'demoBalance::'+uid;

        if(
          e.key===scopedBalanceKey ||
          e.key==='demoBalance'
        ){
          const value=
            Number(e.newValue);

          if(Number.isFinite(value)){
            window.dispatchEvent(
              new CustomEvent(
                'demoBalanceUpdated',
                {
                  detail:{
                    uid:uid,
                    balance:value
                  }
                }
              )
            );
          }
        }

        if(
          e.key===
          'demoActiveTrade::'+uid ||
          e.key==='demoActiveTrade'
        ){
          let trade=null;

          try{
            trade=
              e.newValue
                ? JSON.parse(
                    e.newValue
                  )
                : null;
          }catch(_){}

          window.dispatchEvent(
            new CustomEvent(
              'demoActiveTradeUpdated',
              {
                detail:trade
              }
            )
          );
        }

      }catch(_){}
    }
  );

  /*
   * ==================================================
   * LEGACY LOCAL STORAGE MIGRATION
   * ==================================================
   *
   * Older versions stored:
   *
   * demoBalance
   * demoHistory
   * demoActiveTrade
   *
   * globally.
   *
   * Current version keeps a UID-scoped copy.
   *
   * This migration is LOCAL ONLY.
   * It never sends the legacy balance to Supabase.
   */

  function migrateLegacyLocalState(){
    const uid=getUid();

    if(!uid){
      return;
    }

    /*
     * Balance
     */
    try{
      const scoped=
        localStorage.getItem(
          'demoBalance::'+uid
        );

      const legacy=
        localStorage.getItem(
          'demoBalance'
        );

      if(
        scoped===null &&
        legacy!==null &&
        Number.isFinite(
          Number(legacy)
        )
      ){
        localStorage.setItem(
          'demoBalance::'+uid,
          String(legacy)
        );
      }
    }catch(_){}

    /*
     * History
     */
    try{
      const scoped=
        localStorage.getItem(
          'demoHistory::'+uid
        );

      const legacy=
        localStorage.getItem(
          'demoHistory'
        );

      if(
        scoped===null &&
        legacy
      ){
        const parsed=
          JSON.parse(legacy);

        if(Array.isArray(parsed)){
          localStorage.setItem(
            'demoHistory::'+uid,
            JSON.stringify(parsed)
          );
        }
      }
    }catch(_){}

    /*
     * Active Trade
     */
    try{
      const scoped=
        localStorage.getItem(
          'demoActiveTrade::'+uid
        );

      const legacy=
        localStorage.getItem(
          'demoActiveTrade'
        );

      if(
        scoped===null &&
        legacy
      ){
        const parsed=
          JSON.parse(legacy);

        if(
          parsed &&
          typeof parsed==='object'
        ){
          localStorage.setItem(
            'demoActiveTrade::'+uid,
            JSON.stringify(parsed)
          );
        }
      }
    }catch(_){}
  }

  /*
   * ==================================================
   * SAFE LOCAL BALANCE DISPLAY API
   * ==================================================
   *
   * Some older pages still call:
   *
   * DemoBalanceSync.setBalance(...)
   *
   * For compatibility we keep the method, but it is
   * LOCAL DISPLAY ONLY.
   *
   * It cannot modify demo_balances.
   */

  function setLocalDisplayBalance(v){
    const n=Number(v);

    if(!Number.isFinite(n)){
      return false;
    }

    applyLocalBalance(n);

    return true;
  }

  /*
   * ==================================================
   * PUBLIC API - BALANCE
   * ==================================================
   */

  window.DemoBalanceSync={
    getUid:getUid,

    getBalance:getBalance,

    /*
     * Compatibility only.
     * Does NOT write to Supabase.
     */
    setBalance:setLocalDisplayBalance,

    refresh:
      refreshServerBalance,

    readServerBalance:
      readServerBalance,

    /*
     * Explicitly expose this as disabled so an older
     * page cannot silently perform a server write.
     */
    writeServerBalance:
      async function(){
        throw new Error(
          'Direct balance writes are disabled. Use a server RPC.'
        );
      },

    isServerReady:
      function(){
        return serverBalanceReady;
      }
  };

  /*
   * ==================================================
   * PUBLIC API - DEPOSIT
   * ==================================================
   */

  window.DemoDepositSync={
    getUid:getUid,

    getBalance:getBalance,

    refreshBalance:
      refreshServerBalance,

    checkStatus:
      pollDepositStatus
  };

  /*
   * ==================================================
   * PUBLIC API - WITHDRAWAL
   * ==================================================
   */

  window.DemoWithdrawalSync={
    getUid:getUid,

    getBalance:getBalance,

    refreshBalance:
      refreshServerBalance,

    checkStatus:
      pollWithdrawalStatus
  };

  /*
   * ==================================================
   * PUBLIC API - ADMIN CREDIT NOTIFICATIONS
   * ==================================================
   */

  window.DemoAdjustmentSync={
    getUid:getUid,

    getBalance:getBalance,

    refreshBalance:
      refreshServerBalance,

    checkStatus:
      pollAccountAdjustments
  };

  /*
   * ==================================================
   * PUBLIC API - SECONDS TRADING
   * ==================================================
   */

  window.DemoTradeSync={
    getUid:getUid,

    getBalance:getBalance,

    /*
     * Compatibility only.
     * Local display mutation; never server balance.
     */
    setBalance:setLocalDisplayBalance,

    refreshBalance:
      refreshServerBalance,

    getActiveTrade:
      getActiveTrade,

    setActiveTrade:
      setActiveTrade,

    clearActiveTrade:
      clearActiveTrade,

    refreshActiveTrade:
      refreshActiveTrade,

    getTrade:
      getTrade,

    findOpenTrade:
      findOpenTrade,

    poll:
      pollTradeStatus,

    syncHistory:
      syncRecentSecondsHistory,

    getHistory:
      readTradeHistory,

    /*
     * Kept for old callers but deliberately disabled.
     */
    settleExpiredTrade:
      settleExpiredTrade
  };

  /*
   * ==================================================
   * GENERIC COMPATIBILITY API
   * ==================================================
   */

  window.DemoSync={
    getUid:getUid,

    getBalance:getBalance,

    /*
     * UI compatibility only.
     */
    setBalance:setLocalDisplayBalance,

    refreshBalance:
      refreshServerBalance,

    getActiveTrade:
      getActiveTrade,

    setActiveTrade:
      setActiveTrade,

    getHistory:
      readTradeHistory
  };

  /*
   * ==================================================
   * SERVER BALANCE READY HELPER
   * ==================================================
   */

  window.__demoBalanceReady=
    (async function(){
      try{
        /*
         * UID must already come from authenticated
         * customer bootstrap.
         */
        const uid=requireUid();

        if(!uid){
          return false;
        }

        migrateLegacyLocalState();

        const ok=
          await initServerBalance();

        return !!ok;

      }catch(e){
        console.warn(
          'Demo balance bootstrap failed',
          e
        );

        return false;
      }
    })();

  /*
   * ==================================================
   * INITIAL STATUS SYNC
   * ==================================================
   */

  async function initialStatusSync(){
    try{
      await window.__demoBalanceReady;
    }catch(_){}

    try{
      await pollDepositStatus();
    }catch(_){}

    try{
      await pollAccountAdjustments();
    }catch(_){}

    try{
      await pollWithdrawalStatus();
    }catch(_){}

    try{
      await pollTradeStatus();
    }catch(_){}
  }

  /*
   * ==================================================
   * POLLING TIMERS
   * ==================================================
   */

  let balanceTimer=null;
  let depositTimer=null;
  let adjustmentTimer=null;
  let withdrawalTimer=null;
  let tradeTimer=null;

  function startPolling(){
    /*
     * Prevent duplicate timers if this script is
     * accidentally initialized twice.
     */
    stopPolling();

    balanceTimer=
      setInterval(
        ()=>{
          if(!document.hidden){
            pollServerBalance();
          }
        },
        POLL_MS
      );

    depositTimer=
      setInterval(
        ()=>{
          if(!document.hidden){
            pollDepositStatus();
          }
        },
        POLL_MS
      );

    adjustmentTimer=
      setInterval(
        ()=>{
          if(!document.hidden){
            pollAccountAdjustments();
          }
        },
        POLL_MS
      );

    withdrawalTimer=
      setInterval(
        ()=>{
          if(!document.hidden){
            pollWithdrawalStatus();
          }
        },
        POLL_MS
      );

    tradeTimer=
      setInterval(
        ()=>{
          if(!document.hidden){
            pollTradeStatus();
          }
        },
        POLL_MS
      );
  }

  function stopPolling(){
    if(balanceTimer){
      clearInterval(balanceTimer);
      balanceTimer=null;
    }

    if(depositTimer){
      clearInterval(depositTimer);
      depositTimer=null;
    }

    if(adjustmentTimer){
      clearInterval(adjustmentTimer);
      adjustmentTimer=null;
    }

    if(withdrawalTimer){
      clearInterval(withdrawalTimer);
      withdrawalTimer=null;
    }

    if(tradeTimer){
      clearInterval(tradeTimer);
      tradeTimer=null;
    }
  }

  /*
   * ==================================================
   * PAGE LIFECYCLE
   * ==================================================
   */

  window.addEventListener(
    'pageshow',
    ()=>{
      refreshWhenVisible();
    }
  );

  window.addEventListener(
    'beforeunload',
    ()=>{
      stopPolling();
    }
  );

  /*
   * ==================================================
   * START
   * ==================================================
   */

  initialStatusSync()
    .finally(()=>{
      startPolling();
    });

})();
