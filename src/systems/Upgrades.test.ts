import { describe, expect, it } from "vitest";
import { ALL_UPGRADES, rollDrop, type PlayerStats } from "./Upgrades";

function baseStats(): PlayerStats {
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

function maxedStats(): PlayerStats {
  const s = baseStats();
  for (const u of ALL_UPGRADES.filter((x) => !x.isWeapon)) {
    for (let i = 0; i < u.maxLevel; i++) u.apply(s);
  }
  return s;
}

/** An rng that returns the given values in order. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("rollDrop", () => {
  it("rolls a non-standard weapon on a 20% roll", () => {
    const weapons = ALL_UPGRADES.filter((u) => u.isWeapon);
    for (let k = 0; k < weapons.length; k++) {
      const drop = rollDrop(baseStats(), seq(0.1, (k + 0.5) / weapons.length));
      expect(drop?.isWeapon).toBe(true);
      expect(drop?.id).not.toBe("weapon_standard");
    }
  });

  it("otherwise rolls a stat upgrade that isn't maxed", () => {
    const stats = baseStats();
    for (let i = 0; i < 4; i++) ALL_UPGRADES.find((u) => u.id === "damage")!.apply(stats); // damage maxed
    for (let r = 0; r < 1; r += 0.05) {
      const drop = rollDrop(stats, seq(0.5, r));
      expect(drop).not.toBeNull();
      expect(drop!.isWeapon).toBeFalsy();
      expect(drop!.id).not.toBe("damage");
    }
  });

  it("returns null when every stat is maxed and no weapon was rolled", () => {
    expect(rollDrop(maxedStats(), seq(0.9))).toBeNull();
    expect(rollDrop(maxedStats(), seq(0.1, 0))?.isWeapon).toBe(true);
  });
});
