import {
  Directive,
  Input,
  ElementRef,
  Renderer2,
  effect,
  inject
} from '@angular/core';
import { injectCurrentFrame, injectVideoConfig } from '../tokens/frame.tokens';
import { interpolate, Easing } from '../math/interpolate';
import { spring, SpringConfig } from '../math/spring';
import { EasingFn, StaggerFn } from '../types/video.types';

export interface AnimateProperties {
  opacity?: number;
  translateX?: number;
  translateY?: number;
  scale?: number;
  rotate?: number;
  [key: string]: number | string | undefined;
}

export interface AnimateConfig {
  range: [number, number];
  from?: AnimateProperties;
  to?: AnimateProperties;
  spring?: boolean | SpringConfig;
  easing?: EasingFn;
  stagger?: StaggerFn;
  index?: number;
  total?: number;
  preState?: 'hidden' | 'visible';
  postState?: 'clamp' | 'hidden';
  cssVars?: Record<string, { from: number | string; to: number | string; easing?: EasingFn }>;
  keyframes?: Record<string, AnimateProperties>;
}

@Directive({
  selector: '[aveAnimate]',
  standalone: true
})
export class AveAnimateDirective {
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private frame = injectCurrentFrame();
  private videoConfig = injectVideoConfig();

  @Input({ required: true, alias: 'aveAnimate' }) config!: AnimateConfig;

  constructor() {
    effect(() => {
      if (!this.config) return;

      const currentFrame = this.frame();
      const fps = this.videoConfig().fps;
      const [baseStart, baseEnd] = this.config.range;

      // Calculate stagger offset if provided
      let staggerOffset = 0;
      if (this.config.stagger && this.config.index !== undefined) {
        staggerOffset = this.config.stagger(
          this.config.index,
          this.config.total ?? 1,
          { fps, baseFrame: baseStart }
        );
      }

      const effectiveStart = baseStart + staggerOffset;
      const duration = Math.max(1, baseEnd - baseStart);
      const effectiveEnd = effectiveStart + duration;

      const preState = this.config.preState ?? 'hidden';
      const postState = this.config.postState ?? 'clamp';

      // Lifecycle check: before entrance
      if (currentFrame < effectiveStart) {
        if (preState === 'hidden') {
          this.renderer.setStyle(this.el.nativeElement, 'visibility', 'hidden');
        }
        return;
      }

      // Lifecycle check: after exit
      if (currentFrame > effectiveEnd && postState === 'hidden') {
        this.renderer.setStyle(this.el.nativeElement, 'visibility', 'hidden');
        return;
      }

      // Active or clamped: Ensure element is visible
      this.renderer.removeStyle(this.el.nativeElement, 'visibility');

      // Calculate progress / normalized frame
      const localFrame = Math.max(0, Math.min(currentFrame - effectiveStart, duration));

      // 1. Process Direct Property Tweens & Springs
      if (this.config.from && this.config.to) {
        this.applyTweens(localFrame, duration, fps);
      }

      // 2. Process CSS Custom Properties
      if (this.config.cssVars) {
        this.applyCssVars(localFrame, duration);
      }

      // 3. Process Keyframes if provided
      if (this.config.keyframes) {
        this.applyKeyframes(localFrame, duration);
      }
    });
  }

  private applyTweens(localFrame: number, duration: number, fps: number): void {
    const from = this.config.from!;
    const to = this.config.to!;
    const transforms: string[] = [];

    for (const key of Object.keys(to)) {
      const fromVal = typeof from[key] === 'number' ? (from[key] as number) : 0;
      const toVal = typeof to[key] === 'number' ? (to[key] as number) : 1;

      let val: number;

      if (this.config.spring) {
        const springCfg = typeof this.config.spring === 'object' ? this.config.spring : undefined;
        val = spring({
          frame: localFrame,
          fps,
          from: fromVal,
          to: toVal,
          config: springCfg
        });
      } else {
        val = interpolate(localFrame, [0, duration], [fromVal, toVal], {
          easing: this.config.easing ?? Easing.linear
        });
      }

      if (key === 'opacity') {
        this.renderer.setStyle(this.el.nativeElement, 'opacity', val);
      } else if (key === 'translateX') {
        transforms.push(`translateX(${val}px)`);
      } else if (key === 'translateY') {
        transforms.push(`translateY(${val}px)`);
      } else if (key === 'scale') {
        transforms.push(`scale(${val})`);
      } else if (key === 'rotate') {
        transforms.push(`rotate(${val}deg)`);
      } else {
        this.renderer.setStyle(this.el.nativeElement, key, val);
      }
    }

    if (transforms.length > 0) {
      this.renderer.setStyle(this.el.nativeElement, 'transform', transforms.join(' '));
    }
  }

  private applyCssVars(localFrame: number, duration: number): void {
    const cssVars = this.config.cssVars!;
    for (const [varName, cfg] of Object.entries(cssVars)) {
      if (typeof cfg.from === 'number' && typeof cfg.to === 'number') {
        const val = interpolate(localFrame, [0, duration], [cfg.from, cfg.to], {
          easing: cfg.easing ?? this.config.easing ?? Easing.linear
        });
        this.renderer.setStyle(this.el.nativeElement, varName, val);
      } else {
        // String interpolation (e.g. percentages)
        const fromNum = parseFloat(String(cfg.from));
        const toNum = parseFloat(String(cfg.to));
        const unit = String(cfg.to).replace(/^[-\d.]+/, '');
        const val = interpolate(localFrame, [0, duration], [fromNum, toNum], {
          easing: cfg.easing ?? this.config.easing ?? Easing.linear
        });
        this.renderer.setStyle(this.el.nativeElement, varName, `${val}${unit}`);
      }
    }
  }

  private applyKeyframes(localFrame: number, duration: number): void {
    const keyframes = this.config.keyframes!;
    const percentages = Object.keys(keyframes)
      .map(k => parseFloat(k.replace('%', '')))
      .sort((a, b) => a - b);

    if (percentages.length < 2) return;

    const progressPct = (localFrame / duration) * 100;

    // Find bounding keyframes
    let startPct = percentages[0];
    let endPct = percentages[percentages.length - 1];

    for (let i = 0; i < percentages.length - 1; i++) {
      if (progressPct >= percentages[i] && progressPct <= percentages[i + 1]) {
        startPct = percentages[i];
        endPct = percentages[i + 1];
        break;
      }
    }

    const startKey = `${startPct}%`;
    const endKey = `${endPct}%`;
    const startProps = keyframes[startKey];
    const endProps = keyframes[endKey];

    const rangeProgress = endPct === startPct ? 0 : (progressPct - startPct) / (endPct - startPct);

    for (const prop of Object.keys(endProps)) {
      const fromVal = parseFloat(String(startProps[prop] ?? 0));
      const toVal = parseFloat(String(endProps[prop] ?? 1));
      const val = fromVal + rangeProgress * (toVal - fromVal);

      if (prop === 'opacity') {
        this.renderer.setStyle(this.el.nativeElement, 'opacity', val);
      } else if (prop === 'transform') {
        this.renderer.setStyle(this.el.nativeElement, 'transform', endProps[prop]);
      } else {
        this.renderer.setStyle(this.el.nativeElement, prop, val);
      }
    }
  }
}
