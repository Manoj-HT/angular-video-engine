import { defineCompositions, VideoMetadata } from '@angular-video/core';
import { KineticShowcaseComponent, KineticShowcaseProps } from './kinetic/kinetic-showcase.component';
import { AppDemoSceneComponent, DemoVideoProps } from './demo/demo-scene.component';
import { DirectivesShowcaseComponent, DirectivesShowcaseProps } from './directives/directives-showcase.component';

export const videoCompositions: VideoMetadata[] = defineCompositions([
  {
    id: 'DirectivesShowcase',
    title: 'AVE Directives & FX Showcase (12s)',
    renderName: 'ave_directives_showcase',
    component: DirectivesShowcaseComponent,
    durationInFrames: 360, // 12.0s at 30 fps
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps: <DirectivesShowcaseProps>{
      title: 'NEXT-GEN VIDEO DIRECTIVES',
      tagline: 'Deterministic, Frame-Accurate Programmatic Video Runtime',
      themeColor: '#00d2ff',
      secondaryColor: '#7c4dff'
    },
    tracks: [
      {
        id: 'track-act1-bento',
        name: 'Act I: Spatial Bento Entrance',
        type: 'overlay',
        items: [{ id: 'act1-bento', from: 0, duration: 120, component: DirectivesShowcaseComponent }]
      },
      {
        id: 'track-act2-media',
        name: 'Act II: Media Deck & ave-video',
        type: 'video',
        items: [{ id: 'act2-media-deck', from: 115, duration: 130, component: DirectivesShowcaseComponent }]
      },
      {
        id: 'track-act3-terminal',
        name: 'Act III: Code Terminal & CTA',
        type: 'overlay',
        items: [{ id: 'act3-terminal', from: 240, duration: 120, component: DirectivesShowcaseComponent }]
      },
      {
        id: 'track-hud-css-sync',
        name: 'HUD Radar & Orbit (aveSyncCss)',
        type: 'video',
        items: [{ id: 'hud-radar', from: 0, duration: 360, component: DirectivesShowcaseComponent }]
      },
      {
        id: 'track-audio-synthwave',
        name: 'Synthwave Soundtrack',
        type: 'audio',
        items: [{ from: 0, duration: 360, src: 'assets/audio/synthwave.mp3', volume: 0.75 }]
      }
    ]
  },
  {
    id: 'KineticShowcase',
    title: 'Kinetic Motion Showcase (20s)',
    renderName: 'Kinetic Motion Showcase (20s)',
    component: KineticShowcaseComponent,
    durationInFrames: 600, // 20.0s at 30 fps
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps: <KineticShowcaseProps>{
      title: 'ANGULAR VIDEO ENGINE',
      tagline: 'Deterministic, Frame-Accurate Programmatic Video Runtime',
      badgeText: 'AVE v1.0 KINETIC SHOWCASE',
      themeColor: '#06b6d4',
      secondaryColor: '#8b5cf6'
    },
    tracks: [
      {
        id: 'track-act1-hero',
        name: 'Act I: Logo & Title',
        type: 'overlay',
        items: [{ id: 'hero-title', from: 0, duration: 165, component: KineticShowcaseComponent }]
      },
      {
        id: 'track-act1-eq',
        name: 'Act I: 28-Bar Equalizer',
        type: 'video',
        items: [{ id: 'waveform-bars', from: 35, duration: 130, component: KineticShowcaseComponent }]
      },
      {
        id: 'track-act2-dash',
        name: 'Act II: Glassmorphism Dashboard',
        type: 'video',
        items: [{ id: 'dashboard-grid', from: 155, duration: 175, component: KineticShowcaseComponent }]
      },
      {
        id: 'track-act2-gauge',
        name: 'Act II: 60 FPS Circular Gauge',
        type: 'overlay',
        items: [{ id: 'circular-gauge', from: 165, duration: 150, component: KineticShowcaseComponent }]
      },
      {
        id: 'track-act3-cube',
        name: 'Act III: 3D Isometric Cube',
        type: 'video',
        items: [{ id: 'spatial-cube', from: 325, duration: 165, component: KineticShowcaseComponent }]
      },
      {
        id: 'track-act3-badges',
        name: 'Act III: Spatial Badges',
        type: 'overlay',
        items: [{ id: 'orbit-badges', from: 335, duration: 155, component: KineticShowcaseComponent }]
      },
      {
        id: 'track-act4-finale',
        name: 'Act IV: Grand Finale & Terminal',
        type: 'overlay',
        items: [{ id: 'terminal-cta', from: 480, duration: 120, component: KineticShowcaseComponent }]
      },
      {
        id: 'track-audio-synthwave',
        name: 'Synthwave Cyber Soundtrack',
        type: 'audio',
        items: [{ from: 0, duration: 600, src: 'assets/audio/synthwave.mp3', volume: 1.0 }]
      }
    ]
  },
  {
    id: 'DemoPromo',
    title: 'AVE Product Announcement (6s)',
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
        items: [{ from: 0, duration: 180, src: 'assets/audio/ambient.mp3', volume: 1.0 }]
      }
    ]
  },
  {
    id: 'SocialStory',
    title: '9:16 Vertical Story (4s)',
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

if ((import.meta as any).hot) {
  (import.meta as any).hot.accept();
}
