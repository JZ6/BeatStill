import { options, saveOptions } from "../systems/GameOptions";
import { ALL_UNLOCKS, getState, isUnlocked, requirementText, SHIP_COLORS, getWeaponMastery, isWeaponMastered, hasEvolved } from "../systems/Unlocks";
import { ALL_WEAPONS } from "../systems/Weapons";
import { ALL_ACHIEVEMENTS, isAchievementUnlocked, getAchievementState } from "../systems/Achievements";
import { ALL_EVOLUTIONS, getEvolutionRequirement } from "../systems/Evolutions";
import { ALL_RELICS } from "../systems/Relics";
import { ALL_MUTATORS } from "../systems/WaveMutators";

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
  { name: "Drone", icon: "◆", color: 0x44ff44, hp: 2, speed: 40, fireRate: 3000, shape: "Square", behavior: "Wanders randomly, fires radial bursts that scale with wave", danger: 1 },
  { name: "Tracker", icon: "▲", color: 0xff8800, hp: 1, speed: 60, fireRate: 2500, shape: "Triangle", behavior: "Follows your position, fires aimed volleys", danger: 2 },
  { name: "Sniper", icon: "✦", color: 0xff2266, hp: 1, speed: 20, fireRate: 2000, shape: "Pentagon", behavior: "Barely moves, fires fast precise shots", danger: 2 },
  { name: "Spiral", icon: "✺", color: 0xaa44ff, hp: 3, speed: 25, fireRate: 400, shape: "Heptagon", behavior: "Fires continuous rotating spiral patterns", danger: 3 },
  { name: "Swarm", icon: "●", color: 0xffff44, hp: 1, speed: 90, fireRate: 4000, shape: "Circle", behavior: "Rushes directly at you, fast but fragile", danger: 2 },
  { name: "Snake", icon: "≋", color: 0x44ddff, hp: 2, speed: 50, fireRate: 3000, shape: "Wave", behavior: "Weaves toward you in sinusoidal path", danger: 2 },
  { name: "Circler", icon: "⬡", color: 0x44ff88, hp: 3, speed: 20, fireRate: 2800, shape: "Hexagon", behavior: "Drifts around the arena, fires 12-bullet radial bursts", danger: 3 },
  { name: "Tank", icon: "■", color: 0xff4444, hp: 6, speed: 15, fireRate: 3500, shape: "Octagon", behavior: "Slow and tough, fires radial + aimed combo patterns", danger: 4 },
  { name: "Sentinel", icon: "⊛", color: 0xffaa22, hp: 30, speed: 8, fireRate: 2000, shape: "Dodecagon", behavior: "3-phase boss that summons minions, intensifies attacks each phase", danger: 5, isBoss: true },
  { name: "Phantom", icon: "◈", color: 0x4488ff, hp: 40, speed: 40, fireRate: 2500, shape: "Diamond", behavior: "Teleporting boss that spawns decoys, charges power when time is frozen", danger: 5, isBoss: true },
];

const STYLE_ID = "collection-overlay-styles";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .col-overlay {
      position:fixed;top:0;left:0;width:100vw;height:100vh;
      background:rgba(10,8,6,0.96);z-index:5000;
      display:flex;flex-direction:column;align-items:center;
      font-family:monospace;
    }
    .col-header {
      padding:24px 0 8px;text-align:center;flex-shrink:0;
    }
    .col-title {
      font-size:28px;color:#e8d5b0;letter-spacing:4px;margin-bottom:8px;
    }
    .col-stats {
      font-size:13px;color:#887766;
    }
    .col-stats span { color:#ffaa44; }
    .col-tabs {
      display:flex;gap:2px;padding:8px 0;flex-shrink:0;
    }
    .col-tab {
      background:transparent;border:none;border-bottom:2px solid transparent;
      color:#555;font-family:monospace;font-size:13px;
      padding:8px 16px;cursor:pointer;transition:all 0.15s;letter-spacing:1px;
    }
    .col-tab:hover { color:#e8d5b0; }
    .col-tab.active { color:#ffaa44;border-bottom-color:#ffaa44; }
    .col-content {
      flex:1;overflow-y:auto;width:100%;max-width:520px;
      padding:8px 16px 16px;
      scrollbar-width:thin;scrollbar-color:#333 transparent;
    }
    .col-content::-webkit-scrollbar { width:4px; }
    .col-content::-webkit-scrollbar-track { background:transparent; }
    .col-content::-webkit-scrollbar-thumb { background:#333;border-radius:2px; }
    .col-content::-webkit-scrollbar-thumb:hover { background:#555; }
    .col-item {
      display:flex;align-items:center;gap:14px;
      padding:12px 14px;border-radius:6px;
      border:1px solid #1a1a1a;margin-bottom:6px;
      transition:border-color 0.15s,background 0.15s;
    }
    .col-item.interactive { cursor:pointer; }
    .col-item.interactive:hover { border-color:#555;background:rgba(255,170,68,0.04); }
    .col-item.equipped { border-color:#ffaa44;background:rgba(255,170,68,0.06); }
    .col-item.locked { opacity:0.35; }
    .col-item.boss-item { border-color:#332200; }
    .col-icon {
      width:40px;height:40px;display:flex;align-items:center;justify-content:center;
      font-size:18px;border-radius:6px;background:#111;flex-shrink:0;
    }
    .col-info { flex:1;min-width:0; }
    .col-name { font-size:14px;color:#e8d5b0;margin-bottom:2px; }
    .col-desc { font-size:11px;color:#666; }
    .col-badge {
      font-size:10px;letter-spacing:1px;padding:3px 8px;border-radius:3px;flex-shrink:0;
    }
    .col-badge.equipped-badge { color:#ffaa44;border:1px solid #ffaa44; }
    .col-badge.locked-badge { color:#444; }
    .col-badge.mastered-badge { color:#44ff44;border:1px solid #44ff44; }
    .col-progress-bar {
      width:60px;height:4px;background:#222;border-radius:2px;overflow:hidden;flex-shrink:0;
    }
    .col-progress-fill { height:100%;border-radius:2px;transition:width 0.3s; }
    .col-section-label {
      font-size:11px;color:#555;letter-spacing:2px;
      padding:12px 0 6px;text-align:center;
    }
    .col-counter {
      font-size:12px;color:#887766;text-align:center;padding:4px 0 8px;
    }
    .col-close {
      background:transparent;border:1px solid #333;color:#887766;
      font-family:monospace;font-size:14px;padding:10px 40px;
      border-radius:4px;cursor:pointer;letter-spacing:2px;
      margin:12px 0 24px;flex-shrink:0;transition:border-color 0.2s,color 0.2s;
    }
    .col-close:hover { border-color:#ffaa44;color:#e8d5b0; }
    .col-stat-row {
      display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;
    }
    .col-stat {
      font-size:10px;color:#555;background:#111;
      padding:2px 6px;border-radius:3px;letter-spacing:0.5px;
    }
    .col-stat span { color:#998877; }
    .col-danger {
      display:flex;gap:2px;flex-shrink:0;align-items:center;
    }
    .col-danger-dot {
      width:6px;height:6px;border-radius:50%;
    }
    .col-boss-tag {
      font-size:9px;color:#ffaa22;border:1px solid #ffaa22;
      padding:1px 6px;border-radius:3px;letter-spacing:1px;flex-shrink:0;
    }
  `;
  document.head.appendChild(style);
}

export function createCollectionOverlay(onClose: () => void): HTMLDivElement {
  injectStyles();
  const st = getState();

  const overlay = document.createElement("div");
  overlay.className = "col-overlay";

  const header = document.createElement("div");
  header.className = "col-header";
  header.innerHTML = `
    <div class="col-title">COLLECTION</div>
    <div class="col-stats">
      <span>${st.shards}</span> shards &nbsp;&middot;&nbsp;
      <span>${st.highScore.toLocaleString()}</span> best score &nbsp;&middot;&nbsp;
      wave <span>${st.highWave}</span> &nbsp;&middot;&nbsp;
      chain <span>${st.bestChain}</span>
    </div>
  `;
  overlay.appendChild(header);

  const categories = ["weapon", "enemies", "relics", "customize", "achieve"] as const;
  const labels: Record<string, string> = { weapon: "WEAPONS", enemies: "ENEMIES", relics: "RELICS", customize: "CUSTOMIZE", achieve: "FEATS" };

  const tabBar = document.createElement("div");
  tabBar.className = "col-tabs";

  const content = document.createElement("div");
  content.className = "col-content";

  const tabBtns: HTMLButtonElement[] = [];

  const showCategory = (cat: string) => {
    content.innerHTML = "";
    content.scrollTop = 0;
    tabBtns.forEach((b, i) => {
      b.className = categories[i] === cat ? "col-tab active" : "col-tab";
    });

    if (cat === "weapon") {
      renderWeapons(content, () => showCategory(cat));
    } else if (cat === "enemies") {
      renderEnemies(content);
    } else if (cat === "relics") {
      renderRelics(content);
    } else if (cat === "customize") {
      renderCustomize(content, () => showCategory(cat));
    } else if (cat === "achieve") {
      renderAchievements(content);
    }
  };

  for (const cat of categories) {
    const btn = document.createElement("button");
    btn.className = "col-tab";
    btn.textContent = labels[cat];
    btn.addEventListener("click", (e) => { e.stopPropagation(); showCategory(cat); });
    tabBtns.push(btn);
    tabBar.appendChild(btn);
  }

  overlay.appendChild(tabBar);
  overlay.appendChild(content);

  const closeBtn = document.createElement("button");
  closeBtn.className = "col-close";
  closeBtn.textContent = "CLOSE";
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); onClose(); });
  overlay.appendChild(closeBtn);

  for (const evt of ["pointerdown", "pointerup", "pointermove", "click", "keydown"] as const) {
    overlay.addEventListener(evt, (e) => e.stopPropagation());
  }

  showCategory("weapon");
  return overlay;
}

function hexColor(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}

function addStatRow(parent: HTMLElement, stats: [string, string][]) {
  const row = document.createElement("div");
  row.className = "col-stat-row";
  for (const [label, value] of stats) {
    const s = document.createElement("div");
    s.className = "col-stat";
    s.innerHTML = `${label} <span>${value}</span>`;
    row.appendChild(s);
  }
  parent.appendChild(row);
}

function renderWeapons(container: HTMLDivElement, refresh: () => void) {
  const baseWeapons = ALL_WEAPONS.filter((w) => !w.isEvolution);

  for (const w of baseWeapons) {
    const isStd = w.id === "standard";
    const mastery = isStd ? null : getWeaponMastery(w.id);
    const mastered = isStd || isWeaponMastered(w.id);
    const equipped = options.starterWeapon === w.id;
    const canEquip = mastered;

    const item = document.createElement("div");
    item.className = `col-item${equipped ? " equipped" : ""}${canEquip ? " interactive" : ""}`;

    const icon = document.createElement("div");
    icon.className = "col-icon";
    icon.style.color = hexColor(w.bulletColor);
    icon.textContent = w.icon;

    const info = document.createElement("div");
    info.className = "col-info";

    const name = document.createElement("div");
    name.className = "col-name";
    name.textContent = w.name;

    const desc = document.createElement("div");
    desc.className = "col-desc";
    desc.textContent = w.description;

    info.appendChild(name);
    info.appendChild(desc);

    const statPairs: [string, string][] = [
      ["DMG", `${w.damageMultiplier}x`],
      ["SPD", `${w.baseBulletSpeed}`],
      ["CD", `${w.baseCooldown}ms`],
    ];
    if (w.basePierce > 0) statPairs.push(["PRC", `${w.basePierce}`]);
    if (w.baseBulletCount > 1) statPairs.push(["CNT", `${w.baseBulletCount}`]);
    if (w.homing) statPairs.push(["", "HOMING"]);
    if (w.lifetime > 0) statPairs.push(["RNG", `${w.lifetime}ms`]);
    addStatRow(info, statPairs);

    item.appendChild(icon);
    item.appendChild(info);

    if (!isStd && !mastered && mastery) {
      const best = Math.max(mastery.pickups, mastery.kills);
      const bar = document.createElement("div");
      bar.className = "col-progress-bar";
      const fill = document.createElement("div");
      fill.className = "col-progress-fill";
      fill.style.width = `${Math.min(best / 10, 1) * 100}%`;
      fill.style.background = hexColor(w.bulletColor);
      bar.appendChild(fill);

      const label = document.createElement("div");
      label.style.cssText = "font-size:10px;color:#555;text-align:center;flex-shrink:0;min-width:30px;";
      label.textContent = `${best}/10`;

      const right = document.createElement("div");
      right.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;";
      right.appendChild(label);
      right.appendChild(bar);
      item.appendChild(right);
    } else if (mastered) {
      const badge = document.createElement("div");
      badge.className = "col-badge";
      if (equipped) {
        badge.classList.add("equipped-badge");
        badge.textContent = "EQUIPPED";
      } else {
        badge.classList.add("mastered-badge");
        badge.textContent = "EQUIP";
      }
      item.appendChild(badge);
    }

    if (canEquip) {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        options.starterWeapon = w.id;
        saveOptions(options);
        refresh();
      });
    }

    container.appendChild(item);
  }

  const evoLabel = document.createElement("div");
  evoLabel.className = "col-section-label";
  evoLabel.textContent = "EVOLUTIONS";
  container.appendChild(evoLabel);

  const evolvedWeapons = ALL_WEAPONS.filter((w) => w.isEvolution);
  for (const w of evolvedWeapons) {
    const discovered = hasEvolved(w.id);
    const req = getEvolutionRequirement(w.id);

    const item = document.createElement("div");
    item.className = `col-item${discovered ? "" : " locked"}`;

    const icon = document.createElement("div");
    icon.className = "col-icon";
    icon.style.color = discovered ? hexColor(w.bulletColor) : "#333";
    icon.textContent = discovered ? w.icon : "?";

    const info = document.createElement("div");
    info.className = "col-info";

    const name = document.createElement("div");
    name.className = "col-name";
    name.style.color = discovered ? "#e8d5b0" : "#444";
    name.textContent = discovered ? w.name : "???";

    const desc = document.createElement("div");
    desc.className = "col-desc";
    desc.textContent = discovered ? w.description : req;

    info.appendChild(name);
    info.appendChild(desc);

    if (discovered) {
      const statPairs: [string, string][] = [
        ["DMG", `${w.damageMultiplier}x`],
        ["SPD", `${w.baseBulletSpeed}`],
        ["CD", `${w.baseCooldown}ms`],
      ];
      if (w.basePierce > 0) statPairs.push(["PRC", `${w.basePierce}`]);
      if (w.baseBulletCount > 1) statPairs.push(["CNT", `${w.baseBulletCount}`]);
      if (w.homing) statPairs.push(["", "HOMING"]);
      if (w.lifetime > 0) statPairs.push(["RNG", `${w.lifetime}ms`]);
      addStatRow(info, statPairs);
    }

    item.appendChild(icon);
    item.appendChild(info);

    if (discovered) {
      const check = document.createElement("div");
      check.style.cssText = "color:#ffaa44;font-size:12px;flex-shrink:0;";
      check.textContent = "✓";
      item.appendChild(check);
    }

    container.appendChild(item);
  }
}

function renderEnemies(container: HTMLDivElement) {
  const regularLabel = document.createElement("div");
  regularLabel.className = "col-section-label";
  regularLabel.textContent = "REGULAR ENEMIES";
  container.appendChild(regularLabel);

  const regular = BESTIARY.filter((e) => !e.isBoss);
  const bosses = BESTIARY.filter((e) => e.isBoss);

  for (const entry of regular) {
    renderBestiaryEntry(container, entry);
  }

  const bossLabel = document.createElement("div");
  bossLabel.className = "col-section-label";
  bossLabel.textContent = "BOSSES";
  container.appendChild(bossLabel);

  for (const entry of bosses) {
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

function renderRelics(container: HTMLDivElement) {
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
    icon.textContent = m.id === "double_time" ? ">>" : m.id === "bullet_storm" ? "!!" : m.id === "swarm_tide" ? "++" : m.id === "fragile" ? "--" : "##";

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

function renderCustomize(container: HTMLDivElement, refresh: () => void) {
  // Ship colors section
  const colorLabel = document.createElement("div");
  colorLabel.className = "col-section-label";
  colorLabel.textContent = "SHIP COLORS";
  container.appendChild(colorLabel);

  renderUnlockItem(container, "Cyan", "●", "Default ship", true,
    options.shipColor === 0x00ffff, true, "#00ffff",
    () => { options.shipColor = 0x00ffff; saveOptions(options); refresh(); });

  const cosmeticItems = ALL_UNLOCKS.filter((u) => u.category === "cosmetic");
  for (const unlock of cosmeticItems) {
    const unlocked = isUnlocked(unlock.id);
    const color = SHIP_COLORS[unlock.id] ?? 0x00ffff;
    const equipped = options.shipColor === color;
    const iconColor = hexColor(color);
    const desc = unlocked ? unlock.description : requirementText(unlock.requirement);
    renderUnlockItem(container, unlock.name, unlock.icon, desc, unlocked, equipped, true, iconColor,
      () => { options.shipColor = color; saveOptions(options); refresh(); });
  }

  // Sound themes section
  const themeLabel = document.createElement("div");
  themeLabel.className = "col-section-label";
  themeLabel.textContent = "SOUND THEMES";
  container.appendChild(themeLabel);

  renderUnlockItem(container, "Theremin", "♫", "Default theme", true,
    options.themeId === "theremin", true, "#e8d5b0",
    () => { options.themeId = "theremin"; saveOptions(options); refresh(); });

  const themeItems = ALL_UNLOCKS.filter((u) => u.category === "theme");
  for (const unlock of themeItems) {
    const unlocked = isUnlocked(unlock.id);
    const themeKey = unlock.id.replace("theme_", "");
    const equipped = unlocked && options.themeId === themeKey;
    const desc = unlocked ? unlock.description : requirementText(unlock.requirement);
    renderUnlockItem(container, unlock.name, unlock.icon, desc, unlocked, equipped, true, unlocked ? "#ffaa44" : "#333",
      () => { options.themeId = themeKey; saveOptions(options); refresh(); });
  }

  // Stat unlocks section
  const statLabel = document.createElement("div");
  statLabel.className = "col-section-label";
  statLabel.textContent = "STAT UNLOCKS";
  container.appendChild(statLabel);

  const upgradeItems = ALL_UNLOCKS.filter((u) => u.category === "upgrade");
  for (const unlock of upgradeItems) {
    const unlocked = isUnlocked(unlock.id);
    const desc = unlocked ? unlock.description : requirementText(unlock.requirement);
    renderUnlockItem(container, unlock.name, unlock.icon, desc, unlocked, false, false, unlocked ? "#ffaa44" : "#333");
  }
}

function renderAchievements(container: HTMLDivElement) {
  const achState = getAchievementState();
  const unlocked = achState.unlockedIds.length;
  const total = ALL_ACHIEVEMENTS.length;

  const counter = document.createElement("div");
  counter.className = "col-counter";
  counter.innerHTML = `<span style="color:#ffaa44">${unlocked}</span> / ${total} unlocked`;
  container.appendChild(counter);

  const catOrder = ["milestone", "mastery", "discovery"] as const;
  const catLabels: Record<string, string> = { milestone: "MILESTONES", mastery: "MASTERY", discovery: "DISCOVERY" };

  for (const ac of catOrder) {
    const group = ALL_ACHIEVEMENTS.filter((a) => a.category === ac);
    const label = document.createElement("div");
    label.className = "col-section-label";
    label.textContent = catLabels[ac];
    container.appendChild(label);

    for (const a of group) {
      const done = isAchievementUnlocked(a.id);
      const item = document.createElement("div");
      item.className = `col-item${done ? "" : " locked"}`;

      const icon = document.createElement("div");
      icon.className = "col-icon";
      icon.style.color = done ? "#ffaa44" : "#333";
      icon.textContent = done ? a.icon : "?";

      const info = document.createElement("div");
      info.className = "col-info";

      const name = document.createElement("div");
      name.className = "col-name";
      name.style.color = done ? "#e8d5b0" : "#444";
      name.textContent = a.name;

      const desc = document.createElement("div");
      desc.className = "col-desc";
      desc.textContent = done ? a.description : "???";

      info.appendChild(name);
      info.appendChild(desc);

      item.appendChild(icon);
      item.appendChild(info);

      const reward = document.createElement("div");
      reward.style.cssText = `font-size:11px;flex-shrink:0;color:${done ? "#ffaa44" : "#555"};margin-left:auto;padding-left:8px;`;
      reward.textContent = `+${a.reward}◆`;
      item.appendChild(reward);

      if (done) {
        const check = document.createElement("div");
        check.style.cssText = "color:#ffaa44;font-size:16px;flex-shrink:0;margin-left:4px;";
        check.textContent = "✓";
        item.appendChild(check);
      }

      container.appendChild(item);
    }
  }
}

function renderUnlockItem(
  container: HTMLDivElement,
  name: string, icon: string, desc: string,
  unlocked: boolean, equipped: boolean, equippable: boolean,
  iconColor: string,
  onEquip?: () => void,
) {
  const item = document.createElement("div");
  item.className = `col-item${equipped ? " equipped" : ""}${!unlocked ? " locked" : ""}${equippable && unlocked ? " interactive" : ""}`;

  const iconEl = document.createElement("div");
  iconEl.className = "col-icon";
  iconEl.style.color = unlocked ? iconColor : "#333";
  iconEl.textContent = unlocked ? icon : "🔒";

  const info = document.createElement("div");
  info.className = "col-info";

  const nameEl = document.createElement("div");
  nameEl.className = "col-name";
  nameEl.textContent = name;

  const descEl = document.createElement("div");
  descEl.className = "col-desc";
  descEl.textContent = desc;

  info.appendChild(nameEl);
  info.appendChild(descEl);
  item.appendChild(iconEl);
  item.appendChild(info);

  if (unlocked && equippable) {
    const badge = document.createElement("div");
    badge.className = `col-badge ${equipped ? "equipped-badge" : "mastered-badge"}`;
    badge.textContent = equipped ? "EQUIPPED" : "EQUIP";
    item.appendChild(badge);
  }

  if (equippable && unlocked && onEquip) {
    item.addEventListener("click", (e) => { e.stopPropagation(); onEquip(); });
  }

  container.appendChild(item);
}
