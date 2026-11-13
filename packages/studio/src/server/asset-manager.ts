import fs from 'fs';
import path from 'path';

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

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.bmp']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.m4v']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a']);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getSafePath(baseDir: string, relativePath: string = ''): string | null {
  const normalized = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const resolved = path.resolve(baseDir, normalized);
  if (!resolved.startsWith(baseDir)) return null;
  return resolved;
}

export function listAssets(baseDir: string, relativePath: string = ''): AssetListResult {
  const targetDir = getSafePath(baseDir, relativePath);
  if (!targetDir || !fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    // If not exists, ensure baseDir exists
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return {
      currentPath: '',
      breadcrumbs: [{ name: 'Assets', path: '' }],
      folders: [],
      files: []
    };
  }

  // Build breadcrumbs
  const cleanRel = path.relative(baseDir, targetDir).replace(/\\/g, '/');
  const breadcrumbs: { name: string; path: string }[] = [{ name: 'Assets', path: '' }];
  if (cleanRel && cleanRel !== '.') {
    const segments = cleanRel.split('/');
    let accum = '';
    for (const seg of segments) {
      accum = accum ? `${accum}/${seg}` : seg;
      breadcrumbs.push({ name: seg, path: accum });
    }
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const folders: AssetFolder[] = [];
  const files: AssetFile[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // ignore hidden files
    const fullPath = path.join(targetDir, entry.name);
    const itemRel = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      let subCount = 0;
      try {
        subCount = fs.readdirSync(fullPath).filter(n => !n.startsWith('.')).length;
      } catch {}
      folders.push({
        name: entry.name,
        path: itemRel,
        itemCount: subCount
      });
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      let type: 'image' | 'video' | 'audio' | 'other' = 'other';
      if (IMAGE_EXTS.has(ext)) type = 'image';
      else if (VIDEO_EXTS.has(ext)) type = 'video';
      else if (AUDIO_EXTS.has(ext)) type = 'audio';

      const stats = fs.statSync(fullPath);
      files.push({
        name: entry.name,
        path: itemRel,
        url: `/assets/${itemRel}`,
        type,
        extension: ext,
        size: stats.size,
        formattedSize: formatFileSize(stats.size),
        modifiedAt: stats.mtimeMs
      });
    }
  }

  // Sort folders alphabetically, files alphabetically
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return {
    currentPath: cleanRel === '.' ? '' : cleanRel,
    breadcrumbs,
    folders,
    files
  };
}

export function createFolder(baseDir: string, relativePath: string, folderName: string): { success: boolean; error?: string } {
  const cleanName = folderName.trim().replace(/[\\/:*?"<>|]/g, '-');
  if (!cleanName) return { success: false, error: 'Invalid folder name' };

  const targetDir = getSafePath(baseDir, path.join(relativePath, cleanName));
  if (!targetDir) return { success: false, error: 'Invalid path' };

  if (fs.existsSync(targetDir)) {
    return { success: false, error: 'Folder already exists' };
  }

  try {
    fs.mkdirSync(targetDir, { recursive: true });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function renameAsset(baseDir: string, oldRelativePath: string, newName: string): { success: boolean; error?: string } {
  const cleanName = newName.trim().replace(/[\\/:*?"<>|]/g, '-');
  if (!cleanName) return { success: false, error: 'Invalid name' };

  const oldTarget = getSafePath(baseDir, oldRelativePath);
  if (!oldTarget || !fs.existsSync(oldTarget)) {
    return { success: false, error: 'Item does not exist' };
  }

  const parentDir = path.dirname(oldTarget);
  const newTarget = path.join(parentDir, cleanName);

  if (fs.existsSync(newTarget)) {
    return { success: false, error: 'An item with that name already exists' };
  }

  try {
    fs.renameSync(oldTarget, newTarget);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function deleteAsset(baseDir: string, relativePath: string): { success: boolean; error?: string } {
  const target = getSafePath(baseDir, relativePath);
  if (!target || !fs.existsSync(target)) {
    return { success: false, error: 'Item does not exist' };
  }

  // Never allow deleting the baseDir itself
  if (target === baseDir) {
    return { success: false, error: 'Cannot delete root assets directory' };
  }

  try {
    fs.rmSync(target, { recursive: true, force: true });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
