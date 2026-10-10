export interface SpawnParams {
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
    description: "Enemies move faster",
    apply: (p) => { p.enemySpeedMult *= 1.5; },
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

/** Endless waves that roll a new mutator: wave 6, then every 5 waves (11, 16, 21, …). */
export function isMutatorWave(wave: number): boolean {
  return wave === 6 || (wave > 6 && (wave - 1) % 5 === 0);
}

function areExclusive(a: string, b: string): boolean {
  return EXCLUSIVE_MUTATORS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export class MutatorSystem {
  private activeMutators: WaveMutatorDef[] = [];

  addMutator(m: WaveMutatorDef) {
    this.activeMutators.push(m);
  }

  getActiveParams(): SpawnParams {
    const params: SpawnParams = {
      enemySpeedMult: 1,
      enemyRhythmDensity: 1,
      enemyCountMult: 1,
      enemyHpMult: 1,
    };
    for (const m of this.activeMutators) m.apply(params);
    return params;
  }

  rollMutator(): WaveMutatorDef | null {
    const available = ALL_MUTATORS.filter(
      (m) => !this.activeMutators.some((a) => a.id === m.id || areExclusive(a.id, m.id)),
    );
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  getActive(): WaveMutatorDef[] {
    return [...this.activeMutators];
  }

  reset() {
    this.activeMutators = [];
  }
}
