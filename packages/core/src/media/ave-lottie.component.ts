import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  effect,
  inject,
  afterNextRender,
  OnDestroy
} from '@angular/core';
import { injectCurrentFrame } from '../tokens/frame.tokens';
import { injectAssetGate } from '../services/asset-gate.service';

export interface LottieAnimationItem {
  goToAndStop(value: number, isFrame?: boolean): void;
  destroy(): void;
  totalFrames: number;
}

@Component({
  selector: 'ave-lottie',
  standalone: true,
  template: `<div #container class="ave-lottie-container" [style.width]="'100%'" [style.height]="'100%'"></div>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .ave-lottie-container {
      overflow: hidden;
    }
  `]
})
export class AveLottieComponent implements OnDestroy {
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  @Input() src?: string;
  @Input() animationData?: Record<string, unknown>;
  @Input() loop = false;
  @Input() renderer: 'svg' | 'canvas' = 'svg';

  private frame = injectCurrentFrame();
  private gate = injectAssetGate();
  private animItem: LottieAnimationItem | null = null;

  constructor() {
    afterNextRender(async () => {
      await this.initLottie();
    });

    effect(() => {
      const f = this.frame();
      if (this.animItem) {
        let targetFrame = f;
        if (this.loop && this.animItem.totalFrames > 0) {
          targetFrame = f % this.animItem.totalFrames;
        }
        this.animItem.goToAndStop(targetFrame, true);
      }
    });
  }

  private async initLottie(): Promise<void> {
    const unblock = this.gate.block(this.src || 'Lottie Animation');

    try {
      // Dynamic import of lottie-web if available
      const lottieModule = await import('lottie-web').catch(() => null);
      const lottie = (lottieModule as any)?.default || lottieModule;

      if (!lottie) {
        console.warn('[AVE] lottie-web is not installed. Please install lottie-web to use <ave-lottie>.');
        return;
      }

      this.animItem = lottie.loadAnimation({
        container: this.containerRef.nativeElement,
        renderer: this.renderer,
        loop: false, // We control frames deterministically
        autoplay: false,
        path: this.src,
        animationData: this.animationData
      });

      // Synchronize immediately to current frame
      this.animItem?.goToAndStop(this.frame(), true);
    } catch (err) {
      console.error('[AVE] Failed to load Lottie animation:', err);
    } finally {
      unblock();
    }
  }

  ngOnDestroy(): void {
    this.animItem?.destroy();
    this.animItem = null;
  }
}
