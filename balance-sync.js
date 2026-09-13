(function(){
  const SUPABASE_URL='https://cyvquivolvkxzcseyhvk.supabase.co';
  const SUPABASE_KEY='sb_publishable_dy2_qtfTrOjeD-kPKohHiQ_zKHxZEHU';
  const POLL_MS=5000;

  function getUid(){
    let uid=localStorage.getItem('demoUid');
    if(!uid){
      uid='DEMO-'+String(Math.floor(100000+Math.random()*900000));
      localStorage.setItem('demoUid',uid);
    }
    return uid;
  }

  function getProcessed(){
    try{
      const x=JSON.parse(
        localStorage.getItem('processedDepositIds') || '[]'
      );
      return Array.isArray(x) ? x.map(String) : [];
    }catch(_){
      return [];
    }
  }

  function saveProcessed(ids){
    localStorage.setItem(
      'processedDepositIds',
      JSON.stringify(ids.slice(-500))
    );
  }

  function getBalance(){
    const n=Number(localStorage.getItem('demoBalance'));
    return Number.isFinite(n) ? n : 0;
  }

  function setBalance(v){
    const n=Math.max(0,Number(v)||0);

    localStorage.setItem('demoBalance',String(n));

    const balanceEl=document.getElementById('balance');
    if(balanceEl){
      balanceEl.textContent=n.toFixed(2)+' USDT';
    }

    const balanceValue=document.getElementById('balanceValue');
    if(balanceValue){
      balanceValue.textContent=n.toLocaleString(undefined,{
        minimumFractionDigits:2,
        maximumFractionDigits:2
      });
    }

    window.dispatchEvent(
      new CustomEvent('demoBalanceUpdated',{
        detail:{balance:n}
      })
    );
  }

  function ensureToast(){
    if(document.getElementById('depositStatusToast')) return;

    const wrap=document.createElement('div');

    wrap.id='depositStatusToast';

    wrap.style.cssText=
      'position:fixed;inset:0;display:none;' +
      'align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,.60);z-index:99999;padding:20px';

    wrap.innerHTML=`
      <div style="
        width:min(390px,100%);
        background:#111820;
        border:1px solid #283442;
        border-radius:18px;
        padding:24px;
        text-align:center;
        box-shadow:0 20px 60px rgba(0,0,0,.45)
      ">

        <div id="depositToastIcon" style="
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
        ">✓</div>

        <div id="depositToastTitle" style="
          font-size:21px;
          font-weight:800;
          color:#fff;
          margin-bottom:8px
        ">
          Deposit Successful
        </div>

        <div id="depositToastMsg" style="
          font-size:14px;
          line-height:1.6;
          color:#9eabb9
        "></div>

        <button id="depositToastOk" style="
          margin-top:18px;
          width:100%;
          height:44px;
          border:0;
          border-radius:10px;
          background:#246bfd;
          color:#fff;
          font-weight:800;
          cursor:pointer
        ">
          OK
        </button>

      </div>
    `;

    document.body.appendChild(wrap);

    document.getElementById('depositToastOk').onclick=()=>{
      wrap.style.display='none';
    };

    wrap.addEventListener('click',e=>{
      if(e.target===wrap){
        wrap.style.display='none';
      }
    });
  }

  function showToast(status,amount){
    ensureToast();

    const wrap=document.getElementById('depositStatusToast');
    const icon=document.getElementById('depositToastIcon');
    const title=document.getElementById('depositToastTitle');
    const msg=document.getElementById('depositToastMsg');

    if(status==='approved'){

      icon.textContent='✓';
      icon.style.color='#22c98b';
      icon.style.background='rgba(34,201,139,.12)';

      title.textContent='Deposit Successful';

      msg.textContent=
        '+'+
        Number(amount).toFixed(2)+
        ' USDT has been credited to your demo balance.';

    }else{

      icon.textContent='×';
      icon.style.color='#f05b6a';
      icon.style.background='rgba(240,91,106,.12)';

      title.textContent='Deposit Rejected';

      msg.textContent=
        'Your '+
        Number(amount).toFixed(2)+
        ' USDT deposit request was rejected. Please contact support if needed.';
    }

    wrap.style.display='flex';
  }

  async function pollDepositStatus(){
    try{

      const uid=getUid();

      const url=
        SUPABASE_URL+
        '/rest/v1/deposit_requests'+
        '?select=id,amount,status'+
        '&uid=eq.'+encodeURIComponent(uid)+
        '&status=in.(approved,rejected)'+
        '&order=id.asc';

      const r=await fetch(url,{
        headers:{
          apikey:SUPABASE_KEY,
          Authorization:'Bearer '+SUPABASE_KEY
        },
        cache:'no-store'
      });

      if(!r.ok) return;

      const rows=await r.json();

      if(!Array.isArray(rows) || !rows.length) return;

      const processed=getProcessed();

      let changed=false;

      for(const row of rows){

        const id=String(row.id);

        if(processed.includes(id)) continue;

        if(row.status==='approved'){

          const amount=Number(row.amount)||0;

          if(amount>0){
            setBalance(getBalance()+amount);
          }

          showToast('approved',amount);

        }else if(row.status==='rejected'){

          showToast(
            'rejected',
            Number(row.amount)||0
          );
        }

        processed.push(id);
        changed=true;
      }

      if(changed){
        saveProcessed(processed);
      }

    }catch(e){
      console.warn(
        'Deposit status check failed',
        e
      );
    }
  }

  window.DemoDepositSync={
    poll:pollDepositStatus,
    getUid,
    setBalance,
    getBalance
  };

  if(document.readyState==='loading'){

    document.addEventListener(
      'DOMContentLoaded',
      ()=>{
        ensureToast();
        pollDepositStatus();
        setInterval(
          pollDepositStatus,
          POLL_MS
        );
      }
    );

  }else{

    ensureToast();
    pollDepositStatus();

    setInterval(
      pollDepositStatus,
      POLL_MS
    );
  }

})();
