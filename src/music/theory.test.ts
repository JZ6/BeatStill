import { describe, expect, it } from "vitest";
import {
  HEPTATONIC_MODES,
  MODES,
  MODE_NAMES,
  isHeptatonicMode,
  isModeName,
  midiToFreq,
  midiToNote,
  mod,
  noteNameToPc,
  noteToMidi,
  pitchClass,
  scaleMidi,
  scalePcs,
} from "./theory";

describe("mod", () => {
  it("is always non-negative", () => {
    expect(mod(13, 12)).toBe(1);
    expect(mod(-1, 12)).toBe(11);
    expect(mod(-12, 12)).toBe(0);
    expect(Object.is(mod(-12, 12), 0)).toBe(true);
  });
});

describe("noteToMidi", () => {
  it("uses C4 = 60", () => {
    expect(noteToMidi("C4")).toBe(60);
    expect(noteToMidi("A4")).toBe(69);
    expect(noteToMidi("C#4")).toBe(61);
    expect(noteToMidi("Bb2")).toBe(46);
    expect(noteToMidi("E-1")).toBe(4);
    expect(noteToMidi("C-1")).toBe(0);
    expect(noteToMidi("G9")).toBe(127);
  });

  it("handles enharmonics across the octave boundary", () => {
    expect(noteToMidi("Db4")).toBe(noteToMidi("C#4"));
    expect(noteToMidi("Cb4")).toBe(59);
    expect(noteToMidi("B#3")).toBe(60);
    expect(noteToMidi("E#4")).toBe(noteToMidi("F4"));
    expect(noteToMidi("Fb4")).toBe(noteToMidi("E4"));
    expect(noteToMidi("C##4")).toBe(62);
    expect(noteToMidi("Bbb3")).toBe(57);
  });

  it("accepts lowercase letters and unicode accidentals", () => {
    expect(noteToMidi("bb2")).toBe(46);
    expect(noteToMidi("f♯3")).toBe(54);
    expect(noteToMidi("E♭5")).toBe(75);
  });

  it("throws on invalid input", () => {
    for (const bad of ["", "H4", "C", "C#", "4", "C#b4", "C###4", "Cbbb4", "C 4", " C4", "C4.5", "C+4", "Do4"]) {
      expect(() => noteToMidi(bad), bad).toThrow();
    }
    expect(() => noteToMidi(undefined as unknown as string)).toThrow();
  });
});

describe("midiToNote", () => {
  it("names notes with sharps by default and flats on request", () => {
    expect(midiToNote(60)).toBe("C4");
    expect(midiToNote(61)).toBe("C#4");
    expect(midiToNote(61, true)).toBe("Db4");
    expect(midiToNote(70, true)).toBe("Bb4");
    expect(midiToNote(4)).toBe("E-1");
    expect(midiToNote(0)).toBe("C-1");
    expect(midiToNote(127)).toBe("G9");
    expect(midiToNote(-1)).toBe("B-2");
  });

  it("round-trips every MIDI note with both spellings", () => {
    for (let m = 0; m <= 127; m++) {
      expect(noteToMidi(midiToNote(m))).toBe(m);
      expect(noteToMidi(midiToNote(m, true))).toBe(m);
    }
  });

  it("throws on non-integers", () => {
    expect(() => midiToNote(60.5)).toThrow();
    expect(() => midiToNote(NaN)).toThrow();
    expect(() => midiToNote(Infinity)).toThrow();
  });
});

describe("midiToFreq", () => {
  it("uses A4 = 440 Hz equal temperament", () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(81)).toBeCloseTo(880, 9);
    expect(midiToFreq(57)).toBeCloseTo(220, 9);
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3);
    expect(midiToFreq(70) / midiToFreq(69)).toBeCloseTo(Math.pow(2, 1 / 12), 12);
  });

  it("accepts fractional MIDI (detune)", () => {
    expect(midiToFreq(69.5)).toBeCloseTo(440 * Math.pow(2, 1 / 24), 9);
  });
});

describe("pitchClass / noteNameToPc", () => {
  it("wraps MIDI notes into 0..11", () => {
    expect(pitchClass(60)).toBe(0);
    expect(pitchClass(71)).toBe(11);
    expect(pitchClass(-1)).toBe(11);
    expect(pitchClass(0)).toBe(0);
  });

  it("parses note names to pitch classes", () => {
    expect(noteNameToPc("C")).toBe(0);
    expect(noteNameToPc("Bb")).toBe(10);
    expect(noteNameToPc("A#")).toBe(10);
    expect(noteNameToPc("E")).toBe(4);
    expect(noteNameToPc("Cb")).toBe(11);
    expect(noteNameToPc("B#")).toBe(0);
    expect(noteNameToPc("f#")).toBe(6);
    expect(noteNameToPc("Ebb")).toBe(2);
  });

  it("agrees with noteToMidi for every name", () => {
    for (const name of ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]) {
      expect(noteNameToPc(name)).toBe(pitchClass(noteToMidi(`${name}3`)));
    }
  });

  it("throws on invalid names", () => {
    for (const bad of ["", "H", "C4", "#", "Bb#", "C###", " C"]) {
      expect(() => noteNameToPc(bad), bad).toThrow();
    }
  });
});

describe("MODES", () => {
  it("has the expected interval sets", () => {
    expect(MODES.ionian).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(MODES.dorian).toEqual([0, 2, 3, 5, 7, 9, 10]);
    expect(MODES.phrygian).toEqual([0, 1, 3, 5, 7, 8, 10]);
    expect(MODES.lydian).toEqual([0, 2, 4, 6, 7, 9, 11]);
    expect(MODES.mixolydian).toEqual([0, 2, 4, 5, 7, 9, 10]);
    expect(MODES.aeolian).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(MODES.harmonicMinor).toEqual([0, 2, 3, 5, 7, 8, 11]);
    expect(MODES.majorPentatonic).toEqual([0, 2, 4, 7, 9]);
    expect(MODES.minorPentatonic).toEqual([0, 3, 5, 7, 10]);
  });

  it("church modes are rotations of the major scale", () => {
    const major = MODES.ionian;
    const church = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian"] as const;
    church.forEach((name, rot) => {
      const rotated = major.map((_, i) => mod(major[(i + rot) % 7] - major[rot], 12));
      expect(MODES[name], name).toEqual(rotated);
    });
  });

  it("every mode starts at 0, ascends strictly and stays inside the octave", () => {
    for (const name of MODE_NAMES) {
      const iv = MODES[name];
      expect(iv[0], name).toBe(0);
      for (let i = 1; i < iv.length; i++) expect(iv[i], name).toBeGreaterThan(iv[i - 1]);
      expect(iv[iv.length - 1], name).toBeLessThan(12);
    }
  });

  it("is frozen", () => {
    expect(Object.isFrozen(MODES)).toBe(true);
    expect(Object.isFrozen(MODES.ionian)).toBe(true);
  });

  it("classifies heptatonic modes", () => {
    expect(MODE_NAMES).toHaveLength(9);
    expect([...HEPTATONIC_MODES].sort()).toEqual(
      ["aeolian", "dorian", "harmonicMinor", "ionian", "lydian", "mixolydian", "phrygian"].sort(),
    );
    expect(isHeptatonicMode("dorian")).toBe(true);
    expect(isHeptatonicMode("majorPentatonic")).toBe(false);
    expect(isModeName("majorPentatonic")).toBe(true);
    expect(isModeName("locrian")).toBe(false);
    expect(isModeName("toString")).toBe(false);
  });
});

describe("scalePcs / scaleMidi", () => {
  it("builds scale pitch classes from any root", () => {
    expect(scalePcs(0, "ionian")).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(scalePcs(9, "aeolian")).toEqual([9, 11, 0, 2, 4, 5, 7]);
    expect(scalePcs(4, "minorPentatonic")).toEqual([4, 7, 9, 11, 2]);
    expect(scalePcs(-3, "aeolian")).toEqual(scalePcs(9, "aeolian"));
  });

  it("returns ascending notes within inclusive bounds", () => {
    expect(scaleMidi(0, "ionian", 60, 72)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(scaleMidi(0, "majorPentatonic", 60, 72)).toEqual([60, 62, 64, 67, 69, 72]);
    expect(scaleMidi(4, "minorPentatonic", 52, 64)).toEqual([52, 55, 57, 59, 62, 64]);
  });

  it("includes bounds only when they are scale tones", () => {
    expect(scaleMidi(0, "ionian", 61, 70)).toEqual([62, 64, 65, 67, 69]);
    expect(scaleMidi(0, "ionian", 60.5, 64.9)).toEqual([62, 64]);
  });

  it("handles empty and single-note ranges", () => {
    expect(scaleMidi(0, "ionian", 72, 60)).toEqual([]);
    expect(scaleMidi(0, "ionian", 61, 61)).toEqual([]);
    expect(scaleMidi(0, "ionian", 60, 60)).toEqual([60]);
  });

  it("produces len(mode) notes per octave for every mode", () => {
    for (const name of MODE_NAMES) {
      const notes = scaleMidi(7, name, 48, 59);
      expect(notes, name).toHaveLength(MODES[name].length);
      for (const n of notes) expect(MODES[name]).toContain(mod(n - 7, 12));
    }
  });

  it("rejects unknown modes and non-finite bounds", () => {
    expect(() => scaleMidi(0, "locrian" as never, 60, 72)).toThrow();
    expect(() => scaleMidi(0, "ionian", NaN, 72)).toThrow();
    expect(() => scaleMidi(0, "ionian", 60, Infinity)).toThrow();
  });
});
