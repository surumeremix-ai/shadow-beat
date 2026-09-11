// Shadow Beat — game engine.
// One word is judged per bar (4 beats). The word appears one full bar before
// its judge time, falls toward the hit line, and is judged when the ball
// lands on beat 1 of the following bar. Scoring = timing accuracy (0-60)
// + loudness/clarity (0-40), out of 100 per word; stage score is the average.

const PASS_LINE = 75;
const MAX_ATTEMPTS = 3;

const state = {
  track: null,
  stageIndex: 0,
  attempt: 1,
  ipaVisible: true,
  audioCtx: null,
  analyser: null,
  micReady: false,
  ampLog: [], // {t, rms} rolling amplitude log, cleared each stage attempt
  runId: 0,
};

/* ---------------- persistence ---------------- */

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem("sb_progress") || "{}");
  } catch (e) {
    return {};
  }
}
function saveProgress(p) {
  localStorage.setItem("sb_progress", JSON.stringify(p));
}
function isStageUnlocked(track, idx) {
  if (idx === 0) return true;
  const p = loadProgress();
  return !!(p[track] && p[track][idx - 1]);
}
function markCleared(track, idx) {
  const p = loadProgress();
  p[track] = p[track] || {};
  p[track][idx] = true;
  saveProgress(p);
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem("sb_settings") || "{}");
  } catch (e) {
    return {};
  }
}
function saveSettings(s) {
  localStorage.setItem("sb_settings", JSON.stringify(s));
}

/* ---------------- microphone ---------------- */

// Returns "granted" | "asked" | "unavailable".
//  - "granted": Android permission was already on — caller should call
//    getUserMedia() itself, in the SAME synchronous click handler, so the
//    tap that triggered this call still counts as a user gesture for it.
//  - "asked": the system dialog was just shown; the player needs to tap
//    START again once they answer it (chaining straight into getUserMedia
//    here would no longer count as a user gesture, since a native modal
//    dialog appeared in between).
async function checkMicPermission() {
  if (!window.Android || !window.Android.requestMicPermission) return "unavailable";
  if (window.Android.hasMicPermissionSync && window.Android.hasMicPermissionSync()) {
    return "granted";
  }
  await new Promise((resolve) => {
    window.onMicPermissionResult = () => resolve();
    window.Android.requestMicPermission();
  });
  return "asked";
}

async function startMicCapture() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = state.audioCtx.createMediaStreamSource(stream);
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 1024;
    source.connect(state.analyser);
    state.micReady = true;
    pollMic();
    return true;
  } catch (e) {
    console.warn("mic unavailable", e);
    return false;
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
    // keep only the last 6 seconds
    while (state.ampLog.length && now - state.ampLog[0].t > 6000) state.ampLog.shift();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Find the loudest moment within +-450ms of judgeTime, for timing + loudness score.
function judgeWord(judgeTime) {
  const window_ = 450;
  let best = null;
  for (const s of state.ampLog) {
    if (Math.abs(s.t - judgeTime) <= window_) {
      if (!best || s.rms > best.rms) best = s;
    }
  }
  if (!best || best.rms < 0.01) {
    return { timingMs: null, rms: 0, points: 0, grade: "MISS" };
  }
  const offset = Math.abs(best.t - judgeTime);
  let timingPts;
  if (offset <= 120) timingPts = 60;
  else if (offset <= 250) timingPts = 40;
  else if (offset <= 450) timingPts = 20;
  else timingPts = 0;

  // loudness/clarity: map rms (roughly 0.01-0.35 useful range) to 0-40
  const clarity = Math.min(1, Math.max(0, (best.rms - 0.015) / 0.2));
  const loudPts = Math.round(clarity * 40);

  const points = timingPts + loudPts;
  let grade;
  if (points >= 85) grade = "PERFECT";
  else if (points >= 60) grade = "GOOD";
  else if (points >= 30) grade = "OK";
  else grade = "MISS";

  return { timingMs: Math.round(best.t - judgeTime), rms: best.rms, points, grade };
}

/* ---------------- Android bridge helpers ---------------- */

function speak(text) {
  return new Promise((resolve) => {
    const id = "u" + Date.now() + Math.random();
    if (window.Android && window.Android.speak) {
      window.onSpeakDone = (uid) => {
        if (uid === id) resolve();
      };
      window.Android.speak(text, id);
    } else {
      // desktop/browser fallback for testing
      resolve();
    }
  });
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
    onFailed(); // no ads available (e.g. desktop preview) — fail closed
  }
}
