import Phaser from "phaser";
import { createEnemy, type EnemyType, type Enemy } from "../objects/enemies";
import { Asteroid } from "../objects/Asteroid";
import { GAME_W, GAME_H } from "./GameConfig";
import type { GameScene } from "../scenes/GameScene";

export class EndlessMode {
  private scene: GameScene;

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  spawnWave() {
    const s = this.scene;

    if (s.wave >= 5 && s.wave % 5 === 0) {
      this.spawnBossWave();
      return;
    }

    const enemyCount = 8 + s.wave * 3;
    const pool = this.buildEnemyPool(s.wave);

    for (let i = 0; i < enemyCount; i++) {
      const { x, y } = this.randomEdgePosition();
      const type = pool[Math.floor(Math.random() * pool.length)];
      s.enemies.add(createEnemy(s, x, y, type));
    }

    const asteroidCount = 1 + Math.floor(s.wave / 2);
    for (let i = 0; i < asteroidCount; i++) {
      const ax = Math.random() < 0.5 ? -40 : GAME_W + 40;
      const ay = Phaser.Math.Between(80, GAME_H - 80);
      s.asteroids.add(new Asteroid(s, ax, ay, "large"));
    }
  }

  private spawnBossWave() {
    const s = this.scene;
    s.bossActive = true;
    s.bossFightDamageTaken = 0;
    s.waveText.setText(`WAVE ${s.wave} — BOSS`);

    const warningText = s.add.text(GAME_W / 2, GAME_H / 2, "WARNING", {
      fontFamily: "monospace", fontSize: "42px", color: "#ff4444", align: "center",
    }).setOrigin(0.5).setDepth(100).setAlpha(0);

    s.tweens.add({
      targets: warningText,
      alpha: { from: 0, to: 1 },
      duration: 400,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        warningText.destroy();
        const bossType = (s.wave % 10 === 0 && s.wave >= 10) ? "phantom" as const : "sentinel" as const;
        s.enemies.add(createEnemy(s, GAME_W / 2, -40, bossType));
      },
    });

    if (s.audioStarted) s.audioManager.onBossWarning();
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

  private randomEdgePosition(margin = 30): { x: number; y: number } {
    const edge = Phaser.Math.Between(0, 3);
    if (edge === 0) return { x: Phaser.Math.Between(0, GAME_W), y: -margin };
    if (edge === 1) return { x: GAME_W + margin, y: Phaser.Math.Between(0, GAME_H) };
    if (edge === 2) return { x: Phaser.Math.Between(0, GAME_W), y: GAME_H + margin };
    return { x: -margin, y: Phaser.Math.Between(0, GAME_H) };
  }
}
