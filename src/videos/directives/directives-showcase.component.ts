import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  injectCurrentFrame,
  injectVideoConfig,
  AveSequenceDirective,
  AveAnimateDirective,
  AveSyncCssDirective,
  AveImageComponent,
  AveVideoComponent,
  AveAudioComponent,
  stagger
} from '@angular-video/core';

export interface DirectivesShowcaseProps {
  title?: string;
  tagline?: string;
  themeColor?: string;
  secondaryColor?: string;
}

@Component({
  selector: 'app-directives-showcase',
  standalone: true,
  imports: [
    CommonModule,
    AveSequenceDirective,
    AveAnimateDirective,
    AveSyncCssDirective,
    AveImageComponent,
    AveVideoComponent,
    AveAudioComponent
  ],
  templateUrl: './directives-showcase.component.html',
  styleUrls: ['./directives-showcase.component.css']
})
export class DirectivesShowcaseComponent {
  @Input() title = 'NEXT-GEN VIDEO DIRECTIVES';
  @Input() tagline = 'Deterministic, Frame-Accurate Programmatic Video Runtime';
  @Input() themeColor = '#00d2ff';
  @Input() secondaryColor = '#7c4dff';

  readonly frame = injectCurrentFrame();
  readonly config = injectVideoConfig();

  readonly progressPct = computed(() => {
    const total = this.config().durationInFrames;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.frame() / total) * 100));
  });

  readonly staggerFn = stagger.each(6);

  readonly features = [
    {
      badge: 'aveSequence',
      title: 'Temporal Sub-Frames',
      desc: 'Isolated frame timelines with pre/post-roll visibility control and absolute spatial staging.',
      icon: '⏱️',
      accent: '#00d2ff'
    },
    {
      badge: 'aveAnimate',
      title: 'Spring Physics Tweens',
      desc: 'Declarative spring damping, stiffness, bezier easing, and multi-element staggered entrance.',
      icon: '⚡',
      accent: '#7c4dff'
    },
    {
      badge: 'aveSyncCss',
      title: 'CSS Animation Lock',
      desc: 'Lock any pure CSS @keyframes to frame time for zero-drift Web Animations API scrub.',
      icon: '🔄',
      accent: '#10b981'
    }
  ];

  readonly metrics = [
    { label: 'RENDER ACCURACY', value: '100% BIT-EXACT' },
    { label: 'STATE ENGINE', value: 'ANGULAR SIGNALS' },
    { label: 'FRAME BUDGET', value: '33.3 ms @ 30 FPS' },
    { label: 'MEDIA PIPELINE', value: 'HARDWARE ZERO-COPY' }
  ];

  readonly codeSnippets = [
    '<div [aveSequence]="{ from: 0, duration: 180 }">',
    '  <h1 [aveAnimate]="springEntrance">AVE 1.0</h1>',
    '  <div class="radar" [aveSyncCss]="\'radarSweep\'"></div>',
    '  <ave-video src="assets/videos/demo.mp4" />',
    '</div>'
  ];
}
