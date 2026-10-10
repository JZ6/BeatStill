/**
 * A uniform grid for broad-phase collision: items go into the cell holding their centre, and a
 * rectangle query visits every item whose cell the rectangle touches (callers expand the rectangle
 * by the largest item radius). Rebuilt every frame: clear() keeps the cell arrays for reuse, so a
 * steady frame allocates nothing. Pure TypeScript (no Phaser), unit-testable.
 */
export class UniformGrid<T> {
  readonly cellSize: number;
  private readonly cells = new Map<number, T[]>();
  private readonly pool: T[][] = [];
  private count = 0;

  constructor(cellSize: number) {
    this.cellSize = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 64;
  }

  /** Items inserted since the last clear(). */
  get size(): number {
    return this.count;
  }

  /** Empties the grid (the cell arrays are kept for the next frame). */
  clear(): void {
    for (const items of this.cells.values()) {
      items.length = 0;
      this.pool.push(items);
    }
    this.cells.clear();
    this.count = 0;
  }

  /** Adds `item` at (x, y). Non-finite positions are ignored. */
  insert(item: T, x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const key = this.key(this.cell(x), this.cell(y));
    let items = this.cells.get(key);
    if (!items) {
      items = this.pool.pop() ?? [];
      this.cells.set(key, items);
    }
    items.push(item);
    this.count++;
  }

  /**
   * Calls `visit` for every item in a cell the rectangle touches (each item once). `visit` may
   * return true to stop the query early.
   */
  query(minX: number, minY: number, maxX: number, maxY: number, visit: (item: T) => boolean | void): void {
    if (this.count === 0 || !(maxX >= minX) || !(maxY >= minY)) return;
    const x0 = this.cell(minX);
    const x1 = this.cell(maxX);
    const y0 = this.cell(minY);
    const y1 = this.cell(maxY);
    // A rectangle spanning more cells than there are occupied ones: walk the occupied cells instead.
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > this.cells.size) {
      for (const [key, items] of this.cells) {
        const cx = Math.floor(key / GRID_STRIDE) - GRID_OFFSET;
        const cy = (key % GRID_STRIDE) - GRID_OFFSET;
        if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
        for (const item of items) if (visit(item) === true) return;
      }
      return;
    }
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const items = this.cells.get(this.key(cx, cy));
        if (!items) continue;
        for (const item of items) if (visit(item) === true) return;
      }
    }
  }

  private cell(v: number): number {
    const c = Math.floor(v / this.cellSize);
    return c < -GRID_OFFSET ? -GRID_OFFSET : c > GRID_OFFSET ? GRID_OFFSET : c;
  }

  private key(cx: number, cy: number): number {
    return (cx + GRID_OFFSET) * GRID_STRIDE + (cy + GRID_OFFSET);
  }
}

/** Cells are clamped to ±GRID_OFFSET per axis (far beyond any screen), so keys stay unique integers. */
const GRID_OFFSET = 1 << 14;
const GRID_STRIDE = 2 * GRID_OFFSET + 1;
