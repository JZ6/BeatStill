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
