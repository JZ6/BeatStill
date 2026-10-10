import { describe, expect, it } from "vitest";
import { Conductor } from "../core/Conductor";
import type { TickEvent } from "../core/Conductor";
import type { GameEventMap } from "../core/GameEvents";
import { chordFromNumeral } from "./Harmony";
import { ENEMY_ROLES, MIN_STRETCH, MusicDirector, droneLevel, lowpassCutoff, roleForEnemy } from "./MusicDirector";
import type { DirectorClock, NoteRequest } from "./MusicDirector";
import { ALL_PALETTES, getPalette, isPitched } from "./palettes";
import type { InstrumentSpec, Palette, Role } from "./palettes";
import { pitchClass } from "./theory";

const TPB = 96; // ticks per 4/4 bar

class FakeClock implements DirectorClock {
  bpm = 120;
  timeScale = 1;
  beatsPerBar = 4;
  pos = 0;
  get bar() {
    return Math.floor(this.pos / TPB);
  }
  get beatInBar() {
    return (this.pos % TPB) / 24;
  }
  get currentTick() {
    return Math.ceil(this.pos) - 1;
  }
  realSecondsPerTick() {
    return 1 / ((this.bpm / 60) * 24 * this.timeScale);
  }
  realSecondsUntilTick(tick: number) {
    return (tick - this.pos) * this.realSecondsPerTick();
  }
  nextMultiple(interval: number) {
    const i = Math.max(1, Math.floor(interval));
    return (Math.floor(this.pos / i) + 1) * i;
  }
}

function tickEvent(tick: number, lateBy = 0): TickEvent {
  const tickInBar = tick % TPB;
  return {
    tick,
    beat: tick / 24,
    bar: Math.floor(tick / TPB),
    tickInBar,
    isStep: tick % 6 === 0,
    isBeat: tick % 24 === 0,
    isBar: tickInBar === 0,
    lateBy,
  };
}

function setup(palette: Palette = getPalette("theremin"), pos = 0) {
  const clock = new FakeClock();
  clock.pos = pos;
  clock.bpm = palette.bpm;
  return { clock, d: new MusicDirector(palette, clock) };
}

function variant(id: string, changes: Partial<Palette>, roles: Partial<Record<Role, Partial<InstrumentSpec>>> = {}): Palette {
  const p = getPalette(id);
  const instruments = { ...p.instruments };
  for (const role of Object.keys(roles) as Role[]) instruments[role] = { ...p.instruments[role], ...roles[role] };
  return { ...p, ...changes, instruments };
}

const byRole = (reqs: NoteRequest[], role: Role) => reqs.filter((r) => r.role === role);

const killed = (enemyType: GameEventMap["enemyKilled"]["enemyType"], chainTier: number): GameEventMap["enemyKilled"] => ({
  enemyType,
  x: 0,
  y: 0,
  isBoss: false,
  elite: false,
  chainCount: chainTier * 3,
  chainTier,
});
const fired = (enemyType: GameEventMap["enemyFired"]["enemyType"], elite = false): GameEventMap["enemyFired"] => ({
  enemyType,
  x: 0,
  y: 0,
  bulletCount: 3,
  elite,
});
const shot = (bulletCount = 1, weaponId = "standard"): GameEventMap["playerFired"] => ({ weaponId, x: 0, y: 0, angle: 0, bulletCount });
const ENEMY_TYPES = Object.keys(ENEMY_ROLES) as GameEventMap["enemyFired"]["enemyType"][];

describe("pure helpers", () => {
  it("droneLevel rises as time slows", () => {
    expect(droneLevel(1)).toBeCloseTo(0.25);
    expect(droneLevel(0)).toBeCloseTo(1);
    expect(droneLevel(0.5)).toBeCloseTo(0.25 + 0.75 * Math.pow(0.5, 1.5));
    expect(droneLevel(0.03)).toBeGreaterThan(droneLevel(0.3));
    expect(droneLevel(2)).toBeCloseTo(0.25);
    expect(droneLevel(-1)).toBeCloseTo(1);
    expect(droneLevel(Number.NaN)).toBeCloseTo(0.25);
  });

  it("lowpassCutoff maps 0.03..1 exponentially onto ~700..18000 Hz", () => {
    expect(lowpassCutoff(0.03)).toBeCloseTo(700);
    expect(lowpassCutoff(1)).toBeCloseTo(18000);
    expect(lowpassCutoff(0)).toBeCloseTo(700);
    const mid = lowpassCutoff(0.515);
    expect(mid).toBeCloseTo(Math.sqrt(700 * 18000), 0);
    for (let ts = 0.05; ts <= 1; ts += 0.05) expect(lowpassCutoff(ts)).toBeGreaterThan(lowpassCutoff(ts - 0.05));
  });

  it("maps every enemy type to a role", () => {
    expect(ENEMY_ROLES).toEqual({
      basic: "pad",
      tracker: "stab",
      sniper: "snare",
      spiral: "arp",
      tank: "bass",
      swarm: "hat",
      snake: "melody",
      circler: "bell",
      sentinel: "boss",
      phantom: "boss",
      phantom_decoy: "bell",
    });
    expect(roleForEnemy("mystery")).toBe("perc");
  });

  it("accepts a real Conductor as its clock", () => {
    const conductor = new Conductor({ bpm: 100 });
    const d = new MusicDirector(getPalette("theremin"), conductor);
    for (const t of conductor.advance(0.02).ticks) d.onTick(t);
    expect(byRole(d.drain(), "heart")).toHaveLength(1);
  });
});

describe("timing", () => {
  it("snaps event sounds to the next 16th when the wait is short", () => {
    const { clock, d } = setup(getPalette("theremin"), 1); // 5 ticks to the step: 5/40 s at 100 bpm = 0.125 > 0.12
    clock.bpm = 120; // 5/48 s ≈ 0.104 ≤ 0.12
    d.handleEvent("bulletClash", { x: 0, y: 0 });
    const [req] = d.drain();
    expect(req.when).toBeCloseTo(0.05 + 5 / 48, 6);
  });

  it("plays at once when the next 16th is further than maxQuantizeWait", () => {
    const { clock, d } = setup(getPalette("theremin"), 0.1);
    clock.bpm = 120; // 5.9/48 ≈ 0.123 s
    d.handleEvent("bulletClash", { x: 0, y: 0 });
    expect(d.drain()[0].when).toBeCloseTo(0.05, 9);
    clock.pos = 3;
    clock.timeScale = 0.1; // deep slow-mo: 3 ticks ≈ 0.63 s
    d.handleEvent("bulletClash", { x: 0, y: 0 });
    expect(d.drain()[0].when).toBeCloseTo(0.05, 9);
  });

  it("honours custom latency and quantize window", () => {
    const clock = new FakeClock();
    clock.pos = 0.1;
    const d = new MusicDirector(getPalette("synth"), clock, { latency: 0.03, maxQuantizeWait: 0.2 });
    d.handleEvent("bulletClash", { x: 0, y: 0 });
    expect(d.drain()[0].when).toBeCloseTo(0.03 + 5.9 / 48, 6);
  });

  it("never quantizes playerDied, and slows the run down", () => {
    const { clock, d } = setup(getPalette("piano"), 5); // a step is only 1 tick away
    clock.timeScale = 0.2;
    d.handleEvent("playerDied", { x: 0, y: 0 });
    const lead = byRole(d.drain(), "lead");
    expect(lead.length).toBeGreaterThanOrEqual(5);
    expect(lead[0].when).toBeCloseTo(0.05, 9);
    const gaps = lead.slice(1).map((r, i) => r.when - lead[i].when);
    gaps.slice(1).forEach((g, i) => expect(g).toBeGreaterThan(gaps[i]));
    lead.slice(1).forEach((r, i) => expect(r.midi[0]).toBeLessThan(lead[i].midi[0]));
  });

  it("schedules tick sounds at latency − lateBy, never in the past", () => {
    const { d } = setup();
    d.onTick(tickEvent(0, 0.02));
    expect(d.drain()[0].when).toBeCloseTo(0.03);
    d.onTick(tickEvent(TPB, 0.08));
    expect(d.drain()[0].when).toBe(0);
  });

  it("stretches durations with slow-mo, but at most 1/0.35", () => {
    const { clock, d } = setup(getPalette("synth"), 23); // 120 bpm; standard shot = 1/4 beat
    const duration = (ts: number) => {
      clock.timeScale = ts;
      d.handleEvent("playerFired", shot());
      return d.drain()[0].duration;
    };
    expect(duration(1)).toBeCloseTo(0.125);
    expect(duration(0.5)).toBeCloseTo(0.25);
    expect(duration(0.03)).toBeCloseTo(0.125 / MIN_STRETCH);
    expect(duration(0)).toBeCloseTo(0.125 / MIN_STRETCH);
  });
});

describe("aggregation", () => {
  it("merges a crowd of swarm shots on one 16th into one hat request", () => {
    const { d } = setup(getPalette("theremin"), 1.5);
    d.handleEvent("enemyFired", fired("swarm"));
    const [single] = d.drain();
    for (let i = 0; i < 40; i++) d.handleEvent("enemyFired", fired("swarm"));
    const reqs = d.drain();
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toMatchObject({ role: "hat", midi: [] });
    expect(reqs[0].velocity).toBeCloseTo(Math.min(1, single.velocity + 0.12 * Math.log2(40)));
  });

  it("gives a crowd of spirals one shared arp note", () => {
    const { d } = setup(getPalette("bell"), 1.5);
    for (let i = 0; i < 10; i++) d.handleEvent("enemyFired", fired("spiral"));
    const reqs = d.drain();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].midi).toHaveLength(1);
  });

  it("merges only requests within 5 ms", () => {
    const { clock, d } = setup(getPalette("synth"), 1); // 120 bpm: when = 0.05 + (6 − pos)/48
    d.handleEvent("bulletClash", { x: 0, y: 0 });
    clock.pos = 1.2; // 4.2 ms earlier
    d.handleEvent("bulletClash", { x: 0, y: 0 });
    expect(d.drain()).toHaveLength(1);
    clock.pos = 1;
    d.handleEvent("bulletClash", { x: 0, y: 0 });
    clock.pos = 1.5; // 10.4 ms earlier
    d.handleEvent("bulletClash", { x: 0, y: 0 });
    expect(d.drain()).toHaveLength(2);
  });

  it("caps merged notes at the role's maxVoices", () => {
    const { d } = setup(variant("theremin", {}, { pad: { maxVoices: 2 } }), 23);
    d.handleEvent("enemyKilled", killed("basic", 3));
    d.handleEvent("enemyFired", fired("basic"));
    expect(byRole(d.drain(), "pad")[0].midi).toHaveLength(2);
  });

  it("rate-limits wall absorbs to one quiet ghost per 16th", () => {
    const { clock, d } = setup(getPalette("guitar"), 1);
    for (let i = 0; i < 5; i++) d.handleEvent("wallAbsorb", { x: 0, y: 0, owner: "enemy" });
    const reqs = d.drain();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].velocity).toBeLessThanOrEqual(0.15);
    clock.pos = 7;
    d.handleEvent("wallAbsorb", { x: 0, y: 0, owner: "enemy" });
    expect(d.drain()).toHaveLength(1);
  });

  it("drain clears the queue", () => {
    const { d } = setup();
    d.handleEvent("glassShatter", { x: 0, y: 0 });
    expect(d.drain().length).toBeGreaterThan(0);
    expect(d.drain()).toEqual([]);
  });
});

/** Every non-exempt event, with a spread of payloads. */
function fireEverything(d: MusicDirector): void {
  d.handleEvent("playerFired", shot(1));
  d.handleEvent("playerFired", shot(5, "shotgun"));
  for (const t of ENEMY_TYPES) {
    d.handleEvent("enemyFired", fired(t));
    d.handleEvent("enemyFired", fired(t, true));
    d.handleEvent("enemyHit", { enemyType: t, x: 0, y: 0, damage: 1, hpLeft: 1, maxHp: 3 });
    for (let tier = 0; tier <= 5; tier++) d.handleEvent("enemyKilled", killed(t, tier));
  }
  d.handleEvent("chainBreak", { tier: 3, x: 0, y: 0 });
  d.handleEvent("bulletClash", { x: 0, y: 0 });
  for (const size of ["large", "medium", "small"] as const) d.handleEvent("asteroidBreak", { size, x: 0, y: 0 });
  d.handleEvent("wallBounce", { x: 0, y: 0, axis: "x", owner: "player" });
  d.handleEvent("wallBounce", { x: 0, y: 0, axis: "y", owner: "enemy" });
  d.handleEvent("wallAbsorb", { x: 0, y: 0, owner: "player" });
  for (let hp = 0; hp <= 3; hp++) d.handleEvent("glassCrack", { x: 0, y: 0, hp, maxHp: 3 });
  d.handleEvent("glassShatter", { x: 0, y: 0 });
  d.handleEvent("pickupCollected", { x: 0, y: 0, upgradeId: "speed", isWeapon: false });
  d.handleEvent("pickupCollected", { x: 0, y: 0, upgradeId: "laser", isWeapon: true });
  d.handleEvent("waveStarted", { wave: 2, mode: "endless" });
  d.handleEvent("playerDied", { x: 0, y: 0 });
}

describe("harmony", () => {
  it("every pitched note is a chord tone or safe scale tone of the bar it lands in", () => {
    for (const palette of ALL_PALETTES) {
      const { clock, d } = setup(palette);
      for (let bar = 0; bar < 4; bar++) {
        // Strong slot (beat 2), weak slot (an off-beat 16th), and immediate (deep slow-mo).
        for (const [offset, ts] of [[23, 1], [26, 1], [40, 0.05]]) {
          clock.pos = bar * TPB + offset;
          clock.timeScale = ts;
          const chord = d.harmony.chordAtBar(bar);
          if (offset === 23) {
            // On a beat, player shots use chord tones only.
            d.handleEvent("playerFired", shot(5, "shotgun"));
            for (const n of d.drain()[0].midi) expect(chord.pcs, `${palette.id} bar ${bar} strong lead ${n}`).toContain(pitchClass(n));
          }
          fireEverything(d);
          const safe = new Set(d.harmony.safeScaleTones(bar, 0, 127));
          const reqs = d.drain();
          expect(reqs.length).toBeGreaterThan(20);
          for (const r of reqs) {
            const where = `${palette.id} bar ${bar}+${offset} ${r.role}`;
            const spec = palette.instruments[r.role];
            expect(r.when, where).toBeGreaterThanOrEqual(0);
            expect(r.duration, where).toBeGreaterThan(0);
            expect(r.velocity > 0 && r.velocity <= 1, where).toBe(true);
            expect(r.midi.length, where).toBeLessThanOrEqual(spec.maxVoices);
            if (!isPitched(spec)) {
              expect(r.midi, where).toEqual([]);
              continue;
            }
            expect(r.midi.length, where).toBeGreaterThan(0);
            for (const n of r.midi) expect(safe.has(n), `${where} note ${n}`).toBe(true);
          }
        }
      }
    }
  });

  it("walks the lead up and down the chord tones across shots", () => {
    const { clock, d } = setup(variant("theremin", { progression: "i" }));
    const notes: number[] = [];
    for (let k = 1; k <= 11; k++) {
      clock.pos = 24 * k - 1;
      d.handleEvent("playerFired", shot());
      notes.push(d.drain()[0].midi[0]);
    }
    expect(notes).toEqual([64, 67, 71, 76, 79, 83, 79, 76, 71, 67, 64]); // Em in C4–C6
  });

  it("adds chord tones below the lead for spread weapons", () => {
    const { clock, d } = setup(variant("theremin", { progression: "i" }));
    const fire = (k: number, bullets: number) => {
      clock.pos = 24 * k - 1;
      d.handleEvent("playerFired", shot(bullets));
      return d.drain()[0].midi;
    };
    [1, 2].forEach((k) => fire(k, 1)); // E4, G4
    expect(fire(3, 3)).toEqual([67, 71]); // B4 + G4
    expect(fire(4, 5)).toEqual([67, 71, 76]); // E5 + B4 + G4
  });

  it("ascends through chord tones across consecutive pickups", () => {
    const { clock, d } = setup(variant("bell", { progression: "i" }));
    const notes: number[] = [];
    for (let k = 1; k <= 4; k++) {
      clock.pos = 12 * k - 1;
      d.handleEvent("pickupCollected", { x: 0, y: 0, upgradeId: "speed", isWeapon: false });
      notes.push(byRole(d.drain(), "bell")[0].midi[0]);
    }
    notes.slice(1).forEach((n, i) => expect(n).toBeGreaterThan(notes[i]));
  });

  it("playerHit is a low minor second; bossWarning carries a ♭9", () => {
    const { d } = setup(getPalette("guitar"), 23);
    d.handleEvent("playerHit", { x: 0, y: 0, hpLeft: 2, maxHp: 3 });
    const [low, high] = byRole(d.drain(), "bass")[0].midi;
    expect(high - low).toBe(1);
    expect(low).toBeLessThan(60);

    d.handleEvent("bossWarning", { bossType: "sentinel" });
    expect(d.drain()).toEqual([]);
    const pulses: NoteRequest[] = [];
    for (let tick = 24; tick < 24 * 6; tick++) {
      d.onTick(tickEvent(tick));
      pulses.push(...d.drain());
    }
    expect(byRole(pulses, "kick")).toHaveLength(4);
    const tension = byRole(pulses, "boss");
    expect(tension).toHaveLength(1);
    expect(pitchClass(tension[0].midi[0])).toBe((d.harmony.chordAtBar(0).rootPc + 1) % 12);
  });

  it("bossDefeated cadences V→I and levelCompleted arpeggiates the tonic", () => {
    const { d } = setup(getPalette("theremin"), 23);
    const key = d.harmony.keyPc;
    const tonic = chordFromNumeral("i", key, "aeolian").pcs;
    const dominant = chordFromNumeral("V", key, "aeolian").pcs;
    d.handleEvent("bossDefeated", { bossType: "phantom", x: 0, y: 0 });
    const lead = byRole(d.drain(), "lead");
    const last = lead[lead.length - 1];
    for (const r of lead.slice(0, -1)) expect(dominant).toContain(pitchClass(r.midi[0]));
    for (const n of last.midi) expect(tonic).toContain(pitchClass(n));
    expect(last.when).toBeGreaterThan(lead[0].when);

    d.handleEvent("levelCompleted", { levelId: 3 });
    const bells = byRole(d.drain(), "bell");
    expect(bells).toHaveLength(4);
    bells.slice(1).forEach((r, i) => {
      expect(r.midi[0]).toBeGreaterThan(bells[i].midi[0]);
      expect(r.when).toBeGreaterThan(bells[i].when);
    });
    for (const r of bells) expect(tonic).toContain(pitchClass(r.midi[0]));
  });

  it("bossPhaseChanged waits for the next bar line", () => {
    const { d } = setup(getPalette("synth"), 10);
    d.handleEvent("bossPhaseChanged", { bossType: "sentinel", phase: 2 });
    expect(d.drain()).toEqual([]);
    for (let tick = 11; tick < TPB; tick++) {
      d.onTick(tickEvent(tick));
      expect(byRole(d.drain(), "boss")).toEqual([]);
    }
    d.onTick(tickEvent(TPB, 0.01));
    const reqs = d.drain();
    const boss = byRole(reqs, "boss")[0];
    expect(boss.when).toBeCloseTo(0.04);
    expect(boss.midi.map(pitchClass)).toEqual([8, 3, 8]); // Ab: root, fifth, octave (bar 1 = VI)
    expect(byRole(reqs, "kick")).toHaveLength(1);
  });
});

describe("chain tiers", () => {
  it("adds voices per tier, with a bass root from tier 4", () => {
    const counts = [0, 1, 2, 3, 4, 6].map((tier) => {
      const { d } = setup(getPalette("piano"), 23);
      d.handleEvent("enemyKilled", killed("basic", tier));
      const reqs = d.drain();
      return [byRole(reqs, "pad")[0].midi.length, byRole(reqs, "bass").length];
    });
    expect(counts).toEqual([
      [1, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 1],
      [4, 1],
    ]);
  });

  it("sends chord voices of unpitched enemies to perc", () => {
    const { d } = setup(getPalette("theremin"), 23);
    d.handleEvent("enemyKilled", killed("swarm", 3));
    const reqs = d.drain();
    expect(byRole(reqs, "hat")[0].midi).toEqual([]);
    expect(byRole(reqs, "perc")[0].midi).toHaveLength(3);
  });
});

describe("heartbeat", () => {
  it("beats lub on beats 1 and 3 and a softer dub a 16th later", () => {
    const { d } = setup();
    const hits: { tickInBar: number; velocity: number; midi: number[] }[] = [];
    for (let tick = 0; tick < 2 * TPB; tick++) {
      const t = tickEvent(tick);
      d.onTick(t);
      for (const r of byRole(d.drain(), "heart")) hits.push({ tickInBar: t.tickInBar, velocity: r.velocity, midi: r.midi });
    }
    expect(hits.map((h) => h.tickInBar)).toEqual([0, 6, 48, 54, 0, 6, 48, 54]);
    expect(hits[1].velocity).toBeLessThan(hits[0].velocity);
    expect(pitchClass(hits[0].midi[0])).toBe(4); // E (bar 0 = i)
    expect(pitchClass(hits[4].midi[0])).toBe(0); // C (bar 1 = VI)
  });

  it("is louder when time is slow", () => {
    const { clock, d } = setup();
    d.onTick(tickEvent(0));
    const fast = d.drain()[0].velocity;
    clock.timeScale = 0.05;
    d.onTick(tickEvent(TPB));
    expect(d.drain()[0].velocity).toBeGreaterThan(fast);
  });
});

describe("drone", () => {
  it("voices root, fifth and octave and follows chord changes on bar ticks", () => {
    const { d } = setup();
    expect(d.droneChord()).toEqual([52, 59, 64]); // E3 B3 E4
    const v0 = d.droneVersion;
    d.onTick(tickEvent(48));
    expect(d.droneVersion).toBe(v0);
    d.onTick(tickEvent(TPB));
    expect(d.droneVersion).toBe(v0 + 1);
    expect(d.droneChord()).toEqual([48, 55, 60]); // C3 G3 C4
    d.onTick(tickEvent(4 * TPB)); // progression loops back to i
    expect(d.droneChord()).toEqual([52, 59, 64]);
    expect(d.droneVersion).toBe(v0 + 2);
  });

  it("does not bump the version while the chord holds", () => {
    const { d } = setup(variant("theremin", { progression: "i:2 VI" }));
    const v0 = d.droneVersion;
    d.onTick(tickEvent(TPB));
    expect(d.droneVersion).toBe(v0);
    d.onTick(tickEvent(2 * TPB));
    expect(d.droneVersion).toBe(v0 + 1);
  });

  it("setPalette swaps harmony and bumps the version; reset clears pending work", () => {
    const { d } = setup();
    const v0 = d.droneVersion;
    d.handleEvent("bossPhaseChanged", { bossType: "sentinel", phase: 1 });
    d.handleEvent("glassShatter", { x: 0, y: 0 });
    d.reset();
    expect(d.drain()).toEqual([]);
    d.onTick(tickEvent(TPB));
    expect(byRole(d.drain(), "boss")).toEqual([]);
    d.setPalette(getPalette("piano"));
    expect(d.palette.id).toBe("piano");
    expect(d.harmony.keyPc).toBe(5);
    expect(d.droneVersion).toBeGreaterThan(v0);
  });
});

describe("determinism", () => {
  it("produces identical requests for identical input", () => {
    const run = () => {
      const { clock, d } = setup(getPalette("ethereal"));
      const out: NoteRequest[] = [];
      for (let tick = 0; tick < 2 * TPB; tick++) {
        clock.pos = tick + 0.5;
        d.onTick(tickEvent(tick, 0.004));
        if (tick % 7 === 0) fireEverything(d);
        out.push(...d.drain());
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});
