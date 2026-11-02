import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RootFrameService, TrackConfig, TrackItem } from '@angular-video/core';
import { StudioStateService } from '../services/studio-state.service';

interface DisplayTrack {
  id: string;
  name: string;
  type: 'video' | 'overlay' | 'audio';
  category: 'sequence' | 'asset';
  items: (TrackItem & { leftPct: number; widthPct: number; label: string })[];
}

@Component({
  selector: 'ave-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ave-timeline-root">
      <!-- 1. Top Control Bar: Chevron Toggle + Tabs -->
      <div class="ave-timeline-toolbar">
        <div class="ave-toolbar-left">
          <!-- Chevron Expand/Collapse Toggle -->
          <button
            class="ave-chevron-btn"
            [class.expanded]="state.isTimelineExpanded()"
            (click)="state.toggleTimelineExpand()"
            [title]="state.isTimelineExpanded() ? 'Collapse Timeline Tracks' : 'Expand Timeline Tracks'"
          >
            {{ state.isTimelineExpanded() ? '▼' : '▲' }}
          </button>
          
          <span class="ave-toolbar-label">Timeline Tracks</span>
        </div>

        <!-- Filter Tabs: Everything, Sequences, Assets, None -->
        <div class="ave-filter-tabs">
          <button
            class="ave-tab-btn"
            [class.active]="state.timelineFilter() === 'all'"
            (click)="state.setTimelineFilter('all')"
          >
            Everything
          </button>
          <button
            class="ave-tab-btn"
            [class.active]="state.timelineFilter() === 'sequences'"
            (click)="state.setTimelineFilter('sequences')"
          >
            Sequences
          </button>
          <button
            class="ave-tab-btn"
            [class.active]="state.timelineFilter() === 'assets'"
            (click)="state.setTimelineFilter('assets')"
          >
            Assets
          </button>
          <button
            class="ave-tab-btn"
            [class.active]="state.timelineFilter() === 'none'"
            (click)="state.setTimelineFilter('none')"
          >
            None
          </button>
        </div>
      </div>

      <!-- 2. Unified Timeline Grid: 180px Header Column + Coordinated Timeline Lane -->
      <div class="ave-timeline-grid">
        <!-- Left Column: Headers -->
        <div class="ave-timeline-headers">
          <!-- Top Row Header: Master Time / Ruler -->
          <div class="ave-header-cell ave-header-ruler">
            <span class="ave-header-title">Master Scrubber</span>
            <span class="ave-header-frame">F{{ frameService.frame() }}</span>
          </div>

          <!-- Track Row Headers (When expanded) -->
          @if (state.isTimelineExpanded()) {
            <div class="ave-drawer-headers">
              @for (track of filteredTracks(); track track.id) {
                <div class="ave-header-cell ave-header-track">
                  <span class="ave-track-icon">
                    @switch (track.type) {
                      @case ('audio') { 🎵 }
                      @case ('overlay') { 🔤 }
                      @default { 🎬 }
                    }
                  </span>
                  <span class="ave-track-name" [title]="track.name">{{ track.name }}</span>
                  <span class="ave-track-type-badge">{{ track.category }}</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Right Column: Unified Timeline Lane -->
        <div
          #laneContainer
          class="ave-timeline-lane"
          (pointerdown)="onPointerDown($event)"
        >
          <!-- Top Row: Primary Scrubber & Ruler (Starts at exact 0% of timeline) -->
          <div class="ave-lane-ruler-row">
            <!-- Timeline Time Ruler Marks -->
            <div class="ave-timeline-ruler">
              @for (tick of rulerTicks(); track tick.frame) {
                <div class="ave-ruler-tick" [style.left.%]="tick.percentage">
                  <span class="ave-tick-label">{{ tick.label }}</span>
                </div>
              }
            </div>

            <!-- Primary Progress Track Rail -->
            <div class="ave-track-rail">
              <div class="ave-track-progress" [style.width.%]="progressPercentage()"></div>
            </div>
          </div>

          <!-- Multi-Track Drawer Lanes (When expanded) -->
          @if (state.isTimelineExpanded()) {
            <div class="ave-drawer-lanes">
              @if (filteredTracks().length === 0) {
                <div class="ave-tracks-empty">
                  No {{ state.timelineFilter() }} found in this composition.
                </div>
              } @else {
                @for (track of filteredTracks(); track track.id) {
                  <div class="ave-track-lane-row">
                    @for (item of track.items; track item.id || item.from) {
                      <div
                        class="ave-clip-bar"
                        [class.ave-clip-audio]="track.type === 'audio'"
                        [style.left.%]="item.leftPct"
                        [style.width.%]="item.widthPct"
                        (click)="seekToClip(item.from, $event)"
                        [title]="item.label + ' (Click to jump to Frame ' + item.from + ')'"
                      >
                        <span class="ave-clip-title">{{ item.label }}</span>
                        <span class="ave-clip-duration">F{{ item.from }}–{{ item.from + item.duration }}</span>
                      </div>
                    }
                  </div>
                }
              }
            </div>
          }

          <!-- Global Playhead Scrubber: Starts at 0% of timeline lane and cuts vertically across all tracks -->
          <div
            class="ave-playhead"
            [style.left.%]="progressPercentage()"
          >
            <div class="ave-playhead-cap"></div>
            <div class="ave-playhead-line"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      user-select: none;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .ave-timeline-root {
      display: flex;
      flex-direction: column;
      background: #0f1019;
      border-top: 1px solid #1a1c2a;
    }

    /* 1. Toolbar */
    .ave-timeline-toolbar {
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      background: #0b0c13;
      border-bottom: 1px solid #181926;
    }

    .ave-toolbar-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ave-chevron-btn {
      background: #181a28;
      border: 1px solid #25283d;
      color: #94a3b8;
      border-radius: 4px;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 10px;
      transition: all 0.15s ease;

      &:hover {
        background: #25283d;
        color: #fff;
      }

      &.expanded {
        background: #3b82f6;
        color: #fff;
        border-color: #2563eb;
      }
    }

    .ave-toolbar-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .ave-filter-tabs {
      display: flex;
      align-items: center;
      gap: 4px;
      background: #141521;
      padding: 2px;
      border-radius: 6px;
      border: 1px solid #1f2233;
    }

    .ave-tab-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 500;
      padding: 3px 10px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        color: #f1f5f9;
      }

      &.active {
        background: #25283d;
        color: #38bdf8;
        font-weight: 600;
      }
    }

    /* 2. Unified Timeline Grid */
    .ave-timeline-grid {
      display: flex;
      width: 100%;
      background: #12131d;
    }

    /* Left Column: Headers */
    .ave-timeline-headers {
      width: 180px;
      flex-shrink: 0;
      background: #11121c;
      border-right: 1px solid #1d2030;
      display: flex;
      flex-direction: column;
    }

    .ave-header-cell {
      height: 44px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1f2233;
      font-size: 11px;
      color: #94a3b8;
    }

    .ave-header-ruler {
      font-weight: 600;
      color: #cbd5e1;
      background: #131420;
    }

    .ave-header-frame {
      font-family: monospace;
      color: #38bdf8;
      font-weight: 700;
    }

    .ave-drawer-headers {
      display: flex;
      flex-direction: column;
      max-height: 180px;
      overflow-y: hidden;
    }

    .ave-header-track {
      height: 36px;
      border-bottom: 1px solid #161825;
      gap: 6px;
      justify-content: flex-start;
    }

    .ave-track-icon {
      font-size: 12px;
    }

    .ave-track-name {
      flex: 1;
      font-size: 11px;
      font-weight: 500;
      color: #cbd5e1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ave-track-type-badge {
      font-size: 9px;
      text-transform: uppercase;
      padding: 2px 4px;
      border-radius: 3px;
      background: #1e2235;
      color: #64748b;
      font-weight: 600;
    }

    /* Right Column: Unified Timeline Lane */
    .ave-timeline-lane {
      flex: 1;
      min-width: 0;
      position: relative;
      cursor: pointer;
      touch-action: none;
      display: flex;
      flex-direction: column;
      background: #12131d;
    }

    .ave-lane-ruler-row {
      height: 44px;
      position: relative;
      border-bottom: 1px solid #1f2233;
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
      top: 22px;
      left: 0;
      right: 12px;
      height: 8px;
      background: #1c1e2d;
      border-radius: 4px;
      overflow: hidden;
    }

    .ave-track-progress {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #6366f1);
      border-radius: 4px;
    }

    .ave-drawer-lanes {
      display: flex;
      flex-direction: column;
      max-height: 180px;
      overflow-y: auto;
    }

    .ave-tracks-empty {
      padding: 16px;
      color: #64748b;
      font-size: 11px;
      font-style: italic;
    }

    .ave-track-lane-row {
      height: 36px;
      position: relative;
      border-bottom: 1px solid #161825;
      margin-right: 12px;

      &:hover {
        background: rgba(255, 255, 255, 0.02);
      }
    }

    .ave-clip-bar {
      position: absolute;
      top: 4px;
      bottom: 4px;
      background: linear-gradient(90deg, #2563eb, #3b82f6);
      border: 1px solid #60a5fa;
      border-radius: 4px;
      padding: 0 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      overflow: hidden;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      transition: transform 0.1s ease, filter 0.1s ease;

      &:hover {
        filter: brightness(1.15);
        transform: translateY(-1px);
      }
    }

    .ave-clip-audio {
      background: linear-gradient(90deg, #059669, #10b981);
      border-color: #34d399;
    }

    .ave-clip-title {
      font-size: 10px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ave-clip-duration {
      font-size: 9px;
      font-family: monospace;
      color: rgba(255, 255, 255, 0.8);
      margin-left: 6px;
    }

    /* Unified Playhead: 0% is the exact beginning of the timeline lane */
    .ave-playhead {
      position: absolute;
      top: 0;
      bottom: 0;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .ave-playhead-cap {
      width: 12px;
      height: 12px;
      background: #ef4444;
      clip-path: polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%);
      flex-shrink: 0;
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
    }

    .ave-playhead-line {
      width: 2px;
      flex: 1;
      background: #ef4444;
    }
  `]
})
export class AveTimelineComponent {
  @ViewChild('laneContainer', { static: true }) laneRef!: ElementRef<HTMLDivElement>;

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
    const fps = this.frameService.config().fps || 30;
    if (total <= 0) return [];

    const ticks: { frame: number; percentage: number; label: string }[] = [];
    const interval = Math.max(fps, Math.floor(total / 10));

    for (let f = 0; f < total; f += interval) {
      const pct = (f / (total - 1)) * 100;
      const sec = (f / fps).toFixed(0);
      const label = `${sec}s (F${f})`;
      ticks.push({ frame: f, percentage: pct, label });
    }

    return ticks;
  });

  readonly allTracks = computed<DisplayTrack[]>(() => {
    const comp = this.state.activeComposition();
    if (!comp) return [];

    const rawTracks: TrackConfig[] = comp.tracks ?? comp.storyboard?.tracks ?? [];
    const total = comp.durationInFrames;

    return rawTracks.map(t => {
      const category: 'sequence' | 'asset' = t.type === 'audio' ? 'asset' : 'sequence';
      const items = t.items.map(item => {
        const leftPct = total > 1 ? (item.from / total) * 100 : 0;
        const widthPct = total > 1 ? Math.max(2, (item.duration / total) * 100) : 100;
        const label = (item as any).id || ((item as any).src ? pathBasename((item as any).src) : t.name);

        return {
          ...item,
          leftPct,
          widthPct,
          label: label || t.name || 'Clip'
        };
      });

      return {
        id: t.id,
        name: t.name || t.id,
        type: t.type,
        category,
        items
      };
    });
  });

  readonly filteredTracks = computed<DisplayTrack[]>(() => {
    const filter = this.state.timelineFilter();
    const tracks = this.allTracks();

    switch (filter) {
      case 'sequences':
        return tracks.filter(t => t.category === 'sequence');
      case 'assets':
        return tracks.filter(t => t.category === 'asset');
      case 'all':
        return tracks;
      case 'none':
      default:
        return [];
    }
  });

  seekToClip(from: number, e: MouseEvent): void {
    e.stopPropagation();
    this.frameService.setFrame(from);
  }

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
        this.laneRef.nativeElement.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
  }

  private seekFromPointer(e: PointerEvent): void {
    const rect = this.laneRef.nativeElement.getBoundingClientRect();
    if (rect.width <= 0) return;

    // Directly relative to the timeline lane: 0px is 0%, rect.width is 100%
    const relativeX = e.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(relativeX, rect.width));
    const ratio = clampedX / rect.width;

    const total = this.frameService.config().durationInFrames;
    const targetFrame = Math.round(ratio * (total - 1));
    this.frameService.setFrame(targetFrame);
  }
}

function pathBasename(src?: string): string {
  if (!src) return '';
  return src.split('/').pop() || src;
}
