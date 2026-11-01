import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AveStudioComponent } from '@angular-video/studio';
import { RootFrameService, AssetGateService } from '@angular-video/core';
import { videoCompositions } from './videos';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, AveStudioComponent],
  template: `
    @if (isRenderMode) {
      <!-- Headless Isolated Render Stage (Zero Chrome) -->
      @if (activeRenderComp; as comp) {
        <div
          id="ave-canvas-stage"
          [style.width.px]="comp.width"
          [style.height.px]="comp.height"
          [style.position]="'fixed'"
          [style.inset]="'0'"
          [style.overflow]="'hidden'"
          [style.background]="'#000'"
        >
          <ng-container
            *ngComponentOutlet="comp.component; inputs: comp.defaultProps || {}"
          />
        </div>
      }
    } @else {
      <!-- Full Interactive Studio Workbench -->
      <ave-studio
        [compositions]="compositions"
        [defaultDrawerOpen]="true"
        (exportRequested)="onExport($event)"
      />
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
  `]
})
export class AppComponent implements OnInit {
  protected frameService = inject(RootFrameService);
  protected assetGate = inject(AssetGateService);

  readonly compositions = videoCompositions;

  isRenderMode = false;
  activeRenderComp = videoCompositions[0];

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'render') {
      this.isRenderMode = true;
      const targetId = params.get('id');
      const comp = this.compositions.find(c => c.id === targetId) ?? this.compositions[0];
      this.activeRenderComp = comp;

      this.frameService.setConfig({
        fps: comp.fps,
        width: comp.width,
        height: comp.height,
        durationInFrames: comp.durationInFrames
      });

      // Expose bridge for Playwright Headless Runner
      (window as any).__AVE_SEEK_FRAME = async (frame: number) => {
        this.frameService.setFrame(frame);
        // Ensure browser compositor updates
        await new Promise(r => requestAnimationFrame(r));
      };

      (window as any).__AVE_GET_METADATA = () => ({
        id: comp.id,
        width: comp.width,
        height: comp.height,
        fps: comp.fps,
        durationInFrames: comp.durationInFrames
      });

      (window as any).__AVE_IS_READY = () => this.assetGate.isReady();
    }
  }

  onExport(comp: unknown): void {
    console.log('[AVE] Export requested for composition:', comp);
  }
}
