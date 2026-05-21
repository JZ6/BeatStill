import Phaser from "phaser";
import type { EnemyType } from "../objects/enemies";
import type { WallType } from "../objects/Wall";
import type { LevelDef, LevelWave, LevelEnemy, LevelWall, LevelAsteroid } from "../systems/Levels";
import { GAME_W, GAME_H } from "../systems/GameConfig";
import { saveCustomLevel, loadCustomLevels, saveEditorState, loadEditorState, nextCustomId } from "../systems/CustomLevels";

const ENEMY_TYPES: EnemyType[] = ["basic", "tracker", "sniper", "spiral", "tank", "swarm", "snake", "circler", "sentinel", "phantom"];
const WALL_TYPE_LIST: WallType[] = ["solid", "bounce", "glass"];
const ASTEROID_SIZES = ["large", "medium", "small"] as const;

const ENEMY_VIS: Record<string, { color: number; sides: number; radius: number }> = {
  basic:    { color: 0x44ff44, sides: 4, radius: 16 },
  tracker:  { color: 0xff8800, sides: 3, radius: 14 },
  sniper:   { color: 0xff2266, sides: 5, radius: 12 },
  spiral:   { color: 0xaa44ff, sides: 7, radius: 18 },
  tank:     { color: 0xff4444, sides: 8, radius: 22 },
  swarm:    { color: 0xffff44, sides: 0, radius: 10 },
  snake:    { color: 0x44ddff, sides: -1, radius: 14 },
  circler:  { color: 0x44ff88, sides: 6, radius: 16 },
  sentinel: { color: 0xffaa22, sides: 12, radius: 28 },
  phantom:  { color: 0x4488ff, sides: -1, radius: 24 },
};

const WALL_COLORS: Record<WallType, number> = { solid: 0x887766, bounce: 0x4488ff, glass: 0xff6644 };
const ASTEROID_RADII: Record<string, number> = { large: 40, medium: 24, small: 12 };

type Tool = "select" | "enemy" | "wall" | "asteroid" | "erase";
interface Selection { kind: "enemy" | "wall" | "asteroid" | "ship"; index: number }

const STYLE_ID = "ld-styles";

function injectStyles() {
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
    .ld-toast {
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,8,6,0.95);border:1px solid #ffaa44;border-radius:6px;
      padding:12px 24px;color:#e8d5b0;font-family:monospace;font-size:13px;
      z-index:6000;pointer-events:none;letter-spacing:1px;
    }
  `;
  document.head.appendChild(s);
}

export class LevelDesignerScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;

  private levelId = 0;
  private levelName = "Custom Level";
  private levelDesc = "";
  private shipRx = 0.5;
  private shipRy = 0.8;
  private waves: LevelWave[] = [{ enemies: [] }];
  private currentWave = 0;

  private tool: Tool = "enemy";
  private enemyType: EnemyType = "basic";
  private wallType: WallType = "solid";
  private wallHp = 3;
  private asteroidSize: (typeof ASTEROID_SIZES)[number] = "medium";
  private selected: Selection | null = null;

  private dragging = false;
  private dragOffRx = 0;
  private dragOffRy = 0;
  private wallStart: { rx: number; ry: number } | null = null;
  private wallPreview: { rx: number; ry: number; rw: number; rh: number } | null = null;

  private ui: HTMLDivElement | null = null;
  private propsEl!: HTMLDivElement;
  private subtoolEl!: HTMLDivElement;
  private toolBtns: HTMLButtonElement[] = [];
  private nameInput!: HTMLInputElement;

  constructor() {
    super("LevelDesignerScene");
  }

  create(data?: { levelDef?: LevelDef }) {
    if (data?.levelDef) {
      this.loadLevel(data.levelDef);
    } else {
      const saved = loadEditorState();
      if (saved) this.loadLevel(saved);
      else this.resetLevel();
    }

    this.g = this.add.graphics();
    this.createUI();
    this.setupInput();
    this.refreshWaveBar();
    this.refreshSubtool();
    this.refreshProps();

    this.events.once("shutdown", () => {
      this.persistState();
      this.ui?.remove();
      this.ui = null;
    });
  }

  update() {
    this.drawAll();
  }

  private loadLevel(def: LevelDef) {
    this.levelId = def.id;
    this.levelName = def.name;
    this.levelDesc = def.description;
    this.shipRx = def.shipRx ?? 0.5;
    this.shipRy = def.shipRy ?? 0.8;
    this.waves = def.waves.map((w) => ({
      enemies: [...w.enemies],
      walls: w.walls ? [...w.walls] : undefined,
      asteroids: w.asteroids ? [...w.asteroids] : undefined,
      initialBullets: w.initialBullets ? [...w.initialBullets] : undefined,
    }));
    this.currentWave = 0;
    this.selected = null;
  }

  private resetLevel() {
    this.levelId = 0;
    this.levelName = "Custom Level";
    this.levelDesc = "";
    this.shipRx = 0.5;
    this.shipRy = 0.8;
    this.waves = [{ enemies: [] }];
    this.currentWave = 0;
    this.selected = null;
  }

  private toLevelDef(): LevelDef {
    return {
      id: this.levelId || nextCustomId(),
      name: this.levelName,
      description: this.levelDesc,
      shipRx: this.shipRx,
      shipRy: this.shipRy,
      waves: this.waves,
    };
  }

  private persistState() {
    saveEditorState(this.toLevelDef());
  }

  private wave(): LevelWave {
    return this.waves[this.currentWave];
  }

  // ── UI Creation ───────────────────────────────────────────────

  private createUI() {
    injectStyles();
    if (this.ui) this.ui.remove();
    const container = document.createElement("div");

    // Top bar
    const top = document.createElement("div");
    top.className = "ld-bar ld-top";
    top.innerHTML = `<span class="ld-title">LEVEL DESIGNER</span>`;

    this.nameInput = document.createElement("input");
    this.nameInput.className = "ld-input";
    this.nameInput.value = this.levelName;
    this.nameInput.placeholder = "Level name";
    this.nameInput.addEventListener("input", () => { this.levelName = this.nameInput.value; });
    top.appendChild(this.nameInput);

    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    top.appendChild(spacer);

    for (const [label, cls, fn] of [
      ["TEST", "primary", () => this.playTest()],
      ["SAVE", "", () => this.saveLevelAction()],
      ["LOAD", "", () => this.showLoadModal()],
      ["EXPORT", "", () => this.exportLevel()],
      ["IMPORT", "", () => this.showImportModal()],
      ["BACK", "", () => this.goBack()],
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
    this.toolBtns = [];

    for (const [t, label] of [["select", "SELECT"], ["enemy", "ENEMY"], ["wall", "WALL"], ["asteroid", "ROCK"], ["erase", "ERASE"]] as [Tool, string][]) {
      const btn = document.createElement("button");
      btn.className = `ld-tool${t === this.tool ? " active" : ""}`;
      btn.textContent = label;
      btn.addEventListener("click", (e) => { e.stopPropagation(); this.setTool(t); });
      this.toolBtns.push(btn);
      toolBar.appendChild(btn);
    }

    const sep1 = document.createElement("span");
    sep1.className = "ld-sep";
    sep1.textContent = "|";
    toolBar.appendChild(sep1);

    this.subtoolEl = document.createElement("div");
    this.subtoolEl.style.display = "flex";
    this.subtoolEl.style.gap = "6px";
    this.subtoolEl.style.alignItems = "center";
    toolBar.appendChild(this.subtoolEl);

    const sep2 = document.createElement("span");
    sep2.className = "ld-sep";
    sep2.textContent = "|";
    toolBar.appendChild(sep2);

    this.propsEl = document.createElement("div");
    this.propsEl.className = "ld-props";
    toolBar.appendChild(this.propsEl);

    container.appendChild(toolBar);

    // Wave bar
    const waveBar = document.createElement("div");
    waveBar.className = "ld-bar ld-bottom";
    waveBar.id = "ld-wave-bar";

    const waveTabs = document.createElement("div");
    waveTabs.id = "ld-wave-tabs";
    waveTabs.style.cssText = "display:flex;gap:4px;align-items:center;";
    waveBar.appendChild(waveTabs);

    const waveSpacer = document.createElement("div");
    waveSpacer.style.flex = "1";
    waveBar.appendChild(waveSpacer);

    for (const [label, fn] of [
      ["+", () => this.addWave()],
      ["-", () => this.deleteWave()],
      ["DUP", () => this.duplicateWave()],
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

    document.body.appendChild(container);
    this.ui = container;
  }

  private setTool(t: Tool) {
    this.tool = t;
    this.selected = null;
    this.toolBtns.forEach((btn, i) => {
      const tools: Tool[] = ["select", "enemy", "wall", "asteroid", "erase"];
      btn.className = `ld-tool${tools[i] === t ? " active" : ""}`;
    });
    this.refreshSubtool();
    this.refreshProps();
  }

  private refreshSubtool() {
    const el = this.subtoolEl;
    el.innerHTML = "";

    if (this.tool === "enemy") {
      const label = document.createElement("span");
      label.className = "ld-label";
      label.textContent = "TYPE";
      el.appendChild(label);

      const sel = document.createElement("select");
      sel.className = "ld-select";
      for (const t of ENEMY_TYPES) {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
        opt.selected = t === this.enemyType;
        sel.appendChild(opt);
      }
      sel.addEventListener("change", () => { this.enemyType = sel.value as EnemyType; });
      el.appendChild(sel);

      const dot = document.createElement("div");
      dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:#${(ENEMY_VIS[this.enemyType]?.color ?? 0xffffff).toString(16).padStart(6, "0")}`;
      el.appendChild(dot);
    } else if (this.tool === "wall") {
      const label = document.createElement("span");
      label.className = "ld-label";
      label.textContent = "TYPE";
      el.appendChild(label);

      const sel = document.createElement("select");
      sel.className = "ld-select";
      for (const t of WALL_TYPE_LIST) {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
        opt.selected = t === this.wallType;
        sel.appendChild(opt);
      }
      sel.addEventListener("change", () => { this.wallType = sel.value as WallType; });
      el.appendChild(sel);
    } else if (this.tool === "asteroid") {
      const label = document.createElement("span");
      label.className = "ld-label";
      label.textContent = "SIZE";
      el.appendChild(label);

      const sel = document.createElement("select");
      sel.className = "ld-select";
      for (const sz of ASTEROID_SIZES) {
        const opt = document.createElement("option");
        opt.value = sz;
        opt.textContent = sz.charAt(0).toUpperCase() + sz.slice(1);
        opt.selected = sz === this.asteroidSize;
        sel.appendChild(opt);
      }
      sel.addEventListener("change", () => { this.asteroidSize = sel.value as typeof this.asteroidSize; });
      el.appendChild(sel);
    }
  }

  private refreshProps() {
    if (!this.selected) {
      const w = this.wave();
      const eCount = w.enemies.length;
      const wCount = w.walls?.length ?? 0;
      const aCount = w.asteroids?.length ?? 0;
      this.propsEl.textContent = `${eCount} enemies, ${wCount} walls, ${aCount} asteroids`;
      return;
    }

    const { kind, index } = this.selected;
    if (kind === "ship") {
      this.propsEl.textContent = `Ship start (${this.shipRx.toFixed(2)}, ${this.shipRy.toFixed(2)})`;
    } else if (kind === "enemy") {
      const e = this.wave().enemies[index];
      if (e) this.propsEl.textContent = `${e.type} at (${e.rx.toFixed(2)}, ${e.ry.toFixed(2)})`;
    } else if (kind === "wall") {
      const w = this.wave().walls?.[index];
      if (w) this.propsEl.textContent = `${w.type} wall ${w.rw.toFixed(2)}x${w.rh.toFixed(2)} at (${w.rx.toFixed(2)}, ${w.ry.toFixed(2)})${w.type === "glass" ? ` HP:${w.hp ?? 3}` : ""}`;
    } else if (kind === "asteroid") {
      const a = this.wave().asteroids?.[index];
      if (a) this.propsEl.textContent = `${a.size} asteroid at (${a.rx.toFixed(2)}, ${a.ry.toFixed(2)})`;
    }
  }

  private refreshWaveBar() {
    const tabs = document.getElementById("ld-wave-tabs");
    if (!tabs) return;
    tabs.innerHTML = "";
    for (let i = 0; i < this.waves.length; i++) {
      const btn = document.createElement("button");
      btn.className = `ld-wave-tab${i === this.currentWave ? " active" : ""}`;
      btn.textContent = `W${i + 1}`;
      btn.addEventListener("click", (e) => { e.stopPropagation(); this.switchWave(i); });
      tabs.appendChild(btn);
    }
  }

  private switchWave(i: number) {
    this.currentWave = i;
    this.selected = null;
    this.refreshWaveBar();
    this.refreshProps();
  }

  private addWave() {
    this.waves.push({ enemies: [] });
    this.switchWave(this.waves.length - 1);
  }

  private deleteWave() {
    if (this.waves.length <= 1) return;
    this.waves.splice(this.currentWave, 1);
    if (this.currentWave >= this.waves.length) this.currentWave = this.waves.length - 1;
    this.selected = null;
    this.refreshWaveBar();
    this.refreshProps();
  }

  private duplicateWave() {
    const src = this.wave();
    const dup: LevelWave = {
      enemies: src.enemies.map((e) => ({ ...e })),
      walls: src.walls?.map((w) => ({ ...w })),
      asteroids: src.asteroids?.map((a) => ({ ...a })),
      initialBullets: src.initialBullets?.map((b) => ({ ...b })),
    };
    this.waves.splice(this.currentWave + 1, 0, dup);
    this.switchWave(this.currentWave + 1);
  }

  // ── Input ─────────────────────────────────────────────────────

  private setupInput() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const rx = pointer.x / GAME_W;
      const ry = pointer.y / GAME_H;

      if (this.tool === "select") {
        const hit = this.hitTest(pointer.x, pointer.y);
        if (hit) {
          this.selected = hit;
          this.dragging = true;
          if (hit.kind === "ship") {
            this.dragOffRx = this.shipRx - rx;
            this.dragOffRy = this.shipRy - ry;
          } else if (hit.kind === "enemy") {
            const e = this.wave().enemies[hit.index];
            this.dragOffRx = e.rx - rx;
            this.dragOffRy = e.ry - ry;
          } else if (hit.kind === "wall") {
            const w = this.wave().walls![hit.index];
            this.dragOffRx = w.rx - rx;
            this.dragOffRy = w.ry - ry;
          } else if (hit.kind === "asteroid") {
            const a = this.wave().asteroids![hit.index];
            this.dragOffRx = a.rx - rx;
            this.dragOffRy = a.ry - ry;
          }
        } else {
          this.selected = null;
        }
        this.refreshProps();
      } else if (this.tool === "enemy") {
        this.wave().enemies.push({ type: this.enemyType, rx, ry });
        this.persistState();
        this.refreshProps();
      } else if (this.tool === "wall") {
        this.wallStart = { rx, ry };
        this.wallPreview = null;
      } else if (this.tool === "asteroid") {
        if (!this.wave().asteroids) this.wave().asteroids = [];
        this.wave().asteroids!.push({ rx, ry, size: this.asteroidSize });
        this.persistState();
        this.refreshProps();
      } else if (this.tool === "erase") {
        const hit = this.hitTest(pointer.x, pointer.y);
        if (hit && hit.kind !== "ship") {
          this.removeObject(hit);
          this.selected = null;
          this.refreshProps();
        }
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const rx = pointer.x / GAME_W;
      const ry = pointer.y / GAME_H;

      if (this.tool === "select" && this.dragging && this.selected) {
        const newRx = rx + this.dragOffRx;
        const newRy = ry + this.dragOffRy;
        if (this.selected.kind === "ship") {
          this.shipRx = Phaser.Math.Clamp(newRx, 0, 1);
          this.shipRy = Phaser.Math.Clamp(newRy, 0, 1);
        } else if (this.selected.kind === "enemy") {
          const e = this.wave().enemies[this.selected.index];
          if (e) { e.rx = newRx; e.ry = newRy; }
        } else if (this.selected.kind === "wall") {
          const w = this.wave().walls![this.selected.index];
          if (w) { w.rx = newRx; w.ry = newRy; }
        } else if (this.selected.kind === "asteroid") {
          const a = this.wave().asteroids![this.selected.index];
          if (a) { a.rx = newRx; a.ry = newRy; }
        }
        this.refreshProps();
      } else if (this.tool === "wall" && this.wallStart) {
        const x1 = Math.min(this.wallStart.rx, rx);
        const y1 = Math.min(this.wallStart.ry, ry);
        const x2 = Math.max(this.wallStart.rx, rx);
        const y2 = Math.max(this.wallStart.ry, ry);
        this.wallPreview = { rx: x1, ry: y1, rw: x2 - x1, rh: y2 - y1 };
      }
    });

    this.input.on("pointerup", () => {
      if (this.tool === "select" && this.dragging) {
        this.dragging = false;
        this.persistState();
      } else if (this.tool === "wall" && this.wallStart && this.wallPreview) {
        const { rw, rh } = this.wallPreview;
        if (rw > 0.01 && rh > 0.005) {
          if (!this.wave().walls) this.wave().walls = [];
          const wall: LevelWall = {
            rx: this.wallPreview.rx,
            ry: this.wallPreview.ry,
            rw: this.wallPreview.rw,
            rh: this.wallPreview.rh,
            type: this.wallType,
          };
          if (this.wallType === "glass") wall.hp = this.wallHp;
          this.wave().walls!.push(wall);
          this.persistState();
          this.refreshProps();
        }
        this.wallStart = null;
        this.wallPreview = null;
      }
    });

    if (this.input.keyboard) {
      this.input.keyboard.on("keydown-DELETE", () => this.deleteSelected());
      this.input.keyboard.on("keydown-BACKSPACE", () => this.deleteSelected());
    }
  }

  private hitTest(px: number, py: number): Selection | null {
    const w = this.wave();

    // Ship
    const sx = this.shipRx * GAME_W;
    const sy = this.shipRy * GAME_H;
    if (Math.hypot(px - sx, py - sy) < 20) return { kind: "ship", index: 0 };

    // Enemies (reverse for top-most first)
    for (let i = w.enemies.length - 1; i >= 0; i--) {
      const e = w.enemies[i];
      const ex = e.rx * GAME_W;
      const ey = e.ry * GAME_H;
      const r = ENEMY_VIS[e.type]?.radius ?? 16;
      if (Math.hypot(px - ex, py - ey) < r + 4) return { kind: "enemy", index: i };
    }

    // Walls
    if (w.walls) {
      for (let i = w.walls.length - 1; i >= 0; i--) {
        const wl = w.walls[i];
        const x1 = wl.rx * GAME_W;
        const y1 = wl.ry * GAME_H;
        const x2 = x1 + wl.rw * GAME_W;
        const y2 = y1 + wl.rh * GAME_H;
        if (px >= x1 - 4 && px <= x2 + 4 && py >= y1 - 4 && py <= y2 + 4) return { kind: "wall", index: i };
      }
    }

    // Asteroids
    if (w.asteroids) {
      for (let i = w.asteroids.length - 1; i >= 0; i--) {
        const a = w.asteroids[i];
        const ax = a.rx * GAME_W;
        const ay = a.ry * GAME_H;
        const r = ASTEROID_RADII[a.size] ?? 24;
        if (Math.hypot(px - ax, py - ay) < r + 4) return { kind: "asteroid", index: i };
      }
    }

    return null;
  }

  private removeObject(sel: Selection) {
    const w = this.wave();
    if (sel.kind === "enemy") w.enemies.splice(sel.index, 1);
    else if (sel.kind === "wall") w.walls?.splice(sel.index, 1);
    else if (sel.kind === "asteroid") w.asteroids?.splice(sel.index, 1);
    this.persistState();
  }

  private deleteSelected() {
    if (!this.selected || this.selected.kind === "ship") return;
    this.removeObject(this.selected);
    this.selected = null;
    this.refreshProps();
  }

  // ── Rendering ─────────────────────────────────────────────────

  private drawAll() {
    const g = this.g;
    g.clear();

    g.fillStyle(0x0a0806, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    g.lineStyle(1, 0x1a1612, 0.15);
    for (let x = 0; x <= GAME_W; x += 64) g.lineBetween(x, 0, x, GAME_H);
    for (let y = 0; y <= GAME_H; y += 64) g.lineBetween(0, y, GAME_W, y);

    g.lineStyle(1, 0x332211, 0.3);
    g.strokeRect(0, 0, GAME_W, GAME_H);

    for (let i = 0; i < this.waves.length; i++) {
      if (i === this.currentWave) continue;
      this.drawWave(this.waves[i], 0.12);
    }

    this.drawWave(this.wave(), 1);
    this.drawShipMarker();

    if (this.selected) this.drawSelectionHighlight();

    if (this.wallPreview) {
      const wp = this.wallPreview;
      g.lineStyle(2, WALL_COLORS[this.wallType], 0.8);
      g.strokeRect(wp.rx * GAME_W, wp.ry * GAME_H, wp.rw * GAME_W, wp.rh * GAME_H);
      g.fillStyle(WALL_COLORS[this.wallType], 0.15);
      g.fillRect(wp.rx * GAME_W, wp.ry * GAME_H, wp.rw * GAME_W, wp.rh * GAME_H);
    }
  }

  private drawWave(wave: LevelWave, alpha: number) {
    const g = this.g;

    if (wave.walls) {
      for (const w of wave.walls) {
        const color = WALL_COLORS[w.type];
        const x = w.rx * GAME_W;
        const y = w.ry * GAME_H;
        const ww = w.rw * GAME_W;
        const wh = w.rh * GAME_H;
        g.fillStyle(color, 0.2 * alpha);
        g.fillRect(x, y, ww, wh);
        g.lineStyle(2, color, 0.7 * alpha);
        g.strokeRect(x, y, ww, wh);
      }
    }

    if (wave.asteroids) {
      for (const a of wave.asteroids) {
        const r = ASTEROID_RADII[a.size] ?? 24;
        const x = a.rx * GAME_W;
        const y = a.ry * GAME_H;
        g.lineStyle(1.5, 0xff44ff, 0.5 * alpha);
        g.strokeCircle(x, y, r);
        g.fillStyle(0xff44ff, 0.08 * alpha);
        g.fillCircle(x, y, r);
      }
    }

    for (const e of wave.enemies) {
      this.drawEnemy(e.rx * GAME_W, e.ry * GAME_H, e.type, alpha);
    }
  }

  private drawEnemy(x: number, y: number, type: EnemyType, alpha: number) {
    const g = this.g;
    const vis = ENEMY_VIS[type];
    if (!vis) return;
    const { color, sides, radius: r } = vis;

    g.fillStyle(color, 0.12 * alpha);
    g.fillCircle(x, y, r + 6);

    if (sides === 0) {
      g.fillStyle(color, 0.25 * alpha);
      g.fillCircle(x, y, r);
      g.lineStyle(1.5, color, 0.8 * alpha);
      g.strokeCircle(x, y, r);
    } else if (sides === -1) {
      g.lineStyle(1.5, color, 0.8 * alpha);
      g.beginPath();
      g.moveTo(x, y - r);
      g.lineTo(x + r * 0.6, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r * 0.6, y);
      g.closePath();
      g.strokePath();
      g.fillStyle(color, 0.2 * alpha);
      g.beginPath();
      g.moveTo(x, y - r);
      g.lineTo(x + r * 0.6, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r * 0.6, y);
      g.closePath();
      g.fillPath();
    } else {
      g.lineStyle(1.5, color, 0.8 * alpha);
      g.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.strokePath();
      g.fillStyle(color, 0.2 * alpha);
      g.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillPath();
    }
  }

  private drawShipMarker() {
    const g = this.g;
    const x = this.shipRx * GAME_W;
    const y = this.shipRy * GAME_H;
    const r = 14;

    g.fillStyle(0x00ffff, 0.1);
    g.fillCircle(x, y, r + 8);

    g.lineStyle(2, 0x00ffff, 0.8);
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r * 0.7, y + r * 0.5);
    g.lineTo(x, y + r * 0.2);
    g.lineTo(x - r * 0.7, y + r * 0.5);
    g.closePath();
    g.strokePath();

    g.fillStyle(0x00ffff, 0.2);
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r * 0.7, y + r * 0.5);
    g.lineTo(x, y + r * 0.2);
    g.lineTo(x - r * 0.7, y + r * 0.5);
    g.closePath();
    g.fillPath();
  }

  private drawSelectionHighlight() {
    if (!this.selected) return;
    const g = this.g;
    const { kind, index } = this.selected;
    const time = this.time.now * 0.003;
    const pulse = 0.5 + Math.sin(time) * 0.3;

    g.lineStyle(2, 0xffaa44, pulse);

    if (kind === "ship") {
      g.strokeCircle(this.shipRx * GAME_W, this.shipRy * GAME_H, 22);
    } else if (kind === "enemy") {
      const e = this.wave().enemies[index];
      if (e) {
        const r = (ENEMY_VIS[e.type]?.radius ?? 16) + 8;
        g.strokeCircle(e.rx * GAME_W, e.ry * GAME_H, r);
      }
    } else if (kind === "wall") {
      const w = this.wave().walls?.[index];
      if (w) g.strokeRect(w.rx * GAME_W - 3, w.ry * GAME_H - 3, w.rw * GAME_W + 6, w.rh * GAME_H + 6);
    } else if (kind === "asteroid") {
      const a = this.wave().asteroids?.[index];
      if (a) {
        const r = (ASTEROID_RADII[a.size] ?? 24) + 8;
        g.strokeCircle(a.rx * GAME_W, a.ry * GAME_H, r);
      }
    }
  }

  // ── Actions ───────────────────────────────────────────────────

  private playTest() {
    this.persistState();
    const def = this.toLevelDef();
    this.scene.start("GameScene", { mode: "level", levelDef: def });
  }

  private saveLevelAction() {
    if (!this.levelId) this.levelId = nextCustomId();
    const def = this.toLevelDef();
    saveCustomLevel(def);
    this.showToast(`Saved: ${this.levelName}`);
  }

  private exportLevel() {
    const def = this.toLevelDef();
    const json = JSON.stringify(def, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      this.showToast("Copied to clipboard");
    }).catch(() => {
      this.showImportExportModal("EXPORT", json);
    });
  }

  private goBack() {
    this.persistState();
    this.scene.start("StartScene");
  }

  private showToast(msg: string) {
    const toast = document.createElement("div");
    toast.className = "ld-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }

  private showLoadModal() {
    const levels = loadCustomLevels();
    const modal = document.createElement("div");
    modal.className = "ld-modal";

    const box = document.createElement("div");
    box.className = "ld-modal-box";

    const title = document.createElement("div");
    title.className = "ld-modal-title";
    title.textContent = "LOAD LEVEL";
    box.appendChild(title);

    if (levels.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "color:#555;font-size:12px;padding:16px 0;text-align:center;";
      empty.textContent = "No saved levels";
      box.appendChild(empty);
    }

    for (const lv of levels) {
      const item = document.createElement("div");
      item.className = "ld-modal-item";
      item.innerHTML = `
        <div style="flex:1">
          <div class="ld-modal-name">${lv.name}</div>
          <div class="ld-modal-desc">${lv.waves.length} waves, ${lv.waves.reduce((s, w) => s + w.enemies.length, 0)} enemies</div>
        </div>
      `;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.loadLevel(lv);
        this.nameInput.value = this.levelName;
        this.refreshWaveBar();
        this.refreshProps();
        modal.remove();
      });
      box.appendChild(item);
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "ld-btn";
    closeBtn.textContent = "CLOSE";
    closeBtn.style.marginTop = "12px";
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); modal.remove(); });
    box.appendChild(closeBtn);

    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    for (const evt of ["pointerdown", "pointerup", "pointermove", "keydown"] as const) {
      modal.addEventListener(evt, (e) => e.stopPropagation());
    }
    document.body.appendChild(modal);
  }

  private showImportModal() {
    this.showImportExportModal("IMPORT", "");
  }

  private showImportExportModal(mode: "IMPORT" | "EXPORT", content: string) {
    const modal = document.createElement("div");
    modal.className = "ld-modal";

    const box = document.createElement("div");
    box.className = "ld-modal-box";

    const title = document.createElement("div");
    title.className = "ld-modal-title";
    title.textContent = mode;
    box.appendChild(title);

    const ta = document.createElement("textarea");
    ta.className = "ld-modal-textarea";
    ta.value = content;
    if (mode === "IMPORT") ta.placeholder = "Paste level JSON here...";
    else ta.readOnly = true;
    box.appendChild(ta);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;margin-top:12px;";

    if (mode === "IMPORT") {
      const loadBtn = document.createElement("button");
      loadBtn.className = "ld-btn primary";
      loadBtn.textContent = "LOAD";
      loadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          const def = JSON.parse(ta.value) as LevelDef;
          if (!def.waves || !Array.isArray(def.waves)) throw new Error("Invalid");
          this.loadLevel(def);
          this.nameInput.value = this.levelName;
          this.refreshWaveBar();
          this.refreshProps();
          modal.remove();
          this.showToast("Level imported");
        } catch {
          ta.style.borderColor = "#ff4444";
        }
      });
      btnRow.appendChild(loadBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "ld-btn";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); modal.remove(); });
    btnRow.appendChild(closeBtn);

    box.appendChild(btnRow);

    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    for (const evt of ["pointerdown", "pointerup", "pointermove", "keydown"] as const) {
      modal.addEventListener(evt, (e) => e.stopPropagation());
    }
    document.body.appendChild(modal);
  }
}
