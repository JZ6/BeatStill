import { describe, expect, it } from "vitest";
import { Conductor, type TickEvent } from "../core/Conductor";
import { TickDispatcher } from "./TickDispatcher";

function ticksFor(beats: number, bpm = 120): TickEvent[] {
  const c = new Conductor({ bpm });
  const out: TickEvent[] = [];
  const realDt = 0.05;
  const frames = Math.round((beats * 60) / bpm / realDt);
  for (let i = 0; i < frames; i++) out.push(...c.advance(realDt).ticks);
  return out;
}

describe("TickDispatcher", () => {
  it("delivers every tick to every subscriber, in order", () => {
    const d = new TickDispatcher();
    const a: number[] = [];
    const b: number[] = [];
    d.subscribe((t) => a.push(t.tick));
    d.subscribe((t) => b.push(t.tick));
    const ticks = ticksFor(1);
    d.dispatch(ticks);
    expect(a).toEqual(ticks.map((t) => t.tick));
    expect(b).toEqual(a);
  });

  it("stops delivering after unsubscribe, and unsubscribe is idempotent", () => {
    const d = new TickDispatcher();
    const seen: number[] = [];
    const off = d.subscribe((t) => seen.push(t.tick));
    const ticks = ticksFor(1);
    d.dispatch(ticks.slice(0, 3));
    off();
    off();
    d.dispatch(ticks.slice(3));
    expect(seen).toEqual([0, 1, 2]);
    expect(d.size).toBe(0);
  });

  it("treats the same handler subscribed twice as two subscriptions", () => {
    const d = new TickDispatcher();
    let calls = 0;
    const h = () => calls++;
    const off1 = d.subscribe(h);
    d.subscribe(h);
    off1();
    d.dispatch(ticksFor(1).slice(0, 1));
    expect(calls).toBe(1);
  });

  it("skips a handler unsubscribed mid-dispatch and defers one subscribed mid-dispatch", () => {
    const d = new TickDispatcher();
    const late: number[] = [];
    const victim: number[] = [];
    let offVictim: () => void = () => {};
    d.subscribe((t) => {
      if (t.tick === 1) {
        offVictim();
        d.subscribe((u) => late.push(u.tick));
      }
    });
    offVictim = d.subscribe((t) => victim.push(t.tick));
    const ticks = ticksFor(1);
    d.dispatch(ticks.slice(0, 4));
    expect(victim).toEqual([0]);
    expect(late).toEqual([]);
    d.dispatch(ticks.slice(4, 6));
    expect(late).toEqual([4, 5]);
  });

  it("clear() removes all subscribers", () => {
    const d = new TickDispatcher();
    let calls = 0;
    d.subscribe(() => calls++);
    d.clear();
    d.dispatch(ticksFor(1));
    expect(calls).toBe(0);
  });
});
