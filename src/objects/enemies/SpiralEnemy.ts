import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { spiral } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import { TICKS_PER_STEP, type TickEvent } from "../../core/Conductor";
import type { GameScene } from "../../scenes/GameScene";
import { spiralAngle } from "./rhythm";

export class SpiralEnemy extends Enemy {
  /** Arm angle at step 0, so spirals don't turn in unison. The arms advance per step, not per frame. */
  private readonly anglePhase: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "spiral");
    this.anglePhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.draw(this.color);
  }

  protected updateMovement(delta: number, timeScale: number) {
    if (this.moveTowardTarget(delta / 1000, timeScale)) {
      this.pickNewTarget();
    }
  }

  protected getFirePattern(_angleToPlayer: number, _gameScene: GameScene, at?: TickEvent): BulletConfig[] {
    const step = at ? at.tick / TICKS_PER_STEP : 0;
    return spiral(4, 130, spiralAngle(step, this.anglePhase));
  }
}
