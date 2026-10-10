// Endless waves as song sections: budgets, the live-enemy cap and the per-bar spawn plan.
// Pure TypeScript (no Phaser), so the rules are unit-testable.
import type { EnemyType } from "../objects/enemies/registry";

/** An endless wave is a section of this many bars. */
export const SECTION_BARS = 8;
/** A boss wave warns for this many bars; the boss arrives on the next downbeat. */
export const BOSS_WARNING_BARS = 2;
/** Most enemies one wave can spawn in total. */
export const MAX_WAVE_ENEMIES = 150;
/** Most enemies alive at once, whatever the wave. */
export const MAX_LIVE_ENEMIES = 80;
/**
 * Share of a regular wave's budget that enters on its first downbeat: the section's big entrance
 * (wave 1 opens with 21 enemies; with weights alone it opened with 10, against the old game's 42 at
 * once). The rest stays front-loaded across the remaining bars.
 */
export const OPENING_SHARE = 0.4;

/** Every fifth wave from wave 5 is a boss wave. */
export function isBossWave(wave: number): boolean {
  return wave >= 5 && wave % 5 === 0;
}

/** The boss of a boss wave: the Phantom on every tenth wave, else the Sentinel. */
export function bossForWave(wave: number): EnemyType {
  return wave >= 10 && wave % 10 === 0 ? "phantom" : "sentinel";
}

/**
 * Enemies a wave spawns in total: 40 + 12·wave (README: "spawn more enemies"; was 32 + 10·wave),
 * scaled by the mutators' count multiplier, at most 150 (reached at wave 10).
 */
export function waveBudget(wave: number, countMult = 1): number {
  const mult = Number.isFinite(countMult) && countMult > 0 ? countMult : 1;
  return Math.min(MAX_WAVE_ENEMIES, Math.max(0, Math.floor((40 + wave * 12) * mult)));
}

/** Most enemies alive at once during a wave: 30 + 2·wave, at most 80. */
export function liveEnemyCap(wave: number): number {
  return Math.min(MAX_LIVE_ENEMIES, 30 + 2 * Math.max(0, Math.floor(wave)));
}

/**
 * Share of the budget due by the end of section bar `barIndex` (0-based). The first downbeat brings
 * OPENING_SHARE; the rest is front-loaded over bars 1 … bars−1, bar j weighing `bars − j`. With 8
 * bars: 0.4, then 0.4 + 0.6 × 7/28, 0.4 + 0.6 × 13/28 … 1.
 */
export function sectionShare(barIndex: number, bars = SECTION_BARS): number {
  const n = Math.max(1, Math.floor(bars));
  if (!(barIndex >= 0)) return 0;
  if (barIndex >= n - 1) return 1;
  const m = n - 1;
  const k = Math.floor(barIndex);
  return OPENING_SHARE + ((1 - OPENING_SHARE) * (k * (2 * m - k + 1))) / (m * (m + 1));
}

/** Enemies that should have spawned by the end of section bar `barIndex`. */
export function sectionQuota(total: number, barIndex: number, bars = SECTION_BARS): number {
  return Math.min(total, Math.ceil(total * sectionShare(barIndex, bars) - 1e-9));
}

export interface GroupInput {
  /** The wave's budget right now. */
  total: number;
  /** Enemies the section has spawned so far. */
  spawned: number;
  barIndex: number;
  /** Enemies alive now. */
  live: number;
  cap: number;
  bars?: number;
}

/**
 * The group for a section downbeat: what the quota still owes (so a group deferred by the cap is
 * carried into the next bar), limited to the room left under the live cap.
 */
export function groupSize(o: GroupInput): number {
  const owed = Math.max(0, sectionQuota(o.total, o.barIndex, o.bars) - o.spawned);
  const room = Math.max(0, Math.floor(o.cap) - Math.max(0, o.live));
  return Math.min(owed, room);
}

/** Asteroids per (non-boss) wave: 1 + ⌊wave/2⌋. */
export function asteroidCount(wave: number): number {
  return 1 + Math.floor(Math.max(0, wave) / 2);
}

/** The section bar each of `count` asteroids arrives on, spread evenly across the section from bar 0. */
export function asteroidBars(count: number, bars = SECTION_BARS): number[] {
  const n = Math.max(0, Math.floor(count));
  return Array.from({ length: n }, (_, j) => Math.floor((j * bars) / n));
}

export interface BarSpawns {
  enemies: number;
  asteroids: number;
  boss: EnemyType | null;
}

const NOTHING: Readonly<BarSpawns> = Object.freeze({ enemies: 0, asteroids: 0, boss: null });

/**
 * One endless wave as a section that starts on bar `startBar`. Call onBar() on every bar line: it
 * says what to spawn on that downbeat.
 * - Regular waves: the budget in front-loaded groups across SECTION_BARS bars, never above the live
 *   cap (a capped group waits for the next bar), and the asteroids spread across the section.
 * - Boss waves: nothing during the BOSS_WARNING_BARS-bar warning, then the boss on the downbeat.
 */
export class SectionPlan {
  readonly boss: EnemyType | null;
  private enemiesSpawned = 0;
  private asteroidsSpawned = 0;
  private bossSpawned = false;
  private readonly asteroidSchedule: number[];

  constructor(
    readonly wave: number,
    readonly startBar: number,
  ) {
    this.boss = isBossWave(wave) ? bossForWave(wave) : null;
    this.asteroidSchedule = this.boss ? [] : asteroidBars(asteroidCount(wave));
  }

  get spawned(): number {
    return this.enemiesSpawned;
  }

  /** Bar index within the section of absolute bar `bar`. */
  barIndex(bar: number): number {
    return bar - this.startBar;
  }

  /** On a bar line: what to spawn. `live` = enemies alive now, `countMult` = the mutators' count multiplier. */
  onBar(bar: number, live: number, countMult = 1): BarSpawns {
    const i = this.barIndex(bar);
    if (i < 0) return { ...NOTHING };
    if (this.boss) {
      if (this.bossSpawned || i < BOSS_WARNING_BARS) return { ...NOTHING };
      this.bossSpawned = true;
      return { enemies: 0, asteroids: 0, boss: this.boss };
    }
    const enemies = groupSize({
      total: waveBudget(this.wave, countMult),
      spawned: this.enemiesSpawned,
      barIndex: i,
      live,
      cap: liveEnemyCap(this.wave),
    });
    this.enemiesSpawned += enemies;
    let asteroids = 0;
    while (this.asteroidsSpawned < this.asteroidSchedule.length && this.asteroidSchedule[this.asteroidsSpawned] <= i) {
      this.asteroidsSpawned++;
      asteroids++;
    }
    return { enemies, asteroids, boss: null };
  }

  /** Everything the section spawns has spawned (the wave ends once the field is clear too). */
  isSpent(countMult = 1): boolean {
    if (this.boss) return this.bossSpawned;
    return this.enemiesSpawned >= waveBudget(this.wave, countMult) && this.asteroidsSpawned >= this.asteroidSchedule.length;
  }
}
