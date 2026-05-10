import Phaser from "phaser";
import { Bullet } from "./Bullet";
import { radial, aimed, spiral } from "./BulletPattern";
import type { GameScene } from "../scenes/GameScene";
import { GAME_W, GAME_H } from "../systems/GameConfig";

export type EnemyType = "basic" | "tracker" | "sniper" | "spiral" | "tank" | "swarm" | "snake" | "circler";

interface EnemyConfig {
  hp: number; speed: number; fireRate: number; color: number; radius: number;
  sides: number; // 0=circle, -1=custom snake, 3+=polygon
}

const ENEMY_CONFIG: Record<EnemyType, EnemyConfig> = {
  swarm:   { hp: 1, speed: 90, fireRate: 4000, color: 0xffff44, radius: 8,  sides: 0 },
  snake:   { hp: 2, speed: 50, fireRate: 3000, color: 0x44ddff, radius: 14, sides: -1 },
  tracker: { hp: 1, speed: 60, fireRate: 2500, color: 0xff8800, radius: 12, sides: 3 },
  basic:   { hp: 2, speed: 40, fireRate: 3000, color: 0x44ff44, radius: 16, sides: 4 },
  sniper:  { hp: 1, speed: 20, fireRate: 2000, color: 0xff2266, radius: 10, sides: 5 },
  circler: { hp: 3, speed: 20, fireRate: 2800, color: 0x44ff88, radius: 16, sides: 6 },
  spiral:  { hp: 3, speed: 25, fireRate: 400,  color: 0xaa44ff, radius: 18, sides: 7 },
  tank:    { hp: 6, speed: 15, fireRate: 3500, color: 0xff4444, radius: 24, sides: 8 },
};

export class Enemy extends Phaser.GameObjects.Graphics {
  hp: number;
  maxHp: number;
  speed: number;
  fireRate: number;
  enemyType: EnemyType;
  radius: number;
  fireCooldown: number;
  targetX!: number;
  targetY!: number;
  spiralAngle = 0;
  snakePhase = 0;
  driftAngle = 0; // for circler

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

    this.pickNewTarget();

    if (type === "circler") {
      this.driftAngle = Math.random() * Math.PI * 2;
    }

    this.draw(cfg.color);
  }

  private pickNewTarget() {
    this.targetX = Phaser.Math.Between(100, GAME_W - 100);
    this.targetY = Phaser.Math.Between(80, GAME_H - 120);
  }

  draw(color: number) {
    this.clear();
    const cfg = ENEMY_CONFIG[this.enemyType];
    const r = this.radius;

    if (cfg.sides === 0) {
      this.lineStyle(3, color, 0.3);
      this.strokeCircle(0, 0, r + 4);
      this.lineStyle(1.5, color, 1);
      this.strokeCircle(0, 0, r);
      this.fillStyle(color, 0.15);
      this.fillCircle(0, 0, r);
    } else if (cfg.sides === -1) {
      this.drawSnake(color, r);
    } else {
      const drawPoly = (rad: number, sides: number) => {
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
      drawPoly(r + 4, cfg.sides);
      this.strokePath();

      this.lineStyle(1.5, color, 1);
      drawPoly(r, cfg.sides);
      this.strokePath();

      this.fillStyle(color, 0.15);
      drawPoly(r, cfg.sides);
      this.fillPath();
    }

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

  private drawSnake(color: number, r: number) {
    const segments = 6;
    const segLen = r * 2 / segments;
    const amplitude = r * 0.5;

    const drawWave = (rad: number, alpha: number, width: number) => {
      this.lineStyle(width, color, alpha);
      this.beginPath();
      for (let i = 0; i <= segments; i++) {
        const py = -r + i * segLen;
        const px = Math.sin(this.snakePhase + i * 1.2) * amplitude * (rad / r);
        if (i === 0) this.moveTo(px, py); else this.lineTo(px, py);
      }
      this.strokePath();
    };

    drawWave(r + 4, 0.3, 3);
    drawWave(r, 1, 1.5);
  }

  update(delta: number, timeScale: number, gameScene: GameScene) {
    const dt = delta / 1000;

    if (this.enemyType === "tracker" || this.enemyType === "swarm") {
      this.targetX = gameScene.ship.x;
      this.targetY = gameScene.ship.y - (this.enemyType === "swarm" ? 0 : 150);
    } else if (this.enemyType === "snake") {
      this.targetX = gameScene.ship.x;
      this.targetY = gameScene.ship.y;
      this.snakePhase += delta * timeScale * 0.005;
    } else if (this.enemyType === "circler") {
      this.x += Math.cos(this.driftAngle) * this.speed * timeScale * dt;
      this.y += Math.sin(this.driftAngle) * this.speed * timeScale * dt;
      if (this.x < 40 || this.x > GAME_W - 40 || this.y < 40 || this.y > GAME_H - 40) {
        this.driftAngle = Math.atan2(GAME_H / 2 - this.y, GAME_W / 2 - this.x) + Phaser.Math.FloatBetween(-0.5, 0.5);
      }
    }

    if (this.enemyType !== "circler") {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = this.enemyType === "swarm" ? 1 : 5;

      if (this.enemyType === "snake" && dist > minDist) {
        const headAngle = Math.atan2(dy, dx);
        const weave = Math.sin(this.snakePhase * 3) * 0.6;
        const moveAngle = headAngle + weave;
        this.x += Math.cos(moveAngle) * this.speed * timeScale * dt;
        this.y += Math.sin(moveAngle) * this.speed * timeScale * dt;
      } else if (dist > minDist) {
        this.x += (dx / dist) * this.speed * timeScale * dt;
        this.y += (dy / dist) * this.speed * timeScale * dt;
      } else if (this.enemyType === "basic" || this.enemyType === "sniper") {
        this.pickNewTarget();
      }
    }

    if (this.enemyType === "spiral") {
      this.spiralAngle = (this.spiralAngle + delta * timeScale * 0.002) % (Math.PI * 2);
    }

    if (this.enemyType === "snake") {
      this.draw(ENEMY_CONFIG.snake.color);
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
        configs = radial(Math.min(3 + Math.floor(gameScene.wave / 3), 6), 120);
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
      case "snake":
        configs = aimed(angleToPlayer, 2, 0.2, 150);
        break;
      case "circler":
        configs = radial(12, 80);
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
