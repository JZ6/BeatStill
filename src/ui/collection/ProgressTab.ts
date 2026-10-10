import { options, saveOptions } from "../../systems/GameOptions";
import { ALL_UNLOCKS, isUnlocked, requirementText, SHIP_COLORS } from "../../systems/Unlocks";
import { ALL_ACHIEVEMENTS, isAchievementUnlocked, getAchievementState } from "../../systems/Achievements";
import { ALL_PALETTES, DEFAULT_PALETTE_ID, getPalette, type Palette } from "../../music/palettes";
import { ThemePreview, stopThemePreview, themePreviewId } from "../../audio/ThemePreview";
import { hexColor, renderUnlockItem } from "../CollectionOverlay";

const PREVIEW_ATTR = "data-theme-preview";

/** Shows ■ on the button of the theme that is previewing and ▶ on the others. */
function syncPreviewButtons() {
  const playing = themePreviewId();
  for (const btn of document.querySelectorAll<HTMLButtonElement>(`button[${PREVIEW_ATTR}]`)) {
    const on = btn.getAttribute(PREVIEW_ATTR) === playing;
    btn.textContent = on ? "■" : "▶";
    btn.classList.toggle("playing", on);
    btn.title = on ? "Stop preview" : "Preview this theme";
  }
}

/**
 * A ▶ button that auditions `palette` (a 2-bar phrase); pressing it again, or another theme's,
 * stops it. The click is the user gesture that may start audio.
 */
function makePreviewButton(palette: Palette): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "col-preview";
  btn.setAttribute(PREVIEW_ATTR, palette.id);
  btn.setAttribute("aria-label", `Preview ${palette.name}`);
  btn.addEventListener("click", (e) => {
    // Previewing must not equip the theme.
    e.stopPropagation();
    if (themePreviewId() === palette.id) {
      stopThemePreview();
      syncPreviewButtons();
      return;
    }
    ThemePreview.play(palette, syncPreviewButtons);
    syncPreviewButtons();
  });
  return btn;
}

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

  // One entry per palette: the default is always available, the others unlock as "theme_<id>".
  // A palette without an unlock entry isn't offered.
  const playing = getPalette(options.themeId).id;
  for (const palette of ALL_PALETTES) {
    const isDefault = palette.id === DEFAULT_PALETTE_ID;
    const unlock = ALL_UNLOCKS.find((u) => u.category === "theme" && u.id === `theme_${palette.id}`);
    if (!isDefault && !unlock) continue;
    const unlocked = isDefault || (!!unlock && isUnlocked(unlock.id));
    const desc = isDefault ? "Default theme" : !unlock ? "" : unlocked ? unlock.description : requirementText(unlock.requirement);
    const color = isDefault ? "#e8d5b0" : unlocked ? "#ffaa44" : "#333";
    const item = renderUnlockItem(container, palette.name, unlock?.icon ?? "♫", desc, unlocked, unlocked && playing === palette.id, true, color,
      () => { options.themeId = palette.id; saveOptions(options); refresh(); });
    // Only unlocked themes can be auditioned; the button sits before the EQUIP badge.
    if (unlocked) item.insertBefore(makePreviewButton(palette), item.querySelector(".col-badge"));
  }
  syncPreviewButtons();

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
