import type { UpgradeDef, PlayerStats } from "../systems/Upgrades";

export function createUpgradeOverlay(
  upgrades: UpgradeDef[],
  stats: PlayerStats,
  onSelect: (upg: UpgradeDef) => void,
): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.className = "upgrade-overlay";

  const title = document.createElement("div");
  title.className = "upgrade-title";
  title.textContent = "CHOOSE AN UPGRADE";
  overlay.appendChild(title);

  const cardRow = document.createElement("div");
  cardRow.className = "upgrade-cards";

  for (const upg of upgrades) {
    const card = document.createElement("div");
    card.className = upg.isWeapon ? "upgrade-card weapon-card" : "upgrade-card";

    const lvl = upg.level(stats);
    const weaponTag = upg.isWeapon ? `<div class="upgrade-weapon-tag">WEAPON</div>` : "";
    const levelBar = upg.isWeapon
      ? ""
      : `<div class="upgrade-level">${"■".repeat(lvl + 1)}${"□".repeat(upg.maxLevel - lvl - 1)}</div>`;
    card.innerHTML = `
      ${weaponTag}
      <div class="upgrade-icon">${upg.icon}</div>
      <div class="upgrade-name">${upg.name}</div>
      <div class="upgrade-desc">${upg.description}</div>
      ${levelBar}
    `;

    card.addEventListener("click", () => onSelect(upg));
    cardRow.appendChild(card);
  }

  overlay.appendChild(cardRow);

  for (const evt of ["pointerdown", "pointerup", "pointermove", "keydown"] as const) {
    overlay.addEventListener(evt, (e) => e.stopPropagation());
  }

  return overlay;
}
