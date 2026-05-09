import type { ShotSound } from "./AudioManager";

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
  shotSound: ShotSound;
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
    baseBulletSpeed: 600,
    damageMultiplier: 1,
    basePierce: 0,
    bulletRadius: 3,
    bulletColor: 0xffff00,
    lifetime: 0,
    homing: false,
    shotSound: "soft",
  },
  {
    id: "shotgun",
    name: "Shotgun",
    icon: "|||",
    description: "Wide burst, deadly up close, short range",
    baseCooldown: 400,
    baseBulletCount: 5,
    baseBulletSpread: 0.5,
    baseBulletSpeed: 500,
    damageMultiplier: 1,
    basePierce: 0,
    bulletRadius: 2.5,
    bulletColor: 0xff8833,
    lifetime: 800,
    homing: false,
    shotSound: "kick",
  },
  {
    id: "laser",
    name: "Laser",
    icon: "===",
    description: "Rapid needles that pierce through enemies",
    baseCooldown: 80,
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 1200,
    damageMultiplier: 0.5,
    basePierce: 2,
    bulletRadius: 1.5,
    bulletColor: 0x00ffff,
    lifetime: 0,
    homing: false,
    shotSound: "pulse",
  },
  {
    id: "cannon",
    name: "Cannon",
    icon: "(O)",
    description: "Slow heavy slugs that devastate on hit",
    baseCooldown: 600,
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 350,
    damageMultiplier: 3,
    basePierce: 0,
    bulletRadius: 6,
    bulletColor: 0xff4400,
    lifetime: 0,
    homing: false,
    shotSound: "808",
  },
  {
    id: "homing",
    name: "Homing",
    icon: "@>@",
    description: "Bullets seek enemies, never miss",
    baseCooldown: 200,
    baseBulletCount: 1,
    baseBulletSpread: 0,
    baseBulletSpeed: 400,
    damageMultiplier: 0.7,
    basePierce: 0,
    bulletRadius: 2.5,
    bulletColor: 0x44ff44,
    lifetime: 0,
    homing: true,
    shotSound: "bubble",
  },
];

export function getWeapon(id: string): WeaponDef {
  return ALL_WEAPONS.find((w) => w.id === id) ?? ALL_WEAPONS[0];
}
