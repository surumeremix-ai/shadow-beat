// Shadow Beat — game engine (v2).
// Flow per question: beat plays continuously → demo (TTS) plays twice, the
// ball hopping word-to-word exactly in time with the real speech (via
// TextToSpeech's onRangeStart callback) → the player's turn, where the ball
// hops each time the mic detects a clear voice onset → the onset timings are
// compared against the demo's real timings to score rhythm accuracy.

const PASS_LINE = 75;
const MAX_ATTEMPTS = 3;
const QUESTIONS_PER_GAME = 5;

const state = {
  track: null,
  ipaVisible: true,
  audioCtx: null,
  analyser: null,
  micReady: false,
  ampLog: [],
  metronomeHandle: null,
};

/* ---------------- settings ---------------- */

function loadSettings() {
  try { return JSON.parse(localStorage.getItem("sb_settings") || "{}"); }
  catch (e) { return {}; }
}
function saveSettings(s) { localStorage.setItem("sb_settings", JSON.stringify(s)); }

/* ---------------- microphone capture ---------------- */

async function checkMicPermission() {
  if (!window.Android || !window.Android.requestMicPermission) return "unavailable";
  if (window.Android.hasMicPermissionSync && window.Android.hasMicPermissionSync()) return "granted";
  await new Promise((resolve) => {
    window.onMicPermissionResult = () => resolve();
    window.Android.requestMicPermission();
  });
  return "asked";
}

async function startMicCapture() {
  if (state.micReady) return { ok: true };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { ok: false, error: "mediaDevices API unavailable in this WebView" };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    state.audioCtx = state.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const source = state.audioCtx.createMediaStreamSource(stream);
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 1024;
    source.connect(state.analyser);
    state.micReady = true;
    pollMic();
    return { ok: true };
  } catch (e) {
    console.warn("mic unavailable", e);
    return { ok: false, error: (e && e.name ? e.name : "Error") + ": " + (e && e.message ? e.message : String(e)) };
  }
}

function pollMic() {
  const buf = new Float32Array(state.analyser.fftSize);
  function tick() {
    if (!state.micReady) return;
    state.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now();
    state.ampLog.push({ t: now, rms });
    while (state.ampLog.length && now - state.ampLog[0].t > 4000) state.ampLog.shift();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function currentAmp() {
  const now = performance.now();
  let peak = 0;
  for (let i = state.ampLog.length - 1; i >= 0; i--) {
    const s = state.ampLog[i];
    if (now - s.t > 80) break;
    if (s.rms > peak) peak = s.rms;
  }
  return peak;
}

/* ---------------- sound effects & metronome (Web Audio synth, no assets needed) ---------------- */

function ensureAudioCtx() {
  state.audioCtx = state.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  return state.audioCtx;
}

function beepClick(strong) {
  const ctx = ensureAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = strong ? 1400 : 900;
  gain.gain.setValueAtTime(strong ? 0.18 : 0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

function startMetronome(bpm) {
  stopMetronome();
  const beatMs = 60000 / bpm;
  let beat = 0;
  beepClick(true);
  state.metronomeHandle = setInterval(() => {
    beat = (beat + 1) % 4;
    beepClick(beat === 0);
  }, beatMs);
}
function stopMetronome() {
  if (state.metronomeHandle) clearInterval(state.metronomeHandle);
  state.metronomeHandle = null;
}

function playSuccessChime() {
  const ctx = ensureAudioCtx();
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + i * 0.09;
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  });
}

function playFailBuzz() {
  const ctx = ensureAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

/* ---------------- Android speech bridge ---------------- */

function speakWithRangeTracking(text, onRange) {
  return new Promise((resolve) => {
    const id = "u" + Date.now() + Math.random();
    if (window.Android && window.Android.speak) {
      window.onSpeakRange = (uid, start, end) => {
        if (uid === id) onRange(start, end);
      };
      window.onSpeakDone = (uid) => {
        if (uid === id) resolve();
      };
      window.Android.speak(text, id);
    } else {
      resolve(); // desktop/browser fallback
    }
  });
}

function speak(text) {
  return speakWithRangeTracking(text, () => {});
}

function setBanner(show) {
  if (window.Android && window.Android.setBanner) window.Android.setBanner(show);
}
function showInterstitial(tag) {
  if (window.Android && window.Android.showInterstitial) window.Android.showInterstitial(tag);
}
function requestRescue(onGranted, onFailed) {
  if (window.Android && window.Android.showRewarded) {
    window.onAdRewarded = (tag) => { if (tag === "rescue") onGranted(); };
    window.onAdFailed = (tag) => { if (tag === "rescue") onFailed(); };
    window.Android.showRewarded("rescue");
  } else {
    onFailed();
  }
}

/* ---------------- word <-> line character-range matching ---------------- */

// Finds each stressed word's [start,end) position inside stage.line, in
// order, so a TTS onRangeStart(start,end) event during playback can be
// matched back to "which word is this".
function computeWordRanges(stage) {
  if (stage._ranges) return stage._ranges;
  const line = stage.line;
  const ranges = [];
  let cursor = 0;
  for (const word of stage.words) {
    let idx = line.indexOf(word.w, cursor);
    if (idx === -1) idx = line.toLowerCase().indexOf(word.w.toLowerCase(), cursor);
    if (idx === -1) idx = line.toLowerCase().indexOf(word.w.toLowerCase());
    if (idx === -1) { ranges.push(null); continue; }
    const end = idx + word.w.length;
    ranges.push({ start: idx, end });
    cursor = end;
  }
  stage._ranges = ranges;
  return ranges;
}

function findWordIndexForRange(stage, start, end) {
  const ranges = computeWordRanges(stage);
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (!r) continue;
    if (start < r.end && end > r.start) return i;
  }
  return -1;
}
