import React, { useState, useEffect, useRef } from "react";

/* localStorage 儲存層（取代 Claude 畫布的 window.storage） */
const store = {
  async get(k) { try { const v = localStorage.getItem(k); return v == null ? null : { value: v }; } catch (e) { return null; } },
  async set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } return { value: v }; },
};

/* ------------------------------------------------------------------ *
 *  伸展夥伴  ·  早晚伸展計時與紀錄
 *  針對：體態改善 / 馬拉松恢復 / 僵直性脊椎炎
 *  功能：引導計時、節拍音、準備間隔、語音報動作、月曆自己打勾
 * ------------------------------------------------------------------ */

/* ---------- 動作線稿圖示（自繪 SVG，隨主題色變色） ---------- */
function Fig({ children }) {
  return (
    <svg viewBox="0 0 120 88" width="100%" height="100%" fill="none"
      stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="72" x2="112" y2="72" stroke="currentColor" strokeWidth="1.4" opacity="0.25" />
      {children}
    </svg>
  );
}
const H = (cx, cy, r = 6) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

const POSE = {
  breath: () => <Fig>{H(24, 65)}<path d="M30 65 H66" /><path d="M66 65 L80 48 L84 71" /><path d="M48 65 L54 57" /></Fig>,
  kneeChest: () => <Fig>{H(24, 65)}<path d="M30 65 H62" /><path d="M62 66 H98" /><path d="M62 66 L72 46 L62 52" /><path d="M52 64 L66 49" /></Fig>,
  catcow: () => <Fig>{H(36, 53, 6)}<path d="M44 42 Q61 27 78 42" /><path d="M44 42 L44 71" /><path d="M78 42 L78 71" /><path d="M44 42 L40 49" /></Fig>,
  sphinx: () => <Fig>{H(26, 47, 6)}<path d="M78 68 L108 70" /><path d="M78 68 L46 52" /><path d="M46 52 L44 70" /><path d="M44 70 L30 70" /><path d="M46 52 L32 48" /></Fig>,
  deadbug: () => <Fig>{H(28, 66)}<path d="M34 66 H66" /><path d="M50 66 L46 44" /><path d="M50 66 L64 44" /><path d="M66 66 L76 50 L92 50" /><path d="M66 66 L100 64" /></Fig>,
  birddog: () => <Fig>{H(34, 42, 5.5)}<path d="M46 44 H76" /><path d="M46 44 L44 71" /><path d="M76 44 L78 71" /><path d="M46 44 L20 40" /><path d="M76 44 L102 40" /></Fig>,
  backbend: () => <Fig>{H(69, 13)}<path d="M58 44 L54 71" /><path d="M58 44 L64 71" /><path d="M58 44 Q66 32 66 20" /><path d="M64 26 L56 40" /></Fig>,
  hipflexor: () => <Fig>{H(58, 15)}<path d="M40 71 L46 52" /><path d="M46 52 L62 46" /><path d="M62 46 L86 70 L100 71" /><path d="M62 46 L60 22" /><path d="M60 26 L52 40" /></Fig>,
  hamstring: () => <Fig>{H(24, 66)}<path d="M30 66 H60" /><path d="M60 66 L76 30" /><path d="M60 66 L96 68" /><path d="M52 66 L76 32" /></Fig>,
  figure4: () => <Fig>{H(24, 66)}<path d="M30 66 H60" /><path d="M60 66 L74 46" /><path d="M70 40 L84 56" /><path d="M52 64 L66 50" /><path d="M60 66 L96 68" /></Fig>,
  calf: () => (
    <Fig>
      <line x1="104" y1="28" x2="104" y2="72" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      {H(88, 23, 5.5)}<path d="M66 42 L56 71" /><path d="M66 42 L86 56 L92 71" /><path d="M66 42 L84 30" /><path d="M84 30 L100 34" />
    </Fig>
  ),
  openbook: () => <Fig>{H(32, 60, 6)}<path d="M40 60 L70 60" /><path d="M70 60 L82 50 L74 66" /><path d="M50 60 L34 62" /><path d="M46 58 Q54 34 74 40" /></Fig>,
  child: () => <Fig>{H(44, 68, 5.5)}<path d="M84 52 L50 66" /><path d="M50 66 L20 71" /><path d="M84 52 L98 70" /></Fig>,
  twist: () => <Fig>{H(26, 60)}<path d="M32 60 H62" /><path d="M38 60 L24 54" /><path d="M38 60 L52 54" /><path d="M62 60 L78 66 L70 72" /></Fig>,
  legswall: () => (
    <Fig>
      <line x1="84" y1="22" x2="84" y2="72" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      {H(24, 66)}<path d="M30 66 H66" /><path d="M66 66 L80 26" /><path d="M46 66 L40 60" />
    </Fig>
  ),
};

/* ---------- 課表資料 ---------- */
const ROUTINES = {
  morning: {
    label: "早晨喚醒", icon: "🌅", tag: "抗晨僵 · 活化核心",
    exercises: [
      { id: "m1", name: "仰躺深呼吸＋肋廓擴張", cue: "手放兩側肋骨，鼻子吸氣讓肋骨往兩側撐開。", pose: "breath", mode: "time", sec: 45, sides: 1 },
      { id: "m2", name: "單膝抱胸", cue: "抱單膝往胸口帶，另一腳放鬆，鬆開下背與髖。", pose: "kneeChest", mode: "time", sec: 30, sides: 2 },
      { id: "m3", name: "貓牛式", cue: "吸氣塌腰抬頭、吐氣拱背低頭，脊椎一節一節動。", pose: "catcow", mode: "reps", reps: "8 到 10 次" },
      { id: "m4", name: "人面獅身式", cue: "前臂撐地把胸口抬起、肩膀放鬆。脊椎伸展。", pose: "sphinx", mode: "time", sec: 25, sides: 1 },
      { id: "m5", name: "死蟲式", cue: "腰貼地不離開，對側手腳同時慢慢伸出去再收回。", pose: "deadbug", mode: "reps", reps: "每側 8 到 10 次" },
      { id: "m6", name: "鳥狗式", cue: "對側手腳伸直延伸，身體不歪不轉，停一下再換。", pose: "birddog", mode: "reps", reps: "每側 8 到 10 次" },
      { id: "m7", name: "站姿後仰＋擴胸", cue: "雙手扶腰輕輕後仰、打開胸口，把身體帶回挺直。", pose: "backbend", mode: "time", sec: 30, sides: 1 },
    ],
  },
  night: {
    label: "睡前放鬆", icon: "🌙", tag: "開胸 · 恢復 · 助眠",
    exercises: [
      { id: "n1", name: "跪姿弓箭步髖屈肌", cue: "後腳跪地、骨盆往前推，感覺大腿前側伸展。", pose: "hipflexor", mode: "time", sec: 50, sides: 2 },
      { id: "n2", name: "腿後肌伸展", cue: "仰躺用毛巾繞腳掌，腿伸直往上拉，膝蓋不鎖死。", pose: "hamstring", mode: "time", sec: 50, sides: 2 },
      { id: "n3", name: "梨狀肌伸展", cue: "腳踝跨到對側膝上，抱住大腿往身體帶。", pose: "figure4", mode: "time", sec: 50, sides: 2 },
      { id: "n4", name: "小腿伸展", cue: "前弓後箭，後腳跟踩地不離地。", pose: "calf", mode: "time", sec: 40, sides: 2 },
      { id: "n5", name: "開書式胸椎旋轉", cue: "側躺雙手前伸，上面的手畫大圈打開到另一側。", pose: "openbook", mode: "reps", reps: "每側 8 到 10 次" },
      { id: "n6", name: "嬰兒式＋側延展", cue: "臀部坐後腳跟、雙手往前延伸；再把手往左右各移一次。", pose: "child", mode: "time", sec: 60, sides: 1 },
      { id: "n7", name: "仰躺扭轉", cue: "雙膝倒向一側、肩膀盡量貼地，脊椎放鬆。", pose: "twist", mode: "time", sec: 50, sides: 2 },
      { id: "n8", name: "靠牆抬腿", cue: "臀部靠牆、雙腿沿牆往上，放鬆神經、幫助入睡。", pose: "legswall", mode: "time", sec: 150, sides: 1 },
    ],
  },
};

const THEME = {
  morning: { accent: "#f5a524", soft: "rgba(245,165,36,0.14)", glow: "rgba(245,165,36,0.5)" },
  night: { accent: "#8b93f7", soft: "rgba(139,147,247,0.16)", glow: "rgba(139,147,247,0.5)" },
};
const BG = "#0c0f16", SURFACE = "#151a24", BORDER = "rgba(255,255,255,0.08)",
  TEXT = "#e7eaf0", MUTED = "#9aa3b5";
const WD = ["日", "一", "二", "三", "四", "五", "六"];

/* ---------- 工具 ---------- */
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayStr = () => fmt(new Date());
function calcStreak(days) {
  let d = new Date();
  if (!days[fmt(d)]) d.setDate(d.getDate() - 1);
  let s = 0;
  while (days[fmt(d)]) { s++; d.setDate(d.getDate() - 1); }
  return s;
}
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/* ---------- 小元件 ---------- */
function Toggle({ on, onClick, labelOn, labelOff, accent }) {
  return (
    <button onClick={onClick} className="rounded-full px-3 py-1 text-xs font-medium transition-all"
      style={on ? { background: accent, color: "#0c0f16" } : { background: "rgba(255,255,255,0.06)", color: MUTED, border: `1px solid ${BORDER}` }}>
      {on ? labelOn : labelOff}
    </button>
  );
}

/* ================================================================== */
export default function App() {
  const [tab, setTab] = useState("morning");
  const [log, setLog] = useState({});           // 每日各動作打勾（今日清單用）
  const [days, setDays] = useState({});          // 每日「有做」打勾（月曆／連續天數用）
  const [loaded, setLoaded] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  // 設定
  const [sound, setSound] = useState(true);
  const [speak, setSpeak] = useState(true);
  const [restSec, setRestSec] = useState(2);
  const [autoCheck, setAutoCheck] = useState(false);

  // 引導狀態
  const [session, setSession] = useState(null); // {routine, idx, side}
  const [phase, setPhase] = useState("run");     // 'prep' | 'run' | 'done'
  const [prep, setPrep] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [paused, setPaused] = useState(false);
  const [flash, setFlash] = useState(null);
  const [finished, setFinished] = useState(null);

  const audioRef = useRef(null);
  const tickRef = useRef(null);
  const prepRef = useRef(null);
  const theme = THEME[tab];
  const curEx = session ? ROUTINES[session.routine].exercises[session.idx] : null;

  /* --- 載入 / 儲存 --- */
  useEffect(() => {
    (async () => {
      let pLog = {}, pDays = {};
      try { const r = await store.get("sfc-log"); if (r && r.value) pLog = JSON.parse(r.value); } catch (e) { }
      try { const d = await store.get("sfc-days"); if (d && d.value) pDays = JSON.parse(d.value); } catch (e) { }
      const derived = {};
      Object.keys(pLog).forEach((k) => { if ((pLog[k] || []).length) derived[k] = true; });
      setLog(pLog);
      setDays({ ...derived, ...pDays }); // 舊有動作紀錄自動轉成當日打勾
      try {
        const s = await store.get("sfc-settings");
        if (s && s.value) { const o = JSON.parse(s.value); if (typeof o.sound === "boolean") setSound(o.sound); if (typeof o.speak === "boolean") setSpeak(o.speak); if (typeof o.restSec === "number") setRestSec(o.restSec); if (typeof o.autoCheck === "boolean") setAutoCheck(o.autoCheck); }
      } catch (e) { }
      setLoaded(true);
    })();
    try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch (e) { }
  }, []);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-log", JSON.stringify(log)); } catch (e) { } })(); }, [log, loaded]);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-days", JSON.stringify(days)); } catch (e) { } })(); }, [days, loaded]);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-settings", JSON.stringify({ sound, speak, restSec, autoCheck })); } catch (e) { } })(); }, [sound, speak, restSec, autoCheck, loaded]);

  // 做了任一動作 → 今天自動打勾（不會自動取消，取消請點月曆）
  useEffect(() => {
    if (!loaded) return;
    const t = todayStr();
    if ((log[t] || []).length) setDays((p) => (p[t] ? p : { ...p, [t]: true }));
  }, [log, loaded]);

  const doneToday = new Set(log[todayStr()] || []);
  function toggle(id) { setLog((p) => { const t = todayStr(), day = new Set(p[t] || []); day.has(id) ? day.delete(id) : day.add(id); return { ...p, [t]: [...day] }; }); }
  function markDone(id) { setLog((p) => { const t = todayStr(), day = new Set(p[t] || []); day.add(id); return { ...p, [t]: [...day] }; }); }
  function toggleDay(key) { setDays((p) => { const n = { ...p }; if (n[key]) delete n[key]; else n[key] = true; return n; }); }

  /* --- 音效 --- */
  function tone(freq = 880, dur = 0.16, gain = 0.28, type = "sine") {
    if (!sound) return;
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.start(); o.stop(ctx.currentTime + dur + 0.03);
    } catch (e) { }
  }
  const beep = (f = 880, d = 0.18) => tone(f, d, 0.3, "sine");

  /* --- 語音 --- */
  function say(text) {
    if (!speak) return;
    try {
      const synth = window.speechSynthesis; if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-TW"; u.rate = 1.02;
      const vs = synth.getVoices();
      const zh = vs.find((v) => /zh[-_]?TW/i.test(v.lang)) || vs.find((v) => /zh[-_]?(HK|CN)/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang));
      if (zh) u.voice = zh;
      synth.speak(u);
    } catch (e) { }
  }
  const stopSpeak = () => { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { } };

  /* --- 進入新動作：準備階段 --- */
  useEffect(() => {
    if (!session || !curEx) return;
    setPaused(false); setFlash(null); tickRef.current = null; prepRef.current = null;
    say(`${curEx.name}。${curEx.cue}`);
    if (restSec > 0) { setPhase("prep"); setPrep(restSec); setRemaining(null); }
    else { setPhase("run"); setPrep(0); setRemaining(curEx.mode === "time" ? curEx.sec : null); }
  }, [session && session.routine, session && session.idx]); // eslint-disable-line

  /* --- 準備倒數 --- */
  useEffect(() => {
    if (!session || phase !== "prep" || paused) return;
    if (prep <= 0) {
      setPhase("run"); tone(980, 0.13, 0.3, "sine"); tickRef.current = null;
      setRemaining(curEx.mode === "time" ? curEx.sec : null);
      return;
    }
    if (prepRef.current !== prep) { prepRef.current = prep; tone(520, 0.05, 0.14, "triangle"); }
    const t = setTimeout(() => setPrep((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [session, phase, prep, paused, curEx]); // eslint-disable-line

  /* --- 動作計時 --- */
  useEffect(() => {
    if (!session || !curEx || curEx.mode !== "time" || phase !== "run") return;
    if (paused || flash || remaining === null || remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => (r === null ? r : r - 1)), 1000);
    return () => clearInterval(t);
  }, [session, curEx, phase, remaining, paused, flash]);

  /* --- 節拍音 --- */
  useEffect(() => {
    if (!session || !curEx || curEx.mode !== "time" || phase !== "run") return;
    if (paused || flash || remaining === null || remaining <= 0) return;
    if (tickRef.current === remaining) return;
    tickRef.current = remaining;
    if (remaining <= 3) tone(1320, 0.09, 0.32, "sine");
    else tone(720, 0.05, 0.18, "triangle");
  }, [session, curEx, phase, remaining, paused, flash, sound]); // eslint-disable-line

  /* --- 倒數到 0：換邊或完成 --- */
  useEffect(() => {
    if (!session || !curEx || curEx.mode !== "time" || phase !== "run" || remaining !== 0) return;
    if (curEx.sides === 2 && session.side === 1) {
      beep(700, 0.14); say("換邊，換另一側");
      setFlash("換邊");
      const t = setTimeout(() => { tickRef.current = null; setSession((s) => ({ ...s, side: 2 })); setRemaining(curEx.sec); setFlash(null); }, 1300);
      return () => clearTimeout(t);
    } else {
      beep(1046, 0.22);
      if (autoCheck) { markDone(curEx.id); setFlash("完成"); const t = setTimeout(advance, 950); return () => clearTimeout(t); }
      setPhase("done"); say("完成");
    }
  }, [remaining, phase, autoCheck]); // eslint-disable-line

  /* --- 流程控制 --- */
  function start(routine, idx = 0) {
    try { if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)(); if (audioRef.current.state === "suspended") audioRef.current.resume(); } catch (e) { }
    setFinished(null);
    setSession({ routine, idx, side: 1 });
  }
  function advance() {
    setSession((s) => {
      if (!s) return s;
      const list = ROUTINES[s.routine].exercises;
      if (s.idx + 1 < list.length) return { ...s, idx: s.idx + 1, side: 1 };
      setFinished(s.routine);
      return null;
    });
  }
  function repDone() { markDone(curEx.id); advance(); }
  function skip() { stopSpeak(); advance(); }
  function quit() { stopSpeak(); setSession(null); setFlash(null); }

  /* ---------------- 引導全螢幕 ---------------- */
  if (session && curEx) {
    const list = ROUTINES[session.routine].exercises;
    const Pose = POSE[curEx.pose];
    const isPrep = phase === "prep";
    const isDone = phase === "done";
    const showRing = isPrep || (phase === "run" && curEx.mode === "time");
    const R = 52, C = 2 * Math.PI * R;
    const total = isPrep ? Math.max(restSec, 1) : curEx.sec;
    const val = isPrep ? prep : remaining;
    const prog = showRing && val !== null ? val / total : 0;
    const sideLabel = curEx.sides === 2 ? (session.side === 1 ? "第一側" : "第二側") : null;

    return (
      <div style={{ background: BG, color: TEXT, minHeight: "100vh", fontFamily: "system-ui,-apple-system,'Noto Sans TC',sans-serif" }}>
        <div className="mx-auto flex flex-col items-center px-6 py-6" style={{ maxWidth: 520, minHeight: "100vh" }}>
          <div className="flex w-full items-center justify-between" style={{ color: MUTED }}>
            <span className="text-sm">{ROUTINES[session.routine].icon} {ROUTINES[session.routine].label}　{session.idx + 1} / {list.length}</span>
          </div>

          <div className="mt-2 h-1 w-full rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-1 rounded-full transition-all" style={{ width: `${(session.idx / list.length) * 100}%`, background: theme.accent }} />
          </div>

          <div className="mt-8 flex items-center justify-center" style={{ width: 220, height: 150, color: theme.accent, opacity: isPrep ? 0.55 : 1 }}><Pose /></div>

          <h2 className="mt-6 text-center text-xl font-semibold">{curEx.name}</h2>
          <p className="mt-2 text-center text-sm leading-relaxed" style={{ color: MUTED, maxWidth: 340 }}>{curEx.cue}</p>

          {isDone ? (
            <div className="mt-7 flex flex-col items-center justify-center" style={{ height: 220 }}>
              <div className="flex items-center justify-center rounded-full" style={{ width: 116, height: 116, background: theme.soft, color: theme.accent, fontSize: 54 }}>✓</div>
              <span className="mt-4 text-base" style={{ color: MUTED }}>做完了嗎？打勾記錄</span>
            </div>
          ) : showRing ? (
            <div className="relative mt-7 flex items-center justify-center" style={{ width: 220, height: 220 }}>
              <svg width="220" height="220" className="-rotate-90">
                <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                <circle cx="110" cy="110" r={R} fill="none" stroke={isPrep ? MUTED : theme.accent} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - prog)} style={{ transition: "stroke-dashoffset 1s linear", filter: isPrep ? "none" : `drop-shadow(0 0 6px ${theme.glow})` }} />
              </svg>
              <div className="absolute flex flex-col items-center">
                {flash ? (
                  <span className="text-3xl font-bold" style={{ color: theme.accent }}>{flash}</span>
                ) : isPrep ? (
                  <><span style={{ fontSize: 56, fontWeight: 700, lineHeight: 1, color: MUTED }}>{prep}</span><span className="mt-1 text-sm" style={{ color: MUTED }}>準備…</span></>
                ) : (
                  <><span style={{ fontSize: 52, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{fmtClock(remaining ?? 0)}</span>{sideLabel && <span className="mt-1 text-sm" style={{ color: MUTED }}>{sideLabel}</span>}</>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-col items-center">
              <span className="rounded-full px-4 py-1 text-base font-medium" style={{ background: theme.soft, color: theme.accent }}>{curEx.reps}</span>
              <span className="mt-3 text-xs" style={{ color: MUTED }}>次數動作 · 做完後打勾</span>
            </div>
          )}

          <div className="mt-auto flex w-full items-center justify-center gap-5 pt-8">
            <button onClick={() => setSpeak((s) => !s)} className="text-sm" style={{ color: speak ? theme.accent : MUTED }}>{speak ? "🗣 語音" : "🔇 語音"}</button>
            <button onClick={() => setSound((s) => !s)} className="text-sm" style={{ color: sound ? theme.accent : MUTED }}>{sound ? "🔊 節拍" : "🔈 節拍"}</button>
            <button onClick={quit} className="text-sm" style={{ color: MUTED }}>結束 ✕</button>
          </div>

          <div className="mt-4 flex w-full items-center justify-center gap-3 pb-2">
            <button onClick={skip} className="rounded-xl px-4 py-3 text-sm" style={{ background: SURFACE, color: MUTED, border: `1px solid ${BORDER}` }}>跳過</button>
            {isDone ? (
              <button onClick={() => { markDone(curEx.id); advance(); }} className="flex-1 rounded-xl px-4 py-3 text-base font-semibold" style={{ background: theme.accent, color: "#0c0f16" }}>✓ 打勾完成</button>
            ) : showRing ? (
              <button onClick={() => setPaused((p) => !p)} disabled={!!flash} className="flex-1 rounded-xl px-4 py-3 text-base font-semibold" style={{ background: theme.accent, color: "#0c0f16", opacity: flash ? 0.5 : 1 }}>{paused ? "▶ 繼續" : "❙❙ 暫停"}</button>
            ) : (
              <button onClick={repDone} className="flex-1 rounded-xl px-4 py-3 text-base font-semibold" style={{ background: theme.accent, color: "#0c0f16" }}>✓ 完成打勾</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- 完成畫面 ---------------- */
  if (finished) {
    const th = THEME[finished];
    return (
      <div style={{ background: BG, color: TEXT, minHeight: "100vh", fontFamily: "system-ui,-apple-system,'Noto Sans TC',sans-serif" }}>
        <div className="mx-auto flex flex-col items-center justify-center px-6" style={{ maxWidth: 520, minHeight: "100vh" }}>
          <div className="text-6xl">🎉</div>
          <h2 className="mt-4 text-2xl font-bold">{ROUTINES[finished].label}完成</h2>
          <p className="mt-2 text-center" style={{ color: MUTED }}>今天也照顧了脊椎跟雙腿。<br />規律比強度更重要 — 明天見。</p>
          <div className="mt-6 rounded-2xl px-6 py-4 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="text-sm" style={{ color: MUTED }}>連續天數</div>
            <div className="text-4xl font-bold" style={{ color: th.accent }}>{calcStreak(days)}</div>
          </div>
          <button onClick={() => setFinished(null)} className="mt-8 rounded-xl px-6 py-3 font-semibold" style={{ background: th.accent, color: "#0c0f16" }}>回到主畫面</button>
        </div>
      </div>
    );
  }

  /* ---------------- 主畫面 ---------------- */
  const routine = ROUTINES[tab];
  const doneCount = routine.exercises.filter((e) => doneToday.has(e.id)).length;
  const totalEx = routine.exercises.length;
  const streak = calcStreak(days);

  // 月曆
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
  const nowM = new Date(); const canNext = (y < nowM.getFullYear()) || (y === nowM.getFullYear() && m < nowM.getMonth());
  const monthDone = cells.filter((n) => n && days[fmt(new Date(y, m, n))]).length;

  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", fontFamily: "system-ui,-apple-system,'Noto Sans TC',sans-serif" }}>
      <div className="mx-auto px-5 pb-28 pt-6" style={{ maxWidth: 520 }}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">伸展夥伴</h1>
            <p className="mt-1 text-xs" style={{ color: MUTED }}>體態 · 馬拉松恢復 · 僵直性脊椎炎</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold" style={{ color: theme.accent }}>{streak}</div>
            <div className="text-xs" style={{ color: MUTED }}>連續天數</div>
          </div>
        </div>

        {/* 月曆：自己點日期打勾 */}
        <div className="mt-4 rounded-2xl p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <button onClick={() => setCalMonth(new Date(y, m - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg" style={{ color: MUTED, background: "rgba(255,255,255,0.05)" }}>‹</button>
            <span className="text-sm font-semibold">{y} 年 {m + 1} 月　<span style={{ color: MUTED, fontWeight: 400 }}>本月 {monthDone} 天</span></span>
            <button onClick={() => canNext && setCalMonth(new Date(y, m + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg" style={{ color: canNext ? MUTED : "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)" }}>›</button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {WD.map((w, i) => <div key={i} className="text-center text-[11px]" style={{ color: i === 0 || i === 6 ? theme.accent : MUTED }}>{w}</div>)}
            {cells.map((n, i) => {
              if (!n) return <div key={i} />;
              const dateObj = new Date(y, m, n);
              const key = fmt(dateObj);
              const done = !!days[key];
              const isToday = key === todayStr();
              const isFuture = dateObj > todayMid;
              return (
                <button key={i} disabled={isFuture} onClick={() => toggleDay(key)}
                  className="flex items-center justify-center rounded-lg text-sm transition-all"
                  style={{
                    aspectRatio: "1 / 1",
                    fontWeight: done ? 700 : 400,
                    background: done ? theme.accent : "rgba(255,255,255,0.04)",
                    color: done ? "#0c0f16" : (isFuture ? "rgba(255,255,255,0.18)" : TEXT),
                    border: isToday ? `1.5px solid ${done ? "#0c0f16" : theme.accent}` : "1.5px solid transparent",
                    boxShadow: done ? `0 0 8px ${theme.glow}` : "none",
                  }}>
                  {n}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-center text-[11px]" style={{ color: MUTED }}>點日期即可自己打勾／取消 · 做完動作會自動幫今天打勾</div>
        </div>

        {/* 分頁 */}
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl p-1" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          {["morning", "night"].map((k) => (
            <button key={k} onClick={() => setTab(k)} className="rounded-xl py-2.5 text-sm font-semibold transition-all"
              style={tab === k ? { background: THEME[k].accent, color: "#0c0f16" } : { color: MUTED, background: "transparent" }}>
              {ROUTINES[k].icon} {ROUTINES[k].label}
            </button>
          ))}
        </div>

        {/* 設定 */}
        <div className="mt-4 rounded-2xl px-4 py-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: MUTED }}>換動作間隔</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setRestSec((v) => Math.max(0, v - 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg" style={{ background: "rgba(255,255,255,0.06)", color: TEXT }}>−</button>
              <span className="w-14 text-center text-sm font-semibold">{restSec} 秒</span>
              <button onClick={() => setRestSec((v) => Math.min(10, v + 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg" style={{ background: "rgba(255,255,255,0.06)", color: TEXT }}>＋</button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm" style={{ color: MUTED }}>念出提示詞</span>
            <Toggle on={speak} onClick={() => setSpeak((s) => !s)} labelOn="開" labelOff="關" accent={theme.accent} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm" style={{ color: MUTED }}>節拍音</span>
            <Toggle on={sound} onClick={() => setSound((s) => !s)} labelOn="開" labelOff="關" accent={theme.accent} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm" style={{ color: MUTED }}>完成自動打勾</span>
            <Toggle on={autoCheck} onClick={() => setAutoCheck((v) => !v)} labelOn="開" labelOff="關" accent={theme.accent} />
          </div>
        </div>

        {/* 進度 + 開始 */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-sm" style={{ color: MUTED }}>{routine.tag}</div>
            <div className="mt-0.5 text-lg font-semibold">今日 {doneCount} / {totalEx} 完成</div>
          </div>
          <button onClick={() => start(tab, 0)} className="rounded-xl px-5 py-3 text-base font-bold" style={{ background: theme.accent, color: "#0c0f16", boxShadow: `0 4px 16px ${theme.soft}` }}>▶ 開始整組</button>
        </div>

        {/* 動作清單 */}
        <div className="mt-4 flex flex-col gap-2.5">
          {routine.exercises.map((ex, i) => {
            const Pose = POSE[ex.pose];
            const done = doneToday.has(ex.id);
            const meta = ex.mode === "time" ? `${ex.sec} 秒${ex.sides === 2 ? " · 左右各" : ""}` : ex.reps;
            return (
              <div key={ex.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: SURFACE, border: `1px solid ${done ? theme.accent : BORDER}` }}>
                <div className="flex shrink-0 items-center justify-center rounded-xl" style={{ width: 66, height: 50, background: theme.soft, color: theme.accent }}><Pose /></div>
                <div className="min-w-0 flex-1">
                  <span className="truncate text-[15px] font-semibold">{ex.name}</span>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug" style={{ color: MUTED }}>{ex.cue}</p>
                  <span className="mt-1 inline-block rounded-md px-2 py-0.5 text-[11px]" style={{ background: "rgba(255,255,255,0.05)", color: MUTED }}>{meta}</span>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <button onClick={() => start(tab, i)} title="從這個動作開始" className="flex h-9 w-9 items-center justify-center rounded-full text-sm" style={{ background: "rgba(255,255,255,0.06)", color: theme.accent }}>▶</button>
                  <button onClick={() => toggle(ex.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-base font-bold transition-all"
                    style={done ? { background: theme.accent, color: "#0c0f16" } : { background: "transparent", color: MUTED, border: `2px solid ${BORDER}` }}>✓</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl p-4 text-xs leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", border: `1px dashed ${BORDER}`, color: MUTED }}>
          <div className="mb-1 font-semibold" style={{ color: TEXT }}>安全提醒</div>
          溫和、規律勝過強度，拉到有伸展感即可、不拉到痛。發炎期（flare）降低強度，以呼吸與活動度為主，避免強力後仰與負重扭轉。個別狀況請與醫師或物理治療師確認。
        </div>
      </div>
    </div>
  );
}
