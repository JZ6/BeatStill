import type { AudioManager, ShotSound } from "./AudioManager";
import type { GameScene } from "../scenes/GameScene";
import { allThemes } from "../sounds";
import { getCrashReports, getAllReportsText } from "./CrashReporter";
import { ALL_WEAPONS } from "./Weapons";

const SHOT_SOUNDS: { id: ShotSound; label: string; desc: string }[] = [
  { id: "soft", label: "Soft", desc: "Gentle sine blip, blends into background" },
  { id: "tap", label: "Tap", desc: "Tiny pink noise puff, like a muted tap" },
  { id: "bubble", label: "Bubble", desc: "Soft filtered pop, bubbly texture" },
  { id: "pulse", label: "Pulse", desc: "Faint triangle tick, almost subliminal" },
  { id: "kick", label: "Kick", desc: "Deep thump, pitch sweep" },
  { id: "808", label: "808 Sub", desc: "Deep sine thump, long sustain" },
];

function makeTab(label: string): { tab: HTMLButtonElement; content: HTMLDivElement } {
  const tab = document.createElement("button");
  tab.className = "dp-tab";
  tab.textContent = label;
  const content = document.createElement("div");
  content.className = "dp-tab-content";
  content.style.display = "none";
  return { tab, content };
}

export function createDevPanel(
  getScene: () => GameScene | null,
  getAudioManager: () => AudioManager | null,
) {
  const panel = document.createElement("div");
  panel.id = "dev-panel";
  panel.style.display = "none";
  document.body.appendChild(panel);

  const header = document.createElement("div");
  header.className = "dp-header";
  header.innerHTML = `<span>DEV PANEL</span><span class="dp-hint">(\` to toggle)</span>`;
  panel.appendChild(header);

  const tabBar = document.createElement("div");
  tabBar.className = "dp-tab-bar";
  panel.appendChild(tabBar);

  const tabContainer = document.createElement("div");
  panel.appendChild(tabContainer);

  const gameTab = makeTab("Game");
  const audioTab = makeTab("Audio");
  const soundsTab = makeTab("Sounds");
  const crashTab = makeTab("Crashes");
  const tabs = [gameTab, audioTab, soundsTab, crashTab];

  for (const { tab, content } of tabs) {
    tabBar.appendChild(tab);
    tabContainer.appendChild(content);
    tab.addEventListener("click", (e) => {
      e.stopPropagation();
      tabs.forEach((t) => {
        t.tab.classList.remove("dp-tab-active");
        t.content.style.display = "none";
      });
      tab.classList.add("dp-tab-active");
      content.style.display = "flex";
    });
  }
  gameTab.tab.classList.add("dp-tab-active");
  gameTab.content.style.display = "flex";

  // ===== GAME TAB =====
  const gc = gameTab.content;
  gc.style.flexDirection = "column";
  gc.style.gap = "8px";

  const waveRow = document.createElement("div");
  waveRow.className = "dp-ctrl-row";
  const waveLabel = document.createElement("span");
  waveLabel.className = "dp-ctrl-label";
  waveLabel.textContent = "Wave: --";
  const setWaveInput = document.createElement("input");
  setWaveInput.type = "number";
  setWaveInput.min = "1";
  setWaveInput.max = "99";
  setWaveInput.value = "1";
  setWaveInput.className = "dp-number-input";

  const setWaveBtn = document.createElement("button");
  setWaveBtn.className = "dp-game-btn";
  setWaveBtn.textContent = "Set Wave";
  setWaveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const scene = getScene();
    if (!scene || scene.gameOver) return;
    const target = parseInt(setWaveInput.value) - 1;
    if (target >= 0) {
      scene.wave = target;
      scene.clearEnemies();
      scene.spawnWave();
      waveLabel.textContent = `Wave: ${scene.wave}`;
    }
  });

  const skipWaveBtn = document.createElement("button");
  skipWaveBtn.className = "dp-game-btn";
  skipWaveBtn.textContent = "Skip Wave";
  skipWaveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const scene = getScene();
    if (!scene || scene.gameOver) return;
    scene.clearEnemies();
    scene.spawnWave();
    waveLabel.textContent = `Wave: ${scene.wave}`;
  });

  waveRow.append(waveLabel, setWaveInput, setWaveBtn, skipWaveBtn);
  gc.appendChild(waveRow);

  const spawnRow = document.createElement("div");
  spawnRow.className = "dp-ctrl-row";

  const btns: [string, (s: GameScene) => void][] = [
    ["+10 Enemies", (s) => s.devSpawnEnemies(10)],
    ["+3 Asteroids", (s) => s.devSpawnAsteroids(3)],
    ["Clear All", (s) => s.clearEnemies()],
  ];
  for (const [label, fn] of btns) {
    const btn = document.createElement("button");
    btn.className = "dp-game-btn";
    btn.textContent = label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const scene = getScene();
      if (scene) fn(scene);
    });
    spawnRow.appendChild(btn);
  }

  const godModeBtn = document.createElement("button");
  godModeBtn.className = "dp-game-btn";
  godModeBtn.textContent = "God Mode: OFF";
  godModeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const scene = getScene();
    if (!scene) return;
    scene.godMode = !scene.godMode;
    godModeBtn.textContent = `God Mode: ${scene.godMode ? "ON" : "OFF"}`;
    godModeBtn.style.borderColor = scene.godMode ? "#0f0" : "#444";
  });
  const resetTutorialBtn = document.createElement("button");
  resetTutorialBtn.className = "dp-game-btn";
  resetTutorialBtn.textContent = "Reset Tutorial";
  resetTutorialBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    try { localStorage.removeItem("stillbeat_tutorial_done"); } catch {}
    resetTutorialBtn.textContent = "Tutorial Reset!";
    setTimeout(() => (resetTutorialBtn.textContent = "Reset Tutorial"), 1500);
  });
  spawnRow.appendChild(godModeBtn);
  spawnRow.appendChild(resetTutorialBtn);
  gc.appendChild(spawnRow);

  const weaponLabel = document.createElement("div");
  weaponLabel.className = "dp-label";
  weaponLabel.textContent = "WEAPON";
  gc.appendChild(weaponLabel);

  const weaponRow = document.createElement("div");
  weaponRow.className = "dp-ctrl-row";
  const weaponBtns: HTMLButtonElement[] = [];

  for (const weapon of ALL_WEAPONS) {
    const btn = document.createElement("button");
    btn.className = "dp-game-btn";
    btn.textContent = weapon.name;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const scene = getScene();
      if (scene) {
        scene.stats.weaponId = weapon.id;
        weaponBtns.forEach((b) => (b.style.borderColor = "#444"));
        btn.style.borderColor = "#ffaa44";
      }
    });
    weaponBtns.push(btn);
    weaponRow.appendChild(btn);
  }
  weaponBtns[0].style.borderColor = "#ffaa44";
  gc.appendChild(weaponRow);

  const pollId = setInterval(() => {
    if (!document.body.contains(panel)) { clearInterval(pollId); return; }
    const scene = getScene();
    if (scene) waveLabel.textContent = `Wave: ${scene.wave}`;
  }, 500);

  // ===== AUDIO TAB =====
  const ac = audioTab.content;
  ac.style.flexDirection = "column";
  ac.style.gap = "10px";

  const themeLabel = document.createElement("div");
  themeLabel.className = "dp-label";
  themeLabel.textContent = "SOUND THEME";
  ac.appendChild(themeLabel);

  const themeRow = document.createElement("div");
  themeRow.className = "dp-ctrl-row";
  const themeButtons: HTMLButtonElement[] = [];

  for (const theme of allThemes) {
    const btn = document.createElement("button");
    btn.className = "dp-game-btn";
    btn.textContent = theme.name;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const am = getAudioManager();
      if (am) {
        am.loadTheme(theme);
        themeButtons.forEach((b) => (b.style.borderColor = "#444"));
        btn.style.borderColor = "#ffaa44";
      }
    });
    themeButtons.push(btn);
    themeRow.appendChild(btn);
  }
  themeButtons[0].style.borderColor = "#ffaa44";
  ac.appendChild(themeRow);

  const shotLabel = document.createElement("div");
  shotLabel.className = "dp-label";
  shotLabel.textContent = "SHOT SOUND";
  ac.appendChild(shotLabel);

  for (const shot of SHOT_SOUNDS) {
    const row = document.createElement("div");
    row.className = "dp-row";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "shot-sound";
    radio.value = shot.id;
    radio.id = `shot-${shot.id}`;
    radio.checked = shot.id === "soft";

    const label = document.createElement("label");
    label.htmlFor = `shot-${shot.id}`;
    label.textContent = shot.label;

    const desc = document.createElement("span");
    desc.className = "dp-desc";
    desc.textContent = shot.desc;

    const btn = document.createElement("button");
    btn.textContent = "Preview";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const am = getAudioManager();
      if (am) am.previewShot(shot.id);
    });

    radio.addEventListener("change", () => {
      const am = getAudioManager();
      if (am) am.activeShotSound = shot.id;
    });

    row.append(radio, label, desc, btn);
    ac.appendChild(row);
  }

  // ===== SOUNDS TAB =====
  const sc = soundsTab.content;
  sc.style.flexDirection = "column";
  sc.style.gap = "8px";

  const previewLabel = document.createElement("div");
  previewLabel.className = "dp-label";
  previewLabel.textContent = "PREVIEW GAME SOUNDS";
  sc.appendChild(previewLabel);

  const soundRow = document.createElement("div");
  soundRow.className = "dp-ctrl-row";
  soundRow.style.flexWrap = "wrap";

  const gameSounds: { label: string; fn: (am: AudioManager) => void }[] = [
    { label: "Enemy Hit", fn: (am) => am.onEnemyHit() },
    { label: "Enemy Kill", fn: (am) => am.onEnemyKill() },
    { label: "Chain Kill", fn: (am) => am.onChainKill(3) },
    { label: "Asteroid", fn: (am) => am.onAsteroidBreak() },
    { label: "Bullet Clash", fn: (am) => am.onBulletClash() },
    { label: "Player Hit", fn: (am) => am.onPlayerHit() },
    { label: "Player Death", fn: (am) => am.onPlayerDeath() },
  ];

  for (const sound of gameSounds) {
    const btn = document.createElement("button");
    btn.className = "dp-game-btn";
    btn.textContent = sound.label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const am = getAudioManager();
      if (am) sound.fn(am);
    });
    soundRow.appendChild(btn);
  }
  sc.appendChild(soundRow);

  // ===== CRASHES TAB =====
  const cc = crashTab.content;
  cc.style.flexDirection = "column";
  cc.style.gap = "8px";

  const crashLabel = document.createElement("div");
  crashLabel.className = "dp-label";
  crashLabel.textContent = "CRASH REPORTS";
  cc.appendChild(crashLabel);

  const crashLog = document.createElement("pre");
  Object.assign(crashLog.style, {
    background: "#111",
    border: "1px solid #333",
    borderRadius: "4px",
    padding: "8px",
    fontSize: "11px",
    color: "#ccc",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: "300px",
    overflowY: "auto",
    minHeight: "60px",
  });
  crashLog.textContent = "No crashes recorded.";
  cc.appendChild(crashLog);

  const crashBtnRow = document.createElement("div");
  crashBtnRow.className = "dp-ctrl-row";

  const refreshBtn = document.createElement("button");
  refreshBtn.className = "dp-game-btn";
  refreshBtn.textContent = "Refresh";
  refreshBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const all = getCrashReports();
    crashLog.textContent = all.length === 0
      ? "No crashes recorded."
      : getAllReportsText();
  });

  const copyAllBtn = document.createElement("button");
  copyAllBtn.className = "dp-game-btn";
  copyAllBtn.textContent = "Copy All";
  copyAllBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(getAllReportsText()).then(() => {
      copyAllBtn.textContent = "Copied!";
      setTimeout(() => (copyAllBtn.textContent = "Copy All"), 1500);
    });
  });

  const testCrashBtn = document.createElement("button");
  testCrashBtn.className = "dp-game-btn";
  testCrashBtn.textContent = "Test Crash";
  testCrashBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setTimeout(() => { throw new Error("Test crash from dev panel"); }, 0);
  });

  crashBtnRow.append(refreshBtn, copyAllBtn, testCrashBtn);
  cc.appendChild(crashBtnRow);

  // --- Toggle ---
  document.addEventListener("keydown", (e) => {
    if (e.key === "`") {
      e.preventDefault();
      e.stopPropagation();
      panel.style.display = panel.style.display === "none" ? "flex" : "none";
    }
  }, true);

  for (const evt of ["pointerdown", "pointerup", "pointermove", "click"] as const) {
    panel.addEventListener(evt, (e) => e.stopPropagation());
  }
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "`") e.stopPropagation();
  });
}
