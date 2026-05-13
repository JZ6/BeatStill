import { options, saveOptions } from "../systems/GameOptions";
import { ALL_UNLOCKS, getState, isUnlocked, requirementText, SHIP_COLORS, getWeaponMastery, isWeaponMastered, hasEvolved } from "../systems/Unlocks";
import { ALL_WEAPONS } from "../systems/Weapons";
import { ALL_ACHIEVEMENTS, isAchievementUnlocked, getAchievementState } from "../systems/Achievements";
import { ALL_EVOLUTIONS, getEvolutionRequirement } from "../systems/Evolutions";

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
      <span>◆ ${st.shards}</span> pickups &nbsp;·&nbsp;
      <span>${st.highScore.toLocaleString()}</span> best score &nbsp;·&nbsp;
      wave <span>${st.highWave}</span> &nbsp;·&nbsp;
      chain <span>${st.bestChain}</span>
    </div>
  `;
  overlay.appendChild(header);

  const categories = ["weapon", "theme", "upgrade", "cosmetic", "achieve"] as const;
  const labels: Record<string, string> = { weapon: "WEAPONS", theme: "THEMES", upgrade: "UPGRADES", cosmetic: "SHIP", achieve: "FEATS" };

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
    } else if (cat === "achieve") {
      renderAchievements(content);
    } else {
      renderUnlocks(content, cat, () => showCategory(cat));
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
    icon.style.color = `#${w.bulletColor.toString(16).padStart(6, "0")}`;
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

    item.appendChild(icon);
    item.appendChild(info);

    if (!isStd && !mastered && mastery) {
      const best = Math.max(mastery.pickups, mastery.kills);
      const bar = document.createElement("div");
      bar.className = "col-progress-bar";
      const fill = document.createElement("div");
      fill.className = "col-progress-fill";
      fill.style.width = `${Math.min(best / 10, 1) * 100}%`;
      fill.style.background = `#${w.bulletColor.toString(16).padStart(6, "0")}`;
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
    icon.style.color = discovered ? `#${w.bulletColor.toString(16).padStart(6, "0")}` : "#333";
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

function renderUnlocks(container: HTMLDivElement, cat: string, refresh: () => void) {
  if (cat === "theme") {
    renderUnlockItem(container, "Theremin", "♫", "Default theme", true,
      options.themeId === "theremin", true, "#e8d5b0",
      () => { options.themeId = "theremin"; saveOptions(options); refresh(); });
  }
  if (cat === "cosmetic") {
    renderUnlockItem(container, "Cyan", "●", "Default ship", true,
      options.shipColor === 0x00ffff, true, "#00ffff",
      () => { options.shipColor = 0x00ffff; saveOptions(options); refresh(); });
  }

  const items = ALL_UNLOCKS.filter((u) => u.category === cat);
  for (const unlock of items) {
    const unlocked = isUnlocked(unlock.id);
    let equipped = false;
    let equippable = false;
    let onEquip: (() => void) | undefined;
    let iconColor = unlocked ? "#ffaa44" : "#333";

    if (cat === "theme" && unlocked) {
      const themeKey = unlock.id.replace("theme_", "");
      equipped = options.themeId === themeKey;
      equippable = true;
      onEquip = () => { options.themeId = themeKey; saveOptions(options); refresh(); };
    }
    if (cat === "cosmetic" && unlocked) {
      const color = SHIP_COLORS[unlock.id] ?? 0x00ffff;
      equipped = options.shipColor === color;
      equippable = true;
      iconColor = `#${color.toString(16).padStart(6, "0")}`;
      onEquip = () => { options.shipColor = color; saveOptions(options); refresh(); };
    }

    const desc = unlocked ? unlock.description : requirementText(unlock.requirement);
    renderUnlockItem(container, unlock.name, unlock.icon, desc, unlocked, equipped, equippable, iconColor, onEquip);
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
