import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALL_MUTATORS,
  MAX_KEY_OFFSET,
  MODULATION_STEP,
  MUTATOR_PHRASE_BARS,
  MutatorSystem,
  isMutatorWave,
  nextKeyOffset,
} from "./WaveMutators";

describe("isMutatorWave", () => {
  it("rolls on wave 6 and every 5 waves after", () => {
    const waves = Array.from({ length: 40 }, (_, i) => i + 1).filter(isMutatorWave);
    expect(waves).toEqual([6, 11, 16, 21, 26, 31, 36]);
  });
});

function byId(id: string) {
  const m = ALL_MUTATORS.find((x) => x.id === id);
  if (!m) throw new Error(`missing mutator ${id}`);
  return m;
}

// Every mutator rollMutator() can return, by sweeping Math.random across [0, 1).
function rollableIds(system: MutatorSystem): Set<string | null> {
  const ids = new Set<string | null>();
  const spy = vi.spyOn(Math, "random");
  for (let i = 0; i < 100; i++) {
    spy.mockReturnValue(i / 100);
    ids.add(system.rollMutator()?.id ?? null);
  }
  spy.mockRestore();
  return ids;
}

describe("MutatorSystem.rollMutator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("can roll every mutator when none are active", () => {
    expect(rollableIds(new MutatorSystem())).toEqual(new Set(ALL_MUTATORS.map((m) => m.id)));
  });

  it("never rolls an already active mutator", () => {
    const system = new MutatorSystem();
    system.addMutator(byId("double_time"));
    expect(rollableIds(system).has("double_time")).toBe(false);
  });

  it("never rolls armored while fragile is active", () => {
    const system = new MutatorSystem();
    system.addMutator(byId("fragile"));
    const ids = rollableIds(system);
    expect(ids.has("armored")).toBe(false);
    expect(ids.has("fragile")).toBe(false);
    expect(ids.has("double_time")).toBe(true);
  });

  it("never rolls fragile while armored is active", () => {
    const system = new MutatorSystem();
    system.addMutator(byId("armored"));
    const ids = rollableIds(system);
    expect(ids.has("fragile")).toBe(false);
    expect(ids.has("armored")).toBe(false);
  });

  it("returns null once every compatible mutator is active", () => {
    const system = new MutatorSystem();
    for (const id of ["double_time", "bullet_storm", "swarm_tide", "fragile"]) system.addMutator(byId(id));
    expect(system.rollMutator()).toBeNull();
  });

  it("keeps the existing mutator ids", () => {
    expect(ALL_MUTATORS.map((m) => m.id)).toEqual(["double_time", "bullet_storm", "swarm_tide", "fragile", "armored"]);
  });
});

describe("MutatorSystem.getActiveParams", () => {
  it("starts neutral", () => {
    expect(new MutatorSystem().getActiveParams()).toEqual({
      tempoMult: 1,
      enemySpeedMult: 1,
      enemyRhythmDensity: 1,
      enemyCountMult: 1,
      enemyHpMult: 1,
    });
  });

  it("bullet_storm doubles the enemy rhythm density and nothing else", () => {
    const system = new MutatorSystem();
    system.addMutator(byId("bullet_storm"));
    expect(system.getActiveParams()).toEqual({
      tempoMult: 1,
      enemySpeedMult: 1,
      enemyRhythmDensity: 2,
      enemyCountMult: 1,
      enemyHpMult: 1,
    });
    expect(byId("bullet_storm").description).toBe("Enemies fire twice as fast");
  });

  it("double_time is musical: tempo ×1.2 and enemy speed ×1.25", () => {
    const system = new MutatorSystem();
    system.addMutator(byId("double_time"));
    const p = system.getActiveParams();
    expect(p.tempoMult).toBeCloseTo(1.2);
    expect(p.enemySpeedMult).toBeCloseTo(1.25);
    expect(p.enemyRhythmDensity).toBe(1);
    expect(byId("double_time").description).toMatch(/tempo ×1\.2/i);
  });

  it("combines mutators", () => {
    const system = new MutatorSystem();
    for (const id of ["double_time", "bullet_storm", "swarm_tide", "armored"]) system.addMutator(byId(id));
    expect(system.getActiveParams()).toEqual({
      tempoMult: 1.2,
      enemySpeedMult: 1.25,
      enemyRhythmDensity: 2,
      enemyCountMult: 1.5,
      enemyHpMult: 1.5,
    });
  });
});

describe("phrase-aligned activation", () => {
  it("a queued mutator does nothing until its tick, then activates once", () => {
    const system = new MutatorSystem();
    system.queueMutator(byId("swarm_tide"), 384);
    expect(system.getActiveParams().enemyCountMult).toBe(1);
    expect(system.activateDue(383)).toEqual([]);
    expect(system.getQueued().map((q) => [q.mutator.id, q.tick])).toEqual([["swarm_tide", 384]]);
    expect(system.activateDue(384).map((m) => m.id)).toEqual(["swarm_tide"]);
    expect(system.getActiveParams().enemyCountMult).toBe(1.5);
    expect(system.activateDue(480)).toEqual([]);
    expect(system.getQueued()).toEqual([]);
    expect(system.getActive().map((m) => m.id)).toEqual(["swarm_tide"]);
  });

  it("activates a mutator whose tick has already passed (never skipped)", () => {
    const system = new MutatorSystem();
    system.queueMutator(byId("fragile"), 96);
    expect(system.activateDue(100).map((m) => m.id)).toEqual(["fragile"]);
  });

  it("never rolls a queued mutator or one exclusive with it", () => {
    const system = new MutatorSystem();
    system.queueMutator(byId("fragile"), 384);
    const ids = rollableIds(system);
    expect(ids.has("fragile")).toBe(false);
    expect(ids.has("armored")).toBe(false);
    expect(ids.has("swarm_tide")).toBe(true);
  });

  it("reset clears active and queued mutators", () => {
    const system = new MutatorSystem();
    system.addMutator(byId("armored"));
    system.queueMutator(byId("double_time"), 96);
    system.reset();
    expect(system.getActive()).toEqual([]);
    expect(system.getQueued()).toEqual([]);
    expect(system.activateDue(1000)).toEqual([]);
  });
});

describe("nextKeyOffset", () => {
  it("rises a whole step from home", () => {
    expect(nextKeyOffset(0)).toBe(2);
    expect(nextKeyOffset(2)).toBe(4);
    expect(MODULATION_STEP).toBe(2);
  });

  it("wraps so the key stays within ±5 semitones of home", () => {
    const seen: number[] = [];
    let k = 0;
    for (let i = 0; i < 40; i++) {
      k = nextKeyOffset(k);
      seen.push(k);
      expect(Math.abs(k)).toBeLessThanOrEqual(MAX_KEY_OFFSET);
    }
    expect(seen.slice(0, 11)).toEqual([2, 4, -5, -3, -1, 1, 3, 5, -4, -2, 0]);
  });

  it("always moves the key up: a whole step, or a minor third at a wrap", () => {
    let k = 0;
    for (let i = 0; i < 22; i++) {
      const next = nextKeyOffset(k);
      const rise = (((next - k) % 12) + 12) % 12;
      expect([2, 3]).toContain(rise);
      k = next;
    }
  });

  it("brings an out-of-range offset back into range", () => {
    expect(Math.abs(nextKeyOffset(9))).toBeLessThanOrEqual(MAX_KEY_OFFSET);
    expect(Math.abs(nextKeyOffset(-30))).toBeLessThanOrEqual(MAX_KEY_OFFSET);
    expect(MUTATOR_PHRASE_BARS).toBe(4);
  });
});
