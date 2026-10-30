import { InjectionToken, inject, Signal, signal } from '@angular/core';
import { VideoConfig } from '../types/video.types';

export const FRAME_TOKEN = new InjectionToken<Signal<number>>('AVE_FRAME_TOKEN', {
  providedIn: 'root',
  factory: () => signal(0)
});

export const GLOBAL_FRAME_TOKEN = new InjectionToken<Signal<number>>('AVE_GLOBAL_FRAME_TOKEN', {
  providedIn: 'root',
  factory: () => inject(FRAME_TOKEN)
});

export const VIDEO_CONFIG_TOKEN = new InjectionToken<Signal<VideoConfig>>('AVE_VIDEO_CONFIG_TOKEN', {
  providedIn: 'root',
  factory: () => signal({
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 300
  })
});

/**
 * Injects the current frame relative to the active sequence or scene context.
 */
export function injectCurrentFrame(): Signal<number> {
  return inject(FRAME_TOKEN);
}

/**
 * Injects the global master frame across the entire timeline.
 */
export function injectGlobalFrame(): Signal<number> {
  return inject(GLOBAL_FRAME_TOKEN);
}

/**
 * Injects the video configuration (FPS, canvas dimensions, total duration).
 */
export function injectVideoConfig(): Signal<VideoConfig> {
  return inject(VIDEO_CONFIG_TOKEN);
}
