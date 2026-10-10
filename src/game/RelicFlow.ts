import type { GameScene } from "../scenes/GameScene";
import type { RelicDef } from "../systems/Relics";
import { createRelicSelectOverlay } from "../ui/RelicSelectOverlay";

/** Relic offers: the picker overlay (which freezes the run), applying the pick, and the relic HUD. */
export class RelicFlow {
  /** True while the picker is open. */
  active = false;
  private overlay: HTMLDivElement | null = null;
  private pendingOffers = 0;

  constructor(private readonly scene: GameScene) {}

  offer() {
    if (this.active) {
      // One overlay at a time (e.g. boss + elite killed in the same frame): offer the next
      // choice after this one is picked instead of stacking overlays.
      this.pendingOffers++;
      return;
    }
    const s = this.scene;
    const choices = s.relics.pickChoices(3);
    // The overlay has no close path, so opening it with nothing to pick would softlock.
    if (choices.length === 0) return;
    this.active = true;
    s.syncFrozen();
    const overlay = createRelicSelectOverlay(choices, (relic) => {
      this.overlay = null;
      this.active = false;
      s.syncFrozen();
      s.ship.suppressFireUntilRelease();
      this.apply(relic);
      if (this.pendingOffers > 0) {
        this.pendingOffers--;
        this.offer();
      }
    });
    this.overlay = overlay;
    document.body.appendChild(overlay);
  }

  /** Removes the overlay (scene shutdown). */
  cleanup() {
    this.overlay?.remove();
    this.overlay = null;
    this.active = false;
  }

  private apply(relic: RelicDef) {
    const s = this.scene;
    s.relics.addRelic(relic.id);
    s.toasts.push(`RELIC: ${relic.name}`);
    s.hud.setRelicIcons(s.relics.getActive().map((r) => r.icon).join(" "));

    if (relic.id === "glass") {
      s.ship.maxHp = 1;
      s.ship.hp = 1;
      s.ship.drawHealthBar();
      s.ship.damageMultiplier = 3;
    }
  }
}
