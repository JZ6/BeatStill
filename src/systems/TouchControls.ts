import Phaser from "phaser";
import { GAME_W } from "./GameConfig";

const MAX_RADIUS = 60;
const BASE_RADIUS = 50;
const KNOB_RADIUS = 20;

interface Stick {
  pointerId: number;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  active: boolean;
}

export class TouchControls {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private leftStick: Stick = { pointerId: -1, baseX: 0, baseY: 0, knobX: 0, knobY: 0, active: false };
  private rightStick: Stick = { pointerId: -1, baseX: 0, baseY: 0, knobX: 0, knobY: 0, active: false };
  private enabled = true;

  moveVector = { x: 0, y: 0 };
  aimAngle = 0;
  aimActive = false;

  get moveActive(): boolean {
    return this.leftStick.active;
  }

  get inputMagnitude(): number {
    const moveMag = Math.sqrt(this.moveVector.x ** 2 + this.moveVector.y ** 2);
    return Math.max(moveMag, this.aimActive ? 0.5 : 0);
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.input.addPointer(1);

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(500);

    scene.input.on("pointerdown", this.onPointerDown, this);
    scene.input.on("pointermove", this.onPointerMove, this);
    scene.input.on("pointerup", this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.enabled) return;
    const isLeft = pointer.worldX < GAME_W / 2;

    if (isLeft && !this.leftStick.active) {
      this.leftStick = {
        pointerId: pointer.id,
        baseX: pointer.worldX,
        baseY: pointer.worldY,
        knobX: pointer.worldX,
        knobY: pointer.worldY,
        active: true,
      };
    } else if (!isLeft && !this.rightStick.active) {
      this.rightStick = {
        pointerId: pointer.id,
        baseX: pointer.worldX,
        baseY: pointer.worldY,
        knobX: pointer.worldX,
        knobY: pointer.worldY,
        active: true,
      };
      this.aimActive = true;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.enabled) return;

    if (pointer.id === this.leftStick.pointerId && this.leftStick.active) {
      this.updateStick(this.leftStick, pointer.worldX, pointer.worldY);
      const dx = this.leftStick.knobX - this.leftStick.baseX;
      const dy = this.leftStick.knobY - this.leftStick.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const mag = Math.min(dist / MAX_RADIUS, 1);
      if (dist > 0.1) {
        this.moveVector.x = (dx / dist) * mag;
        this.moveVector.y = (dy / dist) * mag;
      }
    }

    if (pointer.id === this.rightStick.pointerId && this.rightStick.active) {
      this.updateStick(this.rightStick, pointer.worldX, pointer.worldY);
      const dx = this.rightStick.knobX - this.rightStick.baseX;
      const dy = this.rightStick.knobY - this.rightStick.baseY;
      if (Math.sqrt(dx * dx + dy * dy) > 2) {
        this.aimAngle = Math.atan2(dy, dx);
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

  private updateStick(stick: Stick, px: number, py: number) {
    const dx = px - stick.baseX;
    const dy = py - stick.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= MAX_RADIUS) {
      stick.knobX = px;
      stick.knobY = py;
    } else {
      stick.knobX = stick.baseX + (dx / dist) * MAX_RADIUS;
      stick.knobY = stick.baseY + (dy / dist) * MAX_RADIUS;
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
    this.graphics.fillCircle(stick.baseX, stick.baseY, BASE_RADIUS);
    this.graphics.lineStyle(1.5, 0xffffff, 0.15);
    this.graphics.strokeCircle(stick.baseX, stick.baseY, BASE_RADIUS);

    this.graphics.fillStyle(0xffaa44, 0.25);
    this.graphics.fillCircle(stick.knobX, stick.knobY, KNOB_RADIUS);
    this.graphics.lineStyle(1, 0xffaa44, 0.4);
    this.graphics.strokeCircle(stick.knobX, stick.knobY, KNOB_RADIUS);
  }

  disable() {
    this.enabled = false;
    this.leftStick.active = false;
    this.rightStick.active = false;
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
    this.graphics.destroy();
  }
}
