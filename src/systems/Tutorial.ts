import Phaser from "phaser";
import type { GameScene } from "../scenes/GameScene";
import type { TickEvent } from "../core/Conductor";
import { PendingSpawn, nextBarLine } from "../core/barSchedule";
import { createEnemy, type Enemy, type EnemyType } from "../objects/enemies";
import { ROLE_LABELS } from "../music/palettes";
import { GAME_W, GAME_H, isMobile, px } from "./GameConfig";
import {
  StepGate,
  buildTutorialSteps,
  createLatch,
  goalMet,
  recordKill,
  recordShot,
  sampleLatch,
  typesToSpawn,
  type TutorialLatch,
  type TutorialStep,
  type TutorialStepId,
} from "./tutorialSteps";

const STORAGE_KEY = "beatstill_tutorial_done";
/** Base pixels (scaled with the UI) the ship must travel in the move step. */
const MOVE_DISTANCE = 100;
/**
 * Spacing of a chain step's cluster in game pixels. Deliberately not UI-scaled: the chain radius
 * (ChainSystem.CHAIN_RADIUS = 120) isn't either, so neighbours are always within chain reach.
 */
const CLUSTER_SPACING = 50;

export function isTutorialDone(): boolean {
  try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
}

function markTutorialDone(): void {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
}

interface Spawned {
  enemy: Enemy;
  label: Phaser.GameObjects.Text;
}

/**
 * The first-run tutorial: one step at a time, each teaching a musical mechanic. A step advances once
 * its latched goal is met (see tutorialSteps.ts) and it has been on screen for MIN_STEP_MS of real
 * time. Steps with enemies bring them in on the next bar line and bring them back if they are all
 * gone with the goal unmet, so no step can softlock. Finishing or skipping starts endless mode
 * exactly once, through WaveDirector.spawnEndlessWave().
 */
export class TutorialManager {
  private readonly scene: GameScene;
  private readonly steps: TutorialStep[];
  private step = 0;
  private done = false;
  private transitioning = false;
  private latch: TutorialLatch;
  private gate = new StepGate();
  /** This step's enemies, waiting for their bar line (queued at most once). */
  private readonly pendingSpawn = new PendingSpawn<EnemyType[]>();
  private spawned: Spawned[] = [];
  private readonly unsubscribers: (() => void)[] = [];

  private msgText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private skipText: Phaser.GameObjects.Text;
  private stepDots: Phaser.GameObjects.Text;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.steps = buildTutorialSteps(isMobile(), px(MOVE_DISTANCE));
    this.latch = this.freshLatch();

    const cx = GAME_W / 2;

    this.msgText = scene.add
      .text(cx, GAME_H - px(90), "", {
        fontFamily: "monospace",
        fontSize: `${px(24)}px`,
        color: "#ffaa44",
        align: "center",
        stroke: "#0a0806",
        strokeThickness: px(4),
        wordWrap: { width: GAME_W - px(80) },
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0);

    this.hintText = scene.add
      .text(cx, GAME_H - px(56), "", {
        fontFamily: "monospace",
        fontSize: `${px(13)}px`,
        color: "#887766",
        align: "center",
        stroke: "#0a0806",
        strokeThickness: px(3),
        wordWrap: { width: GAME_W - px(80) },
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0);

    this.stepDots = scene.add
      .text(cx, GAME_H - px(25), "", {
        fontFamily: "monospace",
        fontSize: `${px(12)}px`,
        color: "#554433",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0);

    this.skipText = scene.add
      .text(GAME_W - px(32), GAME_H - px(20), "SKIP TUTORIAL", {
        fontFamily: "monospace",
        fontSize: `${px(13)}px`,
        color: "#554433",
      })
      .setOrigin(1, 1)
      .setDepth(300)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.skipText.setColor("#887766"))
      .on("pointerout", () => this.skipText.setColor("#554433"))
      .on("pointerdown", () => this.skip());

    // Latched counters: every shot and kill since the step was entered.
    const events = scene.gameEvents;
    this.unsubscribers.push(
      events.on("playerFired", () => recordShot(this.latch)),
      events.on("enemyKilled", (p) => recordKill(this.latch, p.enemyType, p.chainCount)),
      scene.onTick((t) => this.onTick(t)),
    );

    this.showStep(0);
  }

  get isActive(): boolean { return !this.done; }

  /** The current step's id, or null once finished (diagnostics and the smoke test). */
  get stepId(): TutorialStepId | null {
    return this.done ? null : this.steps[this.step]?.id ?? null;
  }

  get stepIndex(): number {
    return this.step;
  }

  get stepCount(): number {
    return this.steps.length;
  }

  private freshLatch(): TutorialLatch {
    const ship = this.scene.ship;
    return createLatch(ship.x, ship.y, ship.rotation, this.scene.timeScale);
  }

  private showStep(index: number) {
    if (index >= this.steps.length) { this.finish(); return; }
    const step = this.steps[index];

    // Everything the goal reads starts here: position, rotation, counters, real time on screen.
    this.latch = this.freshLatch();
    this.gate = new StepGate();
    this.pendingSpawn.cancel();
    this.clearSpawned(false);
    this.queueSpawn(typesToSpawn(step, this.latch));

    const dots = this.steps.map((_, i) => i === index ? "●" : "○").join(" ");
    this.stepDots.setText(dots);

    if (this.pulseTween) { this.pulseTween.stop(); this.pulseTween = null; }

    this.msgText.setAlpha(0).setText(step.message);
    this.hintText.setAlpha(0).setText(step.hint ?? "");
    this.stepDots.setAlpha(0);

    this.scene.tweens.add({
      targets: [this.msgText, this.stepDots],
      alpha: 1,
      duration: 300,
      ease: "Sine.easeOut",
    });

    if (step.hint) {
      this.scene.tweens.add({
        targets: this.hintText,
        alpha: 0.8,
        duration: 400,
        delay: 150,
      });
    }

    this.pulseTween = this.scene.tweens.add({
      targets: this.msgText,
      alpha: { from: 1, to: 0.6 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private advance() {
    if (this.transitioning || this.done) return;
    this.transitioning = true;

    if (this.pulseTween) { this.pulseTween.stop(); this.pulseTween = null; }

    this.scene.tweens.add({
      targets: [this.msgText, this.hintText, this.stepDots],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        if (this.done) return;
        this.step++;
        this.transitioning = false;
        this.showStep(this.step);
      },
    });
  }

  skip() {
    this.finish();
  }

  /** Marks the tutorial done and starts endless mode. Idempotent: the first call wins. */
  private finish() {
    if (this.done) return;
    this.done = true;
    markTutorialDone();

    for (const off of this.unsubscribers.splice(0)) off();
    this.pendingSpawn.cancel();
    // Leftover tutorial enemies leave with a puff instead of joining wave 1.
    this.clearSpawned(true);

    if (this.pulseTween) { this.pulseTween.stop(); this.pulseTween = null; }
    this.skipText.disableInteractive();

    this.scene.tweens.add({
      targets: [this.msgText, this.hintText, this.stepDots, this.skipText],
      alpha: 0,
      duration: 400,
      onComplete: () => this.destroy(),
    });

    // The one start path of endless mode: wave 1 is queued for the next bar line (guarded).
    this.scene.waves.spawnEndlessWave();
  }

  /** Every conductor tick: this step's enemies arrive on their bar line. */
  private onTick(t: TickEvent) {
    if (this.done) return;
    const due = this.pendingSpawn.take(t.tick);
    if (due) this.spawnGroup(due.what);
  }

  /** Queues `types` for the next bar line not yet emitted. */
  private queueSpawn(types: EnemyType[]) {
    if (types.length === 0) return;
    const c = this.scene.conductor;
    this.pendingSpawn.schedule(nextBarLine(c.currentTick + 1, c.ticksPerBar), types);
  }

  /**
   * Spawns a group in the half of the screen away from the ship: a kill step's enemies spread
   * out, a chain step's packed within chain reach of each other.
   */
  private spawnGroup(types: EnemyType[]) {
    const s = this.scene;
    const step = this.steps[this.step];
    const spacing = step?.goal.kind === "chain" ? CLUSTER_SPACING : GAME_W * 0.3;
    const y = s.ship.y < GAME_H / 2 ? GAME_H * 0.72 : GAME_H * 0.28;
    types.forEach((type, i) => {
      const x = GAME_W / 2 + (i - (types.length - 1) / 2) * spacing;
      const enemy = createEnemy(s, x, y, type);
      s.enemies.add(enemy);
      s.particles.burst(x, y, enemy.def.color, 12, 60, 2);
      const label = s.add
        .text(x, y, ROLE_LABELS[enemy.def.role].toUpperCase(), {
          fontFamily: "monospace",
          fontSize: `${px(11)}px`,
          color: "#e8d5b0",
          stroke: "#0a0806",
          strokeThickness: px(3),
        })
        .setOrigin(0.5, 1)
        .setDepth(300)
        .setAlpha(0.85);
      this.spawned.push({ enemy, label });
    });
    this.updateLabels();
  }

  /** Instrument labels follow their enemies and go away with them. */
  private updateLabels() {
    for (const sp of this.spawned) {
      if (sp.enemy.active) sp.label.setPosition(sp.enemy.x, sp.enemy.y - sp.enemy.radius - px(6));
      else if (sp.label.visible) sp.label.setVisible(false);
    }
  }

  /** Removes this step's labels (and, with `enemies`, its live enemies). */
  private clearSpawned(enemies: boolean) {
    for (const sp of this.spawned) {
      sp.label.destroy();
      if (enemies && sp.enemy.active) {
        this.scene.particles.burst(sp.enemy.x, sp.enemy.y, sp.enemy.def.color, 10, 50, 2);
        sp.enemy.destroy();
      }
    }
    this.spawned = [];
  }

  /** Per live frame with REAL milliseconds (the minimum time on screen is real time). */
  update(delta: number) {
    if (this.done || this.transitioning) return;
    const step = this.steps[this.step];
    if (!step) return;

    const ship = this.scene.ship;
    sampleLatch(this.latch, ship.x, ship.y, ship.rotation, this.scene.timeScale);
    this.updateLabels();

    const met = goalMet(step.goal, this.latch);
    // No softlocks: if every enemy of the step is gone with the goal unmet, bring them back.
    if (!met && step.spawn && !this.pendingSpawn.isPending && this.spawned.every((sp) => !sp.enemy.active)) {
      this.clearSpawned(false);
      this.queueSpawn(typesToSpawn(step, this.latch));
    }

    if (this.gate.update(delta, met)) this.advance();
  }

  destroy() {
    for (const off of this.unsubscribers.splice(0)) off();
    this.clearSpawned(false);
    this.msgText.destroy();
    this.hintText.destroy();
    this.stepDots.destroy();
    this.skipText.destroy();
  }
}
