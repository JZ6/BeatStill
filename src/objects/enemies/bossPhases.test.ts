import { describe, expect, it } from "vitest";
import { BossPhases, GridTimer } from "./bossPhases";

const sentinel = () => new BossPhases({ thresholds: [2 / 3, 1 / 3], transitionBeats: 2, shieldWhilePending: true });
const phantom = () => new BossPhases({ thresholds: [0.675, 0.325], transitionBeats: 0, shieldWhilePending: false });

describe("BossPhases", () => {
  it("derives phases from max-hp fractions", () => {
    const p = sentinel();
    expect([30, 21, 20, 11, 10, 1].map((hp) => p.phaseFor(hp, 30))).toEqual([1, 1, 2, 2, 3, 3]);
    const q = phantom();
    expect([40, 28, 27, 14, 13].map((hp) => q.phaseFor(hp, 40))).toEqual([1, 1, 2, 2, 3]);
    expect(q.phaseFor(5, 0)).toBe(1);
  });

  it("queues a phase and switches only on the next bar line", () => {
    const p = sentinel();
    p.onStep(5, false);
    expect(p.onHp(19, 30)).toBe(true);
    expect(p.phase).toBe(1);
    expect(p.pending).toBe(2);
    for (let s = 6; s < 16; s++) expect(p.onStep(s, s % 16 === 0)).toBe(0);
    expect(p.onStep(16, true)).toBe(2);
    expect(p.phase).toBe(2);
    expect(p.pending).toBe(0);
  });

  it("holds a transition for its beats after the bar line, invulnerable the whole time", () => {
    const p = sentinel();
    p.onStep(3, false);
    p.onHp(15, 30);
    expect(p.invulnerable).toBe(true); // shielded while pending
    expect(p.transitioning).toBe(false); // still playing the old section
    p.onStep(16, true);
    for (let s = 16; s < 24; s++) {
      p.onStep(s, false);
      expect(p.transitioning, `step ${s}`).toBe(true);
      expect(p.invulnerable).toBe(true);
    }
    p.onStep(24, false); // 2 beats = 8 steps later
    expect(p.transitioning).toBe(false);
    expect(p.invulnerable).toBe(false);
  });

  it("lets one big hit queue a later phase, never an earlier one", () => {
    const p = sentinel();
    p.onHp(19, 30);
    expect(p.onHp(5, 30)).toBe(true);
    expect(p.pending).toBe(3);
    expect(p.onHp(15, 30)).toBe(false);
    p.onStep(32, true);
    expect(p.phase).toBe(3);
    expect(p.onHp(1, 30)).toBe(false);
    expect(p.onStep(48, true)).toBe(0);
  });

  it("without a transition or pending shield stays vulnerable", () => {
    const p = phantom();
    p.onHp(20, 40);
    expect(p.invulnerable).toBe(false);
    expect(p.onStep(0, true)).toBe(2);
    expect(p.transitioning).toBe(false);
    expect(p.invulnerable).toBe(false);
  });
});

describe("GridTimer", () => {
  it("comes due on the first grid line at least minSteps away", () => {
    const t = new GridTimer();
    expect(t.next).toBe(Infinity);
    expect(t.due(0, true)).toBe(false);
    t.schedule(5, 20, 16); // ≥ step 25 → bar line 32
    expect(t.next).toBe(32);
    t.schedule(16, 32, 16); // on a bar line: exactly two bars later
    expect(t.next).toBe(48);
    t.schedule(13, 32, 4); // 8 beats from mid-beat → beat line 48
    expect(t.next).toBe(48);
  });

  it("is due only on grid lines at or after its step, until rescheduled or stopped", () => {
    const t = new GridTimer();
    t.schedule(0, 8, 4);
    expect(t.due(7, false)).toBe(false);
    expect(t.due(8, false)).toBe(false);
    expect(t.due(8, true)).toBe(true);
    expect(t.due(12, true)).toBe(true);
    t.stop();
    expect(t.due(12, true)).toBe(false);
  });

  it("scheduleNoLater only ever brings the timer forward", () => {
    const t = new GridTimer();
    t.schedule(0, 32, 4);
    t.scheduleNoLater(10, 16, 4); // 28 < 32
    expect(t.next).toBe(28);
    t.scheduleNoLater(10, 32, 4); // 44 > 28: unchanged
    expect(t.next).toBe(28);
    t.stop();
    t.scheduleNoLater(0, 4, 4);
    expect(t.next).toBe(4);
  });
});
