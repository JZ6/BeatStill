import { Enemy } from "./Enemy";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";
import { trackerVolley } from "./volleys";

export class TrackerEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tracker");
    this.draw(this.color);
  }

  protected updateMovement(delta: number, timeScale: number, gameScene: GameScene) {
    this.targetX = gameScene.ship.x;
    this.targetY = Math.max(40, gameScene.ship.y - 150);
    this.moveTowardTarget(delta / 1000, timeScale);
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return trackerVolley(angleToPlayer);
  }
}
