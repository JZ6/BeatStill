import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { PhantomDecoy } from "./PhantomDecoy";
import { rhythmHits } from "./registry";
import { BossPhases, GridTimer } from "./bossPhases";
import type { BulletConfig } from "../BulletPattern";
import { phantomTeleportVolley, phantomVolley } from "./volleys";
import { spiralAngle } from "./rhythm";
import type { GameScene } from "../../scenes/GameScene";
import { STEPS_PER_BEAT, TICKS_PER_STEP, type TickEvent } from "../../core/Conductor";
import { GAME_W, GAME_H } from "../../systems/GameConfig";

/** Phase 2 at ≤ 67.5% of max hp, phase 3 at ≤ 32.5% (27 / 13 at 40 hp). */
const PHASE_THRESHOLDS = [0.675, 0.325];
/** Beats between teleports in phases 1–3 (≈ the old 4000 / 3000 / 2000 ms at 100 bpm). */
const TELEPORT_BEATS = [8, 6, 4];
/** A teleport starts on a beat and lasts an 8th: it vanishes, reappears a 16th later, and is back on the next 16th. */
const TELEPORT_STEPS = 2;
const MAX_DECOYS = 2;

/**
 * Teleporting boss. Phases change on bar lines (no transition hold, as before); teleports start
 * on beats every 8 / 6 / 4 beats. Its charge still builds in real time while time is nearly frozen.
 */
export class PhantomBoss extends Enemy {
  private readonly phases = new BossPhases({ thresholds: PHASE_THRESHOLDS, transitionBeats: 0, shieldWhilePending: false });
  private readonly teleports = new GridTimer();
  private started = false;
  private chargeCounter = 0;
  private teleporting = false;
  private arrived = false;
  private teleportStartStep = 0;
  /** Teleport progress 0..1, from the conductor's tick position (drawing only). */
  private teleportProgress = 0;
  private teleportFromX = 0;
  private teleportFromY = 0;
  private teleportToX = 0;
  private teleportToY = 0;
  private prevPositions: { x: number; y: number }[] = [];
  private trailTimer = 0;
  private readonly decoys = new Set<PhantomDecoy>();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "phantom");
    this.draw(this.color);
  }

  private get phase(): number {
    return this.phases.phase;
  }

  protected drawShape(color: number) {
    const r = this.radius;

    for (let i = this.prevPositions.length - 1; i >= 0; i--) {
      const p = this.prevPositions[i];
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const alpha = 0.05 + (this.prevPositions.length - 1 - i) * 0.05;
      this.lineStyle(1, color, alpha);
      this.beginPath();
      const drawDiamond = (cx: number, cy: number, rad: number) => {
        this.moveTo(cx, cy - rad);
        this.lineTo(cx + rad * 0.6, cy);
        this.lineTo(cx, cy + rad);
        this.lineTo(cx - rad * 0.6, cy);
        this.closePath();
      };
      drawDiamond(dx, dy, r * 0.8);
      this.strokePath();
    }

    // Fades out over the first half of the teleport and back in over the second.
    const teleportAlpha = this.teleporting ? Math.abs(1 - 2 * this.teleportProgress) : 1;

    if (this.chargeCounter > 100) {
      const glowR = 20 + this.chargeCounter / 50;
      const glowAlpha = Math.min(this.chargeCounter / 1800, 0.4) * teleportAlpha;
      this.lineStyle(2, 0x88bbff, glowAlpha);
      this.strokeCircle(0, 0, glowR);
      this.fillStyle(0x4488ff, glowAlpha * 0.3);
      this.fillCircle(0, 0, glowR);
    }

    this.lineStyle(3, color, 0.3 * teleportAlpha);
    this.beginPath();
    this.moveTo(0, -(r + 4));
    this.lineTo((r + 4) * 0.6, 0);
    this.lineTo(0, r + 4);
    this.lineTo(-(r + 4) * 0.6, 0);
    this.closePath();
    this.strokePath();

    this.lineStyle(1.5, color, teleportAlpha);
    this.beginPath();
    this.moveTo(0, -r);
    this.lineTo(r * 0.6, 0);
    this.lineTo(0, r);
    this.lineTo(-r * 0.6, 0);
    this.closePath();
    this.strokePath();

    this.fillStyle(color, 0.15 * teleportAlpha);
    this.beginPath();
    this.moveTo(0, -r);
    this.lineTo(r * 0.6, 0);
    this.lineTo(0, r);
    this.lineTo(-r * 0.6, 0);
    this.closePath();
    this.fillPath();
  }

  protected updateMovement(delta: number, timeScale: number, gameScene: GameScene) {
    const dt = delta / 1000;

    // Charges in REAL time while the world is nearly frozen: it punishes camping in slow-mo.
    if (gameScene.timeScale < 0.15) {
      this.chargeCounter = Math.min(this.chargeCounter + delta, 1800);
    }

    this.trailTimer -= delta * timeScale;
    if (this.trailTimer <= 0 && !this.teleporting) {
      this.prevPositions.push({ x: this.x, y: this.y });
      if (this.prevPositions.length > 3) this.prevPositions.shift();
      this.trailTimer = 100;
    }

    if (this.teleporting) {
      // The jump itself happens on steps (onStep); this only animates the fade on the same clock.
      const elapsed = gameScene.conductor.tickPosition - this.teleportStartStep * TICKS_PER_STEP;
      this.teleportProgress = Phaser.Math.Clamp(elapsed / (TELEPORT_STEPS * TICKS_PER_STEP), 0, 1);
      this.draw(this.currentColor());
      return;
    }

    this.targetX = gameScene.ship.x;
    this.targetY = gameScene.ship.y;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 180) {
      this.x += (dx / dist) * this.speed * timeScale * dt * 0.3;
      this.y += (dy / dist) * this.speed * timeScale * dt * 0.3;
    }

    this.draw(this.currentColor());
  }

  /** Bar lines switch a queued phase; beats start teleports; steps move a teleport along; then the rhythm. */
  onStep(step: number, tick: TickEvent, gameScene: GameScene) {
    if (!this.active) return;
    if (!this.started) {
      this.started = true;
      this.teleports.schedule(step, this.teleportSteps(), STEPS_PER_BEAT);
    }

    const entered = this.phases.onStep(step, tick.isBar);
    if (entered > 0) this.enterPhase(entered, step, tick);

    if (this.teleporting) this.advanceTeleport(step, gameScene);
    else if (this.teleports.due(step, tick.isBeat)) this.startTeleport(step, tick, gameScene);

    super.onStep(step, tick, gameScene);
  }

  private teleportSteps(): number {
    return TELEPORT_BEATS[this.phase - 1] * STEPS_PER_BEAT;
  }

  private startTeleport(step: number, tick: TickEvent, gameScene: GameScene) {
    this.teleportFromX = this.x;
    this.teleportFromY = this.y;
    this.teleportToX = Phaser.Math.Between(80, GAME_W - 80);
    this.teleportToY = Phaser.Math.Between(80, GAME_H - 120);
    this.teleporting = true;
    this.arrived = false;
    this.teleportStartStep = step;
    this.teleportProgress = 0;

    if (this.phase >= 2) {
      this.spawnVolley(gameScene, phantomTeleportVolley(), this.teleportFromX, this.teleportFromY, tick);
    }

    if (this.phase >= 3 && this.decoys.size < MAX_DECOYS) {
      const decoy = new PhantomDecoy(this.scene, this.teleportFromX, this.teleportFromY, this);
      this.decoys.add(decoy);
      gameScene.enemies.add(decoy);
    }

    gameScene.particles.burst(this.teleportFromX, this.teleportFromY, this.color, 15, 60, 2);
    this.teleports.schedule(step, this.teleportSteps(), STEPS_PER_BEAT);
  }

  /** Reappears halfway (a 16th after leaving) and is solid again at the end. */
  private advanceTeleport(step: number, gameScene: GameScene) {
    const elapsed = step - this.teleportStartStep;
    if (!this.arrived && elapsed >= TELEPORT_STEPS / 2) {
      this.arrived = true;
      this.x = this.teleportToX;
      this.y = this.teleportToY;
      this.prevPositions = [];
    }
    if (elapsed >= TELEPORT_STEPS) {
      this.teleporting = false;
      this.teleportProgress = 0;
      gameScene.particles.burst(this.x, this.y, this.color, 12, 50, 2);
    }
  }

  /** Volleys due mid-teleport are held and fire on arrival, not lost. */
  protected canFire(): boolean {
    return !this.teleporting;
  }

  /** Phase 3's spiral arms advance per step (like the Spiral enemy), not per frame. */
  protected getFirePattern(angleToPlayer: number, _gameScene: GameScene, at?: TickEvent): BulletConfig[] {
    const chargeBonus = Math.min(Math.floor(this.chargeCounter / 300), 6);
    this.chargeCounter = 0;
    const step = at ? at.tick / TICKS_PER_STEP : 0;
    return phantomVolley(this.phase, angleToPlayer, chargeBonus, spiralAngle(step, 0));
  }

  takeDamage(amount: number): boolean {
    if (this.teleporting) return false;

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

  /** On the bar line: the new section's rhythm starts here and teleports never get rarer. */
  private enterPhase(phase: number, step: number, tick: TickEvent) {
    this.rhythm.setPattern(rhythmHits(this.enemyType, phase), step);
    this.teleports.scheduleNoLater(step, this.teleportSteps(), STEPS_PER_BEAT);
    this.emitGameEvent("bossPhaseChanged", { bossType: this.enemyType, phase, tick: tick.tick, lateBy: tick.lateBy });
  }

  /** Called by a decoy this boss spawned, exactly once, when it is destroyed. */
  onDecoyDestroyed(decoy: PhantomDecoy) {
    this.decoys.delete(decoy);
  }

  /** Decoys never outlive the boss (they would block the wave from clearing). */
  protected preDestroy() {
    const decoys = [...this.decoys];
    this.decoys.clear();
    for (const decoy of decoys) decoy.destroy();
    super.preDestroy();
  }
}
