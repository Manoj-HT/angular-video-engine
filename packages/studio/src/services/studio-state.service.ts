import { Injectable, signal, computed, inject, NgZone } from '@angular/core';
import { RootFrameService, VideoMetadata, VideoConfig } from '@angular-video/core';

export type ZoomMode = 'fit' | 0.25 | 0.5 | 0.75 | 1.0 | 1.5 | 2.0;
export type DrawerSide = 'right' | 'left';
export type TimelineFilter = 'all' | 'sequences' | 'assets' | 'none';

@Injectable({
  providedIn: 'root'
})
export class StudioStateService {
  private frameService = inject(RootFrameService);
  private ngZone = inject(NgZone);

  // Compositions
  readonly compositions = signal<VideoMetadata[]>([]);
  readonly activeCompositionId = signal<string>('');

  readonly activeComposition = computed<VideoMetadata | null>(() => {
    const id = this.activeCompositionId();
    return this.compositions().find(c => c.id === id) ?? this.compositions()[0] ?? null;
  });

  // Dynamic user props (overrides defaultProps for active composition)
  readonly activeProps = signal<Record<string, unknown>>({});

  // Tools & Drawer View Management
  readonly activeTool = signal<string>('videoProperties');
  readonly isToolsSearchOpen = signal<boolean>(false);

  // Persistence to Code Status
  readonly saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  private saveDebounceTimer: any = null;
  private saveFeedbackTimer: any = null;
  private pendingCompositionUpdates: {
    id?: string;
    title?: string;
    renderName?: string;
    width?: number;
    height?: number;
    fps?: number;
    durationInFrames?: number;
  } = {};

  // Workbench UI state
  readonly zoomMode = signal<ZoomMode>('fit');
  readonly isDrawerOpen = signal<boolean>(false);
  readonly drawerSide = signal<DrawerSide>('right');
  readonly playbackSpeed = signal<number>(1.0);
  readonly isMuted = signal<boolean>(false);
  readonly showCheckerboard = signal<boolean>(true);

  // Loop & In/Out Range Controls
  readonly isLoopEnabled = signal<boolean>(true);
  readonly loopStart = signal<number>(0);
  readonly loopEnd = signal<number | null>(null);

  readonly effectiveLoopEnd = computed<number>(() => {
    const comp = this.activeComposition();
    const maxFrame = comp ? Math.max(0, comp.durationInFrames - 1) : 0;
    const end = this.loopEnd();
    if (end === null || end > maxFrame) {
      return maxFrame;
    }
    return Math.max(this.loopStart() + 1, end);
  });

  readonly loopRangeLabel = computed<string>(() => {
    return `F${this.loopStart()} – F${this.effectiveLoopEnd()}`;
  });

  // Timeline Tracks Filter & Drawer State
  readonly timelineFilter = signal<TimelineFilter>('all');
  private lastActiveTimelineFilter: 'all' | 'sequences' | 'assets' = 'all';

  readonly isTimelineExpanded = computed<boolean>(() => {
    return this.timelineFilter() !== 'none';
  });

  setTimelineFilter(filter: TimelineFilter): void {
    if (filter !== 'none') {
      this.lastActiveTimelineFilter = filter;
    }
    this.timelineFilter.set(filter);
  }

  toggleTimelineExpand(): void {
    if (this.timelineFilter() === 'none') {
      this.timelineFilter.set(this.lastActiveTimelineFilter);
    } else {
      this.timelineFilter.set('none');
    }
  }

  // Timeline Zoom Level (1.0 = Fit, up to 10.0x)
  readonly timelineZoom = signal<number>(1.0);

  setTimelineZoom(zoom: number): void {
    const clamped = Math.max(1.0, Math.min(10.0, zoom));
    this.timelineZoom.set(Number(clamped.toFixed(2)));
  }

  zoomInTimeline(delta = 0.5): void {
    this.setTimelineZoom(this.timelineZoom() + delta);
  }

  zoomOutTimeline(delta = 0.5): void {
    this.setTimelineZoom(this.timelineZoom() - delta);
  }

  resetTimelineZoom(): void {
    this.timelineZoom.set(1.0);
  }

  // Internal playback loop
  private animFrameId: number | null = null;
  private playbackStartTime = 0;
  private playbackStartFrame = 0;

  constructor() {
    // Keep root frame service config synced with active composition
    this.syncConfigWithActiveComposition();
  }

  setCompositions(list: VideoMetadata[]): void {
    this.compositions.set(list);
    if (list.length > 0) {
      const targetId = this.activeCompositionId() || list[0].id;
      this.selectComposition(targetId);
    }
  }

  selectComposition(id: string): void {
    this.activeCompositionId.set(id);
    const comp = this.compositions().find(c => c.id === id) ?? this.compositions()[0];
    if (comp) {
      this.frameService.setConfig({
        fps: comp.fps,
        width: comp.width,
        height: comp.height,
        durationInFrames: comp.durationInFrames
      });
      this.activeProps.update(prev => ({
        ...(comp.defaultProps ?? {}),
        ...prev
      }));
      this.resetLoop();
    }
  }

  toggleLoop(): void {
    this.isLoopEnabled.set(!this.isLoopEnabled());
  }

  setLoopStartAtCurrent(): void {
    const current = this.frameService.frame();
    const end = this.effectiveLoopEnd();
    if (current >= end) {
      this.loopStart.set(Math.max(0, end - 1));
    } else {
      this.loopStart.set(current);
    }
  }

  setLoopEndAtCurrent(): void {
    const current = this.frameService.frame();
    const start = this.loopStart();
    if (current <= start) {
      this.loopEnd.set(start + 1);
    } else {
      this.loopEnd.set(current);
    }
  }

  resetLoop(): void {
    const comp = this.activeComposition();
    const max = comp ? Math.max(0, comp.durationInFrames - 1) : 0;
    this.loopStart.set(0);
    this.loopEnd.set(max);
  }

  updateProp(key: string, value: unknown): void {
    this.activeProps.update(prev => ({
      ...prev,
      [key]: value
    }));
  }

  updateCompositionDetails(updates: {
    id?: string;
    title?: string;
    renderName?: string;
    width?: number;
    height?: number;
    fps?: number;
    durationInFrames?: number;
  }): void {
    const active = this.activeComposition();
    if (!active) return;
    const currentCompId = active.id;
    const nextCompId = updates.id && updates.id.trim() ? updates.id.trim() : currentCompId;

    // 1. Immediately update in-memory composition signal
    this.compositions.update(list => list.map(c => {
      if (c.id === currentCompId) {
        return {
          ...c,
          ...updates,
          id: nextCompId
        };
      }
      return c;
    }));

    if (nextCompId !== currentCompId) {
      this.activeCompositionId.set(nextCompId);
    }

    // Accumulate pending updates across rapid user inputs
    this.pendingCompositionUpdates = {
      ...this.pendingCompositionUpdates,
      ...updates
    };

    // 2. Immediately sync RootFrameService for stage and timeline
    const updatedComp = this.activeComposition();
    if (updatedComp) {
      this.frameService.setConfig({
        fps: updatedComp.fps,
        width: updatedComp.width,
        height: updatedComp.height,
        durationInFrames: updatedComp.durationInFrames
      });
      // Clamp current frame if duration was shortened
      if (this.frameService.frame() >= updatedComp.durationInFrames) {
        this.frameService.setFrame(Math.max(0, updatedComp.durationInFrames - 1));
      }
      // Clamp loop work area
      if (this.loopEnd() !== null && this.loopEnd()! >= updatedComp.durationInFrames) {
        this.loopEnd.set(Math.max(0, updatedComp.durationInFrames - 1));
      }
    }

    // 3. Debounced persist directly to the video composition file via backend
    this.saveStatus.set('saving');
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      const toSend = { ...this.pendingCompositionUpdates };
      this.pendingCompositionUpdates = {};
      this.persistCompositionToCode(currentCompId, toSend);
    }, 400);
  }

  private async persistCompositionToCode(
    id: string,
    updates: {
      id?: string;
      title?: string;
      renderName?: string;
      width?: number;
      height?: number;
      fps?: number;
      durationInFrames?: number;
    }
  ): Promise<void> {
    try {
      const payload: Record<string, unknown> = { id, ...updates };
      if (updates.id && updates.id !== id) {
        payload['newId'] = updates.id;
      }
      const res = await fetch('/api/composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.saveStatus.set('saved');
        if (this.saveFeedbackTimer) clearTimeout(this.saveFeedbackTimer);
        this.saveFeedbackTimer = setTimeout(() => {
          if (this.saveStatus() === 'saved') {
            this.saveStatus.set('idle');
          }
        }, 2500);
      } else {
        console.error('[AVE] Failed to save composition to code:', data.error);
        this.saveStatus.set('error');
      }
    } catch (err) {
      console.error('[AVE] Network error saving composition to code:', err);
      this.saveStatus.set('error');
    }
  }

  togglePlay(): void {
    if (this.frameService.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  play(): void {
    const comp = this.activeComposition();
    if (!comp) return;

    const loopStart = this.loopStart();
    const loopEnd = this.effectiveLoopEnd();

    // If playhead is outside or at the loop boundary, rebase to loop start
    if (this.frameService.frame() >= loopEnd || this.frameService.frame() < loopStart) {
      this.frameService.setFrame(loopStart);
    }

    this.frameService.setPlaying(true);
    this.playbackStartTime = performance.now();
    this.playbackStartFrame = this.frameService.frame();

    this.ngZone.runOutsideAngular(() => {
      this.startPlaybackLoop();
    });
  }

  pause(): void {
    this.frameService.setPlaying(false);
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed.set(speed);
    if (this.frameService.isPlaying()) {
      // Rebase start time on speed change
      this.playbackStartTime = performance.now();
      this.playbackStartFrame = this.frameService.frame();
    }
  }

  toggleMute(): void {
    this.isMuted.set(!this.isMuted());
  }

  toggleDrawer(): void {
    const nextState = !this.isDrawerOpen();
    this.isDrawerOpen.set(nextState);
    if (!nextState) {
      this.isToolsSearchOpen.set(false);
    }
  }

  openToolsList(): void {
    this.isDrawerOpen.set(true);
    this.isToolsSearchOpen.set(true);
  }

  closeToolsList(): void {
    this.isToolsSearchOpen.set(false);
  }

  toggleToolsList(): void {
    if (!this.isDrawerOpen()) {
      this.isDrawerOpen.set(true);
      this.isToolsSearchOpen.set(true);
    } else {
      this.isToolsSearchOpen.update(v => !v);
    }
  }

  selectTool(toolId: string): void {
    this.activeTool.set(toolId);
    this.isToolsSearchOpen.set(false);
  }

  private startPlaybackLoop(): void {
    const tick = () => {
      if (!this.frameService.isPlaying()) return;

      const comp = this.activeComposition();
      if (!comp) return;

      const now = performance.now();
      const elapsedSeconds = (now - this.playbackStartTime) / 1000;
      const speed = this.playbackSpeed();
      const elapsedFrames = Math.floor(elapsedSeconds * comp.fps * speed);
      const targetFrame = this.playbackStartFrame + elapsedFrames;

      const loopEnd = this.effectiveLoopEnd();
      const loopStart = this.loopStart();

      if (targetFrame >= loopEnd) {
        if (this.isLoopEnabled()) {
          // Loop around to loopStart
          this.playbackStartTime = performance.now();
          this.playbackStartFrame = loopStart;
          this.ngZone.run(() => {
            this.frameService.setFrame(loopStart);
          });
          this.animFrameId = requestAnimationFrame(tick);
          return;
        } else {
          // Stop at loopEnd
          this.ngZone.run(() => {
            this.frameService.setFrame(loopEnd);
            this.pause();
          });
          return;
        }
      }

      this.ngZone.run(() => {
        this.frameService.setFrame(targetFrame);
      });

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  private syncConfigWithActiveComposition(): void {
    const comp = this.activeComposition();
    if (comp) {
      this.frameService.setConfig({
        fps: comp.fps,
        width: comp.width,
        height: comp.height,
        durationInFrames: comp.durationInFrames
      });
      if (this.loopEnd() === null) {
        this.loopEnd.set(comp.durationInFrames - 1);
      }
      if (Object.keys(this.activeProps()).length === 0 && comp.defaultProps) {
        this.activeProps.set({ ...comp.defaultProps });
      }
    }
  }
}
