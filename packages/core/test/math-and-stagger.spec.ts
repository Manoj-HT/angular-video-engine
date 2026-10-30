import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { interpolate, Easing } from '../src/math/interpolate';
import { spring } from '../src/math/spring';
import { stagger } from '../src/stagger/stagger';

describe('Math & Interpolation', () => {
  it('interpolates linearly between input and output ranges', () => {
    assert.equal(interpolate(0, [0, 100], [0, 500]), 0);
    assert.equal(interpolate(50, [0, 100], [0, 500]), 250);
    assert.equal(interpolate(100, [0, 100], [0, 500]), 500);
  });

  it('clamps extrapolation by default', () => {
    assert.equal(interpolate(-10, [0, 100], [0, 500]), 0);
    assert.equal(interpolate(120, [0, 100], [0, 500]), 500);
  });

  it('supports easing curves', () => {
    const val = interpolate(0.5, [0, 1], [0, 100], { easing: Easing.easeIn });
    assert.equal(val, 25); // 0.5 * 0.5 * 100 = 25
  });
});

describe('Spring Physics', () => {
  it('starts at "from" and settles deterministically towards "to"', () => {
    const start = spring({ frame: 0, fps: 30, from: 0, to: 100 });
    assert.equal(start, 0);

    const mid = spring({ frame: 15, fps: 30, from: 0, to: 100 });
    assert.ok(mid > 0 && mid !== 100);

    const end = spring({ frame: 120, fps: 30, from: 0, to: 100 });
    // After 4 seconds at 30fps with damping, it should be very close to 100
    assert.ok(Math.abs(end - 100) < 0.1);
  });
});

describe('Pluggable Staggering', () => {
  it('linear stagger offsets by each frame count', () => {
    const fn = stagger.each(5);
    assert.equal(fn(0, 4), 0);
    assert.equal(fn(1, 4), 5);
    assert.equal(fn(2, 4), 10);
    assert.equal(fn(3, 4), 15);
  });

  it('center stagger radiates outward symmetrically', () => {
    const fn = stagger.from('center', { each: 4 });
    // total 5 items: indices 0, 1, 2, 3, 4. Center is index 2.
    assert.equal(fn(2, 5), 0); // center is 0
    assert.equal(fn(1, 5), 4); // dist 1
    assert.equal(fn(3, 5), 4); // dist 1
    assert.equal(fn(0, 5), 8); // dist 2
    assert.equal(fn(4, 5), 8); // dist 2
  });

  it('seeded random stagger is 100% deterministic across calls', () => {
    const fn = stagger.random({ min: 0, max: 20, seed: 'test-seed' });
    const val1 = fn(0, 5);
    const val2 = fn(1, 5);
    const val3 = fn(0, 5); // same index

    assert.equal(val1, val3); // must be identical for same index!
    assert.ok(val1 >= 0 && val1 <= 20);
    assert.ok(val2 >= 0 && val2 <= 20);
  });
});
