# 04. Media Assets (Video, Audio, Lottie, GIF, Iframe & Canvas)

## 1. Overview & Compliance Policy

Rendering rich media inside a deterministic video engine requires strict frame synchronization, robust preloading, and complete security compliance.

### Media Compliance & Ethics Policy
**Angular Video Engine (AVE)** is built strictly for enterprise and production workflows. It operates solely on **authorized, directly hosted media streams** (e.g., AWS S3, Cloudflare R2, Cloudinary, Fastly, or local static assets). AVE explicitly rejects and does not bundle illegal scrapers or stream rippers.

---

## 2. Core Media Suite

AVE provides seven dedicated media components designed specifically for frame-accurate playback and exports:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AVE MEDIA COMPONENT SUITE                       │
├─────────────────┬──────────────────────────────────────────────────────┤
│ <ave-video>     │ Hardware-accelerated MP4/WebM with dual-mode seeking │
│ <ave-audio>     │ Web Audio API mixing with timeline waveform peaks    │
│ <ave-lottie>    │ 100% deterministic vector frames via goToAndStop()   │
│ <ave-gif>       │ Client-side in-memory canvas demuxing (zero latency) │
│ <ave-iframe>    │ Live website demos with waitForNetworkIdle & scroll  │
│ <ave-image>     │ Pre-decoded raster & vector graphics (zero blanking) │
│ <ave-canvas>    │ Frame-driven WebGL, Three.js & particle canvas loop  │
└─────────────────┴──────────────────────────────────────────────────────┘
```

---

## 3. Video Handling: `<ave-video>`

HTML5 `<video>` elements are naturally asynchronous and snap to I-frames (keyframes). `<ave-video>` bridges this limitation.

### A. Dual-Mode Seeking
1. **Interactive Scrubbing Mode:**
   - When the user drags the timeline slider in the Studio, `<ave-video>` uses `video.fastSeek()` or throttles seeking to provide a fluid 60 FPS preview without locking the browser UI thread.
2. **Exact Lock Mode (Export & Pause):**
   - During pause or offline rendering (export), `<ave-video>` uses exact time seeking and awaits the `requestVideoFrameCallback()` or `seeked` event before permitting the engine to capture the frame.

### B. Template Usage

```html
<ave-video 
  [src]="'assets/video/interview.mp4'"
  [startFrom]="45"         <!-- Starts playing 1.5s into source video -->
  [playbackRate]="1"
  [volume]="0.8"
  [muted]="false" />
```

### C. Single-Frame Poster / Still Capture
When paused, `<ave-video>` paints its current frame to an offscreen canvas, allowing instant high-resolution poster or thumbnail export via `createImageBitmap(video)`.

---

## 4. Audio Handling: `<ave-audio>`

Audio requires timeline waveform visualization for editing, plus multi-track volume automation.

### A. Web Audio API Mixing
- Audio is managed via a shared browser `AudioContext` connected to dynamic `GainNode` instances.
- Volume fades and ducking are driven by standard AVE signals and interpolation:

```typescript
export class VoiceoverComponent {
  private frame = injectCurrentFrame();

  // Duck audio from 1.0 to 0.2 over frames 60 to 90
  volume = computed(() => interpolate(this.frame(), [60, 90], [1.0, 0.2]));
}
```

```html
<ave-audio 
  [src]="'assets/audio/music.mp3'"
  [volume]="volume()"
  [startFrom]="0" />
```

### B. Timeline Waveform Generation
AVE decodes audio files via `AudioContext.decodeAudioData()` into a lightweight array of amplitude peaks (`number[]`). The Studio timeline renders these peaks as an SVG or Canvas waveform track to help creators sync cuts with audio beats.

---

## 5. Vector Animations: `<ave-lottie>`

Lottie animations contain pure mathematical vector instructions exported from After Effects.

### Complete Determinism via `goToAndStop()`
Instead of running on a wall clock, `<ave-lottie>` calls `lottieInstance.goToAndStop(targetFrame, true)` on every frame tick:

```html
<ave-lottie 
  [src]="'assets/lottie/badge-reveal.json'"
  [renderer]="'svg'"   <!-- Infinite vector sharpness at 4K / 8K -->
  [loop]="false" />
```

- **Zero seek latency:** Sub-millisecond scrubbing forward and backward.
- **Infinite Resolution:** Renders crisp SVG paths without pixelation at any canvas resolution.

---

## 6. GIF Handling: `<ave-gif>`

Standard `<img>` tags cannot be controlled frame-by-frame. AVE parses GIFs entirely **client-side in memory** using a lightweight (10 KB) demuxer (`gifuct-js`).

### How `<ave-gif>` Works:
1. Downloads the GIF buffer once and extracts raw RGBA `ImageData` frames into browser memory in ~10ms.
2. Mounts an HTML5 `<canvas>` element.
3. On every frame tick, paints the exact matching GIF frame via `ctx.putImageData()`.
- **Result:** 100% offline, zero backend server dependencies, instant scrubbing.

```html
<ave-gif [src]="'assets/memes/reaction.gif'" />
```

---

## 7. Live Website Embedding: `<ave-iframe>`

For software product demos and dynamic dashboards, `<ave-iframe>` embeds live web applications into device mockups.

### A. Template Usage & Scroll Automation

```html
<div class="browser-mockup">
  <ave-iframe 
    [src]="'https://app.mysaas.com/overview'"
    [waitFor]="'networkidle'"
    [timeoutMs]="8000"
    [scrollTop]="scrollOffset()" />
</div>
```

```typescript
export class DemoSceneComponent {
  private frame = injectCurrentFrame();

  // Smoothly scroll down 600px between frames 30 and 100
  scrollOffset = computed(() => interpolate(this.frame(), [30, 100], [0, 600], {
    easing: 'ease-in-out'
  }));
}
```

### B. Solving Asynchronous Loading (`waitForNetworkIdle`)
- **Studio Preview:** Waits for the iframe `load` event and DOM stabilization before releasing the render gate.
- **Server Export (Playwright):** Utilizes Playwright's native `page.waitForLoadState('networkidle')` to guarantee API calls, fonts, and images are fully rendered before capturing frames.
- **Cross-Origin Security Boundary:** Client-side WebCodecs canvas capture cannot read pixels across different origins. The Studio automatically warns users to run `npx ave render` (Playwright headless runner) for 100% pixel capture of cross-origin iframes.

---

## 8. Images & Typography Readiness

### A. Zero Blank Frames: `<ave-image>`
Standard images can pop in with blank white rectangles while loading over the network. `<ave-image>` gates rendering until `img.decode()` resolves.

```html
<ave-image [src]="'https://cdn.example.com/hero.png'" [fit]="'cover'" />
```

### B. Font Loading Barrier (`waitForFont`)
Custom web fonts can trigger a Flash of Unstyled Text (FOUT). AVE delays export playback until `document.fonts.ready` finishes loading all declared font families.

---

## 9. The Asset Readiness Gate (`AssetGateService`)

All media components interact with the central `AssetGateService`:

```
[Media Component Mounts] ──► gate.block('Loading 4K Video')
                                      │
                         [Engine Pauses / Shows Studio Spinner]
                                      │
[Asset Buffer Decoded]   ──► gate.unblock('Loading 4K Video')
                                      │
                         [Engine Resumes Frame Playback / Capture]
```

### Gate Service Contract

```typescript
export abstract class AssetGateService {
  abstract block(identifier: string): () => void;
  abstract isReady(): Signal<boolean>;
  abstract pendingAssets(): Signal<string[]>;
}
```
