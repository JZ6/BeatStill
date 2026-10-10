import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { aimed } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";
import type { TickEvent } from "../../core/Conductor";
import { px } from "../../systems/GameConfig";
import { weave, weavePitchHint } from "./rhythm";

/** Peak lateral offset of the weave (base px, UI-scaled). One weave cycle per beat of the conductor. */
const WEAVE_AMPLITUDE = 22;
/** The weave fades out within this distance of the target so the sideways axis can't flip at close range. */
const WEAVE_FADE_DIST = 80;
/**
 * Mean forward fraction of the old weave (heading wobbled by 0.6·sin φ): J0(0.6) ≈ 0.912.
 * Chasing straight at this fraction of speed keeps the average approach speed unchanged.
 */
const FORWARD_FACTOR = 0.912;

export class SnakeEnemy extends Enemy {
  /** Where in its weave this snake is on each beat (0..1 of a cycle), so snakes don't sway in unison. */
  private readonly weavePhase: number;
  /** Conductor beat of the first weave frame (null until then). */
  private weaveStartBeat: number | null = null;
  /** Lateral offset applied last frame; x/y = path position + this offset. */
  private offsetX = 0;
  private offsetY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "snake");
    this.weavePhase = Phaser.Math.FloatBetween(0, 1);
    this.draw(this.color);
  }

  /** The weave at the moment of the shot: the melody follows the sway. */
  protected pitchHint(at?: TickEvent): number | undefined {
    return at ? weavePitchHint(at.beat, this.weavePhase) : undefined;
  }

  /** Wavy body along local +x (head end); `rotation` follows the chase heading. */
  protected drawShape(color: number) {
    const r = this.radius;
    const dmg = 1 - this.hp / this.maxHp;
    const segments = 6;
    const tailX = -r;
    const headX = r * 0.75;
    const amp = r * 0.35;

    const traceBody = () => {
      this.beginPath();
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const bx = tailX + (headX - tailX) * t;
        const by = Math.sin(t * Math.PI * 2) * amp;
        if (i === 0) this.moveTo(bx, by); else this.lineTo(bx, by);
      }
    };

    this.lineStyle(px(6), color, 0.3 * (1 - dmg * 0.6));
    traceBody();
    this.strokePath();
    this.lineStyle(px(3), color, 1);
    traceBody();
    this.strokePath();

    this.fillStyle(color, 1);
    this.fillCircle(headX, 0, r * 0.25);
  }

  protected updateMovement(delta: number, timeScale: number, gameScene: GameScene) {
    this.targetX = gameScene.ship.x;
    this.targetY = gameScene.ship.y;

    // Steer the underlying path (position minus last offset), not the weaving body.
    const dx = this.targetX - (this.x - this.offsetX);
    const dy = this.targetY - (this.y - this.offsetY);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = delta / 1000;

    if (dist > 5) {
      const ux = dx / dist;
      const uy = dy / dist;
      this.rotation = Math.atan2(dy, dx);
      this.x += ux * this.speed * FORWARD_FACTOR * timeScale * dt;
      this.y += uy * this.speed * FORWARD_FACTOR * timeScale * dt;

      // The offset is a pure function of the conductor's beat, applied as a delta from last frame's
      // offset: frame-rate independent, time-scaled with the music, and wall push-outs are preserved.
      const beat = gameScene.conductor.beat;
      this.weaveStartBeat ??= beat;
      // Swells in over the first beat, so a snake joining mid-sway doesn't jump sideways.
      const swell = Math.min(beat - this.weaveStartBeat, 1);
      const fade = Math.min(dist / px(WEAVE_FADE_DIST), 1) * swell;
      const lateral = px(WEAVE_AMPLITUDE) * fade * weave(beat, this.weavePhase);
      const ox = -uy * lateral;
      const oy = ux * lateral;
      this.x += ox - this.offsetX;
      this.y += oy - this.offsetY;
      this.offsetX = ox;
      this.offsetY = oy;
    }
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return aimed(angleToPlayer, 3, 0.3, 200);
  }
}
