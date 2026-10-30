import { StaggerFn } from '../types/video.types';

export interface StaggerFromOptions {
  each: number;
}

export interface StaggerGridOptions {
  from?: 'top-left' | 'center' | 'edges';
  each: number;
}

export interface StaggerRandomOptions {
  min: number;
  max: number;
  seed: string | number;
}

// Simple deterministic Mulberry32 PRNG for seeded random staggering
function createPrng(seedString: string | number): () => number {
  let s = typeof seedString === 'number' ? seedString : 0;
  if (typeof seedString === 'string') {
    for (let i = 0; i < seedString.length; i++) {
      s = (s << 5) - s + seedString.charCodeAt(i);
      s |= 0;
    }
  }

  let a = s >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const stagger = {
  /**
   * Uniform linear delay: each item starts N frames after the previous item.
   */
  each: (framesPerItem: number): StaggerFn => {
    return (index: number) => index * framesPerItem;
  },

  /**
   * Position-based distribution: stagger radiating from start, end, center, or edges.
   */
  from: (position: 'start' | 'end' | 'center' | 'edges', options: StaggerFromOptions): StaggerFn => {
    const each = options.each;

    return (index: number, total: number) => {
      if (total <= 1) return 0;

      switch (position) {
        case 'start':
          return index * each;
        case 'end':
          return (total - 1 - index) * each;
        case 'center': {
          const mid = (total - 1) / 2;
          const dist = Math.abs(index - mid);
          return Math.round(dist * each);
        }
        case 'edges': {
          const mid = (total - 1) / 2;
          const dist = mid - Math.abs(index - mid);
          return Math.round(dist * each);
        }
      }
    };
  },

  /**
   * 2D Matrix / Grid staggering for cards and photo walls.
   */
  grid: (gridDimensions: [rows: number, cols: number], options: StaggerGridOptions): StaggerFn => {
    const [rows, cols] = gridDimensions;
    const each = options.each;
    const from = options.from ?? 'top-left';

    return (index: number) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      if (from === 'top-left') {
        return (row + col) * each;
      }

      if (from === 'center') {
        const midRow = (rows - 1) / 2;
        const midCol = (cols - 1) / 2;
        const dist = Math.sqrt(Math.pow(row - midRow, 2) + Math.pow(col - midCol, 2));
        return Math.round(dist * each);
      }

      return (row + col) * each;
    };
  },

  /**
   * Seeded deterministic random: delays elements randomly without drifting on scrub.
   */
  random: (options: StaggerRandomOptions): StaggerFn => {
    const rng = createPrng(options.seed);
    const cache = new Map<number, number>();

    return (index: number) => {
      if (!cache.has(index)) {
        const randomVal = options.min + Math.round(rng() * (options.max - options.min));
        cache.set(index, randomVal);
      }
      return cache.get(index)!;
    };
  }
};
