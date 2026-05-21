import Phaser from "phaser";
import type { EnemyType } from "../objects/enemies";
import type { WallType } from "../objects/Wall";
import type { LevelDef, LevelWave, LevelWall } from "../systems/Levels";
import { GAME_W, GAME_H } from "../systems/GameConfig";
import { saveCustomLevel, loadCustomLevels, saveEditorState, loadEditorState, nextCustomId } from "../systems/CustomLevels";
import { ENEMY_VIS, WALL_COLORS, ASTEROID_RADII, type Tool, type Selection } from "../ui/LevelDesignerData";
import { drawEditorCanvas, type EditorDrawState } from "../ui/LevelDesignerRenderer";
import {
  createEditorPanels, updateToolButtons,
  refreshSubtool, refreshProps, refreshWaveBar,
  showToast, showLoadModal, showImportExportModal,
  type EditorUIElements,
} from "../ui/LevelDesignerUI";

export class LevelDesignerScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;

  private levelId = 0;
  private levelName = "Custom Level";
  private shipRx = 0.5;
  private shipRy = 0.8;
  private waves: LevelWave[] = [{ enemies: [] }];
  private currentWave = 0;

  private tool: Tool = "enemy";
  private enemyType: EnemyType = "basic";
  private wallType: WallType = "solid";
  private wallHp = 3;
  private asteroidSize: "large" | "medium" | "small" = "medium";
  private selected: Selection | null = null;

  private dragging = false;
  private dragOffRx = 0;
  private dragOffRy = 0;
  private wallStart: { rx: number; ry: number } | null = null;
  private wallPreview: { rx: number; ry: number; rw: number; rh: number } | null = null;

  private ui: EditorUIElements | null = null;
  private uiContainer: HTMLDivElement | null = null;

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
    this.doRefresh();

    this.events.once("shutdown", () => {
      this.persistState();
      this.uiContainer?.remove();
      this.uiContainer = null;
      this.ui = null;
    });
  }

  update() {
    const state: EditorDrawState = {
      waves: this.waves,
      currentWave: this.currentWave,
      shipRx: this.shipRx,
      shipRy: this.shipRy,
      selected: this.selected,
      wallType: this.wallType,
      wallPreview: this.wallPreview,
      time: this.time.now,
    };
    drawEditorCanvas(this.g, state);
  }

  // ── Level State ───────────────────────────────────────────────

  private loadLevel(def: LevelDef) {
    this.levelId = def.id;
    this.levelName = def.name;
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
      description: "",
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

  // ── UI ────────────────────────────────────────────────────────

  private createUI() {
    const elements = createEditorPanels(this.levelName, this.tool, {
      onNameChange: (name) => { this.levelName = name; },
      onToolSelect: (t) => this.setTool(t),
      onPlayTest: () => this.playTest(),
      onSave: () => this.saveLevelAction(),
      onLoad: () => this.showLoadAction(),
      onExport: () => this.exportLevel(),
      onImport: () => this.showImportAction(),
      onBack: () => this.goBack(),
      onWaveAdd: () => this.addWave(),
      onWaveDelete: () => this.deleteWave(),
      onWaveDuplicate: () => this.duplicateWave(),
    });

    document.body.appendChild(elements.container);
    this.uiContainer = elements.container;
    this.ui = elements;
  }

  private setTool(t: Tool) {
    this.tool = t;
    this.selected = null;
    if (this.ui) updateToolButtons(this.ui.toolBtns, t);
    this.doRefresh();
  }

  private doRefresh() {
    if (!this.ui) return;
    refreshSubtool(
      this.ui.subtoolEl, this.tool,
      this.enemyType, this.wallType, this.asteroidSize,
      (t) => { this.enemyType = t; },
      (t) => { this.wallType = t; },
      (s) => { this.asteroidSize = s as typeof this.asteroidSize; },
    );
    refreshProps(this.ui.propsEl, this.selected, this.wave(), this.shipRx, this.shipRy);
    refreshWaveBar(this.waves, this.currentWave, (i) => this.switchWave(i));
  }

  // ── Wave Management ───────────────────────────────────────────

  private switchWave(i: number) {
    this.currentWave = i;
    this.selected = null;
    this.doRefresh();
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
    this.doRefresh();
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
          const pos = this.getObjectPosition(hit);
          this.dragOffRx = pos.rx - rx;
          this.dragOffRy = pos.ry - ry;
        } else {
          this.selected = null;
        }
        this.doRefresh();
      } else if (this.tool === "enemy") {
        this.wave().enemies.push({ type: this.enemyType, rx, ry });
        this.persistState();
        this.doRefresh();
      } else if (this.tool === "wall") {
        this.wallStart = { rx, ry };
        this.wallPreview = null;
      } else if (this.tool === "asteroid") {
        if (!this.wave().asteroids) this.wave().asteroids = [];
        this.wave().asteroids!.push({ rx, ry, size: this.asteroidSize });
        this.persistState();
        this.doRefresh();
      } else if (this.tool === "erase") {
        const hit = this.hitTest(pointer.x, pointer.y);
        if (hit && hit.kind !== "ship") {
          this.removeObject(hit);
          this.selected = null;
          this.doRefresh();
        }
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const rx = pointer.x / GAME_W;
      const ry = pointer.y / GAME_H;

      if (this.tool === "select" && this.dragging && this.selected) {
        this.moveObject(this.selected, rx + this.dragOffRx, ry + this.dragOffRy);
        this.doRefresh();
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
          const wall: LevelWall = { ...this.wallPreview, type: this.wallType };
          if (this.wallType === "glass") wall.hp = this.wallHp;
          this.wave().walls!.push(wall);
          this.persistState();
          this.doRefresh();
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

  private getObjectPosition(sel: Selection): { rx: number; ry: number } {
    if (sel.kind === "ship") return { rx: this.shipRx, ry: this.shipRy };
    if (sel.kind === "enemy") {
      const e = this.wave().enemies[sel.index];
      return { rx: e.rx, ry: e.ry };
    }
    if (sel.kind === "wall") {
      const w = this.wave().walls![sel.index];
      return { rx: w.rx, ry: w.ry };
    }
    const a = this.wave().asteroids![sel.index];
    return { rx: a.rx, ry: a.ry };
  }

  private moveObject(sel: Selection, rx: number, ry: number) {
    if (sel.kind === "ship") {
      this.shipRx = Phaser.Math.Clamp(rx, 0, 1);
      this.shipRy = Phaser.Math.Clamp(ry, 0, 1);
    } else if (sel.kind === "enemy") {
      const e = this.wave().enemies[sel.index];
      if (e) { e.rx = rx; e.ry = ry; }
    } else if (sel.kind === "wall") {
      const w = this.wave().walls![sel.index];
      if (w) { w.rx = rx; w.ry = ry; }
    } else if (sel.kind === "asteroid") {
      const a = this.wave().asteroids![sel.index];
      if (a) { a.rx = rx; a.ry = ry; }
    }
  }

  private hitTest(px: number, py: number): Selection | null {
    const w = this.wave();

    const sx = this.shipRx * GAME_W;
    const sy = this.shipRy * GAME_H;
    if (Math.hypot(px - sx, py - sy) < 20) return { kind: "ship", index: 0 };

    for (let i = w.enemies.length - 1; i >= 0; i--) {
      const e = w.enemies[i];
      const r = ENEMY_VIS[e.type]?.radius ?? 16;
      if (Math.hypot(px - e.rx * GAME_W, py - e.ry * GAME_H) < r + 4) return { kind: "enemy", index: i };
    }

    if (w.walls) {
      for (let i = w.walls.length - 1; i >= 0; i--) {
        const wl = w.walls[i];
        const x1 = wl.rx * GAME_W;
        const y1 = wl.ry * GAME_H;
        if (px >= x1 - 4 && px <= x1 + wl.rw * GAME_W + 4 && py >= y1 - 4 && py <= y1 + wl.rh * GAME_H + 4)
          return { kind: "wall", index: i };
      }
    }

    if (w.asteroids) {
      for (let i = w.asteroids.length - 1; i >= 0; i--) {
        const a = w.asteroids[i];
        const r = ASTEROID_RADII[a.size] ?? 24;
        if (Math.hypot(px - a.rx * GAME_W, py - a.ry * GAME_H) < r + 4) return { kind: "asteroid", index: i };
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
    this.doRefresh();
  }

  // ── Actions ───────────────────────────────────────────────────

  private playTest() {
    this.persistState();
    this.scene.start("GameScene", { mode: "level", levelDef: this.toLevelDef() });
  }

  private saveLevelAction() {
    if (!this.levelId) this.levelId = nextCustomId();
    saveCustomLevel(this.toLevelDef());
    showToast(`Saved: ${this.levelName}`);
  }

  private exportLevel() {
    const json = JSON.stringify(this.toLevelDef(), null, 2);
    navigator.clipboard.writeText(json).then(() => {
      showToast("Copied to clipboard");
    }).catch(() => {
      showImportExportModal("EXPORT", json);
    });
  }

  private showLoadAction() {
    showLoadModal(loadCustomLevels(), (level) => {
      this.loadLevel(level);
      if (this.ui) this.ui.nameInput.value = this.levelName;
      this.doRefresh();
    });
  }

  private showImportAction() {
    showImportExportModal("IMPORT", "", (def) => {
      this.loadLevel(def);
      if (this.ui) this.ui.nameInput.value = this.levelName;
      this.doRefresh();
    });
  }

  private goBack() {
    this.persistState();
    this.scene.start("StartScene");
  }
}
