import type { GameScene } from "../scenes/GameScene";
import { createEnemy, type Enemy } from "../objects/enemies";
import { Asteroid } from "../objects/Asteroid";
import { Bullet } from "../objects/Bullet";
import { Wall } from "../objects/Wall";
import { UpgradePickup } from "../objects/Shard";
import { markLevelComplete, ALL_LEVELS, isLevelUnlocked, type LevelDef } from "./Levels";
import { addShards, getState } from "./Unlocks";
import { GAME_W, GAME_H } from "./GameConfig";

export class LevelRunner {
  waveIndex = 0;
  isComplete = false;
  damageTaken = 0;

  constructor(private scene: GameScene, readonly levelDef: LevelDef) {}

  spawnWave(index: number) {
    if (index >= this.levelDef.waves.length) return;
    this.waveIndex = index;
    this.scene.waveTimer = 0;
    const wave = this.levelDef.waves[index];

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
  }

  advance() {
    const nextIndex = this.waveIndex + 1;
    if (nextIndex < this.levelDef.waves.length) {
      this.spawnWave(nextIndex);
    } else {
      this.triggerComplete();
    }
  }

  private triggerComplete() {
    const s = this.scene;
    this.isComplete = true;
    markLevelComplete(this.levelDef.id);

    for (const p of [...s.shards.getChildren()] as UpgradePickup[]) {
      if (p.alive) {
        s.applyUpgrade(p.upgrade);
        addShards(1);
        s.particles.burst(p.x, p.y, p.pickupColor, 8, 50, 2);
        p.kill();
      }
    }
    s.shardText.setText(`◆ ${getState().shards}`);

    s.processUnlocks();
    s.processAchievements(false, true);

    s.gameOverText.setColor("#ffaa44");
    s.gameOverText.setText("LEVEL COMPLETE");

    const nextLevel = ALL_LEVELS.find((l) => l.id === this.levelDef.id + 1);
    const hasNext = nextLevel && isLevelUnlocked(nextLevel.id);
    const btnY = GAME_H / 2 + 60;

    if (hasNext) {
      const nextBtn = s.add
        .text(GAME_W / 2, btnY, "NEXT LEVEL", {
          fontFamily: "monospace", fontSize: "22px", color: "#ffaa44",
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
      .text(GAME_W / 2, btnY + 40, "CAMPAIGN", {
        fontFamily: "monospace", fontSize: "18px", color: "#887766",
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => levelsBtn.setColor("#e8d5b0"))
      .on("pointerout", () => levelsBtn.setColor("#887766"))
      .on("pointerdown", () => {
        s.scene.start("LevelSelectScene");
      });
  }
}
