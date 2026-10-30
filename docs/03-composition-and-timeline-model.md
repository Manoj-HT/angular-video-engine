# 03. Composition, Sequences & Tracks Data Model

## 1. Overview & Architectural Philosophy

Complex video projects require organizing multiple visual layers, video clips, audio tracks, and animated graphics across time.

Traditional programmatic video libraries (like Remotion) force developers to nest deep JSX `<Sequence>` tags inside view templates, creating **tag soup** and mixing timeline orchestration with element styling.

**Angular Video Engine (AVE)** solves this with a **Dual-Tier Timeline Architecture**:
1. **Macro Orchestration (`storyboard.ts`):** Pure TypeScript configuration defining tracks, scene boundaries, and audio layers. Drives the visual multi-track Studio editor.
2. **Micro Orchestration (`[aveSequence]` directive):** An idiomatic Angular directive that attaches directly to components or `<ng-container>`, completely eliminating unnecessary wrapper DOM nodes.

---

## 2. Hierarchical Frame Dependency Injection

Time in AVE is relative and modular. Sub-scenes must be relocatable across the timeline without breaking their internal animations.

AVE achieves this via **Angular's Hierarchical Dependency Injection (DI)**:

```
┌─────────────────────────────────────────────────────────────┐
│  Studio Root / Engine                                       │
│  provides RootFrameService (Global Frame: 345)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Scene Component or [aveSequence]="{ from: 300 }"           │
│  provides LocalFrameService (Local Frame: 45)               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Child Component / Directive                                │
│  injectCurrentFrame() ──► resolves 45 (Local)               │
│  injectGlobalFrame()  ──► resolves 345 (Global)             │
└─────────────────────────────────────────────────────────────┘
```

### Frame Access APIs

```typescript
import { injectCurrentFrame, injectGlobalFrame, injectVideoConfig } from '@angular-video/core';

@Component({ ... })
export class FeatureSceneComponent {
  // Local frame: Starts at 0 relative to this scene's in-point
  readonly frame = injectCurrentFrame(); // Signal<number>

  // Global frame: Absolute position on master timeline (useful for global audio sync)
  readonly globalFrame = injectGlobalFrame(); // Signal<number>

  // Metadata: FPS, dimensions, total duration
  readonly config = injectVideoConfig();
}
```

### Frame Boundary Clamping
When the global playhead is outside a sequence's active window (`[from, from + duration]`):
- **Before `from` (Pre-roll):** `injectCurrentFrame()` returns `0` (clamped).
- **After `from + duration` (Post-roll):** `injectCurrentFrame()` returns `duration` (clamped).
- **Visibility:** Handled automatically via `visibility: hidden; pointer-events: none;` to eliminate rendering overhead while avoiding DOM teardown lag.

---

## 3. Micro Sequencing: The `[aveSequence]` Directive

Rather than forcing developers to wrap elements in `<ave-sequence>` HTML tags, AVE provides `[aveSequence]` as an **attribute directive**.

### A. Direct Component Attachment (Zero Wrapper Nodes)

```html
<!-- The component IS the sequence. Zero DOM wrapper overhead! -->
<app-hero-card 
  [aveSequence]="{ from: 30, duration: 90 }"
  [title]="'Instant Analytics'" />
```

Under the hood:
- The directive's element injector provides `LocalFrameService`.
- Any `injectCurrentFrame()` calls inside `app-hero-card` resolve to this sequence's local time ($0 \dots 90$).
- Element is automatically hidden before frame 30 and after frame 120.

### B. Grouping Without DOM Penalties (`ng-container`)

When multiple elements must share the same timeline window, developers attach `[aveSequence]` to Angular's virtual `<ng-container>`:

```html
<ng-container [aveSequence]="{ from: 60, duration: 120 }">
  <h1 class="headline">Seamless Performance</h1>
  <p class="description">Driven by Angular Signals</p>
  <app-badge-list />
</ng-container>
```
* `<ng-container>` produces **zero DOM nodes**, ensuring flexbox, grid, and layout trees remain unpolluted.

### Directive Configuration Options

```typescript
export interface SequenceConfig {
  from: number;                    // Start frame (relative to parent scope)
  duration?: number;               // Duration in frames (optional; defaults to remaining parent time)
  layout?: 'absolute' | 'none';    // Default: 'absolute' (covers full video canvas)
  preState?: 'hidden' | 'visible'; // Visibility before 'from' (default: 'hidden')
  postState?: 'hidden' | 'freeze'; // Visibility after duration (default: 'hidden')
}
```

---

## 4. Macro Storyboard (`storyboard.ts`)

For large, multi-scene compositions, defining tracks in a pure TypeScript file provides complete clarity, strong typing, and direct integration with the visual Studio timeline.

### Storyboard Definition

```typescript
import { defineStoryboard } from '@angular-video/core';
import { IntroSceneComponent } from './scenes/intro.component';
import { ProductDemoComponent } from './scenes/demo.component';
import { OutroSceneComponent } from './scenes/outro.component';
import { WatermarkComponent } from './overlays/watermark.component';

export const promoStoryboard = defineStoryboard({
  tracks: [
    // Track 0: Main Video Scenes
    {
      id: 'visual-scenes',
      name: 'Main Video',
      type: 'video',
      items: [
        { from: 0, duration: 90, component: IntroSceneComponent },
        { from: 90, duration: 180, component: ProductDemoComponent, props: { theme: 'dark' } },
        { from: 270, duration: 60, component: OutroSceneComponent }
      ]
    },
    // Track 1: Persistent Graphic Overlays
    {
      id: 'overlay-watermark',
      name: 'Overlays',
      type: 'overlay',
      items: [
        { from: 0, duration: 330, component: WatermarkComponent }
      ]
    },
    // Track 2: Background Music & Sound Effects
    {
      id: 'audio-layers',
      name: 'Audio',
      type: 'audio',
      items: [
        { from: 0, duration: 330, src: 'assets/audio/bg-music.mp3', volume: 0.35 }
      ]
    }
  ]
});
```

### Storyboard Benefits
1. **Studio Timeline Visualization:** The visual Studio timeline directly parses track definitions, rendering draggable clips, waveforms, and track solo/mute toggles.
2. **Dynamic Scene Mounting:** Storyboard scenes are mounted dynamically using Angular's `NgComponentOutlet`.
3. **Optional for Simplicity:** A developer building a simple 5-second bumper can omit `storyboard.ts` entirely and register a single component directly with `defineCompositions`.

---

## 5. Visual Stacking & Coordinate Space

To guarantee pixel-perfect exports at standard resolutions (1080p, 4K, 9:16 vertical):

1. **Root Canvas Container:**
   - Enforces fixed dimensions (`width: 1920px; height: 1080px;`).
   - Uses `position: relative; overflow: hidden; contain: layout size;`.
2. **Layer Stacking Model:**
   - Tracks are rendered sequentially in reverse DOM order or stacked via CSS `z-index`:
     - Track 0 (Bottom/Base): `z-index: 10`
     - Track 1 (Middle): `z-index: 20`
     - Track $N$ (Top/Overlay): `z-index: 100`
3. **Scene Coordinate Bounds:**
   - Unless `layout: 'none'` is specified, scenes and clips are mounted with `position: absolute; inset: 0; width: 100%; height: 100%;`.
