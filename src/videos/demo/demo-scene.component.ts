import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  injectCurrentFrame,
  interpolate,
  spring,
  stagger,
  AveAnimateDirective,
  AveSequenceDirective
} from '@angular-video/core';

export interface DemoVideoProps {
  headline: string;
  subhead: string;
  themeColor: string;
  badgeText: string;
}

@Component({
  selector: 'app-demo-scene',
  standalone: true,
  imports: [CommonModule, AveAnimateDirective, AveSequenceDirective],
  template: `
    <div class="demo-stage" [style.--theme-color]="themeColor">
      <!-- Background Ambient Glow -->
      <div
        class="ambient-glow"
        [aveAnimate]="{
          range: [0, 90],
          from: { opacity: 0, scale: 0.5 },
          to: { opacity: 0.8, scale: 1.2 },
          spring: { damping: 15 }
        }"
      ></div>

      <!-- Center Feature Container -->
      <div class="content-box">
        <!-- Floating Badge -->
        <div
          class="badge"
          [aveSequence]="{ from: 10, duration: 170 }"
          [aveAnimate]="{
            range: [10, 40],
            from: { opacity: 0, translateY: -20, scale: 0.8 },
            to: { opacity: 1, translateY: 0, scale: 1 },
            spring: { damping: 12 }
          }"
        >
          <span class="badge-dot"></span>
          {{ badgeText }}
        </div>

        <!-- Main Animated Headline -->
        <h1
          class="headline"
          [aveSequence]="{ from: 20, duration: 160 }"
          [aveAnimate]="{
            range: [20, 60],
            from: { opacity: 0, translateY: 40 },
            to: { opacity: 1, translateY: 0 },
            spring: { damping: 14 }
          }"
        >
          {{ headline }}
        </h1>

        <!-- Subheadline -->
        <p
          class="subhead"
          [aveSequence]="{ from: 35, duration: 145 }"
          [aveAnimate]="{
            range: [35, 75],
            from: { opacity: 0, translateY: 20 },
            to: { opacity: 0.9, translateY: 0 }
          }"
        >
          {{ subhead }}
        </p>

        <!-- Staggered Feature Cards Grid -->
        <div class="cards-grid" [aveSequence]="{ from: 50, duration: 130 }">
          @for (card of features; track card.title; let i = $index) {
            <div
              class="feature-card"
              [aveAnimate]="{
                range: [50, 90],
                stagger: staggerFn,
                index: i,
                total: features.length,
                preState: 'hidden',
                from: { opacity: 0, translateY: 30, scale: 0.9 },
                to: { opacity: 1, translateY: 0, scale: 1 },
                spring: { damping: 12 }
              }"
            >
              <div class="card-icon">{{ card.icon }}</div>
              <div class="card-title">{{ card.title }}</div>
              <div class="card-desc">{{ card.desc }}</div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 30%, #161827 0%, #08090f 100%);
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      overflow: hidden;
    }

    .demo-stage {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ambient-glow {
      position: absolute;
      width: 800px;
      height: 800px;
      background: radial-gradient(circle, var(--theme-color, #3b82f6) 0%, transparent 70%);
      filter: blur(80px);
      pointer-events: none;
      opacity: 0.3;
    }

    .content-box {
      position: relative;
      z-index: 10;
      text-align: center;
      max-width: 1200px;
      padding: 0 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(12px);
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #38bdf8;
      margin-bottom: 24px;
    }

    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #38bdf8;
      box-shadow: 0 0 8px #38bdf8;
    }

    .headline {
      font-size: 64px;
      font-weight: 800;
      letter-spacing: -1.5px;
      line-height: 1.1;
      margin: 0 0 16px 0;
      background: linear-gradient(180deg, #ffffff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subhead {
      font-size: 24px;
      color: #94a3b8;
      margin: 0 0 48px 0;
      font-weight: 400;
      max-width: 750px;
      line-height: 1.4;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      width: 100%;
    }

    .feature-card {
      background: rgba(22, 24, 39, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 24px;
      text-align: left;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .card-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }

    .card-title {
      font-size: 18px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 6px;
    }

    .card-desc {
      font-size: 14px;
      color: #64748b;
      line-height: 1.4;
    }
  `]
})
export class AppDemoSceneComponent {
  private frame = injectCurrentFrame();

  @Input() headline = 'Build Videos in Angular';
  @Input() subhead = 'Deterministic, frame-accurate programmatic video framework with Signals and Directives.';
  @Input() themeColor = '#3b82f6';
  @Input() badgeText = 'AVE 1.0 Release';

  readonly staggerFn = stagger.from('center', { each: 5 });

  readonly features = [
    { icon: '⚡', title: 'Signals Reactivity', desc: 'Fine-grained 60 FPS updates bypassing application change detection.' },
    { icon: '🎨', title: 'Zoneless Directives', desc: '[aveAnimate] and [aveSequence] for clean, isolated SCSS styling.' },
    { icon: '🚀', title: 'Dual-Door Studio', desc: 'Zero-config standalone dev CLI or embeddable SaaS Angular component.' }
  ];
}
