import type Phaser from "phaser";

export interface GameOptions {
  targetFps: number;       // 30 | 60 | 120 | 240 | 0 = uncapped
  particleQuality: number; // max particles: 0=off, 150=low, 300=med, 500=high, 800=ultra
  bulletGlow: boolean;
  showFps: boolean;
  masterVolume: number;    // 0-100
  resolution: number;      // 0=low(480), 1=medium(720), 2=high(1080), 3=ultra(1440)
  controls: number;        // 0=auto, 1=keyboard+mouse, 2=touch
  shipColor: number;       // hex color for ship outline
  themeId: string;         // sound theme id
  starterWeapon: string;   // weapon id for run start
}

const DEFAULTS: GameOptions = {
  targetFps: 60,
  particleQuality: 500,
  bulletGlow: true,
  showFps: false,
  masterVolume: 70,
  resolution: 1,
  controls: 0,
  shipColor: 0x00ffff,
  themeId: "theremin",
  starterWeapon: "standard",
};

const STORAGE_KEY = "beatstill_options";

export function loadOptions(): GameOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function saveOptions(opts: GameOptions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {}
}

export const options: GameOptions = loadOptions();

let _game: Phaser.Game | null = null;

export function registerGame(game: Phaser.Game): void {
  _game = game;
  applyFps(options.targetFps);
}

export function applyFps(fps: number): void {
  options.targetFps = fps;
  if (!_game) return;
  _game.loop.targetFps = fps === 0 ? 9999 : fps;
}
