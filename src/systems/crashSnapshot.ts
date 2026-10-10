/**
 * The music half of a crash report: conductor, harmony, director, palette and engine state.
 * Every section is read on its own and wrapped, so a part of the game that is broken while it
 * crashes yields `{ error }` for that section instead of losing the report.
 * Pure TypeScript with structural inputs (no Phaser or Tone), so it is unit-testable.
 */
import { midiToNote } from "../music/theory";

/** The parts of a Conductor the snapshot reads. */
export interface SnapshotConductor {
  bpm: number;
  currentTick: number;
  beat: number;
  bar: number;
  beatInBar: number;
  timeScale: number;
  paused: boolean;
}

/** The parts of a MusicDirector the snapshot reads. */
export interface SnapshotDirector {
  palette: { id: string; key: string; progression: string };
  harmony: { keyPc: number; mode: string; chordAtBar(bar: number): { symbol: string; rootPc: number } };
  keyOffset: number;
  queueLength: number;
  scheduledCount: number;
  latencySeconds: number;
  heartbeatEnabled: boolean;
}

/** The playing music (a run's or the menu's): MusicControl satisfies this. */
export interface SnapshotMusic {
  conductor: SnapshotConductor;
  director: SnapshotDirector;
}

/** The parts of the AudioEngine the snapshot reads (every stats() field is copied). */
export interface SnapshotEngine {
  stats(): { palette: string | null };
  dropBreakdown(): Record<string, number>;
}

export type Section<T> = T | { error: string };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** `read()`'s value, or `{ error }` if it throws. */
export function safeSection<T>(read: () => T): Section<T> {
  try {
    return read();
  } catch (err) {
    return { error: errorText(err) };
  }
}

const round = (v: number, digits = 3): number => {
  const k = 10 ** digits;
  return Number.isFinite(v) ? Math.round(v * k) / k : v;
};

/** "E", "F#", … for a pitch class. */
export function pitchClassName(pc: number): string {
  return midiToNote(60 + (((Math.round(pc) % 12) + 12) % 12)).replace(/-?\d+$/, "");
}

/**
 * Conductor, harmony, director, palette and audio sections. `source` names where the music came
 * from ("game", "menu"), or null when nothing is playing.
 */
export function musicSnapshot(music: SnapshotMusic | null, engine: SnapshotEngine, source: string | null): Record<string, unknown> {
  const out: Record<string, unknown> = { musicSource: source };
  if (music) {
    out.conductor = safeSection(() => {
      const c = music.conductor;
      return {
        bpm: c.bpm,
        tick: c.currentTick,
        beat: round(c.beat),
        bar: c.bar,
        beatInBar: round(c.beatInBar),
        timeScale: round(c.timeScale),
        paused: c.paused,
      };
    });
    out.harmony = safeSection(() => {
      const d = music.director;
      const chord = d.harmony.chordAtBar(music.conductor.bar);
      return {
        key: pitchClassName(d.harmony.keyPc),
        mode: d.harmony.mode,
        keyOffset: d.keyOffset,
        chord: chord.symbol,
        chordRoot: pitchClassName(chord.rootPc),
        progression: d.palette.progression,
      };
    });
    out.director = safeSection(() => ({
      queueLength: music.director.queueLength,
      scheduled: music.director.scheduledCount,
      latencyMs: Math.round(music.director.latencySeconds * 1000),
      heartbeat: music.director.heartbeatEnabled,
    }));
  }
  out.palette = safeSection(() => ({
    director: music ? music.director.palette.id : null,
    engine: engine.stats().palette,
  }));
  out.audio = safeSection(() => ({ ...engine.stats(), drops: engine.dropBreakdown() }));
  return out;
}
