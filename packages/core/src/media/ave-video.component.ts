import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  effect,
  inject,
  afterNextRender
} from '@angular/core';
import { injectCurrentFrame, injectVideoConfig } from '../tokens/frame.tokens';
import { injectAssetGate } from '../services/asset-gate.service';

export type PassThroughMode = 'auto' | 'enabled' | 'disabled';

@Component({
  selector: 'ave-video',
  standalone: true,
  template: `
    <video
      #video
      [src]="src"
      [muted]="muted"
      playsinline
      crossorigin="anonymous"
      [style.width]="'100%'"
      [style.height]="'100%'"
      [style.object-fit]="'cover'"
    ></video>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    video {
      display: block;
    }
  `]
})
export class AveVideoComponent {
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  @Input({ required: true }) src!: string;
  @Input() startFrom = 0; // source frame offset
  @Input() playbackRate = 1;
  @Input() volume = 1;
  @Input() muted = false;
  @Input() passThrough: PassThroughMode = 'auto';
  @Input() fillFrameCount = 0;

  private frame = injectCurrentFrame();
  private config = injectVideoConfig();
  private gate = injectAssetGate();

  private isSeeking = false;
  private pendingSeekFrame: number | null = null;

  constructor() {
    afterNextRender(() => {
      this.initVideo();
    });

    effect(() => {
      const f = this.frame();
      const vol = this.volume;
      const rate = this.playbackRate;

      const video = this.videoRef?.nativeElement;
      if (!video) return;

      video.volume = Math.max(0, Math.min(1, vol));
      if (video.playbackRate !== rate && rate > 0) {
        video.playbackRate = rate;
      }

      this.seekToFrame(f);
    });
  }

  private initVideo(): void {
    const video = this.videoRef.nativeElement;
    const unblock = this.gate.block(`Video: ${this.src}`);

    video.addEventListener(
      'loadedmetadata',
      () => {
        unblock();
        this.seekToFrame(this.frame());
      },
      { once: true }
    );

    video.addEventListener('error', () => {
      console.error(`[AVE] Failed to load video source: ${this.src}`);
      unblock();
    });
  }

  private seekToFrame(videoFrame: number): void {
    const video = this.videoRef?.nativeElement;
    if (!video || !video.duration) return;

    const fps = this.config().fps;
    const targetSourceFrame = Math.max(0, videoFrame - this.startFrom);
    const targetTimeSec = (targetSourceFrame / fps) * this.playbackRate;

    const clampedTime = Math.max(0, Math.min(targetTimeSec, video.duration));

    if (Math.abs(video.currentTime - clampedTime) < 0.005) {
      return;
    }

    if (this.isSeeking) {
      this.pendingSeekFrame = clampedTime;
      return;
    }

    this.isSeeking = true;

    // Use fastSeek for high-frequency interactive scrubbing if available
    if (typeof (video as any).fastSeek === 'function') {
      (video as any).fastSeek(clampedTime);
    } else {
      video.currentTime = clampedTime;
    }

    const onSeeked = () => {
      this.isSeeking = false;
      if (this.pendingSeekFrame !== null) {
        const nextTime = this.pendingSeekFrame;
        this.pendingSeekFrame = null;
        video.currentTime = nextTime;
      }
    };

    video.addEventListener('seeked', onSeeked, { once: true });
  }

  /**
   * Captures the current frame as an ImageBitmap for still thumbnails or posters.
   */
  async captureFrameBitmap(): Promise<ImageBitmap | null> {
    const video = this.videoRef?.nativeElement;
    if (!video) return null;
    return createImageBitmap(video);
  }
}
