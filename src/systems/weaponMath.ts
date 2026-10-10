/**
 * What one shot of a weapon is, given the player's stats: bullet count, spread, speed, damage and
 * pierce. Ship.fire() spawns exactly this; the balance metrics measure it.
 * Pure TypeScript (no Phaser), so it is unit-testable.
 */
import type { WeaponDef } from "./Weapons";

/** Starting stats the weapon's own numbers are relative to (Multi Shot, Wide Spread, Velocity add to these). */
export const BASE_BULLET_COUNT = 1;
export const BASE_BULLET_SPREAD = 0.15;
export const BASE_BULLET_SPEED = 600;

/** The player stats a shot depends on (a subset of PlayerStats). */
export interface ShotStats {
  bulletCount: number;
  bulletSpread: number;
  bulletSpeed: number;
  damage: number;
  pierce: number;
}

export interface ShotProfile {
  /** Bullets per shot. */
  count: number;
  /** Radians between the outermost bullets. */
  spread: number;
  /** Pixels per second of game time. */
  speed: number;
  /** Damage each bullet deals (an integer ≥ 1). */
  damage: number;
  /** Extra enemies each bullet passes through. */
  pierce: number;
}

/**
 * The shot `weapon` fires with `stats`. Stat upgrades add to the weapon's base numbers; damage is
 * the weapon's multiplier × the damage stat × `damageMultiplier` (Glass Cannon), rounded, at least 1.
 */
export function shotProfile(weapon: WeaponDef, stats: ShotStats, damageMultiplier = 1): ShotProfile {
  return {
    count: weapon.baseBulletCount + (stats.bulletCount - BASE_BULLET_COUNT),
    spread: weapon.baseBulletSpread + (stats.bulletSpread - BASE_BULLET_SPREAD),
    speed: weapon.baseBulletSpeed + (stats.bulletSpeed - BASE_BULLET_SPEED),
    damage: Math.max(1, Math.round(weapon.damageMultiplier * stats.damage * damageMultiplier)),
    pierce: weapon.basePierce + stats.pierce,
  };
}
