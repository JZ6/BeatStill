import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { rhythmHits } from "./registry";
import { BossPhases, GridTimer } from "./bossPhases";
import { SwarmEnemy } from "./SwarmEnemy";
import { TrackerEnemy } from "./TrackerEnemy";
import type { BulletConfig } from "../BulletPattern";
import { sentinelVolley } from "./volleys";
import { SENTINEL_SPIRAL_STEP_ANGLE, spiralAngle } from "./rhythm";
import type { GameScene } from "../../scenes/GameScene";
import { STEPS_PER_BEAT, TICKS_PER_STEP, type TickEvent } from "../../core/Conductor";
import { GAME_W, GAME_H } from "../../systems/GameConfig";

/** Phase 2 at ≤ 2/3 of max hp, phase 3 at ≤ 1/3 (20 / 10 at 30 hp). */
const PHASE_THRESHOLDS = [2 / 3, 1 / 3];
/** After the bar line of a phase change: white, invulnerable, holding fire and still. */
const TRANSITION_BEATS = 2;
/** First summon: the first bar line at least this far (≈ 3 s at 100 bpm) after spawn or a phase change. */
const FIRST_SUMMON_STEPS = 5 * STEPS_PER_BEAT;
/** Bars between summons in phases 1 and 2 (≈ the old 6000 / 8000 ms); phase 3 doesn't summon. */
const SUMMON_BARS = [2, 3];

/**
 * Three-phase boss. Phases are song sections: crossing an hp threshold shields it, the new phase
 * (and its rhythm, anchored to the bar) starts on the next bar line, then a 2-beat transition.
 * Minions arrive on bar lines.
 */
export class SentinelBoss extends Enemy {
  /** The inner square's angle: the phase-3 spiral's arm angle at the conductor's position. */
  private innerAngle = 0;
  private readonly phases = new BossPhases({
    thresholds: PHASE_THRESHOLDS,
    transitionBeats: TRANSITION_BEATS,
    shieldWhilePending: true,
  });
  private readonly summons = new GridTimer();
  private started = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "sentinel");
    this.draw(this.color);
  }

  private get phase(): number {
    return this.phases.phase;
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
    // Turns with the music, so it points where the next phase-3 volley's arms will be.
    this.innerAngle = spiralAngle(gameScene.conductor.tickPosition / TICKS_PER_STEP, 0, SENTINEL_SPIRAL_STEP_ANGLE);

    if (!this.phases.transitioning) {
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
      this.moveTowardTarget(delta / 1000, timeScale);
    }

    this.draw(this.currentColor());
  }

  /** Bar lines switch a queued phase and bring minions; then the rhythm decides whether to fire. */
  onStep(step: number, tick: TickEvent, gameScene: GameScene) {
    if (!this.active) return;
    const stepsPerBar = gameScene.conductor.ticksPerBar / TICKS_PER_STEP;
    if (!this.started) {
      this.started = true;
      this.summons.schedule(step, FIRST_SUMMON_STEPS, stepsPerBar);
    }

    const entered = this.phases.onStep(step, tick.isBar);
    if (entered > 0) this.enterPhase(entered, step, tick, stepsPerBar);

    if (this.phase < 3 && !this.phases.transitioning && this.summons.due(step, tick.isBar)) {
      this.summon(gameScene);
      this.summons.schedule(step, SUMMON_BARS[this.phase - 1] * stepsPerBar, stepsPerBar);
    }

    super.onStep(step, tick, gameScene);
  }

  /** White while shielded: from crossing a threshold to the end of the transition. */
  protected currentColor(): number {
    return this.phases.invulnerable ? 0xffffff : super.currentColor();
  }

  /** Volleys due during the transition are held, not lost. The old section plays on until the bar line. */
  protected canFire(): boolean {
    return !this.phases.transitioning;
  }

  /** Phase 3's spiral arms advance per step (like the Spiral enemy), not per frame. */
  protected getFirePattern(angleToPlayer: number, _gameScene: GameScene, at?: TickEvent): BulletConfig[] {
    const step = at ? at.tick / TICKS_PER_STEP : 0;
    return sentinelVolley(this.phase, angleToPlayer, spiralAngle(step, 0, SENTINEL_SPIRAL_STEP_ANGLE));
  }

  takeDamage(amount: number): boolean {
    if (this.phases.invulnerable) return false;

    this.hp -= amount;
    if (this.hp <= 0) {
      this.destroy();
      return true;
    }

    // Derived from current hp, so one big hit can queue phase 3 directly.
    this.phases.onHp(this.hp, this.maxHp);
    this.startFlash();
    return false;
  }

  private summon(gameScene: GameScene) {
    const swarm = this.phase === 1;
    for (let i = 0; i < (swarm ? 3 : 2); i++) {
      const x = this.x + Phaser.Math.Between(-40, 40);
      const y = this.y + Phaser.Math.Between(-20, 20);
      gameScene.enemies.add(swarm ? new SwarmEnemy(this.scene, x, y) : new TrackerEnemy(this.scene, x, y));
    }
  }

  /** On the bar line: the new section's rhythm starts here, summons restart, the music marks it. */
  private enterPhase(phase: number, step: number, tick: TickEvent, stepsPerBar: number) {
    this.rhythm.setPattern(rhythmHits(this.enemyType, phase), step);
    if (phase < 3) this.summons.schedule(step, FIRST_SUMMON_STEPS, stepsPerBar);
    else this.summons.stop();
    this.draw(this.currentColor());
    this.emitGameEvent("bossPhaseChanged", { bossType: this.enemyType, phase, tick: tick.tick, lateBy: tick.lateBy });
  }
}
