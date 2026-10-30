import { VideoMetadata, StoryboardConfig } from '../types/video.types';

/**
 * Type-safe helper to register one or more video compositions.
 */
export function defineCompositions(compositions: VideoMetadata[]): VideoMetadata[] {
  return compositions;
}

/**
 * Type-safe helper to register a multi-track storyboard.
 */
export function defineStoryboard(config: StoryboardConfig): StoryboardConfig {
  return config;
}
