# 05. Master Clock, Frame Determinism & Seeking

## 1. Overview & The Dual-Clock Paradigm

In programmatic video creation, time operates under two fundamentally conflicting constraints:
1. **The Interactive Preview Clock (Studio UI):** Must execute in real-time ($1.0\times$ wall clock), syncing audio and video without human-perceptible drift or stuttering.
2. **The Offline Export Clock (Render Engine):** Operates completely decoupled from wall-clock time, evaluating frames discretely ($0, 1, 2, \dots, N$) at whatever rate the hardware can produce them.

---

## 2. The Studio Preview Clock: Audio as the Master Clock

In web browsers, visual rendering via `requestAnimationFrame` is prone to frame drops when heavy layouts or complex shaders are executed. However, hardware audio playback via the **Web Audio API (`AudioContext`)** never slows down.

> [!IMPORTANT]
> **The Desynchronization Pitfall:**
> If visuals drop frames while audio plays on its independent hardware clock, the audio will drift ahead of the visuals by several seconds over a 1-minute video.

### The Audio Master Clock Architecture

During Studio playback:
1. **Master Clock Assignment:** The Web Audio `AudioContext.currentTime` serves as the authoritative timeline master.
2. **Frame Derivation:** Visual frames are calculated dynamically from audio elapsed time:
   $$\text{currentFrame} = \lfloor \text{audioContext.currentTime} \times \text{fps} \rfloor$$
3. **Intelligent Frame Dropping:** If a frame takes 35ms to calculate, the engine detects that the audio clock has advanced past the target frame. It immediately skips the lagged visual frames and renders the frame matching current audio time.
4. **Scrub & Pause Mechanics:** When scrubbing or paused, the audio context is muted and silenced; the visual playhead takes over as master.

---

## 3. The Offline Export Engine: Multi-Core Concurrency

To minimize rendering time, AVE implements multi-process CPU core chunking via headless Chromium workers and native FFmpeg pipelines.

```
                               [Video Composition: 1200 Frames]
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        ▼                                             ▼
               [Worker 0: Frames 0-299]                     [Worker 1: Frames 300-599]
               Headless Chromium Core 1                     Headless Chromium Core 2
                        │                                             │
                        ▼                                             ▼
               [Worker 2: Frames 600-899]                   [Worker 3: Frames 900-1199]
               Headless Chromium Core 3                     Headless Chromium Core 4
                        │                                             │
                        └──────────────────────┬──────────────────────┘
                                               │ Streams raw frame bytes via stdin pipe
                                               ▼
                                    [Native FFmpeg Binary]
                                               │
                                               ▼
                                       [Final output.mp4]
```

### Key Optimizations:
1. **Temporal Chunking:** Rather than alternating frames (which causes decoder cache misses in video elements), continuous frame blocks are assigned to each worker.
2. **Zero-Disk I/O (Streaming Memory Pipe):** Frames are never saved to disk as thousands of PNG files. Each Chromium worker streams raw uncompressed image buffers directly into FFmpeg's `stdin` (`ffmpeg -f image2pipe -i -`).
3. **Concurrent Audio Multiplexing:** Audio streams and volume curves are calculated and muxed in the same encoding pass.

---

## 4. Temporal Pass-Through Compositing ("Hole-Punching")

For high-resolution footage (e.g., 4K/60FPS video backgrounds), decoding frames inside Chromium, converting them to DOM textures, and capturing screenshots imposes severe overhead and generation loss.

AVE introduces **Pass-Through Compositing**:
- Chromium leaves a transparent alpha box where the video sits.
- FFmpeg overlays the original source video directly into the transparent region using its hardware-accelerated video decoder.

### Temporal Segmentation & Reactive Signals
A video clip may be flat for the first 500 frames, but transition into a 3D perspective mockup at frame 501. AVE supports dynamic temporal mode switching:

```typescript
export class PromoComponent {
  private frame = injectCurrentFrame(); // or injectGlobalFrame()

  passThroughConfig = computed(() => ({
    mode: this.frame() < 500 ? 'enabled' : 'disabled',
    fillFrameCount: 4 // Cross-dissolves over 4 frames at boundary
  }));
}
```

```html
<ave-video [src]="'assets/drone.mp4'" [passThrough]="passThroughConfig()" />
```

### How FFmpeg Executes Temporal Overlays
FFmpeg uses its native timeline filter expression:
```bash
-filter_complex "[0:v][1:v]overlay=enable='between(n,30,499)'"
```
- **Frames 30–499:** FFmpeg overlays the original video stream at native hardware speed.
- **Frames 500+:** The overlay disables, allowing Chromium's 3D-transformed DOM stream to show through.

---

## 5. Transition Seam Feathering (`fillFrameCount`)

> [!WARNING]
> **Gamma & Color Space Discrepancies:**
> Browsers render colors using web color-management profiles (sRGB/Rec. 709), while native FFmpeg operates directly on YUV color matrices. A hard 1-frame cut between an FFmpeg pass-through overlay and a Chromium DOM render can produce a visible brightness or gamma jump.

### The Seam Feathering Solution:
1. **Chromium Color Profile Flag:** Headless Chromium is launched with `--force-color-profile=srgb` to match FFmpeg's target matrix.
2. **Temporal Dissolve Seam (`fillFrameCount`):** When switching between pass-through and DOM modes, AVE blends both streams across a configurable feathering window (e.g., 4 frames):
   - **Boundary Frame $-2$:** 75% FFmpeg / 25% DOM
   - **Boundary Frame $-1$:** 50% FFmpeg / 50% DOM
   - **Boundary Frame $0$:** 25% FFmpeg / 75% DOM
   - **Boundary Frame $+1$:** 100% DOM
3. **Result:** Visual jumps are completely imperceptible to the human eye.

---

## 6. The "Zero-Surprise" Safeguard (`DOMStyleValidator`)

If a user unintentionally applies 3D transforms (`rotateX`, `rotateY`, `perspective`), CSS filters (`blur`), or blend modes while `passThrough` is set to `'enabled'`, AVE prevents visual corruption via automatic inspection:

1. **Introspection:** Inspects computed styles before rendering each interval.
2. **Safe Auto-Downgrade:** If incompatible 3D/filter styles are detected, the engine automatically downgrades that interval to pixel-accurate DOM rendering.
3. **Actionable Diagnostics:** Emits clear warnings in the console and displays a visual indicator in the Studio inspector explaining why DOM rendering was preserved.

---

## 7. Playback Modifiers & Speeds

| Modifier | Browser Preview Support | Export Engine Support |
| :--- | :--- | :--- |
| **Speed (0.25x – 4.0x)** | Native `playbackRate` with pitch preservation | FFmpeg `setpts` / `atempo` filters |
| **Reverse Playback (`-1.0x`)** | Stepped Canvas playback | Background FFmpeg reversal (`-vf reverse -af areverse`) |
| **Frame Scrubbing** | `video.fastSeek()` during scrub; exact seek on pause | Discrete frame-accurate decoding |
