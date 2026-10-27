// xoshiro128** seeded through splitmix32. Deterministic for a given seed, which makes
// every simulation reproducible. Not a certified gaming RNG; fine for statistics.

export interface Rng {
  readonly seed: number;
  nextU32(): number;
  /** Unbiased integer in [0, n). */
  int(n: number): number;
}

const TWO_POW_32 = 4294967296;

function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

export function createRng(seed: number): Rng {
  const init = splitmix32(seed);
  let s0 = init();
  let s1 = init();
  let s2 = init();
  let s3 = init();
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;

  const nextU32 = (): number => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result;
  };

  const int = (n: number): number => {
    if (!Number.isInteger(n) || n <= 0 || n > TWO_POW_32) {
      throw new RangeError(`int(n) needs an integer in [1, 2^32], got ${n}`);
    }
    // Rejection sampling removes the modulo bias.
    const limit = TWO_POW_32 - (TWO_POW_32 % n);
    let x = nextU32();
    while (x >= limit) x = nextU32();
    return x % n;
  };

  return { seed, nextU32, int };
}

export function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] >>> 0;
}
