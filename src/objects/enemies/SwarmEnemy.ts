import { Enemy } from "./Enemy";
import { aimed } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";

export class SwarmEnemy extends Enemy {
  readonly enemyType = "swarm" as const;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 1, 90, 3200, 0xffff44, 8);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    this.drawPolygon(color, 3);
  }

  protected updateMovement(delta: number, timeScale: number, gameScene: GameScene) {
    this.targetX = gameScene.ship.x;
    this.targetY = gameScene.ship.y;
    this.moveTowardTarget(delta / 1000, timeScale, 1);
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return aimed(angleToPlayer, 2, 0.25, 170);
  }
}
