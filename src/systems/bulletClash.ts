/**
 * Diep.io-style bullet clashes (README: "penetration and damage to destroy other bullets").
 *
 * Rules
 * - Every bullet has HP. A player bullet's is its damage plus its pierce, so Power and Penetration
 *   both make it tougher; an enemy bullet's is ENEMY_BULLET_HP (1).
 * - When a player bullet and an enemy bullet touch, both lose the smaller of their two HP; a bullet
 *   at 0 HP is destroyed. So a standard shot trades 1:1 with enemy bullets, a cannon slug
 *   (3 damage) survives two clashes and a nuke (8 damage + 3 pierce) ten.
 * - Hitting an enemy costs a player bullet 1 HP as well (Bullet.hit): a fresh bullet still pierces
 *   exactly `pierce` enemies, one worn down by clashes pierces fewer.
 * - Contact is swept over the frame (both bullets move in straight lines from their previous
 *   positions), so fast bullets can't tunnel through small ones.
 * - Broad phase: enemy bullets go into a uniform grid once per frame; each player bullet only
 *   tests the cells around its path. Cost O(player + enemy bullets), not their product.
 * Pure TypeScript (no Phaser), unit-testable.
 */
import { UniformGrid } from "./spatialGrid";

/** HP of every enemy bullet. */
export const ENEMY_BULLET_HP = 1;

/** Grid cell size (px) for the enemy-bullet broad phase: a few bullet diameters plus a frame of travel. */
export const BULLET_GRID_CELL = 32;

/** A player bullet's HP: its damage plus its pierce (at least 1). */
export function playerBulletHp(damage: number, pierce: number): number {
  const d = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  const p = Number.isFinite(pierce) ? Math.max(0, pierce) : 0;
  return Math.max(1, d + p);
}

/** What the clash rules need of a bullet. */
export interface ClashBody {
  x: number;
  y: number;
  /** Position before this frame's movement. */
  prevX: number;
  prevY: number;
  radius: number;
  hp: number;
  readonly alive: boolean;
}

/**
 * Whether two circles moving in straight lines from (prevX, prevY) to (x, y) during the frame come
 * closer than the sum of their radii (the closest approach of the relative motion).
 */
export function sweptOverlap(a: ClashBody, b: ClashBody): boolean {
  const d0x = a.prevX - b.prevX;
  const d0y = a.prevY - b.prevY;
  const dvx = a.x - a.prevX - (b.x - b.prevX);
  const dvy = a.y - a.prevY - (b.y - b.prevY);
  const vv = dvx * dvx + dvy * dvy;
  let t = vv > 0 ? -(d0x * dvx + d0y * dvy) / vv : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = d0x + t * dvx;
  const cy = d0y + t * dvy;
  const r = a.radius + b.radius;
  return cx * cx + cy * cy < r * r;
}

/** Both bullets lose the smaller of their HP. Returns the HP traded (0 if either had none). */
export function resolveClash(a: ClashBody, b: ClashBody): number {
  const trade = Math.min(a.hp, b.hp);
  if (!(trade > 0)) return 0;
  a.hp -= trade;
  b.hp -= trade;
  return trade;
}

/** Enemy bullets in a grid, with the largest radius and per-frame travel for query margins. */
export interface BulletIndex<T extends ClashBody> {
  grid: UniformGrid<T>;
  maxRadius: number;
  maxMove: number;
}

/** Puts the live `bullets` into `grid` (cleared first) and measures their query margins. */
export function indexBullets<T extends ClashBody>(grid: UniformGrid<T>, bullets: readonly T[]): BulletIndex<T> {
  grid.clear();
  let maxRadius = 0;
  let maxMove = 0;
  for (const b of bullets) {
    if (!b.alive) continue;
    grid.insert(b, b.x, b.y);
    if (b.radius > maxRadius) maxRadius = b.radius;
    const move = Math.abs(b.x - b.prevX) + Math.abs(b.y - b.prevY);
    if (move > maxMove) maxMove = move;
  }
  return { grid, maxRadius, maxMove };
}

export interface ClashStats {
  clashes: number;
  /** Narrow-phase (swept) tests run: the broad phase's cost. */
  checks: number;
}

/**
 * Clashes every live player bullet with the indexed enemy bullets along its path this frame.
 * `onClash(player, enemy)` runs after each trade (HP already reduced): destroy the bullets at 0 HP
 * there. A player bullet stops clashing once its HP runs out.
 */
export function clashBullets<P extends ClashBody, E extends ClashBody>(
  players: readonly P[],
  index: BulletIndex<E>,
  onClash: (player: P, enemy: E) => void,
): ClashStats {
  const stats: ClashStats = { clashes: 0, checks: 0 };
  if (players.length === 0 || index.grid.size === 0) return stats;
  for (const p of players) {
    if (!p.alive || !(p.hp > 0)) continue;
    const margin = p.radius + index.maxRadius + index.maxMove;
    index.grid.query(
      Math.min(p.prevX, p.x) - margin,
      Math.min(p.prevY, p.y) - margin,
      Math.max(p.prevX, p.x) + margin,
      Math.max(p.prevY, p.y) + margin,
      (e) => {
        if (!e.alive || !(e.hp > 0)) return false;
        stats.checks++;
        if (!sweptOverlap(p, e)) return false;
        resolveClash(p, e);
        stats.clashes++;
        onClash(p, e);
        return !(p.hp > 0) || !p.alive;
      },
    );
  }
  return stats;
}
