import { ALL_WEAPONS } from "./Weapons";
import { ALL_SHOP_ITEMS, applyShopBonuses } from "./Shop";
import { CHAIN_SUSTAIN_BEATS } from "./chainRules";
import { BASE_BULLET_COUNT, BASE_BULLET_SPEED, BASE_BULLET_SPREAD } from "./weaponMath";

export interface PlayerStats {
  bulletCount: number;
  bulletSpread: number;
  pierce: number;
  maxHp: number;
  /** Rapid Fire level: rungs the weapon's note value climbs up TICK_LADDER (src/music/noteValues.ts). */
  fireRate: number;
  bulletSpeed: number;
  damage: number;
  moveSpeed: number;
  weaponId: string;
  /** Chain window bonus in beats (Chain Sustain, Chain Link), added to CHAIN_WINDOW_BEATS. */
  chainWindow: number;
  chainRadius: number;
  /** First-shot late-grace bonus in real seconds (Quick Draw), added to FireClock's BASE_FIRE_GRACE. */
  fireGrace: number;
  /** In-run upgrade levels by upgrade id. Only pickups count: shop bonuses never raise a level. */
  upgradeLevels: Record<string, number>;
}

/** Starting stats before any shop bonus. */
export function baseStats(): PlayerStats {
  return {
    bulletCount: BASE_BULLET_COUNT,
    bulletSpread: BASE_BULLET_SPREAD,
    pierce: 0,
    maxHp: 5,
    fireRate: 0,
    bulletSpeed: BASE_BULLET_SPEED,
    damage: 1,
    moveSpeed: 300,
    weaponId: "standard",
    chainWindow: 0,
    chainRadius: 0,
    fireGrace: 0,
    upgradeLevels: {},
  };
}

/** Starting stats of a run: baseStats() plus the shop's permanent bonuses (within STAT_CAPS). */
export function defaultStats(): PlayerStats {
  const stats = baseStats();
  applyShopBonuses(stats);
  return capStats(stats);
}

/** Stats with a ceiling. */
export type CappedStat = "bulletCount" | "bulletSpread" | "pierce" | "maxHp" | "bulletSpeed" | "damage" | "moveSpeed" | "chainRadius";

/** The pre-overhaul game's absolute caps (its shop bonuses used up upgrade levels to reach them). */
export const OLD_STAT_CAPS: Readonly<Record<CappedStat, number>> = Object.freeze({
  bulletCount: 5,
  bulletSpread: 0.55,
  pierce: 5,
  maxHp: 10,
  bulletSpeed: 1000,
  damage: 5,
  moveSpeed: 460,
  chainRadius: 90,
});

const CAPPED_STATS = Object.keys(OLD_STAT_CAPS) as CappedStat[];

/** What every shop item at its max level adds to each capped stat. */
function shopMaxBonus(): Record<CappedStat, number> {
  const before = baseStats();
  const after = baseStats();
  for (const item of ALL_SHOP_ITEMS) for (let i = 0; i < item.maxLevel; i++) item.apply(after);
  return Object.fromEntries(CAPPED_STATS.map((k) => [k, after[k] - before[k]])) as Record<CappedStat, number>;
}

/**
 * Highest value of each stat: the old cap plus the shop's maximum bonus. Shop bonuses no longer
 * count as upgrade levels, so the in-run upgrades alone stop at the old caps and a fully bought shop
 * adds its bonus on top: the full shop plus every upgrade lands exactly here (so no pickup is ever
 * wasted and a purchase still counts at the end of a run). The cap pins that ceiling against any
 * other stacking (relics, new upgrades or shop levels).
 */
export const STAT_CAPS: Readonly<Record<CappedStat, number>> = Object.freeze(
  (() => {
    const bonus = shopMaxBonus();
    return Object.fromEntries(CAPPED_STATS.map((k) => [k, OLD_STAT_CAPS[k] + bonus[k]])) as Record<CappedStat, number>;
  })(),
);

/** Clamps every capped stat to STAT_CAPS (in place) and returns `stats`. */
export function capStats(stats: PlayerStats): PlayerStats {
  for (const k of CAPPED_STATS) {
    // A tiny tolerance so float sums (e.g. 0.15 + 4 × 0.1) are never clipped below the cap.
    if (stats[k] > STAT_CAPS[k] + 1e-9) stats[k] = STAT_CAPS[k];
  }
  return stats;
}

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
  isWeapon?: boolean;
  level: (stats: PlayerStats) => number;
  apply: (stats: PlayerStats) => void;
}

/** The in-run level of upgrade `id` (pickups collected this run, never shop bonuses). */
export function upgradeLevel(stats: PlayerStats, id: string): number {
  const level = stats.upgradeLevels[id];
  return typeof level === "number" && Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
}

/**
 * A stat upgrade whose level is counted, not derived from the stat (so shop bonuses can't make it
 * look maxed). apply() raises the stat once per level and does nothing at maxLevel (a second
 * pickup of the same kind may be collected after the first maxed it).
 */
function statUpgrade(def: Omit<UpgradeDef, "level" | "apply" | "isWeapon">, raise: (s: PlayerStats) => void): UpgradeDef {
  return {
    ...def,
    level: (s) => upgradeLevel(s, def.id),
    apply: (s) => {
      const level = upgradeLevel(s, def.id);
      if (level >= def.maxLevel) return;
      s.upgradeLevels[def.id] = level + 1;
      raise(s);
      capStats(s);
    },
  };
}

export const ALL_UPGRADES: UpgradeDef[] = [
  statUpgrade(
    { id: "bulletCount", name: "Multi Shot", icon: ">>>", description: "Fire additional bullets per shot", maxLevel: 4 },
    (s) => { s.bulletCount += 1; },
  ),
  statUpgrade(
    { id: "bulletSpread", name: "Wide Spread", icon: "<=>", description: "Widen the angle between bullets", maxLevel: 4 },
    (s) => { s.bulletSpread += 0.1; },
  ),
  statUpgrade(
    { id: "pierce", name: "Penetration", icon: "-->", description: "Bullets pass through enemies", maxLevel: 5 },
    (s) => { s.pierce += 1; },
  ),
  statUpgrade(
    { id: "maxHp", name: "Vitality", icon: "+HP", description: "Increase max health", maxLevel: 5 },
    (s) => { s.maxHp += 1; },
  ),
  // The id predates the note-value rework; saves and unlocks refer to it, so it stays.
  statUpgrade(
    { id: "fireCooldown", name: "Rapid Fire", icon: "!!!", description: "Fire one note value faster (e.g. 1/8 → 1/8T)", maxLevel: 3 },
    (s) => { s.fireRate += 1; },
  ),
  statUpgrade(
    { id: "bulletSpeed", name: "Velocity", icon: ">>!", description: "Bullets travel faster", maxLevel: 5 },
    (s) => { s.bulletSpeed += 80; },
  ),
  statUpgrade(
    { id: "damage", name: "Power", icon: "DMG", description: "Each bullet deals more damage", maxLevel: 4 },
    (s) => { s.damage += 1; },
  ),
  statUpgrade(
    { id: "moveSpeed", name: "Agility", icon: "~>~", description: "Move faster", maxLevel: 4 },
    (s) => { s.moveSpeed += 40; },
  ),
  statUpgrade(
    { id: "chainWindow", name: "Chain Sustain", icon: "◎→", description: "Chain window +½ beat", maxLevel: 3 },
    (s) => { s.chainWindow += CHAIN_SUSTAIN_BEATS; },
  ),
  statUpgrade(
    { id: "chainRadius", name: "Chain Reach", icon: "<◎>", description: "Chain connects across greater distance", maxLevel: 3 },
    (s) => { s.chainRadius += 30; },
  ),
  // Weapon upgrades — one per non-standard weapon
  ...ALL_WEAPONS.filter((w) => w.id !== "standard" && !w.isEvolution).map((w) => ({
    id: `weapon_${w.id}`,
    name: w.name,
    icon: w.icon,
    description: w.description,
    maxLevel: 1,
    isWeapon: true,
    level: (s: PlayerStats) => s.weaponId === w.id ? 1 : 0,
    apply: (s: PlayerStats) => { s.weaponId = w.id; },
  } satisfies UpgradeDef)),
];

/** Rapid Fire level: how many rungs up TICK_LADDER the weapon's note value has climbed. */
export function fireRateLevel(stats: PlayerStats): number {
  return Number.isFinite(stats.fireRate) ? Math.max(0, Math.floor(stats.fireRate)) : 0;
}

/**
 * Picks a random pickup: 20% a weapon other than standard, otherwise a stat upgrade that
 * isn't maxed yet. Null when every stat upgrade is maxed and no weapon was rolled.
 */
export function rollDrop(stats: PlayerStats, rng: () => number = Math.random): UpgradeDef | null {
  const isWeaponDrop = rng() < 0.2;
  if (isWeaponDrop) {
    const weapons = ALL_UPGRADES.filter((u) => u.isWeapon && u.id !== "weapon_standard");
    if (weapons.length > 0) return weapons[Math.floor(rng() * weapons.length)];
  }
  const eligible = ALL_UPGRADES.filter((u) => !u.isWeapon && u.level(stats) < u.maxLevel);
  if (eligible.length === 0) return null;
  return eligible[Math.floor(rng() * eligible.length)];
}

export const UPGRADE_COLORS: Record<string, number> = {
  bulletCount: 0xff8844,
  bulletSpread: 0xffcc44,
  pierce: 0x44ffaa,
  maxHp: 0xff4444,
  fireCooldown: 0xffff44,
  bulletSpeed: 0x44ccff,
  damage: 0xff6644,
  moveSpeed: 0x88ff88,
  chainWindow: 0xffaa88,
  chainRadius: 0xffcc88,
};
