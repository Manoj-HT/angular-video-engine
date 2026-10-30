import { EasingFn } from '../types/video.types';

export interface InterpolateOptions {
  easing?: EasingFn;
  extrapolateLeft?: 'clamp' | 'extend' | 'identity';
  extrapolateRight?: 'clamp' | 'extend' | 'identity';
}

export const Easing = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  bezier: (x1: number, y1: number, x2: number, y2: number): EasingFn => {
    // Simple cubic bezier implementation
    return (t: number) => {
      const cx = 3 * x1;
      const bx = 3 * (x2 - x1) - cx;
      const ax = 1 - cx - bx;

      const cy = 3 * y1;
      const by = 3 * (y2 - y1) - cy;
      const ay = 1 - cy - by;

      const sampleCurveX = (time: number) => ((ax * time + bx) * time + cx) * time;
      const sampleCurveY = (time: number) => ((ay * time + by) * time + cy) * time;

      // Solve curve X for time using Newton-Raphson
      let guessT = t;
      for (let i = 0; i < 4; i++) {
        const currentSlope = (3 * ax * guessT + 2 * bx) * guessT + cx;
        if (currentSlope === 0) break;
        const currentX = sampleCurveX(guessT) - t;
        guessT -= currentX / currentSlope;
      }
      return sampleCurveY(Math.max(0, Math.min(1, guessT)));
    };
  }
};

/**
 * Pure mathematical interpolation between input and output ranges.
 */
export function interpolate(
  input: number,
  inputRange: readonly [number, number],
  outputRange: readonly [number, number],
  options?: InterpolateOptions
): number {
  const [inMin, inMax] = inputRange;
  const [outMin, outMax] = outputRange;

  if (inMin === inMax) return outMin;

  const extrapolateLeft = options?.extrapolateLeft ?? 'clamp';
  const extrapolateRight = options?.extrapolateRight ?? 'clamp';

  // Handle left extrapolation
  if (input < inMin) {
    if (extrapolateLeft === 'identity') return input;
    if (extrapolateLeft === 'clamp') return outMin;
  }

  // Handle right extrapolation
  if (input > inMax) {
    if (extrapolateRight === 'identity') return input;
    if (extrapolateRight === 'clamp') return outMax;
  }

  // Normalized progress between 0 and 1
  let progress = (input - inMin) / (inMax - inMin);

  if (options?.easing) {
    progress = options.easing(Math.max(0, Math.min(1, progress)));
  }

  return outMin + progress * (outMax - outMin);
}
