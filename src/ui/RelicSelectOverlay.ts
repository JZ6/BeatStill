import type { RelicDef } from "../systems/Relics";

const STYLE_ID = "relic-select-styles";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .relic-overlay {
      position:fixed;inset:0;z-index:9999;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(10,8,6,0.92);font-family:monospace;color:#e8d5b0;
    }
    .relic-title { font-size:24px;color:#ffaa44;margin-bottom:24px;letter-spacing:4px; }
    .relic-cards { display:flex;gap:16px;flex-wrap:wrap;justify-content:center;padding:0 16px; }
    .relic-card {
      width:160px;background:#111;border:1px solid #333;border-radius:8px;
      padding:20px 16px;display:flex;flex-direction:column;align-items:center;
      gap:8px;cursor:pointer;transition:border-color 0.15s,transform 0.15s;
    }
    .relic-card:hover { border-color:#ffaa44;transform:translateY(-4px); }
    .relic-card-icon { font-size:32px;color:#ffaa44; }
    .relic-card-name { font-size:16px;color:#e8d5b0;text-align:center; }
    .relic-card-desc { font-size:11px;color:#776655;text-align:center;line-height:1.5; }
  `;
  document.head.appendChild(style);
}

export function createRelicSelectOverlay(
  choices: RelicDef[],
  onSelect: (relic: RelicDef) => void,
): HTMLDivElement {
  injectStyles();

  const overlay = document.createElement("div");
  overlay.className = "relic-overlay";

  const title = document.createElement("div");
  title.className = "relic-title";
  title.textContent = "CHOOSE A RELIC";
  overlay.appendChild(title);

  const cards = document.createElement("div");
  cards.className = "relic-cards";
  overlay.appendChild(cards);

  for (const relic of choices) {
    const card = document.createElement("div");
    card.className = "relic-card";

    const icon = document.createElement("div");
    icon.className = "relic-card-icon";
    icon.textContent = relic.icon;

    const name = document.createElement("div");
    name.className = "relic-card-name";
    name.textContent = relic.name;

    const desc = document.createElement("div");
    desc.className = "relic-card-desc";
    desc.textContent = relic.description;

    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(desc);

    card.addEventListener("click", (e) => {
      e.stopPropagation();
      overlay.remove();
      onSelect(relic);
    });

    cards.appendChild(card);
  }

  for (const evt of ["pointerdown", "pointerup", "pointermove", "click", "keydown"] as const) {
    overlay.addEventListener(evt, (e) => e.stopPropagation());
  }

  return overlay;
}
