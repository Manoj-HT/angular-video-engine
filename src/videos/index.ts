import { defineCompositions, VideoMetadata } from '@angular-video/core';
import { AppDemoSceneComponent, DemoVideoProps } from './demo/demo-scene.component';

export const videoCompositions: VideoMetadata[] = defineCompositions([
  {
    id: 'DemoPromo',
    title: 'AVE Product Announcement',
    component: AppDemoSceneComponent,
    durationInFrames: 180, // 6 seconds at 30 fps
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps: <DemoVideoProps>{
      headline: 'Build Videos in Angular',
      subhead: 'Deterministic, frame-accurate programmatic video framework with Signals and Directives.',
      themeColor: '#3b82f6',
      badgeText: 'AVE 1.0 Release'
    },
    tracks: [
      {
        id: 'track-seq-badge',
        name: 'Badge Reveal',
        type: 'overlay',
        items: [{ id: 'badge', from: 10, duration: 170, component: AppDemoSceneComponent }]
      },
      {
        id: 'track-seq-headline',
        name: 'Headline',
        type: 'overlay',
        items: [{ id: 'headline', from: 20, duration: 160, component: AppDemoSceneComponent }]
      },
      {
        id: 'track-seq-subhead',
        name: 'Subheadline',
        type: 'overlay',
        items: [{ id: 'subhead', from: 35, duration: 145, component: AppDemoSceneComponent }]
      },
      {
        id: 'track-seq-cards',
        name: 'Features Grid',
        type: 'video',
        items: [{ id: 'cards', from: 50, duration: 130, component: AppDemoSceneComponent }]
      },
      {
        id: 'track-asset-audio',
        name: 'Ambient Soundtrack',
        type: 'audio',
        items: [{ from: 0, duration: 180, src: 'assets/audio/ambient.mp3', volume: 0.5 }]
      }
    ]
  },
  {
    id: 'SocialStory',
    title: '9:16 Vertical Story',
    component: AppDemoSceneComponent,
    durationInFrames: 120, // 4 seconds at 30 fps
    fps: 30,
    width: 1080,
    height: 1920, // Vertical 9:16
    defaultProps: <DemoVideoProps>{
      headline: 'Next-Gen Video',
      subhead: 'Programmatic video creation right inside Angular.',
      themeColor: '#f97316',
      badgeText: '9:16 Format'
    }
  }
]);

export default videoCompositions;
