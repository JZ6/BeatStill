import * as Tone from "tone";
import type { SoundTheme } from "./SoundTheme";

export const guitar: SoundTheme = {
  name: "Guitar",
  bpm: 110,
  shotSound: "tap",
  scale: ["A2", "C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "A4", "C5"],
  chords: [
    ["A2", "E3", "A3"],
    ["C3", "G3", "C4"],
    ["D3", "A3", "D4"],
    ["E3", "B3", "E4"],
  ],
  bassNotes: ["A1", "C2", "D2", "E2"],
  bassPattern: (notes) => notes.map((n) => [n, null, n, null, n, null, null, null]).flat(),
  deathNotes: ["A4", "G4", "E4", "D4", "C4", "A3"],

  createLeadEffects(destination) {
    return destination;
  },

  createLeadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fmtriangle", modulationType: "sine" } as unknown as Tone.OmniOscillatorOptions,
      envelope: { attack: 0.005, decay: 0.4, sustain: 0.05, release: 0.8 },
      volume: -10,
    }).connect(destination);
  },

  createPadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.8, decay: 0.3, sustain: 0.5, release: 1.5 },
      volume: -22,
    }).connect(destination);
  },

  createBassSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.4 },
      volume: -16,
    }).connect(destination);
  },

  createDeathSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 1 },
      volume: -8,
    }).connect(destination);
  },

  createClashSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
      volume: -18,
    }).connect(destination);
  },
};
