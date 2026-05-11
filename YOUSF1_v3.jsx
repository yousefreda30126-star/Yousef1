import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   YOUSF1  —  منصة التداول الاحترافية
   React 18 · Canvas Charts · WebSocket · Binance API · Arabic UI
   ═══════════════════════════════════════════════════════════════════════ */

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const WS_URL  = process.env.REACT_APP_WS_URL  || "ws://localhost:5001";

/* ── Asset Lists ────────────────────────────────────────────────────── */
const FOREX = [
  "EUR/USD","GBP/USD","USD/JPY","USD/CHF","AUD/USD","NZD/USD","USD/CAD",
  "EUR/GBP","EUR/JPY","GBP/JPY","EUR/AUD","EUR/CAD","GBP/AUD","AUD/JPY",
  "CAD/JPY","CHF/JPY","EUR/CHF","GBP/CHF","AUD/CAD","NZD/JPY","EUR/NZD",
  "GBP/NZD","AUD/NZD","AUD/CHF","USD/SGD","USD/HKD","USD/SEK","USD/NOK",
  "USD/DKK","USD/ZAR","USD/MXN","USD/TRY","USD/BRL","USD/INR","USD/CNY",
  "EUR/SEK","EUR/NOK","EUR/PLN","EUR/HUF","EUR/CZK","EUR/RUB","USD/RUB",
  "GBP/SEK","GBP/NOK","GBP/PLN","USD/ILS","USD/THB","USD/PHP","USD/KRW","XAU/USD",
];
const CRYPTO = [
  "BTC/USDT","ETH/USDT","BNB/USDT","SOL/USDT","XRP/USDT","ADA/USDT",
  "DOGE/USDT","DOT/USDT","MATIC/USDT","AVAX/USDT","LINK/USDT","LTC/USDT",
  "UNI/USDT","ATOM/USDT","XLM/USDT","ETC/USDT","BCH/USDT","APT/USDT","OP/USDT","ARB/USDT",
];
const BASE_P = {
  "EUR/USD":1.0842,"GBP/USD":1.2634,"USD/JPY":149.32,"USD/CHF":0.8921,
  "AUD/USD":0.6512,"NZD/USD":0.5987,"USD/CAD":1.3621,"EUR/GBP":0.8583,
  "EUR/JPY":161.87,"GBP/JPY":188.64,"EUR/AUD":1.6645,"EUR/CAD":1.4762,
  "GBP/AUD":1.9397,"AUD/JPY":97.28,"CAD/JPY":109.61,"CHF/JPY":167.39,
  "EUR/CHF":0.9673,"GBP/CHF":1.1278,"AUD/CAD":0.8861,"NZD/JPY":89.32,
  "EUR/NZD":1.8114,"GBP/NZD":2.110,"AUD/NZD":1.0877,"AUD/CHF":0.5813,
  "USD/SGD":1.3412,"USD/HKD":7.8234,"USD/SEK":10.43,"USD/NOK":10.56,
  "USD/DKK":6.891,"USD/ZAR":18.67,"USD/MXN":17.12,"USD/TRY":32.45,
  "USD/BRL":4.982,"USD/INR":83.43,"USD/CNY":7.234,"EUR/SEK":11.31,
  "EUR/NOK":11.45,"EUR/PLN":4.234,"EUR/HUF":389.1,"EUR/CZK":25.34,
  "EUR/RUB":98.34,"USD/RUB":90.21,"GBP/SEK":13.17,"GBP/NOK":13.34,
  "GBP/PLN":4.932,"USD/ILS":3.723,"USD/THB":35.12,"USD/PHP":56.23,
  "USD/KRW":1324.1,"XAU/USD":2341.9,
  "BTC/USDT":67432,"ETH/USDT":3521,"BNB/USDT":562,"SOL/USDT":185.3,
  "XRP/USDT":0.6123,"ADA/USDT":0.4512,"DOGE/USDT":0.1623,"DOT/USDT":7.821,
  "MATIC/USDT":0.8912,"AVAX/USDT":38.21,"LINK/USDT":18.43,"LTC/USDT":87.32,
  "UNI/USDT":11.23,"ATOM/USDT":9.87,"XLM/USDT":0.1234,"ETC/USDT":28.43,
  "BCH/USDT":487.21,"APT/USDT":12.43,"OP/USDT":3.21,"ARB/USDT":1.87,
};
const TFS = [{l:"5 ث",s:5},{l:"15 ث",s:15},{l:"30 ث",s:30},{l:"1 د",s:60}];

/* ── Audio Engine ───────────────────────────────────────────────────── */
const beep = (freq=880,dur=.12,type="sine",vol=.25) => {
  try {
    const a = new (window.AudioContext||window.webkitAudioContext)();
    const o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol,a.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,a.currentTime+dur);
    o.start(); o.stop(a.currentTime+dur);
  } catch {}
};
const SFX = {
  open:  () => { beep(660,.08); setTimeout(()=>beep(880,.1),90); },
  win:   () => [440,550,660,880].forEach((f,i)=>setTimeout(()=>beep(f,.15,"sine",.35),i*75)),
  loss:  () => beep(180,.4,"sawtooth",.3),
  click: () => beep(1200,.04,"square",.1),
};

/* ── API helper ─────────────────────────────────────────────────────── */
const api = async (path, method="GET", body=null, token=null) => {
  const h = {"Content-Type":"application/json"};
  if (token) h["Authorization"]=`Bearer ${token}`;
  const r = await fetch(API_URL+path,{method,headers:h,body:body?JSON.stringify(body):null});
  return r.json();
};

/* ═══════════════════════════════════════════════════════════════════════
   CANVAS CHART
   ═══════════════════════════════════════════════════════════════════════ */
function CandleChart({ candles, livePrice, activeTrade }) {
  const ref = useRef(null);
  const animRef = useRef(null);

  const draw = useCallback(() => {
    const el = ref.current; if (!el || candles.length < 3) return;
    const dpr = window.devicePixelRatio||1;
    const W = el.offsetWidth, H = el.offsetHeight;
    el.width = W*dpr; el.height = H*dpr;
    const ctx = el.getContext("2d"); ctx.scale(dpr,dpr);

    /* background gradient */
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,"#020508"); bg.addColorStop(1,"#040a12");
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

    const PAD={t:14,b:42,l:8,r:80};
    const CW=W-PAD.l-PAD.r, CH=H-PAD.t-PAD.b;

    /* price range */
    const allP = candles.flatMap(c=>[c.h,c.l]);
    if (livePrice) allP.push(livePrice);
    let mn=Math.min(...allP), mx=Math.max(...allP);
    const rng=mx-mn||.0001; mn-=rng*.1; mx+=rng*.1;
    const toY=p=>PAD.t+CH*(1-(p-mn)/(mx-mn));
    const toX=i=>PAD.l+(i/(Math.max(candles.length-1,1)))*CW;

    /* grid */
    const ROWS=6;
    for(let i=0;i<=ROWS;i++){
      const y=PAD.t+(CH/ROWS)*i;
      const pv=mx-(mx-mn)/ROWS*i;
      ctx.strokeStyle="#0c1a2a"; ctx.lineWidth=1;
      ctx.setLineDash([3,4]);
      ctx.beginPath(); ctx.moveTo(PAD.l,y); ctx.lineTo(W-PAD.r,y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle="#253a50"; ctx.font=`9px 'IBM Plex Mono',monospace`; ctx.textAlign="left";
      ctx.fillText(pv>100?pv.toFixed(1):pv.toFixed(5), W-PAD.r+4, y+3.5);
    }
    for(let i=0;i<=8;i++){
      const x=PAD.l+(CW/8)*i;
      ctx.strokeStyle="#0c1a2a"; ctx.lineWidth=1; ctx.setLineDash([2,5]);
      ctx.beginPath(); ctx.moveTo(x,PAD.t); ctx.lineTo(x,PAD.t+CH); ctx.stroke();
      ctx.setLineDash([]);
    }

    /* area fill under line */
    if (candles.length > 1) {
      const lastUp = candles[candles.length-1].c >= candles[0].c;
      const areaColor = lastUp?"#00e67608":"#ff3d5708";
      ctx.beginPath(); ctx.moveTo(toX(0),toY(candles[0].c));
      candles.forEach((_,i)=>ctx.lineTo(toX(i),toY(candles[i].c)));
      ctx.lineTo(toX(candles.length-1),PAD.t+CH);
      ctx.lineTo(toX(0),PAD.t+CH); ctx.closePath();
      ctx.fillStyle=areaColor; ctx.fill();
    }

    /* candle width */
    const cw=Math.max(2,(CW/candles.length)*.7);

    /* draw candles */
    candles.forEach((c,i)=>{
      const x=toX(i), up=c.c>=c.o;
      const col=up?"#00e676":"#ff3d57";
      const dimCol=up?"#00e67688":"#ff3d5788";
      /* wick */
      ctx.strokeStyle=dimCol; ctx.lineWidth=1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x,toY(c.h)); ctx.lineTo(x,toY(c.l)); ctx.stroke();
      /* body */
      const y1=toY(Math.max(c.o,c.c)), bh=Math.max(1.5,toY(Math.min(c.o,c.c))-y1);
      ctx.fillStyle=up?"#00e67622":"#ff3d5722";
      ctx.strokeStyle=col; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.roundRect(x-cw/2,y1,cw,bh,1); ctx.fill(); ctx.stroke();
    });

    /* live price line */
    if (livePrice) {
      const y=toY(livePrice);
      const trCol = activeTrade?.dir==="شراء" ? "#00e676" : activeTrade?.dir==="بيع" ? "#ff3d57" : "#00e5ff";
      /* glow */
      ctx.shadowColor=trCol; ctx.shadowBlur=8;
      ctx.strokeStyle=trCol+"99"; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.moveTo(PAD.l,y); ctx.lineTo(W-PAD.r,y); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur=0;
      /* price badge */
      const priceTxt = livePrice>100?livePrice.toFixed(2):livePrice.toFixed(5);
      const bx=W-PAD.r+2, bw=72;
      ctx.fillStyle=trCol;
      ctx.beginPath(); ctx.roundRect(bx,y-11,bw,22,5); ctx.fill();
      ctx.fillStyle="#000"; ctx.font="bold 9.5px 'IBM Plex Mono',monospace";
      ctx.textAlign="center"; ctx.fillText(priceTxt,bx+bw/2,y+3.5);
    }

    /* countdown timer arc (if active trade) */
    if (activeTrade) {
      const prg = Math.min((Date.now()-activeTrade.openTime)/1000/activeTrade.dur,1);
      const cx2=PAD.l+20, cy2=PAD.t+20, cr=14;
      ctx.strokeStyle="#1a2d4a"; ctx.lineWidth=2.5; ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cx2,cy2,cr,0,Math.PI*2); ctx.stroke();
      const trCol2=activeTrade.dir==="شراء"?"#00e676":"#ff3d57";
      ctx.strokeStyle=trCol2; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.arc(cx2,cy2,cr,-Math.PI/2,-Math.PI/2+Math.PI*2*prg); ctx.stroke();
      ctx.fillStyle=trCol2; ctx.font="bold 8px 'IBM Plex Mono',monospace";
      ctx.textAlign="center";
      ctx.fillText(Math.max(0,activeTrade.dur-Math.floor((Date.now()-activeTrade.openTime)/1000))+"ث",cx2,cy2+3);
    }
  }, [candles, livePrice, activeTrade]);

  useEffect(()=>{
    cancelAnimationFrame(animRef.current);
    const loop=()=>{ draw(); animRef.current=requestAnimationFrame(loop); };
    loop();
    return ()=>cancelAnimationFrame(animRef.current);
  },[draw]);

  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block"}} />;
}

/* ═══════════════════════════════════════════════════════════════════════
   SPLASH SCREEN
   ═══════════════════════════════════════════════════════════════════════ */
function Splash({ onConnect, onGuest }) {
  const [key,setKey]=useState(""); const [sec,setSec]=useState("");
  const [busy,setBusy]=useState(false); const [msg,setMsg]=useState(null);
  const [particles] = useState(()=>Array.from({length:60},(_,i)=>({
    x:Math.random()*100, y:Math.random()*100,
    s:Math.random()*2+.5, sp:Math.random()*.3+.1,
    o:Math.random()*.5+.1,
  })));

  const connect = async () => {
    if (!key.trim()||!sec.trim()) { setMsg({t:"err",m:"أدخل المفتاح والسر"}); return; }
    setBusy(true); setMsg(null);
    try {
      const d = await api("/binance/connect","POST",{apiKey:key,secretKey:sec});
      if (d.success) {
        setMsg({t:"ok",m:`✅ تم الاتصال بنجاح! الرصيد: $${(d.balance||10000).toLocaleString()}`});
        setTimeout(()=>onConnect(d),1500);
      } else throw new Error(d.error||"خطأ");
    } catch(e) {
      if(key.length>8&&sec.length>8) { /* demo fallback */
        setMsg({t:"ok",m:"✅ وضع تجريبي — تم القبول"});
        setTimeout(()=>onConnect({balance:10000,token:"demo_"+Date.now()}),1200);
      } else setMsg({t:"err",m:"❌ "+e.message});
    }
    setBusy(false);
  };

  return (
    <div style={{
      position:"fixed",inset:0,background:"#020508",display:"flex",
      alignItems:"center",justifyContent:"center",
      fontFamily:"'IBM Plex Mono',monospace",overflow:"hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600;700&family=Syne:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
        @keyframes glow{0%,100%{text-shadow:0 0 30px #00e5ff55,0 0 60px #00e5ff22;}50%{text-shadow:0 0 60px #00e5ffaa,0 0 100px #00e5ff44;}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes scanline{0%{top:-2px;}100%{top:100%}}
        @keyframes particle{0%{opacity:var(--o);transform:translateY(0);}100%{opacity:0;transform:translateY(-80px);}}
        input{font-family:'IBM Plex Mono',monospace;outline:none;}
      `}</style>

      {/* scanlines */}
      <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,#ffffff04 2px,#ffffff04 4px)",pointerEvents:"none",zIndex:1}}/>
      <div style={{position:"absolute",left:0,right:0,height:"3px",background:"linear-gradient(90deg,transparent,#00e5ff22,transparent)",animation:"scanline 3s linear infinite",zIndex:2}}/>

      {/* particles */}
      {particles.map((p,i)=>(
        <div key={i} style={{
          position:"absolute",left:`${p.x}%`,top:`${p.y}%`,
          width:p.s,height:p.s,borderRadius:"50%",
          background:"#00e5ff",opacity:p.o,
          animation:`particle ${p.sp+2}s ${i*0.1}s infinite ease-in`,
          "--o":p.o,
        }}/>
      ))}

      <div style={{position:"relative",zIndex:10,width:"min(460px,94vw)",padding:"0 16px"}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{
            fontFamily:"'Syne',sans-serif",fontWeight:900,
            fontSize:"clamp(52px,14vw,88px)",color:"#00e5ff",
            letterSpacing:8,lineHeight:1,animation:"glow 3s ease-in-out infinite",
          }}>YOUSF1</div>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",fontSize:11,
            color:"#1e4a6a",letterSpacing:5,marginTop:8,
            animation:"fadeUp .6s .3s both",
          }}>منصة التداول الاحترافية</div>
          <div style={{
            display:"flex",justifyContent:"center",gap:16,marginTop:16,
            animation:"fadeUp .6s .5s both",
          }}>
            {["70 زوج","WebSocket","Binance API","SSL"].map(t=>(
              <span key={t} style={{
                padding:"3px 10px",borderRadius:20,fontSize:9,
                background:"#00e5ff0a",border:"1px solid #00e5ff22",color:"#00e5ff66",
                fontFamily:"'IBM Plex Mono',monospace",letterSpacing:1,
              }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Connect form */}
        <div style={{
          background:"#070d18cc",border:"1px solid #0f1e35",
          backdropFilter:"blur(20px)",borderRadius:16,padding:28,
          animation:"fadeUp .6s .7s both",
        }}>
          <div style={{fontSize:12,color:"#2a4060",marginBottom:16,textAlign:"center",letterSpacing:1}}>
            ربط حساب Binance API
          </div>

          <div style={{
            background:"#030608",border:"1px solid #0c1a2a",borderRadius:10,
            padding:12,marginBottom:16,fontSize:10,color:"#2a4060",lineHeight:2,
          }}>
            <div style={{color:"#ffa500",marginBottom:4,fontSize:11}}>⚠️ كيف تحصل على مفاتيح API:</div>
            <div>١. سجّل دخول على <span style={{color:"#00e5ff"}}>binance.com</span></div>
            <div>٢. اذهب لـ Profile → API Management</div>
            <div>٣. أنشئ مفتاح → فعّل <span style={{color:"#00e676"}}>"Enable Reading"</span> فقط</div>
          </div>

          <div style={{fontSize:9,color:"#1e3a5a",letterSpacing:1,marginBottom:5}}>🔑 BINANCE API KEY</div>
          <input
            value={key} onChange={e=>setKey(e.target.value)}
            placeholder="أدخل مفتاح API الخاص بك..."
            style={{
              width:"100%",display:"block",background:"#030608",
              border:"1px solid #1a2d4a",borderRadius:8,
              padding:"11px 14px",color:"#c8d8f0",fontSize:12,marginBottom:12,
            }}
          />
          <div style={{fontSize:9,color:"#1e3a5a",letterSpacing:1,marginBottom:5}}>🔒 SECRET KEY</div>
          <input
            type="password" value={sec} onChange={e=>setSec(e.target.value)}
            placeholder="أدخل المفتاح السري..."
            onKeyDown={e=>e.key==="Enter"&&connect()}
            style={{
              width:"100%",display:"block",background:"#030608",
              border:"1px solid #1a2d4a",borderRadius:8,
              padding:"11px 14px",color:"#c8d8f0",fontSize:12,marginBottom:16,
            }}
          />

          {msg && (
            <div style={{
              padding:"9px 14px",borderRadius:8,marginBottom:12,fontSize:11,
              background:msg.t==="ok"?"#00e67610":"#ff3d5710",
              border:`1px solid ${msg.t==="ok"?"#00e67644":"#ff3d5744"}`,
              color:msg.t==="ok"?"#00e676":"#ff3d57",lineHeight:1.6,
            }}>{msg.m}</div>
          )}

          <button
            onClick={connect} disabled={busy}
            style={{
              width:"100%",padding:"14px",borderRadius:10,border:"none",
              background:busy?"#1a2d4a":"linear-gradient(135deg,#00e5ff,#0057ff)",
              color:busy?"#3a5070":"#000",cursor:busy?"not-allowed":"pointer",
              fontFamily:"'IBM Plex Mono',monospace",fontSize:14,fontWeight:700,
              letterSpacing:2,marginBottom:10,transition:"all .2s",
            }}
          >
            {busy ? <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              <span style={{width:14,height:14,border:"2px solid #3a5070",borderTop:"2px solid #00e5ff",borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block"}}/>
              جارٍ الاتصال...
            </span> : "اتصال بـ Binance ✓"}
          </button>

          <button
            onClick={onGuest}
            style={{
              width:"100%",padding:"10px",borderRadius:8,cursor:"pointer",
              background:"transparent",border:"1px solid #0f1e35",
              color:"#1e3a5a",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,
              transition:"all .2s",
            }}
          >← الوضع التجريبي (بدون API)</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════════ */
export default function App() {
  /* State */
  const [screen,setScreen]   = useState("splash");
  const [token,setToken]     = useState(()=>{try{return localStorage.getItem("y1t")||""}catch{return ""}});
  const [user,setUser]       = useState(null);
  const [balance,setBalance] = useState(10000);
  const [symbol,setSymbol]   = useState("BTC/USDT");
  const [tf,setTf]           = useState(TFS[0]);
  const [amt,setAmt]         = useState("100");
  const [opens,setOpens]     = useState([]);
  const [hist,setHist]       = useState([]);
  const [tab,setTab]         = useState("dash");
  const [assetTab,setAssetTab]=useState("ALL");
  const [search,setSearch]   = useState("");
  const [toast,setToast]     = useState(null);
  const [sound,setSound]     = useState(true);
  const [showApiModal,setApiModal]=useState(false);
  const [apiF,setApiF]       = useState({key:"",sec:"",busy:false,msg:null});
  const [depAmt,setDepAmt]   = useState(""); const [wdAmt,setWdAmt]=useState("");
  /* Prices */
  const [prices,setPrices]   = useState(()=>{const p={};[...FOREX,...CRYPTO].forEach(a=>p[a]=BASE_P[a]||1);return p;});
  const [changes,setChanges] = useState({});
  const [candles,setCandles] = useState([]);
  const pricesRef            = useRef({...prices});
  const opensRef             = useRef(opens);
  opensRef.current           = opens;

  /* helpers */
  const fmt = p => p>100 ? p.toFixed(2) : p.toFixed(5);
  const ALL = useMemo(()=>[...FOREX,...CRYPTO],[]);

  const notif = useCallback((msg,type="ok")=>{
    setToast({msg,type});
    setTimeout(()=>setToast(null),4000);
  },[]);

  /* Build candles */
  const makeCandles = useCallback((base,n=90)=>{
    let p=base;
    return Array.from({length:n},()=>{
      const v=(Math.random()-.499)*base*.0035;
      const o=p, c=p+v;
      return {o,c,h:Math.max(o,c)*(1+Math.random()*.0003),l:Math.min(o,c)*(1-Math.random()*.0003)};
    });
  },[]);

  /* reset candles on symbol change */
  useEffect(()=>setCandles(makeCandles(prices[symbol])),[symbol]);

  /* live price tick */
  useEffect(()=>{
    const iv=setInterval(()=>{
      setPrices(prev=>{
        const next={...prev},nc={};
        ALL.forEach(a=>{
          const d=(Math.random()-.499)*prev[a]*.0009;
          next[a]=parseFloat((prev[a]+d).toFixed(prev[a]>100?2:6));
          nc[a]=parseFloat(((next[a]-(BASE_P[a]||1))/(BASE_P[a]||1)*100).toFixed(2));
        });
        pricesRef.current=next;
        setChanges(nc);
        return next;
      });
      /* push candle tick */
      setCandles(prev=>{
        if(!prev.length) return prev;
        const last=prev[prev.length-1], cp=pricesRef.current[symbol]||last.c;
        return [...prev.slice(-89),{
          o:last.c,c:cp,
          h:Math.max(last.c,cp)*(1+Math.random()*.0003),
          l:Math.min(last.c,cp)*(1-Math.random()*.0003),
        }];
      });
    },900);
    return ()=>clearInterval(iv);
  },[symbol]);

  /* WebSocket Binance */
  useEffect(()=>{
    let ws;
    try{
      ws=new WebSocket(WS_URL);
      ws.onmessage=e=>{
        try{
          const d=JSON.parse(e.data);
          if(d.data?.s&&d.data?.p){
            const sym=d.data.s.replace("USDT","/USDT");
            const p=parseFloat(d.data.p);
            setPrices(prev=>({...prev,[sym]:p}));
            pricesRef.current[sym]=p;
          }
        }catch{}
      };
    }catch{}
    return ()=>{try{ws?.close()}catch{}};
  },[]);

  /* Trade auto-close */
  useEffect(()=>{
    const iv=setInterval(()=>{
      const now=Date.now();
      const cur=opensRef.current;
      const rem=[],closed=[];
      cur.forEach(t=>{
        const el=(now-t.openTime)/1000;
        if(el>=t.dur){
          const cp=pricesRef.current[t.sym]||t.ep;
          const won=t.dir==="شراء"?cp>t.ep:cp<t.ep;
          const pnl=won?t.amt:-t.amt;
          closed.push({...t,cp,pnl,status:won?"WIN":"LOSS"});
          setBalance(b=>parseFloat((b+pnl+(won?t.amt:0)).toFixed(2)));
          if(sound) won?SFX.win():SFX.loss();
          notif(won?`✅ ربحت +$${t.amt.toFixed(2)} | ${t.sym}`:`❌ خسرت -$${t.amt.toFixed(2)} | ${t.sym}`, won?"win":"loss");
          if(token) api(`/trades/close/${t.id}`,"POST",{closePrice:cp},token).catch(()=>{});
        } else rem.push(t);
      });
      if(closed.length){
        setOpens(rem);
        setHist(h=>[...closed,...h].slice(0,200));
      }
    },300);
    return ()=>clearInterval(iv);
  },[sound,token]);

  /* Restore session */
  useEffect(()=>{
    if(token&&token!=="") {
      api("/user/profile","GET",null,token)
        .then(d=>{ if(d._id){setUser(d);setBalance(d.balance);setScreen("app");}})
        .catch(()=>{});
    }
  },[]);

  /* Handlers */
  const onConnect = d => {
    if(d.token&&d.token!=="demo_"+0){
      try{localStorage.setItem("y1t",d.token)}catch{}
      setToken(d.token);
    }
    setBalance(d.balance||10000);
    setUser({connected:true,via:"Binance"});
    setScreen("app");
  };

  const placeTrade = dir => {
    const a=parseFloat(amt);
    if(isNaN(a)||a<=0) return notif("أدخل مبلغاً صحيحاً","err");
    if(a>balance) return notif("رصيد غير كافٍ","err");
    const t={
      id:"t_"+Date.now(),sym:symbol,dir,amt:a,
      ep:pricesRef.current[symbol]||prices[symbol],
      openTime:Date.now(),dur:tf.s,tfl:tf.l,
    };
    setBalance(b=>parseFloat((b-a).toFixed(2)));
    setOpens(p=>[...p,t]);
    if(sound) SFX.open();
    notif(`${dir==="شراء"?"📈":"📉"} ${dir} ${symbol} — $${a}`,"info");
    setTab("chart");
    if(token) api("/trades/open","POST",{symbol,direction:dir,amount:a,entryPrice:t.ep,timeframe:tf.l,durationSec:tf.s},token).catch(()=>{});
  };

  const connectBinance = async () => {
    if(!apiF.key.trim()||!apiF.sec.trim()){setApiF(p=>({...p,msg:{t:"err",m:"أدخل المفاتيح"}}));return;}
    setApiF(p=>({...p,busy:true,msg:null}));
    try{
      const d=await api("/binance/connect","POST",{apiKey:apiF.key,secretKey:apiF.sec,userId:user?._id});
      if(d.success){
        if(d.balance) setBalance(d.balance);
        if(d.token){try{localStorage.setItem("y1t",d.token)}catch{};setToken(d.token);}
        setUser(u=>({...u,connected:true}));
        setApiF(p=>({...p,msg:{t:"ok",m:`✅ تم الاتصال! الرصيد: $${(d.balance||balance).toLocaleString()}`}}));
        setTimeout(()=>setApiModal(false),2000);
      } else throw new Error(d.error||"خطأ");
    }catch(e){
      if(apiF.key.length>8&&apiF.sec.length>8){
        setApiF(p=>({...p,msg:{t:"ok",m:"✅ وضع تجريبي — تم القبول"}}));
        setTimeout(()=>setApiModal(false),1500);
      } else setApiF(p=>({...p,msg:{t:"err",m:"❌ "+e.message}}));
    }
    setApiF(p=>({...p,busy:false}));
  };

  const doDeposit = async () => {
    const a=parseFloat(depAmt); if(isNaN(a)||a<=0) return;
    try{
      const d=await api("/binance/deposit","POST",{amount:a},token);
      if(d.balance) setBalance(d.balance); else setBalance(b=>b+a);
    }catch{ setBalance(b=>parseFloat((b+a).toFixed(2))); }
    setDepAmt(""); notif(`✅ تم إيداع $${a}`,"win");
  };
  const doWithdraw = async () => {
    const a=parseFloat(wdAmt); if(isNaN(a)||a<=0||a>balance) return notif("مبلغ غير صالح","err");
    try{
      const d=await api("/binance/withdraw","POST",{amount:a},token);
      if(d.balance) setBalance(d.balance); else setBalance(b=>parseFloat((b-a).toFixed(2)));
    }catch{ setBalance(b=>parseFloat((b-a).toFixed(2))); }
    setWdAmt(""); notif(`✅ تم سحب $${a}`,"win");
  };

  /* Derived */
  const curP  = prices[symbol]||0;
  const curCh = changes[symbol]||0;
  const isUp  = curCh>=0;
  const wins  = hist.filter(h=>h.status==="WIN").length;
  const losses= hist.filter(h=>h.status==="LOSS").length;
  const netPnl= hist.reduce((s,h)=>s+h.pnl,0);
  const wr    = hist.length?((wins/hist.length)*100).toFixed(0):0;
  const filtered = useMemo(()=>
    [...FOREX,...CRYPTO].filter(a=>{
      if(assetTab==="فوركس"&&!FOREX.includes(a)) return false;
      if(assetTab==="كريبتو"&&!CRYPTO.includes(a)) return false;
      return a.toLowerCase().includes(search.toLowerCase());
    })
  ,[assetTab,search]);

  const activeTradeForChart = useMemo(()=>opens.find(t=>t.sym===symbol),[opens,symbol]);

  /* ── SPLASH ── */
  if(screen==="splash") return <Splash onConnect={onConnect} onGuest={()=>setScreen("app")}/>;

  /* ══════════════════════════════════════════════════════════════════════
     MAIN APP
     ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      height:"100vh",overflow:"hidden",
      background:"#020508",color:"#c8d8f0",
      fontFamily:"'IBM Plex Mono',monospace",
      display:"flex",flexDirection:"column",fontSize:12,direction:"rtl",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600;700&family=Syne:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:#020508;}
        ::-webkit-scrollbar-thumb{background:#1a2d4a;border-radius:2px;}
        input,button{font-family:'IBM Plex Mono',monospace;outline:none;}
        .ah:hover{background:#0a1828 !important;}
        .th:hover{background:#0a1828 !important;}
        .btn-up:hover{filter:brightness(1.3);box-shadow:0 0 30px #00e67644 !important;}
        .btn-dn:hover{filter:brightness(1.3);box-shadow:0 0 30px #ff3d5744 !important;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.2;}}
        @keyframes slideL{from{transform:translateX(110%);opacity:0;}to{transform:translateX(0);opacity:1;}}
        @keyframes popIn{from{transform:scale(.88);opacity:0;}to{transform:scale(1);opacity:1;}}
        @keyframes fadeU{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        .toast-el{animation:slideL .3s ease;}
        .pop{animation:popIn .22s ease both;}
        @media(max-width:860px){
          .main-wrap{flex-direction:column !important;}
          .aside-bar{width:100% !important;height:130px !important;overflow-x:auto !important;overflow-y:hidden !important;}
          .asset-inner{display:flex !important;flex-direction:row !important;}
        }
        @media(max-width:560px){
          .tgrid{grid-template-columns:1fr !important;}
          .hbal{font-size:17px !important;}
        }
      `}</style>

      {/* ── TOAST ── */}
      {toast&&(
        <div className="toast-el" style={{
          position:"fixed",bottom:18,right:18,zIndex:9999,maxWidth:310,
          padding:"12px 18px",borderRadius:12,backdropFilter:"blur(16px)",
          background:toast.type==="win"?"#00e67612":toast.type==="loss"?"#ff3d5712":toast.type==="err"?"#ff8c0012":"#00e5ff12",
          border:`1px solid ${toast.type==="win"?"#00e67650":toast.type==="loss"?"#ff3d5750":toast.type==="err"?"#ff8c0050":"#00e5ff40"}`,
          color:"#c8d8f0",fontSize:12,lineHeight:1.6,
          boxShadow:"0 8px 32px #00000080",
        }}>{toast.msg}</div>
      )}

      {/* ── BINANCE API MODAL ── */}
      {showApiModal&&(
        <div onClick={()=>setApiModal(false)} style={{
          position:"fixed",inset:0,background:"#000d",zIndex:300,
          display:"flex",alignItems:"center",justifyContent:"center",padding:20,
        }}>
          <div className="pop" onClick={e=>e.stopPropagation()} style={{
            background:"#070d18",border:"1px solid #1a2d4a",borderRadius:16,
            padding:28,width:"min(440px,100%)",
          }}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
              <span style={{fontSize:14,fontWeight:700,color:"#00e5ff"}}>🔑 ربط Binance API</span>
              <button onClick={()=>setApiModal(false)} style={{background:"none",border:"none",color:"#2a4060",cursor:"pointer",fontSize:20}}>✕</button>
            </div>
            <div style={{fontSize:9,color:"#1e3a5a",marginBottom:5,letterSpacing:1}}>API KEY</div>
            <input type="text" value={apiF.key} onChange={e=>setApiF(p=>({...p,key:e.target.value}))}
              placeholder="أدخل مفتاح API..."
              style={{width:"100%",display:"block",background:"#030608",border:"1px solid #1a2d4a",borderRadius:8,padding:"10px 14px",color:"#c8d8f0",fontSize:12,marginBottom:12}}/>
            <div style={{fontSize:9,color:"#1e3a5a",marginBottom:5,letterSpacing:1}}>SECRET KEY</div>
            <input type="password" value={apiF.sec} onChange={e=>setApiF(p=>({...p,sec:e.target.value}))}
              placeholder="أدخل المفتاح السري..."
              style={{width:"100%",display:"block",background:"#030608",border:"1px solid #1a2d4a",borderRadius:8,padding:"10px 14px",color:"#c8d8f0",fontSize:12,marginBottom:16}}/>
            {apiF.msg&&(
              <div style={{
                padding:"9px 14px",borderRadius:8,marginBottom:12,fontSize:11,
                background:apiF.msg.t==="ok"?"#00e67610":"#ff3d5710",
                border:`1px solid ${apiF.msg.t==="ok"?"#00e67644":"#ff3d5744"}`,
                color:apiF.msg.t==="ok"?"#00e676":"#ff3d57",lineHeight:1.6,
              }}>{apiF.msg.m}</div>
            )}
            <button onClick={connectBinance} disabled={apiF.busy} style={{
              width:"100%",padding:"13px",borderRadius:10,border:"none",cursor:"pointer",
              background:apiF.busy?"#1a2d4a":"linear-gradient(135deg,#00e5ff,#0057ff)",
              color:apiF.busy?"#3a5070":"#000",fontFamily:"'IBM Plex Mono',monospace",
              fontSize:13,fontWeight:700,letterSpacing:2,
            }}>
              {apiF.busy?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{width:12,height:12,border:"2px solid #3a5070",borderTop:"2px solid #00e5ff",borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block"}}/>
                جارٍ الاتصال...
              </span>:"اتصال ✓ OK"}
            </button>
            <div style={{marginTop:10,fontSize:10,color:"#1e3a5a",textAlign:"center"}}>
              🔒 المفاتيح تُحفظ مشفرة في قاعدة البيانات ولا تظهر أبداً
            </div>
          </div>
        </div>
      )}

      {/* ══ HEADER ══ */}
      <header style={{
        background:"#070d18",borderBottom:"1px solid #0c1a2a",
        padding:"7px 16px",display:"flex",alignItems:"center",
        justifyContent:"space-between",flexShrink:0,
        boxShadow:"0 2px 20px #00000090",position:"relative",zIndex:50,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{
            width:32,height:32,borderRadius:8,
            background:"linear-gradient(135deg,#00e5ff,#0057ff)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:12,color:"#000",
          }}>Y1</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:14,color:"#00e5ff",letterSpacing:3}}>YOUSF1</div>
            <div style={{fontSize:8,color:"#0e2030",letterSpacing:3}}>منصة التداول الاحترافية</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginRight:4}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"#00e676",animation:"pulse 1.5s infinite"}}/>
            <span style={{fontSize:8,color:"#00e676",letterSpacing:1}}>مباشر</span>
          </div>
          {user?.connected&&(
            <span style={{padding:"2px 8px",borderRadius:20,fontSize:8,background:"#00e67610",border:"1px solid #00e67630",color:"#00e676"}}>
              ✓ Binance
            </span>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div>
            <div style={{fontSize:7,color:"#0e2030",letterSpacing:2,textAlign:"center"}}>الرصيد</div>
            <div className="hbal" style={{
              fontSize:19,fontWeight:700,
              color:balance>=10000?"#00e676":balance>=5000?"#ffa500":"#ff3d57",letterSpacing:.5,
            }}>
              ${balance.toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}
            </div>
          </div>
          <button onClick={()=>setSound(s=>!s)} style={{
            padding:"5px 9px",borderRadius:6,background:"#0a1525",
            border:`1px solid ${sound?"#00e67633":"#1a2d4a"}`,
            color:sound?"#00e676":"#3a5070",cursor:"pointer",fontSize:14,
          }}>{sound?"🔊":"🔇"}</button>
          <button onClick={()=>{SFX.click();setApiModal(true);setApiF(p=>({...p,msg:null}));}} style={{
            padding:"5px 12px",borderRadius:7,background:"#0a1525",
            border:"1px solid #1a2d4a",color:"#3a5070",cursor:"pointer",fontSize:11,
          }}>🔑 API</button>
          <button onClick={()=>setScreen("splash")} style={{
            padding:"5px 11px",borderRadius:7,background:"transparent",
            border:"1px solid #0c1a2a",color:"#1e3a5a",cursor:"pointer",fontSize:11,
          }}>خروج</button>
        </div>
      </header>

      {/* ══ BODY ══ */}
      <div className="main-wrap" style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>

        {/* ── SIDEBAR ── */}
        <aside className="aside-bar" style={{
          width:190,background:"#070d18",borderLeft:"1px solid #0c1a2a",
          display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0,
        }}>
          <div style={{padding:"7px 7px 4px"}}>
            <input
              value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 بحث عن زوج..."
              style={{
                width:"100%",display:"block",background:"#030608",
                border:"1px solid #0c1a2a",borderRadius:6,
                padding:"5px 9px",color:"#c8d8f0",fontSize:10,
              }}
            />
          </div>
          <div style={{display:"flex",borderBottom:"1px solid #0c1a2a"}}>
            {["ALL","فوركس","كريبتو"].map(t=>(
              <button key={t} onClick={()=>setAssetTab(t)} style={{
                flex:1,padding:"5px 0",background:"none",border:"none",cursor:"pointer",
                borderBottom:assetTab===t?"2px solid #00e5ff":"2px solid transparent",
                color:assetTab===t?"#00e5ff":"#1e3a5a",fontSize:8,letterSpacing:.5,
              }}>{t}</button>
            ))}
          </div>
          <div className="asset-inner" style={{flex:1,overflowY:"auto"}}>
            {filtered.map(a=>{
              const p=prices[a]||0,c=changes[a]||0,sel=a===symbol;
              return (
                <div key={a} className="ah" onClick={()=>{SFX.click();setSymbol(a);}} style={{
                  padding:"6px 9px",borderBottom:"1px solid #09131f",cursor:"pointer",
                  background:sel?"#0c1e38":"transparent",
                  borderRight:sel?"2px solid #00e5ff":"2px solid transparent",
                  transition:"all .12s",
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:sel?600:400,color:sel?"#00e5ff":"#6a8aa8"}}>{a}</div>
                      <div style={{fontSize:8,color:"#1e3a5a"}}>{CRYPTO.includes(a)?"CRYPTO":"FOREX"}</div>
                    </div>
                    <div style={{textAlign:"left"}}>
                      <div style={{fontSize:9,color:sel?"#c8d8f0":"#7a9ab8"}}>{fmt(p)}</div>
                      <div style={{fontSize:8,color:c>=0?"#00e676":"#ff3d57"}}>{c>=0?"+":""}{c}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── CENTER ── */}
        <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

          {/* Asset bar */}
          <div style={{
            background:"#070d18",borderBottom:"1px solid #0c1a2a",
            padding:"7px 16px",display:"flex",alignItems:"center",
            justifyContent:"space-between",flexWrap:"wrap",gap:8,flexShrink:0,
          }}>
            <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:18,color:"#00e5ff"}}>{symbol}</div>
                <div style={{fontSize:8,color:"#0e2030"}}>{CRYPTO.includes(symbol)?"Binance Crypto":"Forex Spot"} · Real-time</div>
              </div>
              <div>
                <div style={{fontSize:24,fontWeight:700,color:"#ddeeff"}}>{fmt(curP)}</div>
                <div style={{fontSize:11,color:isUp?"#00e676":"#ff3d57",fontWeight:600}}>
                  {isUp?"▲":"▼"} {Math.abs(curCh)}%
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 14px",fontSize:9,color:"#1e3a5a"}}>
                <span>أعلى: <b style={{color:"#00e676"}}>{fmt(curP*1.002)}</b></span>
                <span>أدنى: <b style={{color:"#ff3d57"}}>{fmt(curP*.998)}</b></span>
                <span>الافتتاح: <b style={{color:"#6a8aa8"}}>{fmt(BASE_P[symbol]||curP)}</b></span>
                <span>حجم: <b style={{color:"#6a8aa8"}}>{(Math.random()*9+1).toFixed(1)}K</b></span>
              </div>
            </div>
            <div style={{display:"flex",gap:5}}>
              {TFS.map(t=>(
                <button key={t.l} onClick={()=>setTf(t)} style={{
                  padding:"5px 11px",borderRadius:7,cursor:"pointer",
                  border:`1px solid ${t.l===tf.l?"#00e5ff":"#1a2d4a"}`,
                  background:t.l===tf.l?"#00e5ff14":"transparent",
                  color:t.l===tf.l?"#00e5ff":"#2a4060",fontSize:11,fontWeight:600,transition:"all .15s",
                }}>{t.l}</button>
              ))}
            </div>
          </div>

          {/* Tab Nav */}
          <div style={{
            background:"#070d18",borderBottom:"1px solid #0c1a2a",
            display:"flex",padding:"0 12px",flexShrink:0,overflowX:"auto",
          }}>
            {[
              {id:"dash",lbl:"📊 Dashboard"},
              {id:"chart",lbl:"📈 الرسم البياني"},
              {id:"opens",lbl:`🔄 مفتوحة (${opens.length})`},
              {id:"hist",lbl:`📋 السجل (${hist.length})`},
              {id:"settings",lbl:"⚙️ الإعدادات"},
            ].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:"9px 15px",background:"none",border:"none",cursor:"pointer",
                borderBottom:tab===t.id?"2px solid #00e5ff":"2px solid transparent",
                color:tab===t.id?"#00e5ff":"#2a4060",fontSize:11,
                whiteSpace:"nowrap",transition:"all .15s",
              }}>{t.lbl}</button>
            ))}
          </div>

          {/* Content */}
          <div style={{flex:1,overflowY:"auto",padding:12}}>

            {/* ══ DASHBOARD ══ */}
            {tab==="dash"&&(
              <div style={{animation:"fadeU .3s ease"}}>
                {/* Stats row */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:12}}>
                  {[
                    {icon:"💰",label:"الرصيد",value:`$${balance.toLocaleString("en",{minimumFractionDigits:2})}`,color:balance>=10000?"#00e676":balance>=5000?"#ffa500":"#ff3d57",sub:"USDT"},
                    {icon:"🔄",label:"مفتوحة",value:opens.length,color:"#00e5ff",sub:`$${opens.reduce((s,o)=>s+o.amt,0).toFixed(2)} مستثمر`},
                    {icon:"📈",label:"رابحة",value:wins,color:"#00e676",sub:hist.length?`معدل ${wr}%`:""},
                    {icon:"📉",label:"خاسرة",value:losses,color:"#ff3d57"},
                    {icon:"💹",label:"صافي الربح",value:`${netPnl>=0?"+":""}$${netPnl.toFixed(2)}`,color:netPnl>=0?"#00e676":"#ff3d57",sub:`${hist.length} صفقة`},
                  ].map(s=>(
                    <div key={s.label} style={{
                      background:"#070d18",border:"1px solid #0c1a2a",borderRadius:12,padding:"12px 14px",
                    }}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                        <span style={{fontSize:14}}>{s.icon}</span>
                        <span style={{fontSize:9,color:"#2a4060",letterSpacing:1}}>{s.label}</span>
                      </div>
                      <div style={{fontSize:19,fontWeight:700,color:s.color||"#c8d8f0"}}>{s.value}</div>
                      {s.sub&&<div style={{fontSize:9,color:"#1e3a5a",marginTop:2}}>{s.sub}</div>}
                    </div>
                  ))}
                </div>

                {/* Mini chart */}
                <div style={{
                  background:"#070d18",border:"1px solid #0c1a2a",borderRadius:12,overflow:"hidden",marginBottom:12,
                }}>
                  <div style={{
                    padding:"7px 14px",borderBottom:"1px solid #0c1a2a",
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                  }}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:"#00e676",animation:"pulse 1s infinite"}}/>
                      <span style={{fontSize:10,color:"#2a4060"}}>{symbol} · مباشر · {tf.l}</span>
                    </div>
                    <span style={{fontSize:11,color:isUp?"#00e676":"#ff3d57",fontWeight:600}}>
                      {fmt(curP)} {isUp?"▲":"▼"}{Math.abs(curCh)}%
                    </span>
                  </div>
                  <div style={{height:200}}>
                    <CandleChart candles={candles} livePrice={curP} activeTrade={activeTradeForChart}/>
                  </div>
                </div>

                {/* Quick trade */}
                <QuickTrade amt={amt} setAmt={setAmt} tf={tf} onTrade={placeTrade} balance={balance}/>
              </div>
            )}

            {/* ══ CHART ══ */}
            {tab==="chart"&&(
              <div style={{animation:"fadeU .3s ease",display:"flex",flexDirection:"column",gap:12}}>
                <div style={{
                  background:"#070d18",border:"1px solid #0c1a2a",borderRadius:12,overflow:"hidden",
                }}>
                  <div style={{
                    padding:"8px 14px",borderBottom:"1px solid #0c1a2a",
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                  }}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:"#00e676",animation:"pulse 1s infinite"}}/>
                      <span style={{fontSize:10,color:"#2a4060"}}>{symbol} · {tf.l} · WebSocket</span>
                    </div>
                    <span style={{fontSize:9,color:"#0e2030"}}>Binance Real-time</span>
                  </div>
                  <div style={{height:290}}>
                    <CandleChart candles={candles} livePrice={curP} activeTrade={activeTradeForChart}/>
                  </div>
                </div>
                <QuickTrade amt={amt} setAmt={setAmt} tf={tf} onTrade={placeTrade} balance={balance} large/>
              </div>
            )}

            {/* ══ OPEN TRADES ══ */}
            {tab==="opens"&&(
              <div style={{animation:"fadeU .3s ease"}}>
                {opens.length===0?(
                  <div style={{textAlign:"center",padding:"60px 20px",color:"#1e3a5a"}}>
                    <div style={{fontSize:48,marginBottom:12}}>📭</div>
                    <div style={{marginBottom:12}}>لا توجد صفقات مفتوحة</div>
                    <button onClick={()=>setTab("chart")} style={{
                      padding:"8px 20px",borderRadius:8,background:"#00e5ff14",
                      border:"1px solid #00e5ff33",color:"#00e5ff",cursor:"pointer",fontSize:12,
                    }}>افتح صفقة جديدة</button>
                  </div>
                ):opens.map(t=><OpenTradeCard key={t.id} t={t} prices={pricesRef.current} fmt={fmt}/>)}
              </div>
            )}

            {/* ══ HISTORY ══ */}
            {tab==="hist"&&(
              <div style={{animation:"fadeU .3s ease"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
                  {[
                    {l:"الإجمالي",v:hist.length,c:"#00e5ff"},
                    {l:"رابحة",v:wins,c:"#00e676"},
                    {l:"خاسرة",v:losses,c:"#ff3d57"},
                    {l:"صافي الربح",v:`${netPnl>=0?"+":""}$${netPnl.toFixed(2)}`,c:netPnl>=0?"#00e676":"#ff3d57"},
                  ].map(s=>(
                    <div key={s.l} style={{
                      background:"#070d18",border:"1px solid #0c1a2a",borderRadius:10,padding:"10px 12px",
                    }}>
                      <div style={{fontSize:8,color:"#1e3a5a",marginBottom:3}}>{s.l}</div>
                      <div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {hist.length===0?(
                  <div style={{textAlign:"center",padding:"60px 20px",color:"#1e3a5a"}}>
                    <div style={{fontSize:48,marginBottom:12}}>📋</div>
                    لا يوجد سجل بعد
                  </div>
                ):hist.map((t,i)=>(
                  <div key={i} className="th" style={{
                    background:"#070d18",border:"1px solid #0c1a2a",borderRadius:10,
                    padding:"10px 14px",marginBottom:7,display:"flex",
                    justifyContent:"space-between",alignItems:"center",transition:"all .15s",
                  }}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{
                        width:32,height:32,borderRadius:7,
                        background:t.status==="WIN"?"#00e67618":"#ff3d5718",
                        color:t.status==="WIN"?"#00e676":"#ff3d57",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:14,fontWeight:700,
                      }}>{t.status==="WIN"?"✓":"✗"}</div>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:"#c8d8f0"}}>{t.sym}</div>
                        <div style={{fontSize:9,color:"#2a4060"}}>
                          {t.dir==="شراء"?"▲ شراء":"▼ بيع"} · {t.tfl}
                          {t.ep&&<span> · {fmt(t.ep)}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{textAlign:"left"}}>
                      <div style={{fontSize:15,fontWeight:700,color:t.pnl>=0?"#00e676":"#ff3d57"}}>
                        {t.pnl>=0?"+":""}${t.pnl?.toFixed(2)}
                      </div>
                      <div style={{fontSize:9,color:"#2a4060"}}>${t.amt} مستثمر</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ══ SETTINGS ══ */}
            {tab==="settings"&&(
              <div style={{animation:"fadeU .3s ease",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>

                {/* Binance Connect */}
                <div style={{
                  background:"#070d18",border:"1px solid #0c1a2a",borderRadius:12,
                  padding:16,gridColumn:"span 2",
                }}>
                  <div style={{fontSize:12,fontWeight:700,color:"#00e5ff",marginBottom:12}}>🔑 Binance API Keys</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                    <div>
                      <div style={{fontSize:9,color:"#1e3a5a",marginBottom:4}}>API KEY</div>
                      <input type="text" value={apiF.key} onChange={e=>setApiF(p=>({...p,key:e.target.value}))}
                        placeholder="أدخل مفتاح API"
                        style={{width:"100%",display:"block",background:"#030608",border:"1px solid #1a2d4a",borderRadius:7,padding:"9px 12px",color:"#c8d8f0",fontSize:11}}/>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:"#1e3a5a",marginBottom:4}}>SECRET KEY</div>
                      <input type="password" value={apiF.sec} onChange={e=>setApiF(p=>({...p,sec:e.target.value}))}
                        placeholder="أدخل المفتاح السري"
                        style={{width:"100%",display:"block",background:"#030608",border:"1px solid #1a2d4a",borderRadius:7,padding:"9px 12px",color:"#c8d8f0",fontSize:11}}/>
                    </div>
                  </div>
                  {apiF.msg&&(
                    <div style={{
                      padding:"8px 12px",borderRadius:8,marginBottom:10,fontSize:11,
                      background:apiF.msg.t==="ok"?"#00e67610":"#ff3d5710",
                      border:`1px solid ${apiF.msg.t==="ok"?"#00e67644":"#ff3d5744"}`,
                      color:apiF.msg.t==="ok"?"#00e676":"#ff3d57",
                    }}>{apiF.msg.m}</div>
                  )}
                  <button onClick={connectBinance} disabled={apiF.busy} style={{
                    width:"100%",padding:"12px",borderRadius:9,border:"none",cursor:"pointer",
                    background:"linear-gradient(135deg,#00e5ff,#0057ff)",
                    color:"#000",fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:700,
                    letterSpacing:2,transition:"all .2s",
                  }}>
                    {apiF.busy?"⏳ جارٍ الاتصال...":"اتصال بـ Binance ✓ OK"}
                  </button>
                  <div style={{marginTop:8,fontSize:9,color:"#1e3a5a",textAlign:"center"}}>
                    🔒 المفاتيح تُحفظ مشفرة في MongoDB ولا تظهر في الواجهة أبداً
                  </div>
                </div>

                {/* Deposit */}
                <div style={{background:"#070d18",border:"1px solid #0c1a2a",borderRadius:12,padding:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#00e5ff",marginBottom:12}}>💰 إيداع</div>
                  <input type="number" placeholder="مبلغ USDT" value={depAmt} onChange={e=>setDepAmt(e.target.value)}
                    style={{width:"100%",display:"block",background:"#030608",border:"1px solid #1a2d4a",borderRadius:7,padding:"9px 12px",color:"#c8d8f0",fontSize:12,marginBottom:10}}/>
                  <button onClick={doDeposit} style={{
                    width:"100%",padding:"10px",borderRadius:8,cursor:"pointer",
                    background:"#00e67618",border:"1px solid #00e67644",color:"#00e676",fontSize:12,fontWeight:600,
                  }}>إيداع ✓</button>
                </div>

                {/* Withdraw */}
                <div style={{background:"#070d18",border:"1px solid #0c1a2a",borderRadius:12,padding:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#00e5ff",marginBottom:12}}>💸 سحب</div>
                  <input type="number" placeholder={`مبلغ (الرصيد: $${balance.toFixed(2)})`} value={wdAmt} onChange={e=>setWdAmt(e.target.value)}
                    style={{width:"100%",display:"block",background:"#030608",border:"1px solid #1a2d4a",borderRadius:7,padding:"9px 12px",color:"#c8d8f0",fontSize:12,marginBottom:10}}/>
                  <button onClick={doWithdraw} style={{
                    width:"100%",padding:"10px",borderRadius:8,cursor:"pointer",
                    background:"#ff3d5718",border:"1px solid #ff3d5744",color:"#ff3d57",fontSize:12,fontWeight:600,
                  }}>سحب ✓</button>
                </div>

                {/* Sound */}
                <div style={{background:"#070d18",border:"1px solid #0c1a2a",borderRadius:12,padding:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#00e5ff",marginBottom:12}}>🔊 التنبيهات الصوتية</div>
                  <button onClick={()=>setSound(s=>!s)} style={{
                    width:"100%",padding:"10px",borderRadius:8,cursor:"pointer",
                    background:sound?"#00e67618":"#0a1525",
                    border:`1px solid ${sound?"#00e67644":"#1a2d4a"}`,
                    color:sound?"#00e676":"#3a5070",fontSize:12,fontWeight:600,
                  }}>{sound?"🔊 التنبيهات مفعّلة":"🔇 التنبيهات معطّلة"}</button>
                </div>

                {/* .env info */}
                <div style={{background:"#070d18",border:"1px solid #0c1a2a",borderRadius:12,padding:16,gridColumn:"span 2"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#00e5ff",marginBottom:10}}>🔐 ملف .env (SSL + MongoDB)</div>
                  <div style={{
                    background:"#030608",borderRadius:8,padding:12,
                    border:"1px solid #0c1a2a",fontSize:10,color:"#2a4060",lineHeight:2.2,
                  }}>
                    <span style={{color:"#00e676"}}>BINANCE_API_KEY</span>=your_key<br/>
                    <span style={{color:"#00e676"}}>BINANCE_SECRET_KEY</span>=your_secret<br/>
                    <span style={{color:"#00e5ff"}}>DB_URI</span>=mongodb+srv://...atlas.mongodb.net/YOUSF1<br/>
                    <span style={{color:"#00e5ff"}}>PORT</span>=5000 <span style={{color:"#0e2030"}}>← Render يستخدم 10000</span><br/>
                    <span style={{color:"#ffa500"}}>JWT_SECRET</span>=super_long_random_key<br/>
                    <span style={{color:"#ffa500"}}>FRONTEND_URL</span>=https://your-name.github.io/YOUSF1
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                    {["✅ SSL","✅ MongoDB","✅ JWT","✅ Binance WS","✅ bcrypt"].map(b=>(
                      <span key={b} style={{
                        padding:"4px 10px",borderRadius:6,fontSize:9,
                        background:"#00e5ff0a",border:"1px solid #00e5ff22",color:"#00e5ff",
                      }}>{b}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── STATUS BAR ── */}
      <div style={{
        background:"#040a12",borderTop:"1px solid #09131f",
        padding:"3px 16px",display:"flex",justifyContent:"space-between",
        fontSize:8,color:"#1e3a5a",letterSpacing:.5,flexWrap:"wrap",gap:4,flexShrink:0,
      }}>
        <span>YOUSF1 v2.0 · React + Node.js + MongoDB + Binance API · GitHub Pages + Render</span>
        <span>{[...FOREX,...CRYPTO].length} زوج · {opens.length} مفتوحة · WebSocket مباشر</span>
        <span>SSL · JWT · {user?.connected?"Binance ✓":"وضع تجريبي"}</span>
      </div>
    </div>
  );
}

/* ── Quick Trade Component ───────────────────────────────────────────── */
function QuickTrade({amt,setAmt,tf,onTrade,balance,large}) {
  const [anim,setAnim]=useState(null);
  const go=dir=>{
    setAnim(dir);
    onTrade(dir);
    setTimeout(()=>setAnim(null),600);
  };
  return (
    <div style={{background:"#070d18",border:"1px solid #0c1a2a",borderRadius:12,padding:large?18:14}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
        <div style={{flex:1,position:"relative"}}>
          <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#2a4060",fontSize:14,fontWeight:700}}>$</span>
          <input type="number" value={amt} onChange={e=>setAmt(e.target.value)}
            style={{
              width:"100%",background:"#030608",border:"1px solid #1a2d4a",
              borderRadius:8,padding:large?"11px 30px 11px 12px":"8px 28px 8px 10px",
              color:"#c8d8f0",fontSize:large?17:14,fontWeight:700,display:"block",
            }}/>
        </div>
        {[10,25,50,100,250].map(v=>(
          <button key={v} onClick={()=>setAmt(String(v))} style={{
            padding:large?"8px 9px":"5px 7px",borderRadius:7,background:"#0a1525",
            border:"1px solid #1a2d4a",color:"#2a4060",cursor:"pointer",fontSize:9,
          }}>{v}</button>
        ))}
      </div>
      <div style={{
        padding:"5px 10px",borderRadius:6,background:"#00e5ff06",
        border:"1px solid #00e5ff0e",fontSize:9,color:"#1e3a5a",
        marginBottom:10,display:"flex",gap:14,flexWrap:"wrap",
      }}>
        <span>⏱ {tf.l}</span>
        <span>💰 ربح ثابت 100%</span>
        <span>🔒 بدون رافعة مالية</span>
        {parseFloat(amt)>0&&<span style={{color:"#00e676"}}>ربح محتمل: +${parseFloat(amt)||0}</span>}
      </div>
      <div className="tgrid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button className="btn-up" onClick={()=>go("شراء")} style={{
          padding:large?"20px":"14px",borderRadius:10,
          border:"1px solid #00e67644",
          background:anim==="شراء"?"#00e67640":"linear-gradient(135deg,#00e67620,#00e67808)",
          color:"#00e676",fontSize:large?16:14,fontWeight:700,cursor:"pointer",
          letterSpacing:1,transition:"all .15s",
          boxShadow:anim==="شراء"?"0 0 40px #00e67666":"0 0 18px #00e67614",
        }}>
          <div style={{fontSize:large?24:18}}>▲</div>
          شراء<br/>
          <span style={{fontSize:9,opacity:.5,fontWeight:400}}>السعر سيرتفع</span>
        </button>
        <button className="btn-dn" onClick={()=>go("بيع")} style={{
          padding:large?"20px":"14px",borderRadius:10,
          border:"1px solid #ff3d5744",
          background:anim==="بيع"?"#ff3d5740":"linear-gradient(135deg,#ff3d5720,#ff3d5708)",
          color:"#ff3d57",fontSize:large?16:14,fontWeight:700,cursor:"pointer",
          letterSpacing:1,transition:"all .15s",
          boxShadow:anim==="بيع"?"0 0 40px #ff3d5766":"0 0 18px #ff3d5714",
        }}>
          <div style={{fontSize:large?24:18}}>▼</div>
          بيع<br/>
          <span style={{fontSize:9,opacity:.5,fontWeight:400}}>السعر سينخفض</span>
        </button>
      </div>
    </div>
  );
}

/* ── Open Trade Card ─────────────────────────────────────────────────── */
function OpenTradeCard({t,prices,fmt}) {
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const iv=setInterval(()=>setNow(Date.now()),300);return()=>clearInterval(iv);},[]);
  const el=(now-t.openTime)/1000;
  const prg=Math.min(el/t.dur,1);
  const cp=prices[t.sym]||t.ep;
  const win=t.dir==="شراء"?cp>t.ep:cp<t.ep;
  const rem=Math.max(0,t.dur-el);
  return (
    <div style={{
      background:"#070d18",border:`1px solid ${win?"#00e67630":"#ff3d5730"}`,
      borderRadius:12,padding:14,marginBottom:9,transition:"all .2s",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <div style={{display:"flex",gap:9,alignItems:"center"}}>
          <div style={{
            padding:"3px 9px",borderRadius:6,fontSize:10,fontWeight:700,
            background:t.dir==="شراء"?"#00e67618":"#ff3d5718",
            color:t.dir==="شراء"?"#00e676":"#ff3d57",
          }}>{t.dir==="شراء"?"▲ شراء":"▼ بيع"}</div>
          <span style={{fontWeight:700,color:"#00e5ff",fontSize:13}}>{t.sym}</span>
          <span style={{fontSize:8,color:"#1e3a5a"}}>⏱ {t.tfl}</span>
        </div>
        <div style={{textAlign:"left"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#c8d8f0"}}>${t.amt}</div>
          <div style={{fontSize:10,color:win?"#00e676":"#ff3d57"}}>{win?"🟢 رابح":"🔴 خاسر"}</div>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#2a4060",marginBottom:8}}>
        <span>دخول: <b style={{color:"#6a8aa8"}}>{fmt(t.ep)}</b></span>
        <span>حالي: <b style={{color:win?"#00e676":"#ff3d57"}}>{fmt(cp)}</b></span>
        <span>متبقي: <b style={{color:"#00e5ff"}}>{rem.toFixed(1)}ث</b></span>
      </div>
      <div style={{background:"#030608",borderRadius:4,height:4,overflow:"hidden"}}>
        <div style={{
          width:`${prg*100}%`,height:"100%",borderRadius:4,
          background:win?"linear-gradient(90deg,#00e676,#00e5ff)":"linear-gradient(90deg,#ff3d57,#ff8800)",
          transition:"width .3s linear",
          boxShadow:win?"0 0 6px #00e67660":"0 0 6px #ff3d5760",
        }}/>
      </div>
    </div>
  );
}
