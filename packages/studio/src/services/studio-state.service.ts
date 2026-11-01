import { Injectable, signal, computed, inject, NgZone } from '@angular/core';
import { RootFrameService, VideoMetadata, VideoConfig } from '@angular-video/core';

export type ZoomMode = 'fit' | 0.25 | 0.5 | 0.75 | 1.0 | 1.5 | 2.0;
export type DrawerSide = 'right' | 'left';

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

  // Workbench UI state
  readonly zoomMode = signal<ZoomMode>('fit');
  readonly isDrawerOpen = signal<boolean>(false);
  readonly drawerSide = signal<DrawerSide>('right');
  readonly playbackSpeed = signal<number>(1.0);
  readonly isMuted = signal<boolean>(false);
  readonly loop = signal<boolean>(true);
  readonly showCheckerboard = signal<boolean>(true);

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
    if (list.length > 0 && !this.activeCompositionId()) {
      this.selectComposition(list[0].id);
    }
  }

  selectComposition(id: string): void {
    this.activeCompositionId.set(id);
    const comp = this.compositions().find(c => c.id === id);
    if (comp) {
      this.frameService.setConfig({
        fps: comp.fps,
        width: comp.width,
        height: comp.height,
        durationInFrames: comp.durationInFrames
      });
      this.activeProps.set({ ...(comp.defaultProps ?? {}) });
      this.frameService.setFrame(0);
    }
  }

  updateProp(key: string, value: unknown): void {
    this.activeProps.update(prev => ({
      ...prev,
      [key]: value
    }));
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

    // If at the end, wrap to start
    if (this.frameService.frame() >= comp.durationInFrames - 1) {
      this.frameService.setFrame(0);
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
    this.isDrawerOpen.set(!this.isDrawerOpen());
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

      if (targetFrame >= comp.durationInFrames) {
        if (this.loop()) {
          // Loop around
          this.playbackStartTime = performance.now();
          this.playbackStartFrame = 0;
          this.ngZone.run(() => {
            this.frameService.setFrame(0);
          });
          this.animFrameId = requestAnimationFrame(tick);
          return;
        } else {
          this.ngZone.run(() => {
            this.frameService.setFrame(comp.durationInFrames - 1);
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
      if (Object.keys(this.activeProps()).length === 0 && comp.defaultProps) {
        this.activeProps.set({ ...comp.defaultProps });
      }
    }
  }
}
