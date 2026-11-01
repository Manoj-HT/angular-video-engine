import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudioStateService } from '../services/studio-state.service';

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

      <!-- Right: Action Buttons (Quick Export, GitHub link) -->
      <div class="ave-header-right">
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
  protected isDropdownOpen = signal(false);

  @Output() exportClick = new EventEmitter<void>();

  toggleDropdown(): void {
    this.isDropdownOpen.set(!this.isDropdownOpen());
  }

  selectComposition(id: string): void {
    this.state.selectComposition(id);
    this.isDropdownOpen.set(false);
  }

  onExportClick(): void {
    this.exportClick.emit();
  }
}
