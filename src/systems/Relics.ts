export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  description: string;
}

/**
 * Relics (one pick per elite kill). Musical ones:
 * - metronome: a kill within ±1/8 beat of a beat adds +1 chain and scores ×1.5 (ChainSystem).
 * - overclock: halves the fire interval (an octave faster, never below a 32nd) and bullet lifetime (Ship).
 * - timewarp: enemy bullets run at 10% speed while time is nearly frozen (GameScene).
 */
export const ALL_RELICS: RelicDef[] = [
  { id: "metronome",  name: "Metronome",    icon: "♩", description: "Kills on the beat: +1 chain, score x1.5" },
  { id: "glass",      name: "Glass Cannon",  icon: "☠", description: "1 HP max, damage x3" },
  { id: "vampiric",   name: "Vampiric",      icon: "♥", description: "15% chance kills heal 1 HP" },
  { id: "overclock",  name: "Overclock",     icon: "⚡", description: "Double-time fire (half the note value), bullet lifetime halved" },
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
