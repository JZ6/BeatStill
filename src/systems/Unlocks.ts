interface UnlockRequirement {
  shards?: number;
  highScore?: number;
  highWave?: number;
  bestChain?: number;
}

export interface UnlockDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "weapon" | "theme" | "upgrade" | "cosmetic";
  requirement: UnlockRequirement;
}

export interface UnlockState {
  shards: number;
  highScore: number;
  highWave: number;
  bestChain: number;
  unlockedIds: string[];
}

const STORAGE_KEY = "beatstill_unlocks";

const DEFAULT_STATE: UnlockState = {
  shards: 0,
  highScore: 0,
  highWave: 0,
  bestChain: 0,
  unlockedIds: [],
};

export const ALL_UNLOCKS: UnlockDef[] = [
  // Weapons
  { id: "weapon_shotgun", name: "Shotgun", icon: "|||", description: "Wide burst, deadly up close", category: "weapon", requirement: { shards: 5, highWave: 3 } },
  { id: "weapon_laser", name: "Laser", icon: "===", description: "Rapid needles that pierce", category: "weapon", requirement: { shards: 15, highWave: 5 } },
  { id: "weapon_cannon", name: "Cannon", icon: "(O)", description: "Slow heavy slugs", category: "weapon", requirement: { shards: 30, highScore: 20000 } },
  { id: "weapon_homing", name: "Homing", icon: "@>@", description: "Bullets seek enemies", category: "weapon", requirement: { shards: 50, highWave: 8 } },

  // Themes
  { id: "theme_guitar", name: "Guitar", icon: "♫", description: "Warm picked strings", category: "theme", requirement: { shards: 10 } },
  { id: "theme_bell", name: "Bell", icon: "♪", description: "Crystalline bell tones", category: "theme", requirement: { shards: 25, highWave: 4 } },
  { id: "theme_synth", name: "Synth", icon: "◈", description: "Electronic synth waves", category: "theme", requirement: { shards: 40, highScore: 30000 } },
  { id: "theme_ethereal", name: "Ethereal", icon: "✧", description: "Dreamy ambient pads", category: "theme", requirement: { shards: 60, highWave: 10 } },

  // Stat upgrades
  { id: "upgrade_pierce", name: "Penetration", icon: "-->", description: "Bullets pass through", category: "upgrade", requirement: { shards: 8, highWave: 3 } },
  { id: "upgrade_fireCooldown", name: "Rapid Fire", icon: "!!!", description: "Shoot faster", category: "upgrade", requirement: { shards: 12 } },
  { id: "upgrade_damage", name: "Power", icon: "DMG", description: "More damage per bullet", category: "upgrade", requirement: { shards: 20, highScore: 10000 } },

  // Ship colors
  { id: "color_red", name: "Red", icon: "●", description: "Crimson ship", category: "cosmetic", requirement: { shards: 15 } },
  { id: "color_gold", name: "Gold", icon: "●", description: "Golden ship", category: "cosmetic", requirement: { shards: 35, highScore: 25000 } },
  { id: "color_purple", name: "Purple", icon: "●", description: "Violet ship", category: "cosmetic", requirement: { shards: 50, highWave: 7 } },
  { id: "color_green", name: "Green", icon: "●", description: "Emerald ship", category: "cosmetic", requirement: { shards: 70, highWave: 12 } },
  { id: "color_white", name: "White", icon: "●", description: "Pure white ship", category: "cosmetic", requirement: { shards: 100, highScore: 50000 } },

  // Chain-gated
  { id: "color_chain", name: "Chain Gold", icon: "●", description: "Golden aura", category: "cosmetic", requirement: { bestChain: 15, shards: 30 } },
  { id: "upgrade_chainWindow", name: "Chain Sustain", icon: "◎→", description: "Extend chain timer", category: "upgrade", requirement: { bestChain: 5, shards: 10 } },
  { id: "upgrade_chainRadius", name: "Chain Reach", icon: "<◎>", description: "Chain across distance", category: "upgrade", requirement: { bestChain: 8, shards: 15 } },
];

export const SHIP_COLORS: Record<string, number> = {
  default: 0x00ffff,
  color_red: 0xff4444,
  color_gold: 0xffcc44,
  color_purple: 0xaa44ff,
  color_green: 0x44ff88,
  color_white: 0xffffff,
  color_chain: 0xffdd44,
};

let state: UnlockState;

export function loadState(): UnlockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_STATE, unlockedIds: [] };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

state = loadState();

export function getState(): UnlockState {
  return state;
}

export function isUnlocked(id: string): boolean {
  return state.unlockedIds.includes(id);
}

function meetsRequirement(req: UnlockRequirement): boolean {
  if (req.shards != null && state.shards < req.shards) return false;
  if (req.highScore != null && state.highScore < req.highScore) return false;
  if (req.highWave != null && state.highWave < req.highWave) return false;
  if (req.bestChain != null && state.bestChain < req.bestChain) return false;
  return true;
}

export function checkNewUnlocks(): UnlockDef[] {
  const newlyUnlocked: UnlockDef[] = [];
  for (const def of ALL_UNLOCKS) {
    if (state.unlockedIds.includes(def.id)) continue;
    if (meetsRequirement(def.requirement)) {
      state.unlockedIds.push(def.id);
      newlyUnlocked.push(def);
    }
  }
  if (newlyUnlocked.length > 0) saveState();
  return newlyUnlocked;
}

export function addShards(count: number) {
  state.shards += count;
  saveState();
}

export function updateHighScore(score: number) {
  if (score > state.highScore) {
    state.highScore = score;
    saveState();
  }
}

export function updateHighWave(wave: number) {
  if (wave > state.highWave) {
    state.highWave = wave;
    saveState();
  }
}

export function updateBestChain(chain: number) {
  if (chain > state.bestChain) {
    state.bestChain = chain;
    saveState();
  }
}

export function requirementText(req: UnlockRequirement): string {
  const parts: string[] = [];
  if (req.shards != null) parts.push(`${req.shards} ◆`);
  if (req.highScore != null) parts.push(`${(req.highScore / 1000).toFixed(0)}k score`);
  if (req.highWave != null) parts.push(`Wave ${req.highWave}`);
  if (req.bestChain != null) parts.push(`Chain ${req.bestChain}`);
  return parts.join(" + ");
}
