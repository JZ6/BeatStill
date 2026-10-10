import Phaser from "phaser";
import type { GameScene } from "../scenes/GameScene";
import type { TickEvent } from "../core/Conductor";
import { createEnemy, type Enemy, type EnemyType } from "../objects/enemies";
import { Asteroid } from "../objects/Asteroid";
import type { Bullet } from "../objects/Bullet";
import type { Wall } from "../objects/Wall";
import { PendingSpawn, nextBarLine, nextPhraseBoundary } from "../core/barSchedule";
import { EndlessMode } from "../systems/EndlessMode";
import { MUTATOR_PHRASE_BARS, isMutatorWave, nextKeyOffset, type SpawnParams } from "../systems/WaveMutators";
import { updateHighWave } from "../systems/Unlocks";
import { GAME_W, GAME_H } from "../systems/GameConfig";
import { shakeCamera } from "../systems/feedback";

/**
 * Song structure for both modes: waves are sections that start on bar lines. Level waves follow
 * the LevelRunner; endless waves are 8-bar sections that spawn continuously (EndlessMode), each
 * starting on the bar line after the previous one is spent and cleared. Endless mutators are
 * section modifiers that switch on at phrase boundaries with a key change. Also: boss kills and
 * dev spawning helpers.
 */
export class WaveDirector {
  bossActive = false;
  private readonly endless: EndlessMode;
  /** The next endless wave, waiting for its bar line (guarded: queued at most once). */
  private readonly nextWave = new PendingSpawn<"wave">();

  constructor(private readonly scene: GameScene) {
    this.endless = new EndlessMode(scene);
  }

  /** Ticks on which endless enemy groups spawned (the latest 256), for diagnostics and the smoke test. */
  get spawnTicks(): readonly number[] {
    return this.endless.spawnTicks;
  }

  /** The tick the next endless wave is queued for, or null. */
  get nextWaveTick(): number | null {
    return this.nextWave.tick;
  }

  /**
   * Every conductor tick, before the music and the enemies hear it. Levels: waves spawn on their
   * bar lines. Endless: a queued wave starts on its bar line, then the section spawns this downbeat.
   */
  onTick(t: TickEvent) {
    const s = this.scene;
    if (s.level) {
      s.level.onTick(t);
      return;
    }
    if (this.nextWave.take(t.tick)) this.startEndlessWave(t);
    if (t.isBar) {
      // A mutator switching on at this phrase boundary applies to this downbeat's group too.
      this.activateMutators(t);
      this.endless.onBar(t);
    }
  }

  /** Per live frame: once the field is clear, queues the next level wave, or the next endless wave once the section is spent. */
  update() {
    const s = this.scene;
    if (s.level) {
      s.level.update();
      return;
    }
    if (this.endless.isFinished()) this.queueEndlessWave();
  }

  /**
   * Queues the next endless wave for the next bar line and ends the current section's spawning.
   * Run start, the tutorial and the dev panel call this. Returns false if a wave is already queued
   * (that one starts instead) or in level mode.
   */
  spawnEndlessWave(): boolean {
    if (this.scene.level) return false;
    this.endless.cancel();
    return this.queueEndlessWave();
  }

  private queueEndlessWave(): boolean {
    const c = this.scene.conductor;
    return this.nextWave.schedule(nextBarLine(c.currentTick + 1, c.ticksPerBar), "wave");
  }

  /** On the queued bar line: the next wave number, its mutator, and its section. */
  private startEndlessWave(t: TickEvent) {
    const s = this.scene;
    s.wave++;
    s.hud.setWaveLabel(`WAVE ${s.wave}`);
    updateHighWave(s.wave);
    s.progression.processUnlocks();
    s.progression.processAchievements(false, false);

    if (isMutatorWave(s.wave)) {
      // A section modifier: it switches on at the next 4-bar phrase boundary (this bar line if it is one).
      const mutator = s.mutators.rollMutator();
      if (mutator) s.mutators.queueMutator(mutator, nextPhraseBoundary(t.tick, s.conductor.ticksPerBar, MUTATOR_PHRASE_BARS));
    }

    s.gameEvents.emit("waveStarted", { wave: s.wave, mode: "endless", tick: t.tick, lateBy: t.lateBy });
    this.endless.startSection(t);
  }

  /**
   * On a bar line: mutators due at this phrase boundary switch on. Each is announced and modulates
   * the harmony up a whole step (wrapping near home); the tempo follows double_time, and live
   * enemies take on the new speed and fire density (HP changes only affect new spawns).
   */
  private activateMutators(t: TickEvent) {
    const s = this.scene;
    const before = s.mutators.getActiveParams();
    const activated = s.mutators.activateDue(t.tick);
    if (activated.length === 0) return;
    const after = s.mutators.getActiveParams();
    for (const m of activated) {
      s.hud.announce(m.name.toUpperCase(), { fontSize: 28, color: "#ff6644", duration: 400, hold: 1200 });
      s.music.setKeyOffset(nextKeyOffset(s.music.keyOffset));
    }
    if (after.tempoMult !== before.tempoMult) s.music.setTempoScale(after.tempoMult);
    this.retuneLiveEnemies(before, after);
  }

  /** Applies a change in speed or fire density to the enemies already on the field (not bosses). */
  private retuneLiveEnemies(before: SpawnParams, after: SpawnParams) {
    const speedRatio = before.enemySpeedMult > 0 ? after.enemySpeedMult / before.enemySpeedMult : 1;
    const densityChanged = after.enemyRhythmDensity !== before.enemyRhythmDensity;
    if (speedRatio === 1 && !densityChanged) return;
    for (const e of [...this.scene.enemies.getChildren()] as Enemy[]) {
      if (!e.active || e.def.isBoss || e.def.hidden) continue;
      if (speedRatio !== 1) e.speed *= speedRatio;
      if (densityChanged) e.setRhythmDensity(after.enemyRhythmDensity);
    }
  }

  onBossKilled(x: number, y: number, bossType: EnemyType) {
    const s = this.scene;
    this.bossActive = false;
    s.progression.recordBossKill();

    s.particles.burst(x, y, 0xffaa22, 40, 150, 5);
    s.particles.burst(x, y, 0xffcc66, 40, 120, 4);
    s.particles.burst(x, y, 0xffffff, 30, 100, 3);
    shakeCamera(s.cameras.main, 300, 0.02);

    s.gameEvents.emit("bossDefeated", { bossType, x, y });
    s.relicFlow.offer();

    ([...s.enemies.getChildren()] as Enemy[]).forEach((e) => {
      if (e.enemyType === "phantom_decoy") e.destroy();
    });

    for (let i = 0; i < 4; i++) s.pickups.spawnDrop(x + (i - 1.5) * 40, y - 20 + Math.random() * 40);

    s.hud.announce("BOSS DEFEATED", { fontSize: 32, color: "#ffaa44", duration: 500, hold: 1500 });
  }

  // --- Dev helpers (DevPanel) ---

  /**
   * "Skip Wave": endless clears the field and queues the next wave on the next bar line; a level
   * advances to its next wave through the LevelRunner (walls kept). Returns whether a wave was queued.
   */
  skipWave(): boolean {
    const s = this.scene;
    if (s.level) return s.level.skipWave();
    this.clearField();
    return this.spawnEndlessWave();
  }

  clearField() {
    const s = this.scene;
    ([...s.enemies.getChildren()] as Enemy[]).forEach((e) => e.destroy());
    ([...s.enemyBullets.getChildren()] as Bullet[]).forEach((b) => b.kill());
    ([...s.asteroids.getChildren()] as Asteroid[]).forEach((a) => a.destroy());
    ([...s.walls.getChildren()] as Wall[]).forEach((w) => w.destroy());
  }

  devSpawnEnemies(count: number) {
    const s = this.scene;
    const pool = this.endless.buildEnemyPool(s.wave);
    for (let i = 0; i < count; i++) {
      const { x, y } = this.endless.randomEdgePosition();
      const type = pool[Math.floor(Math.random() * pool.length)];
      s.enemies.add(createEnemy(s, x, y, type));
    }
  }

  devSpawnAsteroids(count: number) {
    const s = this.scene;
    for (let i = 0; i < count; i++) {
      const ax = Math.random() < 0.5 ? -40 : GAME_W + 40;
      const ay = Phaser.Math.Between(80, GAME_H - 80);
      s.asteroids.add(new Asteroid(s, ax, ay, "large"));
    }
  }
}
