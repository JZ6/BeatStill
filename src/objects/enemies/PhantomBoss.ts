import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { PhantomDecoy } from "./PhantomDecoy";
import { aimed, radial, spiral } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";
import { GAME_W, GAME_H } from "../../systems/GameConfig";
import { Bullet } from "../Bullet";

export class PhantomBoss extends Enemy {
  readonly enemyType = "phantom" as const;
  private phase = 1;
  private chargeCounter = 0;
  private teleportTimer = 4000;
  private teleporting = false;
  private teleportProgress = 0;
  private teleportDuration = 300;
  private teleportFromX = 0;
  private teleportFromY = 0;
  private teleportToX = 0;
  private teleportToY = 0;
  private prevPositions: { x: number; y: number }[] = [];
  private trailTimer = 0;
  private spiralAngle = 0;
  private decoyCount = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 40, 40, 2500, 0x4488ff, 28);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    const r = this.radius;

    for (let i = this.prevPositions.length - 1; i >= 0; i--) {
      const p = this.prevPositions[i];
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const alpha = 0.05 + (this.prevPositions.length - 1 - i) * 0.05;
      this.lineStyle(1, color, alpha);
      this.beginPath();
      const drawDiamond = (cx: number, cy: number, rad: number) => {
        this.moveTo(cx, cy - rad);
        this.lineTo(cx + rad * 0.6, cy);
        this.lineTo(cx, cy + rad);
        this.lineTo(cx - rad * 0.6, cy);
        this.closePath();
      };
      drawDiamond(dx, dy, r * 0.8);
      this.strokePath();
    }

    let teleportAlpha = 1;
    if (this.teleporting) {
      const half = this.teleportDuration / 2;
      teleportAlpha = this.teleportProgress < half
        ? 1 - this.teleportProgress / half
        : (this.teleportProgress - half) / half;
    }

    if (this.chargeCounter > 100) {
      const glowR = 20 + this.chargeCounter / 50;
      const glowAlpha = Math.min(this.chargeCounter / 1800, 0.4) * teleportAlpha;
      this.lineStyle(2, 0x88bbff, glowAlpha);
      this.strokeCircle(0, 0, glowR);
      this.fillStyle(0x4488ff, glowAlpha * 0.3);
      this.fillCircle(0, 0, glowR);
    }

    this.lineStyle(3, color, 0.3 * teleportAlpha);
    this.beginPath();
    this.moveTo(0, -(r + 4));
    this.lineTo((r + 4) * 0.6, 0);
    this.lineTo(0, r + 4);
    this.lineTo(-(r + 4) * 0.6, 0);
    this.closePath();
    this.strokePath();

    this.lineStyle(1.5, color, teleportAlpha);
    this.beginPath();
    this.moveTo(0, -r);
    this.lineTo(r * 0.6, 0);
    this.lineTo(0, r);
    this.lineTo(-r * 0.6, 0);
    this.closePath();
    this.strokePath();

    this.fillStyle(color, 0.15 * teleportAlpha);
    this.beginPath();
    this.moveTo(0, -r);
    this.lineTo(r * 0.6, 0);
    this.lineTo(0, r);
    this.lineTo(-r * 0.6, 0);
    this.closePath();
    this.fillPath();
  }

  protected updateMovement(delta: number, timeScale: number, gameScene: GameScene) {
    const dt = delta / 1000;

    if (gameScene.timeManager.scale < 0.15) {
      this.chargeCounter = Math.min(this.chargeCounter + delta, 1800);
    }

    if (this.phase >= 3) {
      this.spiralAngle = (this.spiralAngle + delta * timeScale * 0.002) % (Math.PI * 2);
    }

    this.trailTimer -= delta * timeScale;
    if (this.trailTimer <= 0 && !this.teleporting) {
      this.prevPositions.push({ x: this.x, y: this.y });
      if (this.prevPositions.length > 3) this.prevPositions.shift();
      this.trailTimer = 100;
    }

    if (this.teleporting) {
      this.teleportProgress += delta * timeScale;
      const half = this.teleportDuration / 2;
      if (this.teleportProgress >= half && this.teleportProgress - delta * timeScale < half) {
        this.x = this.teleportToX;
        this.y = this.teleportToY;
        this.prevPositions = [];
      }
      if (this.teleportProgress >= this.teleportDuration) {
        this.teleporting = false;
        this.teleportProgress = 0;
        gameScene.particles.burst(this.x, this.y, this.color, 12, 50, 2);
      }
      this.draw(this.color);
      return;
    }

    this.teleportTimer -= delta * timeScale;
    if (this.teleportTimer <= 0) {
      this.startTeleport(gameScene);
    }

    if (!this.teleporting) {
      this.targetX = gameScene.ship.x;
      this.targetY = gameScene.ship.y;
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 180) {
        this.x += (dx / dist) * this.speed * timeScale * dt * 0.3;
        this.y += (dy / dist) * this.speed * timeScale * dt * 0.3;
      }
    }

    this.draw(this.color);
  }

  private startTeleport(gameScene: GameScene) {
    this.teleportFromX = this.x;
    this.teleportFromY = this.y;
    this.teleportToX = Phaser.Math.Between(80, GAME_W - 80);
    this.teleportToY = Phaser.Math.Between(80, GAME_H - 120);
    this.teleporting = true;
    this.teleportProgress = 0;

    if (this.phase >= 2) {
      const configs = radial(8, 60);
      for (const cfg of configs) {
        const bullet = new Bullet(this.scene, this.teleportFromX, this.teleportFromY, cfg.angle, cfg.speed, "enemy");
        bullet.sourceEnemy = this;
        gameScene.enemyBullets.add(bullet);
      }
    }

    if (this.phase >= 3 && this.decoyCount < 2) {
      const decoy = new PhantomDecoy(this.scene, this.teleportFromX, this.teleportFromY);
      gameScene.enemies.add(decoy);
      this.decoyCount++;
    }

    gameScene.particles.burst(this.teleportFromX, this.teleportFromY, this.color, 15, 60, 2);

    const intervals = [0, 4000, 3000, 2000];
    this.teleportTimer = intervals[this.phase] ?? 2000;
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    if (this.teleporting) return [];
    const chargeBonus = Math.min(Math.floor(this.chargeCounter / 300), 6);
    this.chargeCounter = 0;

    switch (this.phase) {
      case 1:
        return aimed(angleToPlayer, 3 + chargeBonus, 0.4, 180);
      case 2:
        return [...aimed(angleToPlayer, 3 + chargeBonus, 0.4, 180), ...radial(6, 70)];
      case 3:
        return [
          ...aimed(angleToPlayer, 3 + chargeBonus, 0.4, 180),
          ...radial(6, 70),
          ...spiral(3, 90, this.spiralAngle),
        ];
      default:
        return aimed(angleToPlayer, 3, 0.4, 180);
    }
  }

  takeDamage(amount: number): boolean {
    if (this.teleporting) return false;

    this.hp -= amount;
    if (this.hp <= 0) {
      this.destroy();
      return true;
    }

    if (this.hp <= 13 && this.phase === 2) {
      this.phase = 3;
      this.fireRate = 1500;
    } else if (this.hp <= 27 && this.phase === 1) {
      this.phase = 2;
      this.fireRate = 2000;
    }

    this.draw(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) this.draw(this.color);
    });
    return false;
  }

  notifyDecoyKilled() {
    this.decoyCount = Math.max(0, this.decoyCount - 1);
  }
}
