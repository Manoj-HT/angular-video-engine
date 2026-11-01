import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
  afterNextRender,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudioStateService } from '../services/studio-state.service';
import { RootFrameService } from '@angular-video/core';

@Component({
  selector: 'ave-canvas-stage',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #viewport class="ave-stage-viewport" [class.checkerboard]="state.showCheckerboard()">
      @if (state.activeComposition(); as comp) {
        <div
          class="ave-stage-scaler"
          [style.width.px]="comp.width"
          [style.height.px]="comp.height"
          [style.transform]="scalerTransform()"
        >
          <div class="ave-stage-content" [style.width.px]="comp.width" [style.height.px]="comp.height">
            <ng-container
              *ngComponentOutlet="comp.component; inputs: state.activeProps()"
            />
          </div>
        </div>
      } @else {
        <div class="ave-stage-empty">
          <p>No video composition selected.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      background: #0d0e15;
    }

    .ave-stage-viewport {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    .checkerboard {
      background-image: 
        linear-gradient(45deg, #161824 25%, transparent 25%),
        linear-gradient(-45deg, #161824 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #161824 75%),
        linear-gradient(-45deg, transparent 75%, #161824 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    }

    .ave-stage-scaler {
      position: absolute;
      transform-origin: center center;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
      background: #000;
      contain: layout size;
    }

    .ave-stage-content {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .ave-stage-empty {
      color: #64748b;
      font-family: system-ui, sans-serif;
      font-size: 14px;
    }
  `]
})
export class AveCanvasStageComponent implements OnDestroy {
  @ViewChild('viewport', { static: true }) viewportRef!: ElementRef<HTMLDivElement>;

  protected state = inject(StudioStateService);
  protected frameService = inject(RootFrameService);

  private viewportWidth = signal<number>(800);
  private viewportHeight = signal<number>(600);
  private resizeObserver: ResizeObserver | null = null;

  readonly scale = computed<number>(() => {
    const comp = this.state.activeComposition();
    if (!comp) return 1;

    const mode = this.state.zoomMode();
    if (typeof mode === 'number') {
      return mode;
    }

    // 'fit' mode calculation with padding
    const padding = 32;
    const availW = Math.max(100, this.viewportWidth() - padding);
    const availH = Math.max(100, this.viewportHeight() - padding);

    const scaleX = availW / comp.width;
    const scaleY = availH / comp.height;

    return Math.min(scaleX, scaleY);
  });

  readonly scalerTransform = computed<string>(() => {
    return `scale(${this.scale()})`;
  });

  constructor() {
    afterNextRender(() => {
      this.initResizeObserver();
    });
  }

  private initResizeObserver(): void {
    const el = this.viewportRef.nativeElement;
    if (typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        this.viewportWidth.set(entry.contentRect.width);
        this.viewportHeight.set(entry.contentRect.height);
      }
    });

    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
}
