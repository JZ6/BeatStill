import * as Tone from "tone";
import type { SoundTheme } from "./SoundTheme";

export const synth: SoundTheme = {
  name: "Synth",
  bpm: 120,
  scale: ["C3", "Eb3", "F3", "G3", "Bb3", "C4", "Eb4", "F4", "G4", "Bb4", "C5", "Eb5"],
  chords: [
    ["C3", "Eb3", "G3"],
    ["Ab2", "C3", "Eb3"],
    ["Bb2", "D3", "F3"],
    ["G2", "Bb2", "D3"],
  ],
  bassNotes: ["C2", "Ab1", "Bb1", "G1"],
  bassPattern: (notes) => notes.map((n) => [n, n, null, n, null, n, null, null]).flat(),
  deathNotes: ["C5", "Bb4", "G4", "F4", "Eb4", "C4", "Bb3"],

  createLeadEffects(destination) {
    const phaser = new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 1000, wet: 0.3 })
      .connect(destination);
    return phaser;
  },

  createLeadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "square" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.15, release: 0.4 },
      volume: -14,
    }).connect(destination);
  },

  createPadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", spread: 30 } as unknown as Tone.OmniOscillatorOptions,
      envelope: { attack: 1, decay: 0.5, sustain: 0.6, release: 1.5 },
      volume: -26,
    }).connect(destination);
  },

  createBassSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "square" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 },
      filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.2, baseFrequency: 200, octaves: 3 },
      volume: -18,
    }).connect(destination);
  },

  createDeathSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 0.8 },
      volume: -8,
    }).connect(destination);
  },

  createClashSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
      volume: -22,
    }).connect(destination);
  },

  createShotSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
      volume: -18,
    }).connect(destination);
  },
};
