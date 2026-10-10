import Phaser from "phaser";
import type { Bullet } from "./Bullet";
import type { ParticleSystem } from "../systems/Particles";

export type WallType = "solid" | "bounce" | "glass";

/**
 * Outcome of `Wall.handleBullet`:
 * - "none": no contact (or wall/bullet inactive)
 * - "pass": overlapping a one-way wall from its allowed side
 * - "bounce": ricocheted off a bounce wall
 * - "absorb": stopped by a solid wall
 * - "crack": damaged a glass wall without breaking it
 * - "shatter": broke a glass wall
 */
export type WallHitResult = "none" | "pass" | "bounce" | "absorb" | "crack" | "shatter";

const WALL_COLORS: Record<WallType, number> = {
  solid: 0x887766,
  bounce: 0x4488ff,
  glass: 0xff6644,
};

function hashRect(x: number, y: number, w: number, h: number): number {
  let hash = 2166136261;
  for (const v of [x, y, w, h]) {
    hash = Math.imul(hash ^ (Math.round(v) | 0), 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Wall extends Phaser.GameObjects.Graphics {
  wallType: WallType;
  wallX: number;
  wallY: number;
  wallW: number;
  wallH: number;
  hp: number;
  maxHp: number;
  oneWay: "up" | "down" | "left" | "right" | null;
  color: number;
  /** Axis of the face the last "bounce" result exited through: "x" = left/right face, "y" = top/bottom. */
  lastBounceAxis: "x" | "y" = "y";

  constructor(
    scene: Phaser.Scene,
    x: number, y: number, w: number, h: number,
    type: WallType,
    hp?: number,
    oneWay?: "up" | "down" | "left" | "right",
  ) {
    super(scene);
    scene.add.existing(this);
    this.setDepth(2);

    this.wallType = type;
    this.wallX = x;
    this.wallY = y;
    this.wallW = w;
    this.wallH = h;
    const glassHp = hp !== undefined && Number.isFinite(hp) ? hp : 3;
    this.maxHp = type === "glass" ? Math.max(1, glassHp) : 0;
    this.hp = this.maxHp;
    this.oneWay = oneWay ?? null;
    this.color = WALL_COLORS[type];

    this.drawWall();
  }

  drawWall() {
    this.clear();
    const { wallX: x, wallY: y, wallW: w, wallH: h, color } = this;

    if (this.wallType === "solid") {
      this.fillStyle(color, 0.25);
      this.fillRect(x, y, w, h);
      this.lineStyle(3, color, 0.4);
      this.strokeRect(x, y, w, h);
      this.lineStyle(1.5, color, 0.8);
      this.strokeRect(x, y, w, h);
    } else if (this.wallType === "bounce") {
      this.fillStyle(color, 0.1);
      this.fillRect(x, y, w, h);
      this.lineStyle(3, color, 0.5);
      this.strokeRect(x, y, w, h);
      this.lineStyle(1.5, color, 1);
      this.strokeRect(x, y, w, h);
      this.drawBounceChevrons();
    } else if (this.wallType === "glass") {
      const alpha = 0.08 + 0.12 * (this.hp / this.maxHp);
      this.fillStyle(color, alpha);
      this.fillRect(x, y, w, h);
      const lineAlpha = 0.3 + 0.7 * (this.hp / this.maxHp);
      this.lineStyle(2, color, lineAlpha);
      this.strokeRect(x, y, w, h);
      if (this.hp < this.maxHp) this.drawCracks();
    }

    if (this.oneWay) this.drawOneWayArrows();
  }

  private drawBounceChevrons() {
    const { wallX: x, wallY: y, wallW: w, wallH: h, color } = this;
    this.lineStyle(1, color, 0.3);
    const horizontal = w > h;
    if (horizontal) {
      const step = 20;
      for (let cx = x + step; cx < x + w - step / 2; cx += step) {
        this.beginPath();
        this.moveTo(cx - 4, y + h * 0.3);
        this.lineTo(cx, y + h * 0.5);
        this.lineTo(cx - 4, y + h * 0.7);
        this.strokePath();
      }
    } else {
      const step = 20;
      for (let cy = y + step; cy < y + h - step / 2; cy += step) {
        this.beginPath();
        this.moveTo(x + w * 0.3, cy - 4);
        this.lineTo(x + w * 0.5, cy);
        this.lineTo(x + w * 0.7, cy - 4);
        this.strokePath();
      }
    }
  }

  private drawCracks() {
    const { wallX: x, wallY: y, wallW: w, wallH: h, color } = this;
    this.lineStyle(1, color, 0.6);
    const damage = 1 - this.hp / this.maxHp;
    const crackCount = Math.ceil(damage * 4);
    // Same seed every redraw, same draws per crack: existing cracks stay put as new ones appear.
    const rand = mulberry32(hashRect(x, y, w, h));
    const clampX = (v: number) => Phaser.Math.Clamp(v, x, x + w);
    const clampY = (v: number) => Phaser.Math.Clamp(v, y, y + h);
    for (let i = 0; i < crackCount; i++) {
      const cx = x + w * (0.2 + rand() * 0.6);
      const cy = y + h * (0.15 + rand() * 0.5);
      this.beginPath();
      this.moveTo(cx, cy);
      this.lineTo(clampX(cx + w * 0.15 * ((i % 2) * 2 - 1)), clampY(cy + h * 0.2));
      this.lineTo(clampX(cx + w * 0.05), clampY(cy + h * 0.35));
      this.strokePath();
    }
  }

  private drawOneWayArrows() {
    const { wallX: x, wallY: y, wallW: w, wallH: h } = this;
    const cx = x + w / 2;
    const cy = y + h / 2;
    this.lineStyle(1.5, 0xffffff, 0.3);

    const drawArrow = (ax: number, ay: number, dx: number, dy: number) => {
      this.beginPath();
      this.moveTo(ax - dx * 6 - dy * 4, ay - dy * 6 + dx * 4);
      this.lineTo(ax, ay);
      this.lineTo(ax - dx * 6 + dy * 4, ay - dy * 6 - dx * 4);
      this.strokePath();
    };

    if (this.oneWay === "up") drawArrow(cx, y, 0, -1);
    else if (this.oneWay === "down") drawArrow(cx, y + h, 0, 1);
    else if (this.oneWay === "left") drawArrow(x, cy, -1, 0);
    else if (this.oneWay === "right") drawArrow(x + w, cy, 1, 0);
  }

  blocksFrom(dx: number, dy: number): boolean {
    if (!this.oneWay) return true;
    if (this.oneWay === "up") return dy > 0;
    if (this.oneWay === "down") return dy < 0;
    if (this.oneWay === "left") return dx > 0;
    return dx < 0; // right
  }

  takeDamage(amount: number, particles?: ParticleSystem): boolean {
    if (this.wallType !== "glass") return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      if (particles) {
        particles.burst(
          this.wallX + this.wallW / 2,
          this.wallY + this.wallH / 2,
          this.color, 15, 80, 3,
        );
      }
      this.destroy();
      return true;
    }
    this.drawWall();
    return false;
  }

  handleBullet(b: Bullet, particles?: ParticleSystem): WallHitResult {
    if (!this.active || !b.alive) return "none";
    if (!this.overlaps(b.x, b.y, b.radius)) return "none";

    const dx = b.x - (this.wallX + this.wallW / 2);
    const dy = b.y - (this.wallY + this.wallH / 2);
    if (!this.blocksFrom(dx, dy)) return "pass";

    if (this.wallType === "bounce") {
      this.ricochet(b);
      return "bounce";
    }

    let result: WallHitResult = "absorb";
    if (this.wallType === "glass") {
      result = this.takeDamage(b.damage, particles) ? "shatter" : "crack";
    }

    b.kill();
    return result;
  }

  private ricochet(b: Bullet) {
    const r = b.radius;
    const left = this.wallX;
    const right = this.wallX + this.wallW;
    const top = this.wallY;
    const bottom = this.wallY + this.wallH;
    // How far the bullet's edge has crossed each face.
    const penLeft = b.x + r - left;
    const penRight = right - (b.x - r);
    const penTop = b.y + r - top;
    const penBottom = bottom - (b.y - r);

    // Exit through the face of least penetration; only reflect if moving into that face,
    // so a bullet already heading out is never turned back in (no double bounce).
    if (Math.min(penLeft, penRight) < Math.min(penTop, penBottom)) {
      this.lastBounceAxis = "x";
      if (penLeft <= penRight) {
        b.x = left - r;
        if (b.vx > 0) b.vx = -b.vx;
      } else {
        b.x = right + r;
        if (b.vx < 0) b.vx = -b.vx;
      }
    } else if (penTop <= penBottom) {
      this.lastBounceAxis = "y";
      b.y = top - r;
      if (b.vy > 0) b.vy = -b.vy;
    } else {
      this.lastBounceAxis = "y";
      b.y = bottom + r;
      if (b.vy < 0) b.vy = -b.vy;
    }
  }

  overlaps(px: number, py: number, pr: number): boolean {
    const closestX = Phaser.Math.Clamp(px, this.wallX, this.wallX + this.wallW);
    const closestY = Phaser.Math.Clamp(py, this.wallY, this.wallY + this.wallH);
    const dx = px - closestX;
    const dy = py - closestY;
    return dx * dx + dy * dy < pr * pr;
  }

  pushOut(entity: { x: number; y: number }, radius: number): boolean {
    if (!this.active) return false;
    const cx = Phaser.Math.Clamp(entity.x, this.wallX, this.wallX + this.wallW);
    const cy = Phaser.Math.Clamp(entity.y, this.wallY, this.wallY + this.wallH);
    const dx = entity.x - cx;
    const dy = entity.y - cy;
    const distSq = dx * dx + dy * dy;

    if (distSq >= radius * radius) return false;

    const dirX = entity.x - (this.wallX + this.wallW / 2);
    const dirY = entity.y - (this.wallY + this.wallH / 2);
    if (!this.blocksFrom(dirX, dirY)) return false;

    if (distSq === 0) {
      // Center inside the wall: exit through the nearest face (least penetration),
      // moving the full penetration depth plus the radius.
      const toLeft = entity.x - this.wallX;
      const toRight = this.wallX + this.wallW - entity.x;
      const toTop = entity.y - this.wallY;
      const toBottom = this.wallY + this.wallH - entity.y;
      const least = Math.min(toLeft, toRight, toTop, toBottom);
      if (least === toLeft) entity.x = this.wallX - radius;
      else if (least === toRight) entity.x = this.wallX + this.wallW + radius;
      else if (least === toTop) entity.y = this.wallY - radius;
      else entity.y = this.wallY + this.wallH + radius;
      return true;
    }

    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    entity.x += (dx / dist) * overlap;
    entity.y += (dy / dist) * overlap;
    return true;
  }
}
