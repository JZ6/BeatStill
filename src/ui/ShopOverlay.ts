import { getState } from "../systems/Unlocks";
import { ALL_SHOP_ITEMS, getShopLevel, getItemCost, purchaseItem } from "../systems/Shop";

const STYLE_ID = "shop-overlay-styles";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .shop-overlay {
      position:fixed;inset:0;z-index:9999;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(10,8,6,0.96);font-family:monospace;color:#e8d5b0;
    }
    .shop-title { font-size:28px;color:#ffaa44;margin-bottom:8px;letter-spacing:4px; }
    .shop-shards { font-size:16px;color:#ffaa44;margin-bottom:20px; }
    .shop-list {
      display:flex;flex-direction:column;gap:10px;width:100%;max-width:480px;
      max-height:60vh;overflow-y:auto;padding:0 20px;
    }
    .shop-item {
      display:flex;align-items:center;gap:12px;
      background:#111;border:1px solid #222;border-radius:6px;padding:10px 14px;
    }
    .shop-icon {
      width:36px;height:36px;display:flex;align-items:center;justify-content:center;
      background:#1a1612;border-radius:6px;font-size:18px;flex-shrink:0;
    }
    .shop-info { flex:1;min-width:0; }
    .shop-name { font-size:14px;color:#e8d5b0; }
    .shop-desc { font-size:11px;color:#776655;margin-top:2px; }
    .shop-right { display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0; }
    .shop-level { font-size:11px;color:#666; }
    .shop-buy {
      background:#ffaa44;color:#0a0806;border:none;border-radius:4px;
      padding:4px 12px;font-family:monospace;font-size:12px;font-weight:bold;
      cursor:pointer;
    }
    .shop-buy:hover { background:#ffcc88; }
    .shop-buy:disabled { background:#333;color:#555;cursor:default; }
    .shop-close {
      margin-top:20px;background:none;border:1px solid #554444;color:#887766;
      padding:8px 32px;font-family:monospace;font-size:16px;border-radius:4px;cursor:pointer;
    }
    .shop-close:hover { color:#ffaa44;border-color:#ffaa44; }
    .shop-list::-webkit-scrollbar { width:4px; }
    .shop-list::-webkit-scrollbar-track { background:transparent; }
    .shop-list::-webkit-scrollbar-thumb { background:#333;border-radius:2px; }
  `;
  document.head.appendChild(style);
}

export function createShopOverlay(onClose: () => void): HTMLDivElement {
  injectStyles();

  const overlay = document.createElement("div");
  overlay.className = "shop-overlay";

  const title = document.createElement("div");
  title.className = "shop-title";
  title.textContent = "SHOP";
  overlay.appendChild(title);

  const shardsDisplay = document.createElement("div");
  shardsDisplay.className = "shop-shards";
  shardsDisplay.textContent = `◆ ${getState().shards}`;
  overlay.appendChild(shardsDisplay);

  const list = document.createElement("div");
  list.className = "shop-list";
  overlay.appendChild(list);

  function renderItems() {
    list.innerHTML = "";
    shardsDisplay.textContent = `◆ ${getState().shards}`;

    for (const item of ALL_SHOP_ITEMS) {
      const level = getShopLevel(item.id);
      const maxed = level >= item.maxLevel;
      const cost = maxed ? 0 : getItemCost(item, level);
      const canBuy = !maxed && getState().shards >= cost;

      const row = document.createElement("div");
      row.className = "shop-item";

      const icon = document.createElement("div");
      icon.className = "shop-icon";
      icon.style.color = maxed ? "#44ff44" : "#ffaa44";
      icon.textContent = item.icon;

      const info = document.createElement("div");
      info.className = "shop-info";

      const name = document.createElement("div");
      name.className = "shop-name";
      name.textContent = item.name;

      const desc = document.createElement("div");
      desc.className = "shop-desc";
      desc.textContent = item.description;

      info.appendChild(name);
      info.appendChild(desc);

      const right = document.createElement("div");
      right.className = "shop-right";

      const levelText = document.createElement("div");
      levelText.className = "shop-level";
      levelText.textContent = `${level} / ${item.maxLevel}`;

      right.appendChild(levelText);

      if (!maxed) {
        const btn = document.createElement("button");
        btn.className = "shop-buy";
        btn.textContent = `${cost} ◆`;
        btn.disabled = !canBuy;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (purchaseItem(item.id)) renderItems();
        });
        right.appendChild(btn);
      } else {
        const maxBadge = document.createElement("div");
        maxBadge.style.cssText = "font-size:11px;color:#44ff44;";
        maxBadge.textContent = "MAX";
        right.appendChild(maxBadge);
      }

      row.appendChild(icon);
      row.appendChild(info);
      row.appendChild(right);
      list.appendChild(row);
    }
  }

  renderItems();

  const closeBtn = document.createElement("button");
  closeBtn.className = "shop-close";
  closeBtn.textContent = "CLOSE";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    overlay.remove();
    onClose();
  });
  overlay.appendChild(closeBtn);

  for (const evt of ["pointerdown", "pointerup", "pointermove", "click", "keydown"] as const) {
    overlay.addEventListener(evt, (e) => e.stopPropagation());
  }

  return overlay;
}
