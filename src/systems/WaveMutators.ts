export interface SpawnParams {
  enemySpeedMult: number;
  enemyFireRateMult: number;
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
    apply: (p) => { p.enemyFireRateMult *= 0.5; },
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

export class MutatorSystem {
  private activeMutators: WaveMutatorDef[] = [];

  addMutator(m: WaveMutatorDef) {
    this.activeMutators.push(m);
  }

  getActiveParams(): SpawnParams {
    const params: SpawnParams = {
      enemySpeedMult: 1,
      enemyFireRateMult: 1,
      enemyCountMult: 1,
      enemyHpMult: 1,
    };
    for (const m of this.activeMutators) m.apply(params);
    return params;
  }

  rollMutator(): WaveMutatorDef | null {
    const available = ALL_MUTATORS.filter(
      (m) => !this.activeMutators.some((a) => a.id === m.id),
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
