(function(){
  const SUPABASE_URL='https://cyvquivolvkxzcseyhvk.supabase.co';
  const SUPABASE_KEY='sb_publishable_dy2_qtfTrOjeD-kPKohHiQ_zKHxZEHU';
  const POLL_MS=3000;

  let polling=false;
  let tradePolling=false;

  function getUid(){
    /*
     * AUTH CUSTOMER UID ONLY
     *
     * login.html / protected customer pages load the authenticated
     * customer's customer_profiles.uid into demoCustomerUid/demoUid.
     *
     * IMPORTANT:
     * Do NOT generate a random fallback UID here anymore.
     */
    const customerUid=String(
      localStorage.getItem('demoCustomerUid') ||
      localStorage.getItem('demoUid') ||
      ''
    ).trim();

    if(
      /^DEMO-\d{6}$/.test(customerUid)
    ){
      if(
        localStorage.getItem('demoUid')!==customerUid
      ){
        localStorage.setItem(
          'demoUid',
          customerUid
        );
      }

      if(
        localStorage.getItem('demoCustomerUid')!==customerUid
      ){
        localStorage.setItem(
          'demoCustomerUid',
          customerUid
        );
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

  let serverBalanceReady=false;
  let serverBalanceWrite=Promise.resolve();
  let serverBalancePolling=false;

  function getBalance(){
    const n=Number(localStorage.getItem('demoBalance'));
    return Number.isFinite(n) ? n : 0;
  }

  function applyLocalBalance(v){
    const n=Number(v);
    if(!Number.isFinite(n)) return;

    localStorage.setItem(
      'demoBalance',
      n.toFixed(2)
    );

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

    const rows=await r.json();

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
          balance:Number(n.toFixed(2)),
          updated_at:new Date().toISOString()
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

  function readProcessed(){
    try{
      const x=
        JSON.parse(
          localStorage.getItem(
            'processedDepositIds'
          ) ||
          '[]'
        );

      return Array.isArray(x)
        ? x.map(String)
        : [];

    }catch(_){
      return [];
    }
  }

  function writeProcessed(arr){
    localStorage.setItem(
      'processedDepositIds',
      JSON.stringify(
        arr.slice(-500)
      )
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

      for(
        const row
        of rows
      ){
        const id=
          String(row.id);

        if(
          processed.includes(
            id
          )
        ){
          continue;
        }

        const amount=
          Number(
            row.amount
          );

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

        processed.push(
          id
        );

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

  /* ==================================================
     ADMIN MANUAL BALANCE CREDIT
  ================================================== */

  function readProcessedAdjustments(){
    try{
      const x=
        JSON.parse(
          localStorage.getItem(
            'processedAccountAdjustmentIds'
          ) ||
          '[]'
        );

      return Array.isArray(x)
        ? x.map(String)
        : [];

    }catch(_){
      return [];
    }
  }

  function writeProcessedAdjustments(
    arr
  ){
    localStorage.setItem(
      'processedAccountAdjustmentIds',
      JSON.stringify(
        arr.slice(-1000)
      )
    );
  }

  function showAdminCreditToast(
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

  let adjustmentPolling=
    false;

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

      for(
        const row
        of rows
      ){
        const id=
          String(row.id);

        if(
          processed.includes(
            id
          )
        ){
          continue;
        }

        const amount=
          Number(
            row.amount
          );

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
                  id:
                    row.id,

                  amount:
                    amount,

                  note:
                    row.note ||
                    '',

                  balance:
                    getBalance()
                }
              }
            )
          );
        }

        processed.push(
          id
        );

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
      adjustmentPolling=
        false;
    }
  }

  /* ==================================================
     WITHDRAWAL BALANCE SYNC
  ================================================== */

  function readWithdrawalLedgerState(){
    try{
      const x=
        JSON.parse(
          localStorage.getItem(
            'withdrawalLedgerState'
          ) ||
          '{}'
        );

      return (
        x &&
        typeof x==='object' &&
        !Array.isArray(x)
      )
        ? x
        : {};

    }catch(_){
      return {};
    }
  }

  function writeWithdrawalLedgerState(
    x
  ){
    localStorage.setItem(
      'withdrawalLedgerState',
      JSON.stringify(x)
    );
  }

  function acquireWithdrawalLock(
    id
  ){
    const key=
      'withdrawalBalanceLock_'+
      id;

    const token=
      Date.now()+
      '_'+
      Math.random()
        .toString(36)
        .slice(2);

    try{
      const current=
        JSON.parse(
          localStorage.getItem(
            key
          ) ||
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
          token:
            token,

          time:
            Date.now()
        })
      );

      const check=
        JSON.parse(
          localStorage.getItem(
            key
          ) ||
          'null'
        );

      return (
        check &&
        check.token===token
      )
        ? {
            key:
              key,

            token:
              token
          }
        : null;

    }catch(_){
      return {
        key:
          key,

        token:
          token
      };
    }
  }

  function releaseWithdrawalLock(
    lock
  ){
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

    if(
      status===
      'approved'
    ){
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

  let withdrawalPolling=
    false;

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

      let ledgerChanged=
        false;

      for(
        const row
        of rows
      ){
        const id=
          String(
            row.id
          );

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
            applied:
              false,

            amount:
              amount,

            lastStatus:
              ''
          };

        const lock=
          acquireWithdrawalLock(
            id
          );

        if(!lock){
          continue;
        }

        try{
          ledger=
            readWithdrawalLedgerState();

          state=
            ledger[id] ||
            {
              applied:
                false,

              amount:
                amount,

              lastStatus:
                ''
            };

          const oldStatus=
            String(
              state.lastStatus ||
              ''
            );

          const applied=
            state.applied===
            true;
          let changed=
            false;

          /*
           * APPROVED
           *
           * New withdrawal requests are already
           * reserved by assets.html when submitted.
           *
           * Older withdrawal records may not have
           * been reserved. In that case, approval
           * deducts the USDT here.
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

            state.applied=
              true;

            changed=
              true;

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
           * REJECTED
           *
           * If the amount was already reserved,
           * return it to the customer.
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

            state.applied=
              false;

            changed=
              true;

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
             * Older request where nothing
             * was reserved.
             */
            changed=
              true;
          }

          if(
            status!==
            oldStatus
          ){
            state.lastStatus=
              status;

            changed=
              true;
          }

          state.amount=
            amount;

          ledger[id]=
            state;

          if(changed){
            writeWithdrawalLedgerState(
              ledger
            );

            ledgerChanged=
              true;

            window.dispatchEvent(
              new CustomEvent(
                'demoWithdrawalUpdated',
                {
                  detail:{
                    id:
                      row.id,

                    status:
                      status,

                    amount:
                      amount,

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
      withdrawalPolling=
        false;
    }
  }

  /* ==================================================
     TRADE SYNC
  ================================================== */

  function getActiveTrade(){
    try{
      return JSON.parse(
        localStorage.getItem(
          'demoActiveTrade'
        ) ||
        'null'
      );

    }catch(_){
      return null;
    }
  }

  function setActiveTrade(
    trade
  ){
    if(trade){
      localStorage.setItem(
        'demoActiveTrade',
        JSON.stringify(
          trade
        )
      );

    }else{
      localStorage.removeItem(
        'demoActiveTrade'
      );
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
    try{
      const x=
        JSON.parse(
          localStorage.getItem(
            'processedTradeIds'
          ) ||
          '[]'
        );

      return Array.isArray(x)
        ? x.map(String)
        : [];

    }catch(_){
      return [];
    }
  }

  function writeProcessedTrades(
    arr
  ){
    localStorage.setItem(
      'processedTradeIds',
      JSON.stringify(
        arr.slice(-1000)
      )
    );
  }

  function acquireSettlementLock(
    id
  ){
    const key=
      'tradeSettlementLock_'+
      id;

    const token=
      Date.now()+
      '_'+
      Math.random()
        .toString(36)
        .slice(2);

    try{
      const current=
        JSON.parse(
          localStorage.getItem(
            key
          ) ||
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
          token:
            token,

          time:
            Date.now()
        })
      );

      const check=
        JSON.parse(
          localStorage.getItem(
            key
          ) ||
          'null'
        );

      return (
        check &&
        check.token===
        token
      )
        ? {
            key:
              key,

            token:
              token
          }
        : null;

    }catch(_){
      return {
        key:
          key,

        token:
          token
      };
    }
  }

  function releaseSettlementLock(
    lock
  ){
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

  function addTradeHistory(
    row
  ){
    let history=[];

    try{
      history=
        JSON.parse(
          localStorage.getItem(
            'demoHistory'
          ) ||
          '[]'
        );

      if(
        !Array.isArray(
          history
        )
      ){
        history=[];
      }

    }catch(_){
      history=[];
    }

    const exists=
      history.some(
        x=>
          String(
            x.orderId ??
            x.id ??
            ''
          )===
          String(
            row.id
          )
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

    if(
      !Number.isFinite(
        pnl
      )
    ){
      if(
        result===
        'WIN'
      ){
        pnl=
          amount*
          rate;

      }else if(
        result===
        'LOSS'
      ){
        pnl=
          -amount;

      }else{
        pnl=0;
      }
    }

    const item={
      orderId:
        row.id,

      id:
        row.id,

      time:
        row.settled_at ||
        row.created_at ||
        new Date()
          .toISOString(),

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

      exit:
        null,

      result:
        result,

      pnl:
        pnl,

      payoutRate:
        rate
    };

    history.unshift(
      item
    );

    if(
      history.length>
      100
    ){
      history=
        history.slice(
          0,
          100
        );
    }

    localStorage.setItem(
      'demoHistory',
      JSON.stringify(
        history
      )
    );
  }

  async function getTrade(
    id
  ){
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
          encodeURIComponent(
            id
          )+
          '&uid=eq.'+
          encodeURIComponent(
            uid
          )+
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

    }catch(_){
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
          encodeURIComponent(
            uid
          )+
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

    }catch(_){
      return null;
    }
  }

  async function settleExpiredTrade(
    id
  ){
    try{
      const r=
        await fetch(
          SUPABASE_URL+
          '/rest/v1/rpc/settle_expired_trade',
          {
            method:
              'POST',

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
                  requireUid()
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

    }catch(_){
      return null;
    }
  }

  function tradeSnapshot(
    row
  ){
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
      id:
        row.id,

      orderId:
        row.id,

      uid:
        row.uid,

      symbol:
        row.symbol,

      side:
        row.side,

      direction:
        row.side,

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

      end:
        end
    };
  }
    async function processSettledTrade(
    row
  ){
    if(
      !row ||
      row.status!==
      'settled'
    ){
      return;
    }

    const id=
      String(
        row.id
      );

    let processed=
      readProcessedTrades();

    if(
      processed.includes(
        id
      )
    ){
      const active=
        getActiveTrade();

      if(
        active &&
        String(
          active.id ??
          active.orderId
        )===
        id
      ){
        setActiveTrade(
          null
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
      processed=
        readProcessedTrades();

      if(
        processed.includes(
          id
        )
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

      let credit=
        0;

      if(
        result===
        'WIN'
      ){
        let profit=
          Number(
            row.profit_loss
          );

        if(
          !Number.isFinite(
            profit
          ) ||
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
        result===
        'DRAW'
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

      processed.push(
        id
      );

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
        )===
        id
      ){
        setActiveTrade(
          null
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          'demoTradeSettled',
          {
            detail:{
              order:
                row,

              result:
                result,

              credit:
                credit,

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
  }

  async function pollTradeStatus(){
    if(tradePolling){
      return;
    }

    tradePolling=true;

    try{
      let active=
        getActiveTrade();

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
            tradeSnapshot(
              open
            );

          setActiveTrade(
            active
          );

        }else{
          return;
        }
      }

      const id=
        active.id ??
        active.orderId;

      let row=
        await getTrade(
          id
        );

      if(!row){
        return;
      }

      if(
        row.status===
        'settled'
      ){
        const expiresAt=
          row.expires_at
            ? new Date(
                row.expires_at
              ).getTime()
            : 0;

        /*
         * If admin settled before expiry,
         * keep the result but only apply
         * the customer balance when the
         * original order duration finishes.
         */
        if(
          expiresAt &&
          Date.now()<
          expiresAt
        ){
          setActiveTrade(
            tradeSnapshot(
              row
            )
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
          row=
            settled;

        }else{
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
        tradeSnapshot(
          row
        )
      );

    }catch(e){
      console.warn(
        'Trade status check failed',
        e
      );

    }finally{
      tradePolling=
        false;
    }
  }

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
   * Unified Supabase balance bridge.
   *
   * demo_balances is the central balance record.
   * demoBalance remains as a local compatibility
   * cache for Trading / Assets / Profile.
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

  async function waitForAuthenticatedUid(){
    /*
     * Protected customer pages obtain the real UID
     * from customer_profiles after Supabase Auth
     * verifies the current session.
     *
     * Wait up to ~5 seconds so balance-sync.js
     * cannot create/read another customer's balance
     * during page startup.
     */
    for(let i=0;i<100;i++){
      const uid=getUid();

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
     * Initialize central balance only after
     * authenticated customer UID is available.
     *
     * Existing server balance is always preferred.
     */
    await initServerBalance();

    pollDepositStatus();
    pollAccountAdjustments();
    pollWithdrawalStatus();
    pollTradeStatus();

    /*
     * Keep local compatibility balance synchronized
     * with demo_balances.
     */
    setInterval(
      pollServerBalance,
      3000
    );

    /*
     * Deposit approval synchronization.
     */
    setInterval(
      pollDepositStatus,
      5000
    );

    /*
     * Admin manual balance credits.
     */
    setInterval(
      pollAccountAdjustments,
      3000
    );

    /*
     * Withdrawal status / refund sync.
     */
    setInterval(
      pollWithdrawalStatus,
      3000
    );

    /*
     * Seconds trade settlement sync.
     */
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
