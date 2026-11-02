import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RootFrameService } from '@angular-video/core';
import { StudioStateService, ZoomMode } from '../services/studio-state.service';

@Component({
  selector: 'ave-transport-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ave-transport-container">
      <!-- Left Controls: Playback Buttons -->
      <div class="ave-transport-group">
        <button class="ave-btn ave-btn-icon" (click)="jumpToStart()" title="Jump to Start (Home)">
          ⏮
        </button>
        <button class="ave-btn" (click)="step(-10)" title="Step -10 Frames (Shift+Left)">
          -10
        </button>
        <button class="ave-btn" (click)="step(-1)" title="Step -1 Frame (Left)">
          -1
        </button>
        
        <button
          class="ave-btn ave-btn-primary ave-btn-play"
          (click)="state.togglePlay()"
          [title]="state.activeComposition() ? 'Play/Pause (Space)' : ''"
        >
          {{ frameService.isPlaying() ? '⏸' : '▶' }}
        </button>

        <button class="ave-btn" (click)="step(1)" title="Step +1 Frame (Right)">
          +1
        </button>
        <button class="ave-btn" (click)="step(10)" title="Step +10 Frames (Shift+Right)">
          +10
        </button>
        <button class="ave-btn ave-btn-icon" (click)="jumpToEnd()" title="Jump to End (End)">
          ⏭
        </button>
      </div>

      <!-- Center-Left: Loop & In/Out Range Controls -->
      <div class="ave-transport-group ave-loop-group">
        <button
          class="ave-btn ave-btn-loop"
          [class.ave-btn-active]="state.isLoopEnabled()"
          (click)="state.toggleLoop()"
          [title]="state.isLoopEnabled() ? 'Looping Enabled (Click to Disable)' : 'Looping Disabled (Click to Enable)'"
        >
          🔁
        </button>

        <button
          class="ave-btn ave-btn-subtle"
          (click)="state.setLoopStartAtCurrent()"
          title="Set Loop Start [ at current frame (Key: I)"
        >
          [ In
        </button>

        <button
          class="ave-btn ave-btn-subtle"
          (click)="state.setLoopEndAtCurrent()"
          title="Set Loop End ] at current frame (Key: O)"
        >
          Out ]
        </button>

        <button
          class="ave-btn ave-btn-subtle ave-btn-icon"
          (click)="state.resetLoop()"
          title="Reset Loop to Video Bounds (Key: Alt+X)"
        >
          ↺
        </button>

        <span class="ave-loop-badge" [title]="'Active loop range: ' + state.loopRangeLabel()">
          {{ state.loopRangeLabel() }}
        </span>
      </div>

      <!-- Center-Right: Frame & Timecode Readout -->
      <div class="ave-transport-group ave-time-group">
        <span class="ave-timecode">{{ formattedTimecode() }}</span>
        
        <div class="ave-frame-input-wrapper">
          <span class="ave-frame-prefix">F</span>
          <input
            type="number"
            class="ave-frame-input"
            [value]="frameService.frame()"
            (change)="onFrameInputChange($event)"
            [min]="0"
            [max]="frameService.config().durationInFrames - 1"
          />
          <span class="ave-frame-total">/ {{ frameService.config().durationInFrames - 1 }}</span>
        </div>
      </div>

      <!-- Right Controls: Speed, Zoom, Audio, Tools -->
      <div class="ave-transport-group ave-right-group">
        <!-- Speed Multiplier -->
        <select
          class="ave-select"
          [value]="state.playbackSpeed()"
          (change)="onSpeedChange($event)"
          title="Playback Speed"
        >
          <option [value]="0.25">0.25x</option>
          <option [value]="0.5">0.5x</option>
          <option [value]="1.0">1.0x</option>
          <option [value]="1.5">1.5x</option>
          <option [value]="2.0">2.0x</option>
        </select>

        <!-- Canvas Zoom -->
        <select
          class="ave-select"
          [value]="state.zoomMode()"
          (change)="onZoomChange($event)"
          title="Canvas Zoom"
        >
          <option value="fit">Fit</option>
          <option [value]="0.5">50%</option>
          <option [value]="1.0">100%</option>
          <option [value]="2.0">200%</option>
        </select>

        <!-- Audio Mute -->
        <button
          class="ave-btn ave-btn-icon"
          (click)="state.toggleMute()"
          [title]="state.isMuted() ? 'Unmute' : 'Mute'"
        >
          {{ state.isMuted() ? '🔇' : '🔊' }}
        </button>

        <!-- Tools / Inspector Toggle Button -->
        <button
          class="ave-btn"
          [class.ave-btn-active]="state.isDrawerOpen()"
          (click)="state.toggleDrawer()"
          title="Toggle Properties & Inspector"
        >
          ⚙ Tools
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 44px;
      background: #0f1019;
      border-top: 1px solid #1a1c2a;
      user-select: none;
    }

    .ave-transport-container {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      gap: 10px;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .ave-transport-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ave-loop-group {
      background: #141522;
      border: 1px solid #202336;
      border-radius: 6px;
      padding: 2px 6px;
      gap: 4px;
    }

    .ave-loop-badge {
      font-family: monospace;
      font-size: 11px;
      color: #38bdf8;
      background: #1e2238;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .ave-time-group {
      gap: 10px;
    }

    .ave-right-group {
      gap: 8px;
    }

    .ave-btn {
      background: #1e2030;
      color: #cbd5e1;
      border: 1px solid #2d3148;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;

      &:hover {
        background: #2a2d44;
        color: #fff;
        border-color: #3f4466;
      }

      &:active {
        transform: scale(0.97);
      }
    }

    .ave-btn-subtle {
      background: transparent;
      border-color: transparent;
      padding: 4px 6px;
      font-size: 11px;
      color: #94a3b8;

      &:hover {
        background: #24273d;
        color: #f1f5f9;
        border-color: #333854;
      }
    }

    .ave-btn-icon {
      padding: 5px 8px;
      font-size: 13px;
    }

    .ave-btn-primary {
      background: #3b82f6;
      border-color: #2563eb;
      color: #fff;

      &:hover {
        background: #2563eb;
      }
    }

    .ave-btn-play {
      min-width: 36px;
      font-size: 14px;
    }

    .ave-btn-loop {
      padding: 4px 6px;
      font-size: 12px;
      opacity: 0.6;
    }

    .ave-btn-active {
      background: #4f46e5 !important;
      border-color: #6366f1 !important;
      color: #fff !important;
      opacity: 1 !important;
    }

    .ave-timecode {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      color: #e2e8f0;
      letter-spacing: 0.5px;
    }

    .ave-frame-input-wrapper {
      display: flex;
      align-items: center;
      background: #181926;
      border: 1px solid #282a3e;
      border-radius: 6px;
      padding: 2px 6px;
      font-family: monospace;
      font-size: 12px;
    }

    .ave-frame-prefix {
      color: #64748b;
      margin-right: 4px;
    }

    .ave-frame-input {
      background: transparent;
      border: none;
      color: #38bdf8;
      font-family: monospace;
      font-size: 12px;
      font-weight: 600;
      width: 44px;
      text-align: right;
      outline: none;

      &::-webkit-inner-spin-button,
      &::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    }

    .ave-frame-total {
      color: #64748b;
      margin-left: 4px;
    }

    .ave-select {
      background: #181926;
      color: #cbd5e1;
      border: 1px solid #282a3e;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      outline: none;
      cursor: pointer;

      &:hover {
        border-color: #3e4262;
      }
    }
  `]
})
export class AveTransportBarComponent {
  protected frameService = inject(RootFrameService);
  protected state = inject(StudioStateService);

  readonly formattedTimecode = computed<string>(() => {
    const frame = this.frameService.frame();
    const fps = this.frameService.config().fps || 30;

    const totalSeconds = frame / fps;
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const remainingFrames = frame % fps;

    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    const ff = String(remainingFrames).padStart(2, '0');

    return `${mm}:${ss}:${ff}`;
  });

  step(delta: number): void {
    this.frameService.stepFrame(delta);
  }

  jumpToStart(): void {
    this.frameService.setFrame(0);
  }

  jumpToEnd(): void {
    const total = this.frameService.config().durationInFrames;
    this.frameService.setFrame(Math.max(0, total - 1));
  }

  onFrameInputChange(e: Event): void {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) {
      this.frameService.setFrame(val);
    }
  }

  onSpeedChange(e: Event): void {
    const val = parseFloat((e.target as HTMLSelectElement).value);
    if (!isNaN(val)) {
      this.state.setPlaybackSpeed(val);
    }
  }

  onZoomChange(e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    if (val === 'fit') {
      this.state.zoomMode.set('fit');
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        this.state.zoomMode.set(num as ZoomMode);
      }
    }
  }
}
