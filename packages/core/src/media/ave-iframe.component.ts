import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  effect,
  inject,
  afterNextRender
} from '@angular/core';
import { injectAssetGate } from '../services/asset-gate.service';

@Component({
  selector: 'ave-iframe',
  standalone: true,
  template: `
    <iframe
      #iframe
      [src]="src"
      [style.width]="'100%'"
      [style.height]="'100%'"
      [style.border]="'none'"
      loading="eager"
    ></iframe>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    iframe {
      display: block;
    }
  `]
})
export class AveIframeComponent {
  @ViewChild('iframe', { static: true }) iframeRef!: ElementRef<HTMLIFrameElement>;

  @Input({ required: true }) src!: string;
  @Input() waitFor: 'load' | 'networkidle' = 'load';
  @Input() timeoutMs = 10000;
  @Input() scrollTop = 0;
  @Input() scrollLeft = 0;

  private gate = injectAssetGate();

  constructor() {
    afterNextRender(() => {
      this.initIframe();
    });

    effect(() => {
      const top = this.scrollTop;
      const left = this.scrollLeft;
      this.applyScroll(top, left);
    });
  }

  private initIframe(): void {
    const iframe = this.iframeRef.nativeElement;
    const unblock = this.gate.block(`Iframe: ${this.src}`);

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      unblock();
    };

    iframe.addEventListener('load', () => {
      if (this.waitFor === 'networkidle') {
        // Stabilization buffer
        setTimeout(finish, 500);
      } else {
        finish();
      }
    });

    // Timeout safety fallback
    setTimeout(finish, this.timeoutMs);
  }

  private applyScroll(top: number, left: number): void {
    const iframe = this.iframeRef?.nativeElement;
    if (!iframe) return;

    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.scrollTo({ top, left, behavior: 'instant' as ScrollBehavior });
      }
    } catch {
      // Cross-origin iframe restriction: Post message fallback
      iframe.contentWindow?.postMessage({ type: 'AVE_SCROLL', top, left }, '*');
    }
  }
}
