import type { PlayerStats } from "./Upgrades";
import { getState, purchaseShopLevel } from "./Unlocks";
import { CHAIN_LINK_BEATS } from "./chainRules";

/** First-shot late-grace window (real seconds) added per Quick Draw level. */
export const QUICK_DRAW_SECONDS = 0.04;

/**
 * Permanent bonuses bought with shards. Ids, max levels and costs are part of the save format
 * (beatstill_unlocks.shopPurchases stores levels by id), so keep them. A bonus raises the starting
 * stats only: it never counts as an in-run upgrade level.
 */
export interface ShopItemDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  maxLevel: number;
  costScale: number;
  apply: (stats: PlayerStats) => void;
}

export const ALL_SHOP_ITEMS: ShopItemDef[] = [
  {
    id: "iron_hull", name: "Iron Hull", icon: "♥",
    description: "+1 starting max HP",
    baseCost: 50, maxLevel: 3, costScale: 1.5,
    apply: (s) => { s.maxHp += 1; },
  },
  {
    id: "sharp_rounds", name: "Sharp Rounds", icon: "▲",
    description: "+1 starting damage",
    baseCost: 40, maxLevel: 3, costScale: 1.5,
    apply: (s) => { s.damage += 1; },
  },
  {
    id: "swift_feet", name: "Swift Feet", icon: "»",
    description: "+30 starting move speed",
    baseCost: 30, maxLevel: 3, costScale: 1.5,
    apply: (s) => { s.moveSpeed += 30; },
  },
  {
    id: "quick_draw", name: "Quick Draw", icon: "⚡",
    description: "+40 ms first-shot timing window per level",
    baseCost: 35, maxLevel: 3, costScale: 1.5,
    apply: (s) => { s.fireGrace += QUICK_DRAW_SECONDS; },
  },
  {
    id: "chain_link", name: "Chain Link", icon: "◎",
    description: "+0.25 beat chain window per level",
    baseCost: 25, maxLevel: 3, costScale: 1.5,
    apply: (s) => { s.chainWindow += CHAIN_LINK_BEATS; },
  },
  {
    id: "lucky_star", name: "Lucky Star", icon: "★",
    description: "+3% drop rate bonus",
    baseCost: 20, maxLevel: 5, costScale: 1.3,
    apply: () => {},
  },
];

export function getShopLevel(itemId: string): number {
  return getState().shopPurchases[itemId] ?? 0;
}

export function getItemCost(item: ShopItemDef, currentLevel: number): number {
  return Math.floor(item.baseCost * Math.pow(item.costScale, currentLevel));
}

export function purchaseItem(itemId: string): boolean {
  const item = ALL_SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return false;
  const level = getShopLevel(itemId);
  if (level >= item.maxLevel) return false;
  const cost = getItemCost(item, level);
  return purchaseShopLevel(itemId, cost, level + 1);
}

export function applyShopBonuses(stats: PlayerStats) {
  for (const item of ALL_SHOP_ITEMS) {
    const level = getShopLevel(item.id);
    for (let i = 0; i < level; i++) {
      item.apply(stats);
    }
  }
}

export function getLuckyStarBonus(): number {
  return getShopLevel("lucky_star") * 0.03;
}
