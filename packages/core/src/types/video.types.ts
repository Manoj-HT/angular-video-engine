import { Type, Signal } from '@angular/core';

export interface VideoConfig {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
}

export interface VideoMetadata<TProps = any> {
  id: string;
  title?: string;
  component: Type<unknown>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  defaultProps?: TProps;
  storyboard?: StoryboardConfig;
  tracks?: TrackConfig[];
}

export type TrackType = 'video' | 'overlay' | 'audio';

export interface BaseTrackItem {
  id?: string;
  from: number;
  duration: number;
}

export interface VisualTrackItem<TProps = Record<string, unknown>> extends BaseTrackItem {
  component: Type<unknown>;
  props?: TProps;
}

export interface AudioTrackItem extends BaseTrackItem {
  src: string;
  volume?: number;
  playbackRate?: number;
}

export type TrackItem = VisualTrackItem | AudioTrackItem;

export interface TrackConfig {
  id: string;
  name?: string;
  type: TrackType;
  items: TrackItem[];
}

export interface StoryboardConfig {
  tracks: TrackConfig[];
}

export type EasingFn = (t: number) => number;

export type StaggerFn = (
  index: number,
  total: number,
  context?: { fps: number; baseFrame: number }
) => number;
