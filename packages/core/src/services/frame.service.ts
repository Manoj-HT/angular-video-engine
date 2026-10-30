import { Injectable, signal, computed, Signal } from '@angular/core';
import { VideoConfig } from '../types/video.types';

@Injectable({
  providedIn: 'root'
})
export class RootFrameService {
  private readonly _frame = signal<number>(0);
  private readonly _isPlaying = signal<boolean>(false);
  private readonly _config = signal<VideoConfig>({
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 300
  });

  readonly frame: Signal<number> = this._frame.asReadonly();
  readonly isPlaying: Signal<boolean> = this._isPlaying.asReadonly();
  readonly config: Signal<VideoConfig> = this._config.asReadonly();

  setFrame(frame: number): void {
    const max = Math.max(0, this._config().durationInFrames - 1);
    const clamped = Math.max(0, Math.min(frame, max));
    this._frame.set(clamped);
  }

  stepFrame(delta: number): void {
    this.setFrame(this._frame() + delta);
  }

  setPlaying(playing: boolean): void {
    this._isPlaying.set(playing);
  }

  togglePlay(): void {
    this._isPlaying.set(!this._isPlaying());
  }

  setConfig(config: Partial<VideoConfig>): void {
    this._config.update(prev => ({ ...prev, ...config }));
  }
}

export class LocalFrameService {
  readonly frame: Signal<number>;

  constructor(
    parentFrame: Signal<number>,
    from: number,
    duration?: number
  ) {
    this.frame = computed(() => {
      const parent = parentFrame();
      const local = parent - from;

      if (local < 0) {
        return 0; // Pre-roll clamp
      }
      if (duration !== undefined && local > duration) {
        return duration; // Post-roll clamp
      }
      return local;
    });
  }
}
