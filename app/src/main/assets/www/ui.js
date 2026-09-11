// Shadow Beat — screen flow and gameplay loop.

const app = document.getElementById("app");
let currentAttemptScores = [];
let activeNotes = [];
let beatTimerHandle = null;
let stageEndTimeoutHandle = null;

function show(html) {
  app.innerHTML = html;
}

function el(id) {
  return document.getElementById(id);
}

/* ---------------- title screen ---------------- */

function screenTitle() {
  setBanner(false);
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
      <button class="btn-neon" id="btnBack">戻る</button>
    </div>
  `);
  el("chkIpa").onchange = (e) => {
    const s2 = loadSettings();
    s2.ipaVisible = e.target.checked;
    saveSettings(s2);
    state.ipaVisible = e.target.checked;
  };
  el("btnBack").onclick = () => screenTitle();
}

/* ---------------- track select ---------------- */

function screenTracks() {
  setBanner(true);
  const progress = loadProgress();
  const cards = Object.keys(TRACKS)
    .map((key) => {
      const t = TRACKS[key];
      const cleared = progress[key] ? Object.keys(progress[key]).length : 0;
      return `
        <button class="track-card" data-track="${key}">
          <div class="track-name">${t.name}</div>
          <div class="track-progress">${cleared} / ${t.stages.length} クリア</div>
        </button>`;
    })
    .join("");
  show(`
    <div class="screen tracks-screen">
      <h2>コースを選ぶ</h2>
      <div class="track-list">${cards}</div>
      <button class="btn-ghost" id="btnBack">戻る</button>
    </div>
  `);
  app.querySelectorAll(".track-card").forEach((btn) => {
    btn.onclick = () => screenStages(btn.dataset.track);
  });
  el("btnBack").onclick = () => screenTitle();
}

/* ---------------- stage select ---------------- */

function screenStages(trackKey) {
  state.track = trackKey;
  const t = TRACKS[trackKey];
  const progress = loadProgress();
  const items = t.stages
    .map((st, i) => {
      const unlocked = isStageUnlocked(trackKey, i);
      const cleared = !!(progress[trackKey] && progress[trackKey][i]);
      const cls = !unlocked ? "locked" : cleared ? "cleared" : "";
      return `
        <button class="stage-item ${cls}" data-idx="${i}" ${!unlocked ? "disabled" : ""}>
          <span class="stage-num">${i + 1}</span>
          <span class="stage-title">${st.title}</span>
          <span class="stage-mark">${cleared ? "★" : unlocked ? "" : "🔒"}</span>
        </button>`;
    })
    .join("");
  show(`
    <div class="screen stages-screen">
      <h2>${t.name}</h2>
      <div class="stage-list">${items}</div>
      <button class="btn-ghost" id="btnBack">コース選択に戻る</button>
    </div>
  `);
  app.querySelectorAll(".stage-item:not([disabled])").forEach((btn) => {
    btn.onclick = () => screenStageIntro(trackKey, parseInt(btn.dataset.idx, 10));
  });
  el("btnBack").onclick = () => screenTracks();
}

/* ---------------- stage intro (hear the dialogue first) ---------------- */

function screenStageIntro(trackKey, idx) {
  state.track = trackKey;
  state.stageIndex = idx;
  state.attempt = 1;
  const stage = TRACKS[trackKey].stages[idx];
  show(`
    <div class="screen intro-screen">
      <h2>${stage.title}</h2>
      <p class="dialogue-line">${stage.line}</p>
      <button class="btn-ghost" id="btnListen">🔊 会話を聞く</button>
      <button class="btn-neon" id="btnGo">START</button>
      <button class="btn-ghost" id="btnBack">ステージ選択に戻る</button>
      <p class="hint">マイクへのアクセスを求められたら許可してください</p>
    </div>
  `);
  el("btnListen").onclick = () => speak(stage.line);
  el("btnGo").onclick = async () => {
    const ok = await ensureMic();
    if (!ok) {
      alert(
        "マイクの許可がないと判定できません。\n" +
        "許可ダイアログで「許可しない」を選んだ場合は、端末の設定アプリ → アプリ → Shadow Beat → 権限 から\n" +
        "マイクを手動でONにしてください。"
      );
      return;
    }
    screenGame(trackKey, idx);
  };
  el("btnBack").onclick = () => screenStages(trackKey);
}

/* ---------------- gameplay ---------------- */

function screenGame(trackKey, idx) {
  setBanner(false);
  const track = TRACKS[trackKey];
  const stage = track.stages[idx];
  const bpm = track.bpm;
  const beatMs = 60000 / bpm;
  const barMs = beatMs * 4;
  const words = stage.words;
  const ipaOn = loadSettings().ipaVisible !== false;

  show(`
    <div class="screen game-screen">
      <div class="hud">
        <span>${stage.title}</span>
        <span id="attemptTag">挑戦 ${state.attempt} / ${MAX_ATTEMPTS}</span>
      </div>
      <div class="lane" id="lane">
        <div class="hit-line"></div>
      </div>
      <div class="beats" id="beats">
        <span class="beat-dot" data-b="0"></span>
        <span class="beat-dot" data-b="1"></span>
        <span class="beat-dot" data-b="2"></span>
        <span class="beat-dot" data-b="3"></span>
      </div>
      <div class="popup" id="popup"></div>
    </div>
  `);

  currentAttemptScores = [];
  activeNotes = [];
  const runId = ++state.runId;
  const lane = el("lane");
  const laneHeight = () => lane.clientHeight;

  const startTime = performance.now() + barMs; // 1 bar lead-in
  const beatDots = app.querySelectorAll(".beat-dot");

  function beatLoop() {
    if (runId !== state.runId) return;
    const now = performance.now();
    const beatIndex = Math.floor((now - startTime) / beatMs);
    const phase = ((beatIndex % 4) + 4) % 4;
    beatDots.forEach((d, i) => d.classList.toggle("on", i === phase));
    beatTimerHandle = requestAnimationFrame(beatLoop);
  }
  beatLoop();

  // schedule note spawns + judges
  words.forEach((word, i) => {
    const spawnAt = startTime + i * barMs;
    const judgeAt = startTime + (i + 1) * barMs;
    setTimeout(() => {
      if (runId !== state.runId) return;
      spawnNote(word, spawnAt, judgeAt, barMs, ipaOn, lane, laneHeight);
    }, Math.max(0, spawnAt - performance.now()));
    setTimeout(() => {
      if (runId !== state.runId) return;
      const result = judgeWord(judgeAt);
      currentAttemptScores.push(result);
      showPopup(result.grade);
    }, Math.max(0, judgeAt - performance.now()));
  });

  const totalDuration = startTime - performance.now() + (words.length + 1) * barMs;
  stageEndTimeoutHandle = setTimeout(() => {
    if (runId !== state.runId) return;
    cancelAnimationFrame(beatTimerHandle);
    finishAttempt(trackKey, idx);
  }, totalDuration);
}

function spawnNote(word, spawnAt, judgeAt, barMs, ipaOn, lane, laneHeight) {
  const noteEl = document.createElement("div");
  noteEl.className = "note";
  noteEl.innerHTML = `
    <div class="note-word">${renderWord(word)}</div>
    ${ipaOn ? `<div class="note-ipa">${word.ipa}</div>` : ""}
  `;
  lane.appendChild(noteEl);

  function frame() {
    const now = performance.now();
    const t = (now - spawnAt) / (judgeAt - spawnAt); // 0..1
    if (t > 1.15) {
      noteEl.remove();
      return;
    }
    const h = laneHeight();
    noteEl.style.transform = `translateY(${Math.min(t, 1) * (h - 90)}px)`;
    noteEl.style.opacity = t > 1 ? Math.max(0, 1 - (t - 1) * 5) : 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function renderWord(word) {
  const { w, b } = word;
  const before = w.slice(0, b[0]);
  const strong = w.slice(b[0], b[1]);
  const after = w.slice(b[1]);
  return `${before}<b>${strong}</b>${after}`;
}

function showPopup(grade) {
  const p = el("popup");
  if (!p) return;
  p.textContent = grade;
  p.className = "popup show grade-" + grade;
  setTimeout(() => {
    if (p) p.className = "popup";
  }, 400);
}

/* ---------------- result ---------------- */

function finishAttempt(trackKey, idx) {
  const total = currentAttemptScores.length
    ? Math.round(currentAttemptScores.reduce((a, r) => a + r.points, 0) / currentAttemptScores.length)
    : 0;
  const passed = total >= PASS_LINE;

  if (passed) {
    markCleared(trackKey, idx);
    showInterstitial("stage_clear");
  }

  screenResult(trackKey, idx, total, passed);
}

function screenResult(trackKey, idx, total, passed) {
  setBanner(true);
  const track = TRACKS[trackKey];
  const isLastStage = idx === track.stages.length - 1;
  const attemptsLeft = MAX_ATTEMPTS - state.attempt;

  let actionsHtml = "";
  if (passed) {
    actionsHtml = isLastStage
      ? `<button class="btn-neon" id="btnBack">コース選択に戻る</button>`
      : `<button class="btn-neon" id="btnNext">次のステージへ</button>
         <button class="btn-ghost" id="btnBack">ステージ選択に戻る</button>`;
  } else if (attemptsLeft > 0) {
    actionsHtml = `
      <button class="btn-neon" id="btnRetry">もう一度 (${state.attempt + 1}/${MAX_ATTEMPTS})</button>
      <button class="btn-ghost" id="btnBack">ステージ選択に戻る</button>`;
  } else {
    actionsHtml = `
      <button class="btn-neon" id="btnRescue">📺 広告を見てもう1回</button>
      <button class="btn-ghost" id="btnNextAnyway">このまま次へ${isLastStage ? "戻る" : "進む"}</button>`;
  }

  show(`
    <div class="screen result-screen">
      <h2>${passed ? "CLEAR!" : "スコア"}</h2>
      <div class="score-big ${passed ? "score-pass" : "score-fail"}">${total}</div>
      <div class="score-line">合格ライン: ${PASS_LINE}</div>
      ${actionsHtml}
    </div>
  `);

  if (el("btnNext")) el("btnNext").onclick = () => screenStageIntro(trackKey, idx + 1);
  if (el("btnBack")) el("btnBack").onclick = () => screenStages(trackKey);
  if (el("btnRetry"))
    el("btnRetry").onclick = () => {
      state.attempt += 1;
      screenStageIntro(trackKey, idx);
    };
  if (el("btnNextAnyway"))
    el("btnNextAnyway").onclick = () =>
      isLastStage ? screenStages(trackKey) : screenStageIntro(trackKey, idx + 1);
  if (el("btnRescue"))
    el("btnRescue").onclick = () => {
      requestRescue(
        () => {
          state.attempt = 1; // fresh set of tries after the rescue ad
          screenStageIntro(trackKey, idx);
        },
        () => alert("広告を読み込めませんでした。もう一度お試しください。")
      );
    };
}

/* ---------------- back button (Android hardware back) ---------------- */

window.onBackPressed = function () {
  // Let the title screen exit the app normally; everywhere else, go back a step.
  if (app.querySelector(".title-screen")) return false;
  screenTitle();
  return true;
};

/* ---------------- boot ---------------- */

state.ipaVisible = loadSettings().ipaVisible !== false;
screenTitle();
