import type { GameScene } from "../scenes/GameScene";
import { checkNewUnlocks, updateHighScore, updateHighWave, updateBestChain } from "../systems/Unlocks";
import { checkAchievements, addBossDefeat, flushAchievements, type AchievementContext } from "../systems/Achievements";
import { RunStats } from "./RunStats";

/** Run counters plus the hooks that turn them into unlocks, achievements and records. */
export class RunProgression {
  readonly run = new RunStats();

  constructor(private readonly scene: GameScene) {}

  recordKill() {
    this.run.recordKill();
  }

  recordDamage() {
    this.run.recordDamage();
    if (this.scene.level) this.scene.level.damageTaken++;
  }

  startBossFight() {
    this.run.startBossFight();
  }

  /** Call once per live frame; accumulates REAL seconds of near-frozen time. */
  trackFreeze(timeScale: number, realDt: number) {
    this.run.trackFreeze(timeScale, realDt);
  }

  recordBossKill() {
    addBossDefeat();
    this.processAchievements(true, false);
  }

  /** Saves the run's records when it ends. */
  recordRunEnd() {
    const s = this.scene;
    updateHighScore(s.score);
    updateHighWave(s.wave);
    updateBestChain(s.chain.bestChain);
    this.processUnlocks();
    this.processAchievements(false, false);
  }

  processUnlocks() {
    this.scene.toasts.push(...checkNewUnlocks().map((u) => `UNLOCKED: ${u.name}`));
  }

  processAchievements(bossJustKilled: boolean, levelJustCompleted: boolean) {
    const s = this.scene;
    const ctx: AchievementContext = {
      runKills: this.run.kills,
      wave: s.wave,
      score: s.score,
      bestChain: s.chain.bestChain,
      hp: s.ship.hp,
      maxHp: s.ship.maxHp,
      freezeTime: this.run.freezeTime,
      bossFightDamageTaken: this.run.bossFightDamageTaken,
      levelDamageTaken: s.level?.damageTaken ?? 0,
      bossJustKilled,
      levelJustCompleted,
    };
    flushAchievements();
    const newAchievements = checkAchievements(ctx);
    if (newAchievements.length > 0) s.hud.refreshShards();
    s.toasts.push(...newAchievements.map((a) => `★ ${a.name} (+${a.reward}◆)`));
  }
}
