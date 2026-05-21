import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { radial } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import { GAME_W, GAME_H } from "../../systems/GameConfig";

export class CirclerEnemy extends Enemy {
  readonly enemyType = "circler" as const;
  private driftAngle: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 3, 20, 2200, 0x44ff88, 16);
    this.driftAngle = Math.random() * Math.PI * 2;
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    this.drawPolygon(color, 6);
  }

  protected updateMovement(delta: number, timeScale: number) {
    const dt = delta / 1000;
    this.x += Math.cos(this.driftAngle) * this.speed * timeScale * dt;
    this.y += Math.sin(this.driftAngle) * this.speed * timeScale * dt;
    if (this.x < 40 || this.x > GAME_W - 40 || this.y < 40 || this.y > GAME_H - 40) {
      this.driftAngle = Math.atan2(GAME_H / 2 - this.y, GAME_W / 2 - this.x) + Phaser.Math.FloatBetween(-0.5, 0.5);
    }
  }

  protected getFirePattern(): BulletConfig[] {
    return radial(16, 110);
  }
}
