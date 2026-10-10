import { describe, expect, it } from "vitest";
import { Harmony } from "./Harmony";
import { ALL_PALETTES, getPalette, registerMidi } from "./palettes";
import { arpeggioNotes, noteAtOrAbove } from "./previewPhrase";
import { pitchClass } from "./theory";

const harmonyOf = (id: string) => {
  const p = getPalette(id);
  return new Harmony({ key: p.key, mode: p.mode, progression: p.progression });
};

describe("arpeggioNotes", () => {
  it("climbs root, third, fifth, octave from the lowest root in the register", () => {
    const h = harmonyOf("theremin"); // E aeolian: i VI VII iv
    expect(arpeggioNotes(h, 0, [60, 84])).toEqual([64, 67, 71, 76]); // E4 G4 B4 E5
    expect(arpeggioNotes(h, 1, [60, 84])).toEqual([60, 64, 67, 72]); // C4 E4 G4 C5
  });

  it("takes the seventh of a seventh chord", () => {
    const h = harmonyOf("piano"); // F ionian: I vi IV V7
    const notes = arpeggioNotes(h, 3, [60, 84]); // C7: C E G Bb
    expect(notes.map(pitchClass)).toEqual([0, 4, 7, 10]);
  });

  it("goes through every palette's progression with chord tones only, ascending", () => {
    for (const p of ALL_PALETTES) {
      const h = new Harmony({ key: p.key, mode: p.mode, progression: p.progression });
      const reg = registerMidi(p.instruments.arp) ?? [60, 84];
      for (let i = 0; i < h.progressionLength; i++) {
        const notes = arpeggioNotes(h, i, reg);
        expect(notes.length, `${p.id} ${i}`).toBeGreaterThanOrEqual(3);
        expect(pitchClass(notes[0]), `${p.id} ${i}`).toBe(h.chordAtBar(i).rootPc);
        notes.forEach((n, k) => {
          expect(h.isChordTone(n, i)).toBe(true);
          if (k > 0) expect(n).toBeGreaterThan(notes[k - 1]);
        });
      }
    }
  });
});

describe("noteAtOrAbove", () => {
  it("finds the lowest note of a pitch class at or above a note", () => {
    expect(noteAtOrAbove(4, 28)).toBe(28); // E1
    expect(noteAtOrAbove(0, 28)).toBe(36); // C2
    expect(noteAtOrAbove(11, 40)).toBe(47);
  });
});
