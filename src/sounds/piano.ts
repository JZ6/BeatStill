import * as Tone from "tone";
import type { SoundTheme } from "./SoundTheme";

export const piano: SoundTheme = {
  name: "Piano",
  bpm: 95,
  scale: ["F2", "A2", "C3", "F3", "A3", "C4", "F4", "A4", "C5", "F5", "A5", "C6"],
  chords: [
    ["F2", "A2", "C3"],
    ["D2", "F2", "A2"],
    ["Bb1", "D2", "F2"],
    ["C2", "E2", "Bb2"],
  ],
  bassNotes: ["F1", "D1", "Bb0", "C1"],
  bassPattern: (notes) => notes.map((n) => [n, null, null, n, null, null, null, null]).flat(),
  deathNotes: ["C6", "A5", "F5", "C5", "A4", "F4"],

  createLeadEffects(destination) {
    const gain = new Tone.Gain(1).connect(destination);
    return gain;
  },

  createLeadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.6, sustain: 0.1, release: 1.2 },
      volume: -8,
    }).connect(destination);
  },

  createPadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 1.5, decay: 0.8, sustain: 0.6, release: 3 },
      volume: -24,
    }).connect(destination);
  },

  createBassSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.15, release: 0.6 },
      volume: -18,
    }).connect(destination);
  },

  createDeathSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.8, sustain: 0.15, release: 1.5 },
      volume: -6,
    }).connect(destination);
  },

  createClashSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.06 },
      volume: -20,
    }).connect(destination);
  },

  createShotSynth(destination) {
    return new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
      volume: -16,
    }).connect(destination);
  },
};
