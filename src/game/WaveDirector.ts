import Phaser from "phaser";
import type { GameScene } from "../scenes/GameScene";
import type { TickEvent } from "../core/Conductor";
import { createEnemy, type Enemy, type EnemyType } from "../objects/enemies";
import { Asteroid } from "../objects/Asteroid";
import type { Bullet } from "../objects/Bullet";
import type { Wall } from "../objects/Wall";
import { EndlessMode } from "../systems/EndlessMode";
import { isMutatorWave } from "../systems/WaveMutators";
import { updateHighWave } from "../systems/Unlocks";
import { GAME_W, GAME_H } from "../systems/GameConfig";

/** Game-time ms after the field is cleared before the next endless wave starts. */
const WAVE_DELAY_MS = 1500;

/** Wave pacing for both modes, endless waves (mutators, bosses), and dev spawning helpers. */
export class WaveDirector {
  bossActive = false;
  /** Game-time ms since the current endless wave started. */
  private waveTimer = 0;
  private readonly endless: EndlessMode;

  constructor(private readonly scene: GameScene) {
    this.endless = new EndlessMode(scene);
  }

  /** Every conductor tick, before the music hears it: level waves spawn on their bar lines. */
  onTick(t: TickEvent) {
    this.scene.level?.onTick(t);
  }

  /** Per live frame: schedules the next level wave once the field is clear, or starts the next endless wave. */
  update(delta: number, ts: number) {
    const s = this.scene;
    if (s.level) {
      s.level.update();
      return;
    }
    this.waveTimer += delta * ts;
    if (s.enemies.getLength() === 0 && this.waveTimer > WAVE_DELAY_MS) this.spawnEndlessWave();
  }

  spawnEndlessWave() {
    const s = this.scene;
    s.wave++;
    this.waveTimer = 0;
    s.hud.setWaveLabel(`WAVE ${s.wave}`);
    updateHighWave(s.wave);
    s.progression.processUnlocks();
    s.progression.processAchievements(false, false);

    if (isMutatorWave(s.wave)) {
      const mutator = s.mutators.rollMutator();
      if (mutator) {
        s.mutators.addMutator(mutator);
        s.hud.announce(mutator.name.toUpperCase(), { fontSize: 28, color: "#ff6644", duration: 400, hold: 1200 });
      }
    }

    s.gameEvents.emit("waveStarted", { wave: s.wave, mode: "endless" });
    this.endless.spawnWave();
  }

  onBossKilled(x: number, y: number, bossType: EnemyType) {
    const s = this.scene;
    this.bossActive = false;
    s.progression.recordBossKill();

    s.particles.burst(x, y, 0xffaa22, 40, 150, 5);
    s.particles.burst(x, y, 0xffcc66, 40, 120, 4);
    s.particles.burst(x, y, 0xffffff, 30, 100, 3);
    s.cameras.main.shake(300, 0.02);

    s.gameEvents.emit("bossDefeated", { bossType, x, y });
    s.relicFlow.offer();

    ([...s.enemies.getChildren()] as Enemy[]).forEach((e) => {
      if (e.enemyType === "phantom_decoy") e.destroy();
    });

    for (let i = 0; i < 4; i++) s.pickups.spawnDrop(x + (i - 1.5) * 40, y - 20 + Math.random() * 40);

    s.hud.announce("BOSS DEFEATED", { fontSize: 32, color: "#ffaa44", duration: 500, hold: 1500 });
  }

  // --- Dev helpers (DevPanel) ---

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
