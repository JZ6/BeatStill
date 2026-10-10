import Phaser from "phaser";
import type { TickEvent } from "../core/Conductor";
import { createEnemy, type EnemyType } from "../objects/enemies";
import { Asteroid } from "../objects/Asteroid";
import { GAME_W, GAME_H, px } from "./GameConfig";
import { SectionPlan } from "./endlessSections";
import type { SpawnParams } from "./WaveMutators";
import type { GameScene } from "../scenes/GameScene";

/** Most recent group-spawn ticks kept for diagnostics. */
const SPAWN_LOG_SIZE = 256;

/**
 * Spawns the current endless wave as a song section (see SectionPlan): enemy groups and asteroids
 * on the downbeats of its 8 bars, or, for a boss wave, a two-bar warning and the boss on the
 * downbeat after it. The WaveDirector starts sections on bar lines and calls onBar() on every one.
 */
export class EndlessMode {
  /** Ticks on which enemy groups spawned (the latest 256), for diagnostics and the smoke test. */
  readonly spawnTicks: number[] = [];
  private section: SectionPlan | null = null;
  private eliteCount = 0;
  private warningText: Phaser.GameObjects.Text | null = null;

  constructor(private readonly scene: GameScene) {}

  /** Starts wave `scene.wave` as a section on the bar line `t` (any running section ends). */
  startSection(t: TickEvent) {
    this.cancel();
    const s = this.scene;
    const section = new SectionPlan(s.wave, t.bar);
    this.section = section;
    this.eliteCount = 0;
    if (section.boss) this.startBossWarning(section.boss);
  }

  /** Ends the current section's spawning (dev wave changes); live enemies stay. */
  cancel() {
    this.section = null;
    this.clearWarning();
    this.scene.waves.bossActive = false;
  }

  /** On every bar line: spawns this downbeat's enemy group, asteroids or boss. */
  onBar(t: TickEvent) {
    const section = this.section;
    if (!section) return;
    const s = this.scene;
    const params = s.mutators.getActiveParams();
    const due = section.onBar(t.bar, s.enemies.getLength(), params.enemyCountMult);
    if (due.boss) this.spawnBoss(due.boss);
    if (due.enemies > 0) {
      this.spawnGroup(due.enemies, params, section.wave);
      this.spawnTicks.push(t.tick);
      if (this.spawnTicks.length > SPAWN_LOG_SIZE) this.spawnTicks.shift();
    }
    for (let i = 0; i < due.asteroids; i++) {
      const ax = Math.random() < 0.5 ? -40 : GAME_W + 40;
      const ay = Phaser.Math.Between(80, GAME_H - 80);
      s.asteroids.add(new Asteroid(s, ax, ay, "large"));
    }
  }

  /** The wave is over: everything in the section has spawned and the field is clear. */
  isFinished(): boolean {
    const s = this.scene;
    if (!this.section) return false;
    return this.section.isSpent(s.mutators.getActiveParams().enemyCountMult) && s.enemies.getLength() === 0;
  }

  /** Spawns `count` enemies from the wave's pool at the edges, with the mutators applied and up to two elites per wave. */
  private spawnGroup(count: number, params: SpawnParams, wave: number) {
    const s = this.scene;
    const pool = this.buildEnemyPool(wave);
    for (let i = 0; i < count; i++) {
      const { x, y } = this.randomEdgePosition();
      const type = pool[Math.floor(Math.random() * pool.length)];
      const enemy = createEnemy(s, x, y, type);

      if (params.enemySpeedMult !== 1) enemy.speed *= params.enemySpeedMult;
      if (params.enemyRhythmDensity !== 1) enemy.setRhythmDensity(params.enemyRhythmDensity);
      if (params.enemyHpMult === 0) { enemy.hp = 1; enemy.maxHp = 1; }
      else if (params.enemyHpMult !== 1) {
        enemy.hp = Math.ceil(enemy.hp * params.enemyHpMult);
        enemy.maxHp = enemy.hp;
      }

      if (wave >= 3 && this.eliteCount < 2 && Math.random() < 0.15) {
        enemy.makeElite();
        this.eliteCount++;
      }

      s.enemies.add(enemy);
    }
  }

  /** A boss wave opens with a pulsing WARNING that holds until the boss arrives. */
  private startBossWarning(bossType: EnemyType) {
    const s = this.scene;
    s.waves.bossActive = true;
    s.progression.startBossFight();
    s.hud.setWaveLabel(`WAVE ${s.wave} — BOSS`);

    const warningText = s.add.text(GAME_W / 2, GAME_H / 2, "WARNING", {
      fontFamily: "monospace", fontSize: `${px(42)}px`, color: "#ff4444", align: "center",
    }).setOrigin(0.5).setDepth(100).setAlpha(0);
    s.tweens.add({
      targets: warningText,
      alpha: { from: 0, to: 1 },
      duration: 400,
      yoyo: true,
      repeat: -1,
    });
    this.warningText = warningText;

    s.gameEvents.emit("bossWarning", { bossType });
  }

  private spawnBoss(bossType: EnemyType) {
    const s = this.scene;
    this.clearWarning();
    s.enemies.add(createEnemy(s, GAME_W / 2, -40, bossType));
  }

  private clearWarning() {
    const text = this.warningText;
    if (!text) return;
    this.warningText = null;
    this.scene.tweens.killTweensOf(text);
    text.destroy();
  }

  buildEnemyPool(wave: number): EnemyType[] {
    const pool: EnemyType[] = ["basic", "tracker"];
    if (wave >= 2) pool.push("sniper");
    if (wave >= 3) pool.push("swarm", "swarm", "snake");
    if (wave >= 4) pool.push("spiral");
    if (wave >= 5) pool.push("circler");
    if (wave >= 6) pool.push("tank");
    return pool;
  }

  randomEdgePosition(margin = 30): { x: number; y: number } {
    const edge = Phaser.Math.Between(0, 3);
    if (edge === 0) return { x: Phaser.Math.Between(0, GAME_W), y: -margin };
    if (edge === 1) return { x: GAME_W + margin, y: Phaser.Math.Between(0, GAME_H) };
    if (edge === 2) return { x: Phaser.Math.Between(0, GAME_W), y: GAME_H + margin };
    return { x: -margin, y: Phaser.Math.Between(0, GAME_H) };
  }
}
