import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { SwarmEnemy } from "./SwarmEnemy";
import { TrackerEnemy } from "./TrackerEnemy";
import { radial, aimed, spiral } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";
import { GAME_W, GAME_H } from "../../systems/GameConfig";

export class SentinelBoss extends Enemy {
  readonly enemyType = "sentinel" as const;
  private phase = 1;
  private innerAngle = 0;
  private minionTimer = 3000;
  private phaseTransition = false;
  private phaseTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 30, 8, 2000, 0xffaa22, 36);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    const r = this.radius;

    this.lineStyle(4, color, 0.2);
    this.strokeCircle(0, 0, r + 8);

    const drawPoly = (rad: number, sides: number, rotation: number) => {
      this.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (Math.PI * 2 * i) / sides + rotation;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) this.moveTo(px, py); else this.lineTo(px, py);
      }
      this.closePath();
    };

    this.lineStyle(3, color, 0.3);
    drawPoly(r + 4, 12, -Math.PI / 2);
    this.strokePath();

    this.lineStyle(1.5, color, 1);
    drawPoly(r, 12, -Math.PI / 2);
    this.strokePath();

    this.fillStyle(color, 0.12);
    drawPoly(r, 12, -Math.PI / 2);
    this.fillPath();

    const innerR = r * 0.45;
    const innerColor = this.phase === 3 ? 0xff4444 : this.phase === 2 ? 0xffcc44 : color;
    this.lineStyle(1.5, innerColor, 0.8);
    drawPoly(innerR, 4, this.innerAngle);
    this.strokePath();
    this.fillStyle(innerColor, 0.2);
    drawPoly(innerR, 4, this.innerAngle);
    this.fillPath();
  }

  protected updateMovement(delta: number, timeScale: number, gameScene: GameScene) {
    const dt = delta / 1000;
    this.innerAngle += delta * timeScale * 0.003;

    if (this.phaseTransition) {
      this.phaseTimer -= delta * timeScale;
      if (this.phaseTimer <= 0) {
        this.phaseTransition = false;
        this.draw(this.color);
      }
      return;
    }

    const playerDist = Phaser.Math.Distance.Between(this.x, this.y, gameScene.ship.x, gameScene.ship.y);
    if (playerDist < 150) {
      const away = Math.atan2(this.y - gameScene.ship.y, this.x - gameScene.ship.x);
      this.targetX = Phaser.Math.Clamp(this.x + Math.cos(away) * 200, 80, GAME_W - 80);
      this.targetY = Phaser.Math.Clamp(this.y + Math.sin(away) * 200, 60, GAME_H * 0.4);
    } else {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      if (dx * dx + dy * dy < 25) {
        this.targetX = Phaser.Math.Between(100, GAME_W - 100);
        this.targetY = Phaser.Math.Between(60, Math.floor(GAME_H * 0.4));
      }
    }

    this.moveTowardTarget(dt, timeScale);

    this.minionTimer -= delta * timeScale;
    if (this.minionTimer <= 0 && this.phase < 3) {
      if (this.phase === 1) {
        for (let i = 0; i < 3; i++) {
          const ox = Phaser.Math.Between(-40, 40);
          const oy = Phaser.Math.Between(-20, 20);
          gameScene.enemies.add(new SwarmEnemy(this.scene, this.x + ox, this.y + oy));
        }
      } else {
        for (let i = 0; i < 2; i++) {
          const ox = Phaser.Math.Between(-40, 40);
          const oy = Phaser.Math.Between(-20, 20);
          gameScene.enemies.add(new TrackerEnemy(this.scene, this.x + ox, this.y + oy));
        }
      }
      this.minionTimer = this.phase === 1 ? 6000 : 8000;
    }

    this.draw(this.color);
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    if (this.phaseTransition) return [];
    switch (this.phase) {
      case 1:
        return radial(8, 90);
      case 2:
        return [...radial(12, 100), ...aimed(angleToPlayer, 3, 0.3, 160)];
      case 3:
        return [...spiral(5, 110, this.innerAngle), ...aimed(angleToPlayer, 2, 0.2, 200)];
      default:
        return radial(8, 90);
    }
  }

  takeDamage(amount: number): boolean {
    if (this.phaseTransition) return false;

    this.hp -= amount;
    if (this.hp <= 0) {
      this.destroy();
      return true;
    }

    if (this.hp <= 10 && this.phase === 2) {
      this.enterPhase(3);
    } else if (this.hp <= 20 && this.phase === 1) {
      this.enterPhase(2);
    }

    this.draw(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active && !this.phaseTransition) this.draw(this.color);
    });
    return false;
  }

  private enterPhase(phase: number) {
    this.phase = phase;
    this.phaseTransition = true;
    this.phaseTimer = 1000;
    this.fireRate = phase === 2 ? 1500 : 800;
    this.draw(0xffffff);
  }
}
