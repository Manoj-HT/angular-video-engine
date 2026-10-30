import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  inject,
  afterNextRender
} from '@angular/core';
import { injectAssetGate } from '../services/asset-gate.service';

@Component({
  selector: 'ave-image',
  standalone: true,
  template: `
    <img
      #img
      [src]="src"
      [alt]="alt"
      [style.width]="'100%'"
      [style.height]="'100%'"
      [style.object-fit]="fit"
    />
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    img {
      display: block;
    }
  `]
})
export class AveImageComponent {
  @ViewChild('img', { static: true }) imgRef!: ElementRef<HTMLImageElement>;

  @Input({ required: true }) src!: string;
  @Input() alt = '';
  @Input() fit: 'cover' | 'contain' | 'fill' | 'none' = 'cover';

  private gate = injectAssetGate();

  constructor() {
    afterNextRender(async () => {
      const unblock = this.gate.block(`Image: ${this.src}`);
      const img = this.imgRef.nativeElement;

      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch (err) {
        console.warn(`[AVE] Image decode warning for ${this.src}:`, err);
      } finally {
        unblock();
      }
    });
  }
}
