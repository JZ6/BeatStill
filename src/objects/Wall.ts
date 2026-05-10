import Phaser from "phaser";
import type { Bullet } from "./Bullet";
import type { ParticleSystem } from "../systems/Particles";

export type WallType = "solid" | "bounce" | "glass";

const WALL_COLORS: Record<WallType, number> = {
  solid: 0x887766,
  bounce: 0x4488ff,
  glass: 0xff6644,
};

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
    this.maxHp = type === "glass" ? (hp ?? 3) : 0;
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
    const seed = this.wallX * 7 + this.wallY * 13;
    for (let i = 0; i < crackCount; i++) {
      const cx = x + w * (0.2 + ((seed * (i + 1) * 37) % 100) / 160);
      const cy = y + h * (0.2 + ((seed * (i + 1) * 53) % 100) / 160);
      this.beginPath();
      this.moveTo(cx, cy);
      this.lineTo(cx + w * 0.15 * ((i % 2) * 2 - 1), cy + h * 0.2);
      this.lineTo(cx + w * 0.05, cy + h * 0.35);
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

  handleBullet(b: Bullet, particles?: ParticleSystem): boolean {
    if (!this.active) return false;
    if (!this.overlaps(b.x, b.y, b.radius)) return false;

    const dx = b.x - (this.wallX + this.wallW / 2);
    const dy = b.y - (this.wallY + this.wallH / 2);
    if (!this.blocksFrom(dx, dy)) return false;

    if (this.wallType === "bounce") {
      this.ricochet(b);
      return true;
    }

    if (this.wallType === "glass") {
      this.takeDamage(b.damage, particles);
    }

    b.kill();
    return true;
  }

  private ricochet(b: Bullet) {
    const cx = this.wallX + this.wallW / 2;
    const cy = this.wallY + this.wallH / 2;
    const dx = b.x - cx;
    const dy = b.y - cy;
    const nx = Math.abs(dx / this.wallW) > Math.abs(dy / this.wallH);
    if (nx) {
      b.vx = -b.vx;
      b.x = dx > 0 ? this.wallX + this.wallW + b.radius : this.wallX - b.radius;
    } else {
      b.vy = -b.vy;
      b.y = dy > 0 ? this.wallY + this.wallH + b.radius : this.wallY - b.radius;
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
      const overlapX = this.wallX + this.wallW / 2 - entity.x;
      const overlapY = this.wallY + this.wallH / 2 - entity.y;
      if (Math.abs(overlapX) > Math.abs(overlapY)) {
        entity.x += overlapX > 0 ? -radius : radius;
      } else {
        entity.y += overlapY > 0 ? -radius : radius;
      }
      return true;
    }

    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    entity.x += (dx / dist) * overlap;
    entity.y += (dy / dist) * overlap;
    return true;
  }
}
