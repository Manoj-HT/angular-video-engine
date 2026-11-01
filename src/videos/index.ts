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
    }
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
