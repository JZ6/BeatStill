import type { EnemyType } from "../objects/enemies";
import type { WallType } from "../objects/Wall";
import type { LevelDef, LevelMusic, LevelWave } from "../systems/Levels";
import {
  normalizeLevelDef, normalizeLevelMusic, normalizeBpm, progressionError,
  MAX_LEVEL_NAME_LENGTH, MAX_WAVE_BARS, MIN_LEVEL_BPM, MAX_LEVEL_BPM,
} from "../systems/LevelValidation";
import { parseProgression } from "../music/Harmony";
import { levelPalette } from "../music/levelMusic";
import { ALL_PALETTES, type Palette } from "../music/palettes";
import { HEPTATONIC_MODES } from "../music/theory";
import { ENEMY_TYPES, WALL_TYPE_LIST, ASTEROID_SIZES, getEnemyVis, type Tool, type Selection } from "./LevelDesignerData";

// ── CSS ─────────────────────────────────────────────────────────

const STYLE_ID = "ld-styles";

export function injectEditorStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    .ld-bar {
      position:fixed;display:flex;align-items:center;gap:6px;
      background:rgba(10,8,6,0.94);font-family:monospace;z-index:4000;
      padding:0 12px;
    }
    .ld-top { top:0;left:0;right:0;height:40px;border-bottom:1px solid #222; }
    .ld-tool-bar { top:40px;left:0;right:0;height:36px;border-bottom:1px solid #1a1a1a; }
    .ld-bottom { bottom:0;left:0;right:0;height:36px;border-top:1px solid #222; }
    .ld-title { color:#e8d5b0;font-size:14px;letter-spacing:2px;margin-right:8px; }
    .ld-btn {
      background:transparent;border:1px solid #333;color:#887766;
      font-family:monospace;font-size:11px;padding:4px 10px;border-radius:3px;
      cursor:pointer;letter-spacing:1px;transition:all 0.15s;
    }
    .ld-btn:hover { border-color:#ffaa44;color:#e8d5b0; }
    .ld-btn.primary { border-color:#ffaa44;color:#ffaa44; }
    .ld-btn.primary:hover { background:rgba(255,170,68,0.1); }
    .ld-input {
      background:#111;border:1px solid #333;color:#e8d5b0;
      font-family:monospace;font-size:12px;padding:4px 8px;border-radius:3px;
      outline:none;width:140px;
    }
    .ld-input:focus { border-color:#ffaa44; }
    .ld-tool {
      background:transparent;border:1px solid #222;color:#555;
      font-family:monospace;font-size:10px;padding:4px 8px;border-radius:3px;
      cursor:pointer;letter-spacing:1px;transition:all 0.15s;
    }
    .ld-tool:hover { color:#e8d5b0;border-color:#555; }
    .ld-tool.active { color:#ffaa44;border-color:#ffaa44;background:rgba(255,170,68,0.08); }
    .ld-sep { color:#222;margin:0 4px; }
    .ld-select {
      background:#111;border:1px solid #333;color:#e8d5b0;
      font-family:monospace;font-size:11px;padding:3px 6px;border-radius:3px;
      outline:none;cursor:pointer;
    }
    .ld-label { color:#555;font-size:10px;letter-spacing:1px; }
    .ld-props { color:#887766;font-size:11px;margin-left:auto; }
    .ld-wave-tab {
      background:transparent;border:1px solid #222;color:#555;
      font-family:monospace;font-size:11px;padding:3px 10px;border-radius:3px;
      cursor:pointer;transition:all 0.15s;min-width:32px;
    }
    .ld-wave-tab:hover { color:#e8d5b0;border-color:#555; }
    .ld-wave-tab.active { color:#ffaa44;border-color:#ffaa44; }
    .ld-modal {
      position:fixed;top:0;left:0;width:100vw;height:100vh;
      background:rgba(0,0,0,0.8);z-index:5000;
      display:flex;align-items:center;justify-content:center;
      font-family:monospace;
    }
    .ld-modal-box {
      background:#0a0806;border:1px solid #333;border-radius:8px;
      padding:20px;max-width:400px;width:90%;max-height:70vh;overflow-y:auto;
    }
    .ld-modal-title { color:#e8d5b0;font-size:16px;margin-bottom:12px;letter-spacing:2px; }
    .ld-modal-item {
      display:flex;align-items:center;gap:10px;padding:8px;border-radius:4px;
      border:1px solid #1a1a1a;margin-bottom:4px;cursor:pointer;transition:all 0.15s;
    }
    .ld-modal-item:hover { border-color:#555;background:rgba(255,170,68,0.04); }
    .ld-modal-name { color:#e8d5b0;font-size:13px; }
    .ld-modal-desc { color:#555;font-size:11px; }
    .ld-modal-textarea {
      width:100%;height:200px;background:#111;border:1px solid #333;color:#e8d5b0;
      font-family:monospace;font-size:11px;padding:8px;border-radius:4px;
      outline:none;resize:vertical;
    }
    .ld-modal-textarea:focus { border-color:#ffaa44; }
    .ld-modal-error { color:#ff6666;font-size:11px;margin-top:8px;white-space:pre-wrap; }
    .ld-bars { width:52px; }
    .ld-form-row { display:flex;align-items:center;gap:8px;margin-top:10px; }
    .ld-form-label { width:92px;flex-shrink:0;color:#887766;font-size:11px;letter-spacing:1px; }
    .ld-form-row .ld-input, .ld-form-row .ld-select { flex:1;width:auto;min-width:0; }
    .ld-form-msg { margin:3px 0 0 100px;font-size:10px;color:#555;min-height:12px; }
    .ld-form-msg.error { color:#ff6666; }
    .ld-form-msg.ok { color:#88aa66; }
    .ld-btn:disabled { opacity:0.4;cursor:default; }
    .ld-toast {
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,8,6,0.95);border:1px solid #ffaa44;border-radius:6px;
      padding:12px 24px;color:#e8d5b0;font-family:monospace;font-size:13px;
      z-index:6000;pointer-events:none;letter-spacing:1px;
    }
  `;
  document.head.appendChild(s);
}

// ── Panel Creation ──────────────────────────────────────────────

export interface EditorUIElements {
  container: HTMLDivElement;
  nameInput: HTMLInputElement;
  subtoolEl: HTMLDivElement;
  propsEl: HTMLDivElement;
  toolBtns: HTMLButtonElement[];
  /** The current wave's minimum section length in bars (empty = default 1). */
  barsInput: HTMLInputElement;
}

export interface EditorUICallbacks {
  onNameChange: (name: string) => void;
  onToolSelect: (tool: Tool) => void;
  onPlayTest: () => void;
  onSong: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExport: () => void;
  onImport: () => void;
  onBack: () => void;
  onWaveAdd: () => void;
  onWaveDelete: () => void;
  onWaveDuplicate: () => void;
  /** The bars field changed; `commit` is true when editing ends (Enter or leaving the field). */
  onWaveBarsChange: (text: string, commit: boolean) => void;
}

export function createEditorPanels(levelName: string, activeTool: Tool, callbacks: EditorUICallbacks): EditorUIElements {
  injectEditorStyles();
  const container = document.createElement("div");

  // Top bar
  const top = document.createElement("div");
  top.className = "ld-bar ld-top";
  top.innerHTML = `<span class="ld-title">LEVEL DESIGNER</span>`;

  const nameInput = document.createElement("input");
  nameInput.className = "ld-input";
  nameInput.value = levelName;
  nameInput.placeholder = "Level name";
  nameInput.maxLength = MAX_LEVEL_NAME_LENGTH;
  nameInput.addEventListener("input", () => callbacks.onNameChange(nameInput.value));
  top.appendChild(nameInput);

  const spacer = document.createElement("div");
  spacer.style.flex = "1";
  top.appendChild(spacer);

  for (const [label, cls, fn] of [
    ["TEST", "primary", callbacks.onPlayTest],
    ["SONG", "", callbacks.onSong],
    ["SAVE", "", callbacks.onSave],
    ["LOAD", "", callbacks.onLoad],
    ["EXPORT", "", callbacks.onExport],
    ["IMPORT", "", callbacks.onImport],
    ["BACK", "", callbacks.onBack],
  ] as [string, string, () => void][]) {
    const btn = document.createElement("button");
    btn.className = `ld-btn${cls ? ` ${cls}` : ""}`;
    btn.textContent = label;
    btn.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    top.appendChild(btn);
  }
  container.appendChild(top);

  // Tool bar
  const toolBar = document.createElement("div");
  toolBar.className = "ld-bar ld-tool-bar";
  const toolBtns: HTMLButtonElement[] = [];

  for (const [t, label] of [["select", "SELECT"], ["enemy", "ENEMY"], ["wall", "WALL"], ["asteroid", "ROCK"], ["erase", "ERASE"]] as [Tool, string][]) {
    const btn = document.createElement("button");
    btn.className = `ld-tool${t === activeTool ? " active" : ""}`;
    btn.textContent = label;
    btn.addEventListener("click", (e) => { e.stopPropagation(); callbacks.onToolSelect(t); });
    toolBtns.push(btn);
    toolBar.appendChild(btn);
  }

  const sep1 = document.createElement("span");
  sep1.className = "ld-sep";
  sep1.textContent = "|";
  toolBar.appendChild(sep1);

  const subtoolEl = document.createElement("div");
  subtoolEl.style.cssText = "display:flex;gap:6px;align-items:center;";
  toolBar.appendChild(subtoolEl);

  const sep2 = document.createElement("span");
  sep2.className = "ld-sep";
  sep2.textContent = "|";
  toolBar.appendChild(sep2);

  const propsEl = document.createElement("div");
  propsEl.className = "ld-props";
  toolBar.appendChild(propsEl);

  container.appendChild(toolBar);

  // Wave bar
  const waveBar = document.createElement("div");
  waveBar.className = "ld-bar ld-bottom";
  waveBar.id = "ld-wave-bar";

  const waveTabs = document.createElement("div");
  waveTabs.id = "ld-wave-tabs";
  waveTabs.style.cssText = "display:flex;gap:4px;align-items:center;";
  waveBar.appendChild(waveTabs);

  const barsSep = document.createElement("span");
  barsSep.className = "ld-sep";
  barsSep.textContent = "|";
  waveBar.appendChild(barsSep);

  const barsHelp = "Minimum section length: the next wave starts no sooner than this many bars after this one (default 1)";
  const barsLabel = makeLabel("BARS");
  barsLabel.title = barsHelp;
  waveBar.appendChild(barsLabel);
  const barsInput = document.createElement("input");
  barsInput.className = "ld-input ld-bars";
  barsInput.type = "number";
  barsInput.min = "1";
  barsInput.max = String(MAX_WAVE_BARS);
  barsInput.step = "1";
  barsInput.placeholder = "1";
  barsInput.title = barsHelp;
  barsInput.addEventListener("input", () => callbacks.onWaveBarsChange(barsInput.value, false));
  barsInput.addEventListener("change", () => callbacks.onWaveBarsChange(barsInput.value, true));
  waveBar.appendChild(barsInput);

  const waveSpacer = document.createElement("div");
  waveSpacer.style.flex = "1";
  waveBar.appendChild(waveSpacer);

  for (const [label, fn] of [
    ["+", callbacks.onWaveAdd],
    ["-", callbacks.onWaveDelete],
    ["DUP", callbacks.onWaveDuplicate],
  ] as [string, () => void][]) {
    const btn = document.createElement("button");
    btn.className = "ld-btn";
    btn.textContent = label;
    btn.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    waveBar.appendChild(btn);
  }

  container.appendChild(waveBar);

  for (const evt of ["pointerdown", "pointerup", "pointermove", "click", "keydown"] as const) {
    container.addEventListener(evt, (e) => e.stopPropagation());
  }

  return { container, nameInput, subtoolEl, propsEl, toolBtns, barsInput };
}

// ── Refresh Helpers ─────────────────────────────────────────────

const TOOL_LIST: Tool[] = ["select", "enemy", "wall", "asteroid", "erase"];

export function updateToolButtons(toolBtns: HTMLButtonElement[], activeTool: Tool) {
  toolBtns.forEach((btn, i) => {
    btn.className = `ld-tool${TOOL_LIST[i] === activeTool ? " active" : ""}`;
  });
}

export function refreshSubtool(
  el: HTMLDivElement,
  tool: Tool,
  enemyType: EnemyType,
  wallType: WallType,
  asteroidSize: string,
  onEnemyType: (t: EnemyType) => void,
  onWallType: (t: WallType) => void,
  onAsteroidSize: (s: string) => void,
) {
  el.innerHTML = "";

  if (tool === "enemy") {
    el.appendChild(makeLabel("TYPE"));
    el.appendChild(makeSelect(ENEMY_TYPES, enemyType, (v) => onEnemyType(v as EnemyType), true));
    const dot = document.createElement("div");
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:#${(getEnemyVis(enemyType)?.color ?? 0xffffff).toString(16).padStart(6, "0")}`;
    el.appendChild(dot);
  } else if (tool === "wall") {
    el.appendChild(makeLabel("TYPE"));
    el.appendChild(makeSelect(WALL_TYPE_LIST, wallType, (v) => onWallType(v as WallType), true));
  } else if (tool === "asteroid") {
    el.appendChild(makeLabel("SIZE"));
    el.appendChild(makeSelect([...ASTEROID_SIZES], asteroidSize, onAsteroidSize, true));
  }
}

export function refreshProps(
  el: HTMLDivElement,
  selected: Selection | null,
  wave: LevelWave,
  shipRx: number,
  shipRy: number,
) {
  if (!selected) {
    const eCount = wave.enemies.length;
    const wCount = wave.walls?.length ?? 0;
    const aCount = wave.asteroids?.length ?? 0;
    el.textContent = `${eCount} enemies, ${wCount} walls, ${aCount} asteroids`;
    return;
  }

  const { kind, index } = selected;
  if (kind === "ship") {
    el.textContent = `Ship start (${shipRx.toFixed(2)}, ${shipRy.toFixed(2)})`;
  } else if (kind === "enemy") {
    const e = wave.enemies[index];
    if (e) el.textContent = `${e.type} at (${e.rx.toFixed(2)}, ${e.ry.toFixed(2)})`;
  } else if (kind === "wall") {
    const w = wave.walls?.[index];
    if (w) el.textContent = `${w.type} wall ${w.rw.toFixed(2)}x${w.rh.toFixed(2)} at (${w.rx.toFixed(2)}, ${w.ry.toFixed(2)})${w.type === "glass" ? ` HP:${w.hp ?? 3}` : ""}`;
  } else if (kind === "asteroid") {
    const a = wave.asteroids?.[index];
    if (a) el.textContent = `${a.size} asteroid at (${a.rx.toFixed(2)}, ${a.ry.toFixed(2)})`;
  }
}

export function refreshWaveBar(waves: LevelWave[], currentWave: number, onSwitch: (i: number) => void) {
  const tabs = document.getElementById("ld-wave-tabs");
  if (!tabs) return;
  tabs.innerHTML = "";
  for (let i = 0; i < waves.length; i++) {
    const btn = document.createElement("button");
    const bars = waves[i].bars;
    btn.className = `ld-wave-tab${i === currentWave ? " active" : ""}`;
    // "W2:4" = wave 2 lasts at least 4 bars (the progression's ":BARS" notation).
    btn.textContent = bars !== undefined ? `W${i + 1}:${bars}` : `W${i + 1}`;
    btn.title = `Wave ${i + 1}: at least ${bars ?? 1} bar${(bars ?? 1) === 1 ? "" : "s"} before the next wave`;
    btn.addEventListener("click", (e) => { e.stopPropagation(); onSwitch(i); });
    tabs.appendChild(btn);
  }
}

// ── Modals ──────────────────────────────────────────────────────

export function showToast(msg: string) {
  const toast = document.createElement("div");
  toast.className = "ld-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

export function showLoadModal(levels: LevelDef[], onLoad: (level: LevelDef) => void) {
  const modal = createModal();
  const box = createModalBox(modal, "LOAD LEVEL");

  if (levels.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "color:#555;font-size:12px;padding:16px 0;text-align:center;";
    empty.textContent = "No saved levels";
    box.appendChild(empty);
  }

  for (const lv of levels) {
    const item = document.createElement("div");
    item.className = "ld-modal-item";

    // Built with textContent: level names come from saved/imported data (no HTML injection).
    const info = document.createElement("div");
    info.style.flex = "1";
    const name = document.createElement("div");
    name.className = "ld-modal-name";
    name.textContent = lv.name;
    const waves = Array.isArray(lv.waves) ? lv.waves : [];
    const enemyCount = waves.reduce((s, w) => s + (Array.isArray(w?.enemies) ? w.enemies.length : 0), 0);
    const desc = document.createElement("div");
    desc.className = "ld-modal-desc";
    desc.textContent = `${waves.length} waves, ${enemyCount} enemies`;
    info.append(name, desc);
    item.appendChild(info);

    item.addEventListener("click", (e) => { e.stopPropagation(); onLoad(lv); modal.remove(); });
    box.appendChild(item);
  }

  appendCloseButton(box, modal);
  document.body.appendChild(modal);
}

export function showImportExportModal(mode: "IMPORT" | "EXPORT", content: string, onImport?: (def: LevelDef) => void) {
  const modal = createModal();
  const box = createModalBox(modal, mode);

  const ta = document.createElement("textarea");
  ta.className = "ld-modal-textarea";
  ta.value = content;
  if (mode === "IMPORT") ta.placeholder = "Paste level JSON here...";
  else ta.readOnly = true;
  box.appendChild(ta);

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:8px;margin-top:12px;";

  if (mode === "IMPORT" && onImport) {
    const errorEl = document.createElement("div");
    errorEl.className = "ld-modal-error";
    errorEl.setAttribute("role", "alert");
    errorEl.hidden = true;
    box.appendChild(errorEl);

    const showError = (msg: string) => {
      ta.style.borderColor = "#ff4444";
      errorEl.textContent = msg;
      errorEl.hidden = false;
    };
    ta.addEventListener("input", () => {
      ta.style.borderColor = "";
      errorEl.hidden = true;
    });

    const loadBtn = document.createElement("button");
    loadBtn.className = "ld-btn primary";
    loadBtn.textContent = "LOAD";
    loadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      let parsed: unknown;
      try {
        parsed = JSON.parse(ta.value);
      } catch (err) {
        showError(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      const def = normalizeLevelDef(parsed);
      if (!def) {
        showError("Not a valid level: expected a JSON object with a numeric \"id\" and a \"waves\" array.");
        return;
      }
      onImport(def);
      modal.remove();
      showToast("Level imported");
    });
    btnRow.appendChild(loadBtn);
  }

  appendCloseButton(btnRow, modal);
  box.appendChild(btnRow);
  document.body.appendChild(modal);
}

// ── Song settings ───────────────────────────────────────────────

const KEY_CHOICES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export interface SongModalOptions {
  /** The level's current music (normalized), or undefined. */
  music: LevelMusic | undefined;
  /** The player's own theme: what "player's choice" (and a locked theme) plays. */
  playerPalette: Palette;
  isThemeUnlocked: (id: string) => boolean;
  /** APPLY with valid fields: the new music, or undefined when every field is the theme's. */
  onApply: (music: LevelMusic | undefined) => void;
  /** Starts auditioning `music`; `onEnd` runs when it stops; returns a stop function. */
  onPreview?: (music: LevelMusic | undefined, onEnd: () => void) => () => void;
}

/**
 * Edits a level's song settings: theme (player's choice or a palette), tempo, key, mode and
 * progression, with validation feedback. Empty fields fall back to the theme. Unknown music fields
 * are kept. PREVIEW auditions the current fields; the preview stops when the modal closes.
 */
export function showSongModal(opts: SongModalOptions) {
  let stopPreview: (() => void) | null = null;
  const previewBtn = document.createElement("button");
  const endPreview = () => {
    const stop = stopPreview;
    stopPreview = null;
    previewBtn.textContent = "PREVIEW";
    stop?.();
  };
  const modal = createModal(endPreview);
  const close = () => {
    endPreview();
    modal.remove();
  };
  const box = createModalBox(modal, "SONG");
  box.style.maxWidth = "460px";

  const { theme, bpm, key, mode, progression, ...extra } = opts.music ?? {};

  const themeSel = makeSelect(["", ...ALL_PALETTES.map((p) => p.id)], theme ?? "", () => refresh(), false);
  for (const o of Array.from(themeSel.options)) {
    const p = ALL_PALETTES.find((x) => x.id === o.value);
    o.textContent = p ? `${p.name}${opts.isThemeUnlocked(p.id) ? "" : " (locked)"}` : `Player's choice (${opts.playerPalette.name})`;
  }
  const themeMsg = addFormRow(box, "THEME", themeSel);

  const bpmInput = document.createElement("input");
  bpmInput.className = "ld-input";
  bpmInput.type = "number";
  bpmInput.min = String(MIN_LEVEL_BPM);
  bpmInput.max = String(MAX_LEVEL_BPM);
  bpmInput.step = "1";
  bpmInput.value = bpm !== undefined ? String(bpm) : "";
  bpmInput.addEventListener("input", () => refresh());
  const bpmMsg = addFormRow(box, "TEMPO (BPM)", bpmInput);

  const keys = key !== undefined && !KEY_CHOICES.includes(key) ? [...KEY_CHOICES, key] : KEY_CHOICES;
  const keySel = makeSelect(["", ...keys], key ?? "", () => refresh(), false);
  addFormRow(box, "KEY", keySel);

  const modeSel = makeSelect(["", ...HEPTATONIC_MODES], mode ?? "", () => refresh(), false);
  addFormRow(box, "MODE", modeSel);

  const progInput = document.createElement("input");
  progInput.className = "ld-input";
  progInput.value = progression ?? "";
  progInput.spellcheck = false;
  progInput.addEventListener("input", () => refresh());
  const progMsg = addFormRow(box, "PROGRESSION", progInput);

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;";
  const applyBtn = document.createElement("button");
  applyBtn.className = "ld-btn primary";
  applyBtn.textContent = "APPLY";
  const clearBtn = document.createElement("button");
  clearBtn.className = "ld-btn";
  clearBtn.textContent = "CLEAR";
  clearBtn.title = "Every field back to the theme's";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "ld-btn";
  cancelBtn.textContent = "CANCEL";
  previewBtn.className = "ld-btn";
  previewBtn.textContent = "PREVIEW";
  previewBtn.title = "Play 4 bars of the progression";
  btnRow.append(applyBtn, ...(opts.onPreview ? [previewBtn] : []), clearBtn, cancelBtn);
  box.appendChild(btnRow);

  /** The music the fields describe (valid fields only) and whether any field is invalid. */
  const read = (): { music: LevelMusic | undefined; invalid: boolean } => {
    const raw: Record<string, unknown> = { ...extra };
    let invalid = false;
    if (themeSel.value) raw.theme = themeSel.value;
    const bpmText = bpmInput.value.trim();
    if (bpmText) {
      const n = Number(bpmText);
      if (normalizeBpm(n) === undefined) invalid = true;
      else raw.bpm = n;
    }
    if (keySel.value) raw.key = keySel.value;
    if (modeSel.value) raw.mode = modeSel.value;
    const progText = progInput.value.trim();
    if (progText) {
      if (progressionError(progText) !== null) invalid = true;
      else raw.progression = progText;
    }
    return { music: normalizeLevelMusic(raw), invalid };
  };

  const setMsg = (el: HTMLDivElement, text: string, kind: "" | "error" | "ok" = "") => {
    el.textContent = text;
    el.className = `ld-form-msg${kind ? ` ${kind}` : ""}`;
  };

  function refresh() {
    // What an empty field falls back to: the chosen theme (if this player has it) or their own.
    const chosen = themeSel.value;
    const base = levelPalette(opts.playerPalette, chosen ? { theme: chosen } : undefined, opts.isThemeUnlocked);
    if (!chosen) setMsg(themeMsg, "Each player hears their own sound theme");
    else if (opts.isThemeUnlocked(chosen)) setMsg(themeMsg, "Used for players who have unlocked it");
    else setMsg(themeMsg, `You haven't unlocked it: you'll hear ${opts.playerPalette.name}`, "error");

    bpmInput.placeholder = `${base.bpm} (theme)`;
    keySel.options[0].textContent = `Theme's (${base.key})`;
    modeSel.options[0].textContent = `Theme's (${base.mode})`;
    progInput.placeholder = base.progression;

    const bpmText = bpmInput.value.trim();
    if (!bpmText) setMsg(bpmMsg, "");
    else if (normalizeBpm(Number(bpmText)) === undefined) setMsg(bpmMsg, `Tempo must be ${MIN_LEVEL_BPM}–${MAX_LEVEL_BPM}`, "error");
    else setMsg(bpmMsg, "");

    const progText = progInput.value.trim();
    const err = progText ? progressionError(progText) : null;
    if (!progText) setMsg(progMsg, "Roman numerals, e.g. i VI III VII or i:2 iv V7");
    else if (err !== null) setMsg(progMsg, err, "error");
    else {
      const chords = parseProgression(progText);
      const bars = chords.reduce((sum, c) => sum + c.bars, 0);
      setMsg(progMsg, `✓ ${chords.length} chord${chords.length === 1 ? "" : "s"} over ${bars} bar${bars === 1 ? "" : "s"}`, "ok");
    }

    applyBtn.disabled = read().invalid;
  }

  applyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const { music, invalid } = read();
    if (invalid) return;
    opts.onApply(music);
    close();
    showToast("Song settings applied");
  });
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    themeSel.value = "";
    bpmInput.value = "";
    keySel.value = "";
    modeSel.value = "";
    progInput.value = "";
    refresh();
  });
  cancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });
  previewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (stopPreview || !opts.onPreview) {
      endPreview();
      return;
    }
    previewBtn.textContent = "STOP";
    stopPreview = opts.onPreview(read().music, () => {
      stopPreview = null;
      previewBtn.textContent = "PREVIEW";
    });
  });

  refresh();
  document.body.appendChild(modal);
}

/** A labelled form row in `box`; returns the message line under it. */
function addFormRow(box: HTMLDivElement, label: string, control: HTMLElement): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "ld-form-row";
  const labelEl = document.createElement("span");
  labelEl.className = "ld-form-label";
  labelEl.textContent = label;
  row.append(labelEl, control);
  const msg = document.createElement("div");
  msg.className = "ld-form-msg";
  box.append(row, msg);
  return msg;
}

// ── Helpers ─────────────────────────────────────────────────────

function makeLabel(text: string): HTMLSpanElement {
  const label = document.createElement("span");
  label.className = "ld-label";
  label.textContent = text;
  return label;
}

function makeSelect(options: string[], value: string, onChange: (v: string) => void, capitalize: boolean): HTMLSelectElement {
  const sel = document.createElement("select");
  sel.className = "ld-select";
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = capitalize ? opt.charAt(0).toUpperCase() + opt.slice(1) : opt;
    o.selected = opt === value;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

/** A full-screen modal; clicking the backdrop closes it (and calls `onClose`). */
function createModal(onClose?: () => void): HTMLDivElement {
  const modal = document.createElement("div");
  modal.className = "ld-modal";
  modal.addEventListener("click", (e) => {
    if (e.target !== modal) return;
    modal.remove();
    onClose?.();
  });
  for (const evt of ["pointerdown", "pointerup", "pointermove", "keydown"] as const) {
    modal.addEventListener(evt, (e) => e.stopPropagation());
  }
  return modal;
}

function createModalBox(modal: HTMLDivElement, title: string): HTMLDivElement {
  const box = document.createElement("div");
  box.className = "ld-modal-box";
  const titleEl = document.createElement("div");
  titleEl.className = "ld-modal-title";
  titleEl.textContent = title;
  box.appendChild(titleEl);
  modal.appendChild(box);
  return box;
}

function appendCloseButton(parent: HTMLElement, modal: HTMLDivElement) {
  const btn = document.createElement("button");
  btn.className = "ld-btn";
  btn.textContent = "CLOSE";
  btn.style.marginTop = "12px";
  btn.addEventListener("click", (e) => { e.stopPropagation(); modal.remove(); });
  parent.appendChild(btn);
}
