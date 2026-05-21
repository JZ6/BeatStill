import { Enemy } from "./Enemy";
import { aimed } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";

export class TrackerEnemy extends Enemy {
  readonly enemyType = "tracker" as const;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 1, 60, 2000, 0xff8800, 12);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    this.drawPolygon(color, 4);
  }

  protected updateMovement(delta: number, timeScale: number, gameScene: GameScene) {
    this.targetX = gameScene.ship.x;
    this.targetY = Math.max(40, gameScene.ship.y - 150);
    this.moveTowardTarget(delta / 1000, timeScale);
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return aimed(angleToPlayer, 3, 0.4, 220);
  }
}
