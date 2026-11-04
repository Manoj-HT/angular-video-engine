import {
  Component,
  ElementRef,
  ViewChild,
  Input,
  inject,
  signal,
  computed,
  HostListener,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RootFrameService, VideoMetadata } from '@angular-video/core';
import { StudioStateService } from '../services/studio-state.service';
import { PresentationSyncService } from '../services/presentation-sync.service';
import { AveCanvasStageComponent } from './canvas-stage.component';

@Component({
  selector: 'ave-clean-feed',
  standalone: true,
  imports: [CommonModule, AveCanvasStageComponent],
  template: `
    <div
      #container
      class="ave-clean-feed-root"
      (dblclick)="toggleFullscreen()"
      (mousemove)="onMouseMove()"
    >
      <!-- Pure Full-Bleed Video Canvas Stage -->
      <main class="ave-clean-feed-stage">
        <ave-canvas-stage />
      </main>

      <!-- Minimal Auto-Hiding Presentation HUD (Bottom-Right) -->
      <div class="ave-clean-hud" [class.hidden]="!showHud()">
        <div class="ave-hud-pill">
          <span class="ave-hud-dot" [class.connected]="sync.isConnected()"></span>
          <span class="ave-hud-status">
            {{ sync.isConnected() ? 'Live Synced' : 'Offline' }}
          </span>
          <span class="ave-hud-frame">F{{ frameService.frame() }}</span>
        </div>

        <div class="ave-hud-pill ave-hud-audio">
          <span class="ave-hud-icon">{{ isAudioActive() ? '🔊' : '🔇' }}</span>
          <span>Audio: {{ isAudioActive() ? 'Live' : 'Muted (Echo Guard)' }}</span>
        </div>

        <button class="ave-hud-btn" (click)="toggleFullscreen()" title="Toggle Fullscreen (F)">
          {{ isFullscreen() ? 'Exit Fullscreen' : '⛶ Fullscreen (F)' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #000;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
    }

    .ave-clean-feed-root {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
    }

    .ave-clean-feed-stage {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Floating HUD in bottom right */
    .ave-clean-hud {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 9999;
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: auto;

      &.hidden {
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
      }
    }

    .ave-hud-pill {
      background: rgba(15, 17, 26, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }

    .ave-hud-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;

      &.connected {
        background: #10b981;
        box-shadow: 0 0 8px #10b981;
      }
    }

    .ave-hud-status {
      font-weight: 600;
      color: #f1f5f9;
    }

    .ave-hud-frame {
      font-family: monospace;
      color: #38bdf8;
      font-weight: 700;
    }

    .ave-hud-audio {
      color: #94a3b8;
    }

    .ave-hud-btn {
      background: rgba(59, 130, 246, 0.9);
      border: 1px solid #3b82f6;
      color: #fff;
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      backdrop-filter: blur(12px);
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
      transition: transform 0.15s ease, background 0.15s ease;

      &:hover {
        background: #2563eb;
        transform: scale(1.03);
      }
    }
  `]
})
export class AveCleanFeedComponent implements OnInit, OnDestroy {
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  @Input() compositions?: VideoMetadata[];

  protected frameService = inject(RootFrameService);
  protected state = inject(StudioStateService);
  protected sync = inject(PresentationSyncService);

  readonly showHud = signal<boolean>(true);
  readonly isFullscreen = signal<boolean>(false);

  readonly isAudioActive = computed<boolean>(() => {
    return this.sync.audioDestination() === 'remote';
  });

  private hudTimeout: any = null;

  ngOnInit(): void {
    if (this.compositions && this.compositions.length > 0) {
      this.state.setCompositions(this.compositions);
    }
    // By default in clean feed, disable transparency checkerboard for pristine black letterboxing
    this.state.showCheckerboard.set(false);
    this.resetHudTimer();

    document.addEventListener('fullscreenchange', this.onFullscreenChange);
  }

  ngOnDestroy(): void {
    if (this.hudTimeout) clearTimeout(this.hudTimeout);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
  }

  onMouseMove(): void {
    this.showHud.set(true);
    this.resetHudTimer();
  }

  private resetHudTimer(): void {
    if (this.hudTimeout) clearTimeout(this.hudTimeout);
    this.hudTimeout = setTimeout(() => {
      this.showHud.set(false);
    }, 3000);
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  private onFullscreenChange = () => {
    this.isFullscreen.set(!!document.fullscreenElement);
  };

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      this.toggleFullscreen();
    }
  }
}
