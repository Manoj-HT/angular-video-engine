import fs from 'fs';
import path from 'path';

export interface ComponentSourceInfo {
  compositionId: string;
  componentName: string;
  tsPath: string;
  htmlPath: string;
  cssPath: string;
  isMultiFile: boolean;
}

export interface ElementTargetIdentifier {
  aveName?: string;
  dataName?: string;
  className?: string;
  tagName?: string;
  elementId?: string;
  selector?: string;
  candidates?: string[];
}

export interface AnimateWriteConfig {
  range: [number, number];
  property?: string;
  fromValue?: any;
  toValue?: any;
  from?: Record<string, any>;
  to?: Record<string, any>;
  spring?: boolean | { damping?: number; stiffness?: number };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses numeric or string values for aveAnimate tweens.
 * e.g. "40px" -> 40, "0.5" -> 0.5, "#00d2ff" -> "#00d2ff"
 */
export function normalizeValue(prop: string, val: any): any {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return val;

  const trimmed = val.trim();
  if (trimmed === '') return 0;

  // If pure number (e.g. "0", "1", "0.85", "-20")
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // If pixel value for transforms or sizes: "40px", "-30px"
  const pxMatch = /^(-?\d+(\.\d+)?)px$/i.exec(trimmed);
  if (pxMatch && ['translatex', 'translatey', 'rotate', 'scale', 'opacity'].includes(prop.toLowerCase())) {
    return parseFloat(pxMatch[1]);
  }

  // Degree: "45deg" -> 45 for rotate
  const degMatch = /^(-?\d+(\.\d+)?)deg$/i.exec(trimmed);
  if (degMatch && prop.toLowerCase() === 'rotate') {
    return parseFloat(degMatch[1]);
  }

  return trimmed;
}

/**
 * Resolves source files (.ts, .html, .css) for any registered composition.
 */
export function resolveComponentFiles(
  compositionId: string,
  rootDir: string = process.cwd()
): ComponentSourceInfo | null {
  const primaryVideosPath = path.resolve(rootDir, 'src/videos/index.ts');
  if (!fs.existsSync(primaryVideosPath)) return null;

  const videosIndex = fs.readFileSync(primaryVideosPath, 'utf-8');

  // Match composition id block
  const compIdPattern = new RegExp(`id:\\s*['"\`]${escapeRegex(compositionId)}['"\`]`, 'i');
  const compMatch = compIdPattern.exec(videosIndex);
  if (!compMatch) return null;

  // Find component name in composition block
  const blockStart = videosIndex.lastIndexOf('{', compMatch.index);
  if (blockStart === -1) return null;

  let depth = 1;
  let blockEnd = blockStart + 1;
  while (depth > 0 && blockEnd < videosIndex.length) {
    if (videosIndex[blockEnd] === '{') depth++;
    else if (videosIndex[blockEnd] === '}') depth--;
    blockEnd++;
  }

  const compBlock = videosIndex.slice(blockStart, blockEnd);
  const componentMatch = /component:\s*([A-Za-z0-9_]+)/.exec(compBlock);
  if (!componentMatch) return null;

  const componentName = componentMatch[1];

  // Find import statement for this component
  const importPattern = new RegExp(
    `import\\s*\\{[^}]*\\b${componentName}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`
  );
  const importMatch = importPattern.exec(videosIndex);
  if (!importMatch) return null;

  const importRelative = importMatch[1];
  let tsPath = path.resolve(path.dirname(primaryVideosPath), importRelative);
  if (!tsPath.endsWith('.ts')) {
    if (fs.existsSync(tsPath + '.ts')) {
      tsPath += '.ts';
    } else if (fs.existsSync(path.join(tsPath, 'index.ts'))) {
      tsPath = path.join(tsPath, 'index.ts');
    }
  }

  if (!fs.existsSync(tsPath)) return null;

  const tsContent = fs.readFileSync(tsPath, 'utf-8');

  // Check for external templateUrl and styleUrls
  const templateUrlMatch = /templateUrl:\s*['"]([^'"]+)['"]/.exec(tsContent);
  const styleUrlMatch = /(?:styleUrls:\s*\[\s*|styleUrl:\s*)['"]([^'"]+)['"]/.exec(tsContent);

  let htmlPath = tsPath;
  let cssPath = tsPath;
  let isMultiFile = false;

  if (templateUrlMatch) {
    const resolvedHtml = path.resolve(path.dirname(tsPath), templateUrlMatch[1]);
    if (fs.existsSync(resolvedHtml)) {
      htmlPath = resolvedHtml;
      isMultiFile = true;
    }
  }

  if (styleUrlMatch) {
    const resolvedCss = path.resolve(path.dirname(tsPath), styleUrlMatch[1]);
    if (fs.existsSync(resolvedCss)) {
      cssPath = resolvedCss;
      isMultiFile = true;
    }
  }

  return {
    compositionId,
    componentName,
    tsPath,
    htmlPath,
    cssPath,
    isMultiFile
  };
}

/**
 * Generates all possible CSS candidate selectors for an element to find existing rules.
 */
export function getCandidateSelectors(target: ElementTargetIdentifier): string[] {
  const list: string[] = [];
  if (Array.isArray(target.candidates)) {
    for (const c of target.candidates) {
      if (c && typeof c === 'string' && !list.includes(c.trim())) {
        list.push(c.trim());
      }
    }
  }
  if (target.selector && target.selector.trim() && !list.includes(target.selector.trim())) {
    list.push(target.selector.trim());
  }
  if (target.aveName) {
    list.push(`[ave-name="${target.aveName}"]`);
    list.push(`[ave-name='${target.aveName}']`);
  }
  if (target.dataName) {
    list.push(`[data-name="${target.dataName}"]`);
    list.push(`[data-name='${target.dataName}']`);
  }
  if (target.elementId) {
    list.push(`#${target.elementId}`);
  }
  if (target.className) {
    const classes = target.className.split(/\s+/).filter(c => c && !c.startsWith('ng-') && !c.startsWith('_ng'));
    for (const c of classes) {
      const dotCls = `.${c}`;
      if (!list.includes(dotCls)) list.push(dotCls);
    }
  }
  if (target.tagName && !['div', 'span', 'p'].includes(target.tagName.toLowerCase())) {
    list.push(target.tagName.toLowerCase());
  }
  return list;
}

export function findCssRuleForCandidates(
  css: string,
  candidates: string[]
): { selector: string; body: string; fullMatch: string; bodyStart: number; bodyEnd: number } | null {
  for (const cand of candidates) {
    const match = findCssRuleBlock(css, cand);
    if (match) return match;
  }
  return null;
}

/**
 * Writes or updates a static CSS property in the composition's CSS file or inline styles.
 */
export function writeCssProperty(
  compositionId: string,
  selector: string,
  property: string,
  value: string,
  candidates?: string[],
  rootDir: string = process.cwd()
): { success: boolean; error?: string; selector?: string; property?: string; value?: string } {
  const sources = resolveComponentFiles(compositionId, rootDir);
  if (!sources) {
    return { success: false, error: `Could not resolve component for composition: ${compositionId}` };
  }

  const cleanProp = property.trim();
  const cleanVal = value.trim();
  const cleanSelector = selector.trim();

  if (!cleanProp || !cleanSelector) {
    return { success: false, error: 'Selector and property are required.' };
  }

  const filePath = sources.cssPath;
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `CSS target file not found: ${filePath}` };
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const allCandidates = candidates && candidates.length > 0 ? candidates : [cleanSelector];

  if (sources.isMultiFile) {
    // Multi-file: write into .css file
    content = upsertCssRuleWithCandidates(content, allCandidates, cleanSelector, cleanProp, cleanVal);
  } else {
    // Single-file: write into styles: [`...`] in .ts file
    const stylesRegex = /styles:\s*\[\s*`([\s\S]*?)`\s*\]/;
    const stylesMatch = stylesRegex.exec(content);
    if (stylesMatch) {
      const updatedStyles = upsertCssRuleWithCandidates(stylesMatch[1], allCandidates, cleanSelector, cleanProp, cleanVal);
      content = content.replace(stylesRegex, `styles: [\`\n${updatedStyles.trim()}\n  \`]`);
    } else {
      // Append styles array if missing
      content = content.replace(
        /(@Component\s*\(\s*\{[\s\S]*?)(\n\}\))/m,
        `$1,\n  styles: [\`\n${cleanSelector} {\n  ${cleanProp}: ${cleanVal};\n}\n\`]$2`
      );
    }
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return {
    success: true,
    selector: cleanSelector,
    property: cleanProp,
    value: cleanVal
  };
}

/**
 * Removes a static CSS property from a selector in the composition's CSS file or inline styles.
 */
export function removeCssProperty(
  compositionId: string,
  selector: string,
  property: string,
  candidates?: string[],
  rootDir: string = process.cwd()
): { success: boolean; error?: string } {
  const sources = resolveComponentFiles(compositionId, rootDir);
  if (!sources) return { success: false, error: 'Composition source not found' };

  const filePath = sources.cssPath;
  if (!fs.existsSync(filePath)) return { success: false, error: 'CSS file not found' };

  let content = fs.readFileSync(filePath, 'utf-8');
  const cleanProp = property.trim();
  const cleanSelector = selector.trim();
  const allCandidates = candidates && candidates.length > 0 ? candidates : [cleanSelector];

  if (sources.isMultiFile) {
    content = deleteCssPropertyWithCandidates(content, allCandidates, cleanProp);
  } else {
    const stylesRegex = /styles:\s*\[\s*`([\s\S]*?)`\s*\]/;
    const stylesMatch = stylesRegex.exec(content);
    if (stylesMatch) {
      const updatedStyles = deleteCssPropertyWithCandidates(stylesMatch[1], allCandidates, cleanProp);
      content = content.replace(stylesRegex, `styles: [\`\n${updatedStyles.trim()}\n  \`]`);
    }
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return { success: true };
}

/**
 * Writes or updates an [aveAnimate] directive on the target element in the HTML template.
 * Optionally removes the corresponding static CSS property so there's no conflict.
 */
export function writeAveAnimateDirective(
  compositionId: string,
  target: ElementTargetIdentifier,
  config: AnimateWriteConfig,
  removeCssProp?: string,
  rootDir: string = process.cwd()
): { success: boolean; error?: string; updatedTag?: string } {
  const sources = resolveComponentFiles(compositionId, rootDir);
  if (!sources) return { success: false, error: 'Composition source not found' };

  // 1. If requested, remove the static CSS property first
  if (removeCssProp) {
    const candidates = getCandidateSelectors(target);
    removeCssProperty(compositionId, target.selector || '', removeCssProp, candidates, rootDir);
  }

  const htmlPath = sources.htmlPath;
  if (!fs.existsSync(htmlPath)) return { success: false, error: 'HTML template file not found' };

  let content = fs.readFileSync(htmlPath, 'utf-8');

  // Locate opening tag of target element
  const loc = findElementTagInHtml(content, target);
  if (!loc) {
    return {
      success: false,
      error: `Could not locate element in template with identifiers: ${JSON.stringify(target)}`
    };
  }

  const { tagOpen, tagClose, fullTag } = loc;

  // Prepare updated `from` and `to` objects
  let fromObj: Record<string, any> = config.from ? { ...config.from } : {};
  let toObj: Record<string, any> = config.to ? { ...config.to } : {};

  if (config.property) {
    const propKey = config.property;
    fromObj[propKey] = normalizeValue(propKey, config.fromValue ?? 0);
    toObj[propKey] = normalizeValue(propKey, config.toValue ?? 0);
  }

  // Check if [aveAnimate] already exists on this opening tag
  const animateAttrRegex = /\[aveAnimate\]\s*=\s*(["'])([\s\S]*?)\1/;
  const existingMatch = animateAttrRegex.exec(fullTag);

  let newDirectiveStr = '';
  const range = config.range || [0, 30];

  if (existingMatch) {
    // Parse existing from/to and merge
    const oldConfigRaw = existingMatch[2];
    const oldFrom = extractSubObject(oldConfigRaw, 'from');
    const oldTo = extractSubObject(oldConfigRaw, 'to');

    // Merge old with new
    const mergedFrom = { ...oldFrom, ...fromObj };
    const mergedTo = { ...oldTo, ...toObj };

    newDirectiveStr = formatAveAnimateDirective(range, mergedFrom, mergedTo, config.spring);
    const newTag = fullTag.replace(animateAttrRegex, newDirectiveStr);
    content = content.slice(0, tagOpen) + newTag + content.slice(tagClose);
  } else {
    // Fresh directive insertion
    newDirectiveStr = formatAveAnimateDirective(range, fromObj, toObj, config.spring);

    // If aveName provided (or derived) and tag doesn't have it, inject it for unique tracking
    const derivedName = target.aveName || (target.dataName ? target.dataName : (target.className ? target.className.split(/\s+/)[0] : undefined));
    let nameInject = '';
    if (derivedName && !/ave-name\s*=/i.test(fullTag)) {
      nameInject = ` ave-name="${derivedName}"`;
    }

    // Insert directive before tag close '>' (or '/>')
    let newTag = '';
    if (fullTag.endsWith('/>')) {
      newTag = fullTag.slice(0, -2).trimEnd() + nameInject + '\n  ' + newDirectiveStr + '\n/>';
    } else {
      newTag = fullTag.slice(0, -1).trimEnd() + nameInject + '\n  ' + newDirectiveStr + '\n>';
    }

    content = content.slice(0, tagOpen) + newTag + content.slice(tagClose);
  }

  fs.writeFileSync(htmlPath, content, 'utf-8');
  return { success: true, updatedTag: newDirectiveStr };
}

/**
 * Inspects template and styles to return current declared CSS rules and aveAnimate configs.
 */
export function inspectElementStylesAndAnimation(
  compositionId: string,
  target: ElementTargetIdentifier,
  rootDir: string = process.cwd()
): {
  success: boolean;
  hasAnimate: boolean;
  animateConfig?: any;
  cssRules: Record<string, string>;
  matchedSelector?: string;
  error?: string;
} {
  const sources = resolveComponentFiles(compositionId, rootDir);
  if (!sources) return { success: false, hasAnimate: false, cssRules: {}, error: 'Source not found' };

  let hasAnimate = false;
  let animateConfig: any = null;

  if (fs.existsSync(sources.htmlPath)) {
    const html = fs.readFileSync(sources.htmlPath, 'utf-8');
    const loc = findElementTagInHtml(html, target);
    if (loc) {
      const match = /\[aveAnimate\]\s*=\s*(["'])([\s\S]*?)\1/.exec(loc.fullTag);
      if (match) {
        hasAnimate = true;
        animateConfig = parseLooseObjectLiteral(match[2]);
      }
    }
  }

  const cssRules: Record<string, string> = {};
  let matchedSelector = target.selector || '';
  if (fs.existsSync(sources.cssPath)) {
    const css = fs.readFileSync(sources.cssPath, 'utf-8');
    const candidates = getCandidateSelectors(target);
    const ruleMatch = findCssRuleForCandidates(css, candidates);
    if (ruleMatch) {
      matchedSelector = ruleMatch.selector;
      const propRegex = /([a-zA-Z0-9_-]+)\s*:\s*([^;]+);?/g;
      let m: RegExpExecArray | null;
      while ((m = propRegex.exec(ruleMatch.body)) !== null) {
        cssRules[m[1].trim()] = m[2].trim();
      }
    }
  }

  return {
    success: true,
    hasAnimate,
    animateConfig,
    cssRules,
    matchedSelector
  };
}

// ================= INTERNAL HELPER UTILITIES =================

function upsertCssRuleWithCandidates(
  css: string,
  candidates: string[],
  fallbackSelector: string,
  prop: string,
  val: string
): string {
  const rule = findCssRuleForCandidates(css, candidates);
  if (rule) {
    let body = rule.body;
    const propRegex = new RegExp(`(\\b${escapeRegex(prop)}\\s*:\\s*)([^;]+)(;?)`, 'i');
    if (propRegex.test(body)) {
      body = body.replace(propRegex, `$1${val}$3`);
    } else {
      body = body.trimEnd() + `\n  ${prop}: ${val};\n`;
    }
    return css.slice(0, rule.bodyStart) + body + css.slice(rule.bodyEnd);
  }

  // Not found: append new rule
  const cleanCss = css.trimEnd();
  return `${cleanCss}\n\n${fallbackSelector} {\n  ${prop}: ${val};\n}\n`;
}

function deleteCssPropertyWithCandidates(css: string, candidates: string[], prop: string): string {
  const rule = findCssRuleForCandidates(css, candidates);
  if (!rule) return css;

  const propRegex = new RegExp(`\\s*\\b${escapeRegex(prop)}\\s*:\\s*[^;]+;?\\r?\\n?`, 'gi');
  const newBody = rule.body.replace(propRegex, '\n');
  return css.slice(0, rule.bodyStart) + newBody + css.slice(rule.bodyEnd);
}

function findCssRuleBlock(
  css: string,
  selector: string
): { selector: string; body: string; fullMatch: string; bodyStart: number; bodyEnd: number } | null {
  const escaped = escapeRegex(selector.trim());
  const regex = new RegExp(`(^|\\n|})([^{}]*?(?:^|[\\s,}])` + escaped + `(?:[\\s,{:]|$)[^{}]*?)\\{([^{}]*)\\}`, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    const body = match[3];
    const fullMatch = match[0];
    const openBrace = fullMatch.indexOf('{');
    const closeBrace = fullMatch.lastIndexOf('}');
    const bodyStart = match.index + openBrace + 1;
    const bodyEnd = match.index + closeBrace;
    return {
      selector: match[2].trim(),
      body,
      fullMatch,
      bodyStart,
      bodyEnd
    };
  }
  return null;
}

function findOpeningTagEnd(html: string, startIndex: number): number {
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inAngularExpr = 0;

  for (let i = startIndex; i < html.length; i++) {
    const ch = html[i];
    const prev = i > startIndex ? html[i - 1] : '';

    if (ch === '"' && !inSingle && !inBacktick && prev !== '\\') {
      inDouble = !inDouble;
    } else if (ch === "'" && !inDouble && !inBacktick && prev !== '\\') {
      inSingle = !inSingle;
    } else if (ch === '`' && !inSingle && !inDouble && prev !== '\\') {
      inBacktick = !inBacktick;
    } else if (ch === '{' && html[i + 1] === '{' && !inSingle && !inDouble && !inBacktick) {
      inAngularExpr++;
      i++;
    } else if (ch === '}' && html[i + 1] === '}' && inAngularExpr > 0 && !inSingle && !inDouble && !inBacktick) {
      inAngularExpr--;
      i++;
    } else if (ch === '>' && !inSingle && !inDouble && !inBacktick && inAngularExpr === 0) {
      return i + 1;
    }
  }
  return -1;
}

interface ParsedOpeningTag {
  tagOpen: number;
  tagClose: number;
  fullTag: string;
  tagName: string;
  aveName?: string;
  dataName?: string;
  elementId?: string;
  classes: string[];
}

function parseAllOpeningTags(html: string): ParsedOpeningTag[] {
  const tags: ParsedOpeningTag[] = [];
  const startRegex = /<([a-zA-Z0-9-]+)(?=[\s>/])/g;
  let m: RegExpExecArray | null;

  while ((m = startRegex.exec(html)) !== null) {
    const tagOpen = m.index;
    const tagName = m[1].toLowerCase();

    // Skip closing tags, script, style
    if (tagName.startsWith('/') || tagName === 'script' || tagName === 'style') {
      continue;
    }

    const tagClose = findOpeningTagEnd(html, tagOpen);
    if (tagClose === -1) continue;

    const fullTag = html.slice(tagOpen, tagClose);

    const aveNameM = /ave-name=["']([^"']+)["']/i.exec(fullTag);
    const dataNameM = /data-name=["']([^"']+)["']/i.exec(fullTag);
    const idM = /\bid=["']([^"']+)["']/i.exec(fullTag);
    const classM = /\bclass=["']([^"']+)["']/i.exec(fullTag);

    const classes = classM
      ? classM[1].split(/\s+/).filter(c => c && !c.startsWith('ng-') && !c.startsWith('_ng'))
      : [];

    tags.push({
      tagOpen,
      tagClose,
      fullTag,
      tagName,
      aveName: aveNameM ? aveNameM[1] : undefined,
      dataName: dataNameM ? dataNameM[1] : undefined,
      elementId: idM ? idM[1] : undefined,
      classes
    });
  }
  return tags;
}

function findElementTagInHtml(
  html: string,
  target: ElementTargetIdentifier
): { tagOpen: number; tagClose: number; fullTag: string } | null {
  const allTags = parseAllOpeningTags(html);
  if (allTags.length === 0) return null;

  const targetClasses = (target.className || '')
    .split(/\s+/)
    .filter(c => c && !c.startsWith('ng-') && !c.startsWith('_ng'));

  const candidates = [...(target.candidates || [])];
  if (target.selector && !candidates.includes(target.selector)) {
    candidates.push(target.selector);
  }

  let bestMatch: ParsedOpeningTag | null = null;
  let bestScore = 0;

  for (const tag of allTags) {
    let score = 0;

    // 1. Exact ave-name match (Priority 1)
    if (target.aveName && tag.aveName && target.aveName.toLowerCase() === tag.aveName.toLowerCase()) {
      score += 100;
    }

    // 2. Exact data-name match (Priority 2)
    if (target.dataName && tag.dataName && target.dataName.toLowerCase() === tag.dataName.toLowerCase()) {
      score += 90;
    }

    // 3. Exact element id match (Priority 3)
    if (target.elementId && tag.elementId && target.elementId.toLowerCase() === tag.elementId.toLowerCase()) {
      score += 80;
    }

    // 4. Candidate selector matching in full tag
    for (const cand of candidates) {
      if (cand.startsWith('.')) {
        const cls = cand.slice(1);
        if (tag.classes.includes(cls)) score += 40;
      } else if (cand.startsWith('#')) {
        const idVal = cand.slice(1);
        if (tag.elementId === idVal) score += 60;
      } else if (cand.includes('[ave-name=') && tag.aveName) {
        if (cand.includes(tag.aveName)) score += 50;
      }
    }

    // 5. Classes overlap
    let classOverlap = 0;
    for (const c of targetClasses) {
      if (tag.classes.includes(c)) classOverlap++;
    }
    if (targetClasses.length > 0 && classOverlap > 0) {
      score += (classOverlap / targetClasses.length) * 50;
      if (classOverlap === targetClasses.length) {
        score += 20; // Exact class set match bonus
      }
    }

    // 6. TagName match
    if (target.tagName && tag.tagName === target.tagName.toLowerCase()) {
      score += 15;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = tag;
    }
  }

  if (bestScore >= 15 && bestMatch) {
    return {
      tagOpen: bestMatch.tagOpen,
      tagClose: bestMatch.tagClose,
      fullTag: bestMatch.fullTag
    };
  }

  return null;
}

function formatAveAnimateDirective(
  range: [number, number],
  from: Record<string, any>,
  to: Record<string, any>,
  spring: boolean | { damping?: number; stiffness?: number } = true
): string {
  const formatProps = (obj: Record<string, any>): string => {
    const pairs = Object.entries(obj).map(([k, v]) => {
      const valStr = typeof v === 'string' ? `'${v}'` : v;
      return `${k}: ${valStr}`;
    });
    return `{ ${pairs.join(', ')} }`;
  };

  let springStr = '';
  if (spring === true) {
    springStr = ',\n    spring: { damping: 14, stiffness: 120 }';
  } else if (typeof spring === 'object' && spring !== null) {
    const damp = spring.damping ?? 14;
    const stiff = spring.stiffness ?? 120;
    springStr = `,\n    spring: { damping: ${damp}, stiffness: ${stiff} }`;
  }

  return `[aveAnimate]="{\n    range: [${range[0]}, ${range[1]}],\n    from: ${formatProps(from)},\n    to: ${formatProps(to)}${springStr}\n  }"`;
}

function extractSubObject(str: string, key: string): Record<string, any> {
  const regex = new RegExp(`\\b${key}\\s*:\\s*\\{([^}]+)\\}`, 'i');
  const match = regex.exec(str);
  if (!match) return {};

  const result: Record<string, any> = {};
  const entries = match[1].split(',');
  for (const entry of entries) {
    const [k, v] = entry.split(':');
    if (k && v) {
      const cleanKey = k.trim();
      const cleanVal = v.trim().replace(/^['"]|['"]$/g, '');
      result[cleanKey] = normalizeValue(cleanKey, cleanVal);
    }
  }
  return result;
}

function parseLooseObjectLiteral(str: string): any {
  try {
    const rangeMatch = /range:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/.exec(str);
    const range = rangeMatch ? [parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10)] : [0, 30];
    const from = extractSubObject(str, 'from');
    const to = extractSubObject(str, 'to');
    return { range, from, to };
  } catch {
    return null;
  }
}
