import * as Tone from "tone";
import type { SoundTheme } from "./SoundTheme";

export const bell: SoundTheme = {
  name: "Bell",
  bpm: 90,
  scale: ["D3", "F3", "G3", "A3", "C4", "D4", "F4", "G4", "A4", "C5", "D5", "F5"],
  chords: [
    ["D3", "F3", "A3"],
    ["G2", "Bb2", "D3"],
    ["A2", "C3", "E3"],
    ["F2", "A2", "C3"],
  ],
  bassNotes: ["D2", "G1", "A1", "F1"],
  bassPattern: (notes) => notes.map((n) => [n, null, null, null]).flat(),
  deathNotes: ["D5", "C5", "A4", "G4", "F4", "D4", "C4"],

  createLeadEffects(destination) {
    const vibrato = new Tone.Vibrato({ frequency: 1.5, depth: 0.08, maxDelay: 0.01 });
    vibrato.wet.value = 0.35;
    vibrato.connect(destination);
    return vibrato;
  },

  createLeadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.8, sustain: 0.1, release: 1.5 },
      volume: -8,
    }).connect(destination);
  },

  createPadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 },
      volume: -24,
    }).connect(destination);
  },

  createBassSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.05, decay: 0.6, sustain: 0.1, release: 0.8 },
      volume: -20,
    }).connect(destination);
  },

  createDeathSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 1, sustain: 0.1, release: 2 },
      volume: -6,
    }).connect(destination);
  },

  createClashSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
      volume: -18,
    }).connect(destination);
  },
};
