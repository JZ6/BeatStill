import * as Tone from "tone";
import type { ShotSound } from "../systems/AudioManager";

export interface SoundTheme {
  name: string;
  bpm: number;
  shotSound: ShotSound;
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
