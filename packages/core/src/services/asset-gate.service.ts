import { Injectable, signal, computed, Signal, inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AssetGateService {
  private readonly _blockedMap = signal<Map<string, number>>(new Map());

  readonly pendingAssets: Signal<string[]> = computed(() => {
    return Array.from(this._blockedMap().keys());
  });

  readonly isReady: Signal<boolean> = computed(() => {
    return this._blockedMap().size === 0;
  });

  /**
   * Blocks the engine playhead until the returned release function is invoked.
   * @param identifier Readable asset label (e.g. 'Loading Drone Video 4K')
   * @returns Release callback to unblock
   */
  block(identifier: string): () => void {
    this._blockedMap.update(map => {
      const next = new Map(map);
      const count = (next.get(identifier) || 0) + 1;
      next.set(identifier, count);
      return next;
    });

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this._blockedMap.update(map => {
        const next = new Map(map);
        const count = next.get(identifier) || 0;
        if (count <= 1) {
          next.delete(identifier);
        } else {
          next.set(identifier, count - 1);
        }
        return next;
      });
    };
  }
}

export function injectAssetGate(): AssetGateService {
  return inject(AssetGateService);
}
