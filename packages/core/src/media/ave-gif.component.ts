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

interface ParsedFrame {
  dims: { top: number; left: number; width: number; height: number };
  patch: Uint8ClampedArray;
  delay: number; // in milliseconds
}

@Component({
  selector: 'ave-gif',
  standalone: true,
  template: `<canvas #canvas [style.width]="'100%'" [style.height]="'100%'"></canvas>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    canvas {
      display: block;
      object-fit: contain;
    }
  `]
})
export class AveGifComponent {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) src!: string;
  @Input() loop = true;

  private frame = injectCurrentFrame();
  private config = injectVideoConfig();
  private gate = injectAssetGate();

  private parsedFrames: { patch: ImageData; frameIndex: number }[] = [];
  private totalGifFrames = 0;

  constructor() {
    afterNextRender(async () => {
      await this.loadGif();
    });

    effect(() => {
      const f = this.frame();
      this.renderFrame(f);
    });
  }

  private async loadGif(): Promise<void> {
    const unblock = this.gate.block(`GIF: ${this.src}`);

    try {
      const response = await fetch(this.src);
      const buffer = await response.arrayBuffer();

      // Check if gifuct-js is available dynamically
      const gifuct = await import('gifuct-js').catch(() => null);
      if (gifuct && gifuct.parseGIF && gifuct.decompressFrames) {
        const gif = gifuct.parseGIF(buffer);
        const frames = gifuct.decompressFrames(gif, true);

        const canvas = this.canvasRef.nativeElement;
        if (frames.length > 0) {
          canvas.width = frames[0].dims.width;
          canvas.height = frames[0].dims.height;
        }

        const fps = this.config().fps;
        let cumulativeFrames = 0;

        this.parsedFrames = frames.map((frame: any) => {
          const frameDurationInVideoFrames = Math.max(1, Math.round((frame.delay / 1000) * fps));
          const imageData = new ImageData(
            new Uint8ClampedArray(frame.patch),
            frame.dims.width,
            frame.dims.height
          );
          const mapped = { patch: imageData, frameIndex: cumulativeFrames };
          cumulativeFrames += frameDurationInVideoFrames;
          return mapped;
        });

        this.totalGifFrames = cumulativeFrames;
        this.renderFrame(this.frame());
      }
    } catch (err) {
      console.error('[AVE] Failed to parse GIF frames:', err);
    } finally {
      unblock();
    }
  }

  private renderFrame(videoFrame: number): void {
    if (this.parsedFrames.length === 0 || this.totalGifFrames === 0) return;

    let target = videoFrame;
    if (this.loop) {
      target = videoFrame % this.totalGifFrames;
    }

    // Find closest frame
    let currentPatch = this.parsedFrames[0].patch;
    for (let i = 0; i < this.parsedFrames.length; i++) {
      if (this.parsedFrames[i].frameIndex <= target) {
        currentPatch = this.parsedFrames[i].patch;
      } else {
        break;
      }
    }

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (ctx && currentPatch) {
      ctx.putImageData(currentPatch, 0, 0);
    }
  }
}
