import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_MUTATORS, MutatorSystem } from "./WaveMutators";

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
