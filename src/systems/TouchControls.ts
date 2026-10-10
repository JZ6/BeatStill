import Phaser from "phaser";
import { GAME_W, px } from "./GameConfig";
import { analogStick, stickAngle } from "../core/InputMath";

// Sizes at 720p; scaled with px() so the sticks stay usable at every resolution.
const MAX_RADIUS = 60;
const BASE_RADIUS = 50;
const KNOB_RADIUS = 20;
/** Move-stick dead zone, as a fraction of the max radius. */
const MOVE_DEAD_ZONE = 0.12;
/** Aim-stick deflection, as a fraction of the max radius, needed before aiming/firing starts. */
const AIM_DEAD_ZONE = 0.1;

interface Stick {
  pointerId: number;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  active: boolean;
}

function idleStick(): Stick {
  return { pointerId: -1, baseX: 0, baseY: 0, knobX: 0, knobY: 0, active: false };
}

export class TouchControls {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private leftStick: Stick = idleStick();
  private rightStick: Stick = idleStick();
  private enabled = true;
  private readonly maxRadius = px(MAX_RADIUS);
  private readonly baseRadius = px(BASE_RADIUS);
  private readonly knobRadius = px(KNOB_RADIUS);

  moveVector = { x: 0, y: 0 };
  aimAngle = 0;
  /**
   * True while the aim stick is held AND has been deflected past its dead zone at least once
   * since touch-down, so aimAngle is fresh (never the previous touch's angle). Implies firing.
   */
  aimActive = false;

  get moveActive(): boolean {
    return this.leftStick.active;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.input.addPointer(1);

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(500);

    scene.input.on("pointerdown", this.onPointerDown, this);
    scene.input.on("pointermove", this.onPointerMove, this);
    scene.input.on("pointerup", this.onPointerUp, this);
    // A finger released outside the canvas must end its stick too.
    scene.input.on("pointerupoutside", this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.enabled) return;
    const isLeft = pointer.worldX < GAME_W / 2;
    const stick: Stick = {
      pointerId: pointer.id,
      baseX: pointer.worldX,
      baseY: pointer.worldY,
      knobX: pointer.worldX,
      knobY: pointer.worldY,
      active: true,
    };

    if (isLeft && !this.leftStick.active) {
      this.leftStick = stick;
      this.moveVector.x = 0;
      this.moveVector.y = 0;
    } else if (!isLeft && !this.rightStick.active) {
      this.rightStick = stick;
      // Not armed until the stick is deflected: aimAngle still holds the last touch's angle.
      this.aimActive = false;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.enabled) return;

    if (pointer.id === this.leftStick.pointerId && this.leftStick.active) {
      this.updateStick(this.leftStick, pointer.worldX, pointer.worldY);
      const v = analogStick(
        this.leftStick.knobX - this.leftStick.baseX,
        this.leftStick.knobY - this.leftStick.baseY,
        this.maxRadius,
        MOVE_DEAD_ZONE,
      );
      this.moveVector.x = v.x;
      this.moveVector.y = v.y;
    }

    if (pointer.id === this.rightStick.pointerId && this.rightStick.active) {
      this.updateStick(this.rightStick, pointer.worldX, pointer.worldY);
      const angle = stickAngle(
        this.rightStick.knobX - this.rightStick.baseX,
        this.rightStick.knobY - this.rightStick.baseY,
        this.maxRadius * AIM_DEAD_ZONE,
      );
      // Inside the dead zone the direction is unreliable: keep the last fresh angle.
      if (angle !== null) {
        this.aimAngle = angle;
        this.aimActive = true;
      }
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.leftStick.pointerId) {
      this.leftStick.active = false;
      this.leftStick.pointerId = -1;
      this.moveVector.x = 0;
      this.moveVector.y = 0;
    }
    if (pointer.id === this.rightStick.pointerId) {
      this.rightStick.active = false;
      this.rightStick.pointerId = -1;
      this.aimActive = false;
    }
  }

  private updateStick(stick: Stick, x: number, y: number) {
    const dx = x - stick.baseX;
    const dy = y - stick.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const max = this.maxRadius;
    if (dist <= max) {
      stick.knobX = x;
      stick.knobY = y;
    } else {
      stick.knobX = stick.baseX + (dx / dist) * max;
      stick.knobY = stick.baseY + (dy / dist) * max;
    }
  }

  update() {
    this.graphics.clear();
    if (!this.enabled) return;

    if (this.leftStick.active) {
      this.drawStick(this.leftStick);
    }
    if (this.rightStick.active) {
      this.drawStick(this.rightStick);
    }
  }

  private drawStick(stick: Stick) {
    this.graphics.fillStyle(0xffffff, 0.08);
    this.graphics.fillCircle(stick.baseX, stick.baseY, this.baseRadius);
    this.graphics.lineStyle(1.5, 0xffffff, 0.15);
    this.graphics.strokeCircle(stick.baseX, stick.baseY, this.baseRadius);

    this.graphics.fillStyle(0xffaa44, 0.25);
    this.graphics.fillCircle(stick.knobX, stick.knobY, this.knobRadius);
    this.graphics.lineStyle(1, 0xffaa44, 0.4);
    this.graphics.strokeCircle(stick.knobX, stick.knobY, this.knobRadius);
  }

  disable() {
    this.enabled = false;
    this.leftStick = idleStick();
    this.rightStick = idleStick();
    this.moveVector.x = 0;
    this.moveVector.y = 0;
    this.aimActive = false;
    this.graphics.clear();
  }

  enable() {
    this.enabled = true;
  }

  destroy() {
    this.scene.input.off("pointerdown", this.onPointerDown, this);
    this.scene.input.off("pointermove", this.onPointerMove, this);
    this.scene.input.off("pointerup", this.onPointerUp, this);
    this.scene.input.off("pointerupoutside", this.onPointerUp, this);
    this.graphics.destroy();
  }
}
