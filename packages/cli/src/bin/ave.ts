#!/usr/bin/env node
import { renderVideo, captureStill } from '../render.js';

function parseArgs(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      flags[key] = val ?? 'true';
    }
  }
  return flags;
}

async function main() {
  const [,, command, target, ...rest] = process.argv;
  const flags = parseArgs(rest);

  if (command === 'render') {
    if (!target) {
      console.error('❌ Error: Missing composition ID. Usage: ave render <compositionId>');
      process.exit(1);
    }

    try {
      await renderVideo({
        compositionId: target,
        output: flags['output'],
        port: flags['port'] ? parseInt(flags['port'], 10) : 4250
      });
    } catch (err) {
      console.error('❌ Render failed:', err);
      process.exit(1);
    }
  } else if (command === 'still') {
    if (!target) {
      console.error('❌ Error: Missing composition ID. Usage: ave still <compositionId> --frame=<number>');
      process.exit(1);
    }
    const frame = parseInt(flags['frame'] || '0', 10);

    try {
      await captureStill({
        compositionId: target,
        frame,
        output: flags['output'],
        port: flags['port'] ? parseInt(flags['port'], 10) : 4250
      });
    } catch (err) {
      console.error('❌ Still capture failed:', err);
      process.exit(1);
    }
  } else {
    console.log(`
Angular Video Engine (AVE) CLI

Commands:
  ave render <compositionId> [--output=out/file.mp4]   Renders a video composition to MP4
  ave still <compositionId> --frame=<number>           Captures a single frame still/poster
  ave studio [--port=4250]                            Launches the visual studio workbench
`);
  }
}

main();
