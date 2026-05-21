import { options, saveOptions } from "../../systems/GameOptions";
import { ALL_UNLOCKS, isUnlocked, requirementText, SHIP_COLORS } from "../../systems/Unlocks";
import { ALL_ACHIEVEMENTS, isAchievementUnlocked, getAchievementState } from "../../systems/Achievements";
import { hexColor, renderUnlockItem } from "../CollectionOverlay";

export function renderCustomize(container: HTMLDivElement, refresh: () => void) {
  // Ship colors
  const colorLabel = document.createElement("div");
  colorLabel.className = "col-section-label";
  colorLabel.textContent = "SHIP COLORS";
  container.appendChild(colorLabel);

  renderUnlockItem(container, "Cyan", "●", "Default ship", true,
    options.shipColor === 0x00ffff, true, "#00ffff",
    () => { options.shipColor = 0x00ffff; saveOptions(options); refresh(); });

  for (const unlock of ALL_UNLOCKS.filter((u) => u.category === "cosmetic")) {
    const unlocked = isUnlocked(unlock.id);
    const color = SHIP_COLORS[unlock.id] ?? 0x00ffff;
    const equipped = options.shipColor === color;
    const desc = unlocked ? unlock.description : requirementText(unlock.requirement);
    renderUnlockItem(container, unlock.name, unlock.icon, desc, unlocked, equipped, true, hexColor(color),
      () => { options.shipColor = color; saveOptions(options); refresh(); });
  }

  // Sound themes
  const themeLabel = document.createElement("div");
  themeLabel.className = "col-section-label";
  themeLabel.textContent = "SOUND THEMES";
  container.appendChild(themeLabel);

  renderUnlockItem(container, "Theremin", "♫", "Default theme", true,
    options.themeId === "theremin", true, "#e8d5b0",
    () => { options.themeId = "theremin"; saveOptions(options); refresh(); });

  for (const unlock of ALL_UNLOCKS.filter((u) => u.category === "theme")) {
    const unlocked = isUnlocked(unlock.id);
    const themeKey = unlock.id.replace("theme_", "");
    const equipped = unlocked && options.themeId === themeKey;
    const desc = unlocked ? unlock.description : requirementText(unlock.requirement);
    renderUnlockItem(container, unlock.name, unlock.icon, desc, unlocked, equipped, true, unlocked ? "#ffaa44" : "#333",
      () => { options.themeId = themeKey; saveOptions(options); refresh(); });
  }

  // Stat unlocks
  const statLabel = document.createElement("div");
  statLabel.className = "col-section-label";
  statLabel.textContent = "STAT UNLOCKS";
  container.appendChild(statLabel);

  for (const unlock of ALL_UNLOCKS.filter((u) => u.category === "upgrade")) {
    const unlocked = isUnlocked(unlock.id);
    const desc = unlocked ? unlock.description : requirementText(unlock.requirement);
    renderUnlockItem(container, unlock.name, unlock.icon, desc, unlocked, false, false, unlocked ? "#ffaa44" : "#333");
  }
}

export function renderAchievements(container: HTMLDivElement) {
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
