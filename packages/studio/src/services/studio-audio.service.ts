import { Injectable, inject, effect, signal, OnDestroy } from '@angular/core';
import { RootFrameService, AudioTrackItem } from '@angular-video/core';
import { StudioStateService } from './studio-state.service';
import { PresentationSyncService } from './presentation-sync.service';

interface ManagedAudioTrack {
  item: AudioTrackItem;
  audio: HTMLAudioElement;
  loaded: boolean;
}

/**
 * High-performance, frame-accurate audio engine for AVE Studio and Clean Feed.
 * Synchronizes composition-level audio tracks with the frame clock, playback rate,
 * speed, loop boundaries, and remote audio routing (Echo Guard).
 */
@Injectable({
  providedIn: 'root'
})
export class StudioAudioService implements OnDestroy {
  private frameService = inject(RootFrameService);
  private studioState = inject(StudioStateService);
  private sync = inject(PresentationSyncService);

  readonly isCleanFeedMode = signal<boolean>(false);
  readonly isPlayingAudio = signal<boolean>(false);
  private managedTracks: ManagedAudioTrack[] = [];
  private currentCompId = '';

  constructor() {
    // Expose for testing and external host integration
    if (typeof window !== 'undefined') {
      (window as any).__AVE_AUDIO_ENGINE = this;

      // Unlock browser audio context on any user gesture
      const unlock = () => {
        if (this.frameService.isPlaying()) {
          this.resumeAudio();
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }

    effect(() => {
      const comp = this.studioState.activeComposition();
      const compId = comp?.id ?? '';

      if (compId !== this.currentCompId) {
        this.currentCompId = compId;
        this.rebuildAudioElements(comp?.tracks);
      }

      this.syncAudioState();
    });
  }

  /**
   * Configure whether this instance is acting as the Remote Clean Feed (presentation POC)
   * or the local Studio Workbench.
   */
  setCleanFeedMode(enabled: boolean): void {
    this.isCleanFeedMode.set(enabled);
  }

  /**
   * Immediately resumes active audio tracks within a synchronous user gesture
   * to guarantee browser autoplay activation.
   */
  resumeAudio(): void {
    const frame = this.frameService.frame();
    const fps = this.frameService.config().fps || 30;

    for (const track of this.managedTracks) {
      const inRange = frame >= track.item.from && frame < (track.item.from + track.item.duration);
      if (inRange && track.audio.paused) {
        const targetSec = (frame - track.item.from) / fps;
        track.audio.currentTime = Math.max(0, targetSec);
        track.audio.play().catch(e => {
          console.warn('[AVE Audio] Autoplay wait:', e);
        });
      }
    }
  }

  getTracks(): ManagedAudioTrack[] {
    return this.managedTracks;
  }

  private rebuildAudioElements(tracks?: any[]): void {
    // Cleanup previous audio elements
    for (const track of this.managedTracks) {
      try {
        track.audio.pause();
        track.audio.oncanplaythrough = null;
        track.audio.onerror = null;
        track.audio.src = '';
        track.audio.remove();
      } catch {}
    }
    this.managedTracks = [];

    if (!tracks || tracks.length === 0) return;

    for (const track of tracks) {
      if (track.type === 'audio' && Array.isArray(track.items)) {
        for (const rawItem of track.items) {
          const item = rawItem as AudioTrackItem;
          if (!item.src) continue;

          const audio = new Audio();
          audio.preload = 'auto';
          audio.src = item.src;
          audio.className = 'ave-managed-audio';
          audio.style.display = 'none';
          if (typeof document !== 'undefined') {
            document.body.appendChild(audio);
          }

          const managed: ManagedAudioTrack = {
            item,
            audio,
            loaded: false
          };

          audio.addEventListener('canplaythrough', () => {
            managed.loaded = true;
          }, { once: true });

          audio.addEventListener('error', (err) => {
            console.warn(`[AVE Audio] Failed to load track asset: ${item.src}`, err);
          });

          this.managedTracks.push(managed);
        }
      }
    }
  }

  private syncAudioState(): void {
    const isPlaying = this.frameService.isPlaying();
    const frame = this.frameService.frame();
    const fps = this.frameService.config().fps || 30;
    const speed = this.studioState.playbackSpeed() || 1.0;
    const destination = this.sync.audioDestination();
    const isStudioMuted = this.studioState.isMuted();
    const isCleanFeed = this.isCleanFeedMode();
    const viewers = this.sync.viewersCount();

    // Echo Guard Routing Matrix:
    // - In Clean Feed mode: Muted UNLESS audioDestination === 'remote'
    // - In Studio Workbench: Muted IF (destination === 'remote' AND remote viewers are watching) OR studio muted manually
    const hasRemoteViewers = destination === 'remote' && viewers > 0;
    const isMuted = isCleanFeed
      ? (destination !== 'remote' || viewers === 0)
      : (hasRemoteViewers || isStudioMuted);

    let hasActiveAudio = false;

    for (const track of this.managedTracks) {
      const { item, audio } = track;
      const startFrame = item.from;
      const endFrame = item.from + item.duration;
      const inRange = frame >= startFrame && frame < endFrame;

      if (inRange && isPlaying && !isMuted) {
        hasActiveAudio = true;
      }

      const baseVolume = typeof item.volume === 'number' ? item.volume : 1.0;
      audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, baseVolume));
      audio.muted = isMuted;

      const targetPlaybackRate = (item.playbackRate || 1.0) * speed;
      if (audio.playbackRate !== targetPlaybackRate && targetPlaybackRate > 0) {
        audio.playbackRate = targetPlaybackRate;
      }

      if (inRange) {
        const targetSec = (frame - startFrame) / fps;

        if (isPlaying) {
          if (audio.paused) {
            audio.currentTime = Math.max(0, targetSec);
            audio.play().catch(() => {
              // Gracefully handle browser autoplay policy before user gesture
            });
          } else {
            // Drift check: resync if audio clock drifts from frame clock by more than 120ms
            if (Math.abs(audio.currentTime - targetSec) > 0.12) {
              audio.currentTime = targetSec;
            }
          }
        } else {
          // Paused state: halt playback and seek frame-accurately
          if (!audio.paused) {
            audio.pause();
          }
          if (Math.abs(audio.currentTime - targetSec) > 0.05) {
            audio.currentTime = Math.max(0, targetSec);
          }
        }
      } else {
        // Outside active clip range
        if (!audio.paused) {
          audio.pause();
        }
      }
    }

    this.isPlayingAudio.set(hasActiveAudio);
  }

  ngOnDestroy(): void {
    for (const track of this.managedTracks) {
      try {
        track.audio.pause();
        track.audio.src = '';
        track.audio.remove();
      } catch {}
    }
    this.managedTracks = [];
  }
}
