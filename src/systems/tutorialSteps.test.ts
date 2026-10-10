import { describe, expect, it } from "vitest";
import {
  FAST_ABOVE,
  MIN_STEP_MS,
  SLOW_BELOW,
  StepGate,
  buildTutorialSteps,
  createLatch,
  goalMet,
  missingKills,
  recordKill,
  recordShot,
  sampleLatch,
  typesToSpawn,
  type TutorialGoal,
} from "./tutorialSteps";

const step = (id: string, mobile = false) => {
  const s = buildTutorialSteps(mobile).find((x) => x.id === id);
  if (!s) throw new Error(`no step ${id}`);
  return s;
};

describe("buildTutorialSteps", () => {
  it("teaches the musical mechanics in order", () => {
    expect(buildTutorialSteps(false).map((s) => s.id)).toEqual(["move", "aim", "fire", "slow", "speed", "instruments", "chain"]);
  });

  it("has desktop and mobile wording for the controls", () => {
    for (const id of ["move", "aim", "fire", "slow", "speed"]) {
      expect(step(id, true).message, id).not.toBe(step(id, false).message);
    }
    expect(step("fire").hint).toMatch(/on the beat/);
    expect(step("slow").hint).toMatch(/heartbeat slows/);
    expect(step("slow").goal).toEqual({ kind: "slow", below: SLOW_BELOW });
    expect(step("speed").goal).toEqual({ kind: "fast", above: FAST_ABOVE });
  });

  it("brings a tank (bass) and a sniper (snare), then a cluster to chain", () => {
    expect(step("instruments").spawn).toEqual(["tank", "sniper"]);
    expect(step("instruments").goal).toEqual({ kind: "kill", types: ["tank", "sniper"] });
    expect(step("chain").goal).toEqual({ kind: "chain", count: 2 });
    expect(step("chain").spawn?.length).toBeGreaterThanOrEqual(2);
    expect(step("chain").spawnHp).toBe(1);
  });

  it("scales the move distance", () => {
    expect(buildTutorialSteps(false, 150)[0].goal).toEqual({ kind: "move", distance: 150 });
  });
});

describe("latched goals", () => {
  it("move: the farthest distance since entry counts, even after coming back", () => {
    const latch = createLatch(100, 100, 0, 0.03);
    const goal: TutorialGoal = { kind: "move", distance: 100 };
    sampleLatch(latch, 150, 100, 0, 0.5);
    expect(goalMet(goal, latch)).toBe(false);
    sampleLatch(latch, 100, 210, 0, 0.5);
    expect(goalMet(goal, latch)).toBe(true);
    sampleLatch(latch, 100, 100, 0, 0.03); // back at the start: still met
    expect(goalMet(goal, latch)).toBe(true);
  });

  it("aim: measured from the rotation at step entry with wrapped deltas", () => {
    const goal: TutorialGoal = { kind: "aim", turn: 0.8 };
    // Not auto-satisfied: entry rotation is whatever the ship has right now.
    const latch = createLatch(0, 0, 2.5, 0.03);
    sampleLatch(latch, 0, 0, 2.5, 0.03);
    expect(goalMet(goal, latch)).toBe(false);
    // Crossing ±π is a small turn, not ~2π.
    sampleLatch(latch, 0, 0, 3.1, 0.03);
    sampleLatch(latch, 0, 0, -3.1, 0.03);
    expect(latch.maxTurn).toBeCloseTo(2 * Math.PI - 5.6, 6);
    expect(goalMet(goal, latch)).toBe(false);
    sampleLatch(latch, 0, 0, -2.9, 0.03);
    expect(goalMet(goal, latch)).toBe(true);
  });

  it("aim: a rotation many turns away still wraps", () => {
    const latch = createLatch(0, 0, 0, 1);
    sampleLatch(latch, 0, 0, 4 * Math.PI + 0.1, 1);
    expect(latch.maxTurn).toBeCloseTo(0.1, 6);
  });

  it("shots: counts every shot since entry", () => {
    const latch = createLatch(0, 0, 0, 1);
    const goal: TutorialGoal = { kind: "shots", count: 4 };
    for (let i = 0; i < 3; i++) recordShot(latch);
    expect(goalMet(goal, latch)).toBe(false);
    recordShot(latch);
    expect(goalMet(goal, latch)).toBe(true);
  });

  it("slow / fast: a dip or a peak between checks is kept", () => {
    const latch = createLatch(0, 0, 0, 0.6);
    sampleLatch(latch, 0, 0, 0, 0.08);
    sampleLatch(latch, 0, 0, 0, 0.7);
    expect(goalMet({ kind: "slow", below: 0.1 }, latch)).toBe(true);
    expect(goalMet({ kind: "fast", above: 0.5 }, latch)).toBe(true);
    const still = createLatch(0, 0, 0, 0.3);
    sampleLatch(still, 0, 0, 0, 0.2);
    expect(goalMet({ kind: "slow", below: 0.1 }, still)).toBe(false);
    expect(goalMet({ kind: "fast", above: 0.5 }, still)).toBe(false);
  });

  it("ignores non-finite samples", () => {
    const latch = createLatch(0, 0, 0, 0.5);
    sampleLatch(latch, NaN, 0, Infinity, NaN);
    expect(latch).toEqual(createLatch(0, 0, 0, 0.5));
  });

  it("kill: needs every listed type; reports the missing ones", () => {
    const goal: TutorialGoal = { kind: "kill", types: ["tank", "sniper"] };
    const latch = createLatch(0, 0, 0, 1);
    recordKill(latch, "basic", 1);
    expect(missingKills(goal, latch)).toEqual(["tank", "sniper"]);
    recordKill(latch, "sniper", 1);
    expect(missingKills(goal, latch)).toEqual(["tank"]);
    expect(goalMet(goal, latch)).toBe(false);
    recordKill(latch, "tank", 2);
    expect(goalMet(goal, latch)).toBe(true);
    expect(missingKills({ kind: "shots", count: 1 }, latch)).toEqual([]);
  });

  it("chain: the highest chain count reached since entry", () => {
    const latch = createLatch(0, 0, 0, 1);
    const goal: TutorialGoal = { kind: "chain", count: 2 };
    recordKill(latch, "basic", 1);
    recordKill(latch, "basic", 1);
    expect(goalMet(goal, latch)).toBe(false);
    recordKill(latch, "basic", 2);
    recordKill(latch, "basic", 1); // the chain broke later: still met
    expect(goalMet(goal, latch)).toBe(true);
  });
});

describe("typesToSpawn", () => {
  it("respawns only the missing types of a kill step", () => {
    const s = step("instruments");
    const latch = createLatch(0, 0, 0, 1);
    expect(typesToSpawn(s, latch)).toEqual(["tank", "sniper"]);
    recordKill(latch, "tank", 1);
    expect(typesToSpawn(s, latch)).toEqual(["sniper"]);
  });

  it("respawns the whole group of a chain step, and nothing for steps without enemies", () => {
    const latch = createLatch(0, 0, 0, 1);
    recordKill(latch, "basic", 1);
    expect(typesToSpawn(step("chain"), latch)).toEqual(step("chain").spawn);
    expect(typesToSpawn(step("move"), latch)).toEqual([]);
  });
});

describe("StepGate", () => {
  it("advances only when the goal is met and the minimum real time has passed", () => {
    const gate = new StepGate();
    expect(gate.minMs).toBe(MIN_STEP_MS);
    expect(gate.update(1000, true)).toBe(false);
    expect(gate.update(1500, false)).toBe(false);
    expect(gate.update(600, false)).toBe(false);
    expect(gate.update(0, true)).toBe(true);
  });

  it("ignores negative and non-finite deltas", () => {
    const gate = new StepGate(100);
    gate.update(-500, true);
    gate.update(NaN, true);
    expect(gate.elapsedMs).toBe(0);
    expect(gate.update(100, true)).toBe(true);
  });
});
