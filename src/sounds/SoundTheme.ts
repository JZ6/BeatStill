import * as Tone from "tone";

export interface SoundTheme {
  name: string;
  bpm: number;
  scale: string[];
  chords: string[][];
  bassNotes: string[];
  bassPattern: (notes: string[]) => (string | null)[];
  deathNotes: string[];

  createLeadSynth(destination: Tone.InputNode): Tone.PolySynth;
  createLeadEffects(destination: Tone.InputNode): Tone.InputNode;
  createPadSynth(destination: Tone.InputNode): Tone.PolySynth;
  createBassSynth(destination: Tone.InputNode): Tone.MonoSynth;
  createDeathSynth(destination: Tone.InputNode): Tone.MonoSynth;
  createClashSynth(destination: Tone.InputNode): Tone.MonoSynth;
}
