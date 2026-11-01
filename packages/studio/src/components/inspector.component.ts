import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudioStateService } from '../services/studio-state.service';
import { RootFrameService } from '@angular-video/core';

@Component({
  selector: 'ave-inspector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ave-inspector-panel">
      <!-- Panel Header -->
      <div class="ave-inspector-header">
        <h3 class="ave-inspector-title">Properties & Inspector</h3>
        <button class="ave-close-btn" (click)="state.toggleDrawer()" title="Close Drawer">
          ✕
        </button>
      </div>

      <!-- Composition Metadata Card -->
      @if (state.activeComposition(); as comp) {
        <div class="ave-section">
          <div class="ave-section-title">Composition Details</div>
          <div class="ave-meta-grid">
            <div class="ave-meta-item">
              <span class="ave-meta-label">Dimensions</span>
              <span class="ave-meta-val">{{ comp.width }} × {{ comp.height }}</span>
            </div>
            <div class="ave-meta-item">
              <span class="ave-meta-label">FPS</span>
              <span class="ave-meta-val">{{ comp.fps }}</span>
            </div>
            <div class="ave-meta-item">
              <span class="ave-meta-label">Duration</span>
              <span class="ave-meta-val">{{ comp.durationInFrames }} frames ({{ (comp.durationInFrames / comp.fps).toFixed(1) }}s)</span>
            </div>
          </div>
        </div>

        <!-- Dynamic Schema Props Inspector -->
        <div class="ave-section">
          <div class="ave-section-title">Component Props</div>
          
          @if (propKeys().length === 0) {
            <p class="ave-empty-hint">No defaultProps declared on this composition.</p>
          } @else {
            <div class="ave-props-form">
              @for (key of propKeys(); track key) {
                <div class="ave-form-row">
                  <label class="ave-label">{{ key }}</label>
                  
                  @switch (getPropType(key)) {
                    @case ('color') {
                      <div class="ave-color-input-wrapper">
                        <input
                          type="color"
                          class="ave-color-picker"
                          [value]="asString(state.activeProps()[key])"
                          (input)="onPropInput(key, $event)"
                        />
                        <span class="ave-color-text">{{ state.activeProps()[key] }}</span>
                      </div>
                    }
                    @case ('boolean') {
                      <input
                        type="checkbox"
                        class="ave-checkbox"
                        [checked]="!!state.activeProps()[key]"
                        (change)="onCheckboxChange(key, $event)"
                      />
                    }
                    @case ('number') {
                      <input
                        type="number"
                        class="ave-text-input ave-number-input"
                        [value]="state.activeProps()[key]"
                        (input)="onNumberInput(key, $event)"
                      />
                    }
                    @default {
                      <input
                        type="text"
                        class="ave-text-input"
                        [value]="state.activeProps()[key]"
                        (input)="onPropInput(key, $event)"
                      />
                    }
                  }
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
      width: 320px;
      height: 100%;
      background: #12131d;
      border-left: 1px solid #1f2233;
      user-select: none;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .ave-inspector-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 16px;
      gap: 16px;
    }

    .ave-inspector-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e2030;
      padding-bottom: 12px;
    }

    .ave-inspector-title {
      font-size: 14px;
      font-weight: 600;
      color: #f1f5f9;
      margin: 0;
    }

    .ave-close-btn {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 14px;
      padding: 4px;

      &:hover {
        color: #fff;
      }
    }

    .ave-section {
      background: #181926;
      border: 1px solid #23263a;
      border-radius: 8px;
      padding: 12px;
    }

    .ave-section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
      color: #94a3b8;
      margin-bottom: 10px;
    }

    .ave-meta-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ave-meta-item {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }

    .ave-meta-label {
      color: #64748b;
    }

    .ave-meta-val {
      color: #e2e8f0;
      font-family: monospace;
      font-weight: 500;
    }

    .ave-props-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .ave-form-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ave-label {
      font-size: 12px;
      color: #cbd5e1;
    }

    .ave-text-input {
      background: #10111a;
      border: 1px solid #282a3e;
      border-radius: 6px;
      padding: 6px 10px;
      color: #fff;
      font-size: 12px;
      outline: none;

      &:focus {
        border-color: #3b82f6;
      }
    }

    .ave-color-input-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ave-color-picker {
      border: none;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      cursor: pointer;
      background: transparent;
    }

    .ave-color-text {
      font-family: monospace;
      font-size: 12px;
      color: #94a3b8;
    }

    .ave-checkbox {
      width: 16px;
      height: 16px;
      accent-color: #3b82f6;
      cursor: pointer;
    }

    .ave-empty-hint {
      font-size: 12px;
      color: #64748b;
      margin: 0;
      font-style: italic;
    }
  `]
})
export class AveInspectorComponent {
  protected state = inject(StudioStateService);
  protected frameService = inject(RootFrameService);

  readonly propKeys = computed<string[]>(() => {
    return Object.keys(this.state.activeProps());
  });

  getPropType(key: string): 'color' | 'boolean' | 'number' | 'string' {
    const val = this.state.activeProps()[key];
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'number') return 'number';
    if (typeof val === 'string') {
      if (val.startsWith('#') || key.toLowerCase().includes('color')) {
        return 'color';
      }
    }
    return 'string';
  }

  asString(val: unknown): string {
    return typeof val === 'string' ? val : '#ffffff';
  }

  onPropInput(key: string, e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.state.updateProp(key, val);
  }

  onNumberInput(key: string, e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(val)) {
      this.state.updateProp(key, val);
    }
  }

  onCheckboxChange(key: string, e: Event): void {
    const val = (e.target as HTMLInputElement).checked;
    this.state.updateProp(key, val);
  }
}
