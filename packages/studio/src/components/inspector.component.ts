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

        @if (state.activeTool() === 'inspector') {
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
        } @else {
          <!-- Tool Placeholder Card for tools to be implemented (e.g. AI) -->
          <div class="ave-tool-placeholder-card">
            <div class="ave-tool-placeholder-icon">{{ currentTool().icon }}</div>
            <h4 class="ave-tool-placeholder-title">{{ currentTool().name }}</h4>
            <p class="ave-tool-placeholder-desc">{{ currentTool().description }}</p>
            <div class="ave-tool-placeholder-status">
              <span class="ave-tag ave-tag-planned">Tool Ready Soon</span>
              <button class="ave-btn-subtle ave-tool-back-btn" (click)="state.selectTool('inspector')">
                Back to Inspector
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
      id: 'inspector',
      name: 'Properties & Inspector',
      icon: '⚙️',
      description: 'Composition schema props, dimensions, FPS, and dynamic component properties',
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
      t.category.toLowerCase().includes(q)
    );
    return Array.from(new Set(matches)).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  });

  // Currently active tool item metadata
  readonly currentTool = computed<StudioToolItem>(() => {
    const id = this.state.activeTool();
    return this.tools.find(t => t.id === id) ?? this.tools.find(t => t.id === 'inspector') ?? this.tools[0];
  });

  readonly propKeys = computed<string[]>(() => {
    return Object.keys(this.state.activeProps());
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

  selectTool(toolId: string): void {
    this.state.selectTool(toolId);
    this.searchQuery.set('');
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
