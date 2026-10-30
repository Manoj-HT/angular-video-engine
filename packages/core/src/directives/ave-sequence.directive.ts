import {
  Directive,
  Input,
  ElementRef,
  Renderer2,
  effect,
  inject,
  Signal,
  computed,
  InjectionToken,
  Optional,
  SkipSelf
} from '@angular/core';
import { FRAME_TOKEN, VIDEO_CONFIG_TOKEN } from '../tokens/frame.tokens';

export interface SequenceConfig {
  from: number;
  duration?: number;
  layout?: 'absolute' | 'none';
  preState?: 'hidden' | 'visible';
  postState?: 'hidden' | 'freeze';
}

@Directive({
  selector: '[aveSequence]',
  standalone: true,
  providers: [
    {
      provide: FRAME_TOKEN,
      useFactory: () => {
        const parentFrame = inject(FRAME_TOKEN, { skipSelf: true, optional: true });
        const dir = inject(AveSequenceDirective);
        return dir.localFrame;
      }
    }
  ]
})
export class AveSequenceDirective {
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private parentFrame = inject(FRAME_TOKEN, { skipSelf: true, optional: true });

  @Input({ required: true, alias: 'aveSequence' }) config!: SequenceConfig;

  readonly localFrame: Signal<number> = computed(() => {
    const parent = this.parentFrame ? this.parentFrame() : 0;
    const from = this.config.from;
    const duration = this.config.duration;
    const local = parent - from;

    if (local < 0) return 0;
    if (duration !== undefined && local > duration) return duration;
    return local;
  });

  constructor() {
    effect(() => {
      if (!this.config) return;

      const parent = this.parentFrame ? this.parentFrame() : 0;
      const from = this.config.from;
      const duration = this.config.duration;
      const preState = this.config.preState ?? 'hidden';
      const postState = this.config.postState ?? 'hidden';
      const layout = this.config.layout ?? 'none';

      if (layout === 'absolute') {
        this.renderer.setStyle(this.el.nativeElement, 'position', 'absolute');
        this.renderer.setStyle(this.el.nativeElement, 'inset', '0');
        this.renderer.setStyle(this.el.nativeElement, 'width', '100%');
        this.renderer.setStyle(this.el.nativeElement, 'height', '100%');
      }

      // Pre-roll visibility check
      if (parent < from) {
        if (preState === 'hidden') {
          this.renderer.setStyle(this.el.nativeElement, 'visibility', 'hidden');
          this.renderer.setStyle(this.el.nativeElement, 'pointer-events', 'none');
        } else {
          this.renderer.removeStyle(this.el.nativeElement, 'visibility');
          this.renderer.removeStyle(this.el.nativeElement, 'pointer-events');
        }
        return;
      }

      // Post-roll visibility check
      if (duration !== undefined && parent > from + duration) {
        if (postState === 'hidden') {
          this.renderer.setStyle(this.el.nativeElement, 'visibility', 'hidden');
          this.renderer.setStyle(this.el.nativeElement, 'pointer-events', 'none');
        } else {
          // Freeze state: visible
          this.renderer.removeStyle(this.el.nativeElement, 'visibility');
          this.renderer.removeStyle(this.el.nativeElement, 'pointer-events');
        }
        return;
      }

      // Active sequence window
      this.renderer.removeStyle(this.el.nativeElement, 'visibility');
      this.renderer.removeStyle(this.el.nativeElement, 'pointer-events');
    });
  }
}
