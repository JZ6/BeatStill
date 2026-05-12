import { Enemy } from "./Enemy";
import { aimed } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";

export class TrackerEnemy extends Enemy {
  readonly enemyType = "tracker" as const;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 1, 60, 2500, 0xff8800, 12);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    this.drawPolygon(color, 3);
  }

  protected updateMovement(delta: number, timeScale: number, gameScene: GameScene) {
    this.targetX = gameScene.ship.x;
    this.targetY = gameScene.ship.y - 150;
    this.moveTowardTarget(delta / 1000, timeScale);
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return aimed(angleToPlayer, 2, 0.3, 170);
  }
}
