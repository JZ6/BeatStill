import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { radial } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import { GAME_W, GAME_H } from "../../systems/GameConfig";

const EDGE_MARGIN = 40;
/** Minimum inward component of the unit heading that counts as "coming back" from an edge. */
const MIN_INWARD = 0.4;

export class CirclerEnemy extends Enemy {
  private driftAngle: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "circler");
    this.driftAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.draw(this.color);
  }

  protected updateMovement(delta: number, timeScale: number) {
    const dt = delta / 1000;
    this.x += Math.cos(this.driftAngle) * this.speed * timeScale * dt;
    this.y += Math.sin(this.driftAngle) * this.speed * timeScale * dt;
    // Re-aim only when past the margin and not already heading back in, so it re-aims
    // once per edge entry instead of re-rolling the wobble every frame.
    if (!this.headingInward(this.driftAngle)) {
      const toCenter = Math.atan2(GAME_H / 2 - this.y, GAME_W / 2 - this.x);
      const wobbled = toCenter + Phaser.Math.FloatBetween(-0.5, 0.5);
      // Straight at the center clears MIN_INWARD at 16:9/9:16 (>= ~0.47 even in corners).
      this.driftAngle = this.headingInward(wobbled) ? wobbled : toCenter;
    }
  }

  /** False if past an edge margin while the heading isn't clearly back toward the play area. */
  private headingInward(angle: number): boolean {
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);
    if (this.x < EDGE_MARGIN && vx < MIN_INWARD) return false;
    if (this.x > GAME_W - EDGE_MARGIN && -vx < MIN_INWARD) return false;
    if (this.y < EDGE_MARGIN && vy < MIN_INWARD) return false;
    if (this.y > GAME_H - EDGE_MARGIN && -vy < MIN_INWARD) return false;
    return true;
  }

  protected getFirePattern(): BulletConfig[] {
    return radial(16, 110);
  }
}
