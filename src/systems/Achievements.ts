import { getState, isWeaponMastered, addShards } from "./Unlocks";
import { allThemes } from "../sounds";

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "milestone" | "mastery" | "discovery";
  reward: number;
  check: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  runKills: number;
  wave: number;
  score: number;
  bestChain: number;
  hp: number;
  maxHp: number;
  freezeTime: number;
  bossFightDamageTaken: number;
  levelDamageTaken: number;
  bossJustKilled: boolean;
  levelJustCompleted: boolean;
}

export interface AchievementState {
  unlockedIds: string[];
  totalKills: number;
  bossesDefeated: number;
  weaponsUsed: string[];
  themesUsed: string[];
}

const STORAGE_KEY = "beatstill_achievements";

const DEFAULT_STATE: AchievementState = {
  unlockedIds: [],
  totalKills: 0,
  bossesDefeated: 0,
  weaponsUsed: [],
  themesUsed: [],
};

let state: AchievementState;

function loadState(): AchievementState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_STATE, unlockedIds: [], weaponsUsed: [], themesUsed: [] };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

state = loadState();

export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  // --- Milestones ---
  {
    id: "first_blood", name: "First Blood", icon: "†",
    description: "Kill your first enemy",
    category: "milestone", reward: 5,
    check: () => state.totalKills >= 1,
  },
  {
    id: "centurion", name: "Centurion", icon: "100",
    description: "Kill 100 enemies in a single run",
    category: "milestone", reward: 10,
    check: (ctx) => ctx.runKills >= 100,
  },
  {
    id: "survivor", name: "Survivor", icon: "W10",
    description: "Reach wave 10",
    category: "milestone", reward: 8,
    check: (ctx) => ctx.wave >= 10,
  },
  {
    id: "veteran", name: "Veteran", icon: "W20",
    description: "Reach wave 20",
    category: "milestone", reward: 15,
    check: (ctx) => ctx.wave >= 20,
  },
  {
    id: "high_roller", name: "High Roller", icon: "50K",
    description: "Score 50,000 points in a single run",
    category: "milestone", reward: 12,
    check: (ctx) => ctx.score >= 50000,
  },
  {
    id: "boss_slayer", name: "Boss Slayer", icon: "!!!",
    description: "Defeat a boss",
    category: "milestone", reward: 10,
    check: () => state.bossesDefeated >= 1,
  },

  // --- Mastery ---
  {
    id: "chain_master", name: "Chain Master", icon: "x15",
    description: "Reach a 15-kill chain",
    category: "mastery", reward: 15,
    check: (ctx) => ctx.bestChain >= 15,
  },
  {
    id: "crescendo", name: "Crescendo", icon: "MAX",
    description: "Reach CRESCENDO tier",
    category: "mastery", reward: 25,
    check: (ctx) => ctx.bestChain >= 25,
  },
  {
    id: "untouchable", name: "Untouchable", icon: "0HP",
    description: "Defeat a boss without taking damage",
    category: "mastery", reward: 20,
    check: (ctx) => ctx.bossJustKilled && ctx.bossFightDamageTaken === 0,
  },
  {
    id: "glass_cannon", name: "Glass Cannon", icon: "1HP",
    description: "Reach wave 5 at 1 HP",
    category: "mastery", reward: 15,
    check: (ctx) => ctx.wave >= 5 && ctx.hp === 1,
  },
  {
    id: "time_lord", name: "Time Lord", icon: "||>",
    description: "Freeze time for 60 seconds in one run",
    category: "mastery", reward: 20,
    check: (ctx) => ctx.freezeTime >= 60,
  },
  {
    id: "perfectionist", name: "Perfectionist", icon: "S+",
    description: "Complete a level without taking damage",
    category: "mastery", reward: 25,
    check: (ctx) => ctx.levelJustCompleted && ctx.levelDamageTaken === 0,
  },

  // --- Discovery ---
  {
    id: "arsenal", name: "Arsenal", icon: "ALL",
    description: "Pick up every weapon type",
    category: "discovery", reward: 20,
    check: () => state.weaponsUsed.length >= 4,
  },
  {
    id: "collector", name: "Collector", icon: "200",
    description: "Collect 200 total pickups",
    category: "discovery", reward: 15,
    check: () => getState().shards >= 200,
  },
  {
    id: "weapon_master", name: "Weapon Master", icon: "WPN",
    description: "Master all four weapons",
    category: "discovery", reward: 30,
    check: () => ["shotgun", "laser", "cannon", "homing"].every(isWeaponMastered),
  },
  {
    id: "virtuoso", name: "Virtuoso", icon: "♫♫",
    description: "Play with every music theme",
    category: "discovery", reward: 20,
    check: () => state.themesUsed.length >= allThemes.length,
  },
];

export function getAchievementState(): AchievementState {
  return state;
}

export function isAchievementUnlocked(id: string): boolean {
  return state.unlockedIds.includes(id);
}

export function addKill() {
  state.totalKills++;
  saveState();
}

export function addBossDefeat() {
  state.bossesDefeated++;
  saveState();
}

export function recordWeaponUsed(weaponId: string) {
  if (weaponId === "standard") return;
  if (!state.weaponsUsed.includes(weaponId)) {
    state.weaponsUsed.push(weaponId);
    saveState();
  }
}

export function recordThemeUsed(themeId: string) {
  if (!state.themesUsed.includes(themeId)) {
    state.themesUsed.push(themeId);
    saveState();
  }
}

export function checkAchievements(ctx: AchievementContext): AchievementDef[] {
  const newlyUnlocked: AchievementDef[] = [];
  for (const a of ALL_ACHIEVEMENTS) {
    if (state.unlockedIds.includes(a.id)) continue;
    if (a.check(ctx)) {
      state.unlockedIds.push(a.id);
      addShards(a.reward);
      newlyUnlocked.push(a);
    }
  }
  if (newlyUnlocked.length > 0) saveState();
  return newlyUnlocked;
}
