import { describe, expect, it } from "vitest";
import { checkEvolution } from "./Evolutions";
import { ALL_SHOP_ITEMS } from "./Shop";
import { ALL_UPGRADES, OLD_STAT_CAPS, STAT_CAPS, capStats, fireRateLevel, rollDrop, upgradeLevel, type PlayerStats } from "./Upgrades";

function baseStats(): PlayerStats {
  return {
    bulletCount: 1,
    bulletSpread: 0.15,
    pierce: 0,
    maxHp: 5,
    fireRate: 0,
    bulletSpeed: 600,
    damage: 1,
    moveSpeed: 300,
    weaponId: "standard",
    chainWindow: 0,
    chainRadius: 0,
    fireGrace: 0,
    upgradeLevels: {},
  };
}

const upgrade = (id: string) => ALL_UPGRADES.find((u) => u.id === id)!;

describe("upgrade levels", () => {
  it("keep their ids (saves, unlocks and evolutions refer to them)", () => {
    expect(ALL_UPGRADES.filter((u) => !u.isWeapon).map((u) => u.id)).toEqual([
      "bulletCount",
      "bulletSpread",
      "pierce",
      "maxHp",
      "fireCooldown",
      "bulletSpeed",
      "damage",
      "moveSpeed",
      "chainWindow",
      "chainRadius",
    ]);
  });

  it("count pickups only: shop bonuses never make an upgrade look levelled or maxed", () => {
    // As if the shop had added +3 max HP, +3 damage, +90 speed, +0.75 beat chain window, Quick Draw.
    const s = { ...baseStats(), maxHp: 8, damage: 4, moveSpeed: 390, chainWindow: 0.75, fireGrace: 0.12 };
    for (const u of ALL_UPGRADES.filter((x) => !x.isWeapon)) expect(u.level(s), u.id).toBe(0);
    const vitality = upgrade("maxHp");
    for (let i = 0; i < vitality.maxLevel; i++) vitality.apply(s);
    expect(vitality.level(s)).toBe(5);
    expect(s.maxHp).toBe(13);
    vitality.apply(s); // a second pickup collected after the first maxed it
    expect(s.maxHp).toBe(13);
    expect(upgradeLevel(s, "maxHp")).toBe(5);
  });

  it("Rapid Fire climbs one rung per level, 3 levels", () => {
    const s = baseStats();
    const rapid = upgrade("fireCooldown");
    expect(rapid).toMatchObject({ name: "Rapid Fire", maxLevel: 3 });
    for (let i = 1; i <= 4; i++) {
      rapid.apply(s);
      expect(fireRateLevel(s)).toBe(Math.min(i, 3));
    }
    expect(rapid.level(s)).toBe(3);
    expect(fireRateLevel({ ...s, fireRate: Number.NaN })).toBe(0);
  });

  it("Chain Sustain adds half a beat per level, 3 levels", () => {
    const s = baseStats();
    const sustain = upgrade("chainWindow");
    expect(sustain.maxLevel).toBe(3);
    for (let i = 0; i < 4; i++) sustain.apply(s);
    expect(s.chainWindow).toBeCloseTo(1.5);
    expect(sustain.level(s)).toBe(3);
  });

  it("without shop bonuses, maxed stats match the old caps", () => {
    const s = maxedStats();
    expect(s).toMatchObject({ bulletCount: 5, pierce: 5, maxHp: 10, bulletSpeed: 1000, damage: 5, moveSpeed: 460, chainRadius: 90, fireRate: 3 });
    expect(s.bulletSpread).toBeCloseTo(0.55);
  });
});

describe("stat caps", () => {
  it("are the old caps plus the shop's maximum bonus", () => {
    expect(STAT_CAPS).toMatchObject({ bulletCount: 5, pierce: 5, maxHp: 13, bulletSpeed: 1000, damage: 8, moveSpeed: 550, chainRadius: 90 });
    expect(STAT_CAPS.bulletSpread).toBeCloseTo(0.55);
    expect(OLD_STAT_CAPS).toMatchObject({ maxHp: 10, damage: 5, moveSpeed: 460 });
  });

  it("a full shop plus every upgrade lands exactly on them: no pickup or purchase is wasted", () => {
    const s = baseStats();
    for (const item of ALL_SHOP_ITEMS) for (let i = 0; i < item.maxLevel; i++) item.apply(s);
    for (const u of ALL_UPGRADES.filter((x) => !x.isWeapon)) {
      for (let i = 0; i < u.maxLevel; i++) u.apply(s);
    }
    for (const [k, cap] of Object.entries(STAT_CAPS)) expect(s[k as keyof typeof STAT_CAPS], k).toBeCloseTo(cap);
  });

  it("clamps anything stacked beyond them, leaving other stats alone", () => {
    const s = capStats({ ...maxedStats(), damage: 12, maxHp: 20, moveSpeed: 999, chainWindow: 9 });
    expect(s).toMatchObject({ damage: 8, maxHp: 13, moveSpeed: 550, chainWindow: 9 });
    expect(capStats(baseStats())).toEqual(baseStats());
  });
});

describe("evolutions", () => {
  it("standard evolves into minigun only at max Rapid Fire", () => {
    const s = baseStats();
    const rapid = upgrade("fireCooldown");
    rapid.apply(s);
    rapid.apply(s);
    expect(checkEvolution(s)).toBeNull();
    rapid.apply(s);
    expect(checkEvolution(s)?.evolvedWeaponId).toBe("minigun");
  });

  it("a shop-boosted stat does not count toward an evolution", () => {
    const s = { ...baseStats(), weaponId: "cannon", damage: 4 }; // Sharp Rounds ×3
    expect(checkEvolution(s)).toBeNull();
    for (let i = 0; i < 4; i++) upgrade("damage").apply(s);
    expect(checkEvolution(s)?.evolvedWeaponId).toBe("nuke");
  });
});

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
