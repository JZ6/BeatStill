import { options } from "./GameOptions";

export function isMobile(): boolean {
  if (options.controls === 1) return false;
  if (options.controls === 2) return true;
  return "ontouchstart" in window && navigator.maxTouchPoints > 0;
}

const QUALITY_MAP: Record<number, number> = { 0: 480, 1: 720, 2: 1080, 3: 1440 };

function computeDimensions(quality: number): { w: number; h: number } {
  const base = QUALITY_MAP[quality] ?? 720;
  const aspect = window.innerWidth / window.innerHeight;
  if (aspect >= 1) return { w: Math.round(base * aspect), h: base };
  return { w: base, h: Math.round(base / aspect) };
}

export let GAME_W = 1280;
export let GAME_H = 720;

export function initDimensions(quality: number) {
  const { w, h } = computeDimensions(quality);
  GAME_W = w;
  GAME_H = h;
}
