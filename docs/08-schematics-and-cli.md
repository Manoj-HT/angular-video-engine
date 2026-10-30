# 08. Schematics (`ng add`) & CLI Commands

## 1. Overview

**Angular Video Engine (AVE)** integrates seamlessly into modern Angular applications using Angular Schematics (`ng add`) and provides a standalone developer CLI (`ave`) for running the Studio workbench, generating compositions, and triggering headless production renders.

---

## 2. The Installation Schematic: `ng add @angular-video/engine`

A single command configures an existing Angular project for video production.

```bash
ng add @angular-video/engine
```

### What the Schematic Executes:

1. **Dependency Installation:**
   Adds core and studio packages to `package.json`:
   - `@angular-video/core` (primitives, signals, math, timing)
   - `@angular-video/studio` (UI canvas, timeline, inspector)
   - `@angular-video/renderer` (WebCodecs & WASM client exporters)
   - `@angular-video/cli` (devDependency: headless Playwright runner & FFmpeg pipeline)
   - Media decoders: `gifuct-js`, `lottie-web`, `mp4-muxer`

2. **Scaffolding Starter Directory (`src/videos/`):**
   ```
   src/
   └── videos/
       ├── index.ts                      # Master typed composition registry
       └── my-first-video/
           ├── my-first-video.component.ts
           ├── my-first-video.component.html
           └── my-first-video.component.scss
   ```

3. **Injected `package.json` Scripts:**
   ```json
   {
     "scripts": {
       "studio": "ave studio",
       "render": "ave render",
       "still": "ave still"
     }
   }
   ```

4. **`angular.json` Build & Serve Configuration:**
   - **Cross-Origin Isolation:** Injects COOP (`Cross-Origin-Opener-Policy: same-origin`) and COEP (`Cross-Origin-Embedder-Policy: require-corp`) headers into the dev server configuration to enable high-performance `SharedArrayBuffer` and WebAssembly decoders.
   - **Asset Path Mapping:** Ensures static video, audio, and font files located in `src/videos/assets/` or `public/videos/` are included in the build assets array.

---

## 3. The AVE CLI Command Suite (`npx ave`)

The CLI handles both interactive development and automated batch rendering.

### A. `ave studio` (Dev Workbench)
Launches the standalone Studio dev server on its dedicated port:
```bash
npx ave studio [options]
```
- `--port=<number>`: Port number (default: `4250`).
- `--open`: Automatically opens default browser.
- `--composition=<id>`: Focuses on a specific composition upon startup.

---

### B. `ave render` (Headless Production Export)
Renders a composition into a finalized video file using multi-threaded Playwright workers and native FFmpeg:
```bash
npx ave render <compositionId> [options]
```

#### Command Options & Flags:
- `--output=<path>`: Destination file path (e.g., `--output=dist/promo.mp4`). Default: `out/<id>.mp4`.
- `--format=mp4 | webm | prores | gif | lottie`: Container and codec selection.
- `--concurrency=<number | auto>`: Number of parallel Chromium worker instances (default: `auto`, matching CPU core count).
- `--scale=<number>`: Multiplies resolution scale (e.g., `--scale=2` renders a 1080p composition at 4K).
- `--quality=<number>`: Encoding quality/CRF rate (0–100, default: `80`).

#### Parameterized Batch Rendering (`--props` / `--props-file`):
For programmatic, customer-personalized video pipelines at scale:
```bash
# Pass inline JSON props:
npx ave render WelcomeVideo --props='{"userName":"Alice","theme":"dark"}'

# Or read dynamic props from a batch file:
npx ave render WelcomeVideo --props-file=data/customers.json --output=out/customer-videos/
```

---

### C. `ave still` (Thumbnail & Poster Capture)
Captures a single, pristine still image from any frame in milliseconds without rendering an entire video:
```bash
npx ave still <compositionId> --frame=<number> [options]
```
- `--frame=<number>`: Target frame index (required).
- `--output=<path>`: Destination image path (e.g., `--output=dist/thumbnail.png`). Default: `out/<id>-frame-<n>.png`.

---

### D. `ave generate` (Composition Scaffolding)
Generates a new video composition with boilerplate TypeScript interfaces and components:
```bash
npx ave generate composition <name>
# or Angular CLI equivalent:
ng g @angular-video/engine:composition <name>
```

---

## 4. CI/CD & Headless Production Environments

For cloud rendering pipelines (GitHub Actions, AWS Lambda, Docker containers):

### Minimal Dockerfile Architecture:
```dockerfile
FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Install native FFmpeg binary
RUN apt-get update && apt-get install -y ffmpeg

COPY . .
RUN npm run build

# Render video in container
CMD ["npx", "ave", "render", "HeroPromo", "--output=/output/video.mp4"]
```
