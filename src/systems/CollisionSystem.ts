import type { GameScene } from "../scenes/GameScene";
import type { Bullet } from "../objects/Bullet";
import type { Enemy } from "../objects/enemies";
import type { Asteroid } from "../objects/Asteroid";
import type { Wall } from "../objects/Wall";
import { CHAIN_TIERS } from "./ChainSystem";

export function circleOverlap(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number,
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dist = dx * dx + dy * dy;
  const radii = r1 + r2;
  return dist < radii * radii;
}

export class CollisionSystem {
  constructor(private scene: GameScene) {}

  checkAll() {
    const s = this.scene;
    const playerBullets = [...s.playerBullets.getChildren()] as Bullet[];
    const enemyBullets = [...s.enemyBullets.getChildren()] as Bullet[];
    const enemyArr = [...s.enemies.getChildren()] as Enemy[];
    const asteroidArr = [...s.asteroids.getChildren()] as Asteroid[];
    const wallArr = [...s.walls.getChildren()] as Wall[];

    this.bulletsVsEnemies(playerBullets, enemyArr);
    this.absorbEnemyBullets(enemyBullets, enemyArr);
    this.bulletsVsAsteroids(playerBullets, asteroidArr);
    this.bulletVsBullet(playerBullets, enemyBullets);
    this.walls(wallArr, playerBullets, enemyBullets, enemyArr);

    if (!s.ship.isInvincible() && !s.godMode && !s.level?.isComplete) {
      if (this.shipVsBullets(enemyBullets)) return;
      this.shipVsAsteroids(asteroidArr);
    }
  }

  private bulletsVsEnemies(playerBullets: Bullet[], enemyArr: Enemy[]) {
    const s = this.scene;
    for (const b of playerBullets) {
      if (!b.alive) continue;
      for (const e of enemyArr) {
        if (!e.active) continue;
        if (!circleOverlap(b.x, b.y, b.radius, e.x, e.y, e.radius)) continue;

        const killed = e.takeDamage(b.damage);
        if (killed) {
          const isBoss = e.enemyType === "sentinel" || e.enemyType === "phantom";
          const tier = s.chain.chainTier;
          const pCount = [20, 25, 30, 35, 35, 35][tier];
          const pCount2 = [10, 12, 15, 18, 18, 18][tier];
          const pSize = [3, 3, 4, 5, 5, 5][tier];
          const tierColor = CHAIN_TIERS[tier]?.color ?? 0xffcc66;
          s.particles.burst(e.x, e.y, b.bulletColor, pCount, 100, pSize);
          s.particles.burst(e.x, e.y, tier > 0 ? tierColor : 0xffcc66, pCount2, 60, pSize - 1);
          s.chain.registerKill(e.x, e.y, isBoss);
          if (s.relics.hasRelic("vampiric") && Math.random() < 0.15 && s.ship.hp < s.ship.maxHp) {
            s.ship.hp = Math.min(s.ship.hp + 1, s.ship.maxHp);
            s.ship.drawHealthBar();
            s.particles.burst(s.ship.x, s.ship.y, 0x44ff44, 8, 40, 2);
          }
          if (isBoss) s.onBossKill(e.x, e.y);
          if (e.isElite && !isBoss) s.offerRelicChoice();
          if (e.enemyType === "phantom_decoy") {
            const phantoms = ([...s.enemies.getChildren()] as Enemy[]).filter((en) => en.enemyType === "phantom");
            for (const p of phantoms) (p as any).notifyDecoyKilled?.();
          }
        } else {
          s.particles.burst(b.x, b.y, b.bulletColor, 6, 40, 2);
          s.audioManager.onEnemyHit();
        }
        s.particles.trail(b.x, b.y, b.bulletColor, 3);
        b.hit();
        if (!b.alive) break;
      }
    }
  }

  private absorbEnemyBullets(enemyBullets: Bullet[], enemyArr: Enemy[]) {
    for (const b of enemyBullets) {
      if (!b.alive) continue;
      for (const e of enemyArr) {
        if (!e.active || e === b.sourceEnemy) continue;
        if (circleOverlap(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
          b.kill();
          break;
        }
      }
    }
  }

  private bulletsVsAsteroids(playerBullets: Bullet[], asteroidArr: Asteroid[]) {
    const s = this.scene;
    for (const b of playerBullets) {
      if (!b.alive) continue;
      for (const a of asteroidArr) {
        if (!circleOverlap(b.x, b.y, b.radius, a.x, a.y, a.radius)) continue;
        s.score += 25;
        s.scoreText.setText(`SCORE: ${s.score}`);
        s.particles.burst(a.x, a.y, b.bulletColor, 8, 70, 2);
        s.particles.burst(a.x, a.y, 0xcc8866, 8, 50, 2);
        a.split(s);
        s.audioManager.onAsteroidBreak();
        b.hit();
        if (!b.alive) break;
      }
    }
  }

  private bulletVsBullet(playerBullets: Bullet[], enemyBullets: Bullet[]) {
    const s = this.scene;
    for (const pb of playerBullets) {
      if (!pb.alive) continue;
      for (const eb of enemyBullets) {
        if (!eb.alive) continue;
        if (circleOverlap(pb.x, pb.y, pb.radius, eb.x, eb.y, eb.radius)) {
          s.particles.burst(pb.x, pb.y, pb.bulletColor, 8, 50, 2);
          pb.kill();
          eb.kill();
          s.audioManager.onBulletClash();
          break;
        }
      }
    }
  }

  private shipVsBullets(enemyBullets: Bullet[]): boolean {
    const s = this.scene;
    for (const b of enemyBullets) {
      if (!b.alive) continue;
      if (circleOverlap(b.x, b.y, b.radius, s.ship.x, s.ship.y, 4)) {
        b.kill();
        s.recordDamage();
        s.particles.burst(s.ship.x, s.ship.y, 0xff4422, 15, 80, 3);
        if (s.ship.takeDamage(1)) {
          s.triggerGameOver();
          return true;
        }
        s.audioManager.onPlayerHit();
        break;
      }
    }
    return false;
  }

  private shipVsAsteroids(asteroidArr: Asteroid[]) {
    const s = this.scene;
    for (const a of asteroidArr) {
      if (!a.active) continue;
      if (circleOverlap(a.x, a.y, a.radius, s.ship.x, s.ship.y, 4)) {
        s.recordDamage();
        s.particles.burst(s.ship.x, s.ship.y, 0xff4422, 15, 80, 3);
        if (s.ship.takeDamage(1)) {
          s.triggerGameOver();
          return;
        }
        s.audioManager.onPlayerHit();
        break;
      }
    }
  }

  private walls(wallArr: Wall[], playerBullets: Bullet[], enemyBullets: Bullet[], enemyArr: Enemy[]) {
    const s = this.scene;
    for (const w of wallArr) {
      if (!w.active) continue;
      w.pushOut(s.ship, 16);
      for (const e of enemyArr) {
        if (e.active) w.pushOut(e, e.radius);
      }
      for (const b of playerBullets) {
        if (b.alive) w.handleBullet(b, s.particles);
      }
      for (const b of enemyBullets) {
        if (b.alive) w.handleBullet(b, s.particles);
      }
    }
  }
}
