# 02. Styling, Directives & Animation Engine

## 1. Overview & Principles

In traditional web applications, animations rely on the browser's wall clock (`performance.now()` and `requestAnimationFrame`). In video rendering, **wall-clock time is non-deterministic**:
- Final video exports render frame-by-frame (e.g., 200ms per frame), which would cause CSS transitions and animations to finish prematurely.
- Scrubbing backward or forward requires jumping to exact mathematical states without interpolation drift.

**Angular Video Engine (AVE)** enforces **100% deterministic, frame-driven styling** while retaining Angular's clean component-scoped SCSS architecture.

---

## 2. Reactivity Foundation: Signals & Zoneless Architecture

AVE is built natively around modern Angular Signals and zoneless change detection:

```typescript
import { injectCurrentFrame, injectVideoConfig } from '@angular-video/core';

@Component({ ... })
export class MySceneComponent {
  // Readonly signals provided by the engine context
  readonly frame = injectCurrentFrame();   // Signal<number>
  readonly config = injectVideoConfig();   // Signal<{ fps: number, width: number, height: number, durationInFrames: number }>
}
```

### Performance Optimization: Zoneless Direct DOM Updates
Timeline playback at 60 FPS across dozens of animated elements requires zero change-detection overhead.
- Directives (`[aveAnimate]`, `[aveSyncCss]`) read frame signals and write directly to DOM properties (`element.style.transform`, `element.style.setProperty`) or use the Web Animations API.
- **Result:** No full-application change detection (`ApplicationRef.tick()`) is triggered during timeline playback, achieving native 60 FPS playback without CPU choking.

---

## 3. The `[aveAnimate]` Directive

`[aveAnimate]` is the primary animation workhorse. It combines declarative frame ranges, spring physics, CSS variable bindings, and percentage-based keyframes.

### A. Simple Tweens & Springs

```html
<div class="card" [aveAnimate]="{
  range: [0, 30], // Active from frame 0 to frame 30
  from: { opacity: 0, translateY: 40, scale: 0.8 },
  to:   { opacity: 1, translateY: 0, scale: 1 },
  spring: { damping: 12, mass: 1 }
}">
  <h1>Title</h1>
</div>
```

### B. Percentage-Based Keyframes

Developers who prefer standard keyframe thinking can define percentages mapped across the frame range:

```html
<div class="badge" [aveAnimate]="{
  range: [15, 60],
  keyframes: {
    '0%':   { opacity: 0, transform: 'scale(0.8) rotate(-5deg)' },
    '50%':  { opacity: 1, transform: 'scale(1.1) rotate(2deg)' },
    '100%': { transform: 'scale(1) rotate(0deg)' }
  },
  easing: 'ease-out'
}">
```

### C. The CSS Variable Bridge (Pseudo-Elements & SCSS Class Isolation)

JavaScript cannot directly access or set inline styles on pseudo-elements (`::before`, `::after`). AVE solves this by binding animated values to **CSS Custom Properties (Variables)**:

**`my-scene.component.scss`**:
```scss
.shimmer-card {
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    /* Consumes dynamic CSS variables driven by AVE */
    transform: translateX(var(--shimmer-x, -100%));
    opacity: var(--shimmer-opacity, 0);
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  }
}
```

**`my-scene.component.html`**:
```html
<div class="shimmer-card" [aveAnimate]="{
  range: [30, 75],
  cssVars: {
    '--shimmer-x': { from: '-100%', to: '200%' },
    '--shimmer-opacity': { from: 0, to: 0.7, easing: 'ease-in-out' }
  }
}">
```

---

## 4. Pluggable Staggering Architecture

Motion design heavily relies on staggered entrances and exits. AVE provides a pluggable function contract that prevents layout-thrashing and supports complex spatial distributions.

### A. The Pluggable Stagger Contract

```typescript
export type StaggerFn = (
  index: number,
  total: number,
  context?: { fps: number; baseFrame: number }
) => number; // Returns frame offset for the item
```

### B. Standard Stagger Factories

```typescript
import { stagger } from '@angular-video/core';

// 1. Uniform linear delay
stagger.each(5); // 5 frames between each element

// 2. Positional distribution ('start' | 'end' | 'center' | 'edges')
stagger.from('center', { each: 4 });

// 3. 2D Matrix / Grid Staggering
stagger.grid([3, 4], { from: 'top-left', each: 3 });

// 4. Seeded Deterministic Random (scatters delay consistently across scrubs)
stagger.random({ min: 0, max: 20, seed: 'feature-list' });
```

### C. Custom Stagger Algorithms

Developers can supply custom mathematical functions:

```typescript
// Custom Sine-Wave Stagger
export const sineWaveStagger: StaggerFn = (index, total) => {
  const normalized = index / Math.max(total - 1, 1);
  return Math.round(Math.sin(normalized * Math.PI) * 15);
};
```

### D. Lifecycle Pre-State Protection (Avoiding the `@if` Pitfall)

Using `@if (frame > 15)` causes browser hitching because elements are created and destroyed dynamically. AVE's staggering engine uses **Lifecycle Envelopes**:

```html
@for (item of items; track item.id; let i = $index) {
  <div class="list-item" [aveAnimate]="{
    range: [10, 40],
    stagger: stagger.from('start', { each: 6 }),
    index: i,
    total: items.length,
    preState: 'hidden', // Element remains 'visibility: hidden' until its frame arrives
    postState: 'clamp',  // Holds the final state after finishing
    from: { opacity: 0, translateY: 25 },
    to: { opacity: 1, translateY: 0 }
  }">
    {{ item.title }}
  </div>
}
```

---

## 5. Hijacking SCSS `@keyframes`: The `[aveSyncCss]` Directive

For legacy CSS animations, Animate.css, or complex SCSS `@keyframes`, AVE provides `[aveSyncCss]`, which bridges browser CSS animations with the deterministic frame clock using the **Web Animations API (WAAPI)**.

```scss
/* component.scss */
@keyframes neonPulse {
  0% { transform: scale(1); filter: drop-shadow(0 0 2px #3b82f6); }
  50% { transform: scale(1.05); filter: drop-shadow(0 0 10px #3b82f6); }
  100% { transform: scale(1); filter: drop-shadow(0 0 2px #3b82f6); }
}

.pulse-badge {
  animation: neonPulse 1.5s infinite;
}
```

```html
<!-- Automatically hijacks and locks the animation to the engine's frame clock -->
<div class="pulse-badge" [aveSyncCss]="'neonPulse'">
```

### Underlying Mechanism
1. On element attachment, `[aveSyncCss]` calls `element.getAnimations()`.
2. Immediately pauses the animation (`anim.pause()`), freezing the browser's wall clock.
3. On every frame change, drives time deterministically:
   $$\text{currentTime (ms)} = \left(\frac{\text{currentFrame}}{\text{fps}}\right) \times 1000$$

---

## 6. Deterministic Guardrails

| Feature | Support | Reason / Workaround |
| :--- | :--- | :--- |
| **CSS `transition`** | **Banned / Discouraged** | Bound to wall-clock time; fails during backward scrubbing and headless exports. Use `[aveAnimate]` instead. |
| **CSS `@keyframes`** | **Supported via `[aveSyncCss]`** | Hijacked via WAAPI to bind time to frame counter. |
| **Directives `[aveAnimate]`** | **Recommended Standard** | Mathematical, deterministic, and hardware-accelerated. |
| **Pseudo-elements (`::before`)** | **Supported via CSS Variables** | Targeted via `--var` bindings on parent elements. |
| **Pseudo-classes (`:hover`)** | **Ignored** | Video has no cursor interactivity. |
| **Pseudo-classes (`:nth-child`)** | **Supported via `@for` + Stagger** | Direct index binding in Angular templates. |
