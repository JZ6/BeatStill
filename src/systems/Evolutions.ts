import type { PlayerStats } from "./Upgrades";
import { ALL_UPGRADES } from "./Upgrades";
import { getWeapon } from "./Weapons";

interface EvolutionDef {
  sourceWeaponId: string;
  requiredUpgradeId: string;
  evolvedWeaponId: string;
}

export const ALL_EVOLUTIONS: EvolutionDef[] = [
  { sourceWeaponId: "shotgun",  requiredUpgradeId: "bulletSpread", evolvedWeaponId: "nova" },
  { sourceWeaponId: "laser",    requiredUpgradeId: "pierce",       evolvedWeaponId: "railgun" },
  { sourceWeaponId: "cannon",   requiredUpgradeId: "damage",       evolvedWeaponId: "nuke" },
  { sourceWeaponId: "homing",   requiredUpgradeId: "bulletCount",  evolvedWeaponId: "swarm" },
  { sourceWeaponId: "standard", requiredUpgradeId: "fireCooldown", evolvedWeaponId: "minigun" },
];

export function checkEvolution(stats: PlayerStats): EvolutionDef | null {
  for (const evo of ALL_EVOLUTIONS) {
    if (stats.weaponId !== evo.sourceWeaponId) continue;
    const upg = ALL_UPGRADES.find((u) => u.id === evo.requiredUpgradeId);
    if (!upg) continue;
    if (upg.level(stats) >= upg.maxLevel) return evo;
  }
  return null;
}

export function getEvolutionRequirement(evolvedId: string): string {
  const evo = ALL_EVOLUTIONS.find((e) => e.evolvedWeaponId === evolvedId);
  if (!evo) return "";
  const weapon = getWeapon(evo.sourceWeaponId);
  const upg = ALL_UPGRADES.find((u) => u.id === evo.requiredUpgradeId);
  return `${weapon.name} + Max ${upg?.name ?? evo.requiredUpgradeId}`;
}
