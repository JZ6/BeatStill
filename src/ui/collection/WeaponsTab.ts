import { options, saveOptions } from "../../systems/GameOptions";
import { getWeaponMastery, isWeaponMastered, hasEvolved } from "../../systems/Unlocks";
import { ALL_WEAPONS } from "../../systems/Weapons";
import { getEvolutionRequirement } from "../../systems/Evolutions";
import { hexColor, addStatRow } from "../CollectionOverlay";

function weaponStats(w: typeof ALL_WEAPONS[number]): [string, string][] {
  const stats: [string, string][] = [
    ["DMG", `${w.damageMultiplier}x`],
    ["SPD", `${w.baseBulletSpeed}`],
    ["CD", `${w.baseCooldown}ms`],
  ];
  if (w.basePierce > 0) stats.push(["PRC", `${w.basePierce}`]);
  if (w.baseBulletCount > 1) stats.push(["CNT", `${w.baseBulletCount}`]);
  if (w.homing) stats.push(["", "HOMING"]);
  if (w.lifetime > 0) stats.push(["RNG", `${w.lifetime}ms`]);
  return stats;
}

export function renderWeapons(container: HTMLDivElement, refresh: () => void) {
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
    addStatRow(info, weaponStats(w));

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

  // Evolutions section
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
    if (discovered) addStatRow(info, weaponStats(w));

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
