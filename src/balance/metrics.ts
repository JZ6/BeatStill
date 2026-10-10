/**
 * Balance metrics computed from the data tables: weapon fire rate and damage per palette tempo,
 * enemy bullet density per rhythm pattern (with and without Bullet Storm), time per kill, and the
 * time-dilation response, each next to the pre-overhaul baseline (the millisecond timers on
 * `main`). Pure TypeScript (no Phaser, Tone or DOM): unit-tested, and printed by `npm run balance`.
 *
 * Conventions
 * - Conductor time is game time (both run at the time scale), so a pattern step at `bpm` lasts
 *   stepSeconds(bpm) game seconds, directly comparable to the old game-time ms timers.
 * - "DPS" assumes every bullet of a shot lands; "single-target" assumes one bullet per shot does.
 * - Time per kill streams shots at one target: shots needed × the fire interval.
 */
import { STEPS_PER_BEAT, TICKS_PER_BEAT } from "../core/Conductor";
import { DEFAULT_DILATION, TimeDilation, type DilationInput, type DilationTuning } from "../core/TimeDilation";
import { fireIntervalTicks, noteName } from "../music/noteValues";
import { ALL_PALETTES } from "../music/palettes";
import { doubleDensity } from "../music/patterns";
import { ENEMY_DEFS, enemyDef, phaseCount, rhythmHits, type EnemyType } from "../objects/enemies/registry";
import { volleyFor } from "../objects/enemies/volleys";
import { ALL_EVOLUTIONS } from "../systems/Evolutions";
import { ALL_UPGRADES, baseStats, type PlayerStats } from "../systems/Upgrades";
import { ALL_WEAPONS, type WeaponDef } from "../systems/Weapons";
import { shotProfile } from "../systems/weaponMath";

/** The mid tempo balance targets are measured at (palettes run 80–120 bpm, the campaign 92–128). */
export const REFERENCE_BPM = 105;

// ---------------------------------------------------------------------------------------------
// Pre-overhaul baseline (`git show main:src/systems/Weapons.ts`, `main:src/objects/enemies/*.ts`)
// ---------------------------------------------------------------------------------------------

export interface LegacyWeapon {
  /** Game-time ms between shots. */
  cooldownMs: number;
  bulletCount: number;
  damageMultiplier: number;
  pierce: number;
  speed: number;
  /** Game-time ms a bullet lives (0: until it leaves the screen). */
  lifetime: number;
}

export const LEGACY_WEAPONS: Readonly<Record<string, LegacyWeapon>> = Object.freeze({
  standard: { cooldownMs: 220, bulletCount: 1, damageMultiplier: 1, pierce: 0, speed: 450, lifetime: 0 },
  shotgun: { cooldownMs: 450, bulletCount: 3, damageMultiplier: 1, pierce: 0, speed: 380, lifetime: 800 },
  laser: { cooldownMs: 130, bulletCount: 1, damageMultiplier: 0.5, pierce: 2, speed: 900, lifetime: 0 },
  cannon: { cooldownMs: 600, bulletCount: 1, damageMultiplier: 3, pierce: 0, speed: 260, lifetime: 0 },
  homing: { cooldownMs: 280, bulletCount: 1, damageMultiplier: 0.7, pierce: 0, speed: 300, lifetime: 0 },
  nova: { cooldownMs: 550, bulletCount: 5, damageMultiplier: 1.2, pierce: 0, speed: 380, lifetime: 600 },
  railgun: { cooldownMs: 180, bulletCount: 1, damageMultiplier: 0.8, pierce: 10, speed: 1500, lifetime: 0 },
  nuke: { cooldownMs: 1200, bulletCount: 1, damageMultiplier: 8, pierce: 3, speed: 150, lifetime: 2000 },
  swarm: { cooldownMs: 320, bulletCount: 2, damageMultiplier: 0.6, pierce: 0, speed: 320, lifetime: 0 },
  minigun: { cooldownMs: 70, bulletCount: 1, damageMultiplier: 0.4, pierce: 0, speed: 530, lifetime: 0 },
});

/** Old Rapid Fire: −15 ms per level over 6 levels, never below 30 ms. */
export const LEGACY_RAPID_FIRE_MS = 15;
export const LEGACY_RAPID_FIRE_LEVELS = 6;
export const LEGACY_MIN_COOLDOWN_MS = 30;

export interface LegacyEnemy {
  /** Game-time ms between volleys, per phase (bosses have three). */
  periodMs: readonly number[];
  /** Bullets per volley, per phase (the Pulse's ring grows with the wave: see legacyVolleyBullets). */
  bullets: readonly number[];
}

export const LEGACY_ENEMIES: Readonly<Partial<Record<EnemyType, LegacyEnemy>>> = Object.freeze({
  basic: { periodMs: [2400], bullets: [4] },
  tracker: { periodMs: [2000], bullets: [3] },
  sniper: { periodMs: [1600], bullets: [2] },
  spiral: { periodMs: [300], bullets: [4] },
  tank: { periodMs: [2800], bullets: [12] },
  swarm: { periodMs: [3200], bullets: [2] },
  snake: { periodMs: [2400], bullets: [3] },
  circler: { periodMs: [2200], bullets: [16] },
  sentinel: { periodMs: [2000, 1500, 800], bullets: [8, 15, 7] },
  phantom: { periodMs: [2500, 2000, 1500], bullets: [3, 9, 12] },
});

/** Old bullets per volley of `type` in `phase` on `wave` (the Pulse ring was min(4 + ⌊wave/2⌋, 10)). */
export function legacyVolleyBullets(type: EnemyType, phase = 1, wave = 1): number {
  const legacy = LEGACY_ENEMIES[type];
  if (!legacy) return 0;
  if (type === "basic") return Math.min(4 + Math.floor(Math.max(0, wave) / 2), 10);
  return legacy.bullets[Math.min(legacy.bullets.length, Math.max(1, Math.floor(phase))) - 1];
}

/** Old game-time ms between volleys of `type` in `phase` (Bullet Storm halved it). */
export function legacyPeriodMs(type: EnemyType, phase = 1): number | null {
  const legacy = LEGACY_ENEMIES[type];
  if (!legacy) return null;
  return legacy.periodMs[Math.min(legacy.periodMs.length, Math.max(1, Math.floor(phase))) - 1];
}

// ---------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------

/** Game seconds per 16th-note step at `bpm`. */
export function stepSeconds(bpm: number): number {
  return 60 / bpm / STEPS_PER_BEAT;
}

/** Game seconds per conductor tick at `bpm`. */
export function tickSeconds(bpm: number): number {
  return 60 / bpm / TICKS_PER_BEAT;
}

/** now / then − 1 (e.g. +0.15 = 15% more); NaN when `then` is 0. */
export function relativeChange(now: number, then: number): number {
  return then !== 0 ? now / then - 1 : Number.NaN;
}

/** Every palette's id and tempo, slowest first. */
export function paletteTempos(): { id: string; bpm: number }[] {
  return ALL_PALETTES.map((p) => ({ id: p.id, bpm: p.bpm })).sort((a, b) => a.bpm - b.bpm || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------------------------

/** In-run upgrade levels that change a weapon's output. */
export interface Loadout {
  name: string;
  /** Rapid Fire level (0–3). The old game had 6 levels: level n here stands for old level 2n. */
  rapidFire: number;
  /** Power level (0–4). */
  power: number;
  /** Multi Shot level (0–4). */
  multiShot: number;
  /** Penetration level (0–5). */
  penetration: number;
}

export const LOADOUTS: readonly Loadout[] = Object.freeze([
  { name: "base", rapidFire: 0, power: 0, multiShot: 0, penetration: 0 },
  // About one pickup of each by the first boss.
  { name: "mid", rapidFire: 1, power: 1, multiShot: 1, penetration: 1 },
  { name: "max", rapidFire: 3, power: 4, multiShot: 4, penetration: 5 },
]);

const BASE_LOADOUT = LOADOUTS[0];

/**
 * The Rapid Fire level a weapon is first held at: an evolution that replaces a weapon at max
 * Rapid Fire (the minigun) is never fired below it. 0 for every other weapon.
 */
export function acquisitionRapidFire(weaponId: string): number {
  const evo = ALL_EVOLUTIONS.find((e) => e.evolvedWeaponId === weaponId && e.requiredUpgradeId === "fireCooldown");
  return evo ? (ALL_UPGRADES.find((u) => u.id === "fireCooldown")?.maxLevel ?? 0) : 0;
}

/** Base stats as `weaponId` is first held (see acquisitionRapidFire). */
export function heldLoadout(weaponId: string): Loadout {
  return { ...BASE_LOADOUT, name: "held", rapidFire: acquisitionRapidFire(weaponId) };
}

/** Run stats with `loadout`'s upgrades applied the way pickups apply them (no shop bonuses). */
export function loadoutStats(loadout: Loadout, weaponId = "standard"): PlayerStats {
  const stats = { ...baseStats(), weaponId };
  const levels: [string, number][] = [
    ["fireCooldown", loadout.rapidFire],
    ["damage", loadout.power],
    ["bulletCount", loadout.multiShot],
    ["pierce", loadout.penetration],
  ];
  for (const [id, n] of levels) {
    const upgrade = ALL_UPGRADES.find((u) => u.id === id);
    for (let i = 0; i < n; i++) upgrade?.apply(stats);
  }
  return stats;
}

export interface WeaponMetrics {
  id: string;
  loadout: string;
  /** Note value name of the effective interval, e.g. "1/8T". */
  note: string;
  intervalTicks: number;
  shotsPerSec: number;
  bulletsPerShot: number;
  bulletsPerSec: number;
  damagePerBullet: number;
  pierce: number;
  /** Every bullet lands. */
  dps: number;
  /** One bullet per shot lands. */
  singleTargetDps: number;
  speed: number;
  /** Pixels a short-lived bullet travels (null: until it leaves the screen). */
  range: number | null;
  legacyShotsPerSec: number;
  legacyBulletsPerShot: number;
  legacyDamagePerBullet: number;
  legacyDps: number;
  legacySingleTargetDps: number;
  legacySpeed: number;
  legacyRange: number | null;
}

/** Old game-time ms between shots of `weaponId` at Rapid Fire level `rapidFire` (new levels). */
export function legacyCooldownMs(weaponId: string, rapidFire: number): number {
  const legacy = LEGACY_WEAPONS[weaponId];
  const oldLevel = Math.min(LEGACY_RAPID_FIRE_LEVELS, Math.max(0, Math.floor(rapidFire)) * 2);
  return Math.max(LEGACY_MIN_COOLDOWN_MS, legacy.cooldownMs - LEGACY_RAPID_FIRE_MS * oldLevel);
}

/** What `weapon` puts out at `bpm` with `loadout`, next to the old game's numbers. */
export function weaponMetrics(weapon: WeaponDef, bpm: number, loadout: Loadout = BASE_LOADOUT): WeaponMetrics {
  const stats = loadoutStats(loadout, weapon.id);
  const intervalTicks = fireIntervalTicks(weapon.noteTicks, stats.fireRate);
  const shotsPerSec = 1 / (intervalTicks * tickSeconds(bpm));
  const shot = shotProfile(weapon, stats);

  const legacy = LEGACY_WEAPONS[weapon.id];
  const legacyShotsPerSec = 1000 / legacyCooldownMs(weapon.id, loadout.rapidFire);
  // The old caps were absolute (5 bullets, 5 damage); without shop bonuses the levels never pass them.
  const legacyBulletsPerShot = legacy.bulletCount + Math.min(loadout.multiShot, 4);
  const legacyDamagePerBullet = Math.max(1, Math.round(legacy.damageMultiplier * Math.min(1 + loadout.power, 5)));

  return {
    id: weapon.id,
    loadout: loadout.name,
    note: noteName(intervalTicks),
    intervalTicks,
    shotsPerSec,
    bulletsPerShot: shot.count,
    bulletsPerSec: shotsPerSec * shot.count,
    damagePerBullet: shot.damage,
    pierce: shot.pierce,
    dps: shotsPerSec * shot.count * shot.damage,
    singleTargetDps: shotsPerSec * shot.damage,
    speed: shot.speed,
    range: weapon.lifetime > 0 ? (weapon.lifetime / 1000) * shot.speed : null,
    legacyShotsPerSec,
    legacyBulletsPerShot,
    legacyDamagePerBullet,
    legacyDps: legacyShotsPerSec * legacyBulletsPerShot * legacyDamagePerBullet,
    legacySingleTargetDps: legacyShotsPerSec * legacyDamagePerBullet,
    // Loadouts have no Velocity levels: the weapon's own speed.
    legacySpeed: legacy.speed,
    legacyRange: legacy.lifetime > 0 ? (legacy.lifetime / 1000) * legacy.speed : null,
  };
}

/** weaponMetrics for every weapon. */
export function allWeaponMetrics(bpm: number, loadout: Loadout = BASE_LOADOUT): WeaponMetrics[] {
  return ALL_WEAPONS.map((w) => weaponMetrics(w, bpm, loadout));
}

// ---------------------------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------------------------

export interface EnemyMetrics {
  type: EnemyType;
  /** 1-based (bosses have three). */
  phase: number;
  patternSteps: number;
  hitsPerPattern: number;
  volleysPerSec: number;
  bulletsPerVolley: number;
  bulletsPerSec: number;
  /** With the Bullet Storm mutator (double density). */
  stormBulletsPerSec: number;
  legacyBulletsPerSec: number;
  legacyStormBulletsPerSec: number;
}

const hitCount = (hits: readonly boolean[]) => hits.reduce((n, h) => n + (h ? 1 : 0), 0);

/** Bullet density of `type` (in `phase`, on `wave`) at `bpm`, next to the old timer's. */
export function enemyMetrics(type: EnemyType, bpm: number, phase = 1, wave = 1): EnemyMetrics {
  const hits = rhythmHits(type, phase);
  const hitsPerPattern = hitCount(hits);
  const rate = (pattern: readonly boolean[]) => (pattern.length > 0 ? hitCount(pattern) / pattern.length / stepSeconds(bpm) : 0);
  const volleysPerSec = rate(hits);
  const bulletsPerVolley = volleyFor(type, { phase, wave }).length;
  const period = legacyPeriodMs(type, phase);
  const legacyVolleys = period ? 1000 / period : 0;
  const legacyBullets = legacyVolleyBullets(type, phase, wave);
  return {
    type,
    phase,
    patternSteps: hits.length,
    hitsPerPattern,
    volleysPerSec,
    bulletsPerVolley,
    bulletsPerSec: volleysPerSec * bulletsPerVolley,
    stormBulletsPerSec: rate(doubleDensity(hits)) * bulletsPerVolley,
    legacyBulletsPerSec: legacyVolleys * legacyBullets,
    legacyStormBulletsPerSec: legacyVolleys * 2 * legacyBullets,
  };
}

/** Every enemy that fires (one entry per boss phase), in registry order. */
export function firingEnemies(): { type: EnemyType; phase: number }[] {
  return ENEMY_DEFS.filter((d) => !d.hidden && d.rhythm.pattern.length > 0).flatMap((d) =>
    Array.from({ length: phaseCount(d.type) }, (_, i) => ({ type: d.type, phase: i + 1 })),
  );
}

/** enemyMetrics for every firing enemy and boss phase. */
export function allEnemyMetrics(bpm: number, wave = 1): EnemyMetrics[] {
  return firingEnemies().map(({ type, phase }) => enemyMetrics(type, bpm, phase, wave));
}

// ---------------------------------------------------------------------------------------------
// Time per kill
// ---------------------------------------------------------------------------------------------

export interface KillTime {
  weaponId: string;
  enemyType: EnemyType;
  shots: number;
  seconds: number;
  legacyShots: number;
  legacySeconds: number;
}

/**
 * Streaming one bullet per shot into one `enemyType` (×3 hp when elite): shots needed and the
 * game seconds they take (shots × interval), now and in the old game.
 */
export function timePerKill(weapon: WeaponDef, enemyType: EnemyType, bpm: number, loadout: Loadout = BASE_LOADOUT, elite = false): KillTime {
  const m = weaponMetrics(weapon, bpm, loadout);
  const hp = enemyDef(enemyType).hp * (elite ? 3 : 1);
  const shots = Math.ceil(hp / m.damagePerBullet);
  const legacyShots = Math.ceil(hp / m.legacyDamagePerBullet);
  return {
    weaponId: weapon.id,
    enemyType,
    shots,
    seconds: shots / m.shotsPerSec,
    legacyShots,
    legacySeconds: legacyShots / m.legacyShotsPerSec,
  };
}

// ---------------------------------------------------------------------------------------------
// Time dilation
// ---------------------------------------------------------------------------------------------

export interface DilationResponse {
  /** Target time scale moving on the keyboard (magnitude 1) while holding fire. */
  moveFireTarget: number;
  /** Target time scale moving on the keyboard only. */
  moveOnlyTarget: number;
  /** Real seconds from the minimum to ≥ 0.95 / ≥ 0.99 while moving and firing. */
  secondsTo95: number;
  secondsTo99: number;
  /** Real seconds from full speed (1) to below 0.1 once idle. */
  idleSecondsBelow01: number;
  /** Real seconds from the move-only plateau to below 0.1 once idle. */
  idleSecondsBelow01FromMove: number;
}

const MAX_SIM_SECONDS = 10;

/** Real seconds (stepping `dt`) until `done(scale)`, starting from `start`; Infinity if never. */
function simulateDilation(tuning: DilationTuning, input: DilationInput, start: number, dt: number, done: (s: number) => boolean): number {
  const d = new TimeDilation(tuning);
  d.reset(start);
  for (let t = 0; t <= MAX_SIM_SECONDS; t += dt) {
    if (done(d.scale)) return t;
    d.update(input, dt);
  }
  return Number.POSITIVE_INFINITY;
}

/** How fast time responds to keyboard play (move + fire) and to stopping, at `dt` per frame. */
export function dilationResponse(dt = 1 / 60, tuning: DilationTuning = DEFAULT_DILATION): DilationResponse {
  const moveFire: DilationInput = { move: 1, aimSpeed: 0, firing: true };
  const moveOnly: DilationInput = { move: 1, aimSpeed: 0, firing: false };
  const idle: DilationInput = { move: 0, aimSpeed: 0, firing: false };
  const probe = new TimeDilation(tuning);
  probe.update(moveFire, 0);
  const moveFireTarget = probe.target;
  probe.update(moveOnly, 0);
  const moveOnlyTarget = probe.target;
  return {
    moveFireTarget,
    moveOnlyTarget,
    secondsTo95: simulateDilation(tuning, moveFire, tuning.min, dt, (s) => s >= 0.95),
    secondsTo99: simulateDilation(tuning, moveFire, tuning.min, dt, (s) => s >= 0.99),
    idleSecondsBelow01: simulateDilation(tuning, idle, tuning.max, dt, (s) => s < 0.1),
    idleSecondsBelow01FromMove: simulateDilation(tuning, idle, moveOnlyTarget, dt, (s) => s < 0.1),
  };
}
