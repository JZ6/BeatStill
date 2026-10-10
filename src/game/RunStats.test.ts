import { describe, expect, it } from "vitest";
import { TimeDilation } from "../core/TimeDilation";
import { FREEZE_THRESHOLD, RunStats } from "./RunStats";

describe("RunStats", () => {
  it("accumulates REAL seconds while the time scale is below the freeze threshold", () => {
    const r = new RunStats();
    r.trackFreeze(0.03, 0.5);
    r.trackFreeze(FREEZE_THRESHOLD - 0.001, 0.25);
    expect(r.freezeTime).toBeCloseTo(0.75, 12);
  });

  it("does not accumulate at or above the threshold, or on empty frames", () => {
    const r = new RunStats();
    r.trackFreeze(FREEZE_THRESHOLD, 1);
    r.trackFreeze(1, 1);
    r.trackFreeze(0.03, 0);
    r.trackFreeze(0.03, -1);
    expect(r.freezeTime).toBe(0);
  });

  it("counts real time, not game time, for an idle player", () => {
    const r = new RunStats();
    const d = new TimeDilation();
    const idle = { move: 0, aimSpeed: 0, firing: false };
    for (let i = 0; i < 60; i++) r.trackFreeze(d.update(idle, 1 / 60), 1 / 60);
    expect(r.freezeTime).toBeCloseTo(1, 9);
  });

  it("tracks damage overall and per boss fight", () => {
    const r = new RunStats();
    r.recordDamage();
    r.startBossFight();
    r.recordDamage();
    r.recordDamage();
    expect(r.damageTaken).toBe(3);
    expect(r.bossFightDamageTaken).toBe(2);
  });

  it("counts kills", () => {
    const r = new RunStats();
    r.recordKill();
    r.recordKill();
    expect(r.kills).toBe(2);
  });
});
