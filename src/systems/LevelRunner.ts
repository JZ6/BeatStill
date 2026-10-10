import type { GameScene } from "../scenes/GameScene";
import type { TickEvent } from "../core/Conductor";
import { createEnemy, type Enemy } from "../objects/enemies";
import { Asteroid } from "../objects/Asteroid";
import { Bullet } from "../objects/Bullet";
import { Wall } from "../objects/Wall";
import { UpgradePickup } from "../objects/Shard";
import { markLevelComplete, ALL_LEVELS, isLevelUnlocked, isCampaignLevel, type LevelDef } from "./Levels";
import { LevelSchedule } from "./LevelSchedule";
import { addShards } from "./Unlocks";
import { addPickup } from "./Achievements";
import { GAME_W, GAME_H, px } from "./GameConfig";

/**
 * Plays a level. Its waves are song sections: each spawns on a bar line, the next one once the field
 * is clear (at least the wave's `bars`, default 1, after it), and the level completes on a bar line
 * too. The timing rules live in LevelSchedule.
 */
export class LevelRunner {
  isComplete = false;
  damageTaken = 0;
  /** The conductor tick each wave spawned on, in order (diagnostics and the smoke test). */
  readonly waveTicks: number[] = [];
  private schedule: LevelSchedule | null = null;

  constructor(private scene: GameScene, readonly levelDef: LevelDef) {}

  /** Index of the wave on the field (-1 before the first one spawns). */
  get waveIndex(): number {
    return this.schedule?.waveIndex ?? -1;
  }

  /** Run start (once the conductor exists): the first wave spawns on the first bar line. */
  start() {
    const c = this.scene.conductor;
    this.schedule = new LevelSchedule(this.levelDef.waves.map((w) => w.bars), c.ticksPerBar);
    this.schedule.start(c.currentTick + 1);
  }

  /** Every conductor tick: spawns the scheduled wave, or completes the level, on its bar line. */
  onTick(t: TickEvent) {
    const step = this.schedule?.onTick(t.tick);
    if (!step) return;
    if (step.kind === "wave") this.spawnWave(step.index, t);
    else this.triggerComplete(t);
  }

  /** Per live frame: once the field is clear, schedules the next wave (or the completion) on a bar line. */
  update() {
    if (!this.schedule || this.isComplete || this.scene.enemies.getLength() > 0) return;
    this.schedule.onFieldClear(this.scene.conductor.currentTick + 1);
  }

  /**
   * Dev "Skip Wave": queues the next wave (or, after the last one, the completion) on the next bar
   * line and clears the current wave's enemies, enemy bullets and asteroids. Walls stay: they
   * persist across waves by design. Returns false if there is nothing to skip.
   */
  skipWave(): boolean {
    if (!this.schedule || this.isComplete) return false;
    const s = this.scene;
    if (!this.schedule.skip(s.conductor.currentTick + 1)) return false;
    for (const e of [...s.enemies.getChildren()] as Enemy[]) e.destroy();
    for (const b of [...s.enemyBullets.getChildren()] as Bullet[]) b.kill();
    for (const a of [...s.asteroids.getChildren()] as Asteroid[]) a.destroy();
    return true;
  }

  private spawnWave(index: number, t: TickEvent) {
    if (index >= this.levelDef.waves.length) return;
    const wave = this.levelDef.waves[index];
    this.waveTicks.push(t.tick);

    for (const e of wave.enemies) {
      const enemy = createEnemy(this.scene, e.rx * GAME_W, e.ry * GAME_H, e.type);
      this.scene.enemies.add(enemy);
    }

    if (wave.asteroids) {
      for (const a of wave.asteroids) {
        this.scene.asteroids.add(new Asteroid(this.scene, a.rx * GAME_W, a.ry * GAME_H, a.size));
      }
    }

    if (wave.walls) {
      for (const w of wave.walls) {
        this.scene.walls.add(
          new Wall(this.scene, w.rx * GAME_W, w.ry * GAME_H, w.rw * GAME_W, w.rh * GAME_H, w.type, w.hp, w.oneWay),
        );
      }
    }

    if (wave.initialBullets) {
      for (const b of wave.initialBullets) {
        this.scene.enemyBullets.add(
          new Bullet(this.scene, b.rx * GAME_W, b.ry * GAME_H, b.angle, b.speed, "enemy"),
        );
      }
    }

    this.scene.gameEvents.emit("waveStarted", { wave: index + 1, mode: "level", tick: t.tick, lateBy: t.lateBy });
  }

  private triggerComplete(t: TickEvent) {
    if (this.isComplete) return;
    const s = this.scene;
    this.isComplete = true;
    // Custom levels (from the designer) aren't part of the campaign.
    const isCampaign = isCampaignLevel(this.levelDef.id);
    if (isCampaign) markLevelComplete(this.levelDef.id);

    for (const p of [...s.shards.getChildren()] as UpgradePickup[]) {
      if (p.alive) {
        s.pickups.applyUpgrade(p.upgrade);
        addShards(1);
        addPickup();
        s.particles.burst(p.x, p.y, p.pickupColor, 8, 50, 2);
        p.kill();
      }
    }
    s.hud.refreshShards();

    s.progression.processUnlocks();
    s.progression.processAchievements(false, true);
    s.gameEvents.emit("levelCompleted", { levelId: this.levelDef.id, tick: t.tick, lateBy: t.lateBy });

    s.hud.gameOverText.setColor("#ffaa44");
    s.hud.gameOverText.setText("LEVEL COMPLETE");

    const nextLevel = isCampaign ? ALL_LEVELS.find((l) => l.id === this.levelDef.id + 1) : undefined;
    const hasNext = nextLevel && isLevelUnlocked(nextLevel.id);
    const btnY = GAME_H / 2 + px(60);

    if (hasNext) {
      const nextBtn = s.add
        .text(GAME_W / 2, btnY, "NEXT LEVEL", {
          fontFamily: "monospace", fontSize: `${px(22)}px`, color: "#ffaa44",
        })
        .setOrigin(0.5)
        .setDepth(101)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => nextBtn.setColor("#ffcc88"))
        .on("pointerout", () => nextBtn.setColor("#ffaa44"))
        .on("pointerdown", () => {
          s.scene.start("GameScene", { mode: "level", levelDef: nextLevel });
        });
    }

    const levelsBtn = s.add
      .text(GAME_W / 2, btnY + px(40), isCampaign ? "CAMPAIGN" : "EDITOR", {
        fontFamily: "monospace", fontSize: `${px(18)}px`, color: "#887766",
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => levelsBtn.setColor("#e8d5b0"))
      .on("pointerout", () => levelsBtn.setColor("#887766"))
      .on("pointerdown", () => {
        if (isCampaign) s.scene.start("LevelSelectScene");
        else s.scene.start("LevelDesignerScene", { levelDef: this.levelDef });
      });
  }
}
