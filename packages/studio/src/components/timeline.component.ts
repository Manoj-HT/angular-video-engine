import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  HostListener,
  effect
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
      <!-- 1. Top Control Bar: Chevron Toggle + Filter Tabs + Zoom Controls -->
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

        <!-- Right: Timeline Zoom Controls -->
        <div class="ave-zoom-controls">
          <button
            class="ave-zoom-btn"
            (click)="stepZoom(-0.5)"
            [disabled]="state.timelineZoom() <= 1"
            title="Zoom Out (Alt + Wheel Down)"
          >
            −
          </button>

          <input
            type="range"
            class="ave-zoom-slider"
            min="1"
            max="10"
            step="0.25"
            [value]="state.timelineZoom()"
            (input)="onZoomSlider($event)"
            title="Timeline Zoom Level"
          />

          <button
            class="ave-zoom-btn"
            (click)="stepZoom(0.5)"
            [disabled]="state.timelineZoom() >= 10"
            title="Zoom In (Alt + Wheel Up)"
          >
            +
          </button>

          <div class="ave-zoom-presets">
            <button
              class="ave-preset-btn"
              [class.active]="state.timelineZoom() === 1"
              (click)="setZoomPreset(1)"
              title="Fit Full Timeline (1x)"
            >
              Fit
            </button>
            <button
              class="ave-preset-btn"
              [class.active]="state.timelineZoom() === 2"
              (click)="setZoomPreset(2)"
              title="2x Zoom"
            >
              2x
            </button>
            <button
              class="ave-preset-btn"
              [class.active]="state.timelineZoom() === 4"
              (click)="setZoomPreset(4)"
              title="4x Zoom (~5s window for 20s video)"
            >
              4x
            </button>
            <button
              class="ave-preset-btn"
              [class.active]="state.timelineZoom() === 8"
              (click)="setZoomPreset(8)"
              title="8x Zoom (Fine frame inspection)"
            >
              8x
            </button>
          </div>

          <span class="ave-zoom-label">{{ state.timelineZoom().toFixed(1) }}x</span>
        </div>
      </div>

      <!-- 2. Unified Timeline Grid: 180px Header Column + Coordinated Scrollable Timeline Lane -->
      <div class="ave-timeline-grid">
        <!-- Left Column: Fixed Headers -->
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

        <!-- Right Column: Scrollable Viewport Container -->
        <div
          #scrollViewport
          class="ave-timeline-viewport"
          (wheel)="onViewportWheel($event)"
        >
          <!-- Unified Timeline Virtual Lane (Expands based on timelineZoom) -->
          <div
            #laneContainer
            class="ave-timeline-lane"
            [style.width.%]="state.timelineZoom() * 100"
            (pointerdown)="onPointerDown($event)"
          >
            <!-- Top Row: Primary Scrubber & Ruler (Starts at exact 0% of timeline) -->
            <div class="ave-lane-ruler-row">
              <!-- Active Loop Region Band -->
              <div
                class="ave-loop-region-band"
                [style.left.%]="loopStartPercentage()"
                [style.width.%]="loopWidthPercentage()"
              >
                <div class="ave-loop-handle-in" [title]="'Loop In: Frame ' + state.loopStart()">[</div>
                <div class="ave-loop-handle-out" [title]="'Loop Out: Frame ' + state.effectiveLoopEnd()">]</div>
              </div>

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
      gap: 12px;
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

    /* Zoom Controls */
    .ave-zoom-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ave-zoom-btn {
      width: 22px;
      height: 22px;
      background: #181a28;
      border: 1px solid #25283d;
      color: #cbd5e1;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not(:disabled) {
        background: #25283d;
        color: #fff;
        border-color: #3b82f6;
      }

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }

    .ave-zoom-slider {
      width: 65px;
      height: 4px;
      accent-color: #3b82f6;
      cursor: pointer;
    }

    .ave-zoom-presets {
      display: flex;
      align-items: center;
      gap: 2px;
      background: #141521;
      padding: 2px;
      border-radius: 4px;
      border: 1px solid #1f2233;
    }

    .ave-preset-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        color: #fff;
      }

      &.active {
        background: #25283d;
        color: #38bdf8;
      }
    }

    .ave-zoom-label {
      font-family: monospace;
      font-size: 11px;
      color: #38bdf8;
      font-weight: 700;
      min-width: 30px;
      text-align: right;
    }

    /* 2. Unified Timeline Grid */
    .ave-timeline-grid {
      display: flex;
      width: 100%;
      min-width: 0;
      background: #12131d;
      overflow: hidden;
    }

    /* Left Column: Headers */
    .ave-timeline-headers {
      width: 180px;
      flex-shrink: 0;
      background: #11121c;
      border-right: 1px solid #1d2030;
      display: flex;
      flex-direction: column;
      z-index: 10;
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

    /* Right Column: Scrollable Viewport Container */
    .ave-timeline-viewport {
      flex: 1;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      position: relative;
      scrollbar-width: thin;
      scrollbar-color: #2b304d #0f1019;

      &::-webkit-scrollbar {
        height: 6px;
      }
      &::-webkit-scrollbar-track {
        background: #0f1019;
      }
      &::-webkit-scrollbar-thumb {
        background: #2b304d;
        border-radius: 3px;

        &:hover {
          background: #3b82f6;
        }
      }
    }

    /* Virtual Content Lane: Width scales proportionally with zoom */
    .ave-timeline-lane {
      min-width: 100%;
      height: 100%;
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

    .ave-loop-region-band {
      position: absolute;
      top: 0;
      bottom: 0;
      background: rgba(56, 189, 248, 0.12);
      border-left: 2px solid #38bdf8;
      border-right: 2px solid #38bdf8;
      pointer-events: none;
      z-index: 5;
    }

    .ave-loop-handle-in,
    .ave-loop-handle-out {
      position: absolute;
      top: 1px;
      font-size: 11px;
      font-weight: 800;
      color: #38bdf8;
      font-family: monospace;
      line-height: 1;
      text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
    }

    .ave-loop-handle-in {
      left: 2px;
    }

    .ave-loop-handle-out {
      right: 2px;
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
      white-space: nowrap;
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
      overflow-y: hidden;
    }

    .ave-tracks-empty {
      height: 36px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      color: #475569;
      font-size: 11px;
      font-style: italic;
    }

    .ave-track-lane-row {
      height: 36px;
      position: relative;
      border-bottom: 1px solid #161825;
      background: rgba(255, 255, 255, 0.01);
    }

    .ave-clip-bar {
      position: absolute;
      top: 4px;
      bottom: 4px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      border: 1px solid #3b82f6;
      border-radius: 4px;
      padding: 2px 6px;
      display: flex;
      align-items: center;
      overflow: hidden;
      cursor: pointer;
      transition: filter 0.15s ease, border-color 0.15s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);

      &:hover {
        filter: brightness(1.2);
        border-color: #60a5fa;
      }

      &.ave-clip-audio {
        background: linear-gradient(135deg, #059669, #047857);
        border-color: #10b981;
      }
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
  @ViewChild('scrollViewport', { static: true }) scrollViewportRef!: ElementRef<HTMLDivElement>;
  @ViewChild('laneContainer', { static: true }) laneRef!: ElementRef<HTMLDivElement>;

  protected frameService = inject(RootFrameService);
  protected state = inject(StudioStateService);

  private isDragging = false;

  constructor() {
    // Smoothly keep playhead in view during playback when zoomed in
    effect(() => {
      const isPlaying = this.frameService.isPlaying();
      const frame = this.frameService.frame();
      const zoom = this.state.timelineZoom();

      if (isPlaying && zoom > 1) {
        this.keepPlayheadInView(frame);
      }
    });
  }

  readonly progressPercentage = computed<number>(() => {
    const frame = this.frameService.frame();
    const total = this.frameService.config().durationInFrames;
    if (total <= 1) return 0;
    return (frame / (total - 1)) * 100;
  });

  readonly loopStartPercentage = computed<number>(() => {
    const total = this.frameService.config().durationInFrames;
    if (total <= 1) return 0;
    return (this.state.loopStart() / (total - 1)) * 100;
  });

  readonly loopWidthPercentage = computed<number>(() => {
    const total = this.frameService.config().durationInFrames;
    if (total <= 1) return 100;
    const start = this.state.loopStart();
    const end = this.state.effectiveLoopEnd();
    return Math.max(0.5, ((end - start) / (total - 1)) * 100);
  });

  readonly rulerTicks = computed<{ frame: number; percentage: number; label: string }[]>(() => {
    const total = this.frameService.config().durationInFrames;
    const fps = this.frameService.config().fps || 30;
    const zoom = this.state.timelineZoom();
    if (total <= 0) return [];

    const interval = computeRulerInterval(total, fps, zoom);
    const ticks: { frame: number; percentage: number; label: string }[] = [];

    for (let f = 0; f < total; f += interval) {
      const pct = total > 1 ? (f / (total - 1)) * 100 : 0;
      let label: string;
      if (interval < fps) {
        const sec = (f / fps).toFixed(1);
        label = `${sec}s (F${f})`;
      } else {
        const sec = (f / fps).toFixed(0);
        label = `${sec}s (F${f})`;
      }
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

  // --- Zoom Actions & Anchoring ---

  stepZoom(delta: number): void {
    const current = this.state.timelineZoom();
    const target = Math.max(1, Math.min(10, current + delta));
    this.applyZoomWithAnchor(target);
  }

  setZoomPreset(target: number): void {
    this.applyZoomWithAnchor(target);
  }

  onZoomSlider(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(val)) {
      this.applyZoomWithAnchor(val);
    }
  }

  onViewportWheel(e: WheelEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      const current = this.state.timelineZoom();
      const target = Math.max(1, Math.min(10, current + delta));

      const viewport = this.scrollViewportRef?.nativeElement;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const mouseViewportX = e.clientX - rect.left;
      this.applyZoomWithAnchor(target, mouseViewportX);
    }
  }

  private applyZoomWithAnchor(newZoom: number, mouseViewportX?: number): void {
    const oldZoom = this.state.timelineZoom();
    if (newZoom === oldZoom) return;

    const viewport = this.scrollViewportRef?.nativeElement;
    if (!viewport) {
      this.state.setTimelineZoom(newZoom);
      return;
    }

    const viewportWidth = viewport.clientWidth;
    const oldScrollLeft = viewport.scrollLeft;

    let anchorRatio: number;
    let viewportOffset: number;

    if (typeof mouseViewportX === 'number' && mouseViewportX >= 0 && mouseViewportX <= viewportWidth) {
      // Zoom centered directly under mouse cursor
      viewportOffset = mouseViewportX;
      const oldVirtualX = oldScrollLeft + mouseViewportX;
      const oldVirtualWidth = viewportWidth * oldZoom;
      anchorRatio = oldVirtualWidth > 0 ? (oldVirtualX / oldVirtualWidth) : 0;
    } else {
      // Zoom centered on Playhead
      viewportOffset = viewportWidth / 2;
      const totalFrames = this.frameService.config().durationInFrames;
      anchorRatio = totalFrames > 1 ? (this.frameService.frame() / (totalFrames - 1)) : 0;
    }

    this.state.setTimelineZoom(newZoom);

    // After DOM width style updates on next render frame:
    requestAnimationFrame(() => {
      const newVirtualWidth = viewportWidth * newZoom;
      const targetScrollLeft = (anchorRatio * newVirtualWidth) - viewportOffset;
      const maxScroll = Math.max(0, newVirtualWidth - viewportWidth);
      viewport.scrollLeft = Math.max(0, Math.min(maxScroll, targetScrollLeft));
    });
  }

  private keepPlayheadInView(frame: number): void {
    const viewport = this.scrollViewportRef?.nativeElement;
    const lane = this.laneRef?.nativeElement;
    if (!viewport || !lane) return;

    const total = this.frameService.config().durationInFrames;
    if (total <= 1) return;

    const laneWidth = lane.clientWidth;
    const playheadX = (frame / (total - 1)) * laneWidth;
    const scrollLeft = viewport.scrollLeft;
    const viewportWidth = viewport.clientWidth;

    const rightThreshold = scrollLeft + viewportWidth - 60;
    const leftThreshold = scrollLeft;

    if (playheadX > rightThreshold) {
      viewport.scrollLeft = Math.max(0, playheadX - (viewportWidth * 0.25));
    } else if (playheadX < leftThreshold) {
      viewport.scrollLeft = Math.max(0, playheadX - (viewportWidth * 0.25));
    }
  }

  // --- Scrubber Pointer Interactions ---

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
    const lane = this.laneRef?.nativeElement;
    const viewport = this.scrollViewportRef?.nativeElement;
    if (!lane || !viewport) return;

    const viewportRect = viewport.getBoundingClientRect();
    const laneWidth = lane.clientWidth;
    if (laneWidth <= 0) return;

    // Viewport relative X + scrollLeft gives exact position on virtual timeline
    const mouseInViewport = e.clientX - viewportRect.left;
    const relativeX = mouseInViewport + viewport.scrollLeft;
    const clampedX = Math.max(0, Math.min(relativeX, laneWidth));
    const ratio = clampedX / laneWidth;

    const total = this.frameService.config().durationInFrames;
    const targetFrame = Math.round(ratio * (total - 1));
    this.frameService.setFrame(targetFrame);

    // Smooth edge scrolling while dragging playhead
    const edgeMargin = 40;
    if (mouseInViewport > viewportRect.width - edgeMargin) {
      viewport.scrollLeft += 12;
    } else if (mouseInViewport < edgeMargin && viewport.scrollLeft > 0) {
      viewport.scrollLeft -= 12;
    }
  }
}

function computeRulerInterval(totalFrames: number, fps: number, zoom: number): number {
  if (totalFrames <= 0) return 30;
  // Target roughly 10-15 tick marks per visible viewport width
  const targetStep = Math.max(1, totalFrames / (12 * zoom));

  const standardSteps = [
    1,
    2,
    5,
    10,
    Math.round(fps / 2),
    fps,
    fps * 2,
    fps * 5,
    fps * 10,
    fps * 30,
    fps * 60
  ];

  for (const step of standardSteps) {
    if (step >= targetStep) {
      return step;
    }
  }
  return standardSteps[standardSteps.length - 1];
}

function pathBasename(src?: string): string {
  if (!src) return '';
  return src.split('/').pop() || src;
}
