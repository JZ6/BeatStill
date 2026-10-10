/**
 * Every enemy type as data: stats, visuals, musical role and firing rhythm. Enemy classes, the
 * bestiary, the level editor, the menu backdrop and the music all read from here.
 * Pure data and helpers (no Phaser, Tone or DOM), so it is unit-testable and safe to import anywhere.
 */
import type { Role } from "../../music/palettes";
import { parsePattern } from "../../music/patterns";

export const ENEMY_TYPES = [
  "basic",
  "tracker",
  "sniper",
  "spiral",
  "tank",
  "swarm",
  "snake",
  "circler",
  "sentinel",
  "phantom",
  "phantom_decoy",
] as const;

export type EnemyType = (typeof ENEMY_TYPES)[number];

/** Body outline. Polygons are regular with a vertex at the top; the other kinds are drawn by their class. */
export type EnemyShape =
  | { kind: "polygon"; sides: number }
  | { kind: "circle" }
  | { kind: "snake" }
  | { kind: "diamond" };

export interface EnemyRhythm {
  /**
   * Hits on the conductor's 16th-note grid, in parsePattern syntax ("x... ..x."); the pattern loops.
   * Empty: never fires. For bosses this is phase 1's pattern.
   */
  pattern: string;
  /** Each instance starts at a random multiple of this many steps into the pattern (0: always in phase). */
  offsetStep: number;
  /** Bosses: the pattern for each phase (index 0 = phase 1, the same as `pattern`). */
  phases?: readonly string[];
}

export interface EnemyDef {
  type: EnemyType;
  /** Display name (bestiary). */
  name: string;
  icon: string;
  color: number;
  shape: EnemyShape;
  /** Body radius in base pixels (enemies scale it with px()). */
  radius: number;
  hp: number;
  /** Pixels per second of game time. */
  speed: number;
  /** The instrument its shots, hits and death play. */
  role: Role;
  rhythm: EnemyRhythm;
  behavior: string;
  /** 0..5, for the bestiary. */
  danger: number;
  isBoss: boolean;
  /** Spawned only by another enemy: not listed in the bestiary, menu backdrop or level editor. */
  hidden: boolean;
}

type Entry = Omit<EnemyDef, "type" | "isBoss" | "hidden"> & { isBoss?: boolean; hidden?: boolean };

// Stats match the pre-registry constructors exactly. Rhythm lengths are in 16th steps; at 100 bpm a
// step is 150 ms and a bar (16 steps) 2.4 s, which keeps bullet density close to the old ms timers.
const ENTRIES: Record<EnemyType, Entry> = {
  basic: {
    name: "Drone",
    icon: "◆",
    color: 0x44ff44,
    shape: { kind: "circle" },
    radius: 16,
    hp: 2,
    speed: 40,
    role: "pad",
    // Once per bar on any beat (was every 2400 ms).
    rhythm: { pattern: "x... .... .... ....", offsetStep: 4 },
    behavior: "Wanders randomly, fires radial bursts that scale with wave",
    danger: 1,
  },
  tracker: {
    name: "Tracker",
    icon: "▲",
    color: 0xff8800,
    shape: { kind: "polygon", sides: 4 },
    radius: 12,
    hp: 1,
    speed: 60,
    role: "stab",
    // Once per bar on any 8th, so half of them stab off the beat (was 2000 ms).
    rhythm: { pattern: "x... .... .... ....", offsetStep: 2 },
    behavior: "Follows your position, fires aimed volleys",
    danger: 2,
  },
  sniper: {
    name: "Sniper",
    icon: "✦",
    color: 0xff2266,
    shape: { kind: "polygon", sides: 5 },
    radius: 10,
    hp: 1,
    speed: 20,
    role: "snare",
    // Beat 2, or beat 4 with an 8-step offset: the backbeat (was 1600 ms).
    rhythm: { pattern: ".... x... .... ....", offsetStep: 8 },
    behavior: "Barely moves, fires fast precise shots on the backbeat",
    danger: 2,
  },
  spiral: {
    name: "Spiral",
    icon: "✺",
    color: 0xaa44ff,
    shape: { kind: "polygon", sides: 7 },
    radius: 18,
    hp: 3,
    speed: 25,
    role: "arp",
    // Every 8th (was 300 ms ≈ an 8th at 100 bpm), on or off the 8th grid.
    rhythm: { pattern: "x.", offsetStep: 1 },
    behavior: "Fires a rotating spiral on every 8th note, arpeggiating the chord",
    danger: 3,
  },
  tank: {
    name: "Tank",
    icon: "■",
    color: 0xff4444,
    shape: { kind: "polygon", sides: 8 },
    radius: 24,
    hp: 6,
    speed: 15,
    role: "bass",
    // Beat 1 or 3 (was 2800 ms).
    rhythm: { pattern: "x... .... .... ....", offsetStep: 8 },
    behavior: "Slow and tough, fires radial + aimed combo patterns",
    danger: 4,
  },
  swarm: {
    name: "Swarm",
    icon: "●",
    color: 0xffff44,
    shape: { kind: "polygon", sides: 3 },
    radius: 8,
    hp: 1,
    speed: 90,
    role: "hat",
    // A 5-beat cycle against the 4-beat bar (≈ 3 s at 100 bpm; was 3200 ms).
    rhythm: { pattern: "x... .... .... .... ....", offsetStep: 2 },
    behavior: "Rushes directly at you, fast but fragile",
    danger: 2,
  },
  snake: {
    name: "Snake",
    icon: "≋",
    color: 0x44ddff,
    shape: { kind: "snake" },
    radius: 14,
    hp: 2,
    speed: 50,
    role: "melody",
    // Once per bar on any 8th (was 2400 ms); the weave picks the note.
    rhythm: { pattern: "x... .... .... ....", offsetStep: 2 },
    behavior: "Weaves toward you on the beat; its weave sings the melody",
    danger: 2,
  },
  circler: {
    name: "Circler",
    icon: "⬡",
    color: 0x44ff88,
    shape: { kind: "polygon", sides: 6 },
    radius: 16,
    hp: 3,
    speed: 20,
    role: "bell",
    // Once per bar on any beat (was 2200 ms).
    rhythm: { pattern: "x... .... .... ....", offsetStep: 4 },
    behavior: "Drifts around the arena, fires 16-bullet radial bursts",
    danger: 3,
  },
  sentinel: {
    name: "Sentinel",
    icon: "⊛",
    color: 0xffaa22,
    shape: { kind: "polygon", sides: 12 },
    radius: 36,
    hp: 30,
    speed: 8,
    role: "boss",
    // Was 2000 / 1500 / 800 ms: a dotted-half pulse across the bar (1.8 s), a two-bar
    // 3-3-2 (avg 1.6 s), then the one-bar 3-3-2 tresillo (avg 0.8 s).
    rhythm: {
      pattern: "x... .... ....",
      offsetStep: 0,
      phases: ["x... .... ....", "x... .... .... x... .... .... x... ....", "x... ..x. .... x..."],
    },
    behavior: "3-phase boss that summons minions; each phase is a new section on the bar line",
    danger: 5,
    isBoss: true,
  },
  phantom: {
    name: "Phantom",
    icon: "◈",
    color: 0x4488ff,
    shape: { kind: "diamond" },
    radius: 28,
    hp: 40,
    speed: 40,
    role: "boss",
    // Was 2500 / 2000 / 1500 ms: once a bar (2.4 s), a dotted-half pulse (1.8 s), a two-bar 3-3-2 (avg 1.6 s).
    rhythm: {
      pattern: "x... .... .... ....",
      offsetStep: 0,
      phases: ["x... .... .... ....", "x... .... ....", "x... .... .... x... .... .... x... ...."],
    },
    behavior: "Teleporting boss that spawns decoys, charges power when time is frozen",
    danger: 5,
    isBoss: true,
  },
  phantom_decoy: {
    name: "Decoy",
    icon: "◇",
    color: 0x4488ff,
    shape: { kind: "diamond" },
    radius: 28,
    hp: 1,
    speed: 0,
    role: "bell",
    rhythm: { pattern: "", offsetStep: 0 },
    behavior: "Harmless afterimage the Phantom leaves behind in its last phase",
    danger: 0,
    hidden: true,
  },
};

function freezeDef(type: EnemyType, e: Entry): EnemyDef {
  const rhythm: EnemyRhythm = Object.freeze({
    ...e.rhythm,
    ...(e.rhythm.phases ? { phases: Object.freeze([...e.rhythm.phases]) } : {}),
  });
  return Object.freeze({
    ...e,
    type,
    shape: Object.freeze({ ...e.shape }),
    rhythm,
    isBoss: e.isBoss ?? false,
    hidden: e.hidden ?? false,
  });
}

export const ENEMY_REGISTRY: Readonly<Record<EnemyType, EnemyDef>> = Object.freeze(
  Object.fromEntries(ENEMY_TYPES.map((t) => [t, freezeDef(t, ENTRIES[t])])) as Record<EnemyType, EnemyDef>,
);

/** Every definition, in ENEMY_TYPES order. */
export const ENEMY_DEFS: readonly EnemyDef[] = Object.freeze(ENEMY_TYPES.map((t) => ENEMY_REGISTRY[t]));

export function isEnemyType(value: unknown): value is EnemyType {
  return typeof value === "string" && (ENEMY_TYPES as readonly string[]).includes(value);
}

export function enemyDef(type: EnemyType): EnemyDef {
  return ENEMY_REGISTRY[type];
}

/** Number of rhythm phases (1 for regular enemies). */
export function phaseCount(type: EnemyType): number {
  return ENEMY_REGISTRY[type].rhythm.phases?.length ?? 1;
}

/** The pattern text for `phase` (1-based), clamped to the phases the type has. */
export function rhythmPattern(type: EnemyType, phase = 1): string {
  const r = ENEMY_REGISTRY[type].rhythm;
  if (!r.phases || r.phases.length === 0) return r.pattern;
  const i = Math.min(r.phases.length, Math.max(1, Math.floor(phase))) - 1;
  return r.phases[i];
}

const parsed = new Map<string, readonly boolean[]>();

/** Parsed hits of rhythmPattern(type, phase); cached and frozen. */
export function rhythmHits(type: EnemyType, phase = 1): readonly boolean[] {
  const text = rhythmPattern(type, phase);
  let hits = parsed.get(text);
  if (!hits) {
    hits = Object.freeze(parsePattern(text).hits);
    parsed.set(text, hits);
  }
  return hits;
}

const POLYGON_NAMES: Readonly<Record<number, string>> = {
  3: "Triangle",
  4: "Square",
  5: "Pentagon",
  6: "Hexagon",
  7: "Heptagon",
  8: "Octagon",
  12: "Dodecagon",
};

/** Display name of a shape, e.g. "Pentagon" or "Line". */
export function shapeLabel(shape: EnemyShape): string {
  switch (shape.kind) {
    case "circle":
      return "Circle";
    case "snake":
      return "Line";
    case "diamond":
      return "Diamond";
    case "polygon":
      return POLYGON_NAMES[shape.sides] ?? `${shape.sides}-gon`;
  }
}
