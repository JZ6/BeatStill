import Phaser from "phaser";
import { Bullet } from "./Bullet";
import { radial, aimed, spiral } from "./BulletPattern";
import type { GameScene } from "../scenes/GameScene";

export type EnemyType = "basic" | "tracker" | "sniper" | "spiral" | "tank" | "swarm";

const ENEMY_CONFIG: Record<EnemyType, { hp: number; speed: number; fireRate: number; color: number; radius: number }> = {
  basic:   { hp: 2, speed: 40, fireRate: 3000, color: 0x44ff44, radius: 16 },
  tracker: { hp: 1, speed: 60, fireRate: 2500, color: 0xff8800, radius: 12 },
  sniper:  { hp: 1, speed: 20, fireRate: 2000, color: 0xff2266, radius: 10 },
  spiral:  { hp: 3, speed: 25, fireRate: 400,  color: 0xaa44ff, radius: 18 },
  tank:    { hp: 6, speed: 15, fireRate: 3500, color: 0xff4444, radius: 24 },
  swarm:   { hp: 1, speed: 90, fireRate: 4000, color: 0xffff44, radius: 8 },
};

export class Enemy extends Phaser.GameObjects.Graphics {
  hp: number;
  maxHp: number;
  speed: number;
  fireRate: number;
  enemyType: EnemyType;
  radius: number;
  fireCooldown: number;
  targetX: number;
  targetY: number;
  spiralAngle = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyType) {
    super(scene, { x, y });
    scene.add.existing(this);
    this.setDepth(5);

    const cfg = ENEMY_CONFIG[type];
    this.hp = cfg.hp;
    this.maxHp = cfg.hp;
    this.speed = cfg.speed;
    this.fireRate = cfg.fireRate;
    this.enemyType = type;
    this.radius = cfg.radius;
    this.fireCooldown = Phaser.Math.Between(500, 1500);

    this.targetX = Phaser.Math.Between(100, 1180);
    this.targetY = Phaser.Math.Between(80, 400);

    this.draw(cfg.color);
  }

  draw(color: number) {
    this.clear();
    this.lineStyle(3, color, 0.3);
    this.strokeCircle(0, 0, this.radius + 4);
    this.lineStyle(1.5, color, 1);
    this.strokeCircle(0, 0, this.radius);
    this.fillStyle(color, 0.15);
    this.fillCircle(0, 0, this.radius);

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

  update(delta: number, timeScale: number, gameScene: GameScene) {
    const dt = delta / 1000;

    if (this.enemyType === "tracker" || this.enemyType === "swarm") {
      this.targetX = gameScene.ship.x;
      this.targetY = gameScene.ship.y - (this.enemyType === "swarm" ? 0 : 150);
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = this.enemyType === "swarm" ? 1 : 5;
    if (dist > minDist) {
      this.x += (dx / dist) * this.speed * timeScale * dt;
      this.y += (dy / dist) * this.speed * timeScale * dt;
    }

    if (this.enemyType === "spiral") {
      this.spiralAngle = (this.spiralAngle + delta * timeScale * 0.002) % (Math.PI * 2);
    }

    this.fireCooldown -= delta * timeScale;
    if (this.fireCooldown <= 0) {
      this.fire(gameScene);
      this.fireCooldown = this.fireRate;
    }
  }

  fire(gameScene: GameScene) {
    const angleToPlayer = Phaser.Math.Angle.Between(
      this.x, this.y,
      gameScene.ship.x, gameScene.ship.y,
    );

    let configs;
    switch (this.enemyType) {
      case "basic":
        configs = radial(3 + Math.floor(gameScene.wave / 3), 120);
        break;
      case "tracker":
        configs = aimed(angleToPlayer, 2, 0.3, 170);
        break;
      case "sniper":
        configs = aimed(angleToPlayer, 1, 0, 280);
        break;
      case "spiral":
        configs = spiral(3, 100, this.spiralAngle);
        break;
      case "tank":
        configs = [
          ...radial(6, 90),
          ...aimed(angleToPlayer, 3, 0.4, 140),
        ];
        break;
      case "swarm":
        configs = aimed(angleToPlayer, 1, 0, 130);
        break;
    }

    for (const cfg of configs) {
      const bullet = new Bullet(
        this.scene,
        this.x,
        this.y,
        cfg.angle,
        cfg.speed,
        "enemy",
      );
      gameScene.enemyBullets.add(bullet);
    }
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.destroy();
      return true;
    }
    const cfg = ENEMY_CONFIG[this.enemyType];
    this.draw(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) this.draw(cfg.color);
    });
    return false;
  }
}
