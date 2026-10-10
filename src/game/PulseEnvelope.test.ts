import { describe, expect, it } from "vitest";
import { Conductor, type TickEvent } from "../core/Conductor";
import { PULSE_BAR, PULSE_BEAT, PULSE_DECAY_RATE, PulseEnvelope, pulseStrength } from "./PulseEnvelope";

function firstBarTicks(): TickEvent[] {
  const c = new Conductor({ bpm: 120 });
  const ticks: TickEvent[] = [];
  for (let i = 0; i < 40; i++) ticks.push(...c.advance(0.05).ticks); // 2 s = 4 beats
  return ticks;
}

describe("pulseStrength", () => {
  it("flashes strongest on bar downbeats, lighter on beats, and not between beats", () => {
    const ticks = firstBarTicks();
    const strengths = ticks.map(pulseStrength);
    expect(strengths[0]).toBe(PULSE_BAR); // tick 0 is a downbeat
    expect(strengths[24]).toBe(PULSE_BEAT);
    expect(strengths[96]).toBe(PULSE_BAR); // bar 2
    expect(strengths.filter((s) => s > 0)).toHaveLength(5); // beats 0..4
    expect(PULSE_BEAT).toBeLessThan(PULSE_BAR);
  });
});

describe("PulseEnvelope", () => {
  it("jumps to the trigger strength and decays exponentially in real time", () => {
    const env = new PulseEnvelope();
    env.trigger(1);
    expect(env.level).toBe(1);
    expect(env.update(0.1)).toBeCloseTo(Math.exp(-PULSE_DECAY_RATE * 0.1), 9);
  });

  it("is frame-rate independent", () => {
    const a = new PulseEnvelope();
    const b = new PulseEnvelope();
    a.trigger(1);
    b.trigger(1);
    a.update(0.2);
    for (let i = 0; i < 20; i++) b.update(0.01);
    expect(b.level).toBeCloseTo(a.level, 9);
  });

  it("a weaker trigger never cuts a stronger flash short", () => {
    const env = new PulseEnvelope();
    env.trigger(1);
    env.trigger(0.5);
    expect(env.level).toBe(1);
  });

  it("snaps to exactly 0 below the floor and clamps triggers to 0..1", () => {
    const env = new PulseEnvelope();
    env.trigger(5);
    expect(env.level).toBe(1);
    env.update(2);
    expect(env.level).toBe(0);
    env.trigger(-1);
    expect(env.level).toBe(0);
  });

  it("does not decay on a zero or negative frame", () => {
    const env = new PulseEnvelope();
    env.trigger(0.7);
    env.update(0);
    env.update(-1);
    expect(env.level).toBe(0.7);
  });
});
