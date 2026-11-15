import React, { useState, useEffect, useRef } from "react";

/* localStorage 儲存層（取代 Claude 畫布的 window.storage） */
const store = {
  async get(k) { try { const v = localStorage.getItem(k); return v == null ? null : { value: v }; } catch (e) { return null; } },
  async set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } return { value: v }; },
};

/* ------------------------------------------------------------------ *
 *  伸展夥伴  ·  自訂間歇計時器
 *  針對：體態改善 / 馬拉松恢復 / 僵直性脊椎炎
 *  功能：簡易間歇計時、自訂課表（可儲存多組）、節拍音、語音報階段
 * ------------------------------------------------------------------ */

const THEME = { accent: "#38bdf8", soft: "rgba(56,189,248,0.14)", glow: "rgba(56,189,248,0.5)" };
const PHASE_LABEL = { train: "訓練", rest: "休息", cycleRest: "組間休息" };
const PHASE_COLOR = {
  train: { bg: "#8BE62B", fg: "#10210a" },
  rest: { bg: "#FF4747", fg: "#2a0000" },
  cycleRest: { bg: "#3b82f6", fg: "#071226" },
};
const BG = "#0c0f16", SURFACE = "#151a24", BORDER = "rgba(255,255,255,0.08)",
  TEXT = "#e7eaf0", MUTED = "#9aa3b5";

/* ---------- 內建課表範本（由原本的早晨喚醒／睡前放鬆伸展整理而成，動作名稱限5字） ---------- */
const BUILTIN_ROUTINES = [
  {
    id: 1, name: "🌅 早晨喚醒", groups: 1, groupRestSec: 0,
    steps: [
      { id: 1, name: "深呼吸", sec: 45 },
      { id: 2, name: "休息", sec: 5 },
      { id: 3, name: "單膝抱胸", sec: 30 },
      { id: 4, name: "單膝抱胸", sec: 30 },
      { id: 5, name: "休息", sec: 5 },
      { id: 6, name: "貓牛式", sec: 30 },
      { id: 7, name: "休息", sec: 5 },
      { id: 8, name: "人面獅身", sec: 25 },
      { id: 9, name: "休息", sec: 5 },
      { id: 10, name: "死蟲式", sec: 40 },
      { id: 11, name: "休息", sec: 5 },
      { id: 12, name: "鳥狗式", sec: 40 },
      { id: 13, name: "休息", sec: 5 },
      { id: 14, name: "後仰擴胸", sec: 30 },
    ],
  },
  {
    id: 2, name: "🌙 睡前放鬆", groups: 1, groupRestSec: 0,
    steps: [
      { id: 1, name: "弓箭髖屈", sec: 50 },
      { id: 2, name: "弓箭髖屈", sec: 50 },
      { id: 3, name: "休息", sec: 5 },
      { id: 4, name: "腿後肌", sec: 50 },
      { id: 5, name: "腿後肌", sec: 50 },
      { id: 6, name: "休息", sec: 5 },
      { id: 7, name: "梨狀肌", sec: 50 },
      { id: 8, name: "梨狀肌", sec: 50 },
      { id: 9, name: "休息", sec: 5 },
      { id: 10, name: "小腿", sec: 40 },
      { id: 11, name: "小腿", sec: 40 },
      { id: 12, name: "休息", sec: 5 },
      { id: 13, name: "開書式", sec: 40 },
      { id: 14, name: "休息", sec: 5 },
      { id: 15, name: "嬰兒延展", sec: 60 },
      { id: 16, name: "休息", sec: 5 },
      { id: 17, name: "仰躺扭轉", sec: 50 },
      { id: 18, name: "仰躺扭轉", sec: 50 },
      { id: 19, name: "休息", sec: 5 },
      { id: 20, name: "靠牆抬腿", sec: 150 },
    ],
  },
];

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
  const [days, setDays] = useState({});          // 每日「有完成」打勾（連續天數用）
  const [loaded, setLoaded] = useState(false);
  const theme = THEME;

  // 設定
  const [volume, setVolume] = useState(0.8);
  const lastVolumeRef = useRef(0.8);
  const [muteFallback, setMuteFallback] = useState(true); // 靜音時用語音唸「beep/數字」頂替蜂鳴聲
  const [speak, setSpeak] = useState(true);

  // 計時器（可自訂幾組、每組循環次數、訓練／休息／組間休息秒數）
  const [timerSets, setTimerSets] = useState(1);
  const [timerCycles, setTimerCycles] = useState(5);
  const [timerTrainSec, setTimerTrainSec] = useState(30);
  const [timerRestSec, setTimerRestSec] = useState(15);
  const [timerSetRestSec, setTimerSetRestSec] = useState(30);
  const [timerSession, setTimerSession] = useState(null); // { phases, idx, totalSets, cyclesPerSet }
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

  // 已儲存的自訂課表（含內建的早晨／睡前範本，可存好幾組，挑今天要用的）
  const [savedRoutines, setSavedRoutines] = useState(BUILTIN_ROUTINES);
  const [newRoutineName, setNewRoutineName] = useState("");
  const savedIdRef = useRef(3);

  const audioRef = useRef(null);
  const wakeLockRef = useRef(null);

  /* --- 載入 / 儲存 --- */
  useEffect(() => {
    (async () => {
      let pDays = {};
      try { const d = await store.get("sfc-days"); if (d && d.value) pDays = JSON.parse(d.value); } catch (e) { }
      setDays(pDays);
      try {
        const s = await store.get("sfc-settings");
        if (s && s.value) {
          const o = JSON.parse(s.value);
          if (typeof o.volume === "number") setVolume(o.volume);
          if (typeof o.muteFallback === "boolean") setMuteFallback(o.muteFallback);
          if (typeof o.speak === "boolean") setSpeak(o.speak);
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
      try {
        const sr = await store.get("sfc-saved-routines");
        if (sr && sr.value) {
          const arr = JSON.parse(sr.value);
          if (Array.isArray(arr)) { setSavedRoutines(arr); savedIdRef.current = Math.max(2, ...arr.map((r) => r.id || 0)) + 1; }
        }
      } catch (e) { }
      setLoaded(true);
    })();
    try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch (e) { }
  }, []);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-days", JSON.stringify(days)); } catch (e) { } })(); }, [days, loaded]);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-settings", JSON.stringify({ volume, muteFallback, speak })); } catch (e) { } })(); }, [volume, muteFallback, speak, loaded]);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-timer", JSON.stringify({ sets: timerSets, cycles: timerCycles, trainSec: timerTrainSec, restSec: timerRestSec, setRestSec: timerSetRestSec })); } catch (e) { } })(); }, [timerSets, timerCycles, timerTrainSec, timerRestSec, timerSetRestSec, loaded]);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-custom", JSON.stringify({ steps: customSteps, groups: customGroups, groupRestSec: customGroupRestSec })); } catch (e) { } })(); }, [customSteps, customGroups, customGroupRestSec, loaded]);
  useEffect(() => { if (!loaded) return; (async () => { try { await store.set("sfc-saved-routines", JSON.stringify(savedRoutines)); } catch (e) { } })(); }, [savedRoutines, loaded]);

  function markTodayDone() { setDays((p) => (p[todayStr()] ? p : { ...p, [todayStr()]: true })); }

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

  /* --- 螢幕常亮（進行中避免螢幕自動變暗／鎖定），不支援的瀏覽器會靜默略過 --- */
  async function requestWakeLock() {
    try { if ("wakeLock" in navigator) wakeLockRef.current = await navigator.wakeLock.request("screen"); } catch (e) { }
  }
  function releaseWakeLock() {
    try { wakeLockRef.current && wakeLockRef.current.release(); } catch (e) { }
    wakeLockRef.current = null;
  }
  // 切回分頁時若還在進行中，重新取得（背景時系統會自動釋放）
  useEffect(() => {
    function onVisible() { if (document.visibilityState === "visible" && timerSession) requestWakeLock(); }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [timerSession]); // eslint-disable-line

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
    requestWakeLock();
    const phases = buildTimerPhases(timerSets, timerCycles, timerTrainSec, timerRestSec, timerSetRestSec);
    if (!phases.length) return;
    setTimerFinished(false);
    setTimerSession({ phases, idx: 0, totalSets: timerSets, cyclesPerSet: timerCycles });
  }

  /* --- 自訂課表：動作清單（名稱最多5個字，含「休息」會自動標成休息色） --- */
  function addCustomStep() { setCustomSteps((p) => [...p, { id: customIdRef.current++, name: "", sec: 30 }]); }
  function updateCustomStep(id, patch) {
    if (typeof patch.name === "string") patch = { ...patch, name: patch.name.slice(0, 5) };
    setCustomSteps((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
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
    requestWakeLock();
    const phases = buildCustomPhases(customSteps, customGroups, customGroupRestSec);
    if (!phases.length) return;
    setTimerFinished(false);
    setTimerSession({ phases, idx: 0, totalSets: customGroups, cyclesPerSet: 1 });
  }

  /* --- 已儲存的自訂課表：存檔／套用／刪除 --- */
  function saveCurrentRoutine() {
    const name = newRoutineName.trim().slice(0, 20) || `課表 ${savedRoutines.length + 1}`;
    const id = savedIdRef.current++;
    setSavedRoutines((p) => [...p, { id, name, steps: customSteps, groups: customGroups, groupRestSec: customGroupRestSec }]);
    setNewRoutineName("");
  }
  function loadRoutine(r) {
    const steps = r.steps.map((s) => ({ ...s, id: customIdRef.current++ }));
    setCustomSteps(steps);
    setCustomGroups(r.groups);
    setCustomGroupRestSec(r.groupRestSec);
  }
  function deleteRoutine(id) { setSavedRoutines((p) => p.filter((r) => r.id !== id)); }

  function quitTimer() { stopSpeak(); releaseWakeLock(); setTimerSession(null); }
  function skipTimerPhase() {
    stopSpeak();
    setTimerSession((s) => {
      if (!s) return s;
      const next = s.idx + 1;
      if (next >= s.phases.length) { releaseWakeLock(); markTodayDone(); setTimerFinishedTotal(s.totalSets); setTimerFinished(true); return null; }
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
    say(ph.label); // 念出該階段內容（自訂課表會念動作名稱，簡易模式念「訓練/休息/組間休息」）
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
    if (timerRemaining <= 5) { tone(1480, 0.12, 0.5, "square"); vibrate(60); if (muteFallback) voiceBeep(String(timerRemaining), 1.15, 1.6); } // 最後 5 秒：高音＋震動（＋手機靜音時用語音唸數字頂替）
    else { tone(880, 0.09, 0.32, "sine"); if (muteFallback) voiceBeep("beep", 1.7, 2, "en-US"); } // 每秒蜂鳴（＋手機靜音時用語音唸 "beep" 頂替）
  }, [timerSession, timerPaused, timerRemaining, volume, muteFallback]); // eslint-disable-line

  /* --- 計時器：倒數到 0，推進到下一階段或結束 --- */
  useEffect(() => {
    if (!timerSession || timerRemaining !== 0) return;
    alertTone();
    vibrate([150, 80, 150]);
    const t = setTimeout(() => {
      setTimerSession((s) => {
        if (!s) return s;
        const next = s.idx + 1;
        if (next >= s.phases.length) { releaseWakeLock(); markTodayDone(); setTimerFinishedTotal(s.totalSets); setTimerFinished(true); return null; }
        return { ...s, idx: next };
      });
    }, 450);
    return () => clearTimeout(t);
  }, [timerRemaining]); // eslint-disable-line

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

          <div className="flex flex-1 flex-col items-center justify-center px-4">
            <div style={{ fontSize: "clamp(2.25rem, 17vw, 88px)", fontWeight: 900, letterSpacing: -1, lineHeight: 1.05, textAlign: "center", width: "100%", opacity: 0.9 }}>{ph.label}</div>
            <div style={{ fontSize: 112, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: -2, marginTop: 8 }}>{fmtClock(timerRemaining ?? 0)}</div>
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

  /* ---------------- 完成畫面 ---------------- */
  if (timerFinished) {
    return (
      <div style={{ background: BG, color: TEXT, minHeight: "100vh", fontFamily: "system-ui,-apple-system,'Noto Sans TC',sans-serif" }}>
        <div className="mx-auto flex flex-col items-center justify-center px-6" style={{ maxWidth: 520, minHeight: "100vh" }}>
          <div className="text-6xl">🎉</div>
          <h2 className="mt-4 text-2xl font-bold">完成啦！</h2>
          <p className="mt-2 text-center" style={{ color: MUTED }}>完成 {timerFinishedTotal} 組，做得好！</p>
          <div className="mt-6 rounded-2xl px-6 py-4 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="text-sm" style={{ color: MUTED }}>連續天數</div>
            <div className="text-4xl font-bold" style={{ color: theme.accent }}>{calcStreak(days)}</div>
          </div>
          <button onClick={() => setTimerFinished(false)} className="mt-8 rounded-xl px-6 py-3 font-semibold" style={{ background: theme.accent, color: "#0c0f16" }}>回到主畫面</button>
        </div>
      </div>
    );
  }

  /* ---------------- 主畫面 ---------------- */
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

        {/* 計時器模式 */}
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl p-1" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <button onClick={() => setTimerMode("simple")} className="rounded-lg py-2 text-sm font-semibold transition-all"
            style={timerMode === "simple" ? { background: theme.accent, color: "#0c0f16" } : { color: MUTED, background: "transparent" }}>簡易間歇</button>
          <button onClick={() => setTimerMode("custom")} className="rounded-lg py-2 text-sm font-semibold transition-all"
            style={timerMode === "custom" ? { background: theme.accent, color: "#0c0f16" } : { color: MUTED, background: "transparent" }}>自訂課表</button>
        </div>

        {/* 聲音設定 */}
        <div className="mt-4 rounded-2xl px-4 py-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: MUTED }}>念出提示詞</span>
            <Toggle on={speak} onClick={() => setSpeak((s) => !s)} labelOn="開" labelOff="關" accent={theme.accent} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="shrink-0 text-sm" style={{ color: MUTED }}>節拍音量</span>
            <VolumeSlider value={volume} onChange={setVolume} accent={theme.accent} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm">靜音時改用語音蜂鳴</div>
              <div className="mt-0.5 text-[11px] leading-relaxed" style={{ color: MUTED }}>手機沒開靜音時建議關閉，才不會跟電子嗶聲同時播放；手機開靜音才需要打開（網頁無法偵測靜音開關狀態，需自行切換）</div>
            </div>
            <Toggle on={muteFallback} onClick={() => setMuteFallback((v) => !v)} labelOn="開" labelOff="關" accent={theme.accent} />
          </div>
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
                      maxLength={5}
                      onChange={(e) => updateCustomStep(st.id, { name: e.target.value })}
                      placeholder="動作名稱（最多5字，含「休息」自動標紅）"
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

            {/* 已儲存的課表：含內建的早晨／睡前範本，可存好幾組，挑今天要的 */}
            <div className="mt-4 rounded-2xl px-4 py-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="mb-3 text-sm font-semibold">已儲存的課表</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newRoutineName}
                  onChange={(e) => setNewRoutineName(e.target.value)}
                  placeholder="課表名稱（例如：核心、全身）"
                  className="min-w-0 flex-1 rounded-lg px-2.5 py-2.5 text-sm"
                  style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "rgba(255,255,255,0.04)" }}
                />
                <button onClick={saveCurrentRoutine} className="shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold" style={{ background: theme.accent, color: "#0c0f16" }}>💾 存成新課表</button>
              </div>
              {savedRoutines.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {savedRoutines.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                      <span className="shrink-0 text-[11px]" style={{ color: MUTED }}>{r.steps.length} 動作・{r.groups} 組</span>
                      <button onClick={() => loadRoutine(r)} className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: theme.accent, color: "#0c0f16" }}>套用</button>
                      <button onClick={() => deleteRoutine(r.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm" style={{ color: MUTED, background: "rgba(255,255,255,0.05)" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={startCustomTimer} className="mt-4 w-full rounded-2xl px-5 py-4 text-lg font-black" style={{ background: theme.accent, color: "#0c0f16", boxShadow: `0 4px 16px ${theme.soft}` }}>▶ 開始課表</button>
          </>
        )}

        <div className="mt-5 rounded-2xl p-4 text-xs leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", border: `1px dashed ${BORDER}`, color: MUTED }}>
          <div className="mb-1 font-semibold" style={{ color: TEXT }}>安全提醒</div>
          溫和、規律勝過強度，拉到有伸展感即可、不拉到痛。發炎期（flare）降低強度，以呼吸與活動度為主，避免強力後仰與負重扭轉。個別狀況請與醫師或物理治療師確認。
        </div>
      </div>
    </div>
  );
}
