import type { LevelDef } from "./Levels";

const STORAGE_KEY = "beatstill_custom_levels";
const EDITOR_KEY = "beatstill_editor";

export function saveCustomLevel(level: LevelDef) {
  const levels = loadCustomLevels();
  const idx = levels.findIndex((l) => l.id === level.id);
  if (idx >= 0) levels[idx] = level;
  else levels.push(level);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(levels)); } catch {}
}

export function loadCustomLevels(): LevelDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function deleteCustomLevel(id: number) {
  const levels = loadCustomLevels().filter((l) => l.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(levels)); } catch {}
}

export function nextCustomId(): number {
  const levels = loadCustomLevels();
  if (levels.length === 0) return 1000;
  return Math.max(...levels.map((l) => l.id)) + 1;
}

export function saveEditorState(state: LevelDef) {
  try { localStorage.setItem(EDITOR_KEY, JSON.stringify(state)); } catch {}
}

export function loadEditorState(): LevelDef | null {
  try {
    const raw = localStorage.getItem(EDITOR_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
