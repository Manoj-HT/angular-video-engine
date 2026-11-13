import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface AssetFolder {
  name: string;
  path: string;
  itemCount: number;
}

export interface AssetFile {
  name: string;
  path: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'other';
  extension: string;
  size: number;
  formattedSize: string;
  modifiedAt: number;
}

export interface AssetListResult {
  currentPath: string;
  breadcrumbs: { name: string; path: string }[];
  folders: AssetFolder[];
  files: AssetFile[];
}

@Component({
  selector: 'ave-asset-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="ave-asset-library-root"
      [class.drag-active]="isDraggingOver()"
      (dragenter)="onDragEnter($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <!-- Dropzone Drag Overlay -->
      @if (isDraggingOver()) {
        <div class="ave-drag-overlay">
          <div class="ave-drag-card">
            <span class="ave-drag-icon">📥</span>
            <div class="ave-drag-title">Drop files to copy to assets</div>
            <div class="ave-drag-dest">
              Target: <code>{{ currentPath() ? 'assets/' + currentPath() : 'assets/' }}</code>
            </div>
          </div>
        </div>
      }

      <!-- Top Action Toolbar -->
      <div class="ave-library-toolbar">
        <div class="ave-toolbar-left">
          <div class="ave-view-toggle-group">
            <button
              type="button"
              class="ave-toggle-btn"
              [class.active]="viewMode() === 'grid'"
              (click)="viewMode.set('grid')"
              title="Grid View (Thumbnails)"
            >
              ⊞ Grid
            </button>
            <button
              type="button"
              class="ave-toggle-btn"
              [class.active]="viewMode() === 'list'"
              (click)="viewMode.set('list')"
              title="List View (Details)"
            >
              ☰ List
            </button>
          </div>
        </div>

        <div class="ave-toolbar-right">
          <button
            type="button"
            class="ave-tool-btn"
            (click)="openNewFolderPrompt()"
            title="Create new subfolder in current directory"
          >
            <span class="ave-btn-icon">📁+</span>
            <span class="ave-btn-text">Folder</span>
          </button>
          <button
            type="button"
            class="ave-tool-btn ave-upload-btn"
            (click)="triggerFilePicker()"
            title="Upload assets into current directory (or drag & drop anywhere)"
          >
            <span class="ave-btn-icon">⬆️</span>
            <span class="ave-btn-text">Upload</span>
          </button>
          <button
            type="button"
            class="ave-icon-btn"
            (click)="loadAssets(currentPath())"
            title="Refresh assets"
          >
            🔄
          </button>
        </div>
      </div>

      <!-- Hidden Native File Input -->
      <input
        #filePicker
        type="file"
        multiple
        (change)="onFilePickerChange($event)"
        style="display: none;"
      />

      <!-- Breadcrumbs Path Navigator -->
      <div class="ave-breadcrumbs-row">
        <div class="ave-breadcrumbs-list">
          @for (crumb of breadcrumbs(); track crumb.path; let last = $last) {
            @if (!$first) {
              <span class="ave-crumb-sep">/</span>
            }
            <button
              type="button"
              class="ave-crumb-btn"
              [class.active]="last"
              (click)="navigateToFolder(crumb.path)"
              [title]="'Jump to assets/' + crumb.path"
            >
              @if ($first) {
                <span class="ave-root-icon">📁</span>
              }
              <span>{{ crumb.name }}</span>
            </button>
          }
        </div>

        @if (currentPath()) {
          <button
            type="button"
            class="ave-up-btn"
            (click)="navigateUp()"
            title="Go up to parent folder"
          >
            ⬆️ Up
          </button>
        }
      </div>

      <!-- Filter / Search Row -->
      <div class="ave-filter-row">
        <span class="ave-filter-lens">🔍</span>
        <input
          type="text"
          class="ave-filter-input"
          placeholder="Filter in this folder..."
          [value]="searchFilter()"
          (input)="searchFilter.set($any($event.target).value)"
        />
        @if (searchFilter()) {
          <button
            type="button"
            class="ave-filter-clear"
            (click)="searchFilter.set('')"
            title="Clear filter"
          >
            ✕
          </button>
        }
      </div>

      <!-- Uploading Status Banner -->
      @if (isUploading()) {
        <div class="ave-upload-banner">
          <span class="ave-spin-icon">⏳</span>
          <span class="ave-upload-text">{{ uploadProgress() || 'Uploading assets...' }}</span>
        </div>
      }

      <!-- Copied Path Notification Toast -->
      @if (copiedMessage()) {
        <div class="ave-copy-toast">
          ✓ {{ copiedMessage() }}
        </div>
      }

      <!-- New Folder Inline Prompt Form -->
      @if (isCreatingFolder()) {
        <div class="ave-folder-create-card">
          <div class="ave-folder-create-header">
            <span class="ave-folder-create-icon">📁</span>
            <span class="ave-folder-create-title">New Folder Name</span>
          </div>
          <div class="ave-folder-create-input-row">
            <input
              #newFolderInput
              type="text"
              class="ave-folder-create-input"
              [(ngModel)]="newFolderName"
              placeholder="e.g. icons, backgrounds, sound-fx"
              (keydown.enter)="confirmCreateFolder()"
              (keydown.escape)="cancelCreateFolder()"
            />
            <button
              type="button"
              class="ave-btn-primary ave-sm-btn"
              (click)="confirmCreateFolder()"
              [disabled]="!newFolderName.trim()"
            >
              Create
            </button>
            <button
              type="button"
              class="ave-btn-subtle ave-sm-btn"
              (click)="cancelCreateFolder()"
            >
              ✕
            </button>
          </div>
          @if (folderError()) {
            <span class="ave-error-msg">{{ folderError() }}</span>
          }
        </div>
      }

      <!-- Rename Item Modal / Inline Card -->
      @if (renamingItem(); as item) {
        <div class="ave-rename-card">
          <div class="ave-rename-header">
            <span>✏️ Rename {{ item.type === 'folder' ? 'Folder' : 'File' }}</span>
          </div>
          <div class="ave-rename-input-row">
            <input
              #renameInput
              type="text"
              class="ave-rename-input"
              [(ngModel)]="renameValue"
              (keydown.enter)="confirmRename()"
              (keydown.escape)="cancelRename()"
            />
            <button
              type="button"
              class="ave-btn-primary ave-sm-btn"
              (click)="confirmRename()"
              [disabled]="!renameValue.trim() || renameValue.trim() === item.currentName"
            >
              Save
            </button>
            <button
              type="button"
              class="ave-btn-subtle ave-sm-btn"
              (click)="cancelRename()"
            >
              ✕
            </button>
          </div>
          @if (renameError()) {
            <span class="ave-error-msg">{{ renameError() }}</span>
          }
        </div>
      }

      <!-- Delete Confirmation Dialog -->
      @if (itemToDelete(); as item) {
        <div class="ave-delete-modal-overlay" (click)="cancelDelete()">
          <div class="ave-delete-modal-card" (click)="$event.stopPropagation()">
            <div class="ave-delete-modal-header">
              <span class="ave-delete-modal-icon">⚠️</span>
              <h4>Delete {{ item.type === 'folder' ? 'Folder' : 'Asset' }}?</h4>
            </div>
            <p class="ave-delete-modal-text">
              Are you sure you want to delete
              <strong>{{ item.name }}</strong>?
              @if (item.type === 'folder') {
                <span class="ave-delete-warn">All contents inside this folder will be permanently deleted.</span>
              }
            </p>
            <div class="ave-delete-modal-actions">
              <button
                type="button"
                class="ave-btn-subtle"
                (click)="cancelDelete()"
              >
                Cancel
              </button>
              <button
                type="button"
                class="ave-btn-danger"
                (click)="confirmDelete()"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Media Preview Lightbox Modal -->
      @if (previewModalItem(); as item) {
        <div class="ave-preview-modal-overlay" (click)="closePreviewModal()">
          <div class="ave-preview-modal-card" (click)="$event.stopPropagation()">
            <div class="ave-preview-modal-header">
              <span class="ave-preview-title">{{ item.name }}</span>
              <button
                type="button"
                class="ave-preview-close-btn"
                (click)="closePreviewModal()"
              >
                ✕
              </button>
            </div>
            <div class="ave-preview-modal-body">
              @if (item.type === 'image') {
                <img [src]="item.url" class="ave-modal-img" [alt]="item.name" />
              } @else if (item.type === 'video') {
                <video [src]="item.url" controls autoplay loop class="ave-modal-video"></video>
              } @else if (item.type === 'audio') {
                <div class="ave-modal-audio-player">
                  <span class="ave-modal-audio-icon">🎵</span>
                  <audio [src]="item.url" controls autoplay class="ave-native-audio-controls"></audio>
                </div>
              } @else {
                <div class="ave-modal-other">
                  <span class="ave-modal-doc-icon">📄</span>
                  <span>{{ item.extension.toUpperCase() }} File</span>
                </div>
              }
            </div>
            <div class="ave-preview-modal-footer">
              <span class="ave-modal-meta">{{ item.formattedSize }} • {{ item.extension }}</span>
              <div class="ave-modal-actions">
                <button
                  type="button"
                  class="ave-btn-subtle ave-sm-btn"
                  (click)="copyAssetPath(item.path)"
                >
                  📋 Copy Path
                </button>
                <button
                  type="button"
                  class="ave-btn-primary ave-sm-btn"
                  (click)="copyCodeSnippet(item)"
                >
                  💻 Copy Tag
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Content Area: Folders & Files -->
      <div class="ave-library-content">
        @if (isLoading()) {
          <div class="ave-loading-state">
            <span class="ave-spin-icon">●</span> Loading assets...
          </div>
        } @else if (filteredFolders().length === 0 && filteredFiles().length === 0) {
          <!-- Empty State Drop Target -->
          <div class="ave-empty-state" (click)="triggerFilePicker()">
            <div class="ave-empty-icon">📁</div>
            <div class="ave-empty-title">
              @if (searchFilter()) {
                No items match "{{ searchFilter() }}"
              } @else {
                This folder is empty
              }
            </div>
            <p class="ave-empty-desc">
              Drag and drop media files directly here, or click to upload
            </p>
            <button
              type="button"
              class="ave-btn-primary ave-empty-btn"
              (click)="$event.stopPropagation(); triggerFilePicker()"
            >
              ⬆️ Browse Files
            </button>
          </div>
        } @else {
          <!-- ================= GRID VIEW ================= -->
          @if (viewMode() === 'grid') {
            <div class="ave-grid-container">
              <!-- Folders (Grid) -->
              @for (folder of filteredFolders(); track folder.path) {
                <div
                  class="ave-grid-folder-card"
                  (click)="navigateToFolder(folder.path)"
                  [title]="'Open folder ' + folder.name + ' (' + folder.itemCount + ' items)'"
                >
                  <div class="ave-grid-folder-icon-wrapper">
                    <span class="ave-grid-folder-icon">📁</span>
                    <span class="ave-folder-badge">{{ folder.itemCount }}</span>
                  </div>
                  <div class="ave-grid-folder-name" [title]="folder.name">{{ folder.name }}</div>

                  <!-- Quick Actions on Folder Hover -->
                  <div class="ave-card-actions" (click)="$event.stopPropagation()">
                    <button
                      type="button"
                      class="ave-card-action-btn"
                      (click)="startRename('folder', folder.path, folder.name, $event)"
                      title="Rename folder"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      class="ave-card-action-btn ave-card-delete-btn"
                      (click)="startDelete('folder', folder.path, folder.name, $event)"
                      title="Delete folder"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              }

              <!-- Files (Grid) -->
              @for (file of filteredFiles(); track file.path) {
                <div
                  class="ave-grid-file-card"
                  (dblclick)="openPreviewModal(file)"
                  [title]="file.name + ' (' + file.formattedSize + ')'"
                >
                  <!-- Media Thumbnail / Preview Area -->
                  <div class="ave-grid-thumb-box" (click)="openPreviewModal(file)">
                    @if (file.type === 'image') {
                      <img
                        [src]="file.url"
                        loading="lazy"
                        [alt]="file.name"
                        class="ave-grid-img-thumb"
                      />
                    } @else if (file.type === 'video') {
                      <video
                        [src]="file.url"
                        preload="metadata"
                        muted
                        playsinline
                        class="ave-grid-video-thumb"
                        (mouseenter)="onVideoHoverStart($event)"
                        (mouseleave)="onVideoHoverEnd($event)"
                      ></video>
                      <span class="ave-video-badge">🎥</span>
                    } @else if (file.type === 'audio') {
                      <div
                        class="ave-audio-thumb"
                        (click)="toggleAudioPlay(file.url, $event)"
                        title="Click to preview audio"
                      >
                        <span class="ave-audio-play-icon">
                          {{ isAudioPlaying(file.url) ? '⏸️' : '▶️' }}
                        </span>
                        <div class="ave-audio-waves" [class.playing]="isAudioPlaying(file.url)">
                          <span></span><span></span><span></span><span></span>
                        </div>
                      </div>
                    } @else {
                      <div class="ave-other-thumb">
                        <span class="ave-other-icon">📄</span>
                      </div>
                    }

                    <!-- Top-right Quick Copy Path Button -->
                    <button
                      type="button"
                      class="ave-quick-copy-btn"
                      (click)="copyAssetPath(file.path, $event)"
                      title="Copy path (assets/{{ file.path }})"
                    >
                      📋
                    </button>
                  </div>

                  <!-- File Details Bottom -->
                  <div class="ave-grid-file-info">
                    <div class="ave-grid-file-name" [title]="file.name">{{ file.name }}</div>
                    <div class="ave-grid-file-meta">
                      <span class="ave-file-size">{{ file.formattedSize }}</span>
                      <span class="ave-file-ext-tag">{{ file.extension.replace('.', '') }}</span>
                    </div>
                  </div>

                  <!-- Quick Hover Actions -->
                  <div class="ave-card-actions" (click)="$event.stopPropagation()">
                    <button
                      type="button"
                      class="ave-card-action-btn"
                      (click)="openPreviewModal(file)"
                      title="Preview asset"
                    >
                      🔍
                    </button>
                    <button
                      type="button"
                      class="ave-card-action-btn"
                      (click)="startRename('file', file.path, file.name, $event)"
                      title="Rename file"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      class="ave-card-action-btn ave-card-delete-btn"
                      (click)="startDelete('file', file.path, file.name, $event)"
                      title="Delete file"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- ================= LIST VIEW ================= -->
          @if (viewMode() === 'list') {
            <div class="ave-list-container">
              <!-- Folders (List) -->
              @for (folder of filteredFolders(); track folder.path) {
                <div
                  class="ave-list-row ave-list-folder-row"
                  (click)="navigateToFolder(folder.path)"
                  [title]="'Open folder ' + folder.name"
                >
                  <div class="ave-list-main-col">
                    <span class="ave-list-icon">📁</span>
                    <span class="ave-list-item-name">{{ folder.name }}</span>
                  </div>
                  <div class="ave-list-meta-col">
                    <span class="ave-list-count-badge">{{ folder.itemCount }} items</span>
                  </div>
                  <div class="ave-list-actions-col" (click)="$event.stopPropagation()">
                    <button
                      type="button"
                      class="ave-list-action-btn"
                      (click)="startRename('folder', folder.path, folder.name, $event)"
                      title="Rename folder"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      class="ave-list-action-btn ave-card-delete-btn"
                      (click)="startDelete('folder', folder.path, folder.name, $event)"
                      title="Delete folder"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              }

              <!-- Files (List) -->
              @for (file of filteredFiles(); track file.path) {
                <div
                  class="ave-list-row ave-list-file-row"
                  (dblclick)="openPreviewModal(file)"
                  [title]="file.name"
                >
                  <div class="ave-list-main-col" (click)="openPreviewModal(file)">
                    <!-- Mini Thumbnail -->
                    <div class="ave-list-thumb-wrapper">
                      @if (file.type === 'image') {
                        <img [src]="file.url" class="ave-list-mini-thumb" [alt]="file.name" />
                      } @else if (file.type === 'video') {
                        <span class="ave-list-icon">🎥</span>
                      } @else if (file.type === 'audio') {
                        <span
                          class="ave-list-icon ave-clickable-audio"
                          (click)="toggleAudioPlay(file.url, $event)"
                          title="Preview audio"
                        >
                          {{ isAudioPlaying(file.url) ? '⏸️' : '🎵' }}
                        </span>
                      } @else {
                        <span class="ave-list-icon">📄</span>
                      }
                    </div>

                    <div class="ave-list-text-wrapper">
                      <span class="ave-list-item-name" [title]="file.name">{{ file.name }}</span>
                      <span class="ave-list-sub-meta">{{ file.formattedSize }}</span>
                    </div>
                  </div>

                  <div class="ave-list-actions-col" (click)="$event.stopPropagation()">
                    <button
                      type="button"
                      class="ave-list-action-btn"
                      (click)="copyAssetPath(file.path, $event)"
                      title="Copy path (assets/{{ file.path }})"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      class="ave-list-action-btn"
                      (click)="openPreviewModal(file)"
                      title="Preview asset"
                    >
                      🔍
                    </button>
                    <button
                      type="button"
                      class="ave-list-action-btn"
                      (click)="startRename('file', file.path, file.name, $event)"
                      title="Rename file"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      class="ave-list-action-btn ave-card-delete-btn"
                      (click)="startDelete('file', file.path, file.name, $event)"
                      title="Delete file"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        }
      </div>

      <!-- Footer Stats -->
      <div class="ave-library-footer">
        <span class="ave-stats-text">
          {{ filteredFolders().length }} folders, {{ filteredFiles().length }} files
        </span>
        <span class="ave-drag-hint">Drag & drop files to copy</span>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      width: 100%;
      min-height: 0;
      color: #e2e8f0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
    }

    .ave-asset-library-root {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      position: relative;
      gap: 10px;
      user-select: none;
      box-sizing: border-box;

      &.drag-active {
        outline: 2px dashed #00d2ff;
        outline-offset: -2px;
        background: rgba(0, 210, 255, 0.04);
        border-radius: 8px;
      }
    }

    /* Drag Overlay */
    .ave-drag-overlay {
      position: absolute;
      inset: 0;
      background: rgba(10, 12, 22, 0.92);
      backdrop-filter: blur(4px);
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px dashed #00d2ff;
      border-radius: 8px;
      pointer-events: none;
      animation: fadeIn 0.15s ease-out;
    }

    .ave-drag-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      padding: 24px;
    }

    .ave-drag-icon {
      font-size: 38px;
      animation: bounce 1s infinite alternate;
    }

    .ave-drag-title {
      font-size: 15px;
      font-weight: 600;
      color: #00d2ff;
    }

    .ave-drag-dest {
      font-size: 12px;
      color: #94a3b8;
      code {
        color: #38bdf8;
        background: #181c2f;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
      }
    }

    /* Toolbar */
    .ave-library-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }

    .ave-view-toggle-group {
      display: inline-flex;
      background: #181b29;
      border: 1px solid #282d47;
      border-radius: 6px;
      padding: 2px;
    }

    .ave-toggle-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background: #252b47;
        color: #f8fafc;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }

      &:hover:not(.active) {
        color: #e2e8f0;
      }
    }

    .ave-toolbar-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ave-tool-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #1a1e33;
      border: 1px solid #2d3455;
      color: #e2e8f0;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 9px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #272e4f;
        border-color: #4a5585;
      }
    }

    .ave-upload-btn {
      background: linear-gradient(135deg, rgba(0, 210, 255, 0.15), rgba(124, 77, 255, 0.15));
      border-color: rgba(0, 210, 255, 0.4);
      color: #38bdf8;

      &:hover {
        background: linear-gradient(135deg, rgba(0, 210, 255, 0.25), rgba(124, 77, 255, 0.25));
        border-color: #00d2ff;
        color: #ffffff;
      }
    }

    .ave-icon-btn {
      background: transparent;
      border: 1px solid transparent;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: #1f243b;
        color: #f1f5f9;
        border-color: #2d3455;
      }
    }

    /* Breadcrumbs */
    .ave-breadcrumbs-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      background: #141726;
      border: 1px solid #1f243b;
      padding: 4px 8px;
      border-radius: 6px;
      min-height: 30px;
    }

    .ave-breadcrumbs-list {
      display: flex;
      align-items: center;
      gap: 4px;
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }

    .ave-crumb-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 500;
      padding: 2px 4px;
      border-radius: 3px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      transition: all 0.15s ease;

      &.active {
        color: #38bdf8;
        font-weight: 600;
      }

      &:hover:not(.active) {
        color: #f1f5f9;
        background: #1f253d;
      }
    }

    .ave-crumb-sep {
      color: #475569;
      font-size: 11px;
    }

    .ave-up-btn {
      background: #1f253d;
      border: 1px solid #2d3658;
      color: #cbd5e1;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
      flex-shrink: 0;

      &:hover {
        background: #2b3356;
        color: #ffffff;
      }
    }

    /* Filter */
    .ave-filter-row {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #141726;
      border: 1px solid #22273f;
      border-radius: 6px;
      padding: 4px 8px;

      &:focus-within {
        border-color: #00d2ff;
        box-shadow: 0 0 0 1px rgba(0, 210, 255, 0.2);
      }
    }

    .ave-filter-lens {
      font-size: 11px;
      opacity: 0.6;
    }

    .ave-filter-input {
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

    .ave-filter-clear {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 11px;
      padding: 0 2px;

      &:hover {
        color: #f1f5f9;
      }
    }

    /* Upload & Copy Status */
    .ave-upload-banner {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 210, 255, 0.12);
      border: 1px solid rgba(0, 210, 255, 0.3);
      color: #38bdf8;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      animation: fadeIn 0.15s ease;
    }

    .ave-copy-toast {
      background: rgba(0, 230, 118, 0.15);
      border: 1px solid rgba(0, 230, 118, 0.4);
      color: #4ade80;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      animation: fadeIn 0.15s ease;
    }

    /* Folder Create & Rename Cards */
    .ave-folder-create-card,
    .ave-rename-card {
      background: #181c2e;
      border: 1px solid #2d3658;
      border-radius: 6px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      animation: fadeIn 0.15s ease;
    }

    .ave-folder-create-header,
    .ave-rename-header {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .ave-folder-create-input-row,
    .ave-rename-input-row {
      display: flex;
      gap: 6px;
    }

    .ave-folder-create-input,
    .ave-rename-input {
      flex: 1;
      background: #0f121d;
      border: 1px solid #2b3353;
      border-radius: 4px;
      color: #f8fafc;
      padding: 4px 8px;
      font-size: 12px;
      outline: none;

      &:focus {
        border-color: #00d2ff;
      }
    }

    .ave-btn-primary {
      background: #0284c7;
      border: none;
      color: #ffffff;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      transition: background 0.15s;

      &:hover:not(:disabled) {
        background: #0369a1;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .ave-btn-subtle {
      background: #1e2439;
      border: 1px solid #2d3554;
      color: #94a3b8;
      font-weight: 500;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;

      &:hover {
        background: #28304f;
        color: #f1f5f9;
      }
    }

    .ave-btn-danger {
      background: #dc2626;
      border: none;
      color: #ffffff;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;

      &:hover {
        background: #b91c1c;
      }
    }

    .ave-sm-btn {
      padding: 3px 8px;
      font-size: 11px;
    }

    .ave-error-msg {
      color: #f87171;
      font-size: 11px;
    }

    /* Content Area */
    .ave-library-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #272c44 #12131d;
      padding-right: 2px;
    }

    .ave-loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 36px 0;
      color: #64748b;
      font-size: 12px;
    }

    /* Empty State */
    .ave-empty-state {
      border: 1px dashed #262c47;
      border-radius: 8px;
      padding: 32px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 8px;
      cursor: pointer;
      background: rgba(20, 24, 38, 0.4);
      transition: all 0.2s ease;

      &:hover {
        border-color: #3b456f;
        background: rgba(25, 30, 48, 0.6);
      }
    }

    .ave-empty-icon {
      font-size: 32px;
      opacity: 0.7;
    }

    .ave-empty-title {
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
    }

    .ave-empty-desc {
      font-size: 11px;
      color: #64748b;
      max-width: 220px;
      margin: 0;
      line-height: 1.4;
    }

    .ave-empty-btn {
      margin-top: 6px;
    }

    /* ================= GRID VIEW STYLES ================= */
    .ave-grid-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    /* Folder Card in Grid */
    .ave-grid-folder-card {
      background: #161928;
      border: 1px solid #232840;
      border-radius: 6px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      cursor: pointer;
      position: relative;
      transition: all 0.15s ease;

      &:hover {
        background: #1c2136;
        border-color: #373f66;

        .ave-card-actions {
          opacity: 1;
        }
      }
    }

    .ave-grid-folder-icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ave-grid-folder-icon {
      font-size: 22px;
    }

    .ave-folder-badge {
      font-size: 10px;
      color: #94a3b8;
      background: #232842;
      padding: 1px 6px;
      border-radius: 10px;
    }

    .ave-grid-folder-name {
      font-size: 11px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* File Card in Grid */
    .ave-grid-file-card {
      background: #161928;
      border: 1px solid #232840;
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: all 0.15s ease;

      &:hover {
        border-color: #373f66;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        .ave-card-actions {
          opacity: 1;
        }
        .ave-quick-copy-btn {
          opacity: 1;
        }
      }
    }

    .ave-grid-thumb-box {
      width: 100%;
      height: 90px;
      background: #0f111c;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      overflow: hidden;
    }

    .ave-grid-img-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .ave-grid-video-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      background: #000;
    }

    .ave-video-badge {
      position: absolute;
      bottom: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.75);
      border-radius: 4px;
      padding: 1px 4px;
      font-size: 10px;
      pointer-events: none;
    }

    .ave-quick-copy-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(15, 17, 28, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #f1f5f9;
      border-radius: 4px;
      font-size: 10px;
      padding: 2px 4px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s ease;

      &:hover {
        background: #0284c7;
        border-color: #0284c7;
      }
    }

    /* Audio Thumbnail */
    .ave-audio-thumb {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #181d33, #1e1b38);
      cursor: pointer;
    }

    .ave-audio-play-icon {
      font-size: 20px;
      transition: transform 0.15s;
      &:hover {
        transform: scale(1.15);
      }
    }

    .ave-audio-waves {
      display: flex;
      align-items: center;
      gap: 3px;
      height: 12px;

      span {
        display: block;
        width: 3px;
        height: 4px;
        background: #00d2ff;
        border-radius: 2px;
      }

      &.playing span {
        animation: waveBounce 0.8s infinite ease-in-out alternate;
        &:nth-child(2) { animation-delay: 0.2s; height: 10px; }
        &:nth-child(3) { animation-delay: 0.4s; height: 12px; }
        &:nth-child(4) { animation-delay: 0.6s; height: 6px; }
      }
    }

    .ave-other-thumb {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: #141726;
    }

    .ave-other-icon {
      font-size: 26px;
      opacity: 0.6;
    }

    .ave-grid-file-info {
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      background: #161928;
    }

    .ave-grid-file-name {
      font-size: 11px;
      font-weight: 500;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ave-grid-file-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
    }

    .ave-file-ext-tag {
      background: #20263f;
      color: #94a3b8;
      padding: 0 4px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
    }

    /* Card Actions (Hover) */
    .ave-card-actions {
      position: absolute;
      bottom: 24px;
      right: 4px;
      display: flex;
      align-items: center;
      gap: 2px;
      background: rgba(15, 17, 28, 0.9);
      backdrop-filter: blur(4px);
      border: 1px solid #2d3455;
      border-radius: 4px;
      padding: 1px;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 5;
    }

    .ave-card-action-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 10px;
      padding: 2px 4px;
      cursor: pointer;
      border-radius: 3px;

      &:hover {
        background: #252b47;
        color: #ffffff;
      }
    }

    .ave-card-delete-btn:hover {
      background: #dc2626 !important;
      color: #ffffff !important;
    }

    /* ================= LIST VIEW STYLES ================= */
    .ave-list-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ave-list-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #161928;
      border: 1px solid #22263d;
      border-radius: 5px;
      padding: 6px 8px;
      gap: 8px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #1c2136;
        border-color: #343c61;

        .ave-list-actions-col {
          opacity: 1;
        }
      }
    }

    .ave-list-main-col {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .ave-list-thumb-wrapper {
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: #0f111c;
      border-radius: 3px;
      overflow: hidden;
    }

    .ave-list-mini-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .ave-list-icon {
      font-size: 14px;
    }

    .ave-clickable-audio {
      cursor: pointer;
      &:hover { transform: scale(1.2); }
    }

    .ave-list-text-wrapper {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .ave-list-item-name {
      font-size: 11px;
      font-weight: 500;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ave-list-sub-meta {
      font-size: 10px;
      color: #64748b;
    }

    .ave-list-meta-col {
      flex-shrink: 0;
    }

    .ave-list-count-badge {
      font-size: 10px;
      color: #94a3b8;
      background: #232842;
      padding: 1px 6px;
      border-radius: 10px;
    }

    .ave-list-actions-col {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      opacity: 0.3;
      transition: opacity 0.15s ease;
    }

    .ave-list-action-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 11px;
      padding: 2px 4px;
      border-radius: 3px;
      cursor: pointer;

      &:hover {
        background: #252b47;
        color: #ffffff;
      }
    }

    /* Modals & Dialogs */
    .ave-delete-modal-overlay,
    .ave-preview-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(7, 8, 15, 0.8);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.15s ease;
    }

    .ave-delete-modal-card {
      background: #181b2a;
      border: 1px solid #373f63;
      border-radius: 8px;
      padding: 16px;
      width: 100%;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }

    .ave-delete-modal-header {
      display: flex;
      align-items: center;
      gap: 8px;

      h4 {
        margin: 0;
        font-size: 14px;
        color: #f8fafc;
      }
    }

    .ave-delete-modal-icon {
      font-size: 18px;
    }

    .ave-delete-modal-text {
      margin: 0;
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.4;
    }

    .ave-delete-warn {
      display: block;
      margin-top: 6px;
      color: #f87171;
      font-size: 11px;
    }

    .ave-delete-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    /* Preview Lightbox */
    .ave-preview-modal-card {
      background: #151827;
      border: 1px solid #2e3557;
      border-radius: 8px;
      max-width: 480px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
    }

    .ave-preview-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid #232840;
    }

    .ave-preview-title {
      font-size: 12px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ave-preview-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 14px;
      cursor: pointer;
      &:hover { color: #ffffff; }
    }

    .ave-preview-modal-body {
      padding: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0d0f1a;
      max-height: 380px;
      overflow: hidden;
    }

    .ave-modal-img {
      max-width: 100%;
      max-height: 340px;
      object-fit: contain;
      border-radius: 4px;
    }

    .ave-modal-video {
      max-width: 100%;
      max-height: 340px;
      border-radius: 4px;
    }

    .ave-modal-audio-player {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px;
    }

    .ave-modal-audio-icon {
      font-size: 48px;
    }

    .ave-modal-other {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px;
      color: #94a3b8;
    }

    .ave-modal-doc-icon {
      font-size: 42px;
    }

    .ave-preview-modal-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-top: 1px solid #232840;
      background: #151827;
    }

    .ave-modal-meta {
      font-size: 11px;
      color: #64748b;
    }

    .ave-modal-actions {
      display: flex;
      gap: 6px;
    }

    /* Footer Stats */
    .ave-library-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 6px;
      border-top: 1px solid #1c2035;
      font-size: 10px;
      color: #64748b;
    }

    .ave-drag-hint {
      color: #475569;
    }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes bounce {
      from { transform: translateY(0); }
      to { transform: translateY(-6px); }
    }

    @keyframes waveBounce {
      0% { height: 3px; }
      100% { height: 12px; }
    }
  `]
})
export class AveAssetLibraryComponent implements OnInit, OnDestroy {
  @ViewChild('filePicker') filePicker?: ElementRef<HTMLInputElement>;
  @ViewChild('newFolderInput') newFolderInput?: ElementRef<HTMLInputElement>;
  @ViewChild('renameInput') renameInput?: ElementRef<HTMLInputElement>;

  // View state
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly currentPath = signal<string>('');
  readonly breadcrumbs = signal<{ name: string; path: string }[]>([{ name: 'Assets', path: '' }]);
  readonly folders = signal<AssetFolder[]>([]);
  readonly files = signal<AssetFile[]>([]);
  readonly searchFilter = signal<string>('');

  // Status signals
  readonly isLoading = signal<boolean>(false);
  readonly isUploading = signal<boolean>(false);
  readonly uploadProgress = signal<string>('');
  readonly copiedMessage = signal<string | null>(null);

  // Drag and drop tracking
  readonly isDraggingOver = signal<boolean>(false);
  private dragCounter = 0;

  // Folder creation
  readonly isCreatingFolder = signal<boolean>(false);
  newFolderName = '';
  readonly folderError = signal<string | null>(null);

  // Renaming
  readonly renamingItem = signal<{ type: 'folder' | 'file'; path: string; currentName: string } | null>(null);
  renameValue = '';
  readonly renameError = signal<string | null>(null);

  // Deletion
  readonly itemToDelete = signal<{ type: 'folder' | 'file'; path: string; name: string } | null>(null);

  // Lightbox preview
  readonly previewModalItem = signal<AssetFile | null>(null);

  // Audio preview playback
  readonly currentlyPlayingAudio = signal<string | null>(null);
  private audioPlayer: HTMLAudioElement | null = null;
  private copyTimeout: any = null;

  // Filtered views
  readonly filteredFolders = computed(() => {
    const q = this.searchFilter().toLowerCase().trim();
    if (!q) return this.folders();
    return this.folders().filter(f => f.name.toLowerCase().includes(q));
  });

  readonly filteredFiles = computed(() => {
    const q = this.searchFilter().toLowerCase().trim();
    if (!q) return this.files();
    return this.files().filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.extension.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.loadAssets('');
    if (typeof window !== 'undefined') {
      this.audioPlayer = new Audio();
      this.audioPlayer.addEventListener('ended', () => {
        this.currentlyPlayingAudio.set(null);
      });
    }
  }

  ngOnDestroy(): void {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.src = '';
      this.audioPlayer = null;
    }
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }

  async loadAssets(relPath: string = ''): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await fetch(`/api/assets?path=${encodeURIComponent(relPath)}`);
      if (res.ok) {
        const data: AssetListResult = await res.json();
        this.currentPath.set(data.currentPath || '');
        this.breadcrumbs.set(data.breadcrumbs || [{ name: 'Assets', path: '' }]);
        this.folders.set(data.folders || []);
        this.files.set(data.files || []);
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  navigateToFolder(relPath: string): void {
    this.searchFilter.set('');
    this.loadAssets(relPath);
  }

  navigateUp(): void {
    const crumbs = this.breadcrumbs();
    if (crumbs.length > 1) {
      const parentCrumb = crumbs[crumbs.length - 2];
      this.navigateToFolder(parentCrumb.path);
    } else {
      this.navigateToFolder('');
    }
  }

  // File Picker Trigger
  triggerFilePicker(): void {
    this.filePicker?.nativeElement.click();
  }

  onFilePickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadFiles(Array.from(input.files));
      input.value = ''; // reset so same files can be re-selected if needed
    }
  }

  // HTML5 Drag and Drop Handlers
  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter++;
    this.isDraggingOver.set(true);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter--;
    if (this.dragCounter <= 0) {
      this.dragCounter = 0;
      this.isDraggingOver.set(false);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter = 0;
    this.isDraggingOver.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.uploadFiles(Array.from(event.dataTransfer.files));
    }
  }

  // Binary streaming upload directly to Node.js backend
  async uploadFiles(fileList: File[]): Promise<void> {
    if (fileList.length === 0) return;
    this.isUploading.set(true);

    const total = fileList.length;
    let uploaded = 0;

    for (const file of fileList) {
      uploaded++;
      this.uploadProgress.set(`Uploading ${file.name} (${uploaded}/${total})...`);
      try {
        await fetch('/api/assets/upload', {
          method: 'POST',
          headers: {
            'x-asset-path': encodeURIComponent(this.currentPath()),
            'x-asset-filename': encodeURIComponent(file.name)
          },
          body: file
        });
      } catch (err) {
        console.error('Failed to upload file:', file.name, err);
      }
    }

    this.isUploading.set(false);
    this.uploadProgress.set('');
    this.showToast(`Uploaded ${total} ${total === 1 ? 'file' : 'files'}`);
    await this.loadAssets(this.currentPath());
  }

  // Folder Creation
  openNewFolderPrompt(): void {
    this.newFolderName = '';
    this.folderError.set(null);
    this.isCreatingFolder.set(true);
    setTimeout(() => this.newFolderInput?.nativeElement.focus(), 50);
  }

  cancelCreateFolder(): void {
    this.isCreatingFolder.set(false);
    this.newFolderName = '';
    this.folderError.set(null);
  }

  async confirmCreateFolder(): Promise<void> {
    const name = this.newFolderName.trim();
    if (!name) return;

    try {
      const res = await fetch('/api/assets/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: this.currentPath(),
          folderName: name
        })
      });
      const data = await res.json();
      if (data.success) {
        this.isCreatingFolder.set(false);
        this.newFolderName = '';
        this.folderError.set(null);
        this.showToast(`Folder "${name}" created`);
        await this.loadAssets(this.currentPath());
      } else {
        this.folderError.set(data.error || 'Failed to create folder');
      }
    } catch (err: any) {
      this.folderError.set(err.message || 'Error creating folder');
    }
  }

  // Renaming
  startRename(type: 'folder' | 'file', path: string, currentName: string, event: Event): void {
    event.stopPropagation();
    this.renameError.set(null);
    this.renameValue = currentName;
    this.renamingItem.set({ type, path, currentName });
    setTimeout(() => this.renameInput?.nativeElement.focus(), 50);
  }

  cancelRename(): void {
    this.renamingItem.set(null);
    this.renameValue = '';
    this.renameError.set(null);
  }

  async confirmRename(): Promise<void> {
    const item = this.renamingItem();
    if (!item) return;
    const newName = this.renameValue.trim();
    if (!newName || newName === item.currentName) {
      this.cancelRename();
      return;
    }

    try {
      const res = await fetch('/api/assets/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPath: item.path,
          newName
        })
      });
      const data = await res.json();
      if (data.success) {
        this.cancelRename();
        this.showToast(`Renamed to "${newName}"`);
        await this.loadAssets(this.currentPath());
      } else {
        this.renameError.set(data.error || 'Failed to rename');
      }
    } catch (err: any) {
      this.renameError.set(err.message || 'Error renaming');
    }
  }

  // Deletion
  startDelete(type: 'folder' | 'file', path: string, name: string, event: Event): void {
    event.stopPropagation();
    this.itemToDelete.set({ type, path, name });
  }

  cancelDelete(): void {
    this.itemToDelete.set(null);
  }

  async confirmDelete(): Promise<void> {
    const item = this.itemToDelete();
    if (!item) return;

    try {
      const res = await fetch('/api/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path })
      });
      const data = await res.json();
      if (data.success) {
        this.cancelDelete();
        this.showToast(`Deleted ${item.name}`);
        await this.loadAssets(this.currentPath());
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting');
    }
  }

  // Audio preview playback
  toggleAudioPlay(url: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.audioPlayer) return;

    if (this.currentlyPlayingAudio() === url) {
      this.audioPlayer.pause();
      this.currentlyPlayingAudio.set(null);
    } else {
      this.audioPlayer.src = url;
      this.audioPlayer.play().catch(() => {});
      this.currentlyPlayingAudio.set(url);
    }
  }

  isAudioPlaying(url: string): boolean {
    return this.currentlyPlayingAudio() === url;
  }

  // Video hover preview
  onVideoHoverStart(event: MouseEvent): void {
    const video = event.target as HTMLVideoElement;
    if (video && typeof video.play === 'function') {
      video.play().catch(() => {});
    }
  }

  onVideoHoverEnd(event: MouseEvent): void {
    const video = event.target as HTMLVideoElement;
    if (video && typeof video.pause === 'function') {
      video.pause();
      video.currentTime = 0;
    }
  }

  // Lightbox Modal
  openPreviewModal(file: AssetFile): void {
    this.previewModalItem.set(file);
  }

  closePreviewModal(): void {
    this.previewModalItem.set(null);
  }

  // Clipboard Helpers
  copyAssetPath(relPath: string, event?: Event): void {
    if (event) event.stopPropagation();
    const fullAssetPath = `assets/${relPath}`;
    navigator.clipboard?.writeText(fullAssetPath).then(() => {
      this.showToast(`Copied "${fullAssetPath}"`);
    });
  }

  copyCodeSnippet(file: AssetFile): void {
    let snippet = `assets/${file.path}`;
    if (file.type === 'image') {
      snippet = `<ave-image src="assets/${file.path}" />`;
    } else if (file.type === 'video') {
      snippet = `<ave-video src="assets/${file.path}" />`;
    } else if (file.type === 'audio') {
      snippet = `<ave-audio src="assets/${file.path}" />`;
    }

    navigator.clipboard?.writeText(snippet).then(() => {
      this.showToast(`Copied snippet: ${snippet}`);
    });
  }

  private showToast(msg: string): void {
    this.copiedMessage.set(msg);
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    this.copyTimeout = setTimeout(() => {
      this.copiedMessage.set(null);
    }, 2200);
  }
}
