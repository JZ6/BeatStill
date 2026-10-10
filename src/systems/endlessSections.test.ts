import { describe, expect, it } from "vitest";
import {
  BOSS_WARNING_BARS,
  MAX_LIVE_ENEMIES,
  MAX_WAVE_ENEMIES,
  OPENING_SHARE,
  SECTION_BARS,
  SectionPlan,
  asteroidBars,
  asteroidCount,
  bossForWave,
  groupSize,
  isBossWave,
  liveEnemyCap,
  sectionQuota,
  sectionShare,
  waveBudget,
} from "./endlessSections";

describe("budgets and caps", () => {
  it("budgets 40 + 12·wave (more than the old 32 + 10·wave), scaled by mutators, capped at 150", () => {
    expect(waveBudget(1)).toBe(52);
    expect(waveBudget(6)).toBe(112);
    expect(waveBudget(4, 1.5)).toBe(132);
    expect(waveBudget(6, 1.5)).toBe(MAX_WAVE_ENEMIES);
    expect(waveBudget(9)).toBe(148);
    expect(waveBudget(10)).toBe(MAX_WAVE_ENEMIES);
    expect(waveBudget(40, 1.5)).toBe(MAX_WAVE_ENEMIES);
    expect(waveBudget(3, Number.NaN)).toBe(76);
    for (let w = 1; w <= 20; w++) expect(waveBudget(w)).toBeGreaterThanOrEqual(Math.min(150, 32 + 10 * w));
  });

  it("caps live enemies at 30 + 2·wave, at most 80", () => {
    expect(liveEnemyCap(1)).toBe(32);
    expect(liveEnemyCap(10)).toBe(50);
    expect(liveEnemyCap(25)).toBe(80);
    expect(liveEnemyCap(99)).toBe(MAX_LIVE_ENEMIES);
  });

  it("boss waves: Sentinel on 5, 15 …, Phantom on 10, 20 …", () => {
    expect([1, 4, 5, 6, 10, 15, 20].filter(isBossWave)).toEqual([5, 10, 15, 20]);
    expect(bossForWave(5)).toBe("sentinel");
    expect(bossForWave(10)).toBe("phantom");
    expect(bossForWave(15)).toBe("sentinel");
  });
});

describe("front-loaded section quota", () => {
  it("opens with a big entrance, then shares rise to 1 by the last bar, heaviest first", () => {
    const shares = Array.from({ length: SECTION_BARS }, (_, i) => sectionShare(i));
    expect(shares[0]).toBeCloseTo(OPENING_SHARE);
    expect(shares[1]).toBeCloseTo(0.4 + 0.6 * (7 / 28));
    expect(shares[2]).toBeCloseTo(0.4 + 0.6 * (13 / 28));
    expect(shares[SECTION_BARS - 1]).toBe(1);
    expect(sectionShare(-1)).toBe(0);
    expect(sectionShare(20)).toBe(1);
    const groups = shares.map((s, i) => s - (i > 0 ? shares[i - 1] : 0));
    for (let i = 1; i < groups.length; i++) expect(groups[i]).toBeLessThan(groups[i - 1]);
  });

  it("splits wave 1's 52 enemies into groups on all 8 downbeats", () => {
    const quotas = Array.from({ length: SECTION_BARS }, (_, i) => sectionQuota(52, i));
    expect(quotas).toEqual([21, 29, 36, 41, 46, 49, 51, 52]);
  });

  it("handles one-bar sections", () => {
    expect(sectionShare(0, 1)).toBe(1);
    expect(sectionQuota(10, 0, 1)).toBe(10);
  });
});

describe("groupSize", () => {
  it("spawns what the quota owes when there is room", () => {
    expect(groupSize({ total: 52, spawned: 0, barIndex: 0, live: 0, cap: 32 })).toBe(21);
    expect(groupSize({ total: 52, spawned: 21, barIndex: 1, live: 4, cap: 32 })).toBe(8);
  });

  it("defers to the next bar at the cap and carries the remainder", () => {
    expect(groupSize({ total: 150, spawned: 34, barIndex: 1, live: 50, cap: 50 })).toBe(0);
    expect(groupSize({ total: 150, spawned: 34, barIndex: 1, live: 45, cap: 50 })).toBe(5);
    // Next bar owes its own group plus the deferred one.
    expect(groupSize({ total: 150, spawned: 39, barIndex: 2, live: 0, cap: 80 })).toBe(sectionQuota(150, 2) - 39);
  });

  it("keeps spawning the remainder after the section's last bar", () => {
    expect(groupSize({ total: 42, spawned: 40, barIndex: 9, live: 0, cap: 32 })).toBe(2);
    expect(groupSize({ total: 42, spawned: 42, barIndex: 9, live: 0, cap: 32 })).toBe(0);
  });
});

describe("asteroids", () => {
  it("spreads the per-wave asteroids across the section", () => {
    expect(asteroidCount(1)).toBe(1);
    expect(asteroidCount(6)).toBe(4);
    expect(asteroidBars(1)).toEqual([0]);
    expect(asteroidBars(3)).toEqual([0, 2, 5]);
    expect(asteroidBars(4)).toEqual([0, 2, 4, 6]);
    for (const n of [1, 5, 8, 13]) {
      const bars = asteroidBars(n);
      expect(bars).toHaveLength(n);
      expect(Math.max(...bars)).toBeLessThan(SECTION_BARS);
    }
  });
});

/**
 * Plays `bars` bars of a section from section bar `from`; `kill(live, bar)` returns how many die
 * before each downbeat. `live` starts at `startLive`.
 */
function simulate(
  plan: SectionPlan,
  bars: number,
  kill: (live: number, bar: number) => number,
  { countMult = 1, from = 0, startLive = 0 } = {},
) {
  let live = startLive;
  const groups: number[] = [];
  let asteroids = 0;
  for (let b = plan.startBar + from; b < plan.startBar + from + bars; b++) {
    live -= Math.min(live, kill(live, b));
    const s = plan.onBar(b, live, countMult);
    groups.push(s.enemies);
    asteroids += s.asteroids;
    live += s.enemies;
    expect(live).toBeLessThanOrEqual(liveEnemyCap(plan.wave));
  }
  return { groups, asteroids, live };
}

describe("SectionPlan", () => {
  it("spawns the whole budget on downbeats across 8 bars when the player keeps up", () => {
    const plan = new SectionPlan(1, 4);
    const { groups, asteroids } = simulate(plan, SECTION_BARS, (live) => live);
    expect(groups).toEqual([21, 8, 7, 5, 5, 3, 2, 1]);
    expect(groups.reduce((a, b) => a + b, 0)).toBe(52);
    expect(asteroids).toBe(asteroidCount(1));
    expect(plan.isSpent()).toBe(true);
  });

  it("keeps early waves busy: ≥ 16 enemies on the first downbeat, the live cap filled by bar 3 if nobody dies", () => {
    for (let wave = 1; wave <= 4; wave++) {
      expect(new SectionPlan(wave, 0).onBar(0, 0).enemies, `wave ${wave}`).toBeGreaterThanOrEqual(16);
      const { live } = simulate(new SectionPlan(wave, 0), 3, () => 0);
      expect(live, `wave ${wave}`).toBe(liveEnemyCap(wave));
    }
  });

  it("does nothing before its start bar", () => {
    const plan = new SectionPlan(1, 4);
    expect(plan.onBar(3, 0)).toEqual({ enemies: 0, asteroids: 0, boss: null });
    expect(plan.spawned).toBe(0);
  });

  it("never exceeds the live cap and defers the rest until there is room", () => {
    const plan = new SectionPlan(14, 0); // 150 enemies, cap 58
    const nobodyDies = simulate(plan, SECTION_BARS, () => 0);
    expect(nobodyDies.live).toBe(liveEnemyCap(14));
    expect(nobodyDies.groups.slice(2).every((g) => g === 0)).toBe(true);
    expect(plan.isSpent()).toBe(false);
    // The field clears after the section's 8 bars: the deferred enemies come on the next downbeats.
    const rest = simulate(plan, 3, (live) => live, { from: SECTION_BARS, startLive: nobodyDies.live });
    expect(rest.groups).toEqual([58, 34, 0]);
    expect(plan.spawned).toBe(150);
    expect(plan.isSpent()).toBe(true);
  });

  it("follows a budget that grows mid-section (a count mutator activating)", () => {
    const plan = new SectionPlan(2, 0); // 52
    simulate(plan, 4, (live) => live);
    simulate(plan, SECTION_BARS, (live) => live, { countMult: 1.5, from: 4 });
    expect(plan.spawned).toBe(waveBudget(2, 1.5));
    expect(plan.isSpent(1.5)).toBe(true);
  });

  it("boss waves warn for two bars, then the boss arrives on the downbeat, once", () => {
    const plan = new SectionPlan(10, 7);
    expect(plan.boss).toBe("phantom");
    const spawns = Array.from({ length: 6 }, (_, i) => plan.onBar(7 + i, 0));
    expect(spawns.map((s) => s.boss)).toEqual([null, null, "phantom", null, null, null]);
    expect(spawns.every((s) => s.enemies === 0 && s.asteroids === 0)).toBe(true);
    expect(BOSS_WARNING_BARS).toBe(2);
  });

  it("a boss section is spent once the boss has spawned", () => {
    const plan = new SectionPlan(5, 0);
    plan.onBar(0, 0);
    plan.onBar(1, 0);
    expect(plan.isSpent()).toBe(false);
    plan.onBar(2, 0);
    expect(plan.isSpent()).toBe(true);
  });
});
