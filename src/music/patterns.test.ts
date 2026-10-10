import { describe, expect, it } from "vitest";
import { densify, euclid, halve, parsePattern, patternAt, patternToString, rotate } from "./patterns";

const str = (hits: readonly boolean[]) => patternToString(hits);
const hitsOf = (text: string) => parsePattern(text).hits;

describe("euclid", () => {
  it("matches the standard Euclidean rhythms", () => {
    const known: [number, number, string][] = [
      [3, 8, "x..x..x."],
      [5, 8, "x.xx.xx."],
      [4, 16, "x...x...x...x..."],
      [1, 4, "x..."],
      [2, 5, "x.x.."],
      [3, 5, "x.x.x"],
      [3, 7, "x.x.x.."],
      [4, 7, "x.x.x.x"],
      [5, 7, "x.xx.xx"],
      [4, 9, "x.x.x.x.."],
      [5, 9, "x.x.x.x.x"],
      [4, 11, "x..x..x..x."],
      [5, 11, "x.x.x.x.x.."],
      [5, 12, "x..x.x..x.x."],
      [7, 12, "x.xx.x.xx.x."],
      [5, 13, "x..x.x..x.x.."],
      [5, 16, "x..x..x..x..x..."],
      [7, 16, "x..x.x.x..x.x.x."],
      [9, 16, "x.xx.x.x.xx.x.x."],
      [11, 24, "x..x.x.x.x.x..x.x.x.x.x."],
      [13, 24, "x.xx.x.x.x.x.xx.x.x.x.x."],
    ];
    for (const [k, n, expected] of known) expect(str(euclid(k, n)), `E(${k},${n})`).toBe(expected);
  });

  it("uses Bjorklund's grouping for E(n-1, n) (a rotation of Toussaint's x.xx form)", () => {
    expect(str(euclid(2, 3))).toBe("xx.");
    expect(str(euclid(3, 4))).toBe("xxx.");
    expect(str(euclid(7, 8))).toBe("xxxxxxx.");
  });

  it("handles the edge cases", () => {
    expect(euclid(0, 8)).toEqual(new Array(8).fill(false));
    expect(euclid(8, 8)).toEqual(new Array(8).fill(true));
    expect(euclid(1, 1)).toEqual([true]);
    expect(euclid(0, 0)).toEqual([]);
    expect(euclid(0, 1)).toEqual([false]);
  });

  it("is maximally even for every pulse/step combination", () => {
    for (let n = 1; n <= 32; n++) {
      for (let k = 0; k <= n; k++) {
        const p = euclid(k, n);
        expect(p).toHaveLength(n);
        const idx = p.flatMap((h, i) => (h ? [i] : []));
        expect(idx, `E(${k},${n})`).toHaveLength(k);
        if (k === 0) continue;
        expect(p[0], `E(${k},${n}) starts on a hit`).toBe(true);
        const gaps = idx.map((i, j) => (j + 1 < idx.length ? idx[j + 1] : idx[0] + n) - i);
        expect(Math.max(...gaps) - Math.min(...gaps), `E(${k},${n})`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("rotates left", () => {
    expect(str(euclid(3, 8, 1))).toBe("..x..x.x");
    expect(str(euclid(3, 8, 3))).toBe("x..x.x..");
    expect(str(euclid(3, 8, -1))).toBe(".x..x..x");
    expect(euclid(3, 8, 8)).toEqual(euclid(3, 8));
    expect(euclid(3, 8, -13)).toEqual(euclid(3, 8, 3));
    expect(euclid(0, 0, 5)).toEqual([]);
  });

  it("rejects invalid arguments", () => {
    expect(() => euclid(9, 8)).toThrow();
    expect(() => euclid(-1, 8)).toThrow();
    expect(() => euclid(3, -8)).toThrow();
    expect(() => euclid(2.5, 8)).toThrow();
    expect(() => euclid(3, 8.5)).toThrow();
    expect(() => euclid(3, 8, 0.5)).toThrow();
    expect(() => euclid(NaN, 8)).toThrow();
  });
});

describe("rotate", () => {
  it("rotates any array without mutating it", () => {
    const src = [1, 2, 3, 4];
    expect(rotate(src, 1)).toEqual([2, 3, 4, 1]);
    expect(rotate(src, -1)).toEqual([4, 1, 2, 3]);
    expect(rotate(src, 6)).toEqual([3, 4, 1, 2]);
    expect(src).toEqual([1, 2, 3, 4]);
    expect(rotate([], 3)).toEqual([]);
  });
});

describe("parsePattern", () => {
  it("parses hits, accents and rests, ignoring spaces and bar lines", () => {
    const p = parsePattern("x..x ..X. | 1-.-");
    expect(str(p.hits)).toBe("x..x..x.x...");
    expect(p.accents).toEqual([false, false, false, false, false, false, true, false, false, false, false, false]);
    expect(patternToString(p.hits, p.accents)).toBe("x..x..X.x...");
  });

  it("ignores any whitespace", () => {
    expect(str(hitsOf("x.\t.x\n..x."))).toBe("x..x..x.");
  });

  it("round-trips with patternToString", () => {
    const text = "X..x..x.x.X.x...";
    const p = parsePattern(text);
    expect(patternToString(p.hits, p.accents)).toBe(text);
    expect(parsePattern(str(euclid(5, 8))).hits).toEqual(euclid(5, 8));
  });

  it("returns empty arrays for an empty pattern", () => {
    expect(parsePattern("")).toEqual({ hits: [], accents: [] });
    expect(parsePattern(" | ")).toEqual({ hits: [], accents: [] });
  });

  it("throws on other characters", () => {
    for (const bad of ["x..o", "x0..", "x..2", "x_..", "y", "x,x", "x..x*"]) {
      expect(() => parsePattern(bad), bad).toThrow();
    }
    expect(() => parsePattern(null as unknown as string)).toThrow();
  });
});

describe("patternAt", () => {
  const hits = hitsOf("x..x..x.");

  it("reads steps with wraparound in both directions", () => {
    expect([0, 1, 2, 3].map((s) => patternAt(hits, s))).toEqual([true, false, false, true]);
    expect(patternAt(hits, 8)).toBe(true);
    expect(patternAt(hits, 11)).toBe(true);
    expect(patternAt(hits, -2)).toBe(true);
    expect(patternAt(hits, -1)).toBe(false);
    expect(patternAt(hits, -8)).toBe(true);
    expect(patternAt(hits, 1000003)).toBe(patternAt(hits, 1000003 % 8));
  });

  it("applies the offset", () => {
    expect(patternAt(hits, 0, 3)).toBe(true);
    expect(patternAt(hits, 0, 1)).toBe(false);
    expect(patternAt(hits, 2, -2)).toBe(true);
    expect(patternAt(hits, 1, -3)).toBe(true);
    for (let s = 0; s < 16; s++) expect(patternAt(hits, s, 2)).toBe(patternAt(rotate(hits, 2), s));
  });

  it("floors fractional steps and never hits on an empty pattern", () => {
    expect(patternAt(hits, 0.9)).toBe(true);
    expect(patternAt(hits, 2.5, 0.5)).toBe(true);
    expect(patternAt([], 3)).toBe(false);
    expect(() => patternAt(hits, NaN)).toThrow();
    expect(() => patternAt(hits, 0, Infinity)).toThrow();
  });
});

describe("densify", () => {
  it("doubles the length and the number of hits", () => {
    expect(str(densify(hitsOf("x...x...x...x...")))).toBe("x...".repeat(8));
    expect(str(densify(hitsOf("x..x..x.")))).toBe("x..x..x..x..x.x.");
    expect(str(densify(hitsOf("x...")))).toBe("x...x...");
    expect(str(densify(hitsOf("xx")))).toBe("xxxx");
    expect(str(densify(hitsOf("x")))).toBe("xx");
  });

  it("wraps the last midpoint around the end", () => {
    expect(str(densify(hitsOf("...x")))).toBe("..x...x.");
    expect(str(densify(hitsOf(".x.x")))).toBe("x.x.x.x.");
  });

  it("keeps every original hit on its doubled step", () => {
    for (const k of [1, 3, 5, 7]) {
      const src = euclid(k, 16, 3);
      const d = densify(src);
      expect(d).toHaveLength(32);
      expect(d.filter(Boolean)).toHaveLength(2 * k);
      src.forEach((h, i) => {
        if (h) expect(d[2 * i]).toBe(true);
      });
    }
  });

  it("handles empty patterns and patterns without hits", () => {
    expect(densify([])).toEqual([]);
    expect(densify(hitsOf("...."))).toEqual(new Array(8).fill(false));
  });
});

describe("halve", () => {
  it("inverts densify", () => {
    for (const text of ["x..x..x.", "x.xx.xx.", "x...x...x...x...", "x", "xx", "...x", "x.x.....x..x...."]) {
      const src = hitsOf(text);
      const back = halve(densify(src));
      expect(back, text).toHaveLength(src.length);
      expect(densify(back), text).toEqual(densify(src));
    }
    for (let k = 0; k <= 16; k++) {
      expect(halve(densify(euclid(k, 16))), `E(${k},16)`).toEqual(euclid(k, 16));
    }
  });

  it("recovers the exact original when the first hit is on step 0", () => {
    for (const text of ["x..x..x.", "x.xx.xx.", "x.x.....x..x....", "x...x...x...x..."]) {
      expect(str(halve(densify(hitsOf(text)))), text).toBe(text);
    }
  });

  it("keeps every other hit on arbitrary patterns", () => {
    expect(str(halve(hitsOf("x.x.x.x.")))).toBe("x.x.");
    expect(str(halve(hitsOf("xxxxxxxx")))).toBe("xxxx");
    expect(str(halve(hitsOf("x..x..x.")))).toBe("x..x");
    // Hits on odd steps round down: steps 1 and 5 → 0 and 2.
    expect(str(halve(hitsOf(".x.x.x.x")))).toBe("x.x.");
    expect(str(halve(hitsOf("x.x")))).toBe("x.");
  });

  it("handles empty patterns and patterns without hits", () => {
    expect(halve([])).toEqual([]);
    expect(halve(hitsOf("......"))).toEqual([false, false, false]);
  });
});
