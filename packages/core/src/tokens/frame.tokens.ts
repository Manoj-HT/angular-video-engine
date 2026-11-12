import { InjectionToken, inject, Signal } from '@angular/core';
import { VideoConfig } from '../types/video.types';
import { RootFrameService } from '../services/frame.service';

/**
 * Token providing the current frame signal (relative to local sequence context, or global if at root).
 */
export const FRAME_TOKEN = new InjectionToken<Signal<number>>('AVE_FRAME_TOKEN', {
  providedIn: 'root',
  factory: () => inject(RootFrameService).frame
});

/**
 * Token providing the global master frame signal across the entire composition.
 */
export const GLOBAL_FRAME_TOKEN = new InjectionToken<Signal<number>>('AVE_GLOBAL_FRAME_TOKEN', {
  providedIn: 'root',
  factory: () => inject(RootFrameService).frame
});

/**
 * Token providing the active video composition configuration (FPS, width, height, duration).
 */
export const VIDEO_CONFIG_TOKEN = new InjectionToken<Signal<VideoConfig>>('AVE_VIDEO_CONFIG_TOKEN', {
  providedIn: 'root',
  factory: () => inject(RootFrameService).config
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
