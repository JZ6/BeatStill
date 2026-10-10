import type { GameScene } from "../scenes/GameScene";
import { getAudioEngine } from "../audio/AudioEngine";
import type { MusicControl } from "../audio/MusicDriver";
import { Harmony } from "../music/Harmony";
import { ALL_PALETTES, ROLES, getPalette, isPitched, registerMidi, type Palette, type Role } from "../music/palettes";
import { getCrashReports, getAllReportsText } from "./CrashReporter";
import { options } from "./GameOptions";
import { ALL_WEAPONS } from "./Weapons";

function makeTab(label: string): { tab: HTMLButtonElement; content: HTMLDivElement } {
  const tab = document.createElement("button");
  tab.className = "dp-tab";
  tab.textContent = label;
  const content = document.createElement("div");
  content.className = "dp-tab-content";
  content.style.display = "none";
  return { tab, content };
}

/** "Wave: 3" in endless; "Wave: 2/5" in a level (the wave on the field). */
function waveText(scene: GameScene): string {
  const level = scene.level;
  if (!level) return `Wave: ${scene.wave}`;
  const total = level.levelDef.waves.length;
  const status = level.isComplete ? " (complete)" : "";
  return `Wave: ${Math.max(0, level.waveIndex + 1)}/${total}${status}`;
}

function buildGameTab(
  getScene: () => GameScene | null,
): { tab: HTMLButtonElement; content: HTMLDivElement; refresh: () => void } {
  const { tab, content: gc } = makeTab("Game");
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
    // Endless only: a level's waves are fixed (use Skip Wave there).
    if (!scene || scene.gameOver || scene.level) return;
    const target = parseInt(setWaveInput.value) - 1;
    if (target >= 0) {
      scene.wave = target;
      scene.waves.clearField();
      scene.waves.spawnEndlessWave();
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
    // Endless: the next wave; a level: its next wave through the level runner (both on the next bar line).
    scene.waves.skipWave();
    waveLabel.textContent = waveText(scene);
  });

  waveRow.append(waveLabel, setWaveInput, setWaveBtn, skipWaveBtn);
  gc.appendChild(waveRow);

  const clockLabel = document.createElement("div");
  clockLabel.className = "dp-ctrl-label";
  clockLabel.textContent = "Clock: --";
  gc.appendChild(clockLabel);

  const spawnRow = document.createElement("div");
  spawnRow.className = "dp-ctrl-row";

  const btns: [string, (s: GameScene) => void][] = [
    ["+10 Enemies", (s) => s.waves.devSpawnEnemies(10)],
    ["+3 Asteroids", (s) => s.waves.devSpawnAsteroids(3)],
    ["Clear All", (s) => s.waves.clearField()],
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
    syncGodModeBtn(scene.godMode);
  });
  function syncGodModeBtn(on: boolean) {
    godModeBtn.textContent = `God Mode: ${on ? "ON" : "OFF"}`;
    godModeBtn.style.borderColor = on ? "#0f0" : "#444";
  }
  const resetTutorialBtn = document.createElement("button");
  resetTutorialBtn.className = "dp-game-btn";
  resetTutorialBtn.textContent = "Reset Tutorial";
  resetTutorialBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    try { localStorage.removeItem("beatstill_tutorial_done"); } catch {}
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

  // Polled by createDevPanel only while the panel is open. godMode resets on every run restart,
  // so the button label is re-synced too.
  function refresh() {
    const scene = getScene();
    if (!scene) return;
    waveLabel.textContent = waveText(scene);
    syncGodModeBtn(scene.godMode);
    const c = scene.conductor;
    clockLabel.textContent = c
      ? `Clock: ×${scene.timeScale.toFixed(2)} · ${c.bpm} BPM · bar ${c.bar + 1} beat ${(c.beatInBar + 1).toFixed(2)}${c.paused ? " · paused" : ""}`
      : "Clock: --";
  }

  return { tab, content: gc, refresh };
}

/** A chord tone in the middle of the role's register (current bar if music is playing), or [] if unpitched. */
function sampleNotes(palette: Palette, role: Role, music: MusicControl | null): number[] {
  const spec = palette.instruments[role];
  if (!spec || !isPitched(spec)) return [];
  const [lo, hi] = registerMidi(spec) ?? [60, 84];
  const harmony =
    music?.director.palette.id === palette.id
      ? music.director.harmony
      : new Harmony({ key: palette.key, mode: palette.mode, progression: palette.progression });
  const tones = harmony.chordTones(music?.conductor.bar ?? 0, lo, hi);
  return [tones[Math.floor(tones.length / 2)] ?? Math.round((lo + hi) / 2)];
}

function buildAudioTab(
  getMusic: () => MusicControl | null,
): { tab: HTMLButtonElement; content: HTMLDivElement; syncState: () => void } {
  const { tab, content: ac } = makeTab("Audio");
  ac.style.flexDirection = "column";
  ac.style.gap = "10px";
  const engine = getAudioEngine();
  const currentPalette = (): Palette => engine.palette ?? getPalette(options.themeId);

  const paletteLabel = document.createElement("div");
  paletteLabel.className = "dp-label";
  paletteLabel.textContent = "PALETTE (this session only)";
  ac.appendChild(paletteLabel);

  const paletteRow = document.createElement("div");
  paletteRow.className = "dp-ctrl-row";
  const paletteButtons: HTMLButtonElement[] = [];
  for (const palette of ALL_PALETTES) {
    const btn = document.createElement("button");
    btn.className = "dp-game-btn";
    btn.textContent = `${palette.name} ${palette.bpm}`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Engine, director and conductor tempo together; without music only the engine's instruments.
      const music = getMusic();
      if (music) music.setPalette(palette);
      else engine.setPalette(palette);
      syncState();
    });
    paletteButtons.push(btn);
    paletteRow.appendChild(btn);
  }
  ac.appendChild(paletteRow);

  const roleLabel = document.createElement("div");
  roleLabel.className = "dp-label";
  roleLabel.textContent = "ROLES (sample note)";
  ac.appendChild(roleLabel);

  const roleRow = document.createElement("div");
  roleRow.className = "dp-ctrl-row";
  roleRow.style.flexWrap = "wrap";
  for (const role of ROLES) {
    const btn = document.createElement("button");
    btn.className = "dp-game-btn";
    btn.textContent = role;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      // The click is a user gesture, so it may start audio too.
      engine.setPalette(currentPalette());
      engine
        .start()
        .then(() => {
          const midi = sampleNotes(currentPalette(), role, getMusic());
          engine.play({ role, midi, when: 0.03, duration: role === "drone" ? 1.5 : 0.5, velocity: 0.7 });
          syncState();
        })
        .catch((err: unknown) => console.warn("[DevPanel] audio did not start:", err));
    });
    roleRow.appendChild(btn);
  }
  ac.appendChild(roleRow);

  const statsLabel = document.createElement("div");
  statsLabel.className = "dp-ctrl-label";
  statsLabel.style.whiteSpace = "pre";
  ac.appendChild(statsLabel);

  function syncState() {
    const st = engine.stats();
    const active = st.palette ?? currentPalette().id;
    paletteButtons.forEach((b, i) => (b.style.borderColor = ALL_PALETTES[i].id === active ? "#ffaa44" : "#444"));
    const music = getMusic();
    const tempo = music ? `${music.conductor.bpm} BPM, chord ${music.director.harmony.chordAtBar(music.conductor.bar).symbol}` : "no music";
    statsLabel.textContent =
      `Engine: ${st.started ? "started" : "not started"} · context ${st.contextState} · palette ${st.palette ?? "-"}\n` +
      `Notes: ${st.scheduled} scheduled · ${st.dropped} dropped · ${st.errors} errors\n` +
      `Music: ${tempo}`;
  }

  return { tab, content: ac, syncState };
}

function buildCrashTab(): { tab: HTMLButtonElement; content: HTMLDivElement } {
  const { tab, content: cc } = makeTab("Crashes");
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
    }).catch(() => {});
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

  return { tab, content: cc };
}

let devPanelCreated = false;

export function createDevPanel(
  getScene: () => GameScene | null,
  getMusic: () => MusicControl | null,
) {
  // Double-init would add a second panel and a second global keydown toggle.
  if (devPanelCreated || document.getElementById("dev-panel")) return;
  devPanelCreated = true;

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

  const gameTab = buildGameTab(getScene);
  const audioTab = buildAudioTab(getMusic);
  const tabs = [
    gameTab,
    audioTab,
    buildCrashTab(),
  ];

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
      if (tab === audioTab.tab) audioTab.syncState();
    });
  }
  tabs[0].tab.classList.add("dp-tab-active");
  tabs[0].content.style.display = "flex";

  // Live refresh only runs while the panel is visible.
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  const refresh = () => {
    gameTab.refresh();
    if (audioTab.tab.classList.contains("dp-tab-active")) audioTab.syncState();
  };
  const setOpen = (open: boolean) => {
    panel.style.display = open ? "flex" : "none";
    if (open) {
      refresh();
      if (refreshTimer === null) refreshTimer = setInterval(refresh, 500);
    } else if (refreshTimer !== null) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "`") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(panel.style.display === "none");
    }
  }, true);

  for (const evt of ["pointerdown", "pointerup", "pointermove", "click"] as const) {
    panel.addEventListener(evt, (e) => e.stopPropagation());
  }
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "`") e.stopPropagation();
  });
}
