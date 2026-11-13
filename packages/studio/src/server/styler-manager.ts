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
 * Writes or updates a static CSS property in the composition's CSS file or inline styles.
 */
export function writeCssProperty(
  compositionId: string,
  selector: string,
  property: string,
  value: string,
  rootDir: string = process.cwd()
): { success: boolean; error?: string; selector?: string; property?: string; value?: string } {
  const sources = resolveComponentFiles(compositionId, rootDir);
  if (!sources) {
    return { success: false, error: `Could not resolve component for composition: ${compositionId}` };
  }

  const cleanProp = property.trim();
  const cleanVal = value.trim();
  const cleanSelector = selector.trim();

  if (!cleanProp || !cleanVal || !cleanSelector) {
    return { success: false, error: 'Selector, property, and value are required.' };
  }

  const filePath = sources.cssPath;
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `CSS target file not found: ${filePath}` };
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  if (sources.isMultiFile) {
    // Multi-file: write into .css file
    content = upsertCssRule(content, cleanSelector, cleanProp, cleanVal);
  } else {
    // Single-file: write into styles: [`...`] in .ts file
    const stylesRegex = /styles:\s*\[\s*`([\s\S]*?)`\s*\]/;
    const stylesMatch = stylesRegex.exec(content);
    if (stylesMatch) {
      const updatedStyles = upsertCssRule(stylesMatch[1], cleanSelector, cleanProp, cleanVal);
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
  rootDir: string = process.cwd()
): { success: boolean; error?: string } {
  const sources = resolveComponentFiles(compositionId, rootDir);
  if (!sources) return { success: false, error: 'Composition source not found' };

  const filePath = sources.cssPath;
  if (!fs.existsSync(filePath)) return { success: false, error: 'CSS file not found' };

  let content = fs.readFileSync(filePath, 'utf-8');
  const cleanProp = property.trim();
  const cleanSelector = selector.trim();

  if (sources.isMultiFile) {
    content = deleteCssProperty(content, cleanSelector, cleanProp);
  } else {
    const stylesRegex = /styles:\s*\[\s*`([\s\S]*?)`\s*\]/;
    const stylesMatch = stylesRegex.exec(content);
    if (stylesMatch) {
      const updatedStyles = deleteCssProperty(stylesMatch[1], cleanSelector, cleanProp);
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
  if (removeCssProp && target.selector) {
    removeCssProperty(compositionId, target.selector, removeCssProp, rootDir);
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

    // If aveName provided and tag doesn't have it, optionally inject it
    let nameInject = '';
    if (target.aveName && !/ave-name\s*=/i.test(fullTag)) {
      nameInject = ` ave-name="${target.aveName}"`;
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
  if (fs.existsSync(sources.cssPath) && target.selector) {
    const css = fs.readFileSync(sources.cssPath, 'utf-8');
    const ruleMatch = findCssRuleBlock(css, target.selector);
    if (ruleMatch) {
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
    cssRules
  };
}

// ================= INTERNAL HELPER UTILITIES =================

function upsertCssRule(css: string, selector: string, prop: string, val: string): string {
  const rule = findCssRuleBlock(css, selector);
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
  return `${cleanCss}\n\n${selector} {\n  ${prop}: ${val};\n}\n`;
}

function deleteCssProperty(css: string, selector: string, prop: string): string {
  const rule = findCssRuleBlock(css, selector);
  if (!rule) return css;

  const propRegex = new RegExp(`\\s*\\b${escapeRegex(prop)}\\s*:\\s*[^;]+;?\\r?\\n?`, 'gi');
  const newBody = rule.body.replace(propRegex, '\n');
  return css.slice(0, rule.bodyStart) + newBody + css.slice(rule.bodyEnd);
}

function findCssRuleBlock(
  css: string,
  selector: string
): { selector: string; body: string; fullMatch: string; bodyStart: number; bodyEnd: number } | null {
  // Pattern to find selector { ... }
  const regex = new RegExp(`(^|\\n|})\\s*([^{}]*?${escapeRegex(selector)}[^{}]*?)\\{([^{}]*)\\}`, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    const body = match[3];
    const bodyStart = match.index + match[0].indexOf('{') + 1;
    const bodyEnd = match.index + match[0].lastIndexOf('}');
    return {
      selector: match[2].trim(),
      body,
      fullMatch: match[0],
      bodyStart,
      bodyEnd
    };
  }
  return null;
}

function findElementTagInHtml(
  html: string,
  target: ElementTargetIdentifier
): { tagOpen: number; tagClose: number; fullTag: string } | null {
  const searchPatterns: RegExp[] = [];

  // Priority 1: ave-name
  if (target.aveName) {
    searchPatterns.push(new RegExp(`<[a-zA-Z0-9-]+[^>]*\\bave-name=["']${escapeRegex(target.aveName)}["'][^>]*>`, 'i'));
  }
  // Priority 2: data-name
  if (target.dataName) {
    searchPatterns.push(new RegExp(`<[a-zA-Z0-9-]+[^>]*\\bdata-name=["']${escapeRegex(target.dataName)}["'][^>]*>`, 'i'));
  }
  // Priority 3: element id
  if (target.elementId) {
    searchPatterns.push(new RegExp(`<[a-zA-Z0-9-]+[^>]*\\bid=["']${escapeRegex(target.elementId)}["'][^>]*>`, 'i'));
  }
  // Priority 4: primary class
  if (target.className) {
    const firstClass = target.className.split(/\s+/).find(c => c && !c.startsWith('ng-'));
    if (firstClass) {
      searchPatterns.push(new RegExp(`<[a-zA-Z0-9-]+[^>]*\\bclass=["'][^"']*\\b${escapeRegex(firstClass)}\\b[^"']*["'][^>]*>`, 'i'));
    }
  }
  // Priority 5: tagName
  if (target.tagName) {
    searchPatterns.push(new RegExp(`<${escapeRegex(target.tagName)}\\b[^>]*>`, 'i'));
  }

  for (const pattern of searchPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const tagOpen = match.index;
      const tagClose = tagOpen + match[0].length;
      return { tagOpen, tagClose, fullTag: match[0] };
    }
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
