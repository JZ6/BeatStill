// Pure LevelDef validation for data from localStorage, imports and scene data.
// Type-only imports keep this module loadable in Node (vitest) without Phaser.
import type { EnemyType } from "../objects/enemies";
import type { WallType } from "../objects/Wall";
import type { LevelAsteroid, LevelBullet, LevelDef, LevelEnemy, LevelWall, LevelWave } from "./Levels";

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

function normalizeWave(raw: unknown): LevelWave | null {
  if (!isObj(raw)) return null;
  // Unknown wave fields (e.g. a future `bars`) are kept for forward compatibility.
  const { enemies, walls, asteroids, initialBullets, ...extra } = raw;
  const wave: LevelWave = { enemies: normalizeList(enemies, normalizeEnemy), ...extra };
  if (walls !== undefined) wave.walls = normalizeList(walls, normalizeWall);
  if (asteroids !== undefined) wave.asteroids = normalizeList(asteroids, normalizeAsteroid);
  if (initialBullets !== undefined) wave.initialBullets = normalizeList(initialBullets, normalizeBullet);
  return wave;
}

/**
 * Validates and repairs an untrusted LevelDef. Returns a deep copy that never aliases
 * `raw`, or null when the structure is unusable (not an object, no finite id, or a
 * non-array `waves`). Invalid entries are dropped, positions are clamped, and unknown
 * fields on the level, waves and entries are preserved.
 */
export function normalizeLevelDef(raw: unknown): LevelDef | null {
  let src: unknown;
  try {
    src = structuredClone(raw);
  } catch {
    return null;
  }
  if (!isObj(src)) return null;

  const { id, name, description, shipRx, shipRy, waves, ...extra } = src;
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
  return level;
}
