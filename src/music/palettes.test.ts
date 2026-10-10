import { describe, expect, it } from "vitest";
import { Harmony } from "./Harmony";
import { ALL_PALETTES, DEFAULT_PALETTE_ID, ROLES, getPalette, isPitched, registerMidi } from "./palettes";
import type { InstrumentKind, InstrumentSpec, Role } from "./palettes";
import { isHeptatonicMode, noteToMidi, scalePcs } from "./theory";

const m = noteToMidi;

/** Allowed option keys per Tone v15 constructor (from node_modules/tone/build/esm/**\/*.d.ts). */
const ENVELOPE_KEYS = ["attack", "decay", "sustain", "release", "attackCurve", "decayCurve", "releaseCurve"];
const OSC_KEYS = [
  "type",
  "spread",
  "count",
  "harmonicity",
  "modulationIndex",
  "modulationType",
  "width",
  "modulationFrequency",
  "partials",
  "partialCount",
  "phase",
];
const NESTED_KEYS: Record<string, string[]> = {
  envelope: ENVELOPE_KEYS,
  modulationEnvelope: ENVELOPE_KEYS,
  filterEnvelope: [...ENVELOPE_KEYS, "baseFrequency", "octaves", "exponent"],
  filter: ["type", "frequency", "rolloff", "Q", "gain", "detune"],
  oscillator: OSC_KEYS,
  modulation: OSC_KEYS,
  noise: ["type", "playbackRate", "fadeIn", "fadeOut"],
};
const SYNTH_KEYS = ["oscillator", "envelope", "portamento", "detune"];
const TOP_KEYS: Record<InstrumentKind, string[]> = {
  synth: SYNTH_KEYS,
  poly: SYNTH_KEYS,
  mono: [...SYNTH_KEYS, "filter", "filterEnvelope"],
  fm: [...SYNTH_KEYS, "harmonicity", "modulationIndex", "modulation", "modulationEnvelope"],
  am: [...SYNTH_KEYS, "harmonicity", "modulation", "modulationEnvelope"],
  membrane: [...SYNTH_KEYS, "pitchDecay", "octaves"],
  metal: ["harmonicity", "modulationIndex", "octaves", "resonance", "envelope", "portamento", "detune"],
  noise: ["noise", "envelope"],
  pluck: ["attackNoise", "dampening", "resonance", "release"],
};

const each = (fn: (role: Role, spec: InstrumentSpec, paletteId: string) => void) => {
  for (const p of ALL_PALETTES) for (const role of ROLES) fn(role, p.instruments[role], p.id);
};

const envOf = (spec: InstrumentSpec) => spec.options.envelope as Record<string, number> | undefined;

describe("palette list", () => {
  it("has the six legacy theme ids in order", () => {
    expect(ALL_PALETTES.map((p) => p.id)).toEqual(["theremin", "guitar", "bell", "synth", "ethereal", "piano"]);
    for (const p of ALL_PALETTES) expect(p.name.toLowerCase()).toBe(p.id);
  });

  it("keeps each theme's tempo, key, mode and progression", () => {
    const summary = ALL_PALETTES.map((p) => [p.id, p.bpm, p.key, p.mode, p.progression]);
    expect(summary).toEqual([
      ["theremin", 100, "E", "aeolian", "i VI VII iv"],
      ["guitar", 110, "A", "aeolian", "i III iv v"],
      ["bell", 90, "D", "aeolian", "i iv v III"],
      ["synth", 120, "C", "aeolian", "i VI VII v"],
      ["ethereal", 80, "B", "dorian", "i III VII IV"],
      ["piano", 95, "F", "ionian", "I vi IV V7"],
    ]);
  });

  it("getPalette falls back to theremin", () => {
    expect(DEFAULT_PALETTE_ID).toBe("theremin");
    expect(getPalette("piano").id).toBe("piano");
    expect(getPalette("Synth").id).toBe("synth");
    expect(getPalette(undefined).id).toBe("theremin");
    expect(getPalette("").id).toBe("theremin");
    expect(getPalette("nope").id).toBe("theremin");
  });

  it("is deeply frozen", () => {
    const p = ALL_PALETTES[0];
    expect(Object.isFrozen(ALL_PALETTES)).toBe(true);
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.instruments.lead.options)).toBe(true);
    expect(Object.isFrozen(p.instruments.lead.options.envelope)).toBe(true);
  });
});

describe("harmony", () => {
  it("every progression is diatonic to its 7-note mode", () => {
    for (const p of ALL_PALETTES) {
      expect(isHeptatonicMode(p.mode)).toBe(true);
      const h = new Harmony({ key: p.key, mode: p.mode, progression: p.progression });
      const scale = new Set(scalePcs(h.keyPc, p.mode));
      expect(h.progressionLength).toBe(4);
      for (let bar = 0; bar < h.progressionLength; bar++) {
        for (const pc of h.chordAtBar(bar).pcs) expect(scale.has(pc), `${p.id} bar ${bar} pc ${pc}`).toBe(true);
      }
    }
  });

  it("ports the old chord roots", () => {
    const roots = (id: string) => {
      const p = getPalette(id);
      const h = new Harmony({ key: p.key, mode: p.mode, progression: p.progression });
      return [0, 1, 2, 3].map((b) => h.chordAtBar(b).rootPc);
    };
    expect(roots("theremin")).toEqual([4, 0, 2, 9]); // E C D A (bass line)
    expect(roots("guitar")).toEqual([9, 0, 2, 4]); // A C D E
    expect(roots("bell")).toEqual([2, 7, 9, 5]); // D G A F
    expect(roots("synth")).toEqual([0, 8, 10, 7]); // C Ab Bb G
    expect(roots("piano")).toEqual([5, 2, 10, 0]); // F D Bb C
    const piano = getPalette("piano");
    const c7 = new Harmony({ key: piano.key, mode: piano.mode, progression: piano.progression }).chordAtBar(3);
    expect([...c7.pcs]).toEqual([0, 4, 7, 10]);
  });
});

describe("instruments", () => {
  it("every palette defines every role", () => {
    expect(ROLES).toHaveLength(15);
    for (const p of ALL_PALETTES) expect(Object.keys(p.instruments).sort()).toEqual([...ROLES].sort());
  });

  it("voices, volumes and sends are sane", () => {
    each((role, spec, id) => {
      const where = `${id}.${role}`;
      expect(Number.isInteger(spec.maxVoices) && spec.maxVoices >= 1, where).toBe(true);
      expect(Number.isFinite(spec.volume) && spec.volume <= 0, where).toBe(true);
      for (const send of [spec.reverb, spec.delay]) {
        if (send !== undefined) expect(send >= 0 && send <= 1, where).toBe(true);
      }
      expect("volume" in spec.options, where).toBe(false);
    });
  });

  it("only uses option names the matching Tone constructor accepts", () => {
    each((role, spec, id) => {
      for (const [key, value] of Object.entries(spec.options)) {
        expect(TOP_KEYS[spec.kind], `${id}.${role}: ${key}`).toContain(key);
        const nested = NESTED_KEYS[key];
        if (nested && value && typeof value === "object") {
          for (const sub of Object.keys(value)) expect(nested, `${id}.${role}.${key}: ${sub}`).toContain(sub);
        }
      }
      if (spec.kind === "mono") {
        expect(spec.options.filter, `${id}.${role}`).toBeDefined();
        expect(spec.options.filterEnvelope, `${id}.${role}`).toBeDefined();
      }
    });
  });

  it("pitched roles have parseable registers spanning at least an octave", () => {
    each((role, spec, id) => {
      const reg = registerMidi(spec);
      if (!isPitched(spec)) return;
      expect(reg, `${id}.${role}`).not.toBeNull();
      const [low, high] = reg as [number, number];
      expect(high - low >= 12, `${id}.${role}`).toBe(true);
    });
  });

  it("registers sit in each role's range", () => {
    const within: Partial<Record<Role, [string, string]>> = {
      bass: ["C1", "G3"],
      pad: ["A2", "E5"],
      drone: ["A2", "E5"],
      lead: ["G3", "G6"],
      arp: ["G3", "G6"],
      melody: ["G3", "G6"],
      stab: ["G3", "G6"],
      bell: ["A4", "C8"],
      perc: ["C4", "C8"],
      kick: ["A0", "C3"],
      heart: ["A0", "C3"],
      boss: ["C1", "C5"],
    };
    each((role, spec, id) => {
      const range = within[role];
      if (!range) return;
      const [low, high] = registerMidi(spec) as [number, number];
      expect(low >= m(range[0]) && high <= m(range[1]), `${id}.${role} ${spec.register}`).toBe(true);
    });
  });

  it("drum, heart, drone and metal roles have the right kind of timbre", () => {
    each((role, spec, id) => {
      const where = `${id}.${role}`;
      const e = envOf(spec);
      switch (role) {
        case "kick":
        case "heart":
          expect(spec.kind, where).toBe("membrane");
          break;
        case "snare":
        case "hat":
          expect(["noise", "metal"], where).toContain(spec.kind);
          break;
        case "metal":
          expect(spec.kind, where).toBe("metal");
          break;
        case "perc":
          expect(isPitched(spec), where).toBe(true);
          expect(e && e.decay <= 0.1 && e.sustain === 0, where).toBe(true);
          break;
        case "drone":
          expect(e && e.attack >= 0.5 && e.sustain >= 0.5, where).toBe(true);
          break;
      }
    });
    for (const p of ALL_PALETTES) {
      const { kick, heart, hat, snare } = p.instruments;
      const decay = (s: InstrumentSpec) => (envOf(s) as Record<string, number>).decay;
      expect(decay(hat), p.id).toBeLessThanOrEqual(0.06);
      expect(decay(hat), p.id).toBeLessThan(decay(snare));
      // The heart is softer than the kick: slower attack, smaller pitch sweep.
      expect((envOf(heart) as Record<string, number>).attack).toBeGreaterThan((envOf(kick) as Record<string, number>).attack);
      expect(heart.options.octaves as number).toBeLessThan(kick.options.octaves as number);
    }
  });

  it("roles within a palette have distinct timbres", () => {
    for (const p of ALL_PALETTES) {
      const seen = new Map<string, Role>();
      for (const role of ROLES) {
        const spec = p.instruments[role];
        const key = JSON.stringify([spec.kind, spec.options]);
        expect(seen.get(key), `${p.id}.${role} duplicates ${seen.get(key)}`).toBeUndefined();
        seen.set(key, role);
      }
    }
  });
});
