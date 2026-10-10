// Pure LevelDef validation for data from localStorage, imports and scene data.
// Type-only imports (and the pure music modules) keep this module loadable in Node (vitest) without Phaser.
import type { EnemyType } from "../objects/enemies";
import type { WallType } from "../objects/Wall";
import { parseProgression } from "../music/Harmony";
import { ALL_PALETTES } from "../music/palettes";
import { HEPTATONIC_MODES, noteNameToPc, type HeptatonicMode } from "../music/theory";
import type { LevelAsteroid, LevelBullet, LevelDef, LevelEnemy, LevelMusic, LevelWall, LevelWave } from "./Levels";

/** Enemy types a level may place directly (decoys are spawned by the Phantom boss). */
export type PlaceableEnemyType = Exclude<EnemyType, "phantom_decoy">;
type AsteroidSize = LevelAsteroid["size"];
type OneWayDir = NonNullable<LevelWall["oneWay"]>;

// Records rather than arrays: a missing or extra union member is a compile error.
const PLACEABLE_ENEMY_TYPES: Record<PlaceableEnemyType, true> = {
  basic: true, tracker: true, sniper: true, spiral: true, tank: true,
  swarm: true, snake: true, circler: true, sentinel: true, phantom: true,
};
const WALL_TYPES: Record<WallType, true> = { solid: true, bounce: true, glass: true };
const ASTEROID_SIZES: Record<AsteroidSize, true> = { large: true, medium: true, small: true };
const ONE_WAY_DIRS: Record<OneWayDir, true> = { up: true, down: true, left: true, right: true };

export const DEFAULT_LEVEL_NAME = "Custom Level";
export const MAX_LEVEL_NAME_LENGTH = 40;

/** Tempo range a level may set. */
export const MIN_LEVEL_BPM = 60;
export const MAX_LEVEL_BPM = 180;
/** Longest minimum section a wave may ask for. */
export const MAX_WAVE_BARS = 64;
/** Most chords a level progression may have. */
export const MAX_PROGRESSION_CHORDS = 32;

/** Common names accepted for the two everyday modes. */
const MODE_ALIASES: Readonly<Record<string, HeptatonicMode>> = { major: "ionian", minor: "aeolian" };

// Off-screen spawns (e.g. ry -0.04) are legitimate, so allow a margin around [0,1].
const POS_MIN = -0.2;
const POS_MAX = 1.2;
const MAX_SIZE = POS_MAX - POS_MIN;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isKey<K extends string>(set: Record<K, true>, v: unknown): v is K {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(set, v);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function clampPos(v: number): number {
  return clamp(v, POS_MIN, POS_MAX);
}

/** Maps a list through `fn`, dropping entries it rejects. Non-arrays become []. */
function normalizeList<T>(raw: unknown, fn: (entry: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const entry of raw) {
    const v = fn(entry);
    if (v) out.push(v);
  }
  return out;
}

function normalizeName(v: unknown): string {
  if (typeof v !== "string") return DEFAULT_LEVEL_NAME;
  // Truncate by code point so an emoji isn't split in half.
  const name = Array.from(v.trim()).slice(0, MAX_LEVEL_NAME_LENGTH).join("").trim();
  return name || DEFAULT_LEVEL_NAME;
}

function normalizeEnemy(raw: unknown): LevelEnemy | null {
  if (!isObj(raw)) return null;
  const { type, rx, ry, ...extra } = raw;
  if (!isKey(PLACEABLE_ENEMY_TYPES, type) || !isNum(rx) || !isNum(ry)) return null;
  return { type, rx: clampPos(rx), ry: clampPos(ry), ...extra };
}

function normalizeWall(raw: unknown): LevelWall | null {
  if (!isObj(raw)) return null;
  const { rx, ry, rw, rh, type, hp, oneWay, ...extra } = raw;
  if (!isKey(WALL_TYPES, type)) return null;
  if (!isNum(rx) || !isNum(ry) || !isNum(rw) || !isNum(rh) || rw <= 0 || rh <= 0) return null;
  const wall: LevelWall = {
    rx: clampPos(rx), ry: clampPos(ry),
    rw: Math.min(rw, MAX_SIZE), rh: Math.min(rh, MAX_SIZE),
    type,
    ...extra,
  };
  // Invalid optional fields are stripped rather than rejecting the wall (Wall defaults glass hp to 3).
  if (type === "glass" && typeof hp === "number" && Number.isInteger(hp) && hp > 0) wall.hp = hp;
  if (isKey(ONE_WAY_DIRS, oneWay)) wall.oneWay = oneWay;
  return wall;
}

function normalizeAsteroid(raw: unknown): LevelAsteroid | null {
  if (!isObj(raw)) return null;
  const { rx, ry, size, ...extra } = raw;
  if (!isKey(ASTEROID_SIZES, size) || !isNum(rx) || !isNum(ry)) return null;
  return { rx: clampPos(rx), ry: clampPos(ry), size, ...extra };
}

function normalizeBullet(raw: unknown): LevelBullet | null {
  if (!isObj(raw)) return null;
  const { rx, ry, angle, speed, ...extra } = raw;
  if (!isNum(rx) || !isNum(ry) || !isNum(angle) || !isNum(speed)) return null;
  return { rx: clampPos(rx), ry: clampPos(ry), angle, speed, ...extra };
}

/** A wave's minimum section length: a number in [1, MAX_WAVE_BARS], floored; anything else is dropped. */
export function normalizeWaveBars(v: unknown): number | undefined {
  return isNum(v) && v >= 1 && v <= MAX_WAVE_BARS ? Math.floor(v) : undefined;
}

function normalizeWave(raw: unknown): LevelWave | null {
  if (!isObj(raw)) return null;
  // Unknown wave fields are kept for forward compatibility.
  const { enemies, walls, asteroids, initialBullets, bars, ...extra } = raw;
  const wave: LevelWave = { enemies: normalizeList(enemies, normalizeEnemy), ...extra };
  const minBars = normalizeWaveBars(bars);
  if (minBars !== undefined) wave.bars = minBars;
  if (walls !== undefined) wave.walls = normalizeList(walls, normalizeWall);
  if (asteroids !== undefined) wave.asteroids = normalizeList(asteroids, normalizeAsteroid);
  if (initialBullets !== undefined) wave.initialBullets = normalizeList(initialBullets, normalizeBullet);
  return wave;
}

// ── Music ───────────────────────────────────────────────────────

/** A known palette id (case-insensitive), lowercased; else undefined. */
export function normalizeTheme(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const id = v.trim().toLowerCase();
  return ALL_PALETTES.some((p) => p.id === id) ? id : undefined;
}

/** A tempo in [MIN_LEVEL_BPM, MAX_LEVEL_BPM]; else undefined. */
export function normalizeBpm(v: unknown): number | undefined {
  return isNum(v) && v >= MIN_LEVEL_BPM && v <= MAX_LEVEL_BPM ? v : undefined;
}

/** A note name such as "E", "bb" or "F#", with the letter capitalised ("Bb"); else undefined. */
export function normalizeKey(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const name = v.trim();
  try {
    noteNameToPc(name);
  } catch {
    return undefined;
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** A 7-note mode name (any case; "major"/"minor" become ionian/aeolian); else undefined. */
export function normalizeMode(v: unknown): HeptatonicMode | undefined {
  if (typeof v !== "string") return undefined;
  const name = v.trim().toLowerCase();
  return MODE_ALIASES[name] ?? HEPTATONIC_MODES.find((m) => m.toLowerCase() === name);
}

/** Why a progression can't be used (Harmony's parse error, or too long), or null if it is fine. */
export function progressionError(v: unknown): string | null {
  if (typeof v !== "string") return "Progression must be text";
  try {
    const chords = parseProgression(v);
    if (chords.length > MAX_PROGRESSION_CHORDS) return `At most ${MAX_PROGRESSION_CHORDS} chords`;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return null;
}

/** A progression Harmony can parse (whitespace collapsed); else undefined. */
export function normalizeProgression(v: unknown): string | undefined {
  if (typeof v !== "string" || progressionError(v) !== null) return undefined;
  return v.trim().split(/\s+/).join(" ");
}

/**
 * Validates a level's `music`: each known field is kept only if valid (invalid ones are dropped),
 * unknown fields are kept. Returns undefined for a non-object or when nothing is left.
 */
export function normalizeLevelMusic(raw: unknown): LevelMusic | undefined {
  if (!isObj(raw)) return undefined;
  const { theme, bpm, key, mode, progression, ...extra } = raw;
  const music: LevelMusic = { ...extra };
  const t = normalizeTheme(theme);
  if (t !== undefined) music.theme = t;
  const b = normalizeBpm(bpm);
  if (b !== undefined) music.bpm = b;
  const k = normalizeKey(key);
  if (k !== undefined) music.key = k;
  const m = normalizeMode(mode);
  if (m !== undefined) music.mode = m;
  const p = normalizeProgression(progression);
  if (p !== undefined) music.progression = p;
  return Object.keys(music).length > 0 ? music : undefined;
}

/**
 * Validates and repairs an untrusted LevelDef. Returns a deep copy that never aliases
 * `raw`, or null when the structure is unusable (not an object, no finite id, or a
 * non-array `waves`). Invalid entries are dropped, positions are clamped, invalid music
 * fields and wave `bars` are dropped, and unknown fields on the level, its music, waves
 * and entries are preserved.
 */
export function normalizeLevelDef(raw: unknown): LevelDef | null {
  let src: unknown;
  try {
    src = structuredClone(raw);
  } catch {
    return null;
  }
  if (!isObj(src)) return null;

  const { id, name, description, shipRx, shipRy, music, waves, ...extra } = src;
  if (!isNum(id)) return null;
  if (waves !== undefined && waves !== null && !Array.isArray(waves)) return null;

  const normWaves = normalizeList(waves, normalizeWave);
  const level: LevelDef = {
    id,
    name: normalizeName(name),
    description: typeof description === "string" ? description : "",
    waves: normWaves.length > 0 ? normWaves : [{ enemies: [] }],
    ...extra,
  };
  if (isNum(shipRx)) level.shipRx = clamp(shipRx, 0, 1);
  if (isNum(shipRy)) level.shipRy = clamp(shipRy, 0, 1);
  const normMusic = normalizeLevelMusic(music);
  if (normMusic) level.music = normMusic;
  return level;
}
