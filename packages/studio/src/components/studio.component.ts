import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  HostListener,
  OnInit,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoMetadata, RootFrameService } from '@angular-video/core';
import { StudioStateService } from '../services/studio-state.service';
import { AveCanvasStageComponent } from './canvas-stage.component';
import { AveTimelineComponent } from './timeline.component';
import { AveTransportBarComponent } from './transport-bar.component';
import { AveInspectorComponent } from './inspector.component';
import { AveStudioHeaderComponent } from './studio-header.component';

@Component({
  selector: 'ave-studio',
  standalone: true,
  imports: [
    CommonModule,
    AveCanvasStageComponent,
    AveTimelineComponent,
    AveTransportBarComponent,
    AveInspectorComponent,
    AveStudioHeaderComponent
  ],
  template: `
    <div class="ave-studio-workbench">
      <!-- Top Navigation & Switcher Header -->
      <ave-studio-header (exportClick)="handleExportClick()" />

      <!-- Center Workbench: Stage Canvas + Collapsible Inspector -->
      <div class="ave-studio-body">
        <main class="ave-studio-main">
          <ave-canvas-stage />
        </main>

        @if (state.isDrawerOpen()) {
          <aside class="ave-studio-aside">
            <ave-inspector />
          </aside>
        }
      </div>

      <!-- Bottom Editing Zone: Timeline Track Scrubber + Transport Bar -->
      @if (showTimeline) {
        <footer class="ave-studio-footer">
          <ave-timeline />
          <ave-transport-bar />
        </footer>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #090a10;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .ave-studio-workbench {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .ave-studio-body {
      flex: 1;
      display: flex;
      min-height: 0;
      position: relative;
    }

    .ave-studio-main {
      flex: 1;
      min-width: 0;
      height: 100%;
      position: relative;
    }

    .ave-studio-aside {
      height: 100%;
      flex-shrink: 0;
      animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .ave-studio-footer {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `]
})
export class AveStudioComponent implements OnInit, OnChanges {
  protected state = inject(StudioStateService);
  protected frameService = inject(RootFrameService);

  @Input() compositions: VideoMetadata[] = [];
  @Input() activeId?: string;
  @Input() showTimeline = true;
  @Input() defaultDrawerOpen = false;

  @Output() exportRequested = new EventEmitter<VideoMetadata>();

  ngOnInit(): void {
    if (this.compositions.length > 0) {
      this.state.setCompositions(this.compositions);
      if (this.activeId) {
        this.state.selectComposition(this.activeId);
      }
    }
    if (this.defaultDrawerOpen) {
      this.state.isDrawerOpen.set(true);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['compositions'] && this.compositions.length > 0) {
      this.state.setCompositions(this.compositions);
    }
    if (changes['activeId'] && this.activeId) {
      this.state.selectComposition(this.activeId);
    }
  }

  handleExportClick(): void {
    const comp = this.state.activeComposition();
    if (comp) {
      this.exportRequested.emit(comp);
    }
  }

  // Strict "No Browser Hijack" Keybinding Listener
  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(e: KeyboardEvent): void {
    // If the user is typing inside an input or textarea, never intercept
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
      return;
    }

    // Strictly whitelist system keys: Ctrl/Cmd + (R, I, P, W, T, etc.)
    if (e.ctrlKey || e.metaKey) {
      return; // NEVER PREVENT DEFAULT
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        this.state.togglePlay();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        this.frameService.stepFrame(e.shiftKey ? -10 : -1);
        break;

      case 'ArrowRight':
        e.preventDefault();
        this.frameService.stepFrame(e.shiftKey ? 10 : 1);
        break;

      case 'Home':
        e.preventDefault();
        this.frameService.setFrame(0);
        break;

      case 'End': {
        e.preventDefault();
        const total = this.frameService.config().durationInFrames;
        this.frameService.setFrame(Math.max(0, total - 1));
        break;
      }

      case 'k':
      case 'K':
        this.state.togglePlay();
        break;

      case 'j':
      case 'J':
        this.frameService.stepFrame(-10);
        break;

      case 'l':
      case 'L':
        this.frameService.stepFrame(10);
        break;

      case 'm':
      case 'M':
        this.state.toggleMute();
        break;
    }
  }
}
