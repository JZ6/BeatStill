export interface SpawnParams {
  /** Conductor tempo multiplier: every rhythm grid (enemy fire, player fire, bosses) follows the tempo. */
  tempoMult: number;
  enemySpeedMult: number;
  /** Rhythmic density of enemy fire patterns: 1 = as written, 2 = twice the hits per bar (Enemy.setRhythmDensity). */
  enemyRhythmDensity: number;
  enemyCountMult: number;
  enemyHpMult: number;
}

export interface WaveMutatorDef {
  id: string;
  name: string;
  description: string;
  apply: (params: SpawnParams) => void;
}

export const ALL_MUTATORS: WaveMutatorDef[] = [
  {
    id: "double_time", name: "Double Time",
    description: "Tempo ×1.2: every rhythm speeds up, and enemies move faster",
    apply: (p) => {
      p.tempoMult *= 1.2;
      p.enemySpeedMult *= 1.25;
    },
  },
  {
    id: "bullet_storm", name: "Bullet Storm",
    description: "Enemies fire twice as fast",
    // Double density: each fire pattern gains a hit midway between its hits.
    apply: (p) => { p.enemyRhythmDensity *= 2; },
  },
  {
    id: "swarm_tide", name: "Swarm Tide",
    description: "More enemies per wave",
    apply: (p) => { p.enemyCountMult *= 1.5; },
  },
  {
    id: "fragile", name: "Fragile",
    description: "All enemies have 1 HP",
    apply: (p) => { p.enemyHpMult = 0; },
  },
  {
    id: "armored", name: "Armored",
    description: "Enemies have more HP",
    apply: (p) => { p.enemyHpMult *= 1.5; },
  },
];

// Pairs of mutators that contradict each other and must never be active together.
const EXCLUSIVE_MUTATORS: [string, string][] = [
  ["fragile", "armored"],
];

/** A rolled mutator is a section change: it switches on at the next phrase boundary, a bar line every this many bars. */
export const MUTATOR_PHRASE_BARS = 4;
/** Each activation modulates the harmony up this many semitones (a whole step)… */
export const MODULATION_STEP = 2;
/** …keeping the key within this many semitones of the home key. */
export const MAX_KEY_OFFSET = 5;

/**
 * The key offset (semitones from the home key) after a section change: up a whole step, wrapping
 * into [−range, range] past the top. From home: 0, 2, 4, −5, −3, −1, 1, 3, 5, −4, −2, 0 … so the key
 * always rises (a whole step, or a minor third at a wrap) and never strays to the tritone.
 */
export function nextKeyOffset(offset: number, step = MODULATION_STEP, range = MAX_KEY_OFFSET): number {
  const r = Math.max(0, Math.floor(range));
  const span = 2 * r + 1;
  const start = Number.isFinite(offset) ? Math.round(offset) : 0;
  const shifted = (((start + Math.round(step) + r) % span) + span) % span;
  return shifted - r;
}

/** Endless waves that roll a new mutator: wave 6, then every 5 waves (11, 16, 21, …). */
export function isMutatorWave(wave: number): boolean {
  return wave === 6 || (wave > 6 && (wave - 1) % 5 === 0);
}

function areExclusive(a: string, b: string): boolean {
  return EXCLUSIVE_MUTATORS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

interface QueuedMutator {
  mutator: WaveMutatorDef;
  /** Conductor tick it switches on at. */
  tick: number;
}

export class MutatorSystem {
  private activeMutators: WaveMutatorDef[] = [];
  private queued: QueuedMutator[] = [];

  /** Activates `m` at once. */
  addMutator(m: WaveMutatorDef) {
    this.activeMutators.push(m);
  }

  /** Queues `m` to switch on at conductor tick `tick` (a phrase boundary). */
  queueMutator(m: WaveMutatorDef, tick: number) {
    this.queued.push({ mutator: m, tick });
  }

  /** Activates and returns every queued mutator due by `tick`, in the order they were queued. */
  activateDue(tick: number): WaveMutatorDef[] {
    if (this.queued.length === 0) return [];
    const due = this.queued.filter((q) => tick >= q.tick);
    if (due.length === 0) return [];
    this.queued = this.queued.filter((q) => !(tick >= q.tick));
    for (const q of due) this.activeMutators.push(q.mutator);
    return due.map((q) => q.mutator);
  }

  /** Parameters from the active mutators (queued ones don't count yet). */
  getActiveParams(): SpawnParams {
    const params: SpawnParams = {
      tempoMult: 1,
      enemySpeedMult: 1,
      enemyRhythmDensity: 1,
      enemyCountMult: 1,
      enemyHpMult: 1,
    };
    for (const m of this.activeMutators) m.apply(params);
    return params;
  }

  /** A random mutator that is neither active nor queued and doesn't contradict one that is, or null. */
  rollMutator(): WaveMutatorDef | null {
    const taken = [...this.activeMutators, ...this.queued.map((q) => q.mutator)];
    const available = ALL_MUTATORS.filter((m) => !taken.some((a) => a.id === m.id || areExclusive(a.id, m.id)));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  getActive(): WaveMutatorDef[] {
    return [...this.activeMutators];
  }

  /** Rolled mutators waiting for their phrase boundary, with the tick each switches on at. */
  getQueued(): { mutator: WaveMutatorDef; tick: number }[] {
    return this.queued.map((q) => ({ ...q }));
  }

  reset() {
    this.activeMutators = [];
    this.queued = [];
  }
}
