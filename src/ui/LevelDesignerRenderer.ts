import type { EnemyType } from "../objects/enemies";
import type { WallType } from "../objects/Wall";
import type { LevelWave } from "../systems/Levels";
import { GAME_W, GAME_H } from "../systems/GameConfig";
import { ENEMY_VIS, WALL_COLORS, ASTEROID_RADII, type Selection } from "./LevelDesignerData";

export interface EditorDrawState {
  waves: LevelWave[];
  currentWave: number;
  shipRx: number;
  shipRy: number;
  selected: Selection | null;
  wallType: WallType;
  wallPreview: { rx: number; ry: number; rw: number; rh: number } | null;
  time: number;
}

export function drawEditorCanvas(g: Phaser.GameObjects.Graphics, state: EditorDrawState) {
  g.clear();

  g.fillStyle(0x0a0806, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);

  g.lineStyle(1, 0x1a1612, 0.15);
  for (let x = 0; x <= GAME_W; x += 64) g.lineBetween(x, 0, x, GAME_H);
  for (let y = 0; y <= GAME_H; y += 64) g.lineBetween(0, y, GAME_W, y);

  g.lineStyle(1, 0x332211, 0.3);
  g.strokeRect(0, 0, GAME_W, GAME_H);

  for (let i = 0; i < state.waves.length; i++) {
    if (i === state.currentWave) continue;
    drawWave(g, state.waves[i], 0.12);
  }

  drawWave(g, state.waves[state.currentWave], 1);
  drawShipMarker(g, state.shipRx, state.shipRy);

  if (state.selected) {
    drawSelectionHighlight(g, state);
  }

  if (state.wallPreview) {
    const wp = state.wallPreview;
    g.lineStyle(2, WALL_COLORS[state.wallType], 0.8);
    g.strokeRect(wp.rx * GAME_W, wp.ry * GAME_H, wp.rw * GAME_W, wp.rh * GAME_H);
    g.fillStyle(WALL_COLORS[state.wallType], 0.15);
    g.fillRect(wp.rx * GAME_W, wp.ry * GAME_H, wp.rw * GAME_W, wp.rh * GAME_H);
  }
}

function drawWave(g: Phaser.GameObjects.Graphics, wave: LevelWave, alpha: number) {
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
    drawEnemy(g, e.rx * GAME_W, e.ry * GAME_H, e.type, alpha);
  }
}

function drawEnemy(g: Phaser.GameObjects.Graphics, x: number, y: number, type: EnemyType, alpha: number) {
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
    drawDiamond(g, x, y, r, color, alpha);
  } else {
    drawPolygon(g, x, y, r, sides, color, alpha);
  }
}

function drawDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, alpha: number) {
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
}

function drawPolygon(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, sides: number, color: number, alpha: number) {
  const tracePath = () => {
    g.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  };

  g.lineStyle(1.5, color, 0.8 * alpha);
  tracePath();
  g.strokePath();
  g.fillStyle(color, 0.2 * alpha);
  tracePath();
  g.fillPath();
}

function drawShipMarker(g: Phaser.GameObjects.Graphics, shipRx: number, shipRy: number) {
  const x = shipRx * GAME_W;
  const y = shipRy * GAME_H;
  const r = 14;

  g.fillStyle(0x00ffff, 0.1);
  g.fillCircle(x, y, r + 8);

  const tracePath = () => {
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r * 0.7, y + r * 0.5);
    g.lineTo(x, y + r * 0.2);
    g.lineTo(x - r * 0.7, y + r * 0.5);
    g.closePath();
  };

  g.lineStyle(2, 0x00ffff, 0.8);
  tracePath();
  g.strokePath();
  g.fillStyle(0x00ffff, 0.2);
  tracePath();
  g.fillPath();
}

function drawSelectionHighlight(g: Phaser.GameObjects.Graphics, state: EditorDrawState) {
  if (!state.selected) return;
  const { kind, index } = state.selected;
  const pulse = 0.5 + Math.sin(state.time * 0.003) * 0.3;
  const wave = state.waves[state.currentWave];

  g.lineStyle(2, 0xffaa44, pulse);

  if (kind === "ship") {
    g.strokeCircle(state.shipRx * GAME_W, state.shipRy * GAME_H, 22);
  } else if (kind === "enemy") {
    const e = wave.enemies[index];
    if (e) {
      const r = (ENEMY_VIS[e.type]?.radius ?? 16) + 8;
      g.strokeCircle(e.rx * GAME_W, e.ry * GAME_H, r);
    }
  } else if (kind === "wall") {
    const w = wave.walls?.[index];
    if (w) g.strokeRect(w.rx * GAME_W - 3, w.ry * GAME_H - 3, w.rw * GAME_W + 6, w.rh * GAME_H + 6);
  } else if (kind === "asteroid") {
    const a = wave.asteroids?.[index];
    if (a) {
      const r = (ASTEROID_RADII[a.size] ?? 24) + 8;
      g.strokeCircle(a.rx * GAME_W, a.ry * GAME_H, r);
    }
  }
}
