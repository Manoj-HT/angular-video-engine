# 01. Architecture, Package Anatomy & Studio Delivery

## 1. Executive Summary

**Angular Video Engine (AVE)** is a programmatic video rendering engine and interactive studio built natively for Angular. It allows developers to define video scenes using standard Angular components, animate elements deterministically with signals and directives, and export videos either client-side (via WebCodecs / FFmpeg WASM) or server-side (via headless Chromium and native FFmpeg).

---

## 2. Package Anatomy (Modular Monorepo)

To ensure AVE can be imported into existing enterprise Angular apps as a lightweight library without imposing full-stack dependencies, the repository is split into four decoupled packages:

```
angular-video-engine/
├── packages/
│   ├── core/         # Primitives: Frame signals, interpolation math, timing contracts
│   ├── studio/       # UI layer: Canvas, timeline scrubber, inspector, transport controls
│   ├── renderer/     # Client-side render pipeline: WebCodecs, MP4Muxer, FFmpeg WASM
│   └── cli/          # Dev tooling & server runner: Standalone dev server, Playwright exporter
```

### Package Responsibilities

1. **`@angular-video/core`**
   - Provides frame hooks: `injectCurrentFrame()`, `injectVideoConfig()`.
   - Pure mathematical interpolation algorithms: `interpolate()`, `spring()`, easing functions.
   - Type definitions for Compositions, Sequences, and Props.
   - Has zero DOM/UI dependencies; runs in both browser and headless Node contexts.

2. **`@angular-video/studio`**
   - Standalone Angular components providing the Studio interface:
     - `<ave-studio>`: Full workbench (preview canvas, timeline, tracks, properties panel).
     - `<ave-player>`: Minimalist embeddable player for previews and client playback.
   - Change detection optimization: timeline scrub loops run outside Angular's global zone (`runOutsideAngular`) or purely via localized Signals to prevent re-rendering the entire app during playback.

3. **`@angular-video/renderer`**
   - In-browser export engine.
   - Utilizes browser-native `VideoEncoder` (WebCodecs) and `mp4-muxer` for real-time or faster-than-real-time encoding.
   - Optional fallback to `@ffmpeg/ffmpeg` (WASM) for legacy browsers or specific codec containers.

4. **`@angular-video/cli`**
   - Optional companion package.
   - Houses the headless rendering pipeline using Playwright/Puppeteer and native FFmpeg binaries.
   - Powers the standalone Dev Studio CLI server (`npx ave studio`).

---

## 3. The Dual-Door Delivery Architecture

AVE caters to two distinct developer personas without compromising on developer experience:

```
                             ┌──────────────────────────────────────────────┐
                             │          @angular-video/core Engine          │
                             └──────────────────────┬───────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
    [Door 1: Hobbyist / Fast Dev]                                        [Door 2: SaaS / Enterprise]
       Stand-alone Studio CLI                                            Embeddable Angular Component
         (`npx ave studio`)                                            (`<ave-studio>` / `<ave-player>`)
                 │                                                                     │
   • Zero routing or app changes                                         • Embeds into any existing route
   • Spawns dedicated dev server (localhost:4250)                        • Configurable controls & white-label
   • Auto-discovers video entry point                                    • Connected to SaaS state / backends
```

### Door 1: Standalone Dev CLI (Hobbyist Path)
- **Use Case:** A developer wants to build a video without building an entire application around it.
- **Workflow:**
  1. Installs via `ng add @angular-video/engine`.
  2. Runs `npm run studio` (calls `ave studio`).
  3. CLI starts an isolated Vite dev server at `http://localhost:4250`.
  4. Mounts the studio workbench pointing directly to the project's video registry.

### Door 2: Embeddable Component (Enterprise / SaaS Path)
- **Use Case:** An enterprise SaaS company wants to offer an internal video maker or dynamic banner generator.
- **Workflow:**
  1. Imports `AveStudioComponent` or `AvePlayerComponent`.
  2. Embeds directly into any Angular template or modal:
     ```html
     <ave-studio 
       [compositionId]="'ProductPromo'" 
       [props]="userSelectedProps()" 
       (exportRequested)="triggerCloudExport($event)" />
     ```

---

## 4. Composition Registration: Strongly-Typed Registry

To maximize TypeScript benefits (type safety, editor autocompletion, prop validation), video compositions are registered in a central TypeScript configuration file (e.g., `src/videos/index.ts`).

### Type Definition Contract

```typescript
import { Type } from '@angular/core';

export interface VideoMetadata<TProps = Record<string, unknown>> {
  id: string;
  title?: string;
  component: Type<unknown>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  defaultProps?: TProps;
}
```

### Developer Usage (`src/videos/index.ts`)

```typescript
import { defineCompositions } from '@angular-video/core';
import { HeroVideoComponent, HeroVideoProps } from './hero/hero.component';
import { PromoStoryComponent } from './promo/promo-story.component';

export default defineCompositions([
  {
    id: 'HeroVideo',
    title: 'Landing Page Hero Video',
    component: HeroVideoComponent,
    durationInFrames: 300, // 10 seconds at 30 fps
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps: <HeroVideoProps>{
      heading: 'Build Videos in Angular',
      themeColor: '#e02424',
      badgeUrl: '/assets/badge.svg'
    }
  },
  {
    id: 'PromoStory',
    title: '9:16 Social Story',
    component: PromoStoryComponent,
    durationInFrames: 150,
    fps: 30,
    width: 1080,
    height: 1920, // Vertical video
  }
]);
```

### Benefits of this Pattern:
- **Strict Compile-Time Checking:** `defaultProps` is checked against the component's expected input type.
- **Inspector Introspection:** The Studio inspector reads `defaultProps` to automatically generate editable UI controls (color pickers, text fields, numeric sliders).
- **Separation of Concerns:** The main Angular application's router and configuration remain clean and untouched.

---

## 5. Architectural Safeguards & Decisions

| Decision | Choice | Rationale |
| :--- | :--- | :--- |
| **Package Distribution** | Modular Monorepo (`core`, `studio`, `renderer`, `cli`) | Keeps bundle lightweight; doesn't force backend dependencies on frontend-only consumers. |
| **UI Presentation** | Dual-Door (CLI + Embeddable) | Solves both solo developer ergonomics and complex corporate multi-tenant needs. |
| **Video Discovery** | Strongly-typed TS config (`defineCompositions`) | Leverages Angular's TypeScript strength without messy routing or opaque DI providers. |
| **Rendering Strategy** | Hybrid (Client WebCodecs + Server Playwright) | In-browser speed for quick drafts; server scalability for production pipelines. |
