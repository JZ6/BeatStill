import { ALL_RELICS } from "../../systems/Relics";
import { ALL_MUTATORS } from "../../systems/WaveMutators";
import { hexColor, addStatRow } from "../CollectionOverlay";

interface BestiaryEntry {
  name: string;
  icon: string;
  color: number;
  hp: number;
  speed: number;
  fireRate: number;
  shape: string;
  behavior: string;
  danger: number;
  isBoss?: boolean;
}

const BESTIARY: BestiaryEntry[] = [
  { name: "Drone", icon: "◆", color: 0x44ff44, hp: 2, speed: 40, fireRate: 2400, shape: "Circle", behavior: "Wanders randomly, fires radial bursts that scale with wave", danger: 1 },
  { name: "Tracker", icon: "▲", color: 0xff8800, hp: 1, speed: 60, fireRate: 2000, shape: "Square", behavior: "Follows your position, fires aimed volleys", danger: 2 },
  { name: "Sniper", icon: "✦", color: 0xff2266, hp: 1, speed: 20, fireRate: 1600, shape: "Pentagon", behavior: "Barely moves, fires fast precise shots", danger: 2 },
  { name: "Spiral", icon: "✺", color: 0xaa44ff, hp: 3, speed: 25, fireRate: 300, shape: "Heptagon", behavior: "Fires continuous rotating spiral patterns", danger: 3 },
  { name: "Swarm", icon: "●", color: 0xffff44, hp: 1, speed: 90, fireRate: 3200, shape: "Triangle", behavior: "Rushes directly at you, fast but fragile", danger: 2 },
  { name: "Snake", icon: "≋", color: 0x44ddff, hp: 2, speed: 50, fireRate: 2400, shape: "Line", behavior: "Weaves toward you in sinusoidal path", danger: 2 },
  { name: "Circler", icon: "⬡", color: 0x44ff88, hp: 3, speed: 20, fireRate: 2200, shape: "Hexagon", behavior: "Drifts around the arena, fires 16-bullet radial bursts", danger: 3 },
  { name: "Tank", icon: "■", color: 0xff4444, hp: 6, speed: 15, fireRate: 2800, shape: "Octagon", behavior: "Slow and tough, fires radial + aimed combo patterns", danger: 4 },
  { name: "Sentinel", icon: "⊛", color: 0xffaa22, hp: 30, speed: 8, fireRate: 2000, shape: "Dodecagon", behavior: "3-phase boss that summons minions, intensifies attacks each phase", danger: 5, isBoss: true },
  { name: "Phantom", icon: "◈", color: 0x4488ff, hp: 40, speed: 40, fireRate: 2500, shape: "Diamond", behavior: "Teleporting boss that spawns decoys, charges power when time is frozen", danger: 5, isBoss: true },
];

const MUTATOR_ICONS: Record<string, string> = {
  double_time: ">>", bullet_storm: "!!", swarm_tide: "++", fragile: "--", armored: "##",
};

export function renderEnemies(container: HTMLDivElement) {
  const regularLabel = document.createElement("div");
  regularLabel.className = "col-section-label";
  regularLabel.textContent = "REGULAR ENEMIES";
  container.appendChild(regularLabel);

  for (const entry of BESTIARY.filter((e) => !e.isBoss)) {
    renderBestiaryEntry(container, entry);
  }

  const bossLabel = document.createElement("div");
  bossLabel.className = "col-section-label";
  bossLabel.textContent = "BOSSES";
  container.appendChild(bossLabel);

  for (const entry of BESTIARY.filter((e) => e.isBoss)) {
    renderBestiaryEntry(container, entry);
  }
}

function renderBestiaryEntry(container: HTMLDivElement, entry: BestiaryEntry) {
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

  const fireRateStr = entry.fireRate >= 1000 ? `${(entry.fireRate / 1000).toFixed(1)}s` : `${entry.fireRate}ms`;
  addStatRow(info, [
    ["HP", `${entry.hp}`],
    ["SPD", `${entry.speed}`],
    ["FIRE", fireRateStr],
    ["SHAPE", entry.shape],
  ]);

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
