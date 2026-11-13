import {
  Component,
  computed,
  inject,
  signal,
  effect,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudioStateService } from '../services/studio-state.service';
import { RootFrameService } from '@angular-video/core';

export interface StudioToolItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  ready: boolean;
}

@Component({
  selector: 'ave-inspector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ave-inspector-panel">
      <!-- Searchable Tools List View -->
      @if (state.isToolsSearchOpen()) {
        <div class="ave-tools-list-view">
          <!-- Tools Search Header -->
          <div class="ave-tools-search-bar">
            <span class="ave-search-lens">🔍</span>
            <input
              #toolsSearchInput
              type="text"
              class="ave-tools-search-input"
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event.target).value)"
              placeholder="Search tools... (Shift+T)"
              (keydown.escape)="state.closeToolsList()"
            />
            @if (searchQuery()) {
              <button
                class="ave-search-clear-btn"
                (click)="searchQuery.set('')"
                title="Clear query"
              >
                ✕
              </button>
            }
            <button
              class="ave-chevron-up-btn"
              (click)="state.closeToolsList()"
              title="Return to active tool (Esc)"
            >
              ▲
            </button>
          </div>

          <div class="ave-tools-meta-row">
            <span class="ave-tools-count-badge">Available Tools ({{ filteredTools().length }})</span>
            <span class="ave-tools-kbd-hint">Esc to return</span>
          </div>

          <!-- Tools Scrollable List -->
          <div class="ave-tools-scroll-list">
            @for (tool of filteredTools(); track tool.id) {
              <div
                class="ave-tool-item"
                [class.active]="state.activeTool() === tool.id"
                (click)="selectTool(tool.id)"
              >
                <div class="ave-tool-item-icon">{{ tool.icon }}</div>
                <div class="ave-tool-item-info">
                  <div class="ave-tool-item-top">
                    <span class="ave-tool-item-name">{{ tool.name }}</span>
                    @if (state.activeTool() === tool.id) {
                      <span class="ave-tag ave-tag-active">Active</span>
                    } @else if (tool.ready) {
                      <span class="ave-tag ave-tag-ready">Ready</span>
                    } @else {
                      <span class="ave-tag ave-tag-planned">Tool</span>
                    }
                  </div>
                  <p class="ave-tool-item-desc">{{ tool.description }}</p>
                </div>
              </div>
            }

            @if (filteredTools().length === 0) {
              <div class="ave-tools-empty-state">
                <span class="ave-tools-empty-icon">🔎</span>
                <p>No tools matching "{{ searchQuery() }}"</p>
                <button class="ave-btn ave-btn-subtle" (click)="searchQuery.set('')">Reset Search</button>
              </div>
            }
          </div>
        </div>
      } @else {
        <!-- Active Tool View Header with Tool Switcher -->
        <div class="ave-inspector-header">
          <button
            class="ave-tool-switch-btn"
            (click)="state.toggleToolsList()"
            title="Browse all tools (Shift+T)"
          >
            <span class="ave-tool-badge-icon">{{ currentTool().icon }}</span>
            <h3 class="ave-inspector-title">{{ currentTool().name }}</h3>
            <span class="ave-tool-chevron">▼</span>
          </button>
        </div>

        @if (isPropertiesTool()) {
          <!-- Composition Metadata Card: Video Properties -->
          @if (state.activeComposition(); as comp) {
            <div class="ave-section">
              <div class="ave-section-header-row">
                <div class="ave-section-title">Video Properties</div>
                @if (state.saveStatus() === 'saving') {
                  <span class="ave-save-badge ave-save-saving" title="Saving changes directly to video composition file">
                    <span class="ave-spin-dot">●</span> Saving...
                  </span>
                } @else if (state.saveStatus() === 'saved') {
                  <span class="ave-save-badge ave-save-saved" title="Changes synced directly into code">
                    ✓ Synced to code
                  </span>
                } @else if (state.saveStatus() === 'error') {
                  <span class="ave-save-badge ave-save-error" title="Failed to write to file">
                    ⚠️ Error saving
                  </span>
                }
              </div>

              <!-- Dimensions (Width & Height) -->
              <div class="ave-comp-prop-field">
                <div class="ave-comp-prop-label-row">
                  <span class="ave-prop-label">Dimensions</span>
                  <span class="ave-aspect-pill">{{ getAspectRatio(comp.width, comp.height) }}</span>
                </div>
                <div class="ave-dimensions-grid">
                  <div class="ave-input-with-affix">
                    <span class="ave-input-prefix">W</span>
                    <input
                      type="number"
                      class="ave-dim-input"
                      [value]="comp.width"
                      min="16"
                      max="7680"
                      step="2"
                      (input)="onDimensionChange('width', $event)"
                      title="Width in pixels"
                    />
                    <span class="ave-input-suffix">px</span>
                  </div>
                  <span class="ave-dim-divider">×</span>
                  <div class="ave-input-with-affix">
                    <span class="ave-input-prefix">H</span>
                    <input
                      type="number"
                      class="ave-dim-input"
                      [value]="comp.height"
                      min="16"
                      max="7680"
                      step="2"
                      (input)="onDimensionChange('height', $event)"
                      title="Height in pixels"
                    />
                    <span class="ave-input-suffix">px</span>
                  </div>
                </div>
                <!-- Quick Preset Pills -->
                <div class="ave-preset-pills">
                  <button type="button" class="ave-pill-btn" [class.active]="comp.width === 1920 && comp.height === 1080" (click)="applyResolution(1920, 1080)">1080p</button>
                  <button type="button" class="ave-pill-btn" [class.active]="comp.width === 3840 && comp.height === 2160" (click)="applyResolution(3840, 2160)">4K</button>
                  <button type="button" class="ave-pill-btn" [class.active]="comp.width === 1080 && comp.height === 1920" (click)="applyResolution(1080, 1920)">9:16 Reel</button>
                  <button type="button" class="ave-pill-btn" [class.active]="comp.width === 1080 && comp.height === 1080" (click)="applyResolution(1080, 1080)">1:1 Square</button>
                </div>
              </div>

              <!-- FPS (Frame Rate) -->
              <div class="ave-comp-prop-field">
                <div class="ave-comp-prop-label-row">
                  <span class="ave-prop-label">Frame Rate (FPS)</span>
                  <span class="ave-fps-hint">{{ (1000 / comp.fps).toFixed(1) }}ms / frame</span>
                </div>
                <div class="ave-fps-row">
                  <input
                    type="number"
                    class="ave-fps-input"
                    [value]="comp.fps"
                    min="1"
                    max="120"
                    step="1"
                    (input)="onFpsChange($event)"
                    title="Frames per second"
                  />
                  <div class="ave-preset-pills">
                    <button type="button" class="ave-pill-btn" [class.active]="comp.fps === 24" (click)="applyFps(24)">24</button>
                    <button type="button" class="ave-pill-btn" [class.active]="comp.fps === 30" (click)="applyFps(30)">30</button>
                    <button type="button" class="ave-pill-btn" [class.active]="comp.fps === 60" (click)="applyFps(60)">60</button>
                  </div>
                </div>
              </div>

              <!-- Duration with frames / seconds dropdown -->
              <div class="ave-comp-prop-field">
                <div class="ave-comp-prop-label-row">
                  <span class="ave-prop-label">Duration</span>
                  <span class="ave-duration-alt-hint">
                    @if (durationUnit() === 'frames') {
                      ≈ {{ (comp.durationInFrames / comp.fps).toFixed(2) }}s
                    } @else {
                      = {{ comp.durationInFrames }} frames
                    }
                  </span>
                </div>
                <div class="ave-duration-row">
                  <input
                    type="number"
                    class="ave-duration-input"
                    [value]="durationUnit() === 'frames' ? comp.durationInFrames : durationInSeconds()"
                    [min]="durationUnit() === 'frames' ? 1 : 0.1"
                    [step]="durationUnit() === 'frames' ? 1 : 0.5"
                    (input)="onDurationValueChange($event)"
                    title="Duration in selected unit"
                  />
                  <select
                    class="ave-unit-select"
                    [value]="durationUnit()"
                    (change)="onDurationUnitChange($event)"
                    title="Select duration unit (frames or seconds)"
                  >
                    <option value="frames">Frames</option>
                    <option value="seconds">Seconds</option>
                  </select>
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
        } @else {
          <!-- Tool Placeholder Card for tools to be implemented (e.g. AI) -->
          <div class="ave-tool-placeholder-card">
            <div class="ave-tool-placeholder-icon">{{ currentTool().icon }}</div>
            <h4 class="ave-tool-placeholder-title">{{ currentTool().name }}</h4>
            <p class="ave-tool-placeholder-desc">{{ currentTool().description }}</p>
            <div class="ave-tool-placeholder-status">
              <span class="ave-tag ave-tag-planned">Tool Ready Soon</span>
              <button class="ave-btn-subtle ave-tool-back-btn" (click)="state.selectTool('videoProperties')">
                Back to Video Properties
              </button>
            </div>
          </div>
        }
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
      scrollbar-width: thin;
      scrollbar-color: #272c44 #12131d;

      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: #12131d;
      }
      &::-webkit-scrollbar-thumb {
        background: #272c44;
        border-radius: 4px;

        &:hover {
          background-color: #3e466d;
        }

        &:active {
          background-color: #06b6d4;
        }
      }
    }

    /* Inspector Header with Tool Switcher */
    .ave-inspector-header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      border-bottom: 1px solid #1e2030;
      padding-bottom: 10px;
    }

    .ave-tool-switch-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid #23263a;
      border-radius: 8px;
      padding: 6px 12px;
      cursor: pointer;
      color: #f1f5f9;
      transition: all 0.15s ease;
      width: 100%;
      justify-content: space-between;

      &:hover {
        background: rgba(255, 255, 255, 0.07);
        border-color: #38bdf8;

        .ave-tool-chevron {
          color: #38bdf8;
          transform: translateY(1px);
        }
      }
    }

    .ave-tool-badge-icon {
      font-size: 14px;
    }

    .ave-inspector-title {
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
      margin: 0;
      flex: 1;
      text-align: left;
      margin-left: 4px;
    }

    .ave-tool-chevron {
      font-size: 10px;
      color: #64748b;
      transition: transform 0.15s ease, color 0.15s ease;
    }

    /* Searchable Tools List View */
    .ave-tools-list-view {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
    }

    .ave-tools-search-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #10111a;
      border: 1px solid #282a3e;
      border-radius: 8px;
      padding: 6px 10px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;

      &:focus-within {
        border-color: #38bdf8;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.15);
      }
    }

    .ave-search-lens {
      font-size: 13px;
      color: #64748b;
    }

    .ave-tools-search-input {
      flex: 1;
      background: transparent;
      border: none;
      color: #fff;
      font-size: 12px;
      outline: none;
      padding: 2px 0;

      &::placeholder {
        color: #64748b;
      }
    }

    .ave-search-clear-btn {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 12px;
      padding: 2px 6px;

      &:hover {
        color: #fff;
      }
    }

    .ave-chevron-up-btn {
      background: #181926;
      border: 1px solid #2d3148;
      border-radius: 4px;
      color: #94a3b8;
      cursor: pointer;
      font-size: 10px;
      padding: 4px 6px;
      transition: all 0.15s ease;

      &:hover {
        background: #25283d;
        color: #38bdf8;
      }
    }

    .ave-tools-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
      padding: 0 2px;
    }

    .ave-tools-count-badge {
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 10px;
    }

    .ave-tools-kbd-hint {
      font-size: 10px;
      background: #181926;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #282a3e;
      color: #64748b;
    }

    .ave-tools-scroll-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      padding-right: 2px;
    }

    .ave-tool-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #161724;
      border: 1px solid #23263a;
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #1c1e30;
        border-color: #38bdf8;
        transform: translateY(-1px);
      }

      &.active {
        border-color: #06b6d4;
        background: rgba(6, 182, 212, 0.08);
      }
    }

    .ave-tool-item-icon {
      font-size: 20px;
      line-height: 1;
      padding-top: 2px;
    }

    .ave-tool-item-info {
      flex: 1;
      min-width: 0;
    }

    .ave-tool-item-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 3px;
    }

    .ave-tool-item-name {
      font-size: 12px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ave-tool-item-desc {
      font-size: 11px;
      color: #64748b;
      line-height: 1.35;
      margin: 0;
    }

    .ave-tag {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 1px 5px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }

    .ave-tag-active {
      background: rgba(6, 182, 212, 0.2);
      color: #06b6d4;
      border: 1px solid rgba(6, 182, 212, 0.4);
    }

    .ave-tag-ready {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .ave-tag-planned {
      background: rgba(148, 163, 184, 0.1);
      color: #94a3b8;
      border: 1px solid rgba(148, 163, 184, 0.2);
    }

    .ave-tools-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px 16px;
      text-align: center;
      color: #64748b;
      font-size: 12px;
      gap: 8px;
    }

    .ave-tools-empty-icon {
      font-size: 28px;
    }

    .ave-btn-subtle {
      background: #1e2030;
      border: 1px solid #2d3148;
      color: #94a3b8;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;

      &:hover {
        background: #282a3e;
        color: #fff;
      }
    }

    /* Tool Placeholder Card */
    .ave-tool-placeholder-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 36px 16px;
      background: #181926;
      border: 1px solid #23263a;
      border-radius: 8px;
      gap: 12px;
    }

    .ave-tool-placeholder-icon {
      font-size: 38px;
      line-height: 1;
    }

    .ave-tool-placeholder-title {
      font-size: 15px;
      font-weight: 700;
      color: #f1f5f9;
      margin: 0;
    }

    .ave-tool-placeholder-desc {
      font-size: 12px;
      color: #94a3b8;
      max-width: 260px;
      line-height: 1.5;
      margin: 0;
    }

    .ave-tool-placeholder-status {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin-top: 6px;
    }

    .ave-tool-back-btn {
      margin-top: 4px;
      padding: 6px 14px;
    }

    /* Inspector Sections */
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
      margin: 0;
    }

    /* Section Header with Save Status */
    .ave-section-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .ave-save-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      letter-spacing: 0.3px;
    }

    .ave-save-saving {
      background: rgba(234, 179, 8, 0.15);
      color: #eab308;
      border: 1px solid rgba(234, 179, 8, 0.3);

      .ave-spin-dot {
        display: inline-block;
        animation: avePulse 0.8s infinite alternate;
      }
    }

    .ave-save-saved {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .ave-save-error {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    @keyframes avePulse {
      0% { opacity: 0.3; transform: scale(0.8); }
      100% { opacity: 1; transform: scale(1.2); }
    }

    /* Video Properties Fields */
    .ave-comp-prop-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;

      &:last-child {
        margin-bottom: 2px;
      }
    }

    .ave-comp-prop-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ave-prop-label {
      font-size: 11px;
      font-weight: 600;
      color: #cbd5e1;
    }

    .ave-aspect-pill {
      font-size: 10px;
      font-weight: 700;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.25);
      padding: 1px 6px;
      border-radius: 4px;
    }

    .ave-dimensions-grid {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ave-dim-divider {
      color: #64748b;
      font-size: 12px;
      font-weight: bold;
    }

    .ave-input-with-affix {
      flex: 1;
      display: flex;
      align-items: center;
      background: #10111a;
      border: 1px solid #282a3e;
      border-radius: 6px;
      padding: 3px 8px;
      transition: border-color 0.15s ease;

      &:focus-within {
        border-color: #38bdf8;
      }
    }

    .ave-input-prefix {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      margin-right: 4px;
      user-select: none;
    }

    .ave-input-suffix {
      font-size: 10px;
      color: #64748b;
      margin-left: 2px;
      user-select: none;
    }

    .ave-dim-input, .ave-fps-input, .ave-duration-input {
      flex: 1;
      width: 100%;
      background: transparent;
      border: none;
      color: #f1f5f9;
      font-size: 12px;
      font-family: inherit;
      outline: none;
      padding: 2px 0;
      min-width: 0;

      &::-webkit-inner-spin-button,
      &::-webkit-outer-spin-button {
        opacity: 0.5;
      }
    }

    .ave-preset-pills {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      margin-top: 2px;
    }

    .ave-pill-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid #23263a;
      border-radius: 4px;
      color: #94a3b8;
      font-size: 10px;
      padding: 2px 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.09);
        color: #f1f5f9;
        border-color: #38bdf8;
      }

      &.active {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border-color: #38bdf8;
        font-weight: 600;
      }
    }

    .ave-fps-row {
      display: flex;
      align-items: center;
      gap: 8px;

      .ave-fps-input {
        width: 68px;
        flex: 0 0 68px;
        background: #10111a;
        border: 1px solid #282a3e;
        border-radius: 6px;
        padding: 4px 8px;
        color: #f1f5f9;
        font-size: 12px;

        &:focus {
          border-color: #38bdf8;
        }
      }
    }

    .ave-fps-hint, .ave-duration-alt-hint {
      font-size: 10px;
      color: #64748b;
    }

    .ave-duration-row {
      display: flex;
      align-items: center;
      gap: 6px;

      .ave-duration-input {
        flex: 1;
        background: #10111a;
        border: 1px solid #282a3e;
        border-radius: 6px;
        padding: 4px 8px;
        color: #f1f5f9;
        font-size: 12px;

        &:focus {
          border-color: #38bdf8;
        }
      }

      .ave-unit-select {
        background: #181926;
        border: 1px solid #282a3e;
        border-radius: 6px;
        color: #f1f5f9;
        font-size: 11px;
        padding: 5px 8px;
        outline: none;
        cursor: pointer;

        &:focus {
          border-color: #38bdf8;
        }
      }
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

  @ViewChild('toolsSearchInput') toolsSearchInput?: ElementRef<HTMLInputElement>;

  readonly searchQuery = signal<string>('');

  // Raw list of registered studio tools (can be added in any order)
  readonly rawTools: StudioToolItem[] = [
    {
      id: 'ai',
      name: 'AI',
      icon: '🤖',
      description: 'Connect with AI to code components and do native AI video creation',
      category: 'AI',
      ready: false
    },
    {
      id: 'videoProperties',
      name: 'Video Properties',
      icon: '⚙️',
      description: 'Composition dimensions, FPS, duration, and dynamic component properties',
      category: 'Core',
      ready: true
    },
    {
      id: 'curves',
      name: 'Keyframe Curves & Graph Editor',
      icon: '📈',
      description: 'Fine-tune cubic bezier timing, spring damping, stiffness, and mass dynamics',
      category: 'Motion',
      ready: false
    },
    {
      id: 'typography',
      name: 'Kinetic Typography Styler',
      icon: '🔤',
      description: 'Variable fonts, tracking, text shadows, and staggered split-text animations',
      category: 'Styling',
      ready: false
    },
    {
      id: 'colors',
      name: 'Color Palette & LUT Grading',
      icon: '🎨',
      description: 'Theme harmonies, hex palette generator, gradient editor, and CSS filter LUTs',
      category: 'Styling',
      ready: false
    },
    {
      id: 'audioMixer',
      name: 'Multi-Track Audio Mixer',
      icon: '🎚️',
      description: 'Volume levels, stereo panning, waveform visualizer, and echo guard routing',
      category: 'Media',
      ready: false
    },
    {
      id: 'assets',
      name: 'Asset Gate & Media Library',
      icon: '📁',
      description: 'Preload readiness gate, audio soundtracks, SVG vectors, and video clips',
      category: 'Media',
      ready: false
    },
    {
      id: 'telemetry',
      name: 'Performance & Telemetry',
      icon: '⚡',
      description: 'Zoneless signal update benchmarks, RAF frame budget, and memory telemetry',
      category: 'Diagnostics',
      ready: false
    },
    {
      id: 'export',
      name: 'Export & Cloud Renderer',
      icon: '🎬',
      description: 'Batch headless Chromium render queue, bitrate, codec, and MP4/WebM output',
      category: 'Output',
      ready: false
    }
  ];

  // Guaranteed unique via Set and automatically ordered alphabetically by tool name
  readonly tools: StudioToolItem[] = Array.from(new Set(this.rawTools)).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  // Filtered tools with Set applied on the resulting array and sorted alphabetically
  readonly filteredTools = computed<StudioToolItem[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) {
      return Array.from(new Set(this.tools)).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
    }
    const matches = this.tools.filter(t =>
      t.id.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (q === 'props' && (t.id === 'videoProperties' || t.name === 'Video Properties')) ||
      (q === 'inspector' && (t.id === 'videoProperties' || t.name === 'Video Properties'))
    );
    return Array.from(new Set(matches)).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  });

  // Currently active tool item metadata
  readonly currentTool = computed<StudioToolItem>(() => {
    const id = this.state.activeTool();
    return this.tools.find(t => t.id === id) ??
      (id === 'inspector' ? this.tools.find(t => t.id === 'videoProperties') : null) ??
      this.tools.find(t => t.id === 'videoProperties') ??
      this.tools[0];
  });

  readonly propKeys = computed<string[]>(() => {
    return Object.keys(this.state.activeProps());
  });

  // Duration unit toggle: 'frames' | 'seconds'
  readonly durationUnit = signal<'frames' | 'seconds'>('frames');

  // Computed duration in seconds
  readonly durationInSeconds = computed<number>(() => {
    const comp = this.state.activeComposition();
    if (!comp || comp.fps <= 0) return 0;
    return Number((comp.durationInFrames / comp.fps).toFixed(2));
  });

  constructor() {
    effect(() => {
      if (this.state.isToolsSearchOpen()) {
        setTimeout(() => {
          this.toolsSearchInput?.nativeElement?.focus();
          this.toolsSearchInput?.nativeElement?.select();
        }, 50);
      }
    });
  }

  isPropertiesTool(): boolean {
    const id = this.state.activeTool();
    return id === 'videoProperties' || id === 'inspector';
  }

  selectTool(toolId: string): void {
    this.state.selectTool(toolId);
    this.searchQuery.set('');
  }

  onDimensionChange(dimension: 'width' | 'height', event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(val) && val >= 16 && val <= 7680) {
      this.state.updateCompositionDetails({ [dimension]: val });
    }
  }

  applyResolution(width: number, height: number): void {
    this.state.updateCompositionDetails({ width, height });
  }

  onFpsChange(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(val) && val >= 1 && val <= 120) {
      this.state.updateCompositionDetails({ fps: val });
    }
  }

  applyFps(fps: number): void {
    this.state.updateCompositionDetails({ fps });
  }

  onDurationUnitChange(event: Event): void {
    const unit = (event.target as HTMLSelectElement).value as 'frames' | 'seconds';
    this.durationUnit.set(unit);
  }

  onDurationValueChange(event: Event): void {
    const comp = this.state.activeComposition();
    if (!comp) return;
    const raw = parseFloat((event.target as HTMLInputElement).value);
    if (isNaN(raw) || raw <= 0) return;

    if (this.durationUnit() === 'frames') {
      const frames = Math.max(1, Math.round(raw));
      this.state.updateCompositionDetails({ durationInFrames: frames });
    } else {
      const frames = Math.max(1, Math.round(raw * comp.fps));
      this.state.updateCompositionDetails({ durationInFrames: frames });
    }
  }

  getAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const wRatio = width / divisor;
    const hRatio = height / divisor;
    if (
      (wRatio === 16 && hRatio === 9) ||
      (wRatio === 9 && hRatio === 16) ||
      (wRatio === 1 && hRatio === 1) ||
      (wRatio === 4 && hRatio === 3)
    ) {
      return `${wRatio}:${hRatio}`;
    }
    return `${(width / height).toFixed(2)}:1`;
  }

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
