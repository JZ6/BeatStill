/**
 * Rhythm patterns: Euclidean rhythms, a tiny text notation and density transforms.
 * Pure TypeScript (no Phaser, Tone or DOM), unit-testable.
 */

export interface ParsedPattern {
  hits: boolean[];
  /** True where the hit is accented ("X"). Always false on rests. */
  accents: boolean[];
}

function mod(n: number, m: number): number {
  const r = n % m;
  return r < 0 ? r + m : r;
}

function checkInt(name: string, value: number, min = -Infinity): void {
  if (!Number.isInteger(value) || value < min) throw new Error(`${name} must be an integer ≥ ${min}: ${value}`);
}

/** Rotates left by `amount` steps (negative rotates right). Returns a new array. */
export function rotate<T>(pattern: readonly T[], amount: number): T[] {
  checkInt("rotation", amount);
  const n = pattern.length;
  return pattern.map((_, i) => pattern[mod(i + amount, n)]);
}

/**
 * Euclidean rhythm E(pulses, steps) via Bjorklund's algorithm, e.g. E(3,8) = x..x..x.,
 * E(5,8) = x.xx.xx., E(4,16) = four on the floor. `rotation` rotates left.
 */
export function euclid(pulses: number, steps: number, rotation = 0): boolean[] {
  checkInt("steps", steps, 0);
  checkInt("pulses", pulses, 0);
  checkInt("rotation", rotation);
  if (pulses > steps) throw new Error(`pulses (${pulses}) cannot exceed steps (${steps})`);
  if (pulses === 0) return new Array<boolean>(steps).fill(false);
  // Repeatedly pair the "a" groups with the remainder groups until at most one remainder is left.
  let a: boolean[][] = Array.from({ length: pulses }, () => [true]);
  let b: boolean[][] = Array.from({ length: steps - pulses }, () => [false]);
  while (b.length > 1) {
    const m = Math.min(a.length, b.length);
    const paired = a.slice(0, m).map((g, i) => g.concat(b[i]));
    b = a.length > m ? a.slice(m) : b.slice(m);
    a = paired;
  }
  return rotate(a.flat().concat(b.flat()), rotation);
}

/**
 * Parses "x..x ..X. x..." into hits and accents. Spaces and "|" are ignored; "x" or "1" is a
 * hit, "X" an accented hit, "." or "-" a rest. Any other character throws.
 */
export function parsePattern(text: string): ParsedPattern {
  if (typeof text !== "string") throw new Error("Pattern must be a string");
  const hits: boolean[] = [];
  const accents: boolean[] = [];
  for (const ch of text) {
    if (/\s/.test(ch) || ch === "|") continue;
    if (ch === "x" || ch === "1") {
      hits.push(true);
      accents.push(false);
    } else if (ch === "X") {
      hits.push(true);
      accents.push(true);
    } else if (ch === "." || ch === "-") {
      hits.push(false);
      accents.push(false);
    } else {
      throw new Error(`Invalid pattern character ${JSON.stringify(ch)} in ${JSON.stringify(text)}`);
    }
  }
  return { hits, accents };
}

/** Formats hits (and optional accents) back into "x..X" notation. */
export function patternToString(hits: readonly boolean[], accents?: readonly boolean[]): string {
  return hits.map((h, i) => (h ? (accents?.[i] ? "X" : "x") : ".")).join("");
}

/** Whether the pattern hits at `step + offset`, wrapping in both directions. Empty patterns never hit. */
export function patternAt(hits: readonly boolean[], step: number, offset = 0): boolean {
  if (hits.length === 0) return false;
  if (!Number.isFinite(step) || !Number.isFinite(offset)) throw new Error(`Invalid step: ${step} + ${offset}`);
  return hits[mod(Math.floor(step + offset), hits.length)] === true;
}

function hitIndices(hits: readonly boolean[]): number[] {
  const out: number[] = [];
  hits.forEach((h, i) => {
    if (h) out.push(i);
  });
  return out;
}

/**
 * Double density: a pattern of length 2n where hit i lands on 2i and an extra hit sits midway
 * to the next hit (wrapping around the end), e.g. x... → x...x... and x..x..x. → x..x..x..x..x.x.
 */
export function densify(hits: readonly boolean[]): boolean[] {
  const n = hits.length;
  const out = new Array<boolean>(2 * n).fill(false);
  const idx = hitIndices(hits);
  idx.forEach((i, k) => {
    const next = k + 1 < idx.length ? idx[k + 1] : idx[0] + n;
    out[2 * i] = true;
    out[(2 * i + (next - i)) % (2 * n)] = true;
  });
  return out;
}

/**
 * Double density at the same resolution and length: densify(), then fold each pair of half-steps
 * back into one step (a step hits if either half does), e.g. x... → x.x., x. → xx,
 * x.....x.....x... → x..x..x..x..x.x. Hits one step apart already saturate.
 */
export function doubleDensity(hits: readonly boolean[]): boolean[] {
  const d = densify(hits);
  return hits.map((_, i) => d[2 * i] || d[2 * i + 1]);
}

/**
 * Half density, the inverse of densify where possible: keeps every other hit and maps step i
 * to floor(i/2), giving a pattern of length ceil(n/2). If either alternation of hits is an exact
 * densify() preimage it is returned (first-hit alternation preferred); otherwise the alternation
 * starting at the first hit is used.
 */
export function halve(hits: readonly boolean[]): boolean[] {
  const len = Math.ceil(hits.length / 2);
  const idx = hitIndices(hits);
  const compress = (start: number): boolean[] => {
    const out = new Array<boolean>(len).fill(false);
    for (let k = start; k < idx.length; k += 2) out[Math.floor(idx[k] / 2)] = true;
    return out;
  };
  for (const start of [0, 1]) {
    if (start >= idx.length || idx.some((i, k) => k % 2 === start && i % 2 !== 0)) continue;
    const candidate = compress(start);
    const back = densify(candidate);
    if (back.length === hits.length && back.every((h, i) => h === hits[i])) return candidate;
  }
  return compress(0);
}
