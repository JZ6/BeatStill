import { describe, expect, it } from "vitest";
import { Conductor } from "../core/Conductor";
import { BASE_FIRE_GRACE, FireClock, type FireShot } from "./FireClock";

/** 120 bpm at full speed: 48 ticks per real second, a tick ≈ 20.8 ms. */
const BPM = 120;
const TICK_S = 60 / BPM / 24;

interface Frame {
  held: boolean;
  /** Real seconds. */
  dt: number;
  /** Time scale (default 1). */
  ts?: number;
  interval?: number;
  grace?: number;
}

type Logged = FireShot & { pos: number };

/** Drives a FireClock with a real Conductor the way the game does each frame. */
function simulate(frames: Frame[], interval = 12, clock = new FireClock(), conductor = new Conductor({ bpm: BPM })): Logged[] {
  const shots: Logged[] = [];
  for (const f of frames) {
    conductor.timeScale = f.ts ?? 1;
    const { ticks, realDt } = conductor.advance(f.dt);
    clock.beginFrame(f.held, f.interval ?? interval, realDt);
    for (const t of ticks) {
      const shot = clock.onTick(t);
      if (shot) shots.push({ ...shot, pos: conductor.tickPosition });
    }
    const shot = clock.endFrame(conductor, f.grace ?? BASE_FIRE_GRACE);
    if (shot) shots.push({ ...shot, pos: conductor.tickPosition });
  }
  return shots;
}

/** `seconds` of frames at 60 fps (the last one shorter so the total is exact). */
function frames(seconds: number, held: boolean, extra: Omit<Frame, "held" | "dt"> = {}): Frame[] {
  const out: Frame[] = [];
  let left = seconds;
  while (left > 1e-12) {
    const dt = Math.min(1 / 60, left);
    out.push({ held, dt, ...extra });
    left -= dt;
  }
  return out;
}

/** Idle (not held) 60 fps frames that move the conductor to `tick` + `past` ticks at full speed. */
const idleTo = (tick: number, past = 0): Frame[] => frames((tick + past) * TICK_S, false);

describe("FireClock grid", () => {
  it("fires on every multiple of the interval while held, carrying tick and lateBy", () => {
    const shots = simulate(frames(2.01, true));
    expect(shots.length).toBeGreaterThanOrEqual(9);
    expect(shots.map((s) => s.tick)).toEqual(shots.map((_, i) => 12 * i));
    expect(shots.every((s) => s.kind === "grid")).toBe(true);
    expect(shots.map((s) => s.first)).toEqual(shots.map((_, i) => i === 0));
    for (const s of shots) {
      expect(s.lateBy).toBeGreaterThanOrEqual(0);
      expect(s.lateBy).toBeLessThanOrEqual(1 / 60 + 1e-9);
    }
  });

  it("reports several boundaries crossed in one long frame, each with its own lateBy", () => {
    const shots = simulate([{ held: true, dt: 0.1 }], 3); // 4.8 ticks
    expect(shots.map((s) => s.tick)).toEqual([0, 3]);
    expect(shots[0].lateBy).toBeCloseTo(4.8 * TICK_S, 9);
    expect(shots[1].lateBy).toBeCloseTo(1.8 * TICK_S, 9);
  });

  it("switches to the new grid when the interval changes mid-hold", () => {
    const shots = simulate([...frames(30 * TICK_S, true, { interval: 12 }), ...frames(20 * TICK_S, true, { interval: 8 })]);
    expect(shots.map((s) => s.tick)).toEqual([0, 12, 24, 32, 40, 48]);
  });

  it("stays silent while fire is not held", () => {
    expect(simulate(frames(2, false))).toEqual([]);
  });
});

describe("FireClock first shot", () => {
  it("fires at once on a press just after an unused boundary (late grace)", () => {
    // Boundary 12 passed 0.5 tick (≈ 10 ms) ago.
    const shots = simulate([...idleTo(12, 0.5), { held: true, dt: 0.005 }, ...frames(0.3, true)]);
    expect(shots[0]).toMatchObject({ kind: "immediate", first: true });
    expect(shots[0].tick).toBeUndefined();
    expect(shots.slice(1).map((s) => s.tick)).toEqual([24]);
    expect(shots[1]).toMatchObject({ kind: "grid", first: false });
  });

  it("Quick Draw's wider grace catches later presses", () => {
    // 4 ticks ≈ 83 ms after the boundary: outside the base 60 ms, inside 60 + 40 ms.
    const late = [...idleTo(12, 4), { held: true, dt: 0.002 }];
    expect(simulate(late)).toEqual([]);
    expect(simulate(late.map((f) => ({ ...f, grace: BASE_FIRE_GRACE + 0.04 })))[0]).toMatchObject({ kind: "immediate" });
  });

  it("waits for the next boundary when it is close, then fires on the grid", () => {
    // 9 ticks (≈ 190 ms) after boundary 12: the next one is 3 ticks (≈ 63 ms) away.
    const shots = simulate([...idleTo(12, 9), { held: true, dt: 0.001 }, ...frames(0.4, true)]);
    expect(shots[0]).toMatchObject({ kind: "grid", first: true, tick: 24 });
    expect(shots[1]).toMatchObject({ kind: "grid", first: false, tick: 36 });
  });

  it("falls back to the next 16th when the weapon's grid is too far away", () => {
    // A 1/4 weapon, 4 ticks after beat 1: beat 2 is 20 ticks (≈ 417 ms) away, the 16th only 2.
    const shots = simulate([...idleTo(24, 4), { held: true, dt: 0.001 }, ...frames(0.5, true)], 24);
    expect(shots[0]).toMatchObject({ kind: "step", first: true, tick: 30 });
    expect(shots[1]).toMatchObject({ kind: "grid", first: false, tick: 48 });
  });

  it("fires immediately in deep slow motion when even the next 16th is far", () => {
    // ts 0.05: a tick is ≈ 417 ms. Pressed 4 ticks after a boundary: the 16th is 2 ticks away.
    const shots = simulate([...frames(4 * TICK_S * 20, false, { ts: 0.05 }), { held: true, dt: 0.001, ts: 0.05 }]);
    expect(shots).toEqual([expect.objectContaining({ kind: "immediate", first: true })]);
  });

  it("lets a used slot hold no second shot: a re-press waits for the next boundary", () => {
    const shots = simulate(
      [
        ...idleTo(24, 0.5),
        { held: true, dt: 0.002 }, // late grace: immediate
        { held: false, dt: 0.005 },
        { held: true, dt: 0.005 }, // same slot, still inside the grace window
        ...frames(26 * TICK_S, true),
      ],
      24,
    );
    expect(shots.map((s) => [s.kind, s.tick ?? null, s.first])).toEqual([
      ["immediate", null, true],
      ["grid", 48, true],
    ]);
  });

  it("cancels a waiting first shot on release", () => {
    const shots = simulate([...idleTo(12, 9), { held: true, dt: 0.001 }, { held: false, dt: 0.01 }, ...frames(0.1, false)]);
    expect(shots).toEqual([]);
  });

  it("skips a boundary closer than half an interval to an immediate first shot", () => {
    // Grace 0.2 s: pressed 8 ticks (≈ 167 ms) after boundary 12, so boundary 24 is only 4 ticks on.
    const press: Frame[] = [...idleTo(12, 8), { held: true, dt: 0.001, grace: 0.2 }, ...frames(0.4, true, { grace: 0.2 })];
    const shots = simulate(press);
    expect(shots[0]).toMatchObject({ kind: "immediate" });
    expect(shots.slice(1).map((s) => s.tick)).toEqual([36]);
  });

  it("fires the press frame's own boundary on the grid", () => {
    const shots = simulate([...idleTo(11, 0.9), { held: true, dt: 0.01 }]);
    expect(shots).toEqual([expect.objectContaining({ kind: "grid", first: true, tick: 12 })]);
  });

  it("reset forgets the boundary and any waiting press", () => {
    const clock = new FireClock();
    const conductor = new Conductor({ bpm: BPM });
    simulate([...idleTo(12, 9), { held: true, dt: 0.001 }], 12, clock, conductor);
    expect(clock.waiting).toBe(true);
    clock.reset();
    expect(clock.waiting).toBe(false);
  });
});

describe("FireClock invariants", () => {
  it("never fires twice in one slot, and every later shot of a press is on the grid", () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (const interval of [3, 6, 8, 12, 18, 24, 48]) {
      const list: Frame[] = [];
      let held = false;
      for (let i = 0; i < 3000; i++) {
        if (rand() < 0.08) held = !held;
        list.push({ held, dt: 0.004 + rand() * 0.03, ts: 0.03 + rand() * 0.97, grace: rand() < 0.5 ? 0.06 : 0.18 });
      }
      const shots = simulate(list, interval);
      expect(shots.length, `interval ${interval}`).toBeGreaterThan(20);
      const slots = shots.map((s) => Math.floor((s.tick ?? s.pos) / interval));
      slots.slice(1).forEach((slot, i) => expect(slot, `interval ${interval} shot ${i + 1}`).toBeGreaterThan(slots[i]));
      for (const s of shots.filter((x) => !x.first)) {
        expect(s.kind).toBe("grid");
        expect(s.tick! % interval).toBe(0);
      }
    }
  });
});
