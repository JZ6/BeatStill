export interface WeaponDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCooldown: number;
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

export const ALL_WEAPONS: WeaponDef[] = [
  {
    id: "standard",
    name: "Standard",
    icon: "---",
    description: "Balanced all-rounder",
    baseCooldown: 150,
    baseBulletCount: 1,
    baseBulletSpread: 0.15,
    baseBulletSpeed: 450,
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
    baseCooldown: 400,
    baseBulletCount: 5,
    baseBulletSpread: 0.5,
    baseBulletSpeed: 380,
    damageMultiplier: 1,
    basePierce: 0,
    bulletRadius: 2.5,
    bulletColor: 0xff8833,
    lifetime: 800,
    homing: false,

  },
  {
    id: "laser",
    name: "Laser",
    icon: "===",
    description: "Rapid needles that pierce through enemies",
    baseCooldown: 80,
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 900,
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
    baseCooldown: 600,
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 260,
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
    baseCooldown: 200,
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 300,
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
    baseCooldown: 500,
    baseBulletCount: 8,
    baseBulletSpread: Math.PI * 2,
    baseBulletSpeed: 380,
    damageMultiplier: 1.2,
    basePierce: 0,
    bulletRadius: 3,
    bulletColor: 0xff6600,
    lifetime: 600,
    homing: false,

    isEvolution: true,
  },
  {
    id: "railgun",
    name: "Railgun",
    icon: ">>|",
    description: "Hypersonic beam pierces everything",
    baseCooldown: 120,
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 1500,
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
    baseCooldown: 1200,
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 150,
    damageMultiplier: 8,
    basePierce: 3,
    bulletRadius: 12,
    bulletColor: 0xff2200,
    lifetime: 2000,
    homing: false,

    isEvolution: true,
  },
  {
    id: "swarm",
    name: "Swarm",
    icon: ">>@",
    description: "Homing missile barrage",
    baseCooldown: 250,
    baseBulletCount: 4,
    baseBulletSpread: 0.8,
    baseBulletSpeed: 320,
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
    description: "Relentless bullet stream",
    baseCooldown: 40,
    baseBulletCount: 1,
    baseBulletSpread: 0.2,
    baseBulletSpeed: 530,
    damageMultiplier: 0.4,
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
