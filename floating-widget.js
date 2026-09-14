(function(){
'use strict';
if(document.getElementById('demoFloatingWidget'))return;

const SUPPORT_URL='https://t.me/Kath02210',
      SUPPORT_HANDLE='@Kath02210',
      POS_KEY='demoFloatingWidgetPosition';

const css=`
#demoFloatingWidget{
  position:fixed;
  z-index:99990;
  left:calc(100vw - 34px);
  top:42%;
  font-family:Arial,sans-serif;
  touch-action:none;
  user-select:none
}

#demoFloatingWidget *{
  box-sizing:border-box
}

.dfw-handle{
  width:34px;
  height:46px;
  border:1px solid #2a3440;
  border-radius:14px 0 0 14px;
  background:rgba(17,24,33,.96);
  box-shadow:0 6px 22px rgba(0,0,0,.32);
  display:grid;
  place-items:center;
  color:#9aa7b7;
  cursor:pointer;
  backdrop-filter:blur(10px)
}

.dfw-handle svg{
  width:17px;
  height:17px;
  transition:transform .2s
}

.open .dfw-handle svg{
  transform:rotate(180deg)
}

.dfw-tools{
  position:absolute;
  right:39px;
  top:50%;
  transform:translateY(-50%) scale(.92);
  display:flex;
  flex-direction:column;
  gap:7px;
  padding:7px;
  border:1px solid #26313d;
  border-radius:14px;
  background:rgba(13,19,27,.97);
  box-shadow:0 10px 30px rgba(0,0,0,.38);
  opacity:0;
  pointer-events:none;
  transition:.18s;
  transform-origin:right center
}

.open .dfw-tools{
  opacity:1;
  pointer-events:auto;
  transform:translateY(-50%) scale(1)
}

.dfw-tool{
  position:relative;
  width:39px;
  height:39px;
  border:0;
  border-radius:10px;
  background:#17202a;
  color:#c7d0db;
  display:grid;
  place-items:center;
  cursor:pointer
}

.dfw-tool:hover,
.dfw-tool:active{
  background:#202b37;
  color:#fff
}

.dfw-tool svg{
  width:18px;
  height:18px
}

.dfw-dot{
  display:none;
  position:absolute;
  right:5px;
  top:5px;
  width:7px;
  height:7px;
  border-radius:50%;
  background:#ff4d5e;
  box-shadow:0 0 0 2px #17202a
}

.has-new .dfw-dot{
  display:block
}

.dfw-tip{
  position:absolute;
  right:48px;
  white-space:nowrap;
  background:#0a0f15;
  border:1px solid #26313d;
  color:#c5cfda;
  padding:6px 8px;
  border-radius:7px;
  font-size:11px;
  opacity:0;
  pointer-events:none
}

.dfw-tool:hover .dfw-tip{
  opacity:1
}

.dfw-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:99995;
  background:rgba(0,0,0,.55);
  display:none;
  align-items:center;
  justify-content:center;
  padding:18px
}

.dfw-modal-backdrop.show{
  display:flex
}

.dfw-modal{
  width:min(390px,100%);
  max-height:78vh;
  overflow:auto;
  background:#111821;
  border:1px solid #2b3642;
  border-radius:16px;
  box-shadow:0 22px 60px rgba(0,0,0,.5);
  color:#eef3f8
}

.dfw-modal-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:15px 16px;
  border-bottom:1px solid #222d38
}

.dfw-modal-title{
  font-size:15px;
  font-weight:800
}

.dfw-close{
  width:30px;
  height:30px;
  border:0;
  border-radius:8px;
  background:#1b2530;
  color:#aeb9c5;
  font-size:20px;
  cursor:pointer
}

.dfw-modal-body{
  padding:16px
}

.dfw-empty{
  padding:22px 10px;
  text-align:center;
  color:#7f8b99;
  font-size:12px;
  line-height:1.6
}

.dfw-support-card{
  border:1px solid #27323e;
  border-radius:13px;
  background:#0c1219;
  padding:14px
}

.dfw-support-label{
  font-size:11px;
  color:#788696;
  margin-bottom:6px
}

.dfw-support-value{
  font-size:16px;
  font-weight:800
}

.dfw-support-status{
  font-size:11px;
  color:#20c997;
  margin-top:5px
}

.dfw-support-btn{
  display:block;
  text-align:center;
  text-decoration:none;
  margin-top:14px;
  padding:11px;
  border-radius:10px;
  background:#2f80ed;
  color:#fff;
  font-size:13px;
  font-weight:800
}

@media(max-width:600px){
  .dfw-tip{
    display:none
  }

  .dfw-tools{
    right:37px
  }

  .dfw-tool{
    width:37px;
    height:37px
  }
}
`;

const st=document.createElement('style');
st.textContent=css;
document.head.appendChild(st);

const I={

bell:`
<svg viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="1.8">
<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
<path d="M10 21h4"/>
</svg>`,

cal:`
<svg viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="1.8">
<rect x="3" y="5" width="18" height="16" rx="2"/>
<path d="M16 3v4M8 3v4M3 10h18"/>
<path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
</svg>`,

news:`
<svg viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="1.8">
<path d="M4 4h13v16H5a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z"/>
<path d="M17 8h5v9a3 3 0 0 1-3 3h-2"/>
<path d="M7 8h6M7 12h6M7 16h4"/>
</svg>`,

gift:`
<svg viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="1.8">
<rect x="3" y="8" width="18" height="13" rx="2"/>
<path d="M12 8v13M3 12h18M7.5 8C5 8 4 6.8 4 5.5S5 3 6.5 3C9 3 12 8 12 8M16.5 8C19 8 20 6.8 20 5.5S19 3 17.5 3C15 3 12 8 12 8"/>
</svg>`,

support:`
<svg viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="1.8">
<path d="M4 14v-2a8 8 0 0 1 16 0v2"/>
<path d="M4 14a2 2 0 0 0 0 4h2v-6H4M20 14a2 2 0 0 1 0 4h-2v-6h2M18 18c0 2-2 3-5 3"/>
</svg>`,

arrow:`
<svg viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2.2">
<path d="m14 6-6 6 6 6"/>
</svg>`

};

const root=document.createElement('div');

root.id='demoFloatingWidget';

root.innerHTML=`

<button class="dfw-handle" type="button">
${I.arrow}
</button>

<div class="dfw-tools">

<button class="dfw-tool" data-action="notifications">
${I.bell}
<span class="dfw-dot"></span>
<span class="dfw-tip">Notifications</span>
</button>

<button class="dfw-tool" data-action="pnl">
${I.cal}
<span class="dfw-tip">P&L Calendar</span>
</button>

<button class="dfw-tool" data-action="news">
${I.news}
<span class="dfw-dot"></span>
<span class="dfw-tip">News</span>
</button>

<button class="dfw-tool" data-action="events">
${I.gift}
<span class="dfw-dot"></span>
<span class="dfw-tip">Events</span>
</button>

<button class="dfw-tool" data-action="support">
${I.support}
<span class="dfw-tip">Support</span>
</button>

</div>
`;

document.body.appendChild(root);

const bg=document.createElement('div');

bg.className='dfw-modal-backdrop';

bg.innerHTML=`

<div class="dfw-modal">

<div class="dfw-modal-head">

<div class="dfw-modal-title"></div>

<button class="dfw-close">×</button>

</div>

<div class="dfw-modal-body"></div>

</div>
`;

document.body.appendChild(bg);

const h=root.querySelector('.dfw-handle');

const tools=root.querySelector('.dfw-tools');

const title=bg.querySelector('.dfw-modal-title');

const body=bg.querySelector('.dfw-modal-body');

const clamp=(v,a,b)=>{
  return Math.max(a,Math.min(b,v));
};

function save(){

  const r=root.getBoundingClientRect();

  localStorage.setItem(
    POS_KEY,
    JSON.stringify({
      side:r.left<innerWidth/2?'left':'right',
      y:r.top
    })
  );

}

function dock(){

  const r=root.getBoundingClientRect();

  const side=
    r.left+r.width/2<innerWidth/2
    ?'left'
    :'right';

  const y=
    clamp(
      r.top,
      10,
      innerHeight-r.height-80
    );

  root.style.top=y+'px';

  root.style.left=
    side==='left'
    ?'0px'
    :(innerWidth-34)+'px';

  save();

}

try{

  const p=
    JSON.parse(
      localStorage.getItem(POS_KEY)||'null'
    );

  if(p){

    root.style.top=
      clamp(
        +p.y||100,
        10,
        innerHeight-130
      )+'px';

    root.style.left=
      p.side==='left'
      ?'0px'
      :(innerWidth-34)+'px';

  }

}catch(_){}

let drag=false;
let moved=false;
let sx=0;
let sy=0;
let sl=0;
let stp=0;

h.addEventListener(
'pointerdown',
e=>{

  drag=true;
  moved=false;

  sx=e.clientX;
  sy=e.clientY;

  const r=
    root.getBoundingClientRect();

  sl=r.left;
  stp=r.top;

  h.setPointerCapture(
    e.pointerId
  );

});

h.addEventListener(
'pointermove',
e=>{

  if(!drag)return;

  const dx=
    e.clientX-sx;

  const dy=
    e.clientY-sy;

  if(
    Math.abs(dx)+
    Math.abs(dy)>5
  ){
    moved=true;
  }

  if(!moved)return;

  root.classList.remove(
    'open'
  );

  root.style.left=
    clamp(
      sl+dx,
      0,
      innerWidth-34
    )+'px';

  root.style.top=
    clamp(
      stp+dy,
      8,
      innerHeight-54
    )+'px';

});

h.addEventListener(
'pointerup',
()=>{

  if(!drag)return;

  drag=false;

  if(moved){

    dock();

  }else{

    root.classList.toggle(
      'open'
    );

  }

});

window.addEventListener(
'resize',
dock
);

function openModal(t,html){

  root.classList.remove(
    'open'
  );

  title.textContent=t;

  body.innerHTML=html;

  bg.classList.add(
    'show'
  );

}

function close(){

  bg.classList.remove(
    'show'
  );

}

bg.querySelector(
  '.dfw-close'
).onclick=close;

bg.onclick=e=>{

  if(e.target===bg){
    close();
  }

};

tools.onclick=e=>{

  const b=
    e.target.closest(
      '.dfw-tool'
    );

  if(!b)return;

  const a=
    b.dataset.action;

  if(a==='support'){

    openModal(
      'Customer Service',
      `
      <div class="dfw-support-card">

      <div class="dfw-support-label">
      Telegram Support
      </div>

      <div class="dfw-support-value">
      ${SUPPORT_HANDLE}
      </div>

      <div class="dfw-support-status">
      ● Online Support
      </div>

      <a
      class="dfw-support-btn"
      href="${SUPPORT_URL}"
      target="_blank"
      rel="noopener">
      Contact via Telegram
      </a>

      </div>
      `
    );

    return;
  }

  if(a==='pnl'){

    location.href='pnl.html';

    return;
  }

  const t={
    notifications:'Notifications',
    news:'Crypto News',
    events:'Events'
  };

  const m={

    notifications:
    'Account notifications will appear here after the notification database is connected.',

    news:
    'Automatic crypto market news will appear here after the News service is connected.',

    events:
    'Platform events and promotions will appear here after the Events section is connected.'

  };

  openModal(
    t[a],
    `<div class="dfw-empty">${m[a]}</div>`
  );

};

document.addEventListener(
'pointerdown',
e=>{

  if(
    !root.contains(e.target) &&
    !bg.contains(e.target)
  ){

    root.classList.remove(
      'open'
    );

  }

});

})();
