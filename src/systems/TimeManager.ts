const MIN_SCALE = 0.03;
const MAX_SCALE = 1.0;
const LERP_SPEED = 8;

export class TimeManager {
  scale = MIN_SCALE;
  private targetScale = MIN_SCALE;

  update(inputMagnitude: number, delta: number) {
    this.targetScale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * inputMagnitude;
    const dt = delta / 1000;
    this.scale += (this.targetScale - this.scale) * Math.min(LERP_SPEED * dt, 1);
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale));
  }
}
