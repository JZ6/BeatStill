import * as Tone from "tone";
import type { SoundTheme } from "./SoundTheme";

export const ethereal: SoundTheme = {
  name: "Ethereal",
  bpm: 80,
  scale: ["B2", "D3", "E3", "F#3", "A3", "B3", "D4", "E4", "F#4", "A4", "B4", "D5"],
  chords: [
    ["B2", "D3", "F#3"],
    ["G2", "B2", "D3"],
    ["A2", "C#3", "E3"],
    ["E2", "G#2", "B2"],
  ],
  bassNotes: ["B1", "G1", "A1", "E1"],
  bassPattern: (notes) => notes.map((n) => [n, null, null, null, null, null]).flat(),
  deathNotes: ["B4", "A4", "F#4", "E4", "D4", "B3"],

  createLeadEffects(destination) {
    const vibrato = new Tone.Vibrato({ frequency: 0.8, depth: 0.15, maxDelay: 0.012 });
    vibrato.wet.value = 0.4;
    vibrato.connect(destination);
    return vibrato;
  },

  createLeadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.15, decay: 0.5, sustain: 0.5, release: 2 },
      volume: -10,
    }).connect(destination);
  },

  createPadSynth(destination) {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsine", spread: 40 } as unknown as Tone.OmniOscillatorOptions,
      envelope: { attack: 3, decay: 1, sustain: 0.8, release: 4 },
      volume: -24,
    }).connect(destination);
  },

  createBassSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.8, sustain: 0.2, release: 1 },
      volume: -20,
    }).connect(destination);
  },

  createDeathSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.05, decay: 1, sustain: 0.3, release: 2 },
      volume: -6,
    }).connect(destination);
  },

  createClashSynth(destination) {
    return new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
      volume: -20,
    }).connect(destination);
  },
};
