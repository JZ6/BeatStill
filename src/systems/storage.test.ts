import { afterEach, describe, expect, it, vi } from "vitest";
import { loadJSON, saveJSON } from "./storage";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

const identity = (raw: unknown) => raw;

describe("storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("works without localStorage (Node)", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadJSON("k", (raw) => raw ?? "default")).toBe("default");
    expect(saveJSON("k", { a: 1 })).toBe(false);
  });

  it("round-trips JSON through localStorage", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    expect(saveJSON("k", { a: 1, b: [2] })).toBe(true);
    expect(store.data.get("k")).toBe('{"a":1,"b":[2]}');
    expect(loadJSON("k", identity)).toEqual({ a: 1, b: [2] });
  });

  it("passes undefined to the normalizer for missing or corrupt data", () => {
    vi.stubGlobal("localStorage", fakeStorage({ bad: "{not json" }));
    const normalize = vi.fn((raw: unknown) => raw ?? "default");
    expect(loadJSON("missing", normalize)).toBe("default");
    expect(loadJSON("bad", normalize)).toBe("default");
    expect(normalize).toHaveBeenCalledTimes(2);
    expect(normalize).toHaveBeenNthCalledWith(1, undefined);
    expect(normalize).toHaveBeenNthCalledWith(2, undefined);
  });

  it("returns false when the write throws (e.g. quota exceeded)", () => {
    const store = fakeStorage();
    store.setItem = () => { throw new Error("QuotaExceededError"); };
    vi.stubGlobal("localStorage", store);
    expect(saveJSON("k", 1)).toBe(false);
  });

  it("returns the normalizer default when reading throws", () => {
    const store = fakeStorage();
    store.getItem = () => { throw new Error("SecurityError"); };
    vi.stubGlobal("localStorage", store);
    expect(loadJSON("k", (raw) => raw ?? 7)).toBe(7);
  });
});
