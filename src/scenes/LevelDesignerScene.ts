import Phaser from "phaser";
import type { EnemyType } from "../objects/enemies";
import type { WallType } from "../objects/Wall";
import type { LevelDef, LevelWave, LevelWall } from "../systems/Levels";
import { GAME_W, GAME_H } from "../systems/GameConfig";
import { saveCustomLevel, loadCustomLevels, saveEditorState, loadEditorState, nextCustomId } from "../systems/CustomLevels";
import { normalizeLevelDef, DEFAULT_LEVEL_NAME } from "../systems/LevelValidation";
import { getEnemyVis, ASTEROID_RADII, type Tool, type Selection } from "../ui/LevelDesignerData";
import { drawEditorCanvas, type EditorDrawState } from "../ui/LevelDesignerRenderer";
import {
  createEditorPanels, updateToolButtons,
  refreshSubtool, refreshProps, refreshWaveBar,
  showToast, showLoadModal, showImportExportModal,
  type EditorUIElements,
} from "../ui/LevelDesignerUI";

function emptyLevel(): LevelDef {
  return { id: 0, name: DEFAULT_LEVEL_NAME, description: "", waves: [{ enemies: [] }] };
}

/** True while the user is typing in an HTML text field. */
function isTextEntry(el: Element | null): el is HTMLElement {
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

const clamp01 = (v: number) => Phaser.Math.Clamp(v, 0, 1);

export class LevelDesignerScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;

  /** Full loaded level (incl. description and unknown fields); toLevelDef overwrites only edited fields. */
  private sourceLevel: LevelDef = emptyLevel();
  private levelId = 0;
  private levelName = DEFAULT_LEVEL_NAME;
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
    this.dragging = false;
    this.wallStart = null;
    this.wallPreview = null;

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
    // normalizeLevelDef returns a validated deep copy, so editing never mutates the
    // caller's LevelDef (e.g. a campaign level constant).
    const level = normalizeLevelDef(def);
    if (!level) {
      this.resetLevel();
      return;
    }
    this.sourceLevel = level;
    this.levelId = level.id;
    this.levelName = level.name;
    this.shipRx = level.shipRx ?? 0.5;
    this.shipRy = level.shipRy ?? 0.8;
    this.waves = structuredClone(level.waves);
    this.currentWave = 0;
    this.selected = null;
  }

  private resetLevel() {
    this.sourceLevel = emptyLevel();
    this.levelId = 0;
    this.levelName = DEFAULT_LEVEL_NAME;
    this.shipRx = 0.5;
    this.shipRy = 0.8;
    this.waves = [{ enemies: [] }];
    this.currentWave = 0;
    this.selected = null;
  }

  /** Allocates an id once for an unsaved level and keeps it. */
  private ensureLevelId(): number {
    if (!this.levelId) this.levelId = nextCustomId();
    return this.levelId;
  }

  /** Deep copy of the source level with the edited fields applied (unknown fields survive). */
  private toLevelDef(): LevelDef {
    return structuredClone({
      ...this.sourceLevel,
      id: this.ensureLevelId(),
      name: this.levelName,
      shipRx: this.shipRx,
      shipRy: this.shipRy,
      waves: this.waves,
    });
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
      onNameChange: (name) => {
        this.levelName = name;
        this.persistState();
      },
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
    this.dragging = false;
    this.wallStart = null;
    this.wallPreview = null;
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
    this.persistState();
    this.switchWave(this.waves.length - 1);
  }

  private deleteWave() {
    if (this.waves.length <= 1) return;
    this.waves.splice(this.currentWave, 1);
    if (this.currentWave >= this.waves.length) this.currentWave = this.waves.length - 1;
    this.selected = null;
    this.persistState();
    this.doRefresh();
  }

  private duplicateWave() {
    // Deep copy, keeping any unknown wave fields.
    const dup: LevelWave = structuredClone(this.wave());
    this.waves.splice(this.currentWave + 1, 0, dup);
    this.persistState();
    this.switchWave(this.currentWave + 1);
  }

  // ── Input ─────────────────────────────────────────────────────

  private setupInput() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Phaser prevents the default mousedown on the canvas, so focus would stay in the
      // name field; blur it so keyboard shortcuts work again after clicking the canvas.
      const active = document.activeElement;
      if (isTextEntry(active)) active.blur();

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
        // The pointer can leave the canvas mid-drag; keep the new wall inside the arena.
        const cx = clamp01(rx);
        const cy = clamp01(ry);
        const x1 = Math.min(this.wallStart.rx, cx);
        const y1 = Math.min(this.wallStart.ry, cy);
        const x2 = Math.max(this.wallStart.rx, cx);
        const y2 = Math.max(this.wallStart.ry, cy);
        this.wallPreview = { rx: x1, ry: y1, rw: x2 - x1, rh: y2 - y1 };
      }
    });

    // Releasing over the HTML panels fires "pointerupoutside" instead of "pointerup".
    this.input.on("pointerup", () => this.handlePointerUp());
    this.input.on("pointerupoutside", () => this.handlePointerUp());

    if (this.input.keyboard) {
      const onDeleteKey = () => {
        if (isTextEntry(document.activeElement)) return;
        this.deleteSelected();
      };
      this.input.keyboard.on("keydown-DELETE", onDeleteKey);
      this.input.keyboard.on("keydown-BACKSPACE", onDeleteKey);
    }
  }

  private handlePointerUp() {
    if (this.dragging) {
      this.dragging = false;
      this.persistState();
    }

    if (this.tool === "wall" && this.wallStart && this.wallPreview) {
      const { rw, rh } = this.wallPreview;
      if (rw > 0.01 && rh > 0.005) {
        const w = this.wave();
        if (!w.walls) w.walls = [];
        const wall: LevelWall = { ...this.wallPreview, type: this.wallType };
        if (this.wallType === "glass") wall.hp = this.wallHp;
        w.walls.push(wall);
        this.persistState();
        this.doRefresh();
      }
    }
    this.wallStart = null;
    this.wallPreview = null;
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
      this.shipRx = clamp01(rx);
      this.shipRy = clamp01(ry);
    } else if (sel.kind === "enemy") {
      const e = this.wave().enemies[sel.index];
      if (e) { e.rx = clamp01(rx); e.ry = clamp01(ry); }
    } else if (sel.kind === "wall") {
      // Keep the whole wall inside the arena (top-left anchored).
      const w = this.wave().walls?.[sel.index];
      if (w) {
        w.rx = Phaser.Math.Clamp(rx, 0, Math.max(0, 1 - w.rw));
        w.ry = Phaser.Math.Clamp(ry, 0, Math.max(0, 1 - w.rh));
      }
    } else if (sel.kind === "asteroid") {
      const a = this.wave().asteroids?.[sel.index];
      if (a) { a.rx = clamp01(rx); a.ry = clamp01(ry); }
    }
  }

  private hitTest(px: number, py: number): Selection | null {
    const w = this.wave();

    const sx = this.shipRx * GAME_W;
    const sy = this.shipRy * GAME_H;
    if (Math.hypot(px - sx, py - sy) < 20) return { kind: "ship", index: 0 };

    for (let i = w.enemies.length - 1; i >= 0; i--) {
      const e = w.enemies[i];
      const r = getEnemyVis(e.type)?.radius ?? 16;
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
    // toLevelDef() is a deep copy, so the game can't mutate the editor's state.
    this.scene.start("GameScene", { mode: "level", levelDef: this.toLevelDef() });
  }

  private saveLevelAction() {
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
      this.persistState();
      this.doRefresh();
    });
  }

  private showImportAction() {
    showImportExportModal("IMPORT", "", (def) => {
      this.loadLevel(def);
      // An imported id may belong to an unrelated saved level; save as a new level instead.
      this.levelId = 0;
      if (this.ui) this.ui.nameInput.value = this.levelName;
      this.persistState();
      this.doRefresh();
    });
  }

  private goBack() {
    this.persistState();
    this.scene.start("StartScene");
  }
}
