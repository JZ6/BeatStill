import { describe, expect, it } from "vitest";
import { getWeapon } from "./Weapons";
import { baseStats } from "./Upgrades";
import { shotProfile } from "./weaponMath";
import {
  BULLET_GRID_CELL,
  ENEMY_BULLET_HP,
  clashBullets,
  indexBullets,
  playerBulletHp,
  resolveClash,
  sweptOverlap,
  type ClashBody,
} from "./bulletClash";
import { UniformGrid } from "./spatialGrid";

interface TestBullet extends ClashBody {
  id: string;
  alive: boolean;
}

/** A bullet that moved from (px, py) to (x, y) this frame. */
function bullet(id: string, x: number, y: number, hp: number, { radius = 3, px = x, py = y } = {}): TestBullet {
  return { id, x, y, prevX: px, prevY: py, radius, hp, alive: true };
}

/** Runs one clash pass, destroying bullets at 0 HP like the CollisionSystem does. */
function clash(players: TestBullet[], enemies: TestBullet[]) {
  const index = indexBullets(new UniformGrid<TestBullet>(BULLET_GRID_CELL), enemies);
  const pairs: string[] = [];
  const stats = clashBullets(players, index, (p, e) => {
    pairs.push(`${p.id}:${e.id}`);
    if (!(e.hp > 0)) e.alive = false;
    if (!(p.hp > 0)) p.alive = false;
  });
  return { ...stats, pairs };
}

/** `n` enemy bullets in a row along the x axis, `gap` px apart, starting at x0. */
const row = (n: number, x0: number, gap = 10) => Array.from({ length: n }, (_, i) => bullet(`e${i}`, x0 + i * gap, 0, ENEMY_BULLET_HP));

describe("bullet HP", () => {
  it("is damage + pierce for player bullets, 1 for enemy bullets", () => {
    const hp = (id: string) => {
      const s = shotProfile(getWeapon(id), baseStats());
      return playerBulletHp(s.damage, s.pierce);
    };
    expect(ENEMY_BULLET_HP).toBe(1);
    expect(hp("standard")).toBe(1);
    expect(hp("cannon")).toBe(3);
    expect(hp("laser")).toBe(3);
    expect(hp("nuke")).toBe(11);
    expect(playerBulletHp(Number.NaN, -2)).toBe(1);
  });

  it("trades the smaller HP of the two", () => {
    const a = bullet("a", 0, 0, 3);
    const b = bullet("b", 0, 0, 1);
    expect(resolveClash(a, b)).toBe(1);
    expect([a.hp, b.hp]).toEqual([2, 0]);
    const c = bullet("c", 0, 0, 2);
    const d = bullet("d", 0, 0, 5);
    resolveClash(c, d);
    expect([c.hp, d.hp]).toEqual([0, 3]);
    expect(resolveClash(c, d)).toBe(0);
  });
});

describe("swept contact", () => {
  it("detects overlap at rest and misses separated bullets", () => {
    expect(sweptOverlap(bullet("a", 0, 0, 1), bullet("b", 5, 0, 1))).toBe(true);
    expect(sweptOverlap(bullet("a", 0, 0, 1), bullet("b", 7, 0, 1))).toBe(false);
  });

  it("catches a fast bullet that passes through a small one within a frame", () => {
    // 25 px in one frame (a railgun at 60 fps) across a bullet sitting on its path.
    const fast = bullet("p", 25, 0, 1, { radius: 1.5, px: 0, py: 0 });
    expect(sweptOverlap(fast, bullet("e", 12, 0, 1))).toBe(true);
    expect(sweptOverlap(fast, bullet("e", 12, 6, 1))).toBe(false);
  });

  it("follows both bullets' motion: a head-on crossing touches, a parallel pass does not", () => {
    const p = bullet("p", 10, 0, 1, { px: 0, py: 0 });
    expect(sweptOverlap(p, bullet("e", 0, 0, 1, { px: 10, py: 0 }))).toBe(true);
    expect(sweptOverlap(p, bullet("e", 10, 8, 1, { px: 0, py: 8 }))).toBe(false);
  });
});

describe("clash pass", () => {
  it("a standard shot (1 HP) trades 1:1 with enemy bullets", () => {
    const p = bullet("p", 30, 0, 1, { px: -10, py: 0 });
    const enemies = row(3, 0);
    const r = clash([p], enemies);
    expect(r.clashes).toBe(1);
    expect(p.alive).toBe(false);
    expect(enemies.filter((e) => !e.alive)).toHaveLength(1);
  });

  it("a cannon slug (3 HP) survives two clashes and is spent on the third", () => {
    const p = bullet("p", 100, 0, 3, { radius: 6, px: -10, py: 0 });
    const enemies = row(5, 0);
    const r = clash([p], enemies);
    expect(r.clashes).toBe(3);
    expect(p.alive).toBe(false);
    expect(enemies.filter((e) => !e.alive)).toHaveLength(3);
  });

  it("a nuke (11 HP) clears ten bullets and keeps going", () => {
    const p = bullet("p", 200, 0, 11, { radius: 12, px: -20, py: 0 });
    const enemies = row(10, 0, 20);
    const r = clash([p], enemies);
    expect(r.clashes).toBe(10);
    expect(p.alive).toBe(true);
    expect(p.hp).toBe(1);
  });

  it("ignores spent and dead bullets", () => {
    const enemies = row(2, 0);
    enemies[0].alive = false;
    const dead = bullet("dead", 0, 0, 5);
    dead.alive = false;
    const spent = bullet("spent", 0, 0, 0);
    const r = clash([dead, spent, bullet("p", 10, 0, 1)], enemies);
    expect(r.pairs).toEqual(["p:e1"]);
  });

  it("stays near-linear: the broad phase tests only nearby pairs", () => {
    const enemies: TestBullet[] = [];
    for (let i = 0; i < 2000; i++) enemies.push(bullet(`e${i}`, (i * 37) % 1280, (i * 53) % 720, 1, { px: (i * 37) % 1280 - 2, py: (i * 53) % 720 }));
    const players: TestBullet[] = [];
    for (let i = 0; i < 300; i++) players.push(bullet(`p${i}`, (i * 101) % 1280, (i * 67) % 720, 1, { px: (i * 101) % 1280 - 7, py: (i * 67) % 720 }));
    const r = clash(players, enemies);
    // Brute force would run 600 000 tests.
    expect(r.checks).toBeLessThan(15000);
    expect(r.clashes).toBeLessThanOrEqual(players.length);
  });

  it("does nothing without bullets on either side", () => {
    expect(clash([], row(3, 0)).checks).toBe(0);
    expect(clash([bullet("p", 0, 0, 1)], []).checks).toBe(0);
  });
});
