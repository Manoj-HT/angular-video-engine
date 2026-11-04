import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudioStateService } from '../services/studio-state.service';
import { PresentationSyncService, AudioDestination } from '../services/presentation-sync.service';

@Component({
  selector: 'ave-studio-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="ave-header">
      <!-- Left: Logo & Composition Switcher Dropdown -->
      <div class="ave-header-left">
        <div class="ave-brand">
          <div class="ave-logo-badge">AVE</div>
          <span class="ave-logo-text">Angular Video Engine</span>
        </div>

        <div class="ave-comp-dropdown">
          <button class="ave-comp-trigger" (click)="toggleDropdown()">
            <span class="ave-comp-title">
              {{ state.activeComposition()?.title || state.activeComposition()?.id || 'Select Composition' }}
            </span>
            <span class="ave-comp-badge">
              {{ state.activeComposition()?.width }}×{{ state.activeComposition()?.height }} @ {{ state.activeComposition()?.fps }}fps
            </span>
            <span class="ave-chevron">▼</span>
          </button>

          @if (isDropdownOpen()) {
            <div class="ave-dropdown-menu">
              <div class="ave-dropdown-header">Compositions</div>
              @for (comp of state.compositions(); track comp.id) {
                <button
                  class="ave-dropdown-item"
                  [class.active]="comp.id === state.activeCompositionId()"
                  (click)="selectComposition(comp.id)"
                >
                  <div class="ave-dropdown-item-title">{{ comp.title || comp.id }}</div>
                  <div class="ave-dropdown-item-meta">{{ comp.width }}×{{ comp.height }} · {{ comp.durationInFrames }} frames</div>
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Right: Presentation Clean Feed & Export -->
      <div class="ave-header-right">
        <!-- Clean Feed Pop-out & Remote POC Menu -->
        <div class="ave-clean-feed-menu-wrapper">
          <button
            class="ave-clean-feed-btn"
            [class.active]="sync.viewersCount() > 0"
            (click)="toggleCleanFeedMenu()"
            title="Clean Feed Presentation Mode"
          >
            <span class="ave-clean-feed-dot" [class.live]="sync.viewersCount() > 0"></span>
            <span>🖥️ Clean Feed</span>
            @if (sync.viewersCount() > 0) {
              <span class="ave-viewers-badge">{{ sync.viewersCount() }}</span>
            }
          </button>

          @if (isCleanFeedMenuOpen()) {
            <div class="ave-clean-feed-dropdown">
              <div class="ave-dropdown-header">Remote Presentation & POC</div>

              <button class="ave-dropdown-action-btn" (click)="openPopup()">
                <div class="ave-action-title">🪟 Pop-out Clean Feed Window</div>
                <div class="ave-action-sub">Opens borderless reference window for 2nd monitor</div>
              </button>

              <button class="ave-dropdown-action-btn" (click)="copyShareLink()">
                <div class="ave-action-title">
                  {{ copiedSuccess() ? '✅ Link Copied to Clipboard!' : '🔗 Copy Remote Presentation Link' }}
                </div>
                <div class="ave-action-sub">Viewers on other devices stay live in sync</div>
              </button>

              <div class="ave-dropdown-divider"></div>

              <div class="ave-audio-routing-box">
                <span class="ave-audio-routing-label">Audio Output Destination:</span>
                <div class="ave-audio-toggle-group">
                  <button
                    class="ave-audio-toggle-btn"
                    [class.active]="sync.audioDestination() === 'studio'"
                    (click)="setAudio('studio')"
                  >
                    🔊 Studio Tab
                  </button>
                  <button
                    class="ave-audio-toggle-btn"
                    [class.active]="sync.audioDestination() === 'remote'"
                    (click)="setAudio('remote')"
                  >
                    🖥️ Remote / TV
                  </button>
                </div>
              </div>
            </div>
          }
        </div>

        <button class="ave-export-btn" (click)="onExportClick()">
          ⚡ Quick Export
        </button>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 48px;
      background: #0f1019;
      border-bottom: 1px solid #1a1c2a;
      user-select: none;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .ave-header {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
    }

    .ave-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .ave-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ave-logo-badge {
      background: linear-gradient(135deg, #ef4444, #f97316);
      color: #fff;
      font-weight: 800;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }

    .ave-logo-text {
      font-weight: 600;
      font-size: 13px;
      color: #94a3b8;
    }

    .ave-comp-dropdown {
      position: relative;
    }

    .ave-comp-trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #181926;
      border: 1px solid #282a3e;
      border-radius: 6px;
      padding: 5px 12px;
      cursor: pointer;
      color: #f1f5f9;
      font-size: 12px;
      transition: all 0.15s ease;

      &:hover {
        background: #202234;
        border-color: #3b405e;
      }
    }

    .ave-comp-title {
      font-weight: 600;
      color: #f8fafc;
    }

    .ave-comp-badge {
      font-family: monospace;
      font-size: 11px;
      background: #25283d;
      color: #38bdf8;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .ave-chevron {
      font-size: 9px;
      color: #64748b;
    }

    .ave-dropdown-menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      min-width: 260px;
      background: #161722;
      border: 1px solid #282a3e;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      z-index: 50;
      overflow: hidden;
    }

    .ave-dropdown-header {
      padding: 8px 12px;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      border-bottom: 1px solid #232537;
    }

    .ave-dropdown-item {
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      padding: 10px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transition: background 0.15s ease;

      &:hover {
        background: #212335;
      }

      &.active {
        background: #24273d;
        border-left: 3px solid #3b82f6;
      }
    }

    .ave-dropdown-item-title {
      color: #f1f5f9;
      font-size: 12px;
      font-weight: 500;
    }

    .ave-dropdown-item-meta {
      font-size: 11px;
      color: #64748b;
      font-family: monospace;
    }

    .ave-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* Clean Feed Menu */
    .ave-clean-feed-menu-wrapper {
      position: relative;
    }

    .ave-clean-feed-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #181926;
      border: 1px solid #282a3e;
      color: #cbd5e1;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #222538;
        border-color: #3c4263;
        color: #fff;
      }

      &.active {
        border-color: #10b981;
        color: #fff;
      }
    }

    .ave-clean-feed-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #64748b;

      &.live {
        background: #10b981;
        box-shadow: 0 0 6px #10b981;
      }
    }

    .ave-viewers-badge {
      background: #10b981;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 999px;
    }

    .ave-clean-feed-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 290px;
      background: #161722;
      border: 1px solid #282a3e;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      z-index: 50;
      overflow: hidden;
      padding-bottom: 8px;
    }

    .ave-dropdown-action-btn {
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      padding: 10px 14px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 3px;

      &:hover {
        background: #202336;
      }
    }

    .ave-action-title {
      font-size: 12px;
      font-weight: 600;
      color: #f1f5f9;
    }

    .ave-action-sub {
      font-size: 11px;
      color: #64748b;
    }

    .ave-dropdown-divider {
      height: 1px;
      background: #232537;
      margin: 6px 0;
    }

    .ave-audio-routing-box {
      padding: 6px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ave-audio-routing-label {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;
    }

    .ave-audio-toggle-group {
      display: flex;
      gap: 4px;
      background: #10111a;
      padding: 2px;
      border-radius: 6px;
      border: 1px solid #25283c;
    }

    .ave-audio-toggle-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 11px;
      padding: 4px 6px;
      border-radius: 4px;
      cursor: pointer;

      &:hover {
        color: #fff;
      }

      &.active {
        background: #3b82f6;
        color: #fff;
        font-weight: 600;
      }
    }

    .ave-export-btn {
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.15s ease;

      &:hover {
        opacity: 0.9;
      }

      &:active {
        transform: scale(0.98);
      }
    }
  `]
})
export class AveStudioHeaderComponent {
  protected state = inject(StudioStateService);
  protected sync = inject(PresentationSyncService);

  protected isDropdownOpen = signal(false);
  protected isCleanFeedMenuOpen = signal(false);
  protected copiedSuccess = signal(false);

  @Output() exportClick = new EventEmitter<void>();

  toggleDropdown(): void {
    this.isDropdownOpen.set(!this.isDropdownOpen());
    if (this.isDropdownOpen()) this.isCleanFeedMenuOpen.set(false);
  }

  toggleCleanFeedMenu(): void {
    this.isCleanFeedMenuOpen.set(!this.isCleanFeedMenuOpen());
    if (this.isCleanFeedMenuOpen()) this.isDropdownOpen.set(false);
  }

  selectComposition(id: string): void {
    this.state.selectComposition(id);
    this.sync.broadcastComposition(id);
    this.isDropdownOpen.set(false);
  }

  openPopup(): void {
    this.sync.openPopupCleanFeed();
    this.isCleanFeedMenuOpen.set(false);
  }

  async copyShareLink(): Promise<void> {
    const success = await this.sync.copyPresentationUrl();
    if (success) {
      this.copiedSuccess.set(true);
      setTimeout(() => this.copiedSuccess.set(false), 2500);
    }
  }

  setAudio(dest: AudioDestination): void {
    this.sync.setAudioDestination(dest);
  }

  onExportClick(): void {
    this.exportClick.emit();
  }
}
