import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "beatstill_unlocks";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => { data.delete(key); },
  };
}

// Unlocks loads its state at import time, so import fresh modules after stubbing storage.
async function setup(save?: unknown) {
  const store = fakeStorage(save === undefined ? {} : { [KEY]: JSON.stringify(save) });
  vi.stubGlobal("localStorage", store);
  const shop = await import("./Shop");
  const unlocks = await import("./Unlocks");
  return { store, shop, unlocks, saved: () => JSON.parse(store.data.get(KEY) ?? "null") };
}

describe("purchaseItem", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("spends shards and records the purchase in a single save through Unlocks", async () => {
    const { store, shop, unlocks, saved } = await setup({ shards: 100, unlockedIds: ["theme_guitar"], futureField: 1 });

    expect(shop.purchaseItem("iron_hull")).toBe(true);

    expect(store.setItem).toHaveBeenCalledTimes(1);
    expect(saved()).toMatchObject({ shards: 50, shopPurchases: { iron_hull: 1 }, unlockedIds: ["theme_guitar"], futureField: 1 });
    expect(unlocks.getState().shards).toBe(50);
    expect(shop.getShopLevel("iron_hull")).toBe(1);
  });

  it("scales the cost with the current level", async () => {
    const { shop, saved } = await setup({ shards: 1000, shopPurchases: { iron_hull: 1 } });
    expect(shop.purchaseItem("iron_hull")).toBe(true);
    expect(saved()).toMatchObject({ shards: 1000 - 75, shopPurchases: { iron_hull: 2 } });
  });

  it("does nothing when the player can't afford the item", async () => {
    const { store, shop, unlocks } = await setup({ shards: 10 });
    expect(shop.purchaseItem("iron_hull")).toBe(false);
    expect(store.setItem).not.toHaveBeenCalled();
    expect(unlocks.getState().shards).toBe(10);
    expect(shop.getShopLevel("iron_hull")).toBe(0);
  });

  it("does nothing at max level or for unknown items", async () => {
    const { store, shop } = await setup({ shards: 10000, shopPurchases: { iron_hull: 3 } });
    expect(shop.purchaseItem("iron_hull")).toBe(false);
    expect(shop.purchaseItem("not_an_item")).toBe(false);
    expect(store.setItem).not.toHaveBeenCalled();
  });
});

describe("shop bonuses", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the saved item ids, max levels and costs", async () => {
    const { shop } = await setup();
    expect(shop.ALL_SHOP_ITEMS.map((i) => [i.id, i.maxLevel, i.baseCost, i.costScale])).toEqual([
      ["iron_hull", 3, 50, 1.5],
      ["sharp_rounds", 3, 40, 1.5],
      ["swift_feet", 3, 30, 1.5],
      ["quick_draw", 3, 35, 1.5],
      ["chain_link", 3, 25, 1.5],
      ["lucky_star", 5, 20, 1.3],
    ]);
    for (const item of shop.ALL_SHOP_ITEMS) expect(item.description, item.id).not.toMatch(/cooldown/i);
  });

  it("Quick Draw widens the first-shot window and Chain Link the chain window, in musical units", async () => {
    await setup({ shopPurchases: { quick_draw: 3, chain_link: 2, iron_hull: 1 } });
    const { defaultStats, ALL_UPGRADES } = await import("./Upgrades");
    const stats = defaultStats();
    expect(stats.fireGrace).toBeCloseTo(0.12);
    expect(stats.chainWindow).toBeCloseTo(0.5);
    expect(stats.maxHp).toBe(6);
    expect(stats.fireRate).toBe(0);
    // Shop bonuses never count as in-run upgrade levels.
    for (const u of ALL_UPGRADES) if (!u.isWeapon) expect(u.level(stats), u.id).toBe(0);
  });
});
