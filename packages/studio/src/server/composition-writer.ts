import fs from 'fs';
import path from 'path';

export function updateCompositionInFile(
  id: string,
  updates: {
    id?: string;
    title?: string;
    renderName?: string;
    width?: number;
    height?: number;
    fps?: number;
    durationInFrames?: number;
  },
  rootDir: string = process.cwd()
): { success: boolean; filePath?: string; error?: string } {
  const primaryPath = path.resolve(rootDir, 'src/videos/index.ts');
  const targetFiles = [primaryPath];

  // Also discover any other .ts files in src/videos if not in primary
  const videosDir = path.resolve(rootDir, 'src/videos');
  if (fs.existsSync(videosDir)) {
    const findTsFiles = (dir: string): string[] => {
      let results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(findTsFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.ts') && full !== primaryPath) {
          results.push(full);
        }
      }
      return results;
    };
    targetFiles.push(...findTsFiles(videosDir));
  }

  for (const filePath of targetFiles) {
    if (!fs.existsSync(filePath)) continue;
    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if this file contains the composition definition with this id
    const idPattern = new RegExp(`id:\\s*['"\`]${id}['"\`]`);
    if (!idPattern.test(content)) continue;

    // Locate the composition block starting near `id: '${id}'`
    const idMatch = idPattern.exec(content);
    if (!idMatch) continue;

    // Find the enclosing object or bounds
    const startIndex = content.lastIndexOf('{', idMatch.index);
    if (startIndex === -1) continue;

    // We locate the section corresponding to this composition up to the next composition object or tracks/end
    // Find matching closing brace or tracks
    let depth = 1;
    let endIndex = startIndex + 1;
    while (depth > 0 && endIndex < content.length) {
      if (content[endIndex] === '{') depth++;
      else if (content[endIndex] === '}') depth--;
      endIndex++;
    }

    let block = content.slice(startIndex, endIndex);

    // Update title if provided
    if (typeof updates.title === 'string' && updates.title.trim()) {
      const cleanTitle = updates.title.replace(/'/g, "\\'");
      if (/\btitle:\s*['"`]/.test(block)) {
        block = block.replace(/(\btitle:\s*)['"`][^'"`]*['"`]/, `$1'${cleanTitle}'`);
      } else {
        block = block.replace(/(\bid:\s*['"`][^'"`]*['"`],?)/, `$1\n    title: '${cleanTitle}',`);
      }
    }

    // Update renderName if provided
    if (typeof updates.renderName === 'string') {
      const cleanRender = updates.renderName.trim().replace(/'/g, "\\'");
      if (/\brenderName:\s*['"`]/.test(block)) {
        block = block.replace(/(\brenderName:\s*)['"`][^'"`]*['"`]/, `$1'${cleanRender}'`);
      } else if (cleanRender) {
        if (/\btitle:\s*['"`]/.test(block)) {
          block = block.replace(/(\btitle:\s*['"`][^'"`]*['"`],?)/, `$1\n    renderName: '${cleanRender}',`);
        } else {
          block = block.replace(/(\bid:\s*['"`][^'"`]*['"`],?)/, `$1\n    renderName: '${cleanRender}',`);
        }
      }
    }

    // Update id if provided and different
    if (typeof updates.id === 'string' && updates.id.trim() && updates.id.trim() !== id) {
      const cleanId = updates.id.trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanId) {
        block = block.replace(/(\bid:\s*)['"`][^'"`]*['"`]/, `$1'${cleanId}'`);
      }
    }

    // Update width if provided
    if (typeof updates.width === 'number' && Number.isFinite(updates.width)) {
      block = block.replace(/(\bwidth:\s*)\d+/, `$1${Math.round(updates.width)}`);
    }

    // Update height if provided
    if (typeof updates.height === 'number' && Number.isFinite(updates.height)) {
      block = block.replace(/(\bheight:\s*)\d+/, `$1${Math.round(updates.height)}`);
    }

    // Update fps if provided
    if (typeof updates.fps === 'number' && Number.isFinite(updates.fps)) {
      block = block.replace(/(\bfps:\s*)\d+/, `$1${Math.round(updates.fps)}`);
    }

    // Update durationInFrames if provided
    if (typeof updates.durationInFrames === 'number' && Number.isFinite(updates.durationInFrames)) {
      const frames = Math.round(updates.durationInFrames);
      const fps = typeof updates.fps === 'number' && Number.isFinite(updates.fps)
        ? updates.fps
        : (parseInt(block.match(/\bfps:\s*(\d+)/)?.[1] || '30', 10) || 30);
      const secs = (frames / fps).toFixed(1);
      // Replace entire durationInFrames line cleanly
      block = block.replace(/(\bdurationInFrames:\s*)\d+[^\n]*/, `$1${frames}, // ${secs}s at ${fps} fps`);
    }

    const newContent = content.slice(0, startIndex) + block + content.slice(endIndex);
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return { success: true, filePath };
  }

  return { success: false, error: `Composition "${id}" not found in any video definitions.` };
}
