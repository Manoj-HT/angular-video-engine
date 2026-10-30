export interface SpringConfig {
  mass?: number;
  damping?: number;
  stiffness?: number;
  overshootClamping?: boolean;
}

export interface SpringOptions {
  frame: number;
  fps: number;
  from?: number;
  to?: number;
  config?: SpringConfig;
}

/**
 * Deterministic harmonic oscillator spring simulation.
 */
export function spring(options: SpringOptions): number {
  const { frame, fps, from = 0, to = 1, config = {} } = options;

  if (frame <= 0) return from;

  const mass = config.mass ?? 1;
  const damping = config.damping ?? 10;
  const stiffness = config.stiffness ?? 100;
  const overshootClamping = config.overshootClamping ?? false;

  const t = frame / fps;

  // Damped harmonic oscillator equations
  const w0 = Math.sqrt(stiffness / mass); // natural angular frequency
  const zeta = damping / (2 * Math.sqrt(stiffness * mass)); // damping ratio

  let progress = 1;

  if (zeta < 1) {
    // Underdamped
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * w0 * t);
    progress = 1 - envelope * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
  } else if (zeta === 1) {
    // Critically damped
    const envelope = Math.exp(-w0 * t);
    progress = 1 - envelope * (1 + w0 * t);
  } else {
    // Overdamped
    const w1 = w0 * Math.sqrt(zeta * zeta - 1);
    const envelope = Math.exp(-zeta * w0 * t);
    progress = 1 - envelope * (Math.cosh(w1 * t) + (zeta * w0 / w1) * Math.sinh(w1 * t));
  }

  if (overshootClamping && progress > 1) {
    progress = 1;
  }

  return from + progress * (to - from);
}
