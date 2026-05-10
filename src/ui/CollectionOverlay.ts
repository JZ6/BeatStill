import { options, saveOptions } from "../systems/GameOptions";
import { ALL_UNLOCKS, getState, isUnlocked, requirementText, SHIP_COLORS } from "../systems/Unlocks";

export function createCollectionOverlay(onClose: () => void): HTMLDivElement {
  const state = getState();
  const overlay = document.createElement("div");
  overlay.className = "options-overlay";

  const header = document.createElement("div");
  header.className = "options-title";
  header.textContent = "COLLECTION";
  overlay.appendChild(header);

  const shardCount = document.createElement("div");
  shardCount.style.cssText = "font-family:monospace;font-size:16px;color:#ffaa44;text-align:center;";
  shardCount.textContent = `◆ ${state.shards} shards  |  Best: ${state.highScore} pts  |  Wave ${state.highWave}`;
  overlay.appendChild(shardCount);

  const categories = ["weapon", "theme", "upgrade", "cosmetic"] as const;
  const categoryLabels: Record<string, string> = { weapon: "Weapons", theme: "Themes", upgrade: "Upgrades", cosmetic: "Ship" };

  const tabBar = document.createElement("div");
  tabBar.style.cssText = "display:flex;gap:4px;justify-content:center;margin:8px 0;";

  const contentArea = document.createElement("div");
  contentArea.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;justify-content:center;max-width:500px;padding:8px;";

  const showCategory = (cat: string) => {
    contentArea.innerHTML = "";
    tabBtns.forEach((b, i) => {
      b.style.color = categories[i] === cat ? "#ffaa44" : "#666";
      b.style.borderColor = categories[i] === cat ? "#ffaa44" : "#333";
    });

    if (cat === "weapon") {
      addCollectionCard(contentArea, "Standard", "---", "Always available", true, false, false);
    }
    if (cat === "theme") {
      addCollectionCard(contentArea, "Theremin", "♫", "Default theme", true, options.themeId === "theremin", true,
        () => { options.themeId = "theremin"; saveOptions(options); showCategory(cat); });
    }
    if (cat === "cosmetic") {
      const defaultEquipped = options.shipColor === 0x00ffff;
      addCollectionCard(contentArea, "Cyan", "●", "Default ship", true, defaultEquipped, true,
        () => { options.shipColor = 0x00ffff; saveOptions(options); showCategory(cat); });
    }

    const items = ALL_UNLOCKS.filter((u) => u.category === cat);
    for (const item of items) {
      const unlocked = isUnlocked(item.id);
      let equipped = false;
      let equippable = false;
      let onEquip: (() => void) | undefined;

      if (cat === "theme" && unlocked) {
        const themeKey = item.id.replace("theme_", "");
        equipped = options.themeId === themeKey;
        equippable = true;
        onEquip = () => { options.themeId = themeKey; saveOptions(options); showCategory(cat); };
      }
      if (cat === "cosmetic" && unlocked) {
        const color = SHIP_COLORS[item.id] ?? 0x00ffff;
        equipped = options.shipColor === color;
        equippable = true;
        onEquip = () => { options.shipColor = color; saveOptions(options); showCategory(cat); };
      }

      const reqText = unlocked ? item.description : requirementText(item.requirement);
      addCollectionCard(contentArea, item.name, item.icon, reqText, unlocked, equipped, equippable, onEquip);
    }
  };

  const tabBtns: HTMLButtonElement[] = [];
  for (const cat of categories) {
    const btn = document.createElement("button");
    btn.textContent = categoryLabels[cat];
    btn.style.cssText = "background:#111;border:1px solid #333;color:#666;font-family:monospace;font-size:13px;padding:6px 14px;border-radius:4px;cursor:pointer;";
    btn.addEventListener("click", (e) => { e.stopPropagation(); showCategory(cat); });
    tabBtns.push(btn);
    tabBar.appendChild(btn);
  }

  overlay.appendChild(tabBar);
  overlay.appendChild(contentArea);

  const closeBtn = document.createElement("button");
  closeBtn.className = "options-close-btn";
  closeBtn.textContent = "CLOSE";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose();
  });
  overlay.appendChild(closeBtn);

  for (const evt of ["pointerdown", "pointerup", "pointermove", "click", "keydown"] as const) {
    overlay.addEventListener(evt, (e) => e.stopPropagation());
  }

  showCategory("weapon");
  return overlay;
}

function addCollectionCard(
  container: HTMLDivElement,
  name: string,
  icon: string,
  subtext: string,
  unlocked: boolean,
  equipped: boolean,
  equippable: boolean,
  onEquip?: () => void,
) {
  const card = document.createElement("div");
  card.style.cssText = `
    background:#111;border:2px solid ${equipped ? "#ffaa44" : "#333"};border-radius:8px;
    padding:16px 12px;width:120px;display:flex;flex-direction:column;align-items:center;gap:8px;
    font-family:monospace;opacity:${unlocked ? "1" : "0.35"};
    ${equippable && unlocked ? "cursor:pointer;" : ""}
    transition:border-color 0.2s;
  `;

  card.innerHTML = `
    <div style="font-size:22px;color:${unlocked ? "#ffaa44" : "#666"};">${icon}</div>
    <div style="font-size:13px;color:${unlocked ? "#e8d5b0" : "#666"};font-weight:bold;">${name}</div>
    <div style="font-size:10px;color:#887766;text-align:center;">${subtext}</div>
    ${equipped ? '<div style="font-size:10px;color:#ffaa44;letter-spacing:2px;">EQUIPPED</div>' : ""}
    ${!unlocked ? '<div style="font-size:16px;">🔒</div>' : ""}
  `;

  if (equippable && unlocked && onEquip) {
    card.addEventListener("click", (e) => { e.stopPropagation(); onEquip(); });
    card.addEventListener("pointerover", () => { if (!equipped) card.style.borderColor = "#887766"; });
    card.addEventListener("pointerout", () => { card.style.borderColor = equipped ? "#ffaa44" : "#333"; });
  }

  container.appendChild(card);
}
