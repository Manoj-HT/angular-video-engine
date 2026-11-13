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
import { AveAssetLibraryComponent } from './asset-library.component';
import { AveVisualAnimatorComponent } from './visual-animator.component';

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
  imports: [CommonModule, FormsModule, AveAssetLibraryComponent, AveVisualAnimatorComponent],
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

              <!-- Video ID (Unique Identifier) -->
              <div class="ave-comp-prop-field">
                <div class="ave-comp-prop-label-row">
                  <span class="ave-prop-label">Video ID</span>
                  <span class="ave-id-tag">Unique Key</span>
                </div>
                <div class="ave-input-with-affix">
                  <span class="ave-input-prefix">#</span>
                  <input
                    type="text"
                    class="ave-affix-input ave-mono-input"
                    [value]="comp.id"
                    (input)="onIdChange($event)"
                    title="Unique video composition identifier"
                    placeholder="e.g. KineticShowcase"
                  />
                  <button
                    type="button"
                    class="ave-copy-id-btn"
                    (click)="copyToClipboard(comp.id)"
                    title="Copy Video ID"
                  >
                    📋
                  </button>
                </div>
                <span class="ave-field-hint">Unique identifier used for rendering, routing, and CLI</span>
              </div>

              <!-- Title (Composition Name) -->
              <div class="ave-comp-prop-field">
                <div class="ave-comp-prop-label-row">
                  <span class="ave-prop-label">Title</span>
                  <span class="ave-field-sub">Composition Name</span>
                </div>
                <input
                  type="text"
                  class="ave-text-prop-input"
                  [value]="comp.title || comp.id"
                  (input)="onTitleChange($event)"
                  title="Composition display name"
                  placeholder="e.g. Kinetic Motion Showcase"
                />
              </div>

              <!-- Render Name (Output Filename / Render Target) -->
              <div class="ave-comp-prop-field">
                <div class="ave-comp-prop-label-row">
                  <span class="ave-prop-label">Render Name</span>
                  <button
                    type="button"
                    class="ave-sync-title-btn"
                    (click)="syncRenderNameWithTitle()"
                    title="Reset render name to match Title"
                  >
                    ↺ Match Title
                  </button>
                </div>
                <div class="ave-input-with-affix">
                  <input
                    type="text"
                    class="ave-affix-input ave-mono-input"
                    [value]="comp.renderName || comp.title || comp.id"
                    (input)="onRenderNameChange($event)"
                    title="Target render and export output name"
                    placeholder="e.g. kinetic_showcase_final"
                  />
                  <span class="ave-input-suffix">.mp4</span>
                </div>
                <span class="ave-field-hint">Output file name used when rendering & exporting</span>
              </div>

              <!-- Dimensions (Width & Height) -->
              <div class="ave-comp-prop-field">
                <div class="ave-comp-prop-label-row">
                  <span class="ave-prop-label">Dimensions</span>
                  <div class="ave-dim-actions">
                    <span class="ave-aspect-pill">{{ getAspectRatio(comp.width, comp.height) }}</span>
                    <button
                      type="button"
                      class="ave-dim-action-btn"
                      [class.active]="isAspectRatioLocked()"
                      (click)="toggleAspectRatioLock()"
                      [title]="isAspectRatioLocked() ? 'Aspect ratio locked: Width and Height scale together' : 'Lock aspect ratio to scale dimensions proportionally'"
                    >
                      {{ isAspectRatioLocked() ? '🔒' : '🔓' }}
                    </button>
                    <button
                      type="button"
                      class="ave-dim-action-btn"
                      (click)="flipOrientation()"
                      title="Flip Orientation (Swap Width & Height)"
                    >
                      ⇄
                    </button>
                  </div>
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
                  <span class="ave-dim-divider" [class.locked]="isAspectRatioLocked()">
                    {{ isAspectRatioLocked() ? '🔗' : '×' }}
                  </span>
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

              <!-- Duration with frames / seconds / timecode dropdown -->
              <div class="ave-comp-prop-field">
                <div class="ave-comp-prop-label-row">
                  <span class="ave-prop-label">Duration</span>
                  <span class="ave-duration-alt-hint">
                    @if (durationUnit() === 'frames') {
                      ≈ {{ (comp.durationInFrames / comp.fps).toFixed(2) }}s ({{ durationInTimecode() }})
                    } @else if (durationUnit() === 'seconds') {
                      = {{ comp.durationInFrames }} frames ({{ durationInTimecode() }})
                    } @else {
                      = {{ comp.durationInFrames }} frames ({{ (comp.durationInFrames / comp.fps).toFixed(2) }}s)
                    }
                  </span>
                </div>
                <div class="ave-duration-row">
                  @if (durationUnit() === 'timecode') {
                    <input
                      type="text"
                      class="ave-duration-input ave-mono-input"
                      [value]="durationInTimecode()"
                      (input)="onTimecodeChange($event)"
                      (change)="onTimecodeChange($event)"
                      (keydown.enter)="onTimecodeChange($event)"
                      placeholder="00:00:20:00"
                      title="SMPTE Timecode (HH:MM:SS:FF) — Press Enter to apply"
                    />
                  } @else {
                    <input
                      type="number"
                      class="ave-duration-input"
                      [value]="durationUnit() === 'frames' ? comp.durationInFrames : durationInSeconds()"
                      [min]="durationUnit() === 'frames' ? 1 : 0.1"
                      [step]="durationUnit() === 'frames' ? 1 : 0.5"
                      (input)="onDurationValueChange($event)"
                      title="Duration in selected unit"
                    />
                  }
                  <select
                    class="ave-unit-select"
                    [value]="durationUnit()"
                    (change)="onDurationUnitChange($event)"
                    title="Select duration unit (frames, seconds, or SMPTE timecode)"
                  >
                    <option value="frames">Frames</option>
                    <option value="seconds">Seconds</option>
                    <option value="timecode">Timecode (SMPTE)</option>
                  </select>
                </div>
              </div>
            </div>
          }
        } @else if (isAssetLibraryTool()) {
          <ave-asset-library />
        } @else if (isAnimatorTool()) {
          <ave-visual-animator />
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
      width: 340px;
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

    .ave-dim-actions {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .ave-dim-action-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid #282a3e;
      border-radius: 4px;
      color: #94a3b8;
      font-size: 11px;
      padding: 1px 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      line-height: 1.4;

      &:hover {
        background: rgba(255, 255, 255, 0.09);
        color: #f1f5f9;
        border-color: #38bdf8;
      }

      &.active {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border-color: #38bdf8;
      }
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
      transition: color 0.15s ease;

      &.locked {
        font-size: 11px;
        color: #38bdf8;
      }
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

    .ave-dim-input, .ave-affix-input, .ave-fps-input, .ave-duration-input {
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

    .ave-text-prop-input {
      width: 100%;
      background: #10111a;
      border: 1px solid #282a3e;
      border-radius: 6px;
      padding: 6px 10px;
      color: #f1f5f9;
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s ease;

      &:focus {
        border-color: #38bdf8;
      }
    }

    .ave-mono-input {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      font-size: 11px !important;
    }

    .ave-id-tag {
      font-size: 9px;
      font-weight: 700;
      color: #a78bfa;
      background: rgba(167, 139, 250, 0.12);
      border: 1px solid rgba(167, 139, 250, 0.3);
      padding: 1px 5px;
      border-radius: 4px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }

    .ave-field-sub {
      font-size: 10px;
      color: #64748b;
    }

    .ave-field-hint {
      font-size: 10px;
      color: #64748b;
      line-height: 1.3;
      margin-top: 2px;
    }

    .ave-sync-title-btn {
      background: transparent;
      border: none;
      color: #38bdf8;
      font-size: 10px;
      cursor: pointer;
      padding: 1px 4px;
      border-radius: 3px;
      transition: opacity 0.15s ease;

      &:hover {
        opacity: 0.8;
        text-decoration: underline;
      }
    }

    .ave-copy-id-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 11px;
      padding: 2px 4px;
      border-radius: 3px;
      opacity: 0.6;
      transition: opacity 0.15s ease;

      &:hover {
        opacity: 1;
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
      name: 'Asset Library',
      icon: '📁',
      description: 'Grid & list media library, folder management, and drag-and-drop file upload',
      category: 'Media',
      ready: true
    },
    {
      id: 'animator',
      name: 'Visual Animator & Styler',
      icon: '✨',
      description: 'Hierarchical DOM inspector to visually write CSS and frame-accurate aveAnimate directives',
      category: 'Animation',
      ready: true
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

  // Duration unit toggle: 'frames' | 'seconds' | 'timecode'
  readonly durationUnit = signal<'frames' | 'seconds' | 'timecode'>('frames');

  // Computed duration in seconds
  readonly durationInSeconds = computed<number>(() => {
    const comp = this.state.activeComposition();
    if (!comp || comp.fps <= 0) return 0;
    return Number((comp.durationInFrames / comp.fps).toFixed(2));
  });

  // Computed duration in SMPTE timecode (HH:MM:SS:FF)
  readonly durationInTimecode = computed<string>(() => {
    const comp = this.state.activeComposition();
    if (!comp || comp.fps <= 0) return '00:00:00:00';
    return this.framesToTimecode(comp.durationInFrames, comp.fps);
  });

  // Pro Aspect Ratio Lock & Orientation Flip
  readonly isAspectRatioLocked = signal<boolean>(false);
  private lockedRatio: number | null = null;

  toggleAspectRatioLock(): void {
    const nextLocked = !this.isAspectRatioLocked();
    this.isAspectRatioLocked.set(nextLocked);
    if (nextLocked) {
      const comp = this.state.activeComposition();
      if (comp && comp.height > 0) {
        this.lockedRatio = comp.width / comp.height;
      }
    } else {
      this.lockedRatio = null;
    }
  }

  flipOrientation(): void {
    const comp = this.state.activeComposition();
    if (!comp) return;
    const newWidth = comp.height;
    const newHeight = comp.width;
    if (this.isAspectRatioLocked() && newHeight > 0) {
      this.lockedRatio = newWidth / newHeight;
    }
    this.state.updateCompositionDetails({ width: newWidth, height: newHeight });
  }

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

  isAssetLibraryTool(): boolean {
    return this.state.activeTool() === 'assets';
  }

  isAnimatorTool(): boolean {
    return this.state.activeTool() === 'animator';
  }

  selectTool(toolId: string): void {
    this.state.selectTool(toolId);
    this.searchQuery.set('');
  }

  onIdChange(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const cleanId = raw.replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleanId) {
      this.state.updateCompositionDetails({ id: cleanId });
    }
  }

  onTitleChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const comp = this.state.activeComposition();
    const currentRender = comp?.renderName;
    const currentTitle = comp?.title;

    // If renderName is empty or equals previous title, sync renderName with title
    const shouldSyncRender = !currentRender || currentRender === currentTitle;

    this.state.updateCompositionDetails({
      title: val,
      ...(shouldSyncRender ? { renderName: val } : {})
    });
  }

  onRenderNameChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.state.updateCompositionDetails({ renderName: val });
  }

  syncRenderNameWithTitle(): void {
    const comp = this.state.activeComposition();
    if (!comp) return;
    const title = comp.title || comp.id;
    this.state.updateCompositionDetails({ renderName: title });
  }

  copyToClipboard(text: string): void {
    navigator.clipboard?.writeText(text);
  }

  onDimensionChange(dimension: 'width' | 'height', event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    if (isNaN(val) || val < 16 || val > 7680) return;

    if (this.isAspectRatioLocked()) {
      const comp = this.state.activeComposition();
      const ratio = this.lockedRatio ?? (comp && comp.height > 0 ? comp.width / comp.height : 16 / 9);
      if (dimension === 'width') {
        const pairedHeight = Math.max(16, Math.min(7680, Math.round(val / ratio)));
        this.state.updateCompositionDetails({ width: val, height: pairedHeight });
      } else {
        const pairedWidth = Math.max(16, Math.min(7680, Math.round(val * ratio)));
        this.state.updateCompositionDetails({ width: pairedWidth, height: val });
      }
    } else {
      this.state.updateCompositionDetails({ [dimension]: val });
    }
  }

  applyResolution(width: number, height: number): void {
    if (this.isAspectRatioLocked() && height > 0) {
      this.lockedRatio = width / height;
    }
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
    const unit = (event.target as HTMLSelectElement).value as 'frames' | 'seconds' | 'timecode';
    this.durationUnit.set(unit);
  }

  framesToTimecode(frames: number, fps: number): string {
    if (fps <= 0 || frames < 0) return '00:00:00:00';
    const totalSeconds = Math.floor(frames / fps);
    const f = Math.floor(frames % fps);
    const s = Math.floor(totalSeconds % 60);
    const m = Math.floor((totalSeconds / 60) % 60);
    const h = Math.floor(totalSeconds / 3600);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
  }

  timecodeToFrames(tc: string, fps: number): number | null {
    if (!tc || !tc.trim()) return null;
    const parts = tc.trim().split(':').map(p => parseInt(p, 10));
    if (parts.some(p => isNaN(p) || p < 0)) return null;

    let h = 0, m = 0, s = 0, f = 0;
    if (parts.length === 4) {
      [h, m, s, f] = parts;
    } else if (parts.length === 3) {
      [m, s, f] = parts;
    } else if (parts.length === 2) {
      [s, f] = parts;
    } else if (parts.length === 1) {
      return parts[0];
    } else {
      return null;
    }

    const totalSeconds = h * 3600 + m * 60 + s;
    return Math.max(1, Math.round(totalSeconds * fps + f));
  }

  onTimecodeChange(event: Event): void {
    const comp = this.state.activeComposition();
    if (!comp) return;
    const raw = (event.target as HTMLInputElement).value;
    const parsedFrames = this.timecodeToFrames(raw, comp.fps);
    if (parsedFrames !== null) {
      this.state.updateCompositionDetails({ durationInFrames: parsedFrames });
    }
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
