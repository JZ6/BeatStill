/**
 * Averages frame rate over fixed intervals. Pure TypeScript, unit-testable.
 *
 * Measured from scene updates rather than Phaser's loop.actualFps: with fps.limit set,
 * actualFps counts every RAF tick (TimeStep.stepLimitFPS), so it would show the display
 * rate instead of the capped rate.
 */
export class FpsMeter {
  private elapsed = 0;
  private frames = 0;

  constructor(readonly intervalMs = 500) {}

  /** Records one frame of `deltaMs`. Once more than an interval has elapsed, returns the average FPS over it and starts a new interval; otherwise null. */
  sample(deltaMs: number): number | null {
    this.elapsed += deltaMs;
    this.frames++;
    if (this.elapsed <= this.intervalMs) return null;
    const fps = (this.frames * 1000) / this.elapsed;
    this.elapsed = 0;
    this.frames = 0;
    return fps;
  }
}
