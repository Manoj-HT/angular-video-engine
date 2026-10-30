import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import { injectCurrentFrame, injectVideoConfig } from '../tokens/frame.tokens';

export interface CanvasDrawEvent {
  frame: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

@Component({
  selector: 'ave-canvas',
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
    }
  `]
})
export class AveCanvasComponent {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() width?: number;
  @Input() height?: number;

  @Output() draw = new EventEmitter<CanvasDrawEvent>();

  private frame = injectCurrentFrame();
  private config = injectVideoConfig();

  constructor() {
    effect(() => {
      const f = this.frame();
      const canvas = this.canvasRef?.nativeElement;
      if (!canvas) return;

      const w = this.width ?? this.config().width;
      const h = this.height ?? this.config().height;

      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      this.draw.emit({
        frame: f,
        canvas,
        width: w,
        height: h
      });
    });
  }
}
