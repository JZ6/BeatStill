export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const ALL_RELICS: RelicDef[] = [
  { id: "metronome",  name: "Metronome",    icon: "♩", description: "Chain window +50%, radius -50%" },
  { id: "glass",      name: "Glass Cannon",  icon: "☠", description: "1 HP max, damage x3" },
  { id: "vampiric",   name: "Vampiric",      icon: "♥", description: "15% chance kills heal 1 HP" },
  { id: "overclock",  name: "Overclock",     icon: "⚡", description: "Fire rate x2, bullet lifetime halved" },
  { id: "ricochet",   name: "Ricochet",      icon: "◇", description: "Bullets bounce off screen edges" },
  { id: "timewarp",   name: "Time Warp",     icon: "◈", description: "Frozen time slows enemy bullets to 10%" },
  { id: "magnetism",  name: "Magnetism",     icon: "⊕", description: "All pickups auto-collect" },
];

export class RelicSystem {
  private activeRelics = new Set<string>();

  hasRelic(id: string): boolean {
    return this.activeRelics.has(id);
  }

  addRelic(id: string) {
    this.activeRelics.add(id);
  }

  getActive(): RelicDef[] {
    return ALL_RELICS.filter((r) => this.activeRelics.has(r.id));
  }

  reset() {
    this.activeRelics.clear();
  }

  pickChoices(count = 3): RelicDef[] {
    const available = ALL_RELICS.filter((r) => !this.activeRelics.has(r.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}
