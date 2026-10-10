// Pure normalizers for persisted save data (no Phaser/Tone/DOM imports).
// Every load goes through one of these: each known field is type-checked and defaulted,
// and unknown fields are kept so saves written by newer builds survive a round trip.

export interface WeaponMasteryEntry {
  pickups: number;
  kills: number;
}

/** `beatstill_unlocks` */
export interface UnlockState {
  shards: number;
  highScore: number;
  highWave: number;
  bestChain: number;
  unlockedIds: string[];
  weaponMastery: Record<string, WeaponMasteryEntry>;
  evolvedWeapons: string[];
  shopPurchases: Record<string, number>;
}

/** `beatstill_achievements` */
export interface AchievementState {
  unlockedIds: string[];
  totalKills: number;
  bossesDefeated: number;
  weaponsUsed: string[];
  themesUsed: string[];
  /** Lifetime pickups collected. Absent in older saves; defaults to 0. */
  totalPickups: number;
}

/** `beatstill_levels` */
export interface LevelProgress {
  completedIds: number[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

/** Finite, non-negative number, else `fallback`. */
function nonNegNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Finite, non-negative number rounded down to an integer, else `fallback`. */
function nonNegInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && !out.includes(item)) out.push(item);
  }
  return out;
}

function uniqueNonNegInts(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    if (typeof item === "number" && Number.isInteger(item) && item >= 0 && !out.includes(item)) out.push(item);
  }
  return out;
}

// Own keys that are safe to assign onto a plain object.
function safeKeys(record: JsonRecord): string[] {
  return Object.keys(record).filter((k) => k !== "__proto__");
}

function normalizeWeaponMastery(value: unknown): Record<string, WeaponMasteryEntry> {
  const src = asRecord(value);
  const out: Record<string, WeaponMasteryEntry> = {};
  for (const key of safeKeys(src)) {
    const entry = src[key];
    if (!isRecord(entry)) continue;
    out[key] = {
      ...entry,
      pickups: nonNegInt(entry.pickups),
      kills: nonNegInt(entry.kills),
    };
  }
  return out;
}

function normalizeShopPurchases(value: unknown): Record<string, number> {
  const src = asRecord(value);
  const out: Record<string, number> = {};
  for (const key of safeKeys(src)) {
    const level = nonNegInt(src[key], -1);
    if (level >= 0) out[key] = level;
  }
  return out;
}

export function normalizeUnlockState(raw: unknown): UnlockState {
  const src = asRecord(raw);
  return {
    ...src,
    shards: nonNegNumber(src.shards),
    highScore: nonNegNumber(src.highScore),
    highWave: nonNegNumber(src.highWave),
    bestChain: nonNegNumber(src.bestChain),
    unlockedIds: uniqueStrings(src.unlockedIds),
    weaponMastery: normalizeWeaponMastery(src.weaponMastery),
    evolvedWeapons: uniqueStrings(src.evolvedWeapons),
    shopPurchases: normalizeShopPurchases(src.shopPurchases),
  };
}

export function normalizeAchievementState(raw: unknown): AchievementState {
  const src = asRecord(raw);
  return {
    ...src,
    unlockedIds: uniqueStrings(src.unlockedIds),
    totalKills: nonNegInt(src.totalKills),
    bossesDefeated: nonNegInt(src.bossesDefeated),
    weaponsUsed: uniqueStrings(src.weaponsUsed),
    themesUsed: uniqueStrings(src.themesUsed),
    totalPickups: nonNegInt(src.totalPickups),
  };
}

export function normalizeLevelProgress(raw: unknown): LevelProgress {
  const src = asRecord(raw);
  return {
    ...src,
    completedIds: uniqueNonNegInts(src.completedIds),
  };
}
