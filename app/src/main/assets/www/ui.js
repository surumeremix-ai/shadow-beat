// Shadow Beat — screen flow (v2): title → track select → session of 5
// questions (demo x2, then the player's turn) → session result.

const app = document.getElementById("app");

function show(html) { app.innerHTML = html; }
function el(id) { return document.getElementById(id); }

/* ---------------- title screen ---------------- */

function screenTitle() {
  setBanner(false);
  stopMetronome();
  show(`
    <div class="screen title-screen">
      <div class="logo">SHADOW<span class="accent">BEAT</span></div>
      <div class="subtitle">英語シャドーイング × リズムゲーム</div>
      <button class="btn-neon" id="btnStart">TAP TO START</button>
      <button class="btn-ghost" id="btnSettings">⚙ 設定</button>
    </div>
  `);
  el("btnStart").onclick = () => screenTracks();
  el("btnSettings").onclick = () => screenSettings();
}

/* ---------------- settings ---------------- */

function screenSettings() {
  const s = loadSettings();
  const ipaOn = s.ipaVisible !== false;
  show(`
    <div class="screen settings-screen">
      <h2>設定</h2>
      <label class="toggle-row">
        <span>発音記号 (IPA) を表示</span>
        <input type="checkbox" id="chkIpa" ${ipaOn ? "checked" : ""}/>
      </label>
      <button class="btn-ghost" id="btnVoice">🔊 読み上げの声を選ぶ</button>
      <button class="btn-ghost" id="btnDownloadVoice">⬇ 音声データをダウンロード</button>
      <button class="btn-neon" id="btnBack">戻る</button>
    </div>
  `);
  el("chkIpa").onchange = (e) => {
    const s2 = loadSettings();
    s2.ipaVisible = e.target.checked;
    saveSettings(s2);
    state.ipaVisible = e.target.checked;
  };
  el("btnVoice").onclick = () => screenVoicePicker();
  el("btnDownloadVoice").onclick = () => {
    if (window.Android && window.Android.openVoiceDownload) window.Android.openVoiceDownload();
    else alert("この画面はアプリ内でのみ使えます。");
  };
  el("btnBack").onclick = () => screenTitle();
}

function screenVoicePicker() {
  let voices = [];
  try {
    voices = window.Android && window.Android.listVoices ? JSON.parse(window.Android.listVoices()) : [];
  } catch (e) { voices = []; }
  const rows = voices.length
    ? voices.map((v) => `
        <button class="voice-item ${v.current ? "selected" : ""}" data-name="${v.name}">
          <span class="voice-name">${v.name}</span>
          <span class="voice-quality">${v.quality}${v.network ? " ・ 通信要" : ""}</span>
          ${v.current ? '<span class="voice-check">✓</span>' : ""}
        </button>`).join("")
    : `<p class="hint">端末にイギリス英語の音声が見つかりませんでした。<br>「音声データをダウンロード」から追加してください。</p>`;
  show(`
    <div class="screen voice-screen">
      <h2>読み上げの声を選ぶ</h2>
      <div class="voice-list">${rows}</div>
      <button class="btn-ghost" id="btnBack">設定に戻る</button>
    </div>
  `);
  app.querySelectorAll(".voice-item").forEach((btn) => {
    btn.onclick = () => {
      if (window.Android && window.Android.setVoiceByName) window.Android.setVoiceByName(btn.dataset.name);
      speak("This is a sample of this voice.");
      screenVoicePicker();
    };
  });
  el("btnBack").onclick = () => screenSettings();
}

/* ---------------- track select ---------------- */

function screenTracks() {
  setBanner(true);
  const cards = Object.keys(TRACKS).map((key) => {
    const t = TRACKS[key];
    return `
      <button class="track-card" data-track="${key}">
        <div class="track-name">${t.name}</div>
        <div class="track-progress">1ゲーム = ${QUESTIONS_PER_GAME}問</div>
      </button>`;
  }).join("");
  show(`
    <div class="screen tracks-screen">
      <h2>コースを選ぶ</h2>
      <div class="track-list">${cards}</div>
      <button class="btn-ghost" id="btnBack">戻る</button>
    </div>
  `);
  app.querySelectorAll(".track-card").forEach((btn) => {
    btn.onclick = () => startSession(btn.dataset.track);
  });
  el("btnBack").onclick = () => screenTitle();
}

/* ---------------- session (5 questions) ---------------- */

async function startSession(trackKey) {
  const status = await checkMicPermission();
  if (status === "granted") {
    const ok = await startMicCapture();
    if (!ok) { alert("マイクを起動できませんでした。もう一度お試しください。"); return; }
    runSession(trackKey);
  } else if (status === "asked") {
    alert("マイクの許可を確認しました。もう一度コースを選んでください。");
  } else {
    alert("マイクが使えないと判定できません。");
  }
}

async function runSession(trackKey) {
  setBanner(false);
  const track = TRACKS[trackKey];
  const stages = track.stages.slice(0, QUESTIONS_PER_GAME);
  const results = [];

  startMetronome(track.bpm);

  for (let q = 0; q < stages.length; q++) {
    const result = await runQuestion(track, stages[q], q, stages.length);
    results.push(result);
  }

  stopMetronome();
  showInterstitial("session_clear");
  screenSessionResult(trackKey, results);
}

/* ---------------- one question: demo x2 → player's turn(s) ---------------- */

function renderQuestionScreen(stage, qNum, qTotal) {
  const ipaOn = loadSettings().ipaVisible !== false;
  const cards = stage.words.map((w, i) => `
    <div class="wcard" id="wcard-${i}">
      <div class="wcard-word">${renderWord(w)}</div>
      ${ipaOn ? `<div class="wcard-ipa">${w.ipa}</div>` : ""}
    </div>
  `).join("");
  show(`
    <div class="screen game-screen">
      <div class="hud">
        <span>${stage.title}</span>
        <span>問題 ${qNum + 1} / ${qTotal}</span>
      </div>
      <p class="dialogue-line dim">${stage.line}</p>
      <div class="ball-track">
        <div class="ball" id="ball"></div>
      </div>
      <div class="card-row" id="cardRow">${cards}</div>
      <div class="phase-tag" id="phaseTag">Listen</div>
      <div class="popup" id="popup"></div>
    </div>
  `);
}

function renderWord(word) {
  const { w, b } = word;
  const before = w.slice(0, b[0]);
  const strong = w.slice(b[0], b[1]);
  const after = w.slice(b[1]);
  return `${before}<b>${strong}</b>${after}`;
}

function moveBallTo(index, cardCount) {
  const ball = el("ball");
  const card = el("wcard-" + index);
  if (!ball || !card) return;
  const row = el("cardRow");
  const rowRect = row.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const x = cardRect.left - rowRect.left + cardRect.width / 2;
  ball.style.left = x + "px";
  ball.classList.remove("bounce");
  void ball.offsetWidth; // restart animation
  ball.classList.add("bounce");
  app.querySelectorAll(".wcard").forEach((c) => c.classList.remove("active"));
  card.classList.add("active");
}

function setPhase(text) {
  const tag = el("phaseTag");
  if (tag) tag.textContent = text;
}

function showPopup(text, cls) {
  const p = el("popup");
  if (!p) return;
  p.textContent = text;
  p.className = "popup show " + cls;
  setTimeout(() => { if (p) p.className = "popup"; }, 500);
}

async function playDemoOnce(stage) {
  const startTs = performance.now();
  const timings = new Array(stage.words.length).fill(null);
  await speakWithRangeTracking(stage.line, (start, end) => {
    const idx = findWordIndexForRange(stage, start, end);
    if (idx !== -1) {
      moveBallTo(idx, stage.words.length);
      timings[idx] = performance.now() - startTs;
    }
  });
  return timings;
}

function playerTurn(stage, referenceTimings) {
  return new Promise((resolve) => {
    const words = stage.words;
    const startTs = performance.now();
    const actualTimings = new Array(words.length).fill(null);
    let idx = 0;
    let lastOnsetT = -Infinity;
    let loudSum = 0;
    const REFRACTORY = 260;
    const lastRef = referenceTimings[referenceTimings.length - 1] || 2000;
    const timeoutMs = lastRef + 2200;

    const iv = setInterval(() => {
      const now = performance.now();
      const amp = currentAmp();
      if (amp > 0.03 && now - lastOnsetT > REFRACTORY && idx < words.length) {
        lastOnsetT = now;
        actualTimings[idx] = now - startTs;
        moveBallTo(idx, words.length);
        loudSum += Math.min(1, Math.max(0, (amp - 0.015) / 0.2));
        idx++;
        if (idx >= words.length) finish();
      }
    }, 35);

    const to = setTimeout(finish, timeoutMs);

    function finish() {
      clearInterval(iv);
      clearTimeout(to);
      let timingPts = 0, count = 0;
      for (let i = 0; i < words.length; i++) {
        if (actualTimings[i] == null) continue;
        const ref = referenceTimings[i] != null ? referenceTimings[i] : lastRef;
        const diff = Math.abs(actualTimings[i] - ref);
        let pts;
        if (diff <= 150) pts = 60;
        else if (diff <= 300) pts = 40;
        else if (diff <= 500) pts = 20;
        else pts = 0;
        timingPts += pts;
        count++;
      }
      const avgTiming = count ? timingPts / count : 0;
      const avgLoud = count ? (loudSum / count) * 40 : 0;
      const perWordAvg = avgTiming + avgLoud;
      const coverage = count / words.length;
      const score = Math.round(Math.max(0, Math.min(100, perWordAvg * coverage)));
      resolve({ score, count, total: words.length });
    }
  });
}

async function runQuestion(track, stage, qIndex, qTotal) {
  computeWordRanges(stage);
  renderQuestionScreen(stage, qIndex, qTotal);

  setPhase("🔊 Listen");
  await sleep(400);
  await playDemoOnce(stage);
  await sleep(500);

  setPhase("🔊 Listen again");
  await sleep(300);
  const referenceTimings = await playDemoOnce(stage);
  await sleep(600);

  let attempt = 1;
  let passed = false;
  let lastScore = 0;
  while (attempt <= MAX_ATTEMPTS && !passed) {
    setPhase(attempt === 1 ? "🎤 Your turn!" : `🎤 Your turn! (${attempt}/${MAX_ATTEMPTS})`);
    const result = await playerTurn(stage, referenceTimings);
    lastScore = result.score;
    if (result.score >= PASS_LINE) {
      passed = true;
      showPopup("CLEAR!", "grade-PERFECT");
      playSuccessChime();
      await sleep(900);
    } else if (attempt < MAX_ATTEMPTS) {
      showPopup("もう一度!", "grade-OK");
      playFailBuzz();
      await sleep(700);
    }
    attempt++;
  }
  if (!passed) {
    showPopup("残念…", "grade-MISS");
    playFailBuzz();
    await sleep(800);
  }
  return { passed, score: lastScore };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ---------------- session result ---------------- */

function screenSessionResult(trackKey, results) {
  setBanner(true);
  const track = TRACKS[trackKey];
  const clearedCount = results.filter((r) => r.passed).length;
  const avgScore = Math.round(results.reduce((a, r) => a + r.score, 0) / results.length);
  const rows = results.map((r, i) => `
    <div class="result-row">
      <span>問題 ${i + 1}</span>
      <span>${r.score}点 ${r.passed ? "✅" : "△"}</span>
    </div>
  `).join("");
  show(`
    <div class="screen result-screen">
      <h2>ゲームクリア!</h2>
      <div class="score-big score-pass">${avgScore}</div>
      <div class="score-line">${clearedCount} / ${results.length} 問クリア(平均点)</div>
      <div class="result-list">${rows}</div>
      <button class="btn-neon" id="btnAgain">もう一度 (${track.name})</button>
      <button class="btn-ghost" id="btnBack">コース選択に戻る</button>
    </div>
  `);
  el("btnAgain").onclick = () => startSession(trackKey);
  el("btnBack").onclick = () => screenTracks();
}

/* ---------------- Android hardware back ---------------- */

window.onBackPressed = function () {
  if (app.querySelector(".title-screen")) return false;
  stopMetronome();
  screenTitle();
  return true;
};

/* ---------------- boot ---------------- */

state.ipaVisible = loadSettings().ipaVisible !== false;
screenTitle();
