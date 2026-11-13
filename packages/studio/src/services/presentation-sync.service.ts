import { Injectable, signal, inject, effect } from '@angular/core';
import { RootFrameService } from '@angular-video/core';
import { StudioStateService } from './studio-state.service';

export type AudioDestination = 'studio' | 'remote';

export interface SessionSnapshot {
  activeCompositionId?: string;
  frame?: number;
  isPlaying?: boolean;
  speed?: number;
  props?: Record<string, unknown>;
  audioDestination?: AudioDestination;
  loopStart?: number;
  loopEnd?: number;
  viewersCount?: number;
}

export type SyncMessage =
  | { type: 'INIT_STATE'; state: SessionSnapshot }
  | { type: 'SEEK'; frame: number }
  | { type: 'PLAY'; speed?: number }
  | { type: 'PAUSE'; frame?: number }
  | { type: 'PROPS_UPDATE'; props: Record<string, unknown> }
  | { type: 'COMPOSITION_CHANGE'; id: string }
  | { type: 'AUDIO_DESTINATION'; destination: AudioDestination }
  | { type: 'LOOP_CHANGE'; loopStart: number; loopEnd: number }
  | { type: 'VIEWERS_COUNT'; count: number; total?: number };

@Injectable({
  providedIn: 'root'
})
export class PresentationSyncService {
  private frameService = inject(RootFrameService);
  private studioState = inject(StudioStateService);

  readonly isConnected = signal<boolean>(false);
  readonly viewersCount = signal<number>(0);
  readonly audioDestination = signal<AudioDestination>('studio');

  readonly isViewerMode =
    typeof window !== 'undefined' &&
    ['presentation', 'poc'].includes(
      new URLSearchParams(window.location.search).get('mode') || ''
    );

  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isProcessingRemoteMessage = false;

  constructor() {
    this.initTransport();

    // Auto-broadcast play/pause transitions
    effect(() => {
      const playing = this.frameService.isPlaying();
      if (!this.isProcessingRemoteMessage && !this.isViewerMode) {
        if (playing) {
          this.broadcastPlay(this.studioState.playbackSpeed());
        } else {
          this.broadcastPause(this.frameService.frame());
        }
      }
    });

    // Auto-broadcast frame changes when scrubbing (paused)
    effect(() => {
      const f = this.frameService.frame();
      const playing = this.frameService.isPlaying();
      if (!this.isProcessingRemoteMessage && !this.isViewerMode && !playing) {
        this.broadcastSeek(f);
      }
    });

    // Auto-broadcast props changes when host edits Inspector controls
    effect(() => {
      const props = this.studioState.activeProps();
      if (!this.isProcessingRemoteMessage && !this.isViewerMode) {
        this.broadcastProps(props);
      }
    });

    // Auto-broadcast composition changes when host switches scene
    effect(() => {
      const compId = this.studioState.activeCompositionId();
      if (!this.isProcessingRemoteMessage && !this.isViewerMode && compId) {
        this.broadcastComposition(compId);
      }
    });

    // Auto-broadcast loop work area changes
    effect(() => {
      const start = this.studioState.loopStart();
      const end = this.studioState.effectiveLoopEnd();
      if (!this.isProcessingRemoteMessage && !this.isViewerMode) {
        this.broadcastLoop(start, end);
      }
    });

    // Automatic Audio Routing Echo Guard
    effect(() => {
      const dest = this.audioDestination();
      const viewers = this.viewersCount();
      if (this.isViewerMode) {
        // Clean Feed / POC mode: unmute only if destination is 'remote'
        this.studioState.isMuted.set(dest !== 'remote');
      } else {
        // Studio workbench: only mute if destination is 'remote' AND there are remote viewers watching!
        this.studioState.isMuted.set(dest === 'remote' && viewers > 0);
      }
    });
  }

  private initTransport(): void {
    if (typeof window === 'undefined') return;
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode === 'render') return;

    // 1. Try WebSocket connection to /ave-sync
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ave-sync`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected.set(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as SyncMessage;
          this.handleIncomingMessage(msg);
        } catch (e) {
          console.error('[AVE-Sync] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected.set(false);
        // Fallback to BroadcastChannel
        this.initBroadcastChannelFallback();
      };

      this.ws.onerror = () => {
        this.initBroadcastChannelFallback();
      };
    } catch {
      this.initBroadcastChannelFallback();
    }
  }

  private initBroadcastChannelFallback(): void {
    if (this.broadcastChannel || typeof BroadcastChannel === 'undefined') return;
    this.broadcastChannel = new BroadcastChannel('ave_presentation_sync');
    this.broadcastChannel.onmessage = (event) => {
      this.handleIncomingMessage(event.data);
    };
  }

  private send(msg: SyncMessage): void {
    if (this.isProcessingRemoteMessage) return;

    const payload = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(msg);
    }
  }

  // --- Host Broadcast Methods ---

  broadcastSeek(frame: number): void {
    this.send({ type: 'SEEK', frame });
  }

  broadcastPlay(speed = 1): void {
    this.send({ type: 'PLAY', speed });
  }

  broadcastPause(frame: number): void {
    this.send({ type: 'PAUSE', frame });
  }

  broadcastProps(props: Record<string, unknown>): void {
    this.send({ type: 'PROPS_UPDATE', props });
  }

  broadcastComposition(id: string): void {
    this.send({ type: 'COMPOSITION_CHANGE', id });
  }

  broadcastLoop(loopStart: number, loopEnd: number): void {
    this.send({ type: 'LOOP_CHANGE', loopStart, loopEnd });
  }

  setAudioDestination(dest: AudioDestination): void {
    this.audioDestination.set(dest);
    this.send({ type: 'AUDIO_DESTINATION', destination: dest });
  }

  // --- Incoming Message Handler ---

  private handleIncomingMessage(msg: SyncMessage): void {
    this.isProcessingRemoteMessage = true;

    try {
      switch (msg.type) {
        case 'INIT_STATE': {
          const state = msg.state;
          if (state.activeCompositionId) {
            this.studioState.selectComposition(state.activeCompositionId);
          }
          if (typeof state.frame === 'number') {
            this.frameService.setFrame(state.frame);
          }
          if (state.props && Object.keys(state.props).length > 0) {
            this.studioState.activeProps.set({ ...state.props });
          }
          if (state.audioDestination) {
            this.audioDestination.set(state.audioDestination);
          }
          if (typeof state.loopStart === 'number') {
            this.studioState.loopStart.set(state.loopStart);
          }
          if (typeof state.loopEnd === 'number') {
            this.studioState.loopEnd.set(state.loopEnd);
          }
          if (state.isPlaying) {
            this.studioState.play();
          } else {
            this.studioState.pause();
          }
          break;
        }

        case 'SEEK':
          this.frameService.setFrame(msg.frame);
          break;

        case 'PLAY':
          if (msg.speed) this.studioState.setPlaybackSpeed(msg.speed);
          this.studioState.play();
          break;

        case 'PAUSE':
          if (typeof msg.frame === 'number') this.frameService.setFrame(msg.frame);
          this.studioState.pause();
          break;

        case 'PROPS_UPDATE':
          this.studioState.activeProps.set({ ...msg.props });
          break;

        case 'COMPOSITION_CHANGE':
          this.studioState.selectComposition(msg.id);
          break;

        case 'AUDIO_DESTINATION':
          this.audioDestination.set(msg.destination);
          break;

        case 'LOOP_CHANGE':
          this.studioState.loopStart.set(msg.loopStart);
          this.studioState.loopEnd.set(msg.loopEnd);
          break;

        case 'VIEWERS_COUNT':
          this.viewersCount.set(msg.count ?? 0);
          break;
      }
    } finally {
      this.isProcessingRemoteMessage = false;
    }
  }

  // --- Presentation Utilities ---

  getPresentationUrl(compositionId?: string): string {
    const id = compositionId || this.studioState.activeCompositionId();
    const origin = window.location.origin;
    return `${origin}/?mode=presentation&id=${id}`;
  }

  openPopupCleanFeed(compositionId?: string): Window | null {
    const url = this.getPresentationUrl(compositionId);
    return window.open(
      url,
      'ave_clean_feed',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
    );
  }

  async copyPresentationUrl(compositionId?: string): Promise<boolean> {
    const url = this.getPresentationUrl(compositionId);
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }
}
