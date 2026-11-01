import {
  Component,
  Input,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoMetadata, RootFrameService } from '@angular-video/core';
import { StudioStateService } from '../services/studio-state.service';
import { AveCanvasStageComponent } from './canvas-stage.component';
import { AveTransportBarComponent } from './transport-bar.component';
import { AveTimelineComponent } from './timeline.component';

@Component({
  selector: 'ave-player',
  standalone: true,
  imports: [
    CommonModule,
    AveCanvasStageComponent,
    AveTimelineComponent,
    AveTransportBarComponent
  ],
  template: `
    <div class="ave-player-wrapper" [style.aspectRatio]="aspectRatio()">
      <div class="ave-player-canvas-area">
        <ave-canvas-stage />
      </div>

      @if (controls) {
        <div class="ave-player-controls">
          <ave-timeline />
          <ave-transport-bar />
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      position: relative;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }

    .ave-player-wrapper {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .ave-player-canvas-area {
      flex: 1;
      min-height: 0;
      position: relative;
    }

    .ave-player-controls {
      flex-shrink: 0;
      background: #0f1019;
      border-top: 1px solid #1a1c2a;
    }
  `]
})
export class AvePlayerComponent implements OnInit, OnChanges {
  protected state = inject(StudioStateService);
  protected frameService = inject(RootFrameService);

  @Input({ required: true }) composition!: VideoMetadata;
  @Input() controls = true;
  @Input() autoPlay = false;
  @Input() loop = true;

  aspectRatio(): string {
    return `${this.composition.width} / ${this.composition.height}`;
  }

  ngOnInit(): void {
    this.setupComposition();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['composition'] && this.composition) {
      this.setupComposition();
    }
  }

  private setupComposition(): void {
    this.state.setCompositions([this.composition]);
    this.state.loop.set(this.loop);
    if (this.autoPlay) {
      this.state.play();
    }
  }
}
