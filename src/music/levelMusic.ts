/**
 * The palette a level run plays: the player's theme (or the level's theme, if the player has
 * unlocked it) with the level's tempo, key, mode and progression on top.
 * Pure TypeScript (no Phaser, Tone or DOM), unit-testable.
 */
import type { LevelMusic } from "../systems/Levels";
import { getPalette, type Palette } from "./palettes";

/**
 * `music` must already be normalized (LevelValidation.normalizeLevelMusic), so every field is valid.
 * Instruments always come from the chosen theme; the result is a new palette object (the shared
 * palettes are frozen) unless the level changes nothing.
 */
export function levelPalette(
  playerPalette: Palette,
  music: LevelMusic | undefined,
  isThemeUnlocked: (id: string) => boolean,
): Palette {
  if (!music) return playerPalette;
  const theme = music.theme;
  const base = theme && theme !== playerPalette.id && isThemeUnlocked(theme) ? getPalette(theme) : playerPalette;
  const out: Palette = { ...base };
  if (music.bpm !== undefined) out.bpm = music.bpm;
  if (music.key !== undefined) out.key = music.key;
  if (music.mode !== undefined) out.mode = music.mode;
  if (music.progression !== undefined) out.progression = music.progression;
  const changed = out.bpm !== base.bpm || out.key !== base.key || out.mode !== base.mode || out.progression !== base.progression;
  return changed ? out : base;
}
