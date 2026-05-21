import * as Tone from "tone";
import type { SoundTheme } from "./SoundTheme";

export const theremin: SoundTheme = {
  name: "Theremin",
  bpm: 100,
  shotSound: "soft",
  scale: ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "A4", "C5", "D5"],
  chords: [
    ["E3", "G3", "B3"],
    ["C3", "E3", "A3"],
    ["D3", "F#3", "A3"],
    ["A2", "C3", "E3"],
  ],
  bassNotes: ["E2", "C2", "D2", "A1"],
  bassPattern: (notes) => notes.map((n) => [n, null, null, n]).flat(),
  deathNotes: ["E4", "D4", "C4", "B3", "A3", "G3", "E3"],

  createLeadEffects(destination) {
    const vibrato = new Tone.Vibrato({ frequency: 5, depth: 0.15 }).connect(destination);
    return vibrato;
  },

  createLeadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.08, decay: 0.3, sustain: 0.4, release: 1.2 },
      volume: -10,
    }).connect(destination);
  },

  createPadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsine", spread: 20 } as unknown as Tone.OmniOscillatorOptions,
      envelope: { attack: 1.5, decay: 0.5, sustain: 0.7, release: 2 },
      volume: -22,
    }).connect(destination);
  },

  createBassSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.15, release: 0.5 },
      volume: -18,
    }).connect(destination);
  },

  createDeathSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.6, sustain: 0.15, release: 1.2 },
      volume: -8,
    }).connect(destination);
  },

  createClashSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
      volume: -20,
    }).connect(destination);
  },
};
