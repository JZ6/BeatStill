export interface WeaponDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /**
   * The weapon's note value: ticks between shots on the conductor grid (24 ticks per beat), e.g.
   * 12 = 1/8, 8 = 1/8 triplet. Must be on TICK_LADDER (src/music/noteValues.ts); Rapid Fire climbs it.
   */
  noteTicks: number;
  /** How each shot's lead note sounds: length in beats and velocity (0..1). */
  articulation: { beats: number; velocity: number };
  baseBulletCount: number;
  baseBulletSpread: number;
  baseBulletSpeed: number;
  damageMultiplier: number;
  basePierce: number;
  bulletRadius: number;
  bulletColor: number;
  lifetime: number;
  homing: boolean;
  isEvolution?: boolean;
}

// Balance (Phase 8, see `npm run balance`): at 105 bpm every weapon's DPS is within ±20% of its
// pre-overhaul ms cooldown (the minigun at Rapid Fire 3, where its evolution starts). Bullets are
// ~12% slower than before (README: "make the player shot slower"); short-lived bullets live
// correspondingly longer, so their range is unchanged.
export const ALL_WEAPONS: WeaponDef[] = [
  {
    id: "standard",
    name: "Standard",
    icon: "---",
    description: "Balanced all-rounder",
    // 1/8T: 1/8 would be 23% below the old 220 ms at 105 bpm (and integer damage can't make up
    // for it); the triplet is +16% there and −12%…+32% across the palettes (1/8: −41%…−12%).
    noteTicks: 8, // 1/8T
    articulation: { beats: 0.25, velocity: 0.5 },
    baseBulletCount: 1,
    baseBulletSpread: 0.15,
    baseBulletSpeed: 395,
    damageMultiplier: 1,
    basePierce: 0,
    bulletRadius: 3,
    bulletColor: 0xffff00,
    lifetime: 0,
    homing: false,

  },
  {
    id: "shotgun",
    name: "Shotgun",
    icon: "|||",
    description: "Wide burst, deadly up close, short range",
    // Dotted 1/8: exactly the old 450 ms at 100 bpm (1/4 would be 21% slower at 105 bpm).
    noteTicks: 18, // dotted 1/8
    articulation: { beats: 0.4, velocity: 0.6 },
    baseBulletCount: 3,
    baseBulletSpread: 0.5,
    baseBulletSpeed: 335,
    damageMultiplier: 1,
    basePierce: 0,
    bulletRadius: 2.5,
    bulletColor: 0xff8833,
    lifetime: 910,
    homing: false,

  },
  {
    id: "laser",
    name: "Laser",
    icon: "===",
    description: "Rapid needles that pierce through enemies",
    noteTicks: 6, // 1/16
    articulation: { beats: 0.15, velocity: 0.4 },
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 790,
    damageMultiplier: 0.5,
    basePierce: 2,
    bulletRadius: 1.5,
    bulletColor: 0x00ffff,
    lifetime: 0,
    homing: false,

  },
  {
    id: "cannon",
    name: "Cannon",
    icon: "(O)",
    description: "Slow heavy slugs that devastate on hit",
    noteTicks: 24, // 1/4
    articulation: { beats: 0.6, velocity: 0.7 },
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 230,
    damageMultiplier: 3,
    basePierce: 0,
    bulletRadius: 6,
    bulletColor: 0xff4400,
    lifetime: 0,
    homing: false,

  },
  {
    id: "homing",
    name: "Homing",
    icon: "@>@",
    description: "Bullets seek enemies, never miss",
    noteTicks: 12, // 1/8
    articulation: { beats: 0.3, velocity: 0.45 },
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 265,
    damageMultiplier: 0.7,
    basePierce: 0,
    bulletRadius: 2.5,
    bulletColor: 0x44ff44,
    lifetime: 0,
    homing: true,

  },

  // --- Evolutions ---
  {
    id: "nova",
    name: "Nova",
    icon: "***",
    description: "360° burst of destruction",
    noteTicks: 24, // 1/4
    articulation: { beats: 0.5, velocity: 0.65 },
    baseBulletCount: 5,
    baseBulletSpread: Math.PI * 2,
    baseBulletSpeed: 335,
    damageMultiplier: 1.2,
    basePierce: 0,
    bulletRadius: 3,
    bulletColor: 0xff6600,
    lifetime: 680,
    homing: false,

    isEvolution: true,
  },
  {
    id: "railgun",
    name: "Railgun",
    icon: ">>|",
    description: "Hypersonic beam pierces everything",
    noteTicks: 8, // 1/8 triplet
    articulation: { beats: 0.2, velocity: 0.55 },
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 1320,
    damageMultiplier: 0.8,
    basePierce: 10,
    bulletRadius: 1.5,
    bulletColor: 0x00ffff,
    lifetime: 0,
    homing: false,

    isEvolution: true,
  },
  {
    id: "nuke",
    name: "Nuke",
    icon: "(X)",
    description: "Massive slug of annihilation",
    noteTicks: 48, // 1/2
    articulation: { beats: 1, velocity: 0.8 },
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 130,
    damageMultiplier: 8,
    basePierce: 3,
    bulletRadius: 12,
    bulletColor: 0xff2200,
    lifetime: 2300,
    homing: false,

    isEvolution: true,
  },
  {
    id: "swarm",
    name: "Swarm",
    icon: ">>@",
    description: "Homing missile barrage",
    noteTicks: 12, // 1/8
    articulation: { beats: 0.3, velocity: 0.45 },
    baseBulletCount: 2,
    baseBulletSpread: 0.8,
    baseBulletSpeed: 280,
    damageMultiplier: 0.6,
    basePierce: 0,
    bulletRadius: 2.5,
    bulletColor: 0x88ff44,
    lifetime: 0,
    homing: true,

    isEvolution: true,
  },
  {
    id: "minigun",
    name: "Minigun",
    icon: "|||",
    description: "Relentless twin bullet stream",
    // Always held at Rapid Fire 3 (its evolution needs max Rapid Fire), where the standard already
    // plays 1/32, so the old ×0.4 damage would make evolving a downgrade. Twin barrels at full
    // damage: ≥ 1.2× a maxed standard at every Power / Multi Shot level, and 16% below the old
    // minigun's 30 ms floor at 105 bpm.
    noteTicks: 3, // 1/32
    articulation: { beats: 0.12, velocity: 0.35 },
    baseBulletCount: 2,
    baseBulletSpread: 0.2,
    baseBulletSpeed: 465,
    damageMultiplier: 1,
    basePierce: 0,
    bulletRadius: 2,
    bulletColor: 0xffff88,
    lifetime: 0,
    homing: false,

    isEvolution: true,
  },
];

export function getWeapon(id: string): WeaponDef {
  return ALL_WEAPONS.find((w) => w.id === id) ?? ALL_WEAPONS[0];
}
