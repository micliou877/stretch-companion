import React, { useState, useEffect, useRef } from "react";

/* localStorage 儲存層（取代 Claude 畫布的 window.storage） */
const store = {
  async get(k) { try { const v = localStorage.getItem(k); return v == null ? null : { value: v }; } catch (e) { return null; } },
  async set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } return { value: v }; },
};

/* ------------------------------------------------------------------ *
 *  伸展夥伴  ·  早晚伸展計時與紀錄
 *  針對：體態改善 / 馬拉松恢復 / 僵直性脊椎炎
 *  功能：引導計時、節拍音、準備間隔、語音報動作、自訂間歇計時器
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
  timer: { accent: "#38bdf8", soft: "rgba(56,189,248,0.14)", glow: "rgba(56,189,248,0.5)" },
};
const TABS = [
  { key: "morning", icon: "🌅", label: "早晨" },
  { key: "night", icon: "🌙", label: "睡前" },
  { key: "timer", icon: "⏱️", label: "計時器" },
];
const PHASE_LABEL = { train: "訓練", rest: "休息", cycleRest: "組間休息" };
const PHASE_COLOR = {
  train: { bg: "#8BE62B", fg: "#10210a" },
  rest: { bg: "#FF4747", fg: "#2a0000" },
  cycleRest: { bg: "#3b82f6", fg: "#071226" },
};
const BG = "#0c0f16", SURFACE = "#151a24", BORDER = "rgba(255,255,255,0.08)",
  TEXT = "#e7eaf0", MUTED = "#9aa3b5";

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

function VolumeSlider({ value, onChange, accent, onMuteToggle, textColor = MUTED }) {
  const pct = Math.round(value * 100);
  const icon = pct <= 0 ? "🔈" : pct < 50 ? "🔉" : "🔊";
  return (
    <div className="flex flex-1 items-center gap-3">
      {onMuteToggle ? (
        <button onClick={onMuteToggle} style={{ fontSize: 20, color: textColor, lineHeight: 1 }}>{icon}</button>
      ) : (
        <span style={{ fontSize: 20, color: textColor }}>{icon}</span>
      )}
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="flex-1"
        style={{ accentColor: accent }}
      />
      <span className="w-10 shrink-0 text-right text-xs font-semibold" style={{ color: textColor }}>{pct}%</span>
    </div>
  );
}

function NumberField({ label, value, onChange, min = 0, max = 999, step = 5, suffix = "秒" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: MUTED }}>{label}</span>
      <div className="flex items-center gap-2.5">
        <button onClick={() => onChange(Math.max(min, value - step))} className="flex h-11 w-11 items-center justify-center rounded-full text-2xl font-bold" style={{ background: "rgba(255,255,255,0.06)", color: TEXT }}>−</button>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            if (digits === "") { onChange(min); return; }
            onChange(Math.min(max, Math.max(min, parseInt(digits, 10))));
          }}
          className="w-16 rounded-lg text-center text-base font-bold"
          style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "rgba(255,255,255,0.04)", padding: "6px 0" }}
        />
        <span className="w-6 text-xs" style={{ color: MUTED }}>{suffix}</span>
        <button onClick={() => onChange(Math.min(max, value + step))} className="flex h-11 w-11 items-center justify-center rounded-full text-2xl font-bold" style={{ background: "rgba(255,255,255,0.06)", color: TEXT }}>＋</button>
      </div>
    </div>
  );
}

/* ================================================================== */
export default function App() {
  const [tab, setTab] = useState("morning");
  const [log, setLog] = useState({});           // 每日各動作打勾（今日清單用）
  const [days, setDays] = useState({});          // 每日「有做」打勾（連續天數用）
  const [loaded, setLoaded] = useState(false);

  // 設定
  const [volume, setVolume] = useState(0.8);
  const lastVolumeRef = useRef(0.8);
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

  // 計時器（可自訂幾組、每組循環次數、訓練／休息／組間休息秒數）
  const [timerSets, setTimerSets] = useState(1);
  const [timerCycles, setTimerCycles] = useState(5);
  const [timerTrainSec, setTimerTrainSec] = useState(30);
  const [timerRestSec, setTimerRestSec] = useState(15);
  const [timerSetRestSec, setTimerSetRestSec] = useState(30);
  const [timerSession, setTimerSession] = useState(null); // { phases, idx, total }
  const [timerRemaining, setTimerRemaining] = useState(null);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [timerFinishedTotal, setTimerFinishedTotal] = useState(0);
  const timerTickRef = useRef(null);

  // 計時器模式：簡易間歇 / 自訂課表
  const [timerMode, setTimerMode] = useState("simple");
  const [customSteps, setCustomSteps] = useState([
    { id: 1, name: "開合跳", sec: 50 },
    { id: 2, name: "休息", sec: 30 },
    { id: 3, name: "高抬腿", sec: 35 },
    { id: 4, name: "休息", sec: 30 },
  ]);
  const [customGroups, setCustomGroups] = useState(3);
  const [customGroupRestSec, setCustomGroupRestSec] = useState(45);
  const customIdRef = useRef(5);

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
        if (s && s.value) {
          const o = JSON.parse(s.value);
          if (typeof o.volume === "number") setVolume(o.volume);
          else if (typeof o.sound === "boolean") setVolume(o.sound ? 0.8 : 0);
          if (typeof o.speak === "boolean") setSpeak(o.speak);
          if (typeof o.restSec === "number") setRestSec(o.restSec);
          if (typeof o.autoCheck === "boolean") setAutoCheck(o.autoCheck);
        }
      } catch (e) { }
      try {
        const t = await store.get("sfc-timer");
        if (t && t.value) {
          const o = JSON.parse(t.value);
          if (typeof o.sets === "number") setTimerSets(o.sets);
          if (typeof o.cycles === "number") setTimerCycles(o.cycles);
          if (typeof o.trainSec === "number") setTimerTrainSec(o.trainSec);
          if (typeof o.restSec === "number") setTimerRestSec(o.restSec);
          if (typeof o.setRestSec === "number") setTimerSetRestSec(o.setRestSec);
        }
      } catch (e) { }
      try {
        const c = await store.get("sfc-custom");
        if (c && c.value) {
          const o = JSON.parse(c.value);
          if (Array.isArray(o.steps) && o.steps.length) { setCustomSteps(o.steps); customIdRef.current = Math.max(...o.steps.map((s) => s.id || 0)) + 1; }
          if (typeof o.groups === "number") setCustomGroups(o.groups);
          if (typeof o.groupRestSec === "number") setCustomGroupRestSec(o.groupRestSec);
        }
      } catch (e) { }
      setLoaded(true);
    })();
    try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch (e) { }
  }, []);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-log", JSON.stringify(log)); } catch (e) { } })(); }, [log, loaded]);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-days", JSON.stringify(days)); } catch (e) { } })(); }, [days, loaded]);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-settings", JSON.stringify({ volume, speak, restSec, autoCheck })); } catch (e) { } })(); }, [volume, speak, restSec, autoCheck, loaded]);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-timer", JSON.stringify({ sets: timerSets, cycles: timerCycles, trainSec: timerTrainSec, restSec: timerRestSec, setRestSec: timerSetRestSec })); } catch (e) { } })(); }, [timerSets, timerCycles, timerTrainSec, timerRestSec, timerSetRestSec, loaded]);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-custom", JSON.stringify({ steps: customSteps, groups: customGroups, groupRestSec: customGroupRestSec })); } catch (e) { } })(); }, [customSteps, customGroups, customGroupRestSec, loaded]);

  // 做了任一動作 → 今天自動打勾
  useEffect(() => {
    if (!loaded) return;
    const t = todayStr();
    if ((log[t] || []).length) setDays((p) => (p[t] ? p : { ...p, [t]: true }));
  }, [log, loaded]);

  const doneToday = new Set(log[todayStr()] || []);
  function toggle(id) { setLog((p) => { const t = todayStr(), day = new Set(p[t] || []); day.has(id) ? day.delete(id) : day.add(id); return { ...p, [t]: [...day] }; }); }
  function markDone(id) { setLog((p) => { const t = todayStr(), day = new Set(p[t] || []); day.add(id); return { ...p, [t]: [...day] }; }); }

  /* --- 音效 --- */
  function tone(freq = 880, dur = 0.16, gain = 0.28, type = "sine") {
    if (volume <= 0) return;
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(gain * volume, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.start(); o.stop(ctx.currentTime + dur + 0.03);
    } catch (e) { }
  }
  const beep = (f = 880, d = 0.18) => tone(f, d, 0.3, "sine");
  // 震動提醒（不受手機靜音開關影響，iOS Safari 不支援此 API 會自動略過）
  function vibrate(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { } }
  // 較誇張的提示音（雙音、方波、音量加大），用於計時器階段切換
  function alertTone() { tone(880, 0.12, 0.55, "square"); setTimeout(() => tone(1320, 0.18, 0.55, "square"), 130); }
  // 快速靜音/取消靜音（記住上次音量，供全螢幕畫面的喇叭鈕使用）
  function toggleMute() {
    setVolume((v) => {
      if (v > 0) { lastVolumeRef.current = v; return 0; }
      return lastVolumeRef.current || 0.8;
    });
  }

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

  // 用語音合成出接近「蜂鳴聲」的聲音（不受「念出提示詞」開關影響，只看音量）
  // 語音合成只能唸「字」，沒辦法輸出純音，但拉高音調＋語速、改唸英文單字
  // "beep"（本身就是模擬電子嗶聲的擬聲詞），聽起來會比唸中文字更接近真的嗶聲。
  // iPhone 靜音開關只會讓 Web Audio／<audio> 靜音，但語音合成不受影響，靜音時也聽得到。
  function voiceBeep(text, rate = 1.3, pitch = 1, lang = "zh-TW") {
    if (volume <= 0) return;
    try {
      const synth = window.speechSynthesis; if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang; u.rate = rate; u.pitch = pitch; u.volume = 1;
      const vs = synth.getVoices();
      const wantEn = lang.startsWith("en");
      const voice = wantEn
        ? vs.find((v) => /^en/i.test(v.lang))
        : vs.find((v) => /zh[-_]?TW/i.test(v.lang)) || vs.find((v) => /zh[-_]?(HK|CN)/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang));
      if (voice) u.voice = voice;
      synth.speak(u);
    } catch (e) { }
  }

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
  }, [session, curEx, phase, remaining, paused, flash, volume]); // eslint-disable-line

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

  /* --- 計時器：產生階段序列（一組＝循環次數個「訓練→休息」，組間穿插較長休息） --- */
  function buildTimerPhases(sets, cyclesPerSet, trainSec, restSec, setRestSec) {
    const phases = [];
    for (let g = 0; g < sets; g++) {
      for (let i = 0; i < cyclesPerSet; i++) {
        phases.push({ type: "train", set: g + 1, cycle: i + 1, dur: trainSec, label: PHASE_LABEL.train });
        if (restSec > 0) phases.push({ type: "rest", set: g + 1, cycle: i + 1, dur: restSec, label: PHASE_LABEL.rest });
      }
      if (g < sets - 1 && setRestSec > 0) phases.push({ type: "cycleRest", set: g + 1, cycle: cyclesPerSet, dur: setRestSec, label: PHASE_LABEL.cycleRest });
    }
    return phases;
  }
  function startTimer() {
    try { if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)(); if (audioRef.current.state === "suspended") audioRef.current.resume(); } catch (e) { }
    const phases = buildTimerPhases(timerSets, timerCycles, timerTrainSec, timerRestSec, timerSetRestSec);
    if (!phases.length) return;
    setTimerFinished(false);
    setTimerSession({ phases, idx: 0, totalSets: timerSets, cyclesPerSet: timerCycles });
  }

  /* --- 自訂課表：動作清單（名稱含「休息」會自動標成休息色） --- */
  function addCustomStep() { setCustomSteps((p) => [...p, { id: customIdRef.current++, name: "", sec: 30 }]); }
  function updateCustomStep(id, patch) { setCustomSteps((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s))); }
  function removeCustomStep(id) { setCustomSteps((p) => p.filter((s) => s.id !== id)); }
  function buildCustomPhases(steps, groups, groupRestSec) {
    const valid = steps.filter((s) => s.name.trim() && s.sec > 0);
    const phases = [];
    for (let g = 0; g < groups; g++) {
      valid.forEach((st) => phases.push({ type: /休息/.test(st.name) ? "rest" : "train", set: g + 1, cycle: 1, dur: st.sec, label: st.name }));
      if (g < groups - 1 && groupRestSec > 0) phases.push({ type: "cycleRest", set: g + 1, cycle: 1, dur: groupRestSec, label: "組間休息" });
    }
    return phases;
  }
  function startCustomTimer() {
    try { if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)(); if (audioRef.current.state === "suspended") audioRef.current.resume(); } catch (e) { }
    const phases = buildCustomPhases(customSteps, customGroups, customGroupRestSec);
    if (!phases.length) return;
    setTimerFinished(false);
    setTimerSession({ phases, idx: 0, totalSets: customGroups, cyclesPerSet: 1 });
  }

  function quitTimer() { stopSpeak(); setTimerSession(null); }
  function skipTimerPhase() {
    stopSpeak();
    setTimerSession((s) => {
      if (!s) return s;
      const next = s.idx + 1;
      if (next >= s.phases.length) { setTimerFinishedTotal(s.totalSets); setTimerFinished(true); return null; }
      return { ...s, idx: next };
    });
  }

  /* --- 計時器：進入新階段 --- */
  useEffect(() => {
    if (!timerSession) return;
    const ph = timerSession.phases[timerSession.idx];
    if (!ph) return;
    setTimerPaused(false);
    timerTickRef.current = null;
    setTimerRemaining(ph.dur);
    alertTone();
    vibrate(ph.type === "train" ? [120, 60, 120] : [250]);
    say(ph.type === "train" ? "開始訓練" : ph.type === "rest" ? "休息" : "組間休息");
  }, [timerSession && timerSession.idx, !!timerSession]); // eslint-disable-line

  /* --- 計時器：倒數 --- */
  useEffect(() => {
    if (!timerSession || timerPaused || timerRemaining === null || timerRemaining <= 0) return;
    const t = setInterval(() => setTimerRemaining((r) => (r === null ? r : r - 1)), 1000);
    return () => clearInterval(t);
  }, [timerSession, timerPaused, timerRemaining]);

  /* --- 計時器：節拍音 --- */
  useEffect(() => {
    if (!timerSession || timerPaused || timerRemaining === null || timerRemaining <= 0) return;
    if (timerTickRef.current === timerRemaining) return;
    timerTickRef.current = timerRemaining;
    const ph = timerSession.phases[timerSession.idx];
    if (ph && timerRemaining === ph.dur) return; // 階段剛開始那一刻已經有「開始訓練／休息」語音，跳過避免打斷
    if (timerRemaining <= 5) { tone(1480, 0.12, 0.5, "square"); vibrate(60); voiceBeep(String(timerRemaining), 1.15, 1.6); } // 最後 5 秒：高音＋震動＋唸數字，靜音時也聽得到
    else { tone(880, 0.09, 0.32, "sine"); voiceBeep("beep", 1.7, 2, "en-US"); } // 每秒蜂鳴＋語音唸 "beep"（拉高音調／語速，更接近嗶聲），靜音時也聽得到
  }, [timerSession, timerPaused, timerRemaining, volume]); // eslint-disable-line

  /* --- 計時器：倒數到 0，推進到下一階段或結束 --- */
  useEffect(() => {
    if (!timerSession || timerRemaining !== 0) return;
    alertTone();
    vibrate([150, 80, 150]);
    const t = setTimeout(() => {
      setTimerSession((s) => {
        if (!s) return s;
        const next = s.idx + 1;
        if (next >= s.phases.length) { setTimerFinishedTotal(s.totalSets); setTimerFinished(true); return null; }
        return { ...s, idx: next };
      });
    }, 450);
    return () => clearTimeout(t);
  }, [timerRemaining]); // eslint-disable-line

  /* ---------------- 引導全螢幕（伸展動作） ---------------- */
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

          <div className="mt-auto flex w-full items-center justify-between gap-4 pt-8">
            <button onClick={() => setSpeak((s) => !s)} className="shrink-0 text-sm" style={{ color: speak ? theme.accent : MUTED }}>{speak ? "🗣 語音" : "🔇 語音"}</button>
            <div style={{ width: 150 }}><VolumeSlider value={volume} onChange={setVolume} onMuteToggle={toggleMute} accent={theme.accent} /></div>
            <button onClick={quit} className="shrink-0 text-sm" style={{ color: MUTED }}>結束 ✕</button>
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

  /* ---------------- 完成畫面（伸展） ---------------- */
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

  /* ---------------- 計時器全螢幕（大色塊 + 大按鈕） ---------------- */
  if (timerSession) {
    const ph = timerSession.phases[timerSession.idx];
    const nextPh = timerSession.phases[timerSession.idx + 1] || null;
    const pc = PHASE_COLOR[ph.type];
    const setsLeft = timerSession.totalSets - ph.set + 1;

    return (
      <div style={{ background: pc.bg, color: pc.fg, minHeight: "100vh", fontFamily: "system-ui,-apple-system,'Noto Sans TC',sans-serif", transition: "background 0.3s" }}>
        <div className="mx-auto flex flex-col" style={{ maxWidth: 520, minHeight: "100vh" }}>
          <div className="flex items-center justify-between px-5" style={{ paddingTop: "calc(22px + env(safe-area-inset-top, 0px))" }}>
            <span className="text-base font-bold" style={{ opacity: 0.8 }}>
              第 {ph.set} / {timerSession.totalSets} 組
              {timerSession.cyclesPerSet > 1 && <>　循環 {ph.cycle} / {timerSession.cyclesPerSet}</>}
            </span>
            <button onClick={quitTimer} className="flex h-11 w-11 items-center justify-center rounded-full text-2xl font-bold" style={{ background: "rgba(0,0,0,0.15)" }}>✕</button>
          </div>

          <div className="flex items-center px-5 pt-3">
            <VolumeSlider value={volume} onChange={setVolume} onMuteToggle={toggleMute} accent={pc.fg} textColor={pc.fg} />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-6">
            <div className="text-3xl font-black tracking-widest" style={{ opacity: 0.85 }}>{ph.label}</div>
            <div style={{ fontSize: 112, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: -2 }}>{fmtClock(timerRemaining ?? 0)}</div>
          </div>

          {nextPh && (
            <div className="flex items-center justify-center py-4" style={{ background: PHASE_COLOR[nextPh.type].bg, color: PHASE_COLOR[nextPh.type].fg }}>
              <span className="text-lg font-bold tracking-wide">接下來：{nextPh.label}　{fmtClock(nextPh.dur)}</span>
            </div>
          )}

          <div className="flex items-center justify-between px-6 py-7" style={{ background: "rgba(0,0,0,0.12)" }}>
            <div className="flex flex-col items-center" style={{ width: 80 }}>
              <span className="text-5xl font-black">{setsLeft}</span>
              <span className="text-sm font-bold" style={{ opacity: 0.75 }}>組剩餘</span>
            </div>
            <button onClick={() => setTimerPaused((p) => !p)} className="flex items-center justify-center rounded-full text-4xl font-bold"
              style={{ width: 104, height: 104, background: pc.fg, color: pc.bg, boxShadow: "0 6px 20px rgba(0,0,0,0.3)" }}>
              {timerPaused ? "▶" : "❙❙"}
            </button>
            <button onClick={skipTimerPhase} className="flex flex-col items-center" style={{ width: 80 }}>
              <span className="text-4xl font-black">⏭</span>
              <span className="text-sm font-bold" style={{ opacity: 0.75 }}>跳過</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- 完成畫面（計時器） ---------------- */
  if (timerFinished) {
    const th = THEME.timer;
    return (
      <div style={{ background: BG, color: TEXT, minHeight: "100vh", fontFamily: "system-ui,-apple-system,'Noto Sans TC',sans-serif" }}>
        <div className="mx-auto flex flex-col items-center justify-center px-6" style={{ maxWidth: 520, minHeight: "100vh" }}>
          <div className="text-6xl">⏱️</div>
          <h2 className="mt-4 text-2xl font-bold">計時結束</h2>
          <p className="mt-2 text-center" style={{ color: MUTED }}>完成 {timerFinishedTotal} 組，做得好！</p>
          <button onClick={() => setTimerFinished(false)} className="mt-8 rounded-xl px-6 py-3 font-semibold" style={{ background: th.accent, color: "#0c0f16" }}>回到主畫面</button>
        </div>
      </div>
    );
  }

  /* ---------------- 主畫面 ---------------- */
  const routine = ROUTINES[tab]; // 計時器分頁沒有對應的 routine
  const doneCount = routine ? routine.exercises.filter((e) => doneToday.has(e.id)).length : 0;
  const totalEx = routine ? routine.exercises.length : 0;
  const streak = calcStreak(days);
  const timerTotalSec = timerSets * (timerCycles * timerTrainSec + timerCycles * timerRestSec) + Math.max(0, timerSets - 1) * timerSetRestSec;
  const customStepsSec = customSteps.filter((s) => s.sec > 0).reduce((a, s) => a + s.sec, 0);
  const customTotalSec = customStepsSec * customGroups + Math.max(0, customGroups - 1) * customGroupRestSec;

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

        {/* 分頁 */}
        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl p-1" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="rounded-xl py-2.5 text-sm font-semibold transition-all"
              style={tab === t.key ? { background: THEME[t.key].accent, color: "#0c0f16" } : { color: MUTED, background: "transparent" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "timer" ? (
          <>
            {/* 計時器模式 */}
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl p-1" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <button onClick={() => setTimerMode("simple")} className="rounded-lg py-2 text-sm font-semibold transition-all"
                style={timerMode === "simple" ? { background: theme.accent, color: "#0c0f16" } : { color: MUTED, background: "transparent" }}>簡易間歇</button>
              <button onClick={() => setTimerMode("custom")} className="rounded-lg py-2 text-sm font-semibold transition-all"
                style={timerMode === "custom" ? { background: theme.accent, color: "#0c0f16" } : { color: MUTED, background: "transparent" }}>自訂課表</button>
            </div>

            {timerMode === "simple" ? (
              <>
                {/* 簡易間歇設定 */}
                <div className="mt-4 rounded-2xl px-4 py-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                  <div className="mb-3 text-sm font-semibold">計時器設定</div>
                  <div className="flex flex-col gap-3">
                    <NumberField label="組數" value={timerSets} onChange={setTimerSets} min={1} max={50} step={1} suffix="組" />
                    <NumberField label="循環次數" value={timerCycles} onChange={setTimerCycles} min={1} max={50} step={1} suffix="輪" />
                    <NumberField label="訓練時間" value={timerTrainSec} onChange={setTimerTrainSec} min={5} max={1800} step={5} suffix="秒" />
                    <NumberField label="休息時間" value={timerRestSec} onChange={setTimerRestSec} min={0} max={600} step={5} suffix="秒" />
                    <NumberField label="組間休息" value={timerSetRestSec} onChange={setTimerSetRestSec} min={0} max={600} step={5} suffix="秒" />
                  </div>
                  <div className="mt-3 text-center text-[11px]" style={{ color: MUTED }}>預計總時長　{fmtClock(timerTotalSec)}</div>
                </div>

                <button onClick={startTimer} className="mt-4 w-full rounded-2xl px-5 py-4 text-lg font-black" style={{ background: theme.accent, color: "#0c0f16", boxShadow: `0 4px 16px ${theme.soft}` }}>▶ 開始計時</button>
              </>
            ) : (
              <>
                {/* 自訂課表 */}
                <div className="mt-4 rounded-2xl px-4 py-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                  <div className="mb-3 text-sm font-semibold">自訂課表</div>
                  <div className="flex flex-col gap-2">
                    {customSteps.map((st, i) => (
                      <div key={st.id} className="flex items-center gap-2">
                        <span className="w-4 shrink-0 text-xs" style={{ color: MUTED }}>{i + 1}</span>
                        <input
                          type="text"
                          value={st.name}
                          onChange={(e) => updateCustomStep(st.id, { name: e.target.value })}
                          placeholder="動作名稱（含「休息」自動標紅）"
                          className="min-w-0 flex-1 rounded-lg px-2.5 py-2.5 text-sm"
                          style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "rgba(255,255,255,0.04)" }}
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={st.sec}
                          onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ""); updateCustomStep(st.id, { sec: d === "" ? 0 : Math.min(3600, parseInt(d, 10)) }); }}
                          className="w-14 shrink-0 rounded-lg text-center text-sm font-bold"
                          style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "rgba(255,255,255,0.04)", padding: "8px 0" }}
                        />
                        <span className="shrink-0 text-xs" style={{ color: MUTED }}>秒</span>
                        <button onClick={() => removeCustomStep(st.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg" style={{ color: MUTED, background: "rgba(255,255,255,0.05)" }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addCustomStep} className="mt-3 w-full rounded-lg py-3 text-sm font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: theme.accent }}>＋ 新增動作</button>

                  <div className="mt-4 flex flex-col gap-3 border-t pt-3" style={{ borderColor: BORDER }}>
                    <NumberField label="循環組數" value={customGroups} onChange={setCustomGroups} min={1} max={50} step={1} suffix="組" />
                    <NumberField label="組間休息" value={customGroupRestSec} onChange={setCustomGroupRestSec} min={0} max={600} step={5} suffix="秒" />
                  </div>
                  <div className="mt-3 text-center text-[11px]" style={{ color: MUTED }}>預計總時長　{fmtClock(customTotalSec)}</div>
                </div>

                <button onClick={startCustomTimer} className="mt-4 w-full rounded-2xl px-5 py-4 text-lg font-black" style={{ background: theme.accent, color: "#0c0f16", boxShadow: `0 4px 16px ${theme.soft}` }}>▶ 開始課表</button>
              </>
            )}
          </>
        ) : (
          <>
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
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="shrink-0 text-sm" style={{ color: MUTED }}>節拍音量</span>
                <VolumeSlider value={volume} onChange={setVolume} accent={theme.accent} />
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
          </>
        )}
      </div>
    </div>
  );
}
