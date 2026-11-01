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
import { StudioStateService, TimelineFilter } from '../services/studio-state.service';

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

      <!-- 2. Primary Time Ruler & Scrub Rail -->
      <div
        #trackContainer
        class="ave-timeline-container"
        (pointerdown)="onPointerDown($event)"
      >
        <!-- Timeline Time Ruler -->
        <div class="ave-timeline-ruler">
          @for (tick of rulerTicks(); track tick.frame) {
            <div class="ave-ruler-tick" [style.left.%]="tick.percentage">
              <span class="ave-tick-label">{{ tick.label }}</span>
            </div>
          }
        </div>

        <!-- Primary Track Background Rail -->
        <div class="ave-track-rail">
          <div class="ave-track-progress" [style.width.%]="progressPercentage()"></div>
        </div>

        <!-- Draggable Playhead Scrubber -->
        <div class="ave-playhead" [style.left.%]="progressPercentage()">
          <div class="ave-playhead-cap"></div>
          <div class="ave-playhead-line" [style.height.px]="playheadLineHeight()"></div>
        </div>
      </div>

      <!-- 3. Expandable Multi-Track Drawer (Visible when filter is NOT 'none') -->
      @if (state.isTimelineExpanded()) {
        <div class="ave-tracks-drawer">
          @if (filteredTracks().length === 0) {
            <div class="ave-tracks-empty">
              No {{ state.timelineFilter() }} found in this composition.
            </div>
          } @else {
            <div class="ave-tracks-list">
              @for (track of filteredTracks(); track track.id) {
                <div class="ave-track-row">
                  <!-- Track Header on the Left -->
                  <div class="ave-track-header">
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

                  <!-- Track Lane on the Right -->
                  <div class="ave-track-lane" (pointerdown)="onPointerDown($event)">
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
                </div>
              }
            </div>
          }
        </div>
      }
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

    /* 2. Primary Scrubber Rail */
    .ave-timeline-container {
      width: 100%;
      height: 44px;
      position: relative;
      background: #12131d;
      border-bottom: 1px solid #1f2233;
      cursor: pointer;
      touch-action: none;
    }

    .ave-timeline-ruler {
      position: absolute;
      top: 0;
      left: 180px; /* Offset matching track headers */
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
      left: 180px; /* Offset matching track headers */
      right: 0;
      height: 8px;
      background: #1c1e2d;
      border-radius: 4px;
      overflow: hidden;
      margin-right: 8px;
    }

    .ave-track-progress {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #6366f1);
      border-radius: 4px;
    }

    .ave-playhead {
      position: absolute;
      top: 0;
      left: 180px;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 50;
    }

    .ave-playhead-cap {
      width: 12px;
      height: 12px;
      background: #ef4444;
      clip-path: polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%);
      margin: 0 auto;
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
    }

    .ave-playhead-line {
      width: 2px;
      background: #ef4444;
      margin: 0 auto;
    }

    /* 3. Expandable Multi-Track Drawer */
    .ave-tracks-drawer {
      max-height: 180px;
      overflow-y: auto;
      background: #0d0e15;
      border-bottom: 1px solid #1a1c2a;
    }

    .ave-tracks-empty {
      padding: 20px;
      text-align: center;
      color: #64748b;
      font-size: 12px;
      font-style: italic;
    }

    .ave-tracks-list {
      display: flex;
      flex-direction: column;
    }

    .ave-track-row {
      display: flex;
      height: 36px;
      border-bottom: 1px solid #161825;
      align-items: center;

      &:hover {
        background: rgba(255, 255, 255, 0.02);
      }
    }

    .ave-track-header {
      width: 180px;
      flex-shrink: 0;
      height: 100%;
      padding: 0 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      background: #11121c;
      border-right: 1px solid #1d2030;
      overflow: hidden;
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

    .ave-track-lane {
      flex: 1;
      height: 100%;
      position: relative;
      cursor: pointer;
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
  `]
})
export class AveTimelineComponent {
  @ViewChild('trackContainer', { static: true }) trackRef!: ElementRef<HTMLDivElement>;

  protected frameService = inject(RootFrameService);
  protected state = inject(StudioStateService);

  private isDragging = false;

  readonly progressPercentage = computed<number>(() => {
    const frame = this.frameService.frame();
    const total = this.frameService.config().durationInFrames;
    if (total <= 1) return 0;
    return (frame / (total - 1)) * 100;
  });

  readonly playheadLineHeight = computed<number>(() => {
    if (!this.state.isTimelineExpanded()) {
      return 44;
    }
    const count = this.filteredTracks().length;
    return 44 + Math.min(180, count * 36);
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
        this.trackRef.nativeElement.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
  }

  private seekFromPointer(e: PointerEvent): void {
    const rect = this.trackRef.nativeElement.getBoundingClientRect();
    // Offset for track headers (180px)
    const headerOffset = 180;
    const laneWidth = rect.width - headerOffset;
    if (laneWidth <= 0) return;

    const relativeX = e.clientX - rect.left - headerOffset;
    const clampedX = Math.max(0, Math.min(relativeX, laneWidth));
    const ratio = clampedX / laneWidth;

    const total = this.frameService.config().durationInFrames;
    const targetFrame = Math.round(ratio * (total - 1));
    this.frameService.setFrame(targetFrame);
  }
}

function pathBasename(src?: string): string {
  if (!src) return '';
  return src.split('/').pop() || src;
}
