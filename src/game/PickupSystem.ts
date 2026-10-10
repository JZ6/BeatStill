import type { GameScene } from "../scenes/GameScene";
import { UpgradePickup } from "../objects/Shard";
import { rollDrop, type UpgradeDef } from "../systems/Upgrades";
import { getWeapon } from "../systems/Weapons";
import { checkEvolution } from "../systems/Evolutions";
import { addShards, addWeaponPickup, recordEvolution } from "../systems/Unlocks";
import { addPickup, recordWeaponUsed } from "../systems/Achievements";
import { MAGNET_SPEEDS } from "../systems/ChainSystem";
import { px } from "../systems/GameConfig";

/** Upgrade pickups: drops, magnets, collection, and applying upgrades (incl. weapon evolution). */
export class PickupSystem {
  constructor(private readonly scene: GameScene) {}

  /** Collects every pickup touching the ship. */
  collect() {
    const s = this.scene;
    for (const p of [...s.shards.getChildren()] as UpgradePickup[]) {
      if (!p.alive) continue;
      const dx = p.x - s.ship.x;
      const dy = p.y - s.ship.y;
      if (dx * dx + dy * dy < px(40) * px(40)) {
        this.applyUpgrade(p.upgrade);
        if (p.upgrade.isWeapon) {
          const wId = p.upgrade.id.replace("weapon_", "");
          addWeaponPickup(wId);
          recordWeaponUsed(wId);
        }
        addShards(1);
        addPickup();
        s.particles.burst(p.x, p.y, p.pickupColor, 10, 50, 2);
        p.kill();
        s.hud.refreshShards();
        s.chain.spawnPopup(p.x, p.y, p.upgrade.name, `#${p.pickupColor.toString(16).padStart(6, "0")}`);
        s.progression.processUnlocks();
      }
    }
  }

  /** Moves pickups: pulled toward the ship by the Magnetism relic or an active chain, else bobbing. */
  update(delta: number, ts: number) {
    const s = this.scene;
    const hasMagnetism = s.relics.hasRelic("magnetism");
    const magnetSpd = hasMagnetism ? MAGNET_SPEEDS[5] : (MAGNET_SPEEDS[s.chain.chainTier] ?? 0);
    for (const p of [...s.shards.getChildren()] as UpgradePickup[]) {
      if (!p.alive) continue;
      if (hasMagnetism || (magnetSpd > 0 && s.chain.chainTimer > 0)) {
        p.magnetTarget = s.ship;
        p.magnetSpeed = magnetSpd;
      } else {
        p.magnetTarget = null;
        p.magnetSpeed = 0;
      }
      p.update(delta, ts);
    }
  }

  applyUpgrade(upg: UpgradeDef) {
    const s = this.scene;
    const wasMaxHp = s.stats.maxHp;
    upg.apply(s.stats);
    if (s.stats.maxHp > wasMaxHp) {
      s.ship.maxHp = s.stats.maxHp;
      s.ship.hp = Math.min(s.ship.hp + 1, s.ship.maxHp);
      s.ship.drawHealthBar();
    }

    const evo = checkEvolution(s.stats);
    if (evo) {
      s.stats.weaponId = evo.evolvedWeaponId;
      recordEvolution(evo.evolvedWeaponId);
      s.particles.burst(s.ship.x, s.ship.y, 0xffaa22, 50, 200, 6);
      s.particles.burst(s.ship.x, s.ship.y, 0xffffff, 30, 150, 4);
      s.cameras.main.shake(400, 0.03);
      s.toasts.push(`EVOLVED: ${getWeapon(evo.evolvedWeaponId).name.toUpperCase()}`);
      if (s.audioStarted) s.audioManager.onBossDeath();
    }
  }

  /** Drops a random pickup at (x, y), if one can be rolled. */
  spawnDrop(x: number, y: number) {
    const upgrade = rollDrop(this.scene.stats);
    if (upgrade) this.scene.shards.add(new UpgradePickup(this.scene, x, y, upgrade));
  }
}
