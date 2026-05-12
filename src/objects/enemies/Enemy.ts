import Phaser from "phaser";
import { Bullet } from "../Bullet";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";
import { GAME_W, GAME_H } from "../../systems/GameConfig";

export type EnemyType = "basic" | "tracker" | "sniper" | "spiral" | "tank" | "swarm" | "snake" | "circler";

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

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number, speed: number, fireRate: number, color: number, radius: number) {
    super(scene, { x, y });
    scene.add.existing(this);
    this.setDepth(5);
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.fireRate = fireRate;
    this.color = color;
    this.radius = radius;
    this.fireCooldown = Phaser.Math.Between(500, 1500);
    this.pickNewTarget();
  }

  protected pickNewTarget() {
    this.targetX = Phaser.Math.Between(100, GAME_W - 100);
    this.targetY = Phaser.Math.Between(80, GAME_H - 120);
  }

  draw(color: number) {
    this.clear();
    this.drawShape(color);
    if (this.maxHp > 1) {
      const barW = this.radius * 2;
      const barH = 3;
      const barX = -this.radius;
      const barY = this.radius + 7;
      this.fillStyle(0x222222, 0.8);
      this.fillRect(barX, barY, barW, barH);
      this.fillStyle(color, 0.9);
      this.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
    }
  }

  protected abstract drawShape(color: number): void;

  protected drawPolygon(color: number, sides: number) {
    const r = this.radius;
    const drawPoly = (rad: number) => {
      this.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) this.moveTo(px, py); else this.lineTo(px, py);
      }
      this.closePath();
    };
    this.lineStyle(3, color, 0.3);
    drawPoly(r + 4);
    this.strokePath();
    this.lineStyle(1.5, color, 1);
    drawPoly(r);
    this.strokePath();
    this.fillStyle(color, 0.15);
    drawPoly(r);
    this.fillPath();
  }

  protected drawCircleShape(color: number) {
    const r = this.radius;
    this.lineStyle(3, color, 0.3);
    this.strokeCircle(0, 0, r + 4);
    this.lineStyle(1.5, color, 1);
    this.strokeCircle(0, 0, r);
    this.fillStyle(color, 0.15);
    this.fillCircle(0, 0, r);
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
