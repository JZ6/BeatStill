import { describe, expect, it } from "vitest";
import { Harmony, chordFromNumeral, parseNumeral, parseProgression } from "./Harmony";
import { HEPTATONIC_MODES, mod, scalePcs } from "./theory";
import type { HeptatonicMode } from "./theory";

const C = 0;
const A = 9;
const NUMERALS_ALL = ["I", "II", "III", "IV", "V", "VI", "VII", "i", "ii", "iii", "iv", "v", "vi", "vii"];
const pcsOf = (symbol: string, keyPc: number, mode: HeptatonicMode) => [...chordFromNumeral(symbol, keyPc, mode).pcs];

describe("parseNumeral", () => {
  it("reads degree, case and accidental", () => {
    expect(parseNumeral("I")).toMatchObject({ degree: 0, upper: true, accidental: 0, quality: "major" });
    expect(parseNumeral("vi")).toMatchObject({ degree: 5, upper: false, quality: "minor" });
    expect(parseNumeral("bVII")).toMatchObject({ degree: 6, accidental: -1, quality: "major" });
    expect(parseNumeral("#iv°")).toMatchObject({ degree: 3, accidental: 1, quality: "diminished" });
    expect(parseNumeral("♭III")).toMatchObject({ degree: 2, accidental: -1 });
    NUMERALS_ALL.forEach((n, i) => {
      expect(parseNumeral(n).degree).toBe(i % 7);
    });
  });

  it("reads quality markers, sevenths and sus", () => {
    expect(parseNumeral("ii°")).toMatchObject({ quality: "diminished", seventh: "none" });
    expect(parseNumeral("iio")).toMatchObject({ quality: "diminished" });
    expect(parseNumeral("iidim")).toMatchObject({ quality: "diminished" });
    expect(parseNumeral("III+")).toMatchObject({ quality: "augmented" });
    expect(parseNumeral("IIIaug")).toMatchObject({ quality: "augmented" });
    expect(parseNumeral("iiø")).toMatchObject({ quality: "diminished", seventh: "halfDim" });
    expect(parseNumeral("iiø7")).toMatchObject({ quality: "diminished", seventh: "halfDim" });
    expect(parseNumeral("V7")).toMatchObject({ seventh: "seventh" });
    expect(parseNumeral("IVmaj7")).toMatchObject({ seventh: "maj7" });
    expect(parseNumeral("Vsus4")).toMatchObject({ sus: 4, seventh: "none" });
    expect(parseNumeral("Vsus2")).toMatchObject({ sus: 2 });
    expect(parseNumeral("V7sus4")).toMatchObject({ sus: 4, seventh: "seventh" });
    expect(parseNumeral("V7").symbol).toBe("V7");
  });

  it("rejects invalid numerals", () => {
    const bad = [
      "", "IIII", "IIV", "Vi", "vI", "H", "x", "bbVII", "b", "V7sus", "Vsus", "V°sus4", "V+sus2",
      "iiømaj7", "IV7maj7", "V9", "Vmaj", "V:2", " V", "V ",
    ];
    for (const s of bad) expect(() => parseNumeral(s), s).toThrow();
  });
});

describe("parseProgression", () => {
  it("splits on whitespace, ignores | and reads bar lengths", () => {
    const p = parseProgression("  i:2 | VI\tIII\nVII:4 ");
    expect(p.map((e) => e.numeral.symbol)).toEqual(["i", "VI", "III", "VII"]);
    expect(p.map((e) => e.bars)).toEqual([2, 1, 1, 4]);
  });

  it("rejects empty progressions and bad bar lengths", () => {
    for (const s of ["", "   ", "| |", "i:0", "i:-1", "i:1.5", "i:", "i:x", "i::2", "i VI ?"]) {
      expect(() => parseProgression(s), s).toThrow();
    }
  });
});

describe("chordFromNumeral", () => {
  it("builds the diatonic triads of C ionian", () => {
    expect(pcsOf("I", C, "ionian")).toEqual([0, 4, 7]);
    expect(pcsOf("ii", C, "ionian")).toEqual([2, 5, 9]);
    expect(pcsOf("iii", C, "ionian")).toEqual([4, 7, 11]);
    expect(pcsOf("IV", C, "ionian")).toEqual([5, 9, 0]);
    expect(pcsOf("V", C, "ionian")).toEqual([7, 11, 2]);
    expect(pcsOf("vi", C, "ionian")).toEqual([9, 0, 4]);
    expect(pcsOf("vii°", C, "ionian")).toEqual([11, 2, 5]);
  });

  it("lets the numeral's case override the mode's triad quality", () => {
    expect(pcsOf("v", A, "aeolian")).toEqual([4, 7, 11]);
    expect(pcsOf("V", A, "aeolian")).toEqual([4, 8, 11]);
    expect(pcsOf("iv", C, "ionian")).toEqual([5, 8, 0]);
    expect(pcsOf("II", C, "ionian")).toEqual([2, 6, 9]);
  });

  it("applies dim, aug and sus", () => {
    expect(pcsOf("ii°", C, "ionian")).toEqual([2, 5, 8]);
    expect(pcsOf("iidim", C, "ionian")).toEqual(pcsOf("ii°", C, "ionian"));
    expect(pcsOf("III+", C, "ionian")).toEqual([4, 8, 0]);
    expect(pcsOf("IIIaug", C, "ionian")).toEqual(pcsOf("III+", C, "ionian"));
    expect(pcsOf("Vsus4", C, "ionian")).toEqual([7, 0, 2]);
    expect(pcsOf("Vsus2", C, "ionian")).toEqual([7, 9, 2]);
    expect(pcsOf("isus4", A, "aeolian")).toEqual(pcsOf("Isus4", A, "aeolian"));
  });

  it("moves the root by a semitone relative to the mode degree", () => {
    expect(pcsOf("bVII", C, "ionian")).toEqual([10, 2, 5]);
    expect(pcsOf("bVI", C, "ionian")).toEqual([8, 0, 3]);
    expect(pcsOf("bIII", C, "ionian")).toEqual([3, 7, 10]);
    expect(pcsOf("#iv°", C, "ionian")).toEqual([6, 9, 0]);
    expect(pcsOf("VII", A, "aeolian")).toEqual([7, 11, 2]);
    expect(pcsOf("bVII", A, "aeolian")).toEqual([6, 10, 1]);
    expect(pcsOf("bII", C, "ionian")).toEqual([1, 5, 8]);
  });

  it("gives uppercase major numerals a dominant seventh", () => {
    expect(pcsOf("V7", C, "ionian")).toEqual([7, 11, 2, 5]);
    expect(pcsOf("V7", A, "aeolian")).toEqual([4, 8, 11, 2]);
    expect(pcsOf("V7", A, "harmonicMinor")).toEqual([4, 8, 11, 2]);
    expect(pcsOf("V7", C, "lydian")).toEqual([7, 11, 2, 5]);
    expect(pcsOf("I7", C, "ionian")).toEqual([0, 4, 7, 10]);
    expect(pcsOf("bVII7", C, "ionian")).toEqual([10, 2, 5, 8]);
    expect(pcsOf("V7sus4", C, "ionian")).toEqual([7, 0, 2, 5]);
  });

  it("stacks the mode's diatonic seventh on other chords", () => {
    expect(pcsOf("v7", A, "aeolian")).toEqual([4, 7, 11, 2]);
    expect(pcsOf("iv7", A, "aeolian")).toEqual([2, 5, 9, 0]);
    expect(pcsOf("ii7", C, "ionian")).toEqual([2, 5, 9, 0]);
    expect(pcsOf("vii°7", C, "ionian")).toEqual([11, 2, 5, 9]);
    expect(pcsOf("vii°7", A, "harmonicMinor")).toEqual([8, 11, 2, 5]);
    expect(pcsOf("i7", A, "harmonicMinor")).toEqual([9, 0, 4, 8]);
    expect(pcsOf("III+7", A, "harmonicMinor")).toEqual([0, 4, 8, 11]);
    expect(pcsOf("ii°7", A, "aeolian")).toEqual([11, 2, 5, 9]);
    expect(pcsOf("#iv°7", C, "ionian")).toEqual([6, 9, 0, 4]);
  });

  it("supports maj7 and half-diminished explicitly", () => {
    expect(pcsOf("IVmaj7", C, "ionian")).toEqual([5, 9, 0, 4]);
    expect(pcsOf("Imaj7", C, "ionian")).toEqual([0, 4, 7, 11]);
    expect(pcsOf("imaj7", A, "aeolian")).toEqual([9, 0, 4, 8]);
    expect(pcsOf("VImaj7", A, "aeolian")).toEqual([5, 9, 0, 4]);
    expect(pcsOf("iiø", C, "ionian")).toEqual([2, 5, 8, 0]);
    expect(pcsOf("iiø7", C, "ionian")).toEqual(pcsOf("iiø", C, "ionian"));
  });

  it("never produces a degenerate seventh for odd altered roots", () => {
    const pcs = pcsOf("bi7", C, "ionian");
    expect(pcs).toEqual([11, 2, 6, 9]);
    expect(new Set(pcs).size).toBe(4);
  });

  it("keeps the symbol and normalises the key", () => {
    const chord = chordFromNumeral("V7", -12, "ionian");
    expect(chord.symbol).toBe("V7");
    expect(chord.rootPc).toBe(7);
    expect(Object.isFrozen(chord.pcs)).toBe(true);
  });

  it("rejects pentatonic and unknown modes", () => {
    expect(() => chordFromNumeral("I", C, "majorPentatonic" as never)).toThrow();
    expect(() => chordFromNumeral("I", C, "locrian" as never)).toThrow();
  });
});

describe("diatonicity", () => {
  /** The diatonic numeral (with 7th suffix if requested) for each degree of a mode. */
  function diatonicNumeral(mode: HeptatonicMode, degree: number, withSeventh: boolean): string {
    const s = scalePcs(0, mode);
    const third = mod(s[(degree + 2) % 7] - s[degree], 12);
    const fifth = mod(s[(degree + 4) % 7] - s[degree], 12);
    const seventh = mod(s[(degree + 6) % 7] - s[degree], 12);
    const base = ["I", "II", "III", "IV", "V", "VI", "VII"][degree];
    let symbol: string;
    if (third === 4 && fifth === 7) symbol = base;
    else if (third === 3 && fifth === 7) symbol = base.toLowerCase();
    else if (third === 3 && fifth === 6) symbol = `${base.toLowerCase()}°`;
    else if (third === 4 && fifth === 8) symbol = `${base}+`;
    else throw new Error(`unexpected triad in ${mode} degree ${degree}`);
    if (!withSeventh) return symbol;
    const majorTriad = third === 4 && fifth === 7;
    return majorTriad && seventh === 11 ? `${symbol}maj7` : `${symbol}7`;
  }

  for (const mode of HEPTATONIC_MODES) {
    it(`unaltered numerals stay in ${mode}`, () => {
      for (const keyPc of [0, 4, 10]) {
        const scale = new Set(scalePcs(keyPc, mode));
        for (let degree = 0; degree < 7; degree++) {
          for (const withSeventh of [false, true]) {
            const symbol = diatonicNumeral(mode, degree, withSeventh);
            const chord = chordFromNumeral(symbol, keyPc, mode);
            expect(chord.rootPc, symbol).toBe(scalePcs(keyPc, mode)[degree]);
            expect(chord.pcs, symbol).toHaveLength(withSeventh ? 4 : 3);
            for (const pc of chord.pcs) expect(scale.has(pc), `${mode} ${symbol} pc ${pc}`).toBe(true);
          }
        }
      }
    });
  }
});

describe("Harmony", () => {
  const minor = () => new Harmony({ key: "A", mode: "aeolian", progression: "i:2 VI III VII" });
  const cMajor = (progression = "I") => new Harmony({ key: "C", mode: "ionian", progression });

  it("exposes key, mode and progression length", () => {
    const h = minor();
    expect(h.keyPc).toBe(9);
    expect(h.mode).toBe("aeolian");
    expect(h.progressionLength).toBe(5);
    expect(new Harmony({ key: "Bb", mode: "dorian", progression: "i IV" }).keyPc).toBe(10);
  });

  it("respects bar lengths and loops", () => {
    const h = minor();
    const symbols = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((b) => h.chordAtBar(b).symbol);
    expect(symbols).toEqual(["i", "i", "VI", "III", "VII", "i", "i", "VI", "III", "VII", "i"]);
    expect(h.chordAtBar(0)).toEqual({ symbol: "i", rootPc: 9, pcs: [9, 0, 4] });
    expect(h.chordAtBar(4)).toEqual({ symbol: "VII", rootPc: 7, pcs: [7, 11, 2] });
  });

  it("handles negative and fractional bars", () => {
    const h = minor();
    expect(h.chordAtBar(-1).symbol).toBe("VII");
    expect(h.chordAtBar(-3).symbol).toBe("VI");
    expect(h.chordAtBar(-4).symbol).toBe("i");
    expect(h.chordAtBar(-5).symbol).toBe("i");
    expect(h.chordAtBar(-6).symbol).toBe("VII");
    expect(h.chordAtBar(2.99).symbol).toBe("VI");
    expect(h.chordAtBar(-0.5).symbol).toBe("VII");
    expect(h.chordAtBar(1e6).symbol).toBe(h.chordAtBar(1e6 % 5).symbol);
    expect(() => h.chordAtBar(NaN)).toThrow();
    expect(() => h.chordAtBar(Infinity)).toThrow();
  });

  it("returns immutable chords", () => {
    const pcs = minor().chordAtBar(0).pcs as number[];
    expect(() => pcs.push(1)).toThrow();
  });

  it("rejects bad options", () => {
    expect(() => new Harmony({ key: "H", mode: "ionian", progression: "I" })).toThrow();
    expect(() => new Harmony({ key: "C4", mode: "ionian", progression: "I" })).toThrow();
    expect(() => new Harmony({ key: "C", mode: "minorPentatonic" as never, progression: "I" })).toThrow();
    expect(() => new Harmony({ key: "C", mode: "ionian", progression: "" })).toThrow();
    expect(() => new Harmony({ key: "C", mode: "ionian", progression: "I Q" })).toThrow();
  });

  it("lists chord and scale tones in a register", () => {
    const h = cMajor("I V7");
    expect(h.chordTones(0, 48, 60)).toEqual([48, 52, 55, 60]);
    expect(h.chordTones(1, 60, 72)).toEqual([62, 65, 67, 71]);
    expect(h.chordTones(0, 61, 63)).toEqual([]);
    expect(h.chordTones(0, 72, 60)).toEqual([]);
    expect(h.scaleTones(60, 72)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(() => h.chordTones(0, NaN, 60)).toThrow();
  });

  it("checks chord tones by pitch class", () => {
    const h = cMajor("I V");
    expect(h.isChordTone(64, 0)).toBe(true);
    expect(h.isChordTone(76, 0)).toBe(true);
    expect(h.isChordTone(-8, 0)).toBe(true);
    expect(h.isChordTone(65, 0)).toBe(false);
    expect(h.isChordTone(62, 1)).toBe(true);
    expect(h.isChordTone(62, 0)).toBe(false);
  });

  describe("safeScaleTones", () => {
    it("drops F over C major in C ionian", () => {
      expect(cMajor().safeScaleTones(0, 60, 71)).toEqual([60, 62, 64, 67, 69, 71]);
    });

    it("drops C over G7", () => {
      expect(cMajor("V7").safeScaleTones(0, 60, 71)).toEqual([62, 64, 65, 67, 69, 71]);
    });

    it("always keeps chord tones, even a root a half step above the maj7", () => {
      expect(cMajor("Imaj7").safeScaleTones(0, 60, 71)).toEqual([60, 62, 64, 67, 69, 71]);
    });

    it("includes chromatic chord tones and drops their clashing neighbours", () => {
      const h = new Harmony({ key: "A", mode: "aeolian", progression: "V7" });
      // E G# B D: A (above G#), C (above B), F (above E) and G (below G#) are excluded.
      expect(h.safeScaleTones(0, 57, 68)).toEqual([59, 62, 64, 68]);
    });

    it("only returns scale tones or chord tones", () => {
      const h = new Harmony({ key: "E", mode: "dorian", progression: "i iv7 bVII V7 ii°" });
      for (let bar = 0; bar < h.progressionLength; bar++) {
        const scale = new Set(h.scaleTones(0, 11).map((m) => m % 12));
        for (const m of h.safeScaleTones(bar, 40, 80)) {
          expect(scale.has(m % 12) || h.isChordTone(m, bar)).toBe(true);
        }
      }
    });
  });

  it("finds the nearest chord tone, ties resolving downward", () => {
    const h = cMajor();
    expect(h.nearestChordTone(60, 0)).toBe(60);
    expect(h.nearestChordTone(61, 0)).toBe(60);
    expect(h.nearestChordTone(62, 0)).toBe(60);
    expect(h.nearestChordTone(63, 0)).toBe(64);
    expect(h.nearestChordTone(66, 0)).toBe(67);
    expect(h.nearestChordTone(61.6, 0)).toBe(60);
    expect(h.nearestChordTone(70, 0)).toBe(72);
    expect(() => h.nearestChordTone(NaN, 0)).toThrow();
  });

  describe("pickChordTone", () => {
    const h = cMajor("I vi");

    it("walks up the chord tones from the bottom of the register", () => {
      expect([0, 1, 2, 3].map((i) => h.pickChordTone(0, [60, 72], i))).toEqual([60, 64, 67, 72]);
      expect([0, 1, 2].map((i) => h.pickChordTone(1, [60, 70], i))).toEqual([60, 64, 69]);
    });

    it("wraps past the top and supports negative indices", () => {
      expect(h.pickChordTone(0, [60, 72], 4)).toBe(60);
      expect(h.pickChordTone(0, [60, 72], 9)).toBe(64);
      expect(h.pickChordTone(0, [60, 72], -1)).toBe(72);
      expect(h.pickChordTone(0, [60, 72], -4)).toBe(60);
      expect(h.pickChordTone(0, [60, 72], -5)).toBe(72);
      expect(h.pickChordTone(0, [60, 72], 1.9)).toBe(64);
    });

    it("falls back to the nearest chord tone when the register holds none", () => {
      expect(h.pickChordTone(0, [61, 63], 0)).toBe(60);
      expect(h.pickChordTone(0, [65, 66], 3)).toBe(67);
    });

    it("rejects bad input", () => {
      expect(() => h.pickChordTone(0, [60, 72], NaN)).toThrow();
      expect(() => h.pickChordTone(0, [NaN, 72], 0)).toThrow();
    });
  });

  it("modulates the key while keeping the numerals", () => {
    const h = minor();
    expect(h.modulate(2)).toBe(h);
    expect(h.keyPc).toBe(11);
    expect(h.mode).toBe("aeolian");
    expect(h.chordAtBar(0)).toEqual({ symbol: "i", rootPc: 11, pcs: [11, 2, 6] });
    expect(h.chordAtBar(2)).toEqual({ symbol: "VI", rootPc: 7, pcs: [7, 11, 2] });
    expect(h.scaleTones(59, 71)).toEqual([59, 61, 62, 64, 66, 67, 69, 71]);
    h.modulate(-14);
    expect(h.keyPc).toBe(9);
    expect(h.chordAtBar(0).pcs).toEqual([9, 0, 4]);
    h.modulate(12);
    expect(h.keyPc).toBe(9);
    expect(() => h.modulate(0.5)).toThrow();
    expect(() => h.modulate(NaN)).toThrow();
  });
});
