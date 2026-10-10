import type { EnemyType } from "../objects/enemies";
import type { WallType } from "../objects/Wall";
import type { LevelWave } from "../systems/Levels";
import { GAME_W, GAME_H } from "../systems/GameConfig";
import { getEnemyVis, WALL_COLORS, DEFAULT_WALL_COLOR, ASTEROID_RADII, type Selection } from "./LevelDesignerData";

function wallColor(type: WallType): number {
  return WALL_COLORS[type] ?? DEFAULT_WALL_COLOR;
}

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

  const waves = Array.isArray(state.waves) ? state.waves : [];
  for (let i = 0; i < waves.length; i++) {
    if (i === state.currentWave) continue;
    drawWave(g, waves[i], 0.12);
  }

  drawWave(g, waves[state.currentWave], 1);
  drawShipMarker(g, state.shipRx, state.shipRy);

  if (state.selected) {
    drawSelectionHighlight(g, state);
  }

  if (state.wallPreview) {
    const wp = state.wallPreview;
    const color = wallColor(state.wallType);
    g.lineStyle(2, color, 0.8);
    g.strokeRect(wp.rx * GAME_W, wp.ry * GAME_H, wp.rw * GAME_W, wp.rh * GAME_H);
    g.fillStyle(color, 0.15);
    g.fillRect(wp.rx * GAME_W, wp.ry * GAME_H, wp.rw * GAME_W, wp.rh * GAME_H);
  }
}

// `wave` may be undefined (out-of-range index) or malformed; this runs every frame, so never throw.
function drawWave(g: Phaser.GameObjects.Graphics, wave: LevelWave | undefined, alpha: number) {
  if (!wave) return;

  if (Array.isArray(wave.walls)) {
    for (const w of wave.walls) {
      const color = wallColor(w.type);
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

  if (Array.isArray(wave.asteroids)) {
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

  if (Array.isArray(wave.enemies)) {
    for (const e of wave.enemies) {
      drawEnemy(g, e.rx * GAME_W, e.ry * GAME_H, e.type, alpha);
    }
  }
}

function drawEnemy(g: Phaser.GameObjects.Graphics, x: number, y: number, type: EnemyType, alpha: number) {
  const vis = getEnemyVis(type);
  if (!vis) return;
  const { color, shape, radius: r } = vis;

  g.fillStyle(color, 0.12 * alpha);
  g.fillCircle(x, y, r + 6);

  switch (shape.kind) {
    case "circle":
      g.fillStyle(color, 0.25 * alpha);
      g.fillCircle(x, y, r);
      g.lineStyle(1.5, color, 0.8 * alpha);
      g.strokeCircle(x, y, r);
      break;
    case "diamond":
      drawDiamond(g, x, y, r, color, alpha);
      break;
    case "snake":
      drawSnake(g, x, y, r, color, alpha);
      break;
    case "polygon":
      drawPolygon(g, x, y, r, shape.sides, color, alpha);
      break;
  }
}

/** One sine period from tail to head, like the in-game snake body. */
function drawSnake(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, alpha: number) {
  const segments = 8;
  g.lineStyle(3, color, 0.8 * alpha);
  g.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const px = x - r + 1.75 * r * t;
    const py = y + Math.sin(t * Math.PI * 2) * r * 0.35;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.strokePath();
  g.fillStyle(color, alpha);
  g.fillCircle(x + 0.75 * r, y, r * 0.25);
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

  g.lineStyle(2, 0xffaa44, pulse);

  if (kind === "ship") {
    g.strokeCircle(state.shipRx * GAME_W, state.shipRy * GAME_H, 22);
    return;
  }

  const wave = Array.isArray(state.waves) ? state.waves[state.currentWave] : undefined;
  if (!wave) return;

  if (kind === "enemy") {
    const e = Array.isArray(wave.enemies) ? wave.enemies[index] : undefined;
    if (e) {
      const r = (getEnemyVis(e.type)?.radius ?? 16) + 8;
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
