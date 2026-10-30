import {
  Directive,
  Input,
  ElementRef,
  effect,
  inject,
  afterNextRender
} from '@angular/core';
import { injectCurrentFrame, injectVideoConfig } from '../tokens/frame.tokens';

@Directive({
  selector: '[aveSyncCss]',
  standalone: true
})
export class AveSyncCssDirective {
  private el = inject(ElementRef);
  private frame = injectCurrentFrame();
  private videoConfig = injectVideoConfig();

  @Input({ required: true, alias: 'aveSyncCss' }) animationName!: string;

  private targetAnimation: Animation | null = null;

  constructor() {
    afterNextRender(() => {
      this.findAndLockAnimation();
    });

    effect(() => {
      const currentFrame = this.frame();
      const fps = this.videoConfig().fps;

      if (!this.targetAnimation) {
        this.findAndLockAnimation();
      }

      if (this.targetAnimation) {
        // Set exact time in milliseconds
        const targetMs = (currentFrame / fps) * 1000;
        this.targetAnimation.currentTime = targetMs;
      }
    });
  }

  private findAndLockAnimation(): void {
    const native = this.el.nativeElement as HTMLElement;
    if (typeof native.getAnimations !== 'function') return;

    const animations = native.getAnimations();
    for (const anim of animations) {
      if ((anim as CSSAnimation).animationName === this.animationName) {
        anim.pause();
        this.targetAnimation = anim;
        break;
      }
    }
  }
}
