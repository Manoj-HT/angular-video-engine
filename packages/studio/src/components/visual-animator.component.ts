import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  ViewChild,
  ElementRef,
  HostListener,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudioStateService } from '../services/studio-state.service';
import { RootFrameService } from '@angular-video/core';

export interface DomTreeNode {
  id: string;
  tagName: string;
  name: string;
  aveName?: string;
  dataName?: string;
  className: string;
  elementId?: string;
  selector: string;
  depth: number;
  hasChildren: boolean;
  children: DomTreeNode[];
  expanded: boolean;
  elementRef?: HTMLElement;
  hasAveAnimate: boolean;
  hasAveSequence: boolean;
}

export const COMMON_CSS_PROPERTIES: string[] = [
  // Transforms & Motion
  'opacity',
  'translateY',
  'translateX',
  'scale',
  'rotate',
  'transform',
  'skewX',
  'skewY',
  // Colors & Backgrounds
  'color',
  'background',
  'background-color',
  'border-color',
  'border',
  'border-radius',
  'border-width',
  'box-shadow',
  // Sizing & Spacing
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'padding',
  'margin',
  'gap',
  // Typography
  'font-size',
  'font-weight',
  'font-family',
  'letter-spacing',
  'line-height',
  'text-align',
  'text-shadow',
  // Effects & Filters
  'filter',
  'backdrop-filter',
  'mix-blend-mode',
  'clip-path',
  // Layout & Positioning
  'display',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'z-index',
  'overflow',
  'visibility'
];

@Component({
  selector: 'ave-visual-animator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ave-animator-root">
      <!-- Top Header & Current Frame Info -->
      <div class="ave-animator-header">
        <div class="ave-animator-title-row">
          <span class="ave-animator-title">✨ Visual Animator & Styler</span>
          <button
            type="button"
            class="ave-icon-btn"
            (click)="scanCanvasDom()"
            title="Rescan Canvas DOM"
          >
            🔄
          </button>
        </div>

        <div class="ave-frame-strip">
          <span class="ave-frame-pill">
            <span class="ave-dot-live"></span>
            Frame
            <input
              type="number"
              class="ave-frame-input"
              [value]="frameService.frame()"
              min="0"
              [max]="frameService.config().durationInFrames - 1"
              (input)="onFrameInput($event)"
              title="Current frame playhead"
            />
            / {{ frameService.config().durationInFrames }}
          </span>
          <div class="ave-frame-step-group">
            <button type="button" class="ave-step-btn" (click)="frameService.stepFrame(-5)" title="Step -5 frames">«</button>
            <button type="button" class="ave-step-btn" (click)="frameService.stepFrame(-1)" title="Step -1 frame">‹</button>
            <button type="button" class="ave-step-btn" (click)="frameService.stepFrame(1)" title="Step +1 frame">›</button>
            <button type="button" class="ave-step-btn" (click)="frameService.stepFrame(5)" title="Step +5 frames">»</button>
          </div>
          <span class="ave-comp-badge" [title]="state.activeComposition()?.title || ''">
            {{ state.activeComposition()?.id }}
          </span>
        </div>
      </div>

      <!-- Main Two-Zone Interface -->
      <div class="ave-animator-body">
        <!-- ================= ZONE 1: HIERARCHICAL DOM TREE ================= -->
        <div class="ave-tree-section">
          <div class="ave-section-subhead">
            <span>Canvas DOM Hierarchy</span>
            <span class="ave-count-badge">{{ flatNodeCount() }} elements</span>
          </div>

          <!-- DOM Search Filter -->
          <div class="ave-tree-search-bar">
            <span class="ave-lens">🔍</span>
            <input
              type="text"
              class="ave-tree-search-input"
              placeholder="Filter canvas elements..."
              [value]="treeSearchQuery()"
              (input)="treeSearchQuery.set($any($event.target).value)"
            />
            @if (treeSearchQuery()) {
              <button
                type="button"
                class="ave-search-clear"
                (click)="treeSearchQuery.set('')"
              >
                ✕
              </button>
            }
          </div>

          <!-- DOM Scrollable Tree View -->
          <div class="ave-tree-viewport">
            @for (node of filteredTreeNodes(); track node.id) {
              <div
                class="ave-tree-node-row"
                [class.selected]="selectedNode()?.id === node.id"
                [style.padding-left.px]="12 + node.depth * 14"
                (click)="selectNode(node)"
                (mouseenter)="onNodeHover(node, true)"
                (mouseleave)="onNodeHover(node, false)"
              >
                <!-- Expand / Collapse Arrow -->
                <button
                  type="button"
                  class="ave-tree-expander"
                  [class.invisible]="!node.hasChildren"
                  (click)="toggleExpand(node, $event)"
                >
                  {{ node.expanded ? '▼' : '▶' }}
                </button>

                <!-- Tag / Kind Icon -->
                <span class="ave-node-icon">{{ getNodeIcon(node.tagName) }}</span>

                <!-- Name with ave-name or data-name badge -->
                <span class="ave-node-name" [title]="node.selector">
                  @if (node.aveName) {
                    <span class="ave-custom-name-badge">🏷️ {{ node.aveName }}</span>
                  } @else if (node.dataName) {
                    <span class="ave-custom-name-badge">🏷️ {{ node.dataName }}</span>
                  } @else {
                    <span class="ave-tag-text">{{ node.tagName }}</span>
                    @if (node.className) {
                      <span class="ave-class-text">.{{ getPrimaryClass(node.className) }}</span>
                    }
                  }
                </span>

                <!-- Directive Indicators -->
                <div class="ave-node-tags">
                  @if (node.hasAveAnimate) {
                    <span class="ave-badge-animate" title="Has aveAnimate directive">⚡ animate</span>
                  }
                  @if (node.hasAveSequence) {
                    <span class="ave-badge-sequence" title="Scoped in aveSequence">⏱️ seq</span>
                  }
                </div>
              </div>
            }

            @if (filteredTreeNodes().length === 0) {
              <div class="ave-empty-tree">
                <span>🔍 No matching elements found</span>
              </div>
            }
          </div>
        </div>

        <!-- ================= ZONE 2: ELEMENT INSPECTOR & ANIMATOR CONTROLS ================= -->
        @if (selectedNode(); as node) {
          <div class="ave-inspector-section">
            <!-- Selected Element Header Card -->
            <div class="ave-selected-header-card">
              <div class="ave-selected-title-row">
                <span class="ave-selected-tag">&lt;{{ node.tagName }}&gt;</span>
                <span class="ave-selected-name">{{ node.name }}</span>
              </div>
              <div class="ave-selected-selector" [title]="node.selector">
                <code>{{ node.selector }}</code>
              </div>
            </div>

            <!-- Mode Banner: Static CSS vs Dynamic aveAnimate -->
            <div
              class="ave-mode-banner"
              [class.mode-animate]="isKeyframeMode()"
              [class.mode-static]="!isKeyframeMode()"
            >
              @if (isKeyframeMode()) {
                <span class="ave-mode-icon">⚡</span>
                <div class="ave-mode-text">
                  <strong>Dynamic aveAnimate Keyframe</strong>
                  <span>Frame Range: [{{ getInitialFrame() }} ➔ {{ frameService.frame() }}]</span>
                </div>
              } @else {
                <span class="ave-mode-icon">🎨</span>
                <div class="ave-mode-text">
                  <strong>Static CSS Rule</strong>
                  <span>Click Add to write to CSS. Scrub timeline to keyframe animate!</span>
                </div>
              }
            </div>

            <!-- Style Selector: Dropdown + Input + Add Button -->
            <div class="ave-styler-panel">
              <div class="ave-styler-subhead">
                <span>Add Property / Keyframe</span>
                <span class="ave-frame-subtext">Current Frame: {{ frameService.frame() }}</span>
              </div>

              <!-- Side-by-Side: Searchable Dropdown + Input Box + Add Button -->
              <div class="ave-styler-input-row">
                <!-- Searchable CSS Property Dropdown -->
                <div class="ave-searchable-dropdown-wrap">
                  <div
                    class="ave-dropdown-trigger"
                    (click)="toggleDropdown()"
                  >
                    <input
                      type="text"
                      class="ave-dropdown-search-input"
                      placeholder="Property (e.g. opacity)..."
                      [value]="propertySearch() || selectedProperty()"
                      (input)="onPropSearchInput($event)"
                      (focus)="isDropdownOpen.set(true)"
                      (keydown.escape)="isDropdownOpen.set(false)"
                    />
                    <span class="ave-dropdown-arrow">{{ isDropdownOpen() ? '▲' : '▼' }}</span>
                  </div>

                  @if (isDropdownOpen()) {
                    <div class="ave-dropdown-menu">
                      @for (prop of filteredCssProperties(); track prop) {
                        <div
                          class="ave-dropdown-item"
                          [class.active]="selectedProperty() === prop"
                          (click)="selectProperty(prop)"
                        >
                          <span class="ave-item-prop">{{ prop }}</span>
                          @if (isTransformProp(prop)) {
                            <span class="ave-prop-type-badge">animate</span>
                          }
                        </div>
                      }
                      @if (filteredCssProperties().length === 0) {
                        <div class="ave-dropdown-empty">Custom: "{{ propertySearch() }}"</div>
                      }
                    </div>
                  }
                </div>

                <!-- Value Input Box -->
                <div class="ave-value-input-wrap">
                  <input
                    type="text"
                    class="ave-value-input"
                    placeholder="Value (e.g. 0, 40px, #00d2ff)"
                    [value]="propertyValue()"
                    (input)="propertyValue.set($any($event.target).value)"
                    (keydown.enter)="onAddClick()"
                  />
                </div>

                <!-- Add Button -->
                <button
                  type="button"
                  class="ave-btn-add"
                  [class.animate-glow]="isKeyframeMode()"
                  (click)="onAddClick()"
                  [disabled]="!selectedProperty() || !propertyValue().trim() || isSaving()"
                  title="Add style or keyframe animate directive"
                >
                  @if (isSaving()) {
                    <span>●</span>
                  } @else {
                    Add
                  }
                </button>
              </div>

              <!-- Value Quick Presets -->
              <div class="ave-presets-row">
                <span class="ave-presets-label">Presets:</span>
                @for (preset of getPropertyPresets(selectedProperty()); track preset) {
                  <button
                    type="button"
                    class="ave-preset-btn"
                    (click)="propertyValue.set(preset)"
                  >
                    {{ preset }}
                  </button>
                }
              </div>

              <!-- Spring Physics Option (when animating) -->
              @if (isKeyframeMode() || selectedNode()?.hasAveAnimate) {
                <div class="ave-spring-row">
                  <label class="ave-checkbox-label">
                    <input
                      type="checkbox"
                      [checked]="useSpring()"
                      (change)="useSpring.set($any($event.target).checked)"
                    />
                    <span>Use Spring Physics (Natural Damping)</span>
                  </label>
                  @if (useSpring()) {
                    <div class="ave-spring-inputs">
                      <span class="ave-spring-sub">Damp:</span>
                      <input
                        type="number"
                        class="ave-mini-num"
                        [value]="springDamping()"
                        (input)="springDamping.set(+$any($event.target).value)"
                      />
                      <span class="ave-spring-sub">Stiff:</span>
                      <input
                        type="number"
                        class="ave-mini-num"
                        [value]="springStiffness()"
                        (input)="springStiffness.set(+$any($event.target).value)"
                      />
                    </div>
                  }
                </div>
              }

              <!-- Status Toast Notification -->
              @if (statusMessage(); as status) {
                <div class="ave-status-toast" [class]="'status-' + status.type">
                  {{ status.text }}
                </div>
              }
            </div>

            <!-- Existing aveAnimate Directives on Element -->
            @if (existingAnimateConfig(); as anim) {
              <div class="ave-card-block">
                <div class="ave-card-block-header">
                  <span class="ave-card-icon">⚡</span>
                  <h4>Active aveAnimate Directive</h4>
                </div>

                <div class="ave-anim-details">
                  <div class="ave-anim-range-row">
                    <span class="ave-range-tag">Range: [{{ anim.range ? anim.range[0] : 0 }} ➔ {{ anim.range ? anim.range[1] : 30 }}]</span>
                    <span class="ave-range-dur">{{ (anim.range ? anim.range[1] - anim.range[0] : 30) }} frames</span>
                  </div>

                  <div class="ave-anim-props-table">
                    @for (item of getAnimatePropertyPairs(anim); track item.prop) {
                      <div class="ave-anim-prop-row">
                        <span class="ave-prop-name">{{ item.prop }}</span>
                        <span class="ave-prop-tween">{{ item.from }} ➔ {{ item.to }}</span>
                        <button
                          type="button"
                          class="ave-prop-del-btn"
                          (click)="removeAnimatedProperty(item.prop)"
                          title="Remove property from animation"
                        >
                          ✕
                        </button>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }

            <!-- Existing Static CSS Properties on Element -->
            <div class="ave-card-block">
              <div class="ave-card-block-header">
                <span class="ave-card-icon">🎨</span>
                <h4>Declared CSS Properties</h4>
              </div>

              <div class="ave-css-props-list">
                @for (entry of getCssRulesList(); track entry.prop) {
                  <div class="ave-css-prop-row">
                    <span class="ave-css-k">{{ entry.prop }}:</span>
                    <span class="ave-css-v">{{ entry.val }}</span>
                    <button
                      type="button"
                      class="ave-prop-del-btn"
                      (click)="removeCssProperty(entry.prop)"
                      title="Remove from CSS"
                    >
                      ✕
                    </button>
                  </div>
                }

                @if (getCssRulesList().length === 0) {
                  <div class="ave-empty-props">
                    <span>No specific CSS rules declared for this selector yet</span>
                  </div>
                }
              </div>
            </div>
          </div>
        } @else {
          <!-- Empty State: Prompt to select an element -->
          <div class="ave-no-selection">
            <span class="ave-no-sel-icon">👆</span>
            <h4>Select an Element from the Tree</h4>
            <p>
              Click any element in the hierarchy above (or on the canvas) to inspect its styles, add CSS, and set frame-accurate <code>[aveAnimate]</code> keyframes!
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      width: 100%;
      height: 100%;
      min-height: 0;
      color: #e2e8f0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      user-select: none;
    }

    .ave-animator-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      gap: 12px;
      position: relative;
    }

    /* Header */
    .ave-animator-header {
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: #151828;
      border: 1px solid #252b47;
      border-radius: 8px;
      padding: 10px 12px;
    }

    .ave-animator-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ave-animator-title {
      font-size: 13px;
      font-weight: 700;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ave-icon-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 13px;
      padding: 2px 4px;
      border-radius: 4px;

      &:hover {
        color: #ffffff;
        background: #252b47;
      }
    }

    .ave-frame-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .ave-frame-pill {
      font-size: 11px;
      font-family: monospace;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 6px;

      strong {
        color: #00d2ff;
      }
    }

    .ave-frame-input {
      width: 44px;
      background: #0d0f1b;
      border: 1px solid #2b3353;
      border-radius: 4px;
      color: #00d2ff;
      font-size: 11px;
      font-weight: 700;
      font-family: monospace;
      padding: 1px 4px;
      text-align: center;
      outline: none;
      &:focus { border-color: #00d2ff; }
    }

    .ave-frame-step-group {
      display: inline-flex;
      background: #141829;
      border: 1px solid #282f4d;
      border-radius: 4px;
      overflow: hidden;
    }

    .ave-step-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 11px;
      padding: 1px 5px;
      cursor: pointer;
      &:hover { background: #252c48; color: #ffffff; }
    }

    .ave-dot-live {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #00d2ff;
      box-shadow: 0 0 6px #00d2ff;
    }

    .ave-comp-badge {
      font-size: 10px;
      font-weight: 600;
      color: #7c4dff;
      background: rgba(124, 77, 255, 0.12);
      border: 1px solid rgba(124, 77, 255, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Body */
    .ave-animator-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #272c44 #12131d;
    }

    /* Zone 1: DOM Tree */
    .ave-tree-section {
      background: #141726;
      border: 1px solid #20263f;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      max-height: 240px;
      flex-shrink: 0;
    }

    .ave-section-subhead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: #181c2f;
      border-bottom: 1px solid #20263f;
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
    }

    .ave-count-badge {
      font-size: 10px;
      background: #232840;
      padding: 1px 6px;
      border-radius: 10px;
      color: #64748b;
    }

    .ave-tree-search-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: #111322;
      border-bottom: 1px solid #1c2138;
    }

    .ave-lens {
      font-size: 11px;
      opacity: 0.6;
    }

    .ave-tree-search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #f1f5f9;
      font-size: 11px;

      &::placeholder {
        color: #475569;
      }
    }

    .ave-search-clear {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 11px;
      padding: 0 2px;
      &:hover { color: #f1f5f9; }
    }

    .ave-tree-viewport {
      flex: 1;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #272c44 #12131d;
      padding: 4px 0;
    }

    .ave-tree-node-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      cursor: pointer;
      transition: background 0.12s ease;
      font-size: 11px;
      white-space: nowrap;

      &:hover {
        background: #1d2238;
      }

      &.selected {
        background: #262e4f;
        border-left: 2px solid #00d2ff;
      }
    }

    .ave-tree-expander {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 8px;
      width: 12px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      &.invisible {
        visibility: hidden;
      }

      &:hover {
        color: #f1f5f9;
      }
    }

    .ave-node-icon {
      font-size: 11px;
      opacity: 0.8;
    }

    .ave-node-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ave-custom-name-badge {
      color: #38bdf8;
      font-weight: 600;
      background: rgba(56, 189, 248, 0.1);
      padding: 1px 4px;
      border-radius: 3px;
    }

    .ave-tag-text {
      color: #cbd5e1;
      font-weight: 500;
    }

    .ave-class-text {
      color: #818cf8;
      font-family: monospace;
      font-size: 10px;
    }

    .ave-node-tags {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .ave-badge-animate {
      font-size: 9px;
      color: #facc15;
      background: rgba(250, 204, 21, 0.12);
      border: 1px solid rgba(250, 204, 21, 0.3);
      padding: 0 4px;
      border-radius: 3px;
    }

    .ave-badge-sequence {
      font-size: 9px;
      color: #c084fc;
      background: rgba(192, 132, 252, 0.12);
      border: 1px solid rgba(192, 132, 252, 0.3);
      padding: 0 4px;
      border-radius: 3px;
    }

    .ave-empty-tree {
      padding: 16px;
      text-align: center;
      color: #64748b;
      font-size: 11px;
    }

    /* Zone 2: Selected Element Inspector */
    .ave-inspector-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .ave-selected-header-card {
      background: #141726;
      border: 1px solid #232840;
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .ave-selected-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ave-selected-tag {
      font-size: 11px;
      font-family: monospace;
      color: #38bdf8;
      font-weight: 700;
    }

    .ave-selected-name {
      font-size: 12px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ave-selected-selector {
      font-size: 10px;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      code {
        color: #94a3b8;
        font-family: monospace;
      }
    }

    /* Mode Banner */
    .ave-mode-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;

      &.mode-static {
        background: rgba(56, 189, 248, 0.08);
        border: 1px solid rgba(56, 189, 248, 0.25);
        color: #38bdf8;
      }

      &.mode-animate {
        background: linear-gradient(135deg, rgba(250, 204, 21, 0.12), rgba(124, 77, 255, 0.12));
        border: 1px solid rgba(250, 204, 21, 0.4);
        color: #facc15;
      }
    }

    .ave-mode-icon {
      font-size: 14px;
    }

    .ave-mode-text {
      display: flex;
      flex-direction: column;

      strong {
        font-size: 11px;
      }
      span {
        font-size: 10px;
        opacity: 0.8;
      }
    }

    /* Styler Panel */
    .ave-styler-panel {
      background: #161929;
      border: 1px solid #252b47;
      border-radius: 6px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .ave-styler-subhead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
    }

    .ave-frame-subtext {
      font-size: 10px;
      font-family: monospace;
      color: #00d2ff;
    }

    /* Styler Input Row: Dropdown + Value Input + Add Button */
    .ave-styler-input-row {
      display: flex;
      gap: 6px;
      align-items: stretch;
      position: relative;
    }

    .ave-searchable-dropdown-wrap {
      flex: 1.1;
      position: relative;
      min-width: 0;
    }

    .ave-dropdown-trigger {
      display: flex;
      align-items: center;
      background: #0f121d;
      border: 1px solid #2b3353;
      border-radius: 4px;
      padding: 2px 6px;
      cursor: pointer;

      &:focus-within {
        border-color: #00d2ff;
      }
    }

    .ave-dropdown-search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #f8fafc;
      font-size: 11px;
      font-family: monospace;
      min-width: 0;
    }

    .ave-dropdown-arrow {
      font-size: 8px;
      color: #64748b;
      margin-left: 4px;
    }

    .ave-dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background: #141829;
      border: 1px solid #2f375c;
      border-radius: 5px;
      max-height: 180px;
      overflow-y: auto;
      z-index: 50;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      scrollbar-width: thin;
      scrollbar-color: #272c44 #12131d;
    }

    .ave-dropdown-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 8px;
      font-size: 11px;
      font-family: monospace;
      color: #cbd5e1;
      cursor: pointer;

      &:hover,
      &.active {
        background: #232a48;
        color: #38bdf8;
      }
    }

    .ave-prop-type-badge {
      font-size: 9px;
      color: #facc15;
      opacity: 0.7;
    }

    .ave-dropdown-empty {
      padding: 8px;
      text-align: center;
      color: #64748b;
      font-size: 11px;
    }

    .ave-value-input-wrap {
      flex: 1;
      min-width: 0;
    }

    .ave-value-input {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      background: #0f121d;
      border: 1px solid #2b3353;
      border-radius: 4px;
      color: #f8fafc;
      font-size: 11px;
      font-family: monospace;
      padding: 4px 6px;
      outline: none;

      &:focus {
        border-color: #00d2ff;
      }
    }

    .ave-btn-add {
      background: #0284c7;
      border: none;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
      flex-shrink: 0;

      &:hover:not(:disabled) {
        background: #0369a1;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.animate-glow {
        background: linear-gradient(135deg, #0284c7, #7c4dff);
        box-shadow: 0 0 10px rgba(0, 210, 255, 0.4);
      }
    }

    /* Presets */
    .ave-presets-row {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }

    .ave-presets-label {
      font-size: 10px;
      color: #64748b;
    }

    .ave-preset-btn {
      background: #1e243a;
      border: 1px solid #2a3252;
      color: #94a3b8;
      font-size: 10px;
      font-family: monospace;
      padding: 1px 5px;
      border-radius: 3px;
      cursor: pointer;

      &:hover {
        color: #ffffff;
        background: #2a3458;
      }
    }

    /* Spring Option */
    .ave-spring-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding-top: 4px;
      border-top: 1px solid #21263d;
      font-size: 10px;
    }

    .ave-checkbox-label {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #94a3b8;
      cursor: pointer;
    }

    .ave-spring-inputs {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .ave-spring-sub {
      color: #64748b;
      font-size: 9px;
    }

    .ave-mini-num {
      width: 38px;
      background: #0f121d;
      border: 1px solid #2b3353;
      border-radius: 3px;
      color: #f1f5f9;
      font-size: 10px;
      padding: 1px 3px;
      outline: none;
    }

    /* Status Toast */
    .ave-status-toast {
      padding: 5px 8px;
      border-radius: 4px;
      font-size: 11px;
      text-align: center;
      font-weight: 600;

      &.status-success {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #34d399;
      }
      &.status-error {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #f87171;
      }
      &.status-info {
        background: rgba(56, 189, 248, 0.15);
        border: 1px solid rgba(56, 189, 248, 0.4);
        color: #38bdf8;
      }
    }

    /* Card Blocks for Existing Properties */
    .ave-card-block {
      background: #141726;
      border: 1px solid #22273f;
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ave-card-block-header {
      display: flex;
      align-items: center;
      gap: 6px;

      h4 {
        margin: 0;
        font-size: 11px;
        font-weight: 600;
        color: #e2e8f0;
      }
    }

    .ave-card-icon {
      font-size: 12px;
    }

    .ave-anim-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ave-anim-range-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      font-family: monospace;
    }

    .ave-range-tag {
      color: #facc15;
      background: rgba(250, 204, 21, 0.1);
      padding: 1px 5px;
      border-radius: 3px;
    }

    .ave-range-dur {
      color: #64748b;
    }

    .ave-anim-props-table,
    .ave-css-props-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ave-anim-prop-row,
    .ave-css-prop-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1a1e32;
      border: 1px solid #282f4d;
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 10px;
      font-family: monospace;
    }

    .ave-prop-name,
    .ave-css-k {
      color: #94a3b8;
    }

    .ave-prop-tween {
      color: #facc15;
    }

    .ave-css-v {
      color: #38bdf8;
    }

    .ave-prop-del-btn {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 10px;
      padding: 0 2px;

      &:hover {
        color: #ef4444;
      }
    }

    .ave-empty-props {
      color: #64748b;
      font-size: 10px;
      text-align: center;
      padding: 6px 0;
    }

    /* Empty Selection */
    .ave-no-selection {
      border: 1px dashed #262c47;
      border-radius: 8px;
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
      background: rgba(20, 24, 38, 0.4);

      h4 {
        margin: 0;
        font-size: 12px;
        color: #e2e8f0;
      }

      p {
        margin: 0;
        font-size: 11px;
        color: #64748b;
        line-height: 1.4;

        code {
          color: #38bdf8;
          background: #171b2d;
          padding: 1px 4px;
          border-radius: 3px;
        }
      }
    }

    .ave-no-sel-icon {
      font-size: 26px;
      opacity: 0.8;
    }
  `]
})
export class AveVisualAnimatorComponent implements OnInit, OnDestroy {
  readonly state = inject(StudioStateService);
  readonly frameService = inject(RootFrameService);

  // Tree state
  readonly treeNodes = signal<DomTreeNode[]>([]);
  readonly treeSearchQuery = signal<string>('');
  readonly selectedNode = signal<DomTreeNode | null>(null);

  // CSS Property Selector & Input
  readonly allProperties = COMMON_CSS_PROPERTIES;
  readonly propertySearch = signal<string>('');
  readonly isDropdownOpen = signal<boolean>(false);
  readonly selectedProperty = signal<string>('opacity');
  readonly propertyValue = signal<string>('');

  // Spring physics options
  readonly useSpring = signal<boolean>(true);
  readonly springDamping = signal<number>(14);
  readonly springStiffness = signal<number>(120);

  // Status and loading
  readonly isSaving = signal<boolean>(false);
  readonly statusMessage = signal<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  private statusTimeout: any = null;

  // Existing properties on selected element
  readonly existingAnimateConfig = signal<any>(null);
  readonly existingCssRules = signal<Record<string, string>>({});

  // Keyframe memory: tracks the initial frame and initial value when user began staging this property
  private initialKeyframeState = new Map<string, { frame: number; value: string }>();

  // Hovered element on canvas
  private hoveredElement: HTMLElement | null = null;

  // Filtered tree nodes
  readonly filteredTreeNodes = computed(() => {
    const q = this.treeSearchQuery().toLowerCase().trim();
    const flatList = this.flattenTree(this.treeNodes());
    if (!q) return flatList;
    return flatList.filter(n =>
      n.name.toLowerCase().includes(q) ||
      n.tagName.toLowerCase().includes(q) ||
      n.className.toLowerCase().includes(q) ||
      n.selector.toLowerCase().includes(q)
    );
  });

  readonly flatNodeCount = computed(() => this.flattenTree(this.treeNodes()).length);

  // Filtered dropdown properties
  readonly filteredCssProperties = computed(() => {
    const q = this.propertySearch().toLowerCase().trim();
    if (!q) return this.allProperties;
    return this.allProperties.filter(p => p.toLowerCase().includes(q));
  });

  // Determines if user is in "Keyframe Animate Mode" (frame has scrubbed away from initial frame)
  readonly isKeyframeMode = computed(() => {
    const prop = this.selectedProperty();
    const currentF = this.frameService.frame();
    const mem = this.initialKeyframeState.get(prop);
    if (!mem) return false;
    return mem.frame !== currentF;
  });

  constructor() {
    // Whenever composition changes, rescan DOM
    effect(() => {
      const comp = this.state.activeComposition();
      if (comp) {
        setTimeout(() => this.scanCanvasDom(), 150);
      }
    });
  }

  ngOnInit(): void {
    setTimeout(() => this.scanCanvasDom(), 100);
    this.attachCanvasClickListener();
  }

  ngOnDestroy(): void {
    this.removeHighlight();
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
  }

  // Scan Canvas Stage DOM to build tree
  scanCanvasDom(): void {
    if (typeof document === 'undefined') return;

    const stageContent = document.querySelector('.ave-stage-content');
    if (!stageContent) return;

    // Direct root component outlet
    const rootEl = stageContent.firstElementChild;
    if (!rootEl) {
      this.treeNodes.set([]);
      return;
    }

    const tree = this.buildNode(rootEl as HTMLElement, 0);
    this.treeNodes.set(tree ? [tree] : []);
  }

  private buildNode(el: HTMLElement, depth: number): DomTreeNode | null {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'script' || tagName === 'style') return null;

    const aveName = el.getAttribute('ave-name') || undefined;
    const dataName = el.getAttribute('data-name') || undefined;
    const className = typeof el.className === 'string'
      ? el.className.split(/\s+/).filter(c => c && !c.startsWith('ng-') && !c.startsWith('_ng')).join(' ')
      : '';
    const elementId = el.id || undefined;

    // Detect directive attributes
    const hasAveAnimate = el.hasAttribute('aveanimate') || el.hasAttribute('[aveanimate]');
    const hasAveSequence = el.hasAttribute('avesequence') || el.hasAttribute('[avesequence]');

    // Selector
    let selector = '';
    if (aveName) {
      selector = `[ave-name="${aveName}"]`;
    } else if (dataName) {
      selector = `[data-name="${dataName}"]`;
    } else if (elementId) {
      selector = `#${elementId}`;
    } else if (className) {
      const firstClass = className.split(/\s+/)[0];
      selector = `.${firstClass}`;
    } else {
      selector = tagName;
    }

    let name = '';
    if (aveName) {
      name = aveName;
    } else if (dataName) {
      name = dataName;
    } else if (elementId) {
      name = `${tagName}#${elementId}`;
    } else if (className) {
      name = `${tagName}.${className.split(/\s+/)[0]}`;
    } else {
      name = tagName;
    }

    const children: DomTreeNode[] = [];
    for (let i = 0; i < el.children.length; i++) {
      const childNode = this.buildNode(el.children[i] as HTMLElement, depth + 1);
      if (childNode) children.push(childNode);
    }

    return {
      id: `${depth}-${tagName}-${Math.random().toString(36).substr(2, 6)}`,
      tagName,
      name,
      aveName,
      dataName,
      className,
      elementId,
      selector,
      depth,
      hasChildren: children.length > 0,
      children,
      expanded: depth < 5,
      elementRef: el,
      hasAveAnimate,
      hasAveSequence
    };
  }

  private flattenTree(nodes: DomTreeNode[]): DomTreeNode[] {
    const list: DomTreeNode[] = [];
    const traverse = (nodeList: DomTreeNode[]) => {
      for (const n of nodeList) {
        list.push(n);
        if (n.expanded && n.children.length > 0) {
          traverse(n.children);
        }
      }
    };
    traverse(nodes);
    return list;
  }

  toggleExpand(node: DomTreeNode, event: Event): void {
    event.stopPropagation();
    node.expanded = !node.expanded;
    this.treeNodes.update(nodes => [...nodes]);
  }

  selectNode(node: DomTreeNode): void {
    this.selectedNode.set(node);
    this.highlightElement(node.elementRef);
    this.inspectElement(node);
  }

  async inspectElement(node: DomTreeNode): Promise<void> {
    const compId = this.state.activeComposition()?.id || 'DirectivesShowcase';
    try {
      const params = new URLSearchParams({
        compositionId: compId,
        selector: node.selector || ''
      });
      if (node.aveName) params.set('aveName', node.aveName);
      if (node.dataName) params.set('dataName', node.dataName);
      if (node.className) params.set('className', node.className);
      if (node.tagName) params.set('tagName', node.tagName);
      if (node.elementId) params.set('elementId', node.elementId);

      const res = await fetch(`/api/styler/inspect?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        this.existingAnimateConfig.set(data.animateConfig || null);
        this.existingCssRules.set(data.cssRules || {});
      }
    } catch (err) {
      console.error('Failed to inspect element styles:', err);
    }
  }

  onFrameInput(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) {
      this.frameService.setFrame(val);
    }
  }

  // Dropdown interactions
  toggleDropdown(): void {
    this.isDropdownOpen.update(v => !v);
  }

  onPropSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.propertySearch.set(val);
    this.isDropdownOpen.set(true);
  }

  selectProperty(prop: string): void {
    this.selectedProperty.set(prop);
    this.propertySearch.set(prop);
    this.isDropdownOpen.set(false);

    // Default value if empty
    if (!this.propertyValue()) {
      const presets = this.getPropertyPresets(prop);
      if (presets.length > 0) this.propertyValue.set(presets[0]);
    }
  }

  isTransformProp(prop: string): boolean {
    return ['translatey', 'translatex', 'scale', 'rotate', 'opacity', 'transform'].includes(prop.toLowerCase());
  }

  getPropertyPresets(prop: string): string[] {
    const p = prop.toLowerCase();
    if (p === 'opacity') return ['0', '0.5', '1'];
    if (p === 'translatey') return ['-40px', '0px', '40px'];
    if (p === 'translatex') return ['-60px', '0px', '60px'];
    if (p === 'scale') return ['0.8', '0.9', '1', '1.1'];
    if (p === 'rotate') return ['-15deg', '0deg', '45deg', '360deg'];
    if (p === 'color') return ['#00d2ff', '#7c4dff', '#ffffff', '#94a3b8'];
    if (p === 'background-color') return ['#141726', '#000000', 'rgba(0,210,255,0.1)'];
    if (p === 'font-size') return ['14px', '20px', '32px', '64px'];
    if (p === 'border-radius') return ['4px', '8px', '16px', '50%'];
    return ['0', '1', 'auto'];
  }

  getInitialFrame(): number {
    const prop = this.selectedProperty();
    const mem = this.initialKeyframeState.get(prop);
    return mem ? mem.frame : 0;
  }

  // ================= CORE ACTION: ADD BUTTON =================
  async onAddClick(): Promise<void> {
    const node = this.selectedNode();
    const prop = this.selectedProperty().trim();
    const val = this.propertyValue().trim();
    const currentF = this.frameService.frame();
    const compId = this.state.activeComposition()?.id || 'DirectivesShowcase';

    if (!node || !prop || !val) return;

    this.isSaving.set(true);

    const mem = this.initialKeyframeState.get(prop);

    // CASE A: Keyframe Mode (user changed frame since first staging)
    if (mem && mem.frame !== currentF) {
      const startFrame = Math.min(mem.frame, currentF);
      const endFrame = Math.max(mem.frame, currentF);
      const fromVal = mem.frame <= currentF ? mem.value : val;
      const toVal = mem.frame <= currentF ? val : mem.value;

      try {
        const res = await fetch('/api/styler/animate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            compositionId: compId,
            target: {
              aveName: node.aveName,
              dataName: node.dataName,
              className: node.className,
              tagName: node.tagName,
              elementId: node.elementId,
              selector: node.selector
            },
            config: {
              range: [startFrame, endFrame],
              property: prop,
              fromValue: fromVal,
              toValue: toVal,
              spring: this.useSpring()
                ? { damping: this.springDamping(), stiffness: this.springStiffness() }
                : false
            },
            removeCssProp: prop // Remove from CSS so aveAnimate takes over!
          })
        });

        const data = await res.json();
        if (data.success) {
          this.showStatus(`✓ Wrote [aveAnimate] [${startFrame}, ${endFrame}] for ${prop}`, 'success');
          // Update live DOM style immediately
          this.applyLiveStyle(node.elementRef, prop, toVal);
          // Refresh state
          node.hasAveAnimate = true;
          this.initialKeyframeState.delete(prop);
          await this.inspectElement(node);
        } else {
          this.showStatus(data.error || 'Failed to write aveAnimate', 'error');
        }
      } catch (err: any) {
        this.showStatus(err.message || 'Error writing aveAnimate', 'error');
      } finally {
        this.isSaving.set(false);
      }
    } else {
      // CASE B: Static CSS Mode (First addition at current frame)
      try {
        const res = await fetch('/api/styler/css', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            compositionId: compId,
            selector: node.selector,
            property: prop,
            value: val
          })
        });

        const data = await res.json();
        if (data.success) {
          // Record initial keyframe memory
          this.initialKeyframeState.set(prop, { frame: currentF, value: val });
          this.showStatus(`✓ Wrote ${prop}: ${val} to CSS (Scrub frame to animate!)`, 'info');
          // Apply to live DOM
          this.applyLiveStyle(node.elementRef, prop, val);
          await this.inspectElement(node);
        } else {
          this.showStatus(data.error || 'Failed to write CSS property', 'error');
        }
      } catch (err: any) {
        this.showStatus(err.message || 'Error writing CSS', 'error');
      } finally {
        this.isSaving.set(false);
      }
    }
  }

  // Remove a CSS property
  async removeCssProperty(prop: string): Promise<void> {
    const node = this.selectedNode();
    const compId = this.state.activeComposition()?.id || 'DirectivesShowcase';
    if (!node) return;

    try {
      const res = await fetch('/api/styler/remove-css', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compositionId: compId,
          selector: node.selector,
          property: prop
        })
      });
      if (res.ok) {
        this.showStatus(`Removed ${prop} from CSS`, 'info');
        if (node.elementRef) {
          node.elementRef.style.removeProperty(prop);
        }
        await this.inspectElement(node);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Remove property from aveAnimate
  async removeAnimatedProperty(prop: string): Promise<void> {
    const node = this.selectedNode();
    const compId = this.state.activeComposition()?.id || 'DirectivesShowcase';
    const currentAnim = this.existingAnimateConfig();
    if (!node || !currentAnim) return;

    const from = { ...currentAnim.from };
    const to = { ...currentAnim.to };
    delete from[prop];
    delete to[prop];

    try {
      const res = await fetch('/api/styler/animate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compositionId: compId,
          target: {
            aveName: node.aveName,
            dataName: node.dataName,
            className: node.className,
            tagName: node.tagName,
            elementId: node.elementId,
            selector: node.selector
          },
          config: {
            range: currentAnim.range || [0, 30],
            from,
            to,
            spring: this.useSpring()
          }
        })
      });
      if (res.ok) {
        this.showStatus(`Removed ${prop} from animation`, 'info');
        await this.inspectElement(node);
      }
    } catch (err) {
      console.error(err);
    }
  }

  private applyLiveStyle(el: HTMLElement | undefined, prop: string, val: string): void {
    if (!el) return;
    if (prop === 'translateY' || prop === 'translateX' || prop === 'scale' || prop === 'rotate') {
      el.style.transform = `${prop}(${val})`;
    } else {
      (el.style as any)[prop] = val;
    }
  }

  // Visual Canvas Overlay Helpers
  private highlightElement(el?: HTMLElement): void {
    this.removeHighlight();
    if (!el) return;
    el.style.outline = '2px solid #00d2ff';
    el.style.outlineOffset = '2px';
    this.hoveredElement = el;
  }

  private removeHighlight(): void {
    if (this.hoveredElement) {
      this.hoveredElement.style.outline = '';
      this.hoveredElement.style.outlineOffset = '';
      this.hoveredElement = null;
    }
  }

  onNodeHover(node: DomTreeNode, isEnter: boolean): void {
    if (isEnter) {
      if (node.elementRef && node.id !== this.selectedNode()?.id) {
        node.elementRef.style.outline = '1px dashed #7c4dff';
      }
    } else {
      if (node.elementRef && node.id !== this.selectedNode()?.id) {
        node.elementRef.style.outline = '';
      }
    }
  }

  // Click listener directly on Canvas
  private attachCanvasClickListener(): void {
    if (typeof document === 'undefined') return;

    const stageContent = document.querySelector('.ave-stage-content');
    if (!stageContent) return;

    stageContent.addEventListener('click', (event: Event) => {
      // Only handle if this tool is currently active
      if (this.state.activeTool() !== 'animator') return;

      const target = event.target as HTMLElement;
      if (!target || target === stageContent) return;

      event.preventDefault();
      event.stopPropagation();

      // Find node in tree
      const flat = this.flattenTree(this.treeNodes());
      const match = flat.find(n => n.elementRef === target);
      if (match) {
        this.selectNode(match);
      }
    });
  }

  getNodeIcon(tag: string): string {
    const t = tag.toLowerCase();
    if (['div', 'section', 'article', 'main', 'header', 'footer'].includes(t)) return '📦';
    if (['h1', 'h2', 'h3', 'h4', 'p', 'span', 'b', 'strong'].includes(t)) return '🔤';
    if (['img', 'ave-image', 'svg'].includes(t)) return '🖼️';
    if (['video', 'ave-video'].includes(t)) return '🎥';
    if (['audio', 'ave-audio'].includes(t)) return '🎵';
    if (['button', 'input', 'select'].includes(t)) return '🔘';
    return '🔹';
  }

  getPrimaryClass(classStr: string): string {
    if (!classStr) return '';
    return classStr.split(/\s+/)[0] || '';
  }

  getAnimatePropertyPairs(anim: any): { prop: string; from: any; to: any }[] {
    if (!anim || !anim.from || !anim.to) return [];
    const props = Array.from(new Set([...Object.keys(anim.from), ...Object.keys(anim.to)]));
    return props.map(p => ({
      prop: p,
      from: anim.from[p] ?? '-',
      to: anim.to[p] ?? '-'
    }));
  }

  getCssRulesList(): { prop: string; val: string }[] {
    const rules = this.existingCssRules();
    return Object.entries(rules).map(([prop, val]) => ({ prop, val }));
  }

  private showStatus(text: string, type: 'success' | 'error' | 'info'): void {
    this.statusMessage.set({ text, type });
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.statusTimeout = setTimeout(() => {
      this.statusMessage.set(null);
    }, 3200);
  }
}
