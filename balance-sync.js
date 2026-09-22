(function(){
  const SUPABASE_URL='https://cyvquivolvkxzcseyhvk.supabase.co';
  const SUPABASE_KEY='sb_publishable_dy2_qtfTrOjeD-kPKohHiQ_zKHxZEHU';
  const POLL_MS=3000;

  let polling=false;
  let tradePolling=false;
  let adjustmentPolling=false;

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

    if(!auth || !auth.client || !auth.user || !auth.profile){
      throw new Error('Authenticated customer session is not ready.');
    }

    const uid=requireUid();
    const profileUid=String(auth.profile.uid || '').trim();

    if(!profileUid || profileUid!==uid){
      throw new Error('Authenticated customer UID mismatch.');
    }

    const {data,error}=await auth.client.auth.getSession();

    if(error){
      throw error;
    }

    const token=data?.session?.access_token;

    if(!token){
      throw new Error('Authenticated customer access token is unavailable.');
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
          existing.settlementPrice ??
          existing.exitPrice ??
          existing.exit ??
          null
      };

    }else{
      history.unshift(item);
    }

    history.sort((a,b)=>{
      const ta=
        new Date(
          a.settledAt ||
          a.settled_at ||
          a.time ||
          0
        ).getTime();

      const tb=
        new Date(
          b.settledAt ||
          b.settled_at ||
          b.time ||
          0
        ).getTime();

      return tb-ta;
    });

    writeTradeHistory(
      history
    );

    window.dispatchEvent(
      new CustomEvent(
        'demoHistoryUpdated',
        {
          detail:item
        }
      )
    );

    return item;
  }

  /*
   * ==================================================
   * SERVER TRADE READS
   * ==================================================
   */

  async function getTrade(id){
    const uid=requireUid();

    const url=
      SUPABASE_URL+
      '/rest/v1/trade_orders'+
      '?select=*'+
      '&id=eq.'+
      encodeURIComponent(id)+
      '&uid=eq.'+
      encodeURIComponent(uid)+
      '&limit=1';

    const r=
      await fetch(
        url,
        {
          headers:await getAuthenticatedHeaders(),
          cache:'no-store'
        }
      );

    if(!r.ok){
      throw new Error(
        'Trade read failed: '+
        r.status
      );
    }

    const rows=
      await r.json();

    return (
      Array.isArray(rows) &&
      rows.length
    )
      ? rows[0]
      : null;
  }

  async function findOpenTrade(){
    const uid=requireUid();

    const url=
      SUPABASE_URL+
      '/rest/v1/trade_orders'+
      '?select=*'+
      '&uid=eq.'+
      encodeURIComponent(uid)+
      '&status=eq.pending'+
      '&order=id.desc'+
      '&limit=1';

    const r=
      await fetch(
        url,
        {
          headers:await getAuthenticatedHeaders(),
          cache:'no-store'
        }
      );

    if(!r.ok){
      throw new Error(
        'Open trade read failed: '+
        r.status
      );
    }

    const rows=
      await r.json();

    return (
      Array.isArray(rows) &&
      rows.length
    )
      ? rows[0]
      : null;
  }

  /*
   * ==================================================
   * RECENT SECONDS HISTORY SYNC
   * ==================================================
   */

  let historySyncPolling=false;

  async function syncRecentSecondsHistory(){
    if(historySyncPolling){
      return;
    }

    historySyncPolling=true;

    try{
      const uid=requireUid();

      const url=
        SUPABASE_URL+
        '/rest/v1/trade_orders'+
        '?select=*'+
        '&uid=eq.'+
        encodeURIComponent(uid)+
        '&status=eq.settled'+
        '&order=id.desc'+
        '&limit=100';

      const r=
        await fetch(
          url,
          {
            headers:await getAuthenticatedHeaders(),
            cache:'no-store'
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
        readProcessedTrades();

      let processedChanged=false;

      for(const row of rows){
        const id=
          String(row.id);

        addTradeHistory(row);

        if(!processed.includes(id)){
          processed.push(id);
          processedChanged=true;
        }
      }

      if(processedChanged){
        writeProcessedTrades(
          processed
        );
      }

    }catch(e){
      console.warn(
        'Recent seconds history sync failed',
        e
      );

    }finally{
      historySyncPolling=false;
    }
  }

  /*
   * ==================================================
   * ACTIVE TRADE RESTORE
   * ==================================================
   */

  async function restoreActiveTrade(){
    try{
      const local=
        getActiveTrade();

      if(
        local &&
        local.id
      ){
        try{
          const remote=
            await getTrade(
              local.id
            );

          if(remote){
            const status=
              String(
                remote.status ||
                ''
              ).toLowerCase();

            if(status==='pending'){
              const merged={
                ...local,

                id:remote.id,

                uid:
                  remote.uid ||
                  local.uid,

                symbol:
                  remote.symbol ||
                  local.symbol,

                side:
                  remote.side ||
                  local.side,

                amount:
                  Number(
                    remote.amount
                  ) ||
                  Number(
                    local.amount
                  ) ||
                  0,

                entryPrice:
                  Number(
                    remote.entry_price
                  ) ||
                  Number(
                    local.entryPrice
                  ) ||
                  0,

                entry_price:
                  Number(
                    remote.entry_price
                  ) ||
                  Number(
                    local.entry_price
                  ) ||
                  0,

                duration:
                  Number(
                    remote.duration_seconds
                  ) ||
                  Number(
                    local.duration
                  ) ||
                  0,

                duration_seconds:
                  Number(
                    remote.duration_seconds
                  ) ||
                  Number(
                    local.duration_seconds
                  ) ||
                  0,

                expiresAt:
                  remote.expires_at ||
                  local.expiresAt ||
                  local.expires_at,

                expires_at:
                  remote.expires_at ||
                  local.expires_at ||
                  local.expiresAt,

                createdAt:
                  remote.created_at ||
                  local.createdAt ||
                  local.created_at,

                created_at:
                  remote.created_at ||
                  local.created_at ||
                  local.createdAt,

                status:'pending'
              };

              setActiveTrade(
                merged
              );

              return merged;
            }

            if(status==='settled'){
              addTradeHistory(
                remote
              );

              const processed=
                readProcessedTrades();

              const id=
                String(remote.id);

              if(!processed.includes(id)){
                processed.push(id);

                writeProcessedTrades(
                  processed
                );
              }

              setActiveTrade(
                null
              );

              try{
                const remoteBalance=
                  await readServerBalance();

                if(
                  Number.isFinite(
                    remoteBalance
                  )
                ){
                  applyLocalBalance(
                    remoteBalance
                  );
                }
              }catch(e){
                console.warn(
                  'Settled trade balance refresh failed',
                  e
                );
              }

              return null;
            }
          }

        }catch(e){
          console.warn(
            'Stored active trade restore failed',
            e
          );
        }
      }

      const remote=
        await findOpenTrade();

      if(!remote){
        if(local){
          setActiveTrade(
            null
          );
        }

        return null;
      }

      const trade={
        id:remote.id,

        uid:remote.uid,

        symbol:remote.symbol,

        side:remote.side,

        amount:
          Number(
            remote.amount
          ) ||
          0,

        entryPrice:
          Number(
            remote.entry_price
          ) ||
          0,

        entry_price:
          Number(
            remote.entry_price
          ) ||
          0,

        duration:
          Number(
            remote.duration_seconds
          ) ||
          0,

        duration_seconds:
          Number(
            remote.duration_seconds
          ) ||
          0,

        expiresAt:
          remote.expires_at,

        expires_at:
          remote.expires_at,

        createdAt:
          remote.created_at,

        created_at:
          remote.created_at,

        status:'pending'
      };

      setActiveTrade(
        trade
      );

      return trade;

    }catch(e){
      console.warn(
        'Active trade restore failed',
        e
      );

      return null;
    }
  }

  /*
   * ==================================================
   * ACTIVE TRADE SETTLEMENT POLL
   * ==================================================
   */

  async function pollActiveTrade(){
    if(tradePolling){
      return;
    }

    tradePolling=true;

    try{
      let trade=
        getActiveTrade();

      if(
        !trade ||
        !trade.id
      ){
        trade=
          await restoreActiveTrade();

        if(
          !trade ||
          !trade.id
        ){
          return;
        }
      }

      const remote=
        await getTrade(
          trade.id
        );

      if(!remote){
        return;
      }

      const status=
        String(
          remote.status ||
          ''
        ).toLowerCase();

      if(status==='pending'){
        /*
         * Keep local copy synchronized with
         * authoritative server values.
         */
        const merged={
          ...trade,

          id:remote.id,

          uid:
            remote.uid ||
            trade.uid,

          symbol:
            remote.symbol ||
            trade.symbol,

          side:
            remote.side ||
            trade.side,

          amount:
            Number(
              remote.amount
            ) ||
            Number(
              trade.amount
            ) ||
            0,

          entryPrice:
            Number(
              remote.entry_price
            ) ||
            Number(
              trade.entryPrice
            ) ||
            0,

          entry_price:
            Number(
              remote.entry_price
            ) ||
            Number(
              trade.entry_price
            ) ||
            0,

          duration:
            Number(
              remote.duration_seconds
            ) ||
            Number(
              trade.duration
            ) ||
            0,

          duration_seconds:
            Number(
              remote.duration_seconds
            ) ||
            Number(
              trade.duration_seconds
            ) ||
            0,

          expiresAt:
            remote.expires_at ||
            trade.expiresAt ||
            trade.expires_at,

          expires_at:
            remote.expires_at ||
            trade.expires_at ||
            trade.expiresAt,

          status:'pending'
        };

        setActiveTrade(
          merged
        );

        return;
      }

      if(status!=='settled'){
        return;
      }

      const id=
        String(remote.id);

      const processed=
        readProcessedTrades();

      if(processed.includes(id)){
        setActiveTrade(
          null
        );

        try{
          const remoteBalance=
            await readServerBalance();

          if(
            Number.isFinite(
              remoteBalance
            )
          ){
            applyLocalBalance(
              remoteBalance
            );
          }
        }catch(e){
          console.warn(
            'Processed trade balance refresh failed',
            e
          );
        }

        return;
      }

      const lock=
        acquireSettlementLock(
          id
        );

      if(!lock){
        return;
      }

      try{
        /*
         * Settlement money is handled by the
         * server-side admin settlement RPC.
         *
         * Browser only consumes the result and
         * refreshes authoritative balance.
         */
        addTradeHistory(
          remote
        );

        const latestProcessed=
          readProcessedTrades();

        if(
          !latestProcessed.includes(id)
        ){
          latestProcessed.push(id);

          writeProcessedTrades(
            latestProcessed
          );
        }

        setActiveTrade(
          null
        );

        try{
          const remoteBalance=
            await readServerBalance();

          if(
            Number.isFinite(
              remoteBalance
            )
          ){
            applyLocalBalance(
              remoteBalance
            );
          }
        }catch(e){
          console.warn(
            'Trade settlement balance refresh failed',
            e
          );
        }

        window.dispatchEvent(
          new CustomEvent(
            'demoTradeSettled',
            {
              detail:{
                ...remote,
                balance:
                  getBalance()
              }
            }
          )
        );

      }finally{
        releaseSettlementLock(
          lock
        );
      }

    }catch(e){
      console.warn(
        'Active trade polling failed',
        e
      );

    }finally{
      tradePolling=false;
    }
  }

  /*
   * ==================================================
   * SECONDS TRADE PLACEMENT RPC
   * ==================================================
   */

  let placingSecondsTrade=false;

  async function placeSecondsTradeAtomic(
    symbol,
    side,
    amount,
    durationSeconds,
    entryPrice
  ){
    if(placingSecondsTrade){
      throw new Error(
        'A trade request is already being processed.'
      );
    }

    placingSecondsTrade=true;

    try{
      if(window.__customerAuthReady){
        const ready=
          await window.__customerAuthReady;

        if(!ready){
          throw new Error(
            'Customer authentication required.'
          );
        }
      }

      const auth=
        window.customerAuth;

      if(
        !auth ||
        !auth.client ||
        !auth.user ||
        !auth.profile
      ){
        throw new Error(
          'Customer authentication required.'
        );
      }

      const uid=
        requireUid();

      const profileUid=
        String(
          auth.profile.uid ||
          ''
        ).trim();

      if(
        !profileUid ||
        profileUid!==uid
      ){
        throw new Error(
          'Customer UID mismatch.'
        );
      }

      const cleanSymbol=
        String(
          symbol ||
          ''
        ).trim();

      const cleanSide=
        String(
          side ||
          ''
        )
          .trim()
          .toLowerCase();

      const cleanAmount=
        Number(amount);

      const cleanDuration=
        Number(
          durationSeconds
        );

      const cleanEntry=
        Number(
          entryPrice
        );

      if(!cleanSymbol){
        throw new Error(
          'Invalid symbol.'
        );
      }

      if(
        cleanSide!=='up' &&
        cleanSide!=='down'
      ){
        throw new Error(
          'Invalid trade direction.'
        );
      }

      if(
        !Number.isFinite(
          cleanAmount
        ) ||
        cleanAmount<=0
      ){
        throw new Error(
          'Invalid trade amount.'
        );
      }

      if(
        !Number.isFinite(
          cleanDuration
        ) ||
        cleanDuration<=0
      ){
        throw new Error(
          'Invalid trade duration.'
        );
      }

      if(
        !Number.isFinite(
          cleanEntry
        ) ||
        cleanEntry<=0
      ){
        throw new Error(
          'Invalid entry price.'
        );
      }

      const {
        data,
        error
      }=
        await auth.client.rpc(
          'place_seconds_trade_atomic',
          {
            p_symbol:
              cleanSymbol,

            p_side:
              cleanSide,

            p_amount:
              cleanAmount,

            p_duration_seconds:
              Math.round(
                cleanDuration
              ),

            p_entry_price:
              cleanEntry
          }
        );

      if(error){
        throw error;
      }

      if(!data){
        throw new Error(
          'Trade placement returned no data.'
        );
      }

      /*
       * RPC may return JSON directly or
       * an array depending on the function
       * return definition.
       */
      const result=
        Array.isArray(data)
          ? (
              data[0] ||
              null
            )
          : data;

      if(!result){
        throw new Error(
          'Trade placement returned an empty result.'
        );
      }

      const tradeRow=
        result.trade ||
        result.order ||
        result.trade_order ||
        result.row ||
        result;

      const tradeId=
        tradeRow.id ??
        result.trade_id ??
        result.order_id;

      if(
        tradeId===undefined ||
        tradeId===null
      ){
        throw new Error(
          'Trade placement did not return an order id.'
        );
      }

      const createdAt=
        tradeRow.created_at ||
        result.created_at ||
        new Date()
          .toISOString();

      const expiresAt=
        tradeRow.expires_at ||
        result.expires_at ||
        new Date(
          new Date(
            createdAt
          ).getTime()+
          Math.round(
            cleanDuration
          )*
          1000
        ).toISOString();

      const trade={
        id:tradeId,

        uid:uid,

        symbol:
          tradeRow.symbol ||
          cleanSymbol,

        side:
          tradeRow.side ||
          cleanSide,

        amount:
          Number(
            tradeRow.amount ??
            cleanAmount
          ),

        entryPrice:
          Number(
            tradeRow.entry_price ??
            cleanEntry
          ),

        entry_price:
          Number(
            tradeRow.entry_price ??
            cleanEntry
          ),

        duration:
          Number(
            tradeRow.duration_seconds ??
            cleanDuration
          ),

        duration_seconds:
          Number(
            tradeRow.duration_seconds ??
            cleanDuration
          ),

        createdAt:createdAt,
        created_at:createdAt,

        expiresAt:expiresAt,
        expires_at:expiresAt,

        status:'pending'
      };

      setActiveTrade(
        trade
      );

      /*
       * RPC has already debited the stake.
       * Refresh balance from server instead
       * of subtracting locally.
       */
      try{
        const remoteBalance=
          await readServerBalance();

        if(
          Number.isFinite(
            remoteBalance
          )
        ){
          applyLocalBalance(
            remoteBalance
          );
        }
      }catch(e){
        console.warn(
          'Placed trade balance refresh failed',
          e
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          'demoTradePlaced',
          {
            detail:{
              trade:trade,
              balance:
                getBalance()
            }
          }
        )
      );

      return trade;

    }finally{
      placingSecondsTrade=false;
    }
  }
    /*
   * ==================================================
   * COMPATIBILITY HELPERS
   * ==================================================
   */

  async function refreshBalanceFromServer(){
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

  async function waitForCustomerAuth(){
    try{
      if(window.__customerAuthReady){
        const ready=
          await window.__customerAuthReady;

        if(!ready){
          return false;
        }
      }

      const auth=
        window.customerAuth;

      if(
        !auth ||
        !auth.client ||
        !auth.user ||
        !auth.profile
      ){
        return false;
      }

      const uid=
        getUid();

      const profileUid=
        String(
          auth.profile.uid ||
          ''
        ).trim();

      return !!(
        uid &&
        profileUid &&
        uid===profileUid
      );

    }catch(e){
      console.warn(
        'Customer authentication wait failed',
        e
      );

      return false;
    }
  }

  /*
   * ==================================================
   * INITIALIZATION
   * ==================================================
   */

  let initialized=false;
  let initPromise=null;

  async function initialize(){
    if(initialized){
      return true;
    }

    if(initPromise){
      return initPromise;
    }

    initPromise=
      (async()=>{
        const authReady=
          await waitForCustomerAuth();

        if(!authReady){
          console.warn(
            'Balance sync initialization skipped: customer authentication is not ready.'
          );

          return false;
        }

        try{
          requireUid();
        }catch(e){
          console.warn(
            'Balance sync initialization skipped: UID is not ready.',
            e
          );

          return false;
        }

        ensureToast();

        await initServerBalance();

        /*
         * Restore server-side pending seconds trade
         * after refresh/navigation.
         */
        await restoreActiveTrade();

        /*
         * Pull already-settled recent trades into
         * local history.
         */
        await syncRecentSecondsHistory();

        /*
         * Initial status checks.
         */
        await pollDepositStatus();

        await pollAccountAdjustments();

        await pollWithdrawalStatus();

        await pollActiveTrade();

        initialized=true;

        window.dispatchEvent(
          new CustomEvent(
            'demoBalanceSyncReady',
            {
              detail:{
                uid:getUid(),
                balance:getBalance()
              }
            }
          )
        );

        return true;
      })();

    try{
      return await initPromise;

    }finally{
      /*
       * Allow another initialization attempt if
       * customer authentication was not ready yet.
       */
      if(!initialized){
        initPromise=null;
      }
    }
  }

  /*
   * ==================================================
   * POLLING
   * ==================================================
   */

  let pollingTimer=null;

  function startPolling(){
    if(pollingTimer){
      return;
    }

    pollingTimer=
      setInterval(
        async()=>{
          if(!initialized){
            await initialize();

            if(!initialized){
              return;
            }
          }

          /*
           * Run independently. One failed poll must
           * not prevent the others.
           */
          try{
            await pollServerBalance();
          }catch(e){
            console.warn(
              'Balance polling cycle failed',
              e
            );
          }

          try{
            await pollDepositStatus();
          }catch(e){
            console.warn(
              'Deposit polling cycle failed',
              e
            );
          }

          try{
            await pollAccountAdjustments();
          }catch(e){
            console.warn(
              'Account adjustment polling cycle failed',
              e
            );
          }

          try{
            await pollWithdrawalStatus();
          }catch(e){
            console.warn(
              'Withdrawal polling cycle failed',
              e
            );
          }

          try{
            await pollActiveTrade();
          }catch(e){
            console.warn(
              'Trade polling cycle failed',
              e
            );
          }

          try{
            await syncRecentSecondsHistory();
          }catch(e){
            console.warn(
              'Trade history polling cycle failed',
              e
            );
          }
        },
        POLL_MS
      );
  }

  function stopPolling(){
    if(!pollingTimer){
      return;
    }

    clearInterval(
      pollingTimer
    );

    pollingTimer=null;
  }

  /*
   * ==================================================
   * STORAGE / AUTH EVENTS
   * ==================================================
   */

  window.addEventListener(
    'storage',
    e=>{
      try{
        const uid=
          getUid();

        if(!uid){
          return;
        }

        if(
          e.key===
          'demoBalance::'+uid
        ){
          const n=
            Number(
              e.newValue
            );

          if(Number.isFinite(n)){
            window.dispatchEvent(
              new CustomEvent(
                'demoBalanceUpdated',
                {
                  detail:{
                    uid:uid,
                    balance:n
                  }
                }
              )
            );
          }
        }

        if(
          e.key===
          'demoActiveTrade::'+uid
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

  window.addEventListener(
    'focus',
    async()=>{
      if(!initialized){
        await initialize();
      }

      if(!initialized){
        return;
      }

      try{
        await pollServerBalance();
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
        await pollActiveTrade();
      }catch(_){}

      try{
        await syncRecentSecondsHistory();
      }catch(_){}
    }
  );

  window.addEventListener(
    'pageshow',
    async()=>{
      if(!initialized){
        await initialize();
      }

      if(initialized){
        try{
          await pollServerBalance();
        }catch(_){}

        try{
          await pollActiveTrade();
        }catch(_){}
      }
    }
  );

  /*
   * ==================================================
   * PUBLIC API
   * ==================================================
   */

  window.DemoBalanceSync={
    getUid:getUid,

    requireUid:requireUid,

    getBalance:getBalance,

    setBalance:setBalance,

    /*
     * Kept for backwards compatibility.
     * This now throws because direct financial
     * table writes from browser are forbidden.
     */
    writeServerBalance:
      writeServerBalance,

    readServerBalance:
      readServerBalance,

    refreshBalance:
      refreshBalanceFromServer,

    initServerBalance:
      initServerBalance,

    pollServerBalance:
      pollServerBalance,

    pollDepositStatus:
      pollDepositStatus,

    pollAccountAdjustments:
      pollAccountAdjustments,

    pollWithdrawalStatus:
      pollWithdrawalStatus,

    getActiveTrade:
      getActiveTrade,

    setActiveTrade:
      setActiveTrade,

    restoreActiveTrade:
      restoreActiveTrade,

    pollActiveTrade:
      pollActiveTrade,

    syncRecentSecondsHistory:
      syncRecentSecondsHistory,

    getTrade:getTrade,

    findOpenTrade:
      findOpenTrade,

    placeSecondsTradeAtomic:
      placeSecondsTradeAtomic,

    initialize:initialize,

    startPolling:startPolling,

    stopPolling:stopPolling
  };

  /*
   * Compatibility aliases for pages that previously
   * called these helpers directly.
   */
  window.getDemoBalance=
    getBalance;

  window.setDemoBalance=
    setBalance;

  window.refreshDemoBalance=
    refreshBalanceFromServer;

  window.getDemoActiveTrade=
    getActiveTrade;

  window.setDemoActiveTrade=
    setActiveTrade;

  window.placeSecondsTradeAtomic=
    placeSecondsTradeAtomic;

  /*
   * ==================================================
   * START
   * ==================================================
   */

  async function boot(){
    try{
      await initialize();
    }catch(e){
      console.warn(
        'Balance sync boot failed',
        e
      );
    }

    startPolling();
  }

  if(
    document.readyState===
    'loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      {
        once:true
      }
    );

  }else{
    boot();
  }

})();
  
          
