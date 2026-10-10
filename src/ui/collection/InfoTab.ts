import { ALL_RELICS } from "../../systems/Relics";
import { ALL_MUTATORS } from "../../systems/WaveMutators";
import { ROLE_LABELS } from "../../music/palettes";
import { ENEMY_DEFS, phaseCount, rhythmHits, rhythmPattern, rhythmPreview, shapeLabel, type EnemyDef } from "../../objects/enemies/registry";
import { hexColor, addStatRow } from "../CollectionOverlay";

const MUTATOR_ICONS: Record<string, string> = {
  double_time: ">>", bullet_storm: "!!", swarm_tide: "++", fragile: "--", armored: "##",
};

/** Steps shown per rhythm row: one 4/4 bar of 16ths. */
const GRID_STEPS = 16;
const STEPS_PER_BEAT = 4;

export function renderEnemies(container: HTMLDivElement) {
  const listed = ENEMY_DEFS.filter((d) => !d.hidden);

  const regularLabel = document.createElement("div");
  regularLabel.className = "col-section-label";
  regularLabel.textContent = "REGULAR ENEMIES";
  container.appendChild(regularLabel);

  for (const entry of listed.filter((e) => !e.isBoss)) {
    renderBestiaryEntry(container, entry);
  }

  const bossLabel = document.createElement("div");
  bossLabel.className = "col-section-label";
  bossLabel.textContent = "BOSSES";
  container.appendChild(bossLabel);

  for (const entry of listed.filter((e) => e.isBoss)) {
    renderBestiaryEntry(container, entry);
  }
}

/**
 * One bar of the enemy's firing rhythm as 16 dots in beats of four; lit dots are shots. Bosses get
 * a row per phase. The tooltip shows the whole pattern and its length.
 */
function renderRhythm(parent: HTMLElement, entry: EnemyDef) {
  const phases = phaseCount(entry.type);
  for (let phase = 1; phase <= phases; phase++) {
    const row = document.createElement("div");
    row.className = "col-rhythm";
    const length = rhythmHits(entry.type, phase).length;
    row.title = `${rhythmPattern(entry.type, phase)} (${length} steps, loops)`;

    const label = document.createElement("div");
    label.className = "col-rhythm-label";
    label.textContent = phases > 1 ? `P${phase}` : "♪";
    row.appendChild(label);

    const preview = rhythmPreview(entry.type, phase, GRID_STEPS);
    for (let beat = 0; beat < GRID_STEPS / STEPS_PER_BEAT; beat++) {
      const group = document.createElement("div");
      group.className = "col-rhythm-beat";
      for (let s = 0; s < STEPS_PER_BEAT; s++) {
        const dot = document.createElement("div");
        dot.className = "col-rhythm-dot";
        if (preview[beat * STEPS_PER_BEAT + s]) dot.style.background = hexColor(entry.color);
        group.appendChild(dot);
      }
      row.appendChild(group);
    }
    parent.appendChild(row);
  }
}

function renderBestiaryEntry(container: HTMLDivElement, entry: EnemyDef) {
  const item = document.createElement("div");
  item.className = `col-item${entry.isBoss ? " boss-item" : ""}`;

  const icon = document.createElement("div");
  icon.className = "col-icon";
  icon.style.color = hexColor(entry.color);
  icon.textContent = entry.icon;

  const info = document.createElement("div");
  info.className = "col-info";

  const name = document.createElement("div");
  name.className = "col-name";
  name.textContent = entry.name;
  if (entry.isBoss) name.style.color = hexColor(entry.color);

  const desc = document.createElement("div");
  desc.className = "col-desc";
  desc.textContent = entry.behavior;

  info.appendChild(name);
  info.appendChild(desc);

  addStatRow(info, [
    ["HP", `${entry.hp}`],
    ["SPD", `${entry.speed}`],
    ["PLAYS", ROLE_LABELS[entry.role]],
    ["SHAPE", shapeLabel(entry.shape)],
  ]);
  renderRhythm(info, entry);

  item.appendChild(icon);
  item.appendChild(info);

  if (entry.isBoss) {
    const tag = document.createElement("div");
    tag.className = "col-boss-tag";
    tag.textContent = "BOSS";
    item.appendChild(tag);
  } else {
    const danger = document.createElement("div");
    danger.className = "col-danger";
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement("div");
      dot.className = "col-danger-dot";
      dot.style.background = i < entry.danger ? hexColor(entry.color) : "#222";
      danger.appendChild(dot);
    }
    item.appendChild(danger);
  }

  container.appendChild(item);
}

export function renderRelics(container: HTMLDivElement) {
  const relicLabel = document.createElement("div");
  relicLabel.className = "col-section-label";
  relicLabel.textContent = "RELICS";
  container.appendChild(relicLabel);

  const relicHint = document.createElement("div");
  relicHint.className = "col-counter";
  relicHint.textContent = "Earned by defeating elite enemies";
  container.appendChild(relicHint);

  for (const r of ALL_RELICS) {
    const item = document.createElement("div");
    item.className = "col-item";

    const icon = document.createElement("div");
    icon.className = "col-icon";
    icon.style.color = "#ffaa44";
    icon.textContent = r.icon;

    const info = document.createElement("div");
    info.className = "col-info";

    const name = document.createElement("div");
    name.className = "col-name";
    name.textContent = r.name;

    const desc = document.createElement("div");
    desc.className = "col-desc";
    desc.textContent = r.description;

    info.appendChild(name);
    info.appendChild(desc);
    item.appendChild(icon);
    item.appendChild(info);
    container.appendChild(item);
  }

  const mutLabel = document.createElement("div");
  mutLabel.className = "col-section-label";
  mutLabel.textContent = "WAVE MUTATORS";
  container.appendChild(mutLabel);

  const mutHint = document.createElement("div");
  mutHint.className = "col-counter";
  mutHint.textContent = "Stack over time in endless mode";
  container.appendChild(mutHint);

  for (const m of ALL_MUTATORS) {
    const item = document.createElement("div");
    item.className = "col-item";

    const icon = document.createElement("div");
    icon.className = "col-icon";
    icon.style.color = "#ff6644";
    icon.textContent = MUTATOR_ICONS[m.id] ?? "??";

    const info = document.createElement("div");
    info.className = "col-info";

    const name = document.createElement("div");
    name.className = "col-name";
    name.textContent = m.name;

    const desc = document.createElement("div");
    desc.className = "col-desc";
    desc.textContent = m.description;

    info.appendChild(name);
    info.appendChild(desc);
    item.appendChild(icon);
    item.appendChild(info);
    container.appendChild(item);
  }
}
