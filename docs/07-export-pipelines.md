# 07. Export Pipelines (WebCodecs, WASM, Headless Server)

## 1. Overview & Dual-Pipeline Model

**Angular Video Engine (AVE)** features a decoupled, dual-tier export architecture:
1. **In-Browser Client Pipeline (`@angular-video/renderer`):** Leverages modern browser-native hardware encoders (`WebCodecs`) to produce downloadable MP4 and WebM videos directly on the client with **zero server infrastructure costs**.
2. **Headless Server Pipeline (`@angular-video/cli`):** Runs multi-process headless Chromium instances via Playwright, streaming raw frame buffers into native FFmpeg binaries for production-scale batch rendering, alpha transparency (ProRes 4444), and 4K/8K workloads.

---

## 2. Headless Canvas Isolation (Zero UI Chrome)

When rendering via Playwright or headless workers, the Studio UI (timeline, drawers, headers) must not appear in the video.

### The Dedicated Headless Mount Route
AVE serves an isolated mount route:
```
http://localhost:4250/__ave_render?id=HeroPromo
```

### Canvas Root Specifications:
```html
<div id="ave-canvas-stage" style="
  width: 1920px;
  height: 1080px;
  position: fixed;
  inset: 0;
  overflow: hidden;
  contain: strict;
  background: black;
">
  <ng-container *ngComponentOutlet="compositionComponent; inputs: resolvedProps" />
</div>
```
- **Viewport Locking:** Playwright locks its browser window to the exact composition dimensions (`page.setViewportSize({ width: 1920, height: 1080 })`).
- **CDP Optimization:** Screenshots are captured directly from the browser's GPU compositor via Chrome DevTools Protocol (`Page.captureScreenshot`), achieving maximum capture throughput without layout recalculation penalties.

---

## 3. In-Browser Client Export Pipeline (`@angular-video/renderer`)

For rapid social sharing, quick drafts, and client-side SaaS video generators, AVE renders directly in modern browsers without backend calls.

```
┌─────────────────────────────────────────────────────────────┐
│                       RENDER LOOP (BROWSER)                 │
├─────────────────────────────────────────────────────────────┤
│  1. OffscreenCanvas renders Angular DOM / Canvas Frame      │
│  2. VideoFrame created: new VideoFrame(canvas, { timestamp })│
│  3. Hardware Encoder: VideoEncoder.encode(videoFrame)       │
│  4. Muxer: mp4-muxer / webm-muxer packages chunks to Blob   │
│  5. Instant Client Download: Triggered via browser anchor   │
└─────────────────────────────────────────────────────────────┘
```

### Key Advantages:
- **Zero Server Costs:** 100% compute is offloaded to the user's local machine.
- **Hardware Acceleration:** Uses device GPU hardware encoders (Apple Silicon VideoToolbox, Intel QuickSync, NVIDIA NVENC).
- **WASM Fallback:** For browsers lacking complete `WebCodecs` support, an optional `@ffmpeg/ffmpeg` (WebAssembly) fallback engine is provided.

---

## 4. Headless Server Export Pipeline (`@angular-video/cli`)

For production rendering, CI/CD automation, and high-bitrate masters, the CLI delivers maximum multi-core performance:

```bash
npx ave render HeroPromo --output=dist/hero.mp4 --concurrency=auto
```

### Architecture & Memory Pipe:
1. **Parallel Worker Allocation:** Auto-detects available CPU cores via `os.cpus().length` and spawns $N$ headless Chromium tabs.
2. **Temporal Chunking:** Distributes frame ranges across workers (e.g., Worker 0: 0–299, Worker 1: 300–599).
3. **Direct Memory Pipe (Zero Disk Bloat):** Workers pipe raw uncompressed frame buffers directly into FFmpeg's `stdin` via Node.js streams (`ffmpeg -f image2pipe -i -`). No intermediate PNG files are written to disk.
4. **Audio Multiplexing:** Audio tracks and dynamic volume automation curves are rendered via the Web Audio offline context and multiplexed in the final container.

---

## 5. Supported Codecs & Export Formats

| Format | Codec / Container | Alpha / Transparency | Target Use Case |
| :--- | :--- | :---: | :--- |
| **MP4 (Universal)** | H.264 (AVC) + AAC | No | Social media (YouTube, Twitter, Instagram), web embeds. |
| **MP4 (High Efficiency)** | H.265 (HEVC) or AV1 | No | 4K HDR, optimized bandwidth storage. |
| **WebM** | VP9 + Opus | **Yes** | Web overlays, transparent browser animations. |
| **Apple ProRes 4444** | ProRes (.mov) + PCM | **Yes** | Lossless master files for Premiere Pro, DaVinci, After Effects. |
| **Animated GIF** | Two-pass palettegen GIF | **Yes** (1-bit) | Email marketing, GitHub READMEs, social memes. |
| **Lottie JSON (Experimental)** | Bodymovin JSON | **Yes** | Vector animations for iOS, Android, and web. |

---

## 6. Experimental Vector Compiler: Lottie JSON Export

AVE includes an experimental vector compiler capable of compiling pure SVG/Vector compositions into native **Bodymovin Lottie JSON**.

### How It Works:
1. The compiler analyzes compositions constructed with SVG vector elements (`<svg>`, `<path>`, `<rect>`, `<circle>`).
2. Extracts declarative `[aveAnimate]` keyframes (`opacity`, `transform: translate, scale, rotate`, `fill`, `strokeDashoffset`).
3. Maps keyframe ranges and Bezier curves into Bodymovin JSON layer arrays (`p`, `s`, `r`, `o` properties).
4. Outputs an ultra-lightweight `.json` file playable across iOS, Android, and Web via standard Lottie runtimes.

> [!NOTE]
> HTML5 `<video>`, live `<ave-iframe>`, and CSS flexbox auto-wrapping layouts cannot be compiled into native vector Lottie JSON and require standard video containers (MP4/WebM).
