import { ALL_WEAPONS } from "./Weapons";
import { isUnlocked } from "./Unlocks";

export interface PlayerStats {
  bulletCount: number;
  bulletSpread: number;
  pierce: number;
  maxHp: number;
  fireCooldown: number;
  bulletSpeed: number;
  damage: number;
  moveSpeed: number;
  weaponId: string;
  chainWindow: number;
  chainRadius: number;
}

export function defaultStats(): PlayerStats {
  return {
    bulletCount: 1,
    bulletSpread: 0.15,
    pierce: 0,
    maxHp: 5,
    fireCooldown: 150,
    bulletSpeed: 600,
    damage: 1,
    moveSpeed: 300,
    weaponId: "standard",
    chainWindow: 0,
    chainRadius: 0,
  };
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

export const ALL_UPGRADES: UpgradeDef[] = [
  {
    id: "bulletCount",
    name: "Multi Shot",
    icon: ">>>",
    description: "Fire additional bullets per shot",
    maxLevel: 4,
    level: (s) => s.bulletCount - 1,
    apply: (s) => { s.bulletCount = Math.min(s.bulletCount + 1, 5); },
  },
  {
    id: "bulletSpread",
    name: "Wide Spread",
    icon: "<=>",
    description: "Widen the angle between bullets",
    maxLevel: 4,
    level: (s) => Math.round((s.bulletSpread - 0.15) / 0.1),
    apply: (s) => { s.bulletSpread = Math.min(s.bulletSpread + 0.1, 0.55); },
  },
  {
    id: "pierce",
    name: "Penetration",
    icon: "-->",
    description: "Bullets pass through enemies",
    maxLevel: 5,
    level: (s) => s.pierce,
    apply: (s) => { s.pierce = Math.min(s.pierce + 1, 5); },
  },
  {
    id: "maxHp",
    name: "Vitality",
    icon: "+HP",
    description: "Increase max health",
    maxLevel: 5,
    level: (s) => s.maxHp - 5,
    apply: (s) => { s.maxHp = Math.min(s.maxHp + 1, 10); },
  },
  {
    id: "fireCooldown",
    name: "Rapid Fire",
    icon: "!!!",
    description: "Shoot faster",
    maxLevel: 6,
    level: (s) => Math.round((150 - s.fireCooldown) / 15),
    apply: (s) => { s.fireCooldown = Math.max(s.fireCooldown - 15, 60); },
  },
  {
    id: "bulletSpeed",
    name: "Velocity",
    icon: ">>!",
    description: "Bullets travel faster",
    maxLevel: 5,
    level: (s) => Math.round((s.bulletSpeed - 600) / 80),
    apply: (s) => { s.bulletSpeed = Math.min(s.bulletSpeed + 80, 1000); },
  },
  {
    id: "damage",
    name: "Power",
    icon: "DMG",
    description: "Each bullet deals more damage",
    maxLevel: 4,
    level: (s) => s.damage - 1,
    apply: (s) => { s.damage = Math.min(s.damage + 1, 5); },
  },
  {
    id: "moveSpeed",
    name: "Agility",
    icon: "~>~",
    description: "Move faster",
    maxLevel: 4,
    level: (s) => Math.round((s.moveSpeed - 300) / 40),
    apply: (s) => { s.moveSpeed = Math.min(s.moveSpeed + 40, 460); },
  },
  {
    id: "chainWindow",
    name: "Chain Sustain",
    icon: "◎→",
    description: "Chain timer lasts longer",
    maxLevel: 3,
    level: (s) => s.chainWindow / 200,
    apply: (s) => { s.chainWindow = Math.min(s.chainWindow + 200, 600); },
  },
  {
    id: "chainRadius",
    name: "Chain Reach",
    icon: "<◎>",
    description: "Chain connects across greater distance",
    maxLevel: 3,
    level: (s) => s.chainRadius / 30,
    apply: (s) => { s.chainRadius = Math.min(s.chainRadius + 30, 90); },
  },
  // Weapon upgrades — one per non-standard weapon
  ...ALL_WEAPONS.filter((w) => w.id !== "standard").map((w) => ({
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

const ALWAYS_UNLOCKED_UPGRADES = new Set(["bulletCount", "bulletSpread", "maxHp", "bulletSpeed", "moveSpeed"]);

function isUpgradeAvailable(u: UpgradeDef): boolean {
  if (u.isWeapon) return isUnlocked(`weapon_${u.id.replace("weapon_", "")}`);
  if (ALWAYS_UNLOCKED_UPGRADES.has(u.id)) return true;
  return isUnlocked(`upgrade_${u.id}`);
}

export function rollUpgrades(stats: PlayerStats, count = 3): UpgradeDef[] {
  const statUpgrades = ALL_UPGRADES.filter((u) => !u.isWeapon && u.level(stats) < u.maxLevel && isUpgradeAvailable(u));
  const weaponUpgrades = ALL_UPGRADES.filter((u) => u.isWeapon && u.level(stats) < u.maxLevel && isUpgradeAvailable(u));

  const picked: UpgradeDef[] = [];
  const statPool = [...statUpgrades];
  const weapPool = [...weaponUpgrades];

  // guarantee at most 1 weapon offer per roll
  if (weapPool.length > 0 && Math.random() < 0.45) {
    const i = Math.floor(Math.random() * weapPool.length);
    picked.push(weapPool.splice(i, 1)[0]);
  }

  const remaining = [...statPool];
  while (picked.length < count && remaining.length > 0) {
    const i = Math.floor(Math.random() * remaining.length);
    picked.push(remaining.splice(i, 1)[0]);
  }

  // shuffle so weapon card isn't always first
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }

  return picked;
}
