import { describe, expect, it } from "vitest";
import { UniformGrid } from "./spatialGrid";

function collect<T>(g: UniformGrid<T>, minX: number, minY: number, maxX: number, maxY: number): T[] {
  const out: T[] = [];
  g.query(minX, minY, maxX, maxY, (item) => {
    out.push(item);
  });
  return out;
}

describe("UniformGrid", () => {
  it("returns the items in the cells a rectangle touches, each once", () => {
    const g = new UniformGrid<string>(10);
    g.insert("a", 5, 5);
    g.insert("b", 15, 5);
    g.insert("c", 55, 55);
    g.insert("d", -5, -5);
    expect(g.size).toBe(4);
    expect(collect(g, 0, 0, 19, 9).sort()).toEqual(["a", "b"]);
    expect(collect(g, -1, -1, 1, 1).sort()).toEqual(["a", "d"]);
    expect(collect(g, 50, 50, 59, 59)).toEqual(["c"]);
    expect(collect(g, 100, 100, 200, 200)).toEqual([]);
  });

  it("stops early when the visitor returns true", () => {
    const g = new UniformGrid<number>(10);
    for (let i = 0; i < 5; i++) g.insert(i, 1, 1);
    let seen = 0;
    g.query(0, 0, 5, 5, () => ++seen === 2);
    expect(seen).toBe(2);
  });

  it("handles huge and invalid rectangles and ignores non-finite positions", () => {
    const g = new UniformGrid<string>(10);
    g.insert("a", 1, 1);
    g.insert("far", 1e9, -1e9);
    g.insert("nan", Number.NaN, 0);
    expect(g.size).toBe(2);
    expect(collect(g, -Infinity, -Infinity, Infinity, Infinity).sort()).toEqual(["a", "far"]);
    expect(collect(g, 5, 5, 0, 0)).toEqual([]);
    expect(collect(g, Number.NaN, 0, 10, 10)).toEqual([]);
  });

  it("clears and reuses its cells", () => {
    const g = new UniformGrid<string>(10);
    g.insert("a", 1, 1);
    g.clear();
    expect(g.size).toBe(0);
    expect(collect(g, 0, 0, 10, 10)).toEqual([]);
    g.insert("b", 1, 1);
    expect(collect(g, 0, 0, 10, 10)).toEqual(["b"]);
  });

  it("falls back to a sane cell size", () => {
    expect(new UniformGrid(0).cellSize).toBe(64);
    expect(new UniformGrid(Number.NaN).cellSize).toBe(64);
  });
});
