import type { GameScene } from "../scenes/GameScene";
import type { Bullet } from "../objects/Bullet";
import type { Enemy } from "../objects/enemies";
import type { Asteroid } from "../objects/Asteroid";
import type { Wall, WallHitResult } from "../objects/Wall";
import { CHAIN_TIERS } from "./ChainSystem";

const KILL_BURST_COUNTS = [20, 25, 30, 35, 35, 35];
const KILL_BURST_COUNTS_2 = [10, 12, 15, 18, 18, 18];
const KILL_BURST_SIZES = [3, 3, 4, 5, 5, 5];

/** Index `arr` by chain tier, clamped to its bounds (out-of-range or NaN tiers can't yield undefined). */
function atTier<T>(arr: readonly T[], tier: number): T {
  const i = Number.isFinite(tier) ? Math.min(Math.max(Math.trunc(tier), 0), arr.length - 1) : 0;
  return arr[i];
}

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

// Checks if a circle overlaps a triangle using point-in-triangle + edge-distance tests.
function triangleCircleOverlap(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  px: number, py: number, pr: number,
): boolean {
  // Point-in-triangle via cross products
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  if (!(hasNeg && hasPos)) return true;

  // Edge-segment to circle distance
  function edgeDist(x1: number, y1: number, x2: number, y2: number): number {
    const ex = x2 - x1, ey = y2 - y1;
    const len2 = ex * ex + ey * ey;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * ex + (py - y1) * ey) / len2));
    return Math.hypot(px - (x1 + t * ex), py - (y1 + t * ey));
  }
  return edgeDist(ax, ay, bx, by) < pr ||
         edgeDist(bx, by, cx, cy) < pr ||
         edgeDist(cx, cy, ax, ay) < pr;
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
      // A non-fatal bullet hit just started i-frames: don't also take an asteroid hit this frame.
      if (!s.ship.isInvincible()) this.shipVsAsteroids(asteroidArr);
    }
  }

  private bulletsVsEnemies(playerBullets: Bullet[], enemyArr: Enemy[]) {
    const s = this.scene;
    for (const b of playerBullets) {
      if (!b.alive) continue;
      for (const e of enemyArr) {
        // A piercing bullet still overlapping an enemy on later frames must not hit it again.
        if (!e.active || b.hasHit(e)) continue;
        if (!circleOverlap(b.x, b.y, b.radius, e.x, e.y, e.radius)) continue;
        b.markHit(e);

        const hpBefore = e.hp;
        const killed = e.takeDamage(b.damage);
        if (killed) {
          const isBoss = e.def.isBoss;
          const tier = s.chain.chainTier;
          const pCount = atTier(KILL_BURST_COUNTS, tier);
          const pCount2 = atTier(KILL_BURST_COUNTS_2, tier);
          const pSize = atTier(KILL_BURST_SIZES, tier);
          const tierColor = atTier(CHAIN_TIERS, tier).color;
          s.particles.burst(e.x, e.y, b.bulletColor, pCount, 100, pSize);
          s.particles.burst(e.x, e.y, tier > 0 ? tierColor : 0xffcc66, pCount2, 60, pSize - 1);
          s.chain.registerKill(e.x, e.y, isBoss);
          // After registerKill, so the chain count and tier include this kill.
          s.gameEvents.emit("enemyKilled", {
            enemyType: e.enemyType,
            x: e.x,
            y: e.y,
            isBoss,
            elite: e.isElite,
            chainCount: s.chain.chainCount,
            chainTier: s.chain.chainTier,
          });
          if (s.relics.hasRelic("vampiric") && Math.random() < 0.15 && s.ship.hp < s.ship.maxHp) {
            s.ship.hp = Math.min(s.ship.hp + 1, s.ship.maxHp);
            s.ship.drawHealthBar();
            s.particles.burst(s.ship.x, s.ship.y, 0x44ff44, 8, 40, 2);
          }
          if (isBoss) s.waves.onBossKilled(e.x, e.y, e.enemyType);
          if (e.isElite && !isBoss) s.relicFlow.offer();
        } else {
          s.particles.burst(b.x, b.y, b.bulletColor, 6, 40, 2);
          s.gameEvents.emit("enemyHit", {
            enemyType: e.enemyType,
            x: e.x,
            y: e.y,
            // A boss shrugs off hits mid-transition: report what was actually dealt.
            damage: Math.max(0, hpBefore - e.hp),
            hpLeft: e.hp,
            maxHp: e.maxHp,
          });
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
        // The snapshot can hold asteroids already split this frame.
        if (!a.active) continue;
        if (!circleOverlap(b.x, b.y, b.radius, a.x, a.y, a.radius)) continue;
        s.addScore(25);
        s.particles.burst(a.x, a.y, b.bulletColor, 8, 70, 2);
        s.particles.burst(a.x, a.y, 0xcc8866, 8, 50, 2);
        const broken = { size: a.size, x: a.x, y: a.y };
        a.split(s);
        s.gameEvents.emit("asteroidBreak", broken);
        b.hit();
        if (!b.alive) break;
      }
    }
  }

  private bulletVsBullet(playerBullets: Bullet[], enemyBullets: Bullet[]) {
    const s = this.scene;
    for (const pb of playerBullets) {
      if (!pb.alive || !pb.canDestroyBullets) continue;
      for (const eb of enemyBullets) {
        if (!eb.alive) continue;
        if (circleOverlap(pb.x, pb.y, pb.radius, eb.x, eb.y, eb.radius)) {
          s.particles.burst(pb.x, pb.y, pb.bulletColor, 8, 50, 2);
          s.gameEvents.emit("bulletClash", { x: pb.x, y: pb.y });
          pb.kill();
          eb.kill();
          break;
        }
      }
    }
  }

  private shipVsBullets(enemyBullets: Bullet[]): boolean {
    const s = this.scene;
    const [ax, ay, bx, by, cx, cy] = s.ship.getHitVertices();
    for (const b of enemyBullets) {
      if (!b.alive) continue;
      if (triangleCircleOverlap(ax, ay, bx, by, cx, cy, b.x, b.y, b.radius)) {
        b.kill();
        s.progression.recordDamage();
        s.particles.burst(s.ship.x, s.ship.y, 0xff4422, 15, 80, 3);
        if (s.ship.takeDamage(1)) {
          s.gameOverFlow.trigger();
          return true;
        }
        this.emitPlayerHit();
        break;
      }
    }
    return false;
  }

  private shipVsAsteroids(asteroidArr: Asteroid[]) {
    const s = this.scene;
    const [ax, ay, bx, by, cx, cy] = s.ship.getHitVertices();
    for (const a of asteroidArr) {
      if (!a.active) continue;
      if (triangleCircleOverlap(ax, ay, bx, by, cx, cy, a.x, a.y, a.radius)) {
        s.progression.recordDamage();
        s.particles.burst(s.ship.x, s.ship.y, 0xff4422, 15, 80, 3);
        if (s.ship.takeDamage(1)) {
          s.gameOverFlow.trigger();
          return;
        }
        this.emitPlayerHit();
        break;
      }
    }
  }

  /** A non-fatal hit on the ship (fatal ones go through GameOverFlow → playerDied). */
  private emitPlayerHit() {
    const ship = this.scene.ship;
    this.scene.gameEvents.emit("playerHit", { x: ship.x, y: ship.y, hpLeft: ship.hp, maxHp: ship.maxHp });
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
        if (b.alive) this.emitWallHit(w, b, w.handleBullet(b, s.particles));
      }
      for (const b of enemyBullets) {
        if (b.alive) this.emitWallHit(w, b, w.handleBullet(b, s.particles));
      }
    }
  }

  private emitWallHit(w: Wall, b: Bullet, result: WallHitResult) {
    const events = this.scene.gameEvents;
    switch (result) {
      case "bounce":
        events.emit("wallBounce", { x: b.x, y: b.y, axis: w.lastBounceAxis, owner: b.owner });
        break;
      case "absorb":
        events.emit("wallAbsorb", { x: b.x, y: b.y, owner: b.owner });
        break;
      case "crack":
        events.emit("glassCrack", { x: b.x, y: b.y, hp: w.hp, maxHp: w.maxHp });
        break;
      case "shatter":
        events.emit("glassShatter", { x: w.wallX + w.wallW / 2, y: w.wallY + w.wallH / 2 });
        break;
      case "none":
      case "pass":
        break;
    }
  }
}
