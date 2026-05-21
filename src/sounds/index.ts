export type { SoundTheme } from "./SoundTheme";
export { theremin } from "./theremin";
export { guitar } from "./guitar";
export { bell } from "./bell";
export { synth } from "./synth";
export { ethereal } from "./ethereal";
export { piano } from "./piano";

import { theremin } from "./theremin";
import { guitar } from "./guitar";
import { bell } from "./bell";
import { synth } from "./synth";
import { ethereal } from "./ethereal";
import { piano } from "./piano";
import type { SoundTheme } from "./SoundTheme";

export const allThemes: SoundTheme[] = [theremin, guitar, bell, synth, ethereal, piano];
