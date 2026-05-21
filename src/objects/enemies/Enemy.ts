import Phaser from "phaser";
import { Bullet } from "../Bullet";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";
import { GAME_W, GAME_H, px } from "../../systems/GameConfig";

export type EnemyType = "basic" | "tracker" | "sniper" | "spiral" | "tank" | "swarm" | "snake" | "circler" | "sentinel" | "phantom" | "phantom_decoy";

export abstract class Enemy extends Phaser.GameObjects.Graphics {
  hp: number;
  maxHp: number;
  speed: number;
  fireRate: number;
  abstract readonly enemyType: EnemyType;
  radius: number;
  fireCooldown: number;
  targetX!: number;
  targetY!: number;
  protected color: number;
  isElite = false;

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number, speed: number, fireRate: number, color: number, radius: number) {
    super(scene, { x, y });
    scene.add.existing(this);
    this.setDepth(5);
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.fireRate = fireRate;
    this.color = color;
    this.radius = px(radius);
    this.fireCooldown = Phaser.Math.Between(500, 1500);
    this.pickNewTarget();
  }

  protected pickNewTarget() {
    this.targetX = Phaser.Math.Between(100, GAME_W - 100);
    this.targetY = Phaser.Math.Between(80, GAME_H - 120);
  }

  draw(color: number) {
    this.clear();
    if (this.isElite) {
      this.lineStyle(px(4), 0xffdd44, 0.3);
      this.strokeCircle(0, 0, this.radius + px(6));
    }
    this.drawShape(color);
    this.drawCracks(color);
  }

  private drawCracks(color: number) {
    const dmg = 1 - this.hp / this.maxHp;
    if (dmg <= 0) return;
    const r = this.radius;
    const crackCount = Math.min(Math.ceil(dmg * 5), 4);
    this.lineStyle(px(1), color, 0.4 + dmg * 0.4);
    for (let c = 0; c < crackCount; c++) {
      const seed = c * 31 + 7;
      const startAngle = ((seed * 137) % 360) * (Math.PI / 180);
      const len = r * (0.4 + dmg * 0.4);
      const segments = 3;
      let cx = Math.cos(startAngle) * r * 0.15;
      let cy = Math.sin(startAngle) * r * 0.15;
      this.beginPath();
      this.moveTo(cx, cy);
      for (let s = 0; s < segments; s++) {
        const segSeed = seed * 13 + s * 7;
        const jitter = ((segSeed % 11) / 11 - 0.5) * 0.8;
        const segAngle = startAngle + jitter;
        const segLen = len / segments;
        cx += Math.cos(segAngle) * segLen;
        cy += Math.sin(segAngle) * segLen;
        this.lineTo(cx, cy);
      }
      this.strokePath();
    }
  }

  makeElite() {
    this.isElite = true;
    this.hp *= 3;
    this.maxHp *= 3;
    this.draw(this.color);
  }

  protected abstract drawShape(color: number): void;

  protected drawPolygon(color: number, sides: number) {
    const r = this.radius;
    const dmg = 1 - this.hp / this.maxHp;
    const drawPoly = (rad: number) => {
      this.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
        const dent = dmg * 0.35 * (((i * 7 + 3) % sides) / Math.max(sides - 1, 1));
        const vr = rad * (1 - dent);
        const vx = Math.cos(a) * vr;
        const vy = Math.sin(a) * vr;
        if (i === 0) this.moveTo(vx, vy); else this.lineTo(vx, vy);
      }
      this.closePath();
    };
    this.lineStyle(px(3), color, 0.3 * (1 - dmg * 0.6));
    drawPoly(r + px(4));
    this.strokePath();
    this.lineStyle(px(1.5), color, 1);
    drawPoly(r);
    this.strokePath();
    this.fillStyle(color, 0.15 * (1 - dmg * 0.5));
    drawPoly(r);
    this.fillPath();
  }

  protected drawCircleShape(color: number) {
    const r = this.radius;
    const dmg = 1 - this.hp / this.maxHp;
    if (dmg > 0) {
      const n = 16;
      const drawWobble = (rad: number) => {
        this.beginPath();
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 * i) / n;
          const jitter = dmg * 0.25 * (((i * 7 + 3) % n) / (n - 1));
          const vr = rad * (1 - jitter);
          const vx = Math.cos(a) * vr;
          const vy = Math.sin(a) * vr;
          if (i === 0) this.moveTo(vx, vy); else this.lineTo(vx, vy);
        }
        this.closePath();
      };
      this.lineStyle(px(3), color, 0.3 * (1 - dmg * 0.6));
      drawWobble(r + px(4));
      this.strokePath();
      this.lineStyle(px(1.5), color, 1);
      drawWobble(r);
      this.strokePath();
      this.fillStyle(color, 0.15 * (1 - dmg * 0.5));
      drawWobble(r);
      this.fillPath();
    } else {
      this.lineStyle(px(3), color, 0.3);
      this.strokeCircle(0, 0, r + px(4));
      this.lineStyle(px(1.5), color, 1);
      this.strokeCircle(0, 0, r);
      this.fillStyle(color, 0.15);
      this.fillCircle(0, 0, r);
    }
  }

  update(delta: number, timeScale: number, gameScene: GameScene) {
    this.updateMovement(delta, timeScale, gameScene);
    this.fireCooldown -= delta * timeScale;
    if (this.fireCooldown <= 0) {
      this.fire(gameScene);
      this.fireCooldown = this.fireRate;
    }
  }

  protected abstract updateMovement(delta: number, timeScale: number, gameScene: GameScene): void;
  protected abstract getFirePattern(angleToPlayer: number, gameScene: GameScene): BulletConfig[];

  fire(gameScene: GameScene) {
    const angleToPlayer = Phaser.Math.Angle.Between(this.x, this.y, gameScene.ship.x, gameScene.ship.y);
    const configs = this.getFirePattern(angleToPlayer, gameScene);
    for (const cfg of configs) {
      const bullet = new Bullet(this.scene, this.x, this.y, cfg.angle, cfg.speed, "enemy");
      bullet.sourceEnemy = this;
      gameScene.enemyBullets.add(bullet);
    }
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.destroy();
      return true;
    }
    this.draw(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) this.draw(this.color);
    });
    return false;
  }

  protected moveTowardTarget(dt: number, timeScale: number, minDist = 5): boolean {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > minDist) {
      this.x += (dx / dist) * this.speed * timeScale * dt;
      this.y += (dy / dist) * this.speed * timeScale * dt;
      return false;
    }
    return true;
  }
}
