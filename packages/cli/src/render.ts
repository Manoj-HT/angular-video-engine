import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export interface RenderOptions {
  compositionId: string;
  output?: string;
  port?: number;
  quality?: number;
  scale?: number;
}

export interface StillOptions {
  compositionId: string;
  frame: number;
  output?: string;
  port?: number;
}

export async function renderVideo(options: RenderOptions): Promise<string> {
  const {
    compositionId,
    output = `out/${compositionId}.mp4`,
    port = 4250
  } = options;

  const resolvedOutput = path.resolve(process.cwd(), output);
  const outDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`\n🎬 [AVE Render] Starting export for "${compositionId}"`);
  console.log(`   Destination: ${resolvedOutput}`);

  // 1. Launch Headless Chromium
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--force-color-profile=srgb',
      '--disable-web-security',
      '--allow-file-access-from-files'
    ]
  });

  const page = await browser.newPage();

  // 2. Load Headless Render Mode
  const url = `http://localhost:${port}/?mode=render&id=${compositionId}`;
  await page.goto(url, { waitUntil: 'networkidle' });

  // 3. Inspect Metadata from Engine Bridge
  await page.waitForFunction(() => typeof (window as any).__AVE_GET_METADATA === 'function');
  const metadata = await page.evaluate(() => (window as any).__AVE_GET_METADATA());

  console.log(`   Video Config: ${metadata.width}×${metadata.height} @ ${metadata.fps}fps (${metadata.durationInFrames} frames)`);

  // Set exact viewport matching composition
  await page.setViewportSize({
    width: metadata.width,
    height: metadata.height
  });

  // 4. Wait for Asset Gate to be Ready
  await page.waitForFunction(() => (window as any).__AVE_IS_READY() === true);

  // 5. Spawn Native FFmpeg with Direct stdin Memory Pipe
  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-r', String(metadata.fps),
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    resolvedOutput
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);

  let ffmpegError = '';
  ffmpeg.stderr.on('data', (chunk) => {
    ffmpegError += chunk.toString();
  });

  const ffmpegExitPromise = new Promise<void>((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}\n${ffmpegError}`));
      }
    });
  });

  // 6. Frame Capture Loop
  const startTime = Date.now();
  const stageLocator = page.locator('#ave-canvas-stage');

  for (let frame = 0; frame < metadata.durationInFrames; frame++) {
    // Drive engine playhead deterministically
    await page.evaluate((f) => (window as any).__AVE_SEEK_FRAME(f), frame);

    // Capture screenshot buffer directly from GPU compositor
    const screenshotBuffer = await stageLocator.screenshot({
      type: 'png',
      omitBackground: false
    });

    // Stream into FFmpeg stdin
    ffmpeg.stdin.write(screenshotBuffer);

    // Render Progress Bar
    const percent = Math.round(((frame + 1) / metadata.durationInFrames) * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fpsRate = ((frame + 1) / ((Date.now() - startTime) / 1000 || 1)).toFixed(1);

    process.stdout.write(
      `\r   Rendering: [${'#'.repeat(Math.floor(percent / 5)).padEnd(20, '-')}] ${percent}% | Frame ${frame + 1}/${metadata.durationInFrames} | ${fpsRate} fps | ${elapsed}s`
    );
  }

  // Finalize FFmpeg Stream
  ffmpeg.stdin.end();
  await ffmpegExitPromise;
  await browser.close();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const fileSizeMb = (fs.statSync(resolvedOutput).size / (1024 * 1024)).toFixed(2);

  console.log(`\n\n✅ [AVE Render] Export Complete!`);
  console.log(`   File: ${resolvedOutput} (${fileSizeMb} MB)`);
  console.log(`   Render Time: ${totalTime}s`);

  return resolvedOutput;
}

export async function captureStill(options: StillOptions): Promise<string> {
  const {
    compositionId,
    frame,
    output = `out/${compositionId}-frame-${frame}.png`,
    port = 4250
  } = options;

  const resolvedOutput = path.resolve(process.cwd(), output);
  const outDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`\n📸 [AVE Still] Capturing frame ${frame} for "${compositionId}"`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const url = `http://localhost:${port}/?mode=render&id=${compositionId}`;
  await page.goto(url, { waitUntil: 'networkidle' });

  await page.waitForFunction(() => typeof (window as any).__AVE_GET_METADATA === 'function');
  const metadata = await page.evaluate(() => (window as any).__AVE_GET_METADATA());

  await page.setViewportSize({
    width: metadata.width,
    height: metadata.height
  });

  await page.waitForFunction(() => (window as any).__AVE_IS_READY() === true);

  // Seek and capture
  await page.evaluate((f) => (window as any).__AVE_SEEK_FRAME(f), frame);
  const stageLocator = page.locator('#ave-canvas-stage');
  await stageLocator.screenshot({ path: resolvedOutput, type: 'png' });

  await browser.close();

  console.log(`✅ [AVE Still] Saved to: ${resolvedOutput}`);
  return resolvedOutput;
}
