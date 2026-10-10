import type { LevelDef } from "./Levels";
import { normalizeLevelDef } from "./LevelValidation";

const STORAGE_KEY = "beatstill_custom_levels";
const EDITOR_KEY = "beatstill_editor";
const NEXT_ID_KEY = "beatstill_custom_next_id";
const FIRST_CUSTOM_ID = 1000;

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function writeLevels(levels: LevelDef[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(levels)); } catch {}
}

export function saveCustomLevel(level: LevelDef) {
  const levels = loadCustomLevels();
  const idx = levels.findIndex((l) => l.id === level.id);
  if (idx >= 0) levels[idx] = level;
  else levels.push(level);
  writeLevels(levels);
  // Imported levels may carry ids the counter hasn't reached yet.
  raiseNextId(level.id + 1);
}

/** Loads saved custom levels, dropping entries that fail validation. */
export function loadCustomLevels(): LevelDef[] {
  const parsed = readJson(STORAGE_KEY);
  if (!Array.isArray(parsed)) return [];
  const levels: LevelDef[] = [];
  for (const entry of parsed) {
    const level = normalizeLevelDef(entry);
    if (level) levels.push(level);
  }
  return levels;
}

export function deleteCustomLevel(id: number) {
  const all = loadCustomLevels();
  // Persist the counter first so a legacy save (no counter yet) can't hand this id out again.
  raiseNextId(maxUsedId(all) + 1);
  writeLevels(all.filter((l) => l.id !== id));
}

function readNextId(): number {
  try {
    const n = Number(localStorage.getItem(NEXT_ID_KEY));
    if (Number.isInteger(n) && n >= FIRST_CUSTOM_ID) return n;
  } catch {}
  return FIRST_CUSTOM_ID;
}

function writeNextId(n: number) {
  try { localStorage.setItem(NEXT_ID_KEY, String(n)); } catch {}
}

function raiseNextId(min: number) {
  const target = Math.floor(min);
  if (Number.isFinite(target) && target > readNextId()) writeNextId(target);
}

/** Highest id in use by saved levels or the editor draft (at least FIRST_CUSTOM_ID - 1). */
function maxUsedId(levels: LevelDef[]): number {
  let max = FIRST_CUSTOM_ID - 1;
  for (const l of levels) max = Math.max(max, Math.floor(l.id));
  const editor = loadEditorState();
  if (editor) max = Math.max(max, Math.floor(editor.id));
  return max;
}

/**
 * Allocates a fresh custom level id. The counter is persisted, so ids are never
 * reused after a delete; when it is absent it starts at max existing id + 1 (>= 1000).
 */
export function nextCustomId(): number {
  const id = Math.max(readNextId(), maxUsedId(loadCustomLevels()) + 1);
  writeNextId(id + 1);
  return id;
}

export function saveEditorState(state: LevelDef) {
  try { localStorage.setItem(EDITOR_KEY, JSON.stringify(state)); } catch {}
}

/** Loads the editor draft, or null when missing or invalid. */
export function loadEditorState(): LevelDef | null {
  return normalizeLevelDef(readJson(EDITOR_KEY));
}
