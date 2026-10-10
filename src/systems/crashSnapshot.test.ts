import { describe, expect, it } from "vitest";
import { Conductor } from "../core/Conductor";
import { MusicDirector } from "../music/MusicDirector";
import { getPalette } from "../music/palettes";
import { musicSnapshot, pitchClassName, safeSection, type SnapshotEngine, type SnapshotMusic } from "./crashSnapshot";

const engine = (palette: string | null = "theremin"): SnapshotEngine => ({
  stats: () => ({ started: true, scheduled: 10, dropped: 1, palette }),
  dropBreakdown: () => ({ "voices:pad": 1 }),
});

function realMusic(): { conductor: Conductor; director: MusicDirector } {
  const conductor = new Conductor({ bpm: 100, timeScale: 0.5 });
  const director = new MusicDirector(getPalette("theremin"), conductor);
  conductor.advance(0.1);
  // Bar 1 of theremin's i VI VII iv in E: VI = C.
  conductor.reset(96);
  conductor.advance(0.01);
  return { conductor, director };
}

describe("safeSection", () => {
  it("returns the value, or the error message when the read throws", () => {
    expect(safeSection(() => ({ a: 1 }))).toEqual({ a: 1 });
    expect(safeSection(() => { throw new Error("boom"); })).toEqual({ error: "boom" });
    expect(safeSection(() => { throw "plain"; })).toEqual({ error: "plain" });
  });
});

describe("pitchClassName", () => {
  it("names pitch classes and wraps", () => {
    expect(pitchClassName(4)).toBe("E");
    expect(pitchClassName(6)).toBe("F#");
    expect(pitchClassName(-1)).toBe("B");
    expect(pitchClassName(12)).toBe("C");
  });
});

describe("musicSnapshot", () => {
  it("reports conductor, harmony, director, palette and engine state", () => {
    const music = realMusic();
    const snap = musicSnapshot(music, engine(), "game");
    expect(snap.musicSource).toBe("game");
    expect(snap.conductor).toMatchObject({ bpm: 100, bar: 1, timeScale: 0.5, paused: false });
    expect((snap.conductor as { tick: number }).tick).toBeGreaterThanOrEqual(96);
    expect(snap.harmony).toEqual({ key: "E", mode: "aeolian", keyOffset: 0, chord: "VI", chordRoot: "C", progression: "i VI VII iv" });
    expect(snap.director).toMatchObject({ queueLength: expect.any(Number), scheduled: 0, latencyMs: 50, heartbeat: true });
    expect(snap.palette).toEqual({ director: "theremin", engine: "theremin" });
    expect(snap.audio).toEqual({ started: true, scheduled: 10, dropped: 1, palette: "theremin", drops: { "voices:pad": 1 } });
  });

  it("follows a key change", () => {
    const music = realMusic();
    music.director.setKeyOffset(2);
    expect(musicSnapshot(music, engine(), "game").harmony).toMatchObject({ key: "F#", keyOffset: 2, chordRoot: "D" });
  });

  it("keeps the other sections when one part is broken", () => {
    const music = realMusic();
    const broken: SnapshotMusic = {
      conductor: music.conductor,
      director: {
        palette: music.director.palette,
        keyOffset: 0,
        queueLength: 0,
        scheduledCount: 0,
        latencySeconds: 0.05,
        heartbeatEnabled: true,
        harmony: { keyPc: 4, mode: "aeolian", chordAtBar: () => { throw new Error("no chord"); } },
      },
    };
    const snap = musicSnapshot(broken, { stats: () => { throw new Error("engine gone"); }, dropBreakdown: () => ({}) }, "menu");
    expect(snap.harmony).toEqual({ error: "no chord" });
    expect(snap.audio).toEqual({ error: "engine gone" });
    expect(snap.palette).toEqual({ error: "engine gone" });
    expect(snap.conductor).toMatchObject({ bpm: 100 });
    expect(snap.director).toMatchObject({ latencyMs: 50 });
  });

  it("without music: only the source, palette and engine sections", () => {
    const snap = musicSnapshot(null, engine(null), null);
    expect(Object.keys(snap).sort()).toEqual(["audio", "musicSource", "palette"]);
    expect(snap.palette).toEqual({ director: null, engine: null });
  });
});
