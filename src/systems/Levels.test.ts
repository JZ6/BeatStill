import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "beatstill_levels";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    setItem: (key: string, value: string) => { data.set(key, value); },
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => { data.delete(key); },
  };
}

// Levels loads progress at import time, so import a fresh module after stubbing storage.
async function setup(raw?: string) {
  const store = fakeStorage(raw === undefined ? {} : { [KEY]: raw });
  vi.stubGlobal("localStorage", store);
  const levels = await import("./Levels");
  return { store, levels, saved: () => JSON.parse(store.data.get(KEY) ?? "null") };
}

describe("Levels progress", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads an existing save", async () => {
    const { levels } = await setup(JSON.stringify({ completedIds: [1, 2] }));
    expect(levels.isLevelCompleted(1)).toBe(true);
    expect(levels.isLevelCompleted(2)).toBe(true);
    expect(levels.isLevelUnlocked(3)).toBe(true);
    expect(levels.isLevelUnlocked(4)).toBe(false);
  });

  it("survives a corrupt save", async () => {
    const { levels } = await setup("{oops");
    expect(levels.isLevelUnlocked(1)).toBe(true);
    expect(levels.isLevelCompleted(1)).toBe(false);
  });

  it("records campaign completions", async () => {
    const { levels, saved } = await setup(JSON.stringify({ completedIds: [1], extra: true }));
    levels.markLevelComplete(2);
    levels.markLevelComplete(2);
    expect(saved()).toEqual({ completedIds: [1, 2], extra: true });
  });

  it("ignores custom level ids", async () => {
    const { store, levels } = await setup();
    levels.markLevelComplete(1000);
    expect(levels.isCampaignLevel(1000)).toBe(false);
    expect(levels.isLevelCompleted(1000)).toBe(false);
    expect(store.data.has(KEY)).toBe(false);
  });

  it("identifies campaign levels", async () => {
    const { levels } = await setup();
    expect(levels.ALL_LEVELS.every((l) => levels.isCampaignLevel(l.id))).toBe(true);
  });
});
