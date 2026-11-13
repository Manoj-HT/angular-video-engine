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
import { injectCurrentFrame, injectVideoConfig } from '../tokens/frame.tokens';
import { injectAssetGate } from '../services/asset-gate.service';
import { RootFrameService } from '../services/frame.service';

@Component({
  selector: 'ave-audio',
  standalone: true,
  template: `<audio #audio [src]="src" [muted]="muted" preload="auto"></audio>`,
  styles: [`:host { display: none; }`]
})
export class AveAudioComponent implements OnDestroy {
  @ViewChild('audio', { static: true }) audioRef!: ElementRef<HTMLAudioElement>;

  @Input({ required: true }) src!: string;
  @Input() startFrom = 0;
  @Input() volume = 1;
  @Input() muted = false;
  @Input() playbackRate = 1;

  private frame = injectCurrentFrame();
  private config = injectVideoConfig();
  private gate = injectAssetGate();
  private frameService = inject(RootFrameService);

  constructor() {
    afterNextRender(() => {
      this.initAudio();
    });

    effect(() => {
      const f = this.frame();
      const isPlaying = this.frameService.isPlaying();
      const vol = this.volume;
      const rate = this.playbackRate;

      const audio = this.audioRef?.nativeElement;
      if (!audio) return;

      audio.muted = this.muted;
      audio.volume = this.muted ? 0 : Math.max(0, Math.min(1, vol));
      if (audio.playbackRate !== rate && rate > 0) {
        audio.playbackRate = rate;
      }

      this.syncAudio(f, isPlaying);
    });
  }

  private initAudio(): void {
    const audio = this.audioRef.nativeElement;
    const unblock = this.gate.block(`Audio: ${this.src}`);

    audio.addEventListener(
      'canplaythrough',
      () => {
        unblock();
        this.syncAudio(this.frame(), this.frameService.isPlaying());
      },
      { once: true }
    );

    audio.addEventListener('error', () => {
      console.error(`[AVE] Failed to load audio source: ${this.src}`);
      unblock();
    });
  }

  private syncAudio(videoFrame: number, isPlaying: boolean): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;

    const fps = this.config().fps;
    const targetSourceFrame = videoFrame - this.startFrom;
    const targetTimeSec = (targetSourceFrame / fps) * this.playbackRate;

    if (targetTimeSec >= 0 && (!audio.duration || targetTimeSec < audio.duration)) {
      if (isPlaying) {
        if (audio.paused) {
          audio.currentTime = Math.max(0, targetTimeSec);
          audio.play().catch(() => {});
        } else if (Math.abs(audio.currentTime - targetTimeSec) > 0.12) {
          audio.currentTime = targetTimeSec;
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
        if (Math.abs(audio.currentTime - targetTimeSec) > 0.05) {
          audio.currentTime = Math.max(0, targetTimeSec);
        }
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }

  ngOnDestroy(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      try {
        audio.pause();
        audio.src = '';
      } catch {}
    }
  }

  /**
   * Helper utility to extract waveform amplitude peaks for timeline visualization.
   */
  static async extractAudioPeaks(audioBuffer: AudioBuffer, samples = 200): Promise<number[]> {
    const rawData = audioBuffer.getChannelData(0); // Left channel
    const blockSize = Math.floor(rawData.length / samples);
    const peaks: number[] = [];

    for (let i = 0; i < samples; i++) {
      const blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j] || 0);
      }
      peaks.push(sum / blockSize);
    }

    // Normalize between 0 and 1
    const max = Math.max(...peaks, 0.001);
    return peaks.map(p => p / max);
  }
}
