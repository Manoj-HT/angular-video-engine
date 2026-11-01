import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RootFrameService } from '@angular-video/core';
import { StudioStateService } from '../services/studio-state.service';

@Component({
  selector: 'ave-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      #trackContainer
      class="ave-timeline-container"
      (pointerdown)="onPointerDown($event)"
    >
      <!-- Timeline Time Ruler -->
      <div class="ave-timeline-ruler">
        @for (tick of rulerTicks(); track tick.frame) {
          <div class="ave-ruler-tick" [style.left.%]="tick.percentage">
            <span class="ave-tick-label">{{ tick.label }}</span>
          </div>
        }
      </div>

      <!-- Track Background Track -->
      <div class="ave-track-rail">
        <div class="ave-track-progress" [style.width.%]="progressPercentage()"></div>
      </div>

      <!-- Draggable Playhead Scrubber -->
      <div
        class="ave-playhead"
        [style.left.%]="progressPercentage()"
      >
        <div class="ave-playhead-cap"></div>
        <div class="ave-playhead-line"></div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 48px;
      user-select: none;
      touch-action: none;
    }

    .ave-timeline-container {
      width: 100%;
      height: 100%;
      position: relative;
      background: #12131d;
      border-top: 1px solid #1f2233;
      border-bottom: 1px solid #1f2233;
      cursor: pointer;
    }

    .ave-timeline-ruler {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 18px;
      pointer-events: none;
      overflow: hidden;
    }

    .ave-ruler-tick {
      position: absolute;
      top: 0;
      bottom: 0;
      border-left: 1px solid #2d314a;
    }

    .ave-tick-label {
      position: absolute;
      top: 2px;
      left: 4px;
      font-size: 9px;
      font-family: monospace;
      color: #64748b;
    }

    .ave-track-rail {
      position: absolute;
      top: 24px;
      left: 0;
      right: 0;
      height: 8px;
      background: #1c1e2d;
      border-radius: 4px;
      overflow: hidden;
      margin: 0 8px;
    }

    .ave-track-progress {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #6366f1);
      border-radius: 4px;
    }

    .ave-playhead {
      position: absolute;
      top: 0;
      bottom: 0;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 10;
    }

    .ave-playhead-cap {
      width: 12px;
      height: 12px;
      background: #ef4444;
      clip-path: polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%);
      margin: 0 auto;
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
    }

    .ave-playhead-line {
      width: 2px;
      height: 100%;
      background: #ef4444;
      margin: 0 auto;
    }
  `]
})
export class AveTimelineComponent {
  @ViewChild('trackContainer', { static: true }) trackRef!: ElementRef<HTMLDivElement>;

  protected frameService = inject(RootFrameService);
  protected state = inject(StudioStateService);

  private isDragging = false;

  readonly progressPercentage = computed<number>(() => {
    const frame = this.frameService.frame();
    const total = this.frameService.config().durationInFrames;
    if (total <= 1) return 0;
    return (frame / (total - 1)) * 100;
  });

  readonly rulerTicks = computed<{ frame: number; percentage: number; label: string }[]>(() => {
    const total = this.frameService.config().durationInFrames;
    const fps = this.frameService.config().fps;
    if (total <= 0) return [];

    const ticks: { frame: number; percentage: number; label: string }[] = [];
    const interval = Math.max(fps, Math.floor(total / 10));

    for (let f = 0; f < total; f += interval) {
      const pct = (f / (total - 1)) * 100;
      const sec = Math.floor(f / fps);
      const label = `${sec}s (F${f})`;
      ticks.push({ frame: f, percentage: pct, label });
    }

    return ticks;
  });

  onPointerDown(e: PointerEvent): void {
    this.isDragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.seekFromPointer(e);
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(e: PointerEvent): void {
    if (!this.isDragging) return;
    this.seekFromPointer(e);
  }

  @HostListener('pointerup', ['$event'])
  @HostListener('pointercancel', ['$event'])
  onPointerUp(e: PointerEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      try {
        this.trackRef.nativeElement.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
  }

  private seekFromPointer(e: PointerEvent): void {
    const rect = this.trackRef.nativeElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? x / rect.width : 0;

    const total = this.frameService.config().durationInFrames;
    const targetFrame = Math.round(ratio * (total - 1));
    this.frameService.setFrame(targetFrame);
  }
}
