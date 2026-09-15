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
   *
   * Customer-specific local data must never use one
   * shared browser key.
   *
   * Example:
   *
   * OLD:
   * demoHistory
   *
   * NEW:
   * demoHistory::DEMO-123456
   *
   * This prevents customer A's browser cache from
   * appearing after customer B logs into the same
   * browser/device.
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

  /*
   * Balance remains compatible with pages that still
   * read demoBalance directly.
   *
   * The authoritative balance is demo_balances in
   * Supabase. The UID-specific local balance is used
   * as the customer-specific browser cache.
   */
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

    /*
     * Compatibility fallback only.
     * Supabase server balance will replace this during
     * initialization.
     */
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

    /*
     * UID-isolated balance cache.
     */
    try{
      localStorage.setItem(
        balanceStorageKey(),
        formatted
      );
    }catch(_){}

    /*
     * Legacy compatibility cache.
     *
     * Existing Trading / Assets / Profile code may
     * still read demoBalance. This value is refreshed
     * from the authenticated customer's server balance
     * whenever the page initializes.
     */
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
      /*
       * Server is authoritative.
       *
       * New registered customers already have a
       * demo_balances row created by the Supabase
       * registration trigger, normally balance 0.
       */
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
          /*
           * Read again after acquiring lock.
           * Another tab may have changed the
           * withdrawal ledger before we got here.
           */
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

          let changed=false;

          /*
           * ==========================================
           * APPROVED
           * ==========================================
           *
           * assets.html normally reserves the
           * withdrawal amount immediately when the
           * customer submits a withdrawal.
           *
           * In that case state.applied should already
           * be true and approval must NOT deduct again.
           *
           * For an older withdrawal where the local
           * ledger says it was never reserved, deduct
           * it here once.
           */

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

          /*
           * ==========================================
           * REJECTED
           * ==========================================
           *
           * If this withdrawal had already reserved
           * the customer's USDT, rejection returns
           * the amount exactly once.
           */

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
            /*
             * Older withdrawal where the amount was
             * never reserved.
             *
             * Record the rejected state but do not
             * add money that was never deducted.
             */
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

  function setActiveTrade(trade){
    if(trade){
      writeUidJson(
        'demoActiveTrade',
        trade
      );

    }else{
      removeUidStorage(
        'demoActiveTrade'
      );
    }

    /*
     * Compatibility:
     * trading.html may still listen to this event.
     */
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
   * Seconds trading history is also UID isolated.
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

    /*
     * Keep a compatibility copy for older UI code.
     * This copy always represents the CURRENT
     * authenticated customer only.
     */
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

    const exists=
      history.some(
        x=>
          String(
            x.orderId ??
            x.id ??
            ''
          )===
          String(row.id)
      );

    if(exists){
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

    let pnl=
      Number(
        row.profit_loss
      );

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

    const item={
      orderId:row.id,
      id:row.id,

      time:
        row.settled_at ||
        row.created_at ||
        new Date().toISOString(),

      symbol:
        row.symbol,

      side:
        row.side,

      direction:
        row.side,

      duration:
        Number(
          row.duration_seconds
        ) ||
        0,

      amount:
        amount,

      entry:
        Number(
          row.entry_price
        ) ||
        0,

      exit:null,

      result:
        result,

      pnl:
        pnl,

      payoutRate:
        rate
    };

    history.unshift(item);

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

    const id=
      String(row.id);

    let processed=
      readProcessedTrades();

    if(
      processed.includes(id)
    ){
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

      if(
        processed.includes(id)
      ){
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

      /*
       * The order amount is already deducted when
       * the seconds trade is created.
       *
       * WIN:
       * return principal + profit
       *
       * LOSS:
       * return nothing
       *
       * DRAW:
       * return principal
       */

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

      addTradeHistory(row);

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

  async function pollTradeStatus(){
    if(tradePolling){
      return;
    }

    tradePolling=true;

    try{
      let active=
        getActiveTrade();

      /*
       * If there is no browser-cached active order,
       * recover the authenticated customer's pending
       * order from Supabase.
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
          return;
        }
      }

      const id=
        active.id ??
        active.orderId;

      let row=
        await getTrade(id);

      if(!row){
        return;
      }

      /*
       * Admin/server may already have settled the
       * order before the customer timer reaches zero.
       *
       * Keep displaying the active order until its
       * original expiry time.
       */
      if(
        row.status==='settled'
      ){
        const expiresAt=
          row.expires_at
            ? new Date(
                row.expires_at
              ).getTime()
            : 0;

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

        await processSettledTrade(
          row
        );

        return;
      }

      const expiresAt=
        row.expires_at
          ? new Date(
              row.expires_at
            ).getTime()
          : 0;

      /*
       * Customer timer expired.
       * Ask the Supabase RPC to settle it.
       */
      if(
        expiresAt &&
        Date.now()>=
        expiresAt
      ){
        const settled=
          await settleExpiredTrade(
            row.id
          );

        if(settled){
          row=settled;

        }else{
          /*
           * The cron/server may have settled it at
           * almost the same time, so read it again.
           */
          row=
            await getTrade(
              row.id
            );
        }

        if(
          row &&
          row.status===
          'settled'
        ){
          await processSettledTrade(
            row
          );

          return;
        }
      }

      setActiveTrade(
        tradeSnapshot(row)
      );

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
   *
   * trading.html is responsible for creating and
   * updating Contract / Spot data.
   *
   * These helpers give the current customer a
   * separate browser cache for those records.
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
   * UID-specific cache into the old compatibility
   * keys.
   *
   * This is needed because some existing Trading UI
   * functions may still call:
   *
   * localStorage.getItem("demoContractPositionsV1")
   *
   * instead of using the scoped key directly.
   *
   * The compatibility key therefore always represents
   * ONLY the currently authenticated customer.
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
          /*
           * No data exists for this customer.
           *
           * Clear the shared compatibility key so a
           * previous customer's browser data cannot
           * appear after account switching.
           */
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

    /*
     * Balance is handled separately because Supabase
     * demo_balances is authoritative.
     */
  }

  /*
   * Copy changes made by legacy Trading code back
   * into the current customer's UID-specific key.
   */

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

  /*
   * The browser "storage" event does not fire in the
   * same tab that changed localStorage.
   *
   * Existing trading.html may modify these keys in
   * the current page, so periodically mirror the
   * current customer's compatibility cache back into
   * the UID-scoped storage.
   */

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
   *
   * If Trading is open in another tab for the same
   * authenticated customer, update the compatibility
   * cache when its scoped key changes.
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
    /*
     * Protected customer pages first verify the
     * Supabase Auth session and then load:
     *
     * customer_profiles.uid
     *
     * into:
     *
     * demoCustomerUid
     * demoUid
     *
     * balance-sync.js must wait for that UID.
     *
     * NEVER generate a random customer UID here.
     */

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

    /*
     * First replace all legacy Trading compatibility
     * keys with THIS customer's scoped values.
     *
     * If the new customer has no scoped value, the
     * old shared key is removed.
     *
     * This is what prevents:
     *
     * Customer A logout
     *       ↓
     * Customer B login
     *       ↓
     * Customer B sees A's Contract / Spot / Seconds
     *
     * from happening.
     */
    hydrateLegacyCustomerKeys();

    /*
     * Create the baseline after hydration.
     * From this point onward we only persist actual
     * changes made by the current customer's UI.
     */
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

    /*
     * Check twice per second.
     *
     * This does not call Supabase. It only checks the
     * small set of customer-specific localStorage keys.
     */
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
   *
   * Save the current customer's compatibility keys
   * once more when leaving/reloading the page.
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

    /*
     * STEP 1
     * Wait for login/auth gate to provide the real
     * customer UID.
     */
    const authenticatedUid=
      await waitForAuthenticatedUid();

    if(!authenticatedUid){
      console.warn(
        'Balance sync stopped: authenticated customer UID is unavailable.'
      );

      return;
    }

    /*
     * STEP 2
     * Isolate Contract / Spot / Seconds browser cache
     * before Trading code begins using those values.
     */
    initializeCustomerLocalCache();

    startCustomerCacheSync();

    /*
     * STEP 3
     * Load the authoritative balance for THIS UID.
     *
     * Supabase demo_balances wins over browser cache.
     */
    const balanceReady=
      await initServerBalance();

    if(!balanceReady){
      console.warn(
        'Central balance initialization is not ready yet.'
      );
    }

    /*
     * STEP 4
     * Run each synchronization once immediately.
     */
    pollDepositStatus();

    pollAccountAdjustments();

    pollWithdrawalStatus();

    pollTradeStatus();

    /*
     * ==================================================
     * CENTRAL BALANCE
     * ==================================================
     *
     * Admin / server balance changes appear on the
     * customer side.
     */
    setInterval(
      pollServerBalance,
      3000
    );

    /*
     * ==================================================
     * DEPOSIT
     * ==================================================
     */
    setInterval(
      pollDepositStatus,
      5000
    );

    /*
     * ==================================================
     * ADMIN MANUAL CREDIT
     * ==================================================
     */
    setInterval(
      pollAccountAdjustments,
      3000
    );

    /*
     * ==================================================
     * WITHDRAWAL
     * ==================================================
     *
     * Approved / rejected status and rejected refund.
     */
    setInterval(
      pollWithdrawalStatus,
      3000
    );

    /*
     * ==================================================
     * SECONDS TRADING
     * ==================================================
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
