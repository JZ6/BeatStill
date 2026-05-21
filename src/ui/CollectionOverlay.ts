import { getState } from "../systems/Unlocks";
import { renderWeapons } from "./collection/WeaponsTab";
import { renderEnemies, renderRelics } from "./collection/InfoTab";
import { renderCustomize, renderAchievements } from "./collection/ProgressTab";

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

    if (cat === "weapon") renderWeapons(content, () => showCategory(cat));
    else if (cat === "enemies") renderEnemies(content);
    else if (cat === "relics") renderRelics(content);
    else if (cat === "customize") renderCustomize(content, () => showCategory(cat));
    else if (cat === "achieve") renderAchievements(content);
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

// ── Shared Helpers ──────────────────────────────────────────────

export function hexColor(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}

export function addStatRow(parent: HTMLElement, stats: [string, string][]) {
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

export function renderUnlockItem(
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
