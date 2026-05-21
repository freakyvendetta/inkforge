/**
 * InkForge Studio — app.js
 * Advanced rich-text to realistic handwriting rendering engine.
 *
 * Core Features:
 * - Dual Engine: Custom PNG glyphs (offline zero-CORS) + Curated Google Handwriting Fonts
 * - Glyph Studio: In-browser character drawing & custom glyph persistence
 * - Academic Support: KaTeX mathematical formulas & hand-drawn diagrams/images
 * - Multi-pen physics: Gel, Ballpoint, Fountain, Pencil
 * - Natural realism: Baseline drift, rotational micro-jitter, and margin creep
 * - Document export: High-res 300 DPI single/all PNGs and multi-page PDF
 */

// ─── 1. Symbol & Glyph Manifest ──────────────────────────────────────────────
const SYMBOL_MAP = {
  ',': 'coma',  '.': 'fs',    '?': 'que',   '<': 'ang1',  '>': 'ang2',
  '{': 'cur1',  '}': 'cur2',  ':': 'colon', '/': 'div',   '-': 'sub',
  '(': 'par1',  ')': 'par2',  '[': 'sqr1',  ']': 'sqr2',  '*': 'star',
  '=': 'equal', '+': 'plus',  '"': 'quo',
  '!': 'excl',  "'": 'apos',  ';': 'semi',  '%': 'perc',  '&': 'amp',
  '@': 'at',    '_': 'under', '^': 'caret', '~': 'tilde', '\\': 'bslash',
  '|': 'pipe',  '×': 'mul',
};

const VALID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' +
                    "+,.-?:/*<>}{()=[]$\"!';%^&@_~\\|× ";

const GLYPH_MANIFEST = [
  ...('abcdefghijklmnopqrstuvwxyz'.split('').map(c => ({ char: c, file: c, desc: `Lowercase ${c.toUpperCase()}` }))),
  ...('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => ({ char: c, file: 'c' + c.toLowerCase(), desc: `Uppercase ${c}` }))),
  ...('0123456789'.split('').map(c => ({ char: c, file: c, desc: `Digit ${c}` }))),
  { char: '!',  file: 'excl',   desc: 'Exclamation mark' },
  { char: "'",  file: 'apos',   desc: 'Apostrophe' },
  { char: ';',  file: 'semi',   desc: 'Semicolon' },
  { char: '%',  file: 'perc',   desc: 'Percent' },
  { char: '&',  file: 'amp',    desc: 'Ampersand' },
  { char: '@',  file: 'at',     desc: 'At sign' },
  { char: '_',  file: 'under',  desc: 'Underscore' },
  { char: '^',  file: 'caret',  desc: 'Caret' },
  { char: '~',  file: 'tilde',  desc: 'Tilde' },
  { char: '\\', file: 'bslash', desc: 'Backslash' },
  { char: '|',  file: 'pipe',   desc: 'Pipe' },
  { char: ',',  file: 'coma',   desc: 'Comma' },
  { char: '.',  file: 'fs',     desc: 'Period / Full stop' },
  { char: '?',  file: 'que',    desc: 'Question mark' },
  { char: '"',  file: 'quo',    desc: 'Double quote' },
  { char: ':',  file: 'colon',  desc: 'Colon' },
  { char: '-',  file: 'sub',    desc: 'Hyphen / minus' },
  { char: '+',  file: 'plus',   desc: 'Plus' },
  { char: '=',  file: 'equal',  desc: 'Equals' },
  { char: '*',  file: 'star',   desc: 'Asterisk' },
  { char: '/',  file: 'div',    desc: 'Slash / divide' },
  { char: '$',  file: 'dol1',   desc: 'Dollar sign' },
  { char: '(',  file: 'par1',   desc: 'Left parenthesis' },
  { char: ')',  file: 'par2',   desc: 'Right parenthesis' },
  { char: '[',  file: 'sqr1',   desc: 'Left bracket' },
  { char: ']',  file: 'sqr2',   desc: 'Right bracket' },
  { char: '{',  file: 'cur1',   desc: 'Left curly brace' },
  { char: '}',  file: 'cur2',   desc: 'Right curly brace' },
  { char: '<',  file: 'ang1',   desc: 'Less than' },
  { char: '>',  file: 'ang2',   desc: 'Greater than' },
  { char: '×',  file: 'mul',    desc: 'Multiply sign ×' },
];

// ─── 2. Layout Geometry & Presets (Clean 300 DPI Standard) ───────────────────
const DEFAULT_LAYOUT = Object.freeze({
  pageW:        2480,
  pageH:        3508,
  marginTop:     450,
  marginBottom:  220,
  marginLeft:    290,
  marginRight:    80,
  lineSpacing:   110,
  tabIndent:     160,
});

const DEFAULT_APPEARANCE = Object.freeze({
  fontFamily:   'Caveat',   // 'Caveat' | 'Kalam' | 'Indie Flower' | 'Shadows Into Light' | 'Homemade Apple' | 'Patrick Hand' | 'custom-png'
  penStyle:     'gel',      // 'gel' | 'ballpoint' | 'fountain' | 'pencil'
  inkColor:     '#1a237e',
  fontSize:     16,         // pt (Word standard)
  paperStyle:   'ruled',    // 'ruled' | 'grid' | 'vintage' | 'blank-white' | 'blank-cream' | 'dark'
  useJitter:    true,
  useDrift:     true,
  useCreep:     true,       // subtle margin creep
});

const PAGE_SIZE_PRESETS = {
  ruled:  { label: 'Standard Ruled', pageW: 2480, pageH: 3508, marginTop: 450, marginLeft: 290, lineSpacing: 110 },
  a4:     { label: 'A4 Sheet',      pageW: 2480, pageH: 3508, marginTop: 420, marginLeft: 260, lineSpacing: 105 },
  letter: { label: 'US Letter',     pageW: 2550, pageH: 3300, marginTop: 400, marginLeft: 270, lineSpacing: 105 },
};

const STORAGE_KEY = 'inkforge-config-v5';
const USER_GLYPHS_STORAGE_KEY = 'inkforge-user-drawn-glyphs';

const $ = id => document.getElementById(id);

let activeLayout = { ...DEFAULT_LAYOUT };
let activeAppearance = { ...DEFAULT_APPEARANCE };
let customGlyphMap = {}; // filename -> Image for uploaded or drawn custom PNG glyphs

function deriveLayout(l) {
  const textStartX = l.marginLeft;
  const textEndX   = l.pageW - l.marginRight;
  const textStartY = l.marginTop;
  const maxTextY   = l.pageH - l.marginBottom;
  return {
    textStartX,
    textEndX,
    textStartY,
    maxTextY,
    contentW: Math.max(100, textEndX - textStartX),
    contentH: Math.max(100, maxTextY - textStartY),
  };
}

// ─── 3. Image Loading & Glyph Cache ──────────────────────────────────────────
const imgCache = {};

function getCharFilename(letter, charIndex) {
  if (letter >= 'A' && letter <= 'Z') return 'c' + letter.toLowerCase();
  if (letter === '$') return 'dol' + ((charIndex % 2) + 1);
  if (SYMBOL_MAP[letter]) return SYMBOL_MAP[letter];
  return letter;
}

function loadImg(name) {
  if (!name || name === ' ' || !name.trim()) return Promise.resolve(null);
  if (customGlyphMap[name]) {
    return Promise.resolve(customGlyphMap[name]);
  }
  if (imgCache[name]) return imgCache[name];

  const promise = new Promise((resolve) => {
    // 1. Instant zero-CORS Base64 cache (bundled in font-data.js for offline file:// support)
    if (window.DEFAULT_MYFONT_GLYPHS && window.DEFAULT_MYFONT_GLYPHS[name]) {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = window.DEFAULT_MYFONT_GLYPHS[name];
      return;
    }

    // 2. Direct directory fetch fallback
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `myfont/${name}.png`;
  });
  imgCache[name] = promise;
  return promise;
}

async function preloadGlyphsForModel(docModel) {
  if (activeAppearance.fontFamily !== 'custom-png') return;
  const needed = new Set();
  for (const para of docModel) {
    if (para.type === 'diagram' || para.type === 'math') continue;
    for (const run of para.runs) {
      for (const ch of run.text) {
        if (!ch || /^\s+$/.test(ch)) continue;
        if (ch === '$') { needed.add('dol1'); needed.add('dol2'); continue; }
        const fn = getCharFilename(ch, 0);
        if (fn && fn !== ' ' && fn.trim().length > 0) {
          needed.add(fn);
        }
      }
    }
  }
  await Promise.all([...needed].map(loadImg));
}

// ─── 4. Document Model & DOM Parsing ─────────────────────────────────────────
function parseEditorDOM(editorEl) {
  const paragraphs = [];
  const children = Array.from(editorEl.childNodes);

  function processBlockNode(node, currentList = null, listIdx = 1) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text.trim().length > 0 || children.length === 1) {
        paragraphs.push({
          type: 'text',
          headingLevel: 0,
          alignment: 'left',
          listType: currentList,
          listItemIndex: listIdx,
          runs: [{ text, bold: false, italic: false, underline: false, strike: false }]
        });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // Check Diagram Block
    if (node.classList && node.classList.contains('editor-diagram-block')) {
      const img = node.querySelector('img');
      const caption = node.querySelector('.diagram-caption')?.textContent || '';
      if (img && img.src) {
        paragraphs.push({
          type: 'diagram',
          imgSrc: img.src,
          caption: caption,
          runs: []
        });
        return;
      }
    }

    // Check Math Formula Block
    if (node.classList && node.classList.contains('editor-math-block')) {
      const latex = node.dataset.latex || node.textContent.replace(/\$/g, '').trim();
      paragraphs.push({
        type: 'math',
        latex: latex,
        runs: []
      });
      return;
    }

    const tag = node.tagName.toLowerCase();

    if (tag === 'ul') {
      let idx = 1;
      Array.from(node.children).forEach(child => processBlockNode(child, 'unordered', idx++));
      return;
    }
    if (tag === 'ol') {
      let idx = 1;
      Array.from(node.children).forEach(child => processBlockNode(child, 'ordered', idx++));
      return;
    }

    let headingLevel = 0;
    if (tag === 'h1') headingLevel = 1;
    else if (tag === 'h2') headingLevel = 2;
    else if (tag === 'h3') headingLevel = 3;

    let alignment = 'left';
    const alignStyle = node.style.textAlign || node.getAttribute('align');
    if (alignStyle === 'center' || alignStyle === 'right') alignment = alignStyle;

    const runs = [];
    parseInlineNodes(node, runs, false, false, false, false);

    if (runs.length === 0) {
      runs.push({ text: '', bold: false, italic: false, underline: false, strike: false });
    }

    paragraphs.push({
      type: 'text',
      headingLevel,
      alignment,
      listType: currentList || (tag === 'li' ? 'unordered' : null),
      listItemIndex: listIdx,
      runs
    });
  }

  function parseInlineNodes(element, runs, isBold, isItalic, isUnderline, isStrike) {
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        if (text) {
          runs.push({ text, bold: isBold, italic: isItalic, underline: isUnderline, strike: isStrike });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        const b = isBold || tag === 'b' || tag === 'strong' || child.style.fontWeight === 'bold' || parseInt(child.style.fontWeight) >= 600;
        const i = isItalic || tag === 'i' || tag === 'em' || child.style.fontStyle === 'italic';
        const u = isUnderline || tag === 'u' || (child.style.textDecoration && child.style.textDecoration.includes('underline'));
        const s = isStrike || tag === 's' || tag === 'strike' || tag === 'del' || (child.style.textDecoration && child.style.textDecoration.includes('line-through'));

        if (tag === 'br') {
          runs.push({ text: '\n', bold: b, italic: i, underline: u, strike: s });
        } else {
          parseInlineNodes(child, runs, b, i, u, s);
        }
      }
    }
  }

  if (children.length === 0) {
    processBlockNode(editorEl);
  } else {
    children.forEach(child => processBlockNode(child));
  }

  if (paragraphs.length === 0) {
    paragraphs.push({
      type: 'text',
      headingLevel: 0,
      alignment: 'left',
      listType: null,
      listItemIndex: 1,
      runs: [{ text: '', bold: false, italic: false, underline: false, strike: false }]
    });
  }

  return paragraphs;
}

// ─── 5. Fast Canvas Compositor & Tinting Engine ──────────────────────────────
function getTintedGlyphCanvas(img, w, h, color, offscreenCache) {
  const cacheKey = `${img.src || img._id || 'glyph'}_${w}x${h}_${color}`;
  if (offscreenCache[cacheKey]) return offscreenCache[cacheKey];

  const oc = document.createElement('canvas');
  oc.width = w; oc.height = h;
  const octx = oc.getContext('2d');
  octx.drawImage(img, 0, 0, w, h);
  octx.globalCompositeOperation = 'source-in';
  octx.fillStyle = color;
  octx.fillRect(0, 0, w, h);

  offscreenCache[cacheKey] = oc;
  return oc;
}

function drawTintedGlyph(ctx, img, x, y, scale, color, isBold, isItalic, offscreenCache) {
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const tintedCanvas = getTintedGlyphCanvas(img, w, h, color, offscreenCache);

  ctx.save();
  if (isItalic) {
    ctx.transform(1, 0, -0.18, 1, x + 0.18 * y, y);
    if (isBold) {
      const bOffset = Math.max(1, Math.round(2 * scale));
      const stamps = [[0,0], [bOffset,0], [0,bOffset], [bOffset,bOffset], [-1,0]];
      stamps.forEach(([dx, dy]) => ctx.drawImage(tintedCanvas, dx, dy));
    } else {
      ctx.drawImage(tintedCanvas, 0, 0);
    }
  } else {
    if (isBold) {
      const bOffset = Math.max(1, Math.round(2 * scale));
      const stamps = [[0,0], [bOffset,0], [0,bOffset], [bOffset,bOffset], [-1,0]];
      stamps.forEach(([dx, dy]) => ctx.drawImage(tintedCanvas, x + dx, y + dy));
    } else {
      ctx.drawImage(tintedCanvas, x, y);
    }
  }
  ctx.restore();
}

function drawWavyUnderline(ctx, startX, endX, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, Math.round(3 * (activeAppearance.fontSize / 16)));
  ctx.lineCap = 'round';
  ctx.beginPath();
  
  const step = 14;
  let wave = 0;
  ctx.moveTo(startX, y);
  for (let x = startX; x <= endX; x += step) {
    wave = wave === 0 ? 3 : 0;
    ctx.quadraticCurveTo(x + step / 2, y + wave, Math.min(x + step, endX), y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawScratchOutScribble(ctx, startX, endX, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, Math.round(3.5 * (activeAppearance.fontSize / 16)));
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX - 4, y);
  const step = 9;
  for (let x = startX; x <= endX + 4; x += step) {
    ctx.lineTo(x, y + jitter(-5, 5));
  }
  ctx.stroke();
  ctx.restore();
}

// ─── 6. Background Creator & Caching ─────────────────────────────────────────
const backgroundCache = {};

function createBackground(lo) {
  const style = activeAppearance.paperStyle;
  const cacheKey = `${lo.pageW}x${lo.pageH}_${style}_${lo.lineSpacing}_${lo.marginLeft}`;
  if (backgroundCache[cacheKey]) return backgroundCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = lo.pageW; canvas.height = lo.pageH;
  const ctx = canvas.getContext('2d');

  if (style === 'ruled') {
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, lo.pageW, lo.pageH);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
    for (let i = 0; i < lo.pageW; i += 300) {
      ctx.fillRect(i, 0, 1, lo.pageH);
    }

    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lo.marginLeft - 20, 0);
    ctx.lineTo(lo.marginLeft - 20, lo.pageH);
    ctx.stroke();

    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1.8;
    const maxY = lo.pageH - lo.marginBottom;
    for (let y = lo.marginTop; y <= maxY; y += lo.lineSpacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(lo.pageW, y); ctx.stroke();
    }

  } else if (style === 'grid') {
    ctx.fillStyle = '#fbfdf9';
    ctx.fillRect(0, 0, lo.pageW, lo.pageH);

    const gridSize = Math.round(lo.lineSpacing / 2.5);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;

    for (let x = 0; x <= lo.pageW; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, lo.pageH); ctx.stroke();
    }
    for (let y = 0; y <= lo.pageH; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(lo.pageW, y); ctx.stroke();
    }

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lo.marginLeft - 20, 0); ctx.lineTo(lo.marginLeft - 20, lo.pageH);
    ctx.stroke();

  } else if (style === 'vintage') {
    const grad = ctx.createRadialGradient(lo.pageW/2, lo.pageH/2, lo.pageW*0.2, lo.pageW/2, lo.pageH/2, lo.pageW*0.8);
    grad.addColorStop(0, '#fbf4ea');
    grad.addColorStop(1, '#eddcc7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, lo.pageW, lo.pageH);

    ctx.strokeStyle = 'rgba(160, 116, 74, 0.35)';
    ctx.lineWidth = 1.6;
    const maxY = lo.pageH - lo.marginBottom;
    for (let y = lo.marginTop; y <= maxY; y += lo.lineSpacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(lo.pageW, y); ctx.stroke();
    }

  } else if (style === 'dark') {
    ctx.fillStyle = '#161a23';
    ctx.fillRect(0, 0, lo.pageW, lo.pageH);

    ctx.strokeStyle = '#273142';
    ctx.lineWidth = 1.5;
    const maxY = lo.pageH - lo.marginBottom;
    for (let y = lo.marginTop; y <= maxY; y += lo.lineSpacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(lo.pageW, y); ctx.stroke();
    }

  } else {
    const colors = {
      'blank-white': '#ffffff',
      'blank-cream': '#fdfaf2',
    };
    ctx.fillStyle = colors[style] || '#ffffff';
    ctx.fillRect(0, 0, lo.pageW, lo.pageH);
  }

  backgroundCache[cacheKey] = canvas;
  return canvas;
}

function jitter(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── 7. Unified High-Res Rendering Engine ─────────────────────────────────────
async function renderPages(docModel, onProgress) {
  const lo = { ...activeLayout };
  const d = deriveLayout(lo);
  const useJitter = activeAppearance.useJitter;
  const useDrift = activeAppearance.useDrift;
  const useCreep = activeAppearance.useCreep;
  const pen = activeAppearance.penStyle;
  const inkColor = activeAppearance.inkColor;
  const isCustomPng = activeAppearance.fontFamily === 'custom-png';

  const baseFontSizePx = Math.round((activeAppearance.fontSize || 16) * 2.8);
  const pngScale = (activeAppearance.fontSize || 16) * 0.026;

  if (isCustomPng) {
    await preloadGlyphsForModel(docModel);
  } else {
    try {
      await document.fonts.load(`bold 32px "${activeAppearance.fontFamily}"`);
      await document.fonts.load(`italic 32px "${activeAppearance.fontFamily}"`);
    } catch {}
  }

  const pages = [];
  const offscreenCache = {};
  const skippedChars = new Set();

  let bgCanvas = createBackground(lo);
  let canvas = document.createElement('canvas');
  canvas.width = lo.pageW; canvas.height = lo.pageH;
  let ctx = canvas.getContext('2d');
  ctx.drawImage(bgCanvas, 0, 0);

  let curX = d.textStartX;
  let lineIdx = 1;

  function advanceLine() {
    lineIdx++;
    const nextY = lo.marginTop + lineIdx * lo.lineSpacing;
    if (nextY > d.maxTextY) return false;
    
    // Margin creep simulation
    const creepOffset = useCreep ? Math.min(35, Math.round(lineIdx * 1.1)) : 0;
    curX = d.textStartX + creepOffset + (useJitter ? jitter(0, 20) : 0);
    return true;
  }

  async function savePage() {
    pages.push(canvas);
    if (onProgress) onProgress(pages.length);

    bgCanvas = createBackground(lo);
    canvas = document.createElement('canvas');
    canvas.width = lo.pageW; canvas.height = lo.pageH;
    ctx = canvas.getContext('2d');
    ctx.drawImage(bgCanvas, 0, 0);
    curX = d.textStartX + (useJitter ? jitter(0, 20) : 0);
    lineIdx = 1;
  }

  const headingMultipliers = { 0: 1.0, 1: 1.5, 2: 1.3, 3: 1.15 };

  function getBaselineOffset(x) {
    if (!useDrift) return 0;
    return Math.sin(x / 240) * 3.5 + Math.cos(x / 580) * 2.0;
  }

  function applyPenProperties(context) {
    if (pen === 'ballpoint') {
      context.globalAlpha = 0.90 + Math.random() * 0.09;
    } else if (pen === 'pencil') {
      context.globalAlpha = 0.78 + Math.random() * 0.12;
    } else if (pen === 'fountain') {
      context.globalAlpha = 0.96;
    } else {
      context.globalAlpha = 1.0; // gel pen
    }
  }

  async function measureWordWidth(word, runFormat, fontPx, scale) {
    if (isCustomPng) {
      let w = 0;
      for (let ci = 0; ci < word.length; ci++) {
        const ch = word[ci];
        const name = getCharFilename(ch, ci);
        const img = await loadImg(name);
        if (img) {
          w += Math.round(img.width * scale) + (useJitter ? 3 : 2);
        } else {
          ctx.save();
          ctx.font = `${runFormat.bold ? 'bold ' : ''}${runFormat.italic ? 'italic ' : ''}${fontPx}px "Caveat", cursive`;
          w += ctx.measureText(ch).width + (useJitter ? 3 : 2);
          ctx.restore();
        }
      }
      return w;
    } else {
      ctx.save();
      ctx.font = `${runFormat.bold ? 'bold ' : ''}${runFormat.italic ? 'italic ' : ''}${fontPx}px "${activeAppearance.fontFamily}", cursive`;
      const w = ctx.measureText(word).width;
      ctx.restore();
      return w;
    }
  }

  async function renderWord(word, runFormat, fontPx, scale, wrapMidWord) {
    const wordStartX = curX;
    const ruleBaselineY = lo.marginTop + lineIdx * lo.lineSpacing;

    if (isCustomPng) {
      for (let ci = 0; ci < word.length; ci++) {
        const ch = word[ci];
        const name = getCharFilename(ch, ci);
        const img = await loadImg(name);

        // Multi-variant micro-variation for identical consecutive letters
        const isRepeated = ci > 0 && word[ci] === word[ci - 1];
        const jx = (useJitter || isRepeated) ? jitter(-2, 3) : 0;
        const jy = (useJitter || isRepeated) ? jitter(-3, 3) : 0;
        const drift = getBaselineOffset(curX);

        if (img) {
          const gw = Math.round(img.width * scale);
          if (wrapMidWord && curX + gw > d.textEndX) {
            if (!advanceLine()) await savePage();
          }
          const drawY = (lo.marginTop + lineIdx * lo.lineSpacing) - Math.round(120 * scale + 10) + drift + jy;
          applyPenProperties(ctx);
          drawTintedGlyph(ctx, img, curX + jx, drawY, scale, inkColor, runFormat.bold, runFormat.italic, offscreenCache);
          curX += gw + (useJitter ? jitter(2, 5) : 3);
        } else {
          ctx.save();
          applyPenProperties(ctx);
          ctx.fillStyle = inkColor;
          ctx.font = `${runFormat.bold ? 'bold ' : ''}${runFormat.italic ? 'italic ' : ''}${fontPx}px "Caveat", cursive`;
          const gw = ctx.measureText(ch).width;
          if (wrapMidWord && curX + gw > d.textEndX) {
            if (!advanceLine()) await savePage();
          }
          const textY = ruleBaselineY - 8 + drift + jy;
          ctx.fillText(ch, curX + jx, textY);
          ctx.restore();
          curX += Math.round(gw) + (useJitter ? jitter(1, 4) : 2);
        }
      }
    } else {
      for (let ci = 0; ci < word.length; ci++) {
        const ch = word[ci];
        ctx.save();
        applyPenProperties(ctx);
        ctx.fillStyle = inkColor;
        ctx.font = `${runFormat.bold ? 'bold ' : ''}${runFormat.italic ? 'italic ' : ''}${fontPx}px "${activeAppearance.fontFamily}", cursive`;
        
        const chMetrics = ctx.measureText(ch);
        const chWidth = chMetrics.width;

        if (wrapMidWord && curX + chWidth > d.textEndX) {
          if (!advanceLine()) await savePage();
        }

        const isRepeated = ci > 0 && word[ci] === word[ci - 1];
        const jx = (useJitter || isRepeated) ? jitter(-2, 3) : 0;
        const jy = (useJitter || isRepeated) ? jitter(-2, 2) : 0;
        const rot = useJitter ? (jitter(-18, 18) * Math.PI) / 1800 : 0;
        const drift = getBaselineOffset(curX);
        const textY = ruleBaselineY - 10 + drift + jy;

        ctx.translate(curX + jx, textY);
        if (rot !== 0) ctx.rotate(rot);
        ctx.fillText(ch, 0, 0);

        if (runFormat.bold && pen === 'fountain') {
          ctx.fillStyle = inkColor;
          ctx.fillText(ch, 0.7, 0.4);
        }

        ctx.restore();
        curX += Math.round(chWidth) + (useJitter ? jitter(0, 3) : 1);
      }
    }

    if (runFormat.underline && curX > wordStartX) {
      const underlineY = (lo.marginTop + lineIdx * lo.lineSpacing) - 4 + getBaselineOffset(wordStartX);
      drawWavyUnderline(ctx, wordStartX, curX, underlineY, inkColor);
    }

    if (runFormat.strike && curX > wordStartX) {
      const strikeY = (lo.marginTop + lineIdx * lo.lineSpacing) - Math.round(35 * (activeAppearance.fontSize / 16)) + getBaselineOffset(wordStartX);
      drawScratchOutScribble(ctx, wordStartX, curX, strikeY, inkColor);
    }
  }

  // Iterate paragraphs
  for (let pi = 0; pi < docModel.length; pi++) {
    const para = docModel[pi];

    // ── Handle Diagrams ──
    if (para.type === 'diagram') {
      const img = new Image();
      img.src = para.imgSrc;
      await new Promise(res => { img.onload = res; img.onerror = res; });
      if (img.width && img.height) {
        const maxDiagW = d.contentW * 0.7;
        const diagScale = Math.min(1.0, maxDiagW / img.width);
        const dw = Math.round(img.width * diagScale);
        const dh = Math.round(img.height * diagScale);
        const requiredLines = Math.ceil(dh / lo.lineSpacing) + 1;

        if (lo.marginTop + (lineIdx + requiredLines) * lo.lineSpacing > d.maxTextY) {
          await savePage();
        }

        const diagX = d.textStartX + Math.round((d.contentW - dw) / 2);
        const diagY = lo.marginTop + lineIdx * lo.lineSpacing;
        
        ctx.save();
        ctx.drawImage(img, diagX, diagY, dw, dh);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(diagX, diagY, dw, dh);
        ctx.restore();

        lineIdx += requiredLines;
        if (para.caption) {
          ctx.save();
          ctx.fillStyle = inkColor;
          ctx.font = `italic ${Math.round(baseFontSizePx * 0.8)}px "Caveat", cursive`;
          ctx.textAlign = 'center';
          ctx.fillText(para.caption, d.textStartX + d.contentW / 2, lo.marginTop + lineIdx * lo.lineSpacing - 10);
          ctx.restore();
          lineIdx++;
        }
        curX = d.textStartX;
        continue;
      }
    }

    // ── Handle Math Formulas ──
    if (para.type === 'math' && window.katex) {
      try {
        const mathSpan = document.createElement('span');
        katex.render(para.latex, mathSpan, { displayMode: true, throwOnError: false });

        const mathSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d.contentW}" height="140">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:26px; color:${inkColor}; text-align:center;">
              ${mathSpan.innerHTML}
            </div>
          </foreignObject>
        </svg>`;

        const mathImg = new Image();
        mathImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(mathSvg);
        await new Promise(res => { mathImg.onload = res; mathImg.onerror = res; });

        const requiredLines = 2;
        if (lo.marginTop + (lineIdx + requiredLines) * lo.lineSpacing > d.maxTextY) {
          await savePage();
        }

        const mathY = lo.marginTop + lineIdx * lo.lineSpacing;
        ctx.drawImage(mathImg, d.textStartX, mathY - 15);
        lineIdx += requiredLines;
        curX = d.textStartX;
        continue;
      } catch (err) {
        console.warn('Math render error:', err);
      }
    }

    // ── Handle Standard Text ──
    const hMult = headingMultipliers[para.headingLevel] || 1.0;
    const fontPx = Math.round(baseFontSizePx * hMult);
    const scale = pngScale * hMult;

    if (pi > 0) {
      const linesToAdvance = para.headingLevel === 1 || para.headingLevel === 2 ? 2 : 1;
      let ok = true;
      for (let step = 0; step < linesToAdvance; step++) {
        if (!advanceLine()) { ok = false; break; }
      }
      if (!ok) await savePage();
    }

    curX = d.textStartX + (useJitter ? jitter(0, 20) : 0);

    if (para.listType === 'unordered') {
      await renderWord('•', { bold: true, italic: false, underline: false, strike: false }, fontPx, scale, false);
      curX += 16;
    } else if (para.listType === 'ordered') {
      await renderWord(`${para.listItemIndex || 1}.`, { bold: true, italic: false, underline: false, strike: false }, fontPx, scale, false);
      curX += 16;
    }

    const tokens = [];
    for (const run of para.runs) {
      const parts = run.text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        tokens.push({ text: p, run, isSpace: /^\s+$/.test(p) });
      }
    }

    let tokenIdx = 0;
    while (tokenIdx < tokens.length) {
      const tok = tokens[tokenIdx];

      if (tok.isSpace) {
        curX += (useJitter ? jitter(14, 22) : 18) * tok.text.length;
        tokenIdx++;
        continue;
      }

      const wordW = await measureWordWidth(tok.text, tok.run, fontPx, scale);

      if (curX + wordW > d.textEndX) {
        if (tok.text.length > 12 && wordW > d.contentW * 0.5) {
          await renderWord(tok.text, tok.run, fontPx, scale, true);
        } else {
          if (!advanceLine()) await savePage();
          await renderWord(tok.text, tok.run, fontPx, scale, false);
        }
      } else {
        await renderWord(tok.text, tok.run, fontPx, scale, false);
      }
      tokenIdx++;
    }
  }

  pages.push(canvas);
  if (onProgress) onProgress(pages.length);

  return { pages, skippedChars };
}

// ─── 8. Real-Time Debounced Preview Engine ────────────────────────────────────
let previewPagesList = [];
let currentPreviewPageIndex = 0;
let previewDebounceTimer = null;

function updateLivePreview(docModel) {
  if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
  previewDebounceTimer = setTimeout(() => doUpdateLivePreview(docModel), 35);
}

async function doUpdateLivePreview(docModel) {
  const container = document.getElementById('preview-page');
  const indicator = document.getElementById('page-indicator');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const viewport = document.getElementById('preview-viewport');
  const thumbsBar = document.getElementById('preview-thumbnails-bar');
  if (!container || !viewport) return;

  // Real-time canvas render for custom PNG font or complex math/diagram documents
  const hasCustomOrMedia = activeAppearance.fontFamily === 'custom-png' || docModel.some(p => p.type === 'diagram' || p.type === 'math');

  if (hasCustomOrMedia) {
    try {
      const { pages } = await renderPages(docModel);
      generatedCanvases = pages;
      if (currentPreviewPageIndex >= pages.length) currentPreviewPageIndex = pages.length - 1;
      if (currentPreviewPageIndex < 0) currentPreviewPageIndex = 0;

      container.innerHTML = '';
      container.style.backgroundImage = 'none';
      container.style.boxShadow = 'none';
      container.style.margin = '0 auto';
      container.style.width = '100%';
      container.style.height = 'auto';

      const canvas = pages[currentPreviewPageIndex];
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.borderRadius = '4px';
      img.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
      container.appendChild(img);

      renderThumbnails(pages);

      indicator.textContent = `Page ${currentPreviewPageIndex + 1} of ${pages.length}`;
      prevBtn.disabled = currentPreviewPageIndex === 0;
      nextBtn.disabled = currentPreviewPageIndex === pages.length - 1;
      dlPngBtn.disabled = false;
      dlAllBtn.disabled = false;
      dlPdfBtn.disabled = false;
      return;
    } catch (err) {
      console.warn('Live render error:', err);
    }
  }

  const lo = deriveLayout(activeLayout);
  const bgCanvas = createBackground(activeLayout);
  const bgUrl = bgCanvas.toDataURL();
  const fontChoice = activeAppearance.fontFamily;
  const baseFontSize = Math.round((activeAppearance.fontSize || 16) * 1.6);

  const pages = [[]];
  let curPageIdx = 0;
  let accumulatedHeight = activeLayout.lineSpacing;
  const maxPageHeight = lo.contentH;

  const headingHeights = { 
    0: activeLayout.lineSpacing, 
    1: activeLayout.lineSpacing * 2, 
    2: activeLayout.lineSpacing * 2, 
    3: activeLayout.lineSpacing * 1  
  };

  docModel.forEach(para => {
    const h = headingHeights[para.headingLevel] || activeLayout.lineSpacing;
    if (accumulatedHeight + h > maxPageHeight && pages[curPageIdx].length > 0) {
      pages.push([]);
      curPageIdx++;
      accumulatedHeight = h;
    } else {
      accumulatedHeight += h;
    }
    pages[curPageIdx].push(para);
  });

  previewPagesList = pages;
  if (currentPreviewPageIndex >= pages.length) currentPreviewPageIndex = pages.length - 1;
  if (currentPreviewPageIndex < 0) currentPreviewPageIndex = 0;

  const pageParas = previewPagesList[currentPreviewPageIndex] || [];
  const scale = 0.28;

  const scaledPageW = Math.round(activeLayout.pageW * scale);
  const scaledPageH = Math.round(activeLayout.pageH * scale);
  const scaledLineSpacing = Math.round(activeLayout.lineSpacing * scale);
  const scaledFontSize = Math.round(baseFontSize * scale);

  const paddingTop = Math.round((activeLayout.marginTop - 20) * scale);
  const paddingLeft = Math.round(activeLayout.marginLeft * scale);
  const paddingRight = Math.round(activeLayout.marginRight * scale);
  const paddingBottom = Math.round(activeLayout.marginBottom * scale);

  container.style.position = 'relative';
  container.style.margin = scaledPageW > viewport.clientWidth ? '0' : '0 auto';
  container.style.width = `${scaledPageW}px`;
  container.style.height = `${scaledPageH}px`;
  container.style.backgroundImage = `url(${bgUrl})`;
  container.style.backgroundSize = '100% 100%';
  container.style.backgroundRepeat = 'no-repeat';

  let html = `<div class="pv-content" style="font-family:'${fontChoice}', cursive; color:${activeAppearance.inkColor}; width:100%; height:100%; padding: ${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px; box-sizing: border-box; font-size: ${scaledFontSize}px; line-height: ${scaledLineSpacing}px; position:relative;">`;

  pageParas.forEach(para => {
    const align = para.alignment !== 'left' ? `text-align:${para.alignment};` : '';
    const tag = para.headingLevel === 1 ? 'h1' : para.headingLevel === 2 ? 'h2' : para.headingLevel === 3 ? 'h3' : 'div';
    
    const headingMultipliers = { 0: 1.0, 1: 1.45, 2: 1.25, 3: 1.15 };
    const hMult = headingMultipliers[para.headingLevel] || 1.0;
    const hFontSize = Math.round(scaledFontSize * hMult);
    const linesToAdvance = para.headingLevel === 1 || para.headingLevel === 2 ? 2 : 1;
    const marginTop = linesToAdvance > 1 ? scaledLineSpacing : 0;

    html += `<${tag} class="pv-para" style="${align} font-size:${hFontSize}px; line-height:${scaledLineSpacing}px; margin-top:${marginTop}px; margin-bottom:0;">`;

    if (para.listType === 'unordered') html += `• `;
    else if (para.listType === 'ordered') html += `${para.listItemIndex || 1}. `;

    para.runs.forEach(run => {
      let t = run.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let styles = '';
      if (run.italic) styles += 'font-style:italic; transform:skewX(-8deg); display:inline-block;';
      if (run.bold) styles += 'font-weight:700; text-shadow: 1px 0px 0px currentColor;';
      if (run.underline) styles += 'text-decoration:underline;';
      if (run.strike) styles += 'text-decoration:line-through; color:rgba(239,68,68,0.85);';
      if (styles) t = `<span style="${styles}">${t}</span>`;
      html += t;
    });

    html += `</${tag}>`;
  });

  html += `</div>`;
  container.innerHTML = html;

  indicator.textContent = `Page ${currentPreviewPageIndex + 1} of ${pages.length}`;
  prevBtn.disabled = currentPreviewPageIndex === 0;
  nextBtn.disabled = currentPreviewPageIndex === pages.length - 1;
}

function renderThumbnails(canvases) {
  const bar = document.getElementById('preview-thumbnails-bar');
  if (!bar || !canvases.length) return;
  bar.innerHTML = '';

  canvases.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = `preview-thumbnail-card ${idx === currentPreviewPageIndex ? 'active' : ''}`;
    const img = document.createElement('img');
    img.src = c.toDataURL('image/jpeg', 0.6);
    card.appendChild(img);

    const badge = document.createElement('span');
    badge.className = 'thumbnail-badge';
    badge.textContent = `${idx + 1}`;
    card.appendChild(badge);

    card.addEventListener('click', () => {
      currentPreviewPageIndex = idx;
      doUpdateLivePreview(activeDocModel);
    });

    bar.appendChild(card);
  });
}

window.addEventListener('resize', () => updateLivePreview(activeDocModel));

// ─── 9. File Download Helper ──────────────────────────────────────────────────
function downloadCanvas(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  setTimeout(() => document.body.removeChild(link), 150);
}

// ─── 10. Glyph Studio (Interactive Character Synthesizer) ────────────────────
const glyphStudioModal   = $('glyph-studio-modal');
const openGlyphStudioBtn = $('open-glyph-studio-btn');
const closeGlyphStudioBtn= $('close-glyph-studio-btn');
const glyphCharPicker    = $('glyph-char-picker');
const currentCharStatus  = $('current-char-status');
const currentCharFilename= $('current-char-filename');
const glyphCurrentPreview= $('glyph-current-preview');
const glyphDrawCanvas    = $('glyph-draw-canvas');
const toolPenBtn         = $('tool-pen-btn');
const toolEraserBtn      = $('tool-eraser-btn');
const penSizeSlider      = $('pen-size-slider');
const penSizeVal         = $('pen-size-val');
const drawUndoBtn        = $('draw-undo-btn');
const drawClearBtn       = $('draw-clear-btn');
const saveDrawnGlyphBtn  = $('save-drawn-glyph-btn');
const exportGlyphPackBtn = $('export-glyph-pack-btn');

let drawCtx = null;
let isDrawing = false;
let currentDrawTool = 'pen'; // 'pen' | 'eraser'
let drawUndoStack = [];

function initGlyphStudio() {
  if (!glyphDrawCanvas) return;
  drawCtx = glyphDrawCanvas.getContext('2d', { willReadFrequently: true });
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';

  // Populate Character Picker
  glyphCharPicker.innerHTML = '';
  GLYPH_MANIFEST.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.file;
    opt.dataset.char = g.char;
    opt.textContent = `${g.char} — ${g.desc} (${g.file}.png)`;
    glyphCharPicker.appendChild(opt);
  });

  // Load Saved Glyphs from LocalStorage
  try {
    const saved = localStorage.getItem(USER_GLYPHS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([name, dataUrl]) => {
        const img = new Image();
        img.onload = () => { customGlyphMap[name] = img; };
        img.src = dataUrl;
      });
    }
  } catch {}

  glyphCharPicker.addEventListener('change', onSelectedCharChange);
  openGlyphStudioBtn.addEventListener('click', () => {
    glyphStudioModal.style.display = 'flex';
    onSelectedCharChange();
  });
  closeGlyphStudioBtn.addEventListener('click', () => {
    glyphStudioModal.style.display = 'none';
  });

  // Tools
  toolPenBtn.addEventListener('click', () => {
    currentDrawTool = 'pen';
    toolPenBtn.classList.add('active');
    toolEraserBtn.classList.remove('active');
  });
  toolEraserBtn.addEventListener('click', () => {
    currentDrawTool = 'eraser';
    toolEraserBtn.classList.add('active');
    toolPenBtn.classList.remove('active');
  });
  penSizeSlider.addEventListener('input', () => {
    penSizeVal.textContent = `${penSizeSlider.value}px`;
  });

  // Drawing event listeners
  function getCanvasCoords(e) {
    const rect = glyphDrawCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (glyphDrawCanvas.width / rect.width),
      y: (clientY - rect.top) * (glyphDrawCanvas.height / rect.height),
    };
  }

  function saveUndo() {
    drawUndoStack.push(drawCtx.getImageData(0, 0, glyphDrawCanvas.width, glyphDrawCanvas.height));
    if (drawUndoStack.length > 15) drawUndoStack.shift();
  }

  glyphDrawCanvas.addEventListener('mousedown', (e) => {
    saveUndo();
    isDrawing = true;
    const { x, y } = getCanvasCoords(e);
    drawCtx.beginPath();
    drawCtx.moveTo(x, y);
    setupDrawStroke();
    drawCtx.lineTo(x, y);
    drawCtx.stroke();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);
    setupDrawStroke();
    drawCtx.lineTo(x, y);
    drawCtx.stroke();
  });

  window.addEventListener('mouseup', () => { isDrawing = false; });

  // Touch
  glyphDrawCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    saveUndo();
    isDrawing = true;
    const { x, y } = getCanvasCoords(e);
    drawCtx.beginPath();
    drawCtx.moveTo(x, y);
    setupDrawStroke();
    drawCtx.lineTo(x, y);
    drawCtx.stroke();
  }, { passive: false });

  glyphDrawCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);
    setupDrawStroke();
    drawCtx.lineTo(x, y);
    drawCtx.stroke();
  }, { passive: false });

  glyphDrawCanvas.addEventListener('touchend', () => { isDrawing = false; });

  drawUndoBtn.addEventListener('click', () => {
    if (drawUndoStack.length > 0) {
      const last = drawUndoStack.pop();
      drawCtx.putImageData(last, 0, 0);
    }
  });

  drawClearBtn.addEventListener('click', () => {
    saveUndo();
    drawCtx.clearRect(0, 0, glyphDrawCanvas.width, glyphDrawCanvas.height);
  });

  saveDrawnGlyphBtn.addEventListener('click', saveDrawnCharacter);
  exportGlyphPackBtn.addEventListener('click', exportGlyphPack);
}

function setupDrawStroke() {
  const size = parseInt(penSizeSlider.value) || 5;
  drawCtx.lineWidth = size;
  if (currentDrawTool === 'eraser') {
    drawCtx.globalCompositeOperation = 'destination-out';
  } else {
    drawCtx.globalCompositeOperation = 'source-over';
    drawCtx.strokeStyle = '#111827';
  }
}

async function onSelectedCharChange() {
  const selectedFile = glyphCharPicker.value;
  currentCharFilename.textContent = `${selectedFile}.png`;

  const existing = await loadImg(selectedFile);
  drawCtx.clearRect(0, 0, glyphDrawCanvas.width, glyphDrawCanvas.height);
  drawUndoStack = [];

  if (existing) {
    currentCharStatus.textContent = 'Custom/Present';
    currentCharStatus.className = 'glyph-badge badge-present';
    glyphCurrentPreview.innerHTML = `<img src="${existing.src}" />`;

    // Draw reference onto canvas
    drawCtx.save();
    const scale = 1.3;
    const dx = (glyphDrawCanvas.width - existing.width * scale) / 2;
    const dy = (glyphDrawCanvas.height - existing.height * scale) / 2;
    drawCtx.drawImage(existing, dx, dy, existing.width * scale, existing.height * scale);
    drawCtx.restore();
  } else {
    currentCharStatus.textContent = 'Missing';
    currentCharStatus.className = 'glyph-badge badge-missing';
    glyphCurrentPreview.innerHTML = '<span>None</span>';
  }
}

function saveDrawnCharacter() {
  const fileName = glyphCharPicker.value;
  const idata = drawCtx.getImageData(0, 0, glyphDrawCanvas.width, glyphDrawCanvas.height);
  const d = idata.data;

  // Find bounding box
  let minX = glyphDrawCanvas.width, maxX = 0, minY = glyphDrawCanvas.height, maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < glyphDrawCanvas.height; y++) {
    for (let x = 0; x < glyphDrawCanvas.width; x++) {
      const alpha = d[(y * glyphDrawCanvas.width + x) * 4 + 3];
      if (alpha > 15) {
        hasPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) { alert('Canvas is empty. Draw a character first.'); return; }

  // Add 10px padding
  const pad = 10;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(glyphDrawCanvas.width, maxX + pad);
  maxY = Math.min(glyphDrawCanvas.height, maxY + pad);

  const cropW = Math.max(10, maxX - minX);
  const cropH = Math.max(10, maxY - minY);

  // Resize to standard 160px height
  const targetH = 160;
  const targetW = Math.round((cropW / cropH) * targetH);

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = targetW;
  cropCanvas.height = targetH;
  const cctx = cropCanvas.getContext('2d');
  cctx.drawImage(glyphDrawCanvas, minX, minY, cropW, cropH, 0, 0, targetW, targetH);

  const dataUrl = cropCanvas.toDataURL('image/png');
  const img = new Image();
  img.onload = () => {
    customGlyphMap[fileName] = img;
    currentCharStatus.textContent = 'Saved (Custom)';
    currentCharStatus.className = 'glyph-badge badge-present';
    glyphCurrentPreview.innerHTML = `<img src="${dataUrl}" />`;

    // Persist to LocalStorage
    try {
      const saved = JSON.parse(localStorage.getItem(USER_GLYPHS_STORAGE_KEY) || '{}');
      saved[fileName] = dataUrl;
      localStorage.setItem(USER_GLYPHS_STORAGE_KEY, JSON.stringify(saved));
    } catch {}

    // Switch to custom PNG mode if not already
    activeAppearance.fontFamily = 'custom-png';
    $('handwriting-font').value = 'custom-png';
    $('custom-glyph-area').style.display = 'inline-flex';
    saveSettingsToStorage();
    onEditorInput();
    setStatus('done', `✅ Saved glyph "${fileName}.png" into custom font!`);
  };
  img.src = dataUrl;
}

function exportGlyphPack() {
  const pack = {};
  GLYPH_MANIFEST.forEach(g => {
    if (customGlyphMap[g.file]) {
      pack[g.file] = customGlyphMap[g.file].src;
    } else if (window.DEFAULT_MYFONT_GLYPHS && window.DEFAULT_MYFONT_GLYPHS[g.file]) {
      pack[g.file] = window.DEFAULT_MYFONT_GLYPHS[g.file];
    }
  });

  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = 'inkforge-custom-glyphs.json';
  a.href = URL.createObjectURL(blob);
  a.click();
}

// ─── 11. KaTeX Math Modal & Diagram Upload ────────────────────────────────────
const insertMathBtn      = $('insert-math-btn');
const mathFormulaModal   = $('math-formula-modal');
const closeMathModalBtn  = $('close-math-modal-btn');
const cancelMathBtn      = $('cancel-math-btn');
const insertMathSubmitBtn= $('insert-math-submit-btn');
const mathLatexInput     = $('math-latex-input');
const mathLivePreview    = $('math-live-preview');
const mathQuickBtns      = document.querySelectorAll('.math-quick-btn');

const insertDiagramBtn   = $('insert-diagram-btn');
const diagramUploadInput = $('diagram-upload-input');

function initMathAndDiagrams() {
  if (insertMathBtn) {
    insertMathBtn.addEventListener('click', () => {
      mathFormulaModal.style.display = 'flex';
      mathLatexInput.focus();
      updateMathPreview();
    });
  }

  [closeMathModalBtn, cancelMathBtn].forEach(btn => {
    if (btn) btn.addEventListener('click', () => { mathFormulaModal.style.display = 'none'; });
  });

  function updateMathPreview() {
    const tex = mathLatexInput.value.trim() || 'E = mc^2';
    if (window.katex && mathLivePreview) {
      try {
        katex.render(tex, mathLivePreview, { displayMode: true, throwOnError: false });
      } catch (err) {
        mathLivePreview.innerHTML = `<span style="color:#ef4444;font-size:0.8rem">${err.message}</span>`;
      }
    }
  }

  if (mathLatexInput) {
    mathLatexInput.addEventListener('input', updateMathPreview);
  }

  mathQuickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mathLatexInput.value = btn.dataset.tex;
      updateMathPreview();
    });
  });

  if (insertMathSubmitBtn) {
    insertMathSubmitBtn.addEventListener('click', () => {
      const tex = mathLatexInput.value.trim();
      if (!tex) return;
      const mathHtml = `<div class="editor-math-block" data-latex="${tex.replace(/"/g, '&quot;')}">$$${tex}$$</div><p></p>`;
      document.execCommand('insertHTML', false, mathHtml);
      mathFormulaModal.style.display = 'none';
      onEditorInput();
    });
  }

  // Diagram Upload
  if (insertDiagramBtn) {
    insertDiagramBtn.addEventListener('click', () => diagramUploadInput.click());
  }

  if (diagramUploadInput) {
    diagramUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const diagramHtml = `<div class="editor-diagram-block"><img src="${evt.target.result}" /><div class="diagram-caption" contenteditable="true">Figure: ${file.name.replace(/\.[^/.]+$/, "")}</div></div><p></p>`;
        document.execCommand('insertHTML', false, diagramHtml);
        onEditorInput();
      };
      reader.readAsDataURL(file);
    });
  }
}

// ─── 12. UI Wiring & Customization Panel ─────────────────────────────────────
const editorSurface    = $('editor-surface');
const charCount        = $('char-count');
const statusBar        = $('status-bar');
const generateBtn      = $('generate-btn');
const dlPngBtn         = $('dl-png-btn');
const dlAllBtn         = $('dl-all-btn');
const dlPdfBtn         = $('dl-pdf-btn');
const pdfUploadBtn     = $('pdf-upload-btn');
const pdfUploadInput   = $('pdf-upload-input');

const fontSelect       = $('handwriting-font');
const penSelect        = $('pen-style');
const paperStyleSelect = $('paper-style');
const inkColorInput    = $('ink-color');
const colorPresets     = document.querySelectorAll('.color-preset');
const pageSizeSelect   = $('page-size-select');
const customSizeRow    = $('custom-size-row');
const customPageW      = $('custom-page-w');
const customPageH      = $('custom-page-h');
const fontSizeInput    = $('font-size-input');
const lineGapInput     = $('line-gap-input');
const jitterToggle     = $('jitter-toggle');
const driftToggle      = $('drift-toggle');
const creepToggle      = $('creep-toggle');
const resetBtn         = $('reset-btn');
const missingToggleBtn = $('missing-chars-toggle');

const glyphUploadArea  = $('custom-glyph-area');
const glyphUploadBtn   = $('glyph-upload-btn');
const glyphUploadInput = $('glyph-upload-input');
const glyphClearBtn    = $('glyph-clear-btn');
const glyphStatus      = $('glyph-upload-status');

let generatedCanvases = [];
let activeDocModel = [];

function setStatus(type, msg) {
  statusBar.innerHTML = `<span class="status-${type}">${msg}</span>`;
}

// ── Toolbar Actions ──
document.querySelectorAll('.tb-btn[data-cmd]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const cmd = btn.dataset.cmd;
    if (cmd === 'h1' || cmd === 'h2' || cmd === 'h3') {
      document.execCommand('formatBlock', false, cmd.toUpperCase());
    } else {
      document.execCommand(cmd, false, null);
    }
    btn.classList.toggle('active', document.queryCommandState(cmd));
    onEditorInput();
  });
});

editorSurface.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand('insertText', false, '    ');
    onEditorInput();
  }
});

function onEditorInput() {
  activeDocModel = parseEditorDOM(editorSurface);
  let totalChars = 0;
  activeDocModel.forEach(p => p.runs.forEach(r => totalChars += r.text.length));
  charCount.textContent = `${totalChars} chars`;
  updateLivePreview(activeDocModel);
}

editorSurface.addEventListener('input', onEditorInput);

// ── Customization Inputs ──
fontSelect.addEventListener('change', () => {
  activeAppearance.fontFamily = fontSelect.value;
  glyphUploadArea.style.display = fontSelect.value === 'custom-png' ? 'inline-flex' : 'none';
  saveSettingsToStorage();
  onEditorInput();
});

penSelect.addEventListener('change', () => {
  activeAppearance.penStyle = penSelect.value;
  saveSettingsToStorage();
  onEditorInput();
});

paperStyleSelect.addEventListener('change', () => {
  activeAppearance.paperStyle = paperStyleSelect.value;
  saveSettingsToStorage();
  onEditorInput();
});

pageSizeSelect.addEventListener('change', () => {
  const val = pageSizeSelect.value;
  if (val === 'custom') {
    customSizeRow.style.display = 'inline-flex';
  } else {
    customSizeRow.style.display = 'none';
    const preset = PAGE_SIZE_PRESETS[val];
    if (preset) {
      activeLayout.pageW = preset.pageW;
      activeLayout.pageH = preset.pageH;
      activeLayout.marginTop = preset.marginTop;
      activeLayout.marginLeft = preset.marginLeft;
      activeLayout.lineSpacing = preset.lineSpacing;
      lineGapInput.value = preset.lineSpacing;
      customPageW.value = preset.pageW;
      customPageH.value = preset.pageH;
    }
  }
  saveSettingsToStorage();
  onEditorInput();
});

[customPageW, customPageH].forEach(input => {
  input.addEventListener('change', () => {
    activeLayout.pageW = parseInt(customPageW.value) || 2480;
    activeLayout.pageH = parseInt(customPageH.value) || 3508;
    saveSettingsToStorage();
    onEditorInput();
  });
});

inkColorInput.addEventListener('input', () => {
  activeAppearance.inkColor = inkColorInput.value;
  colorPresets.forEach(b => b.classList.toggle('active', b.dataset.color === activeAppearance.inkColor));
  saveSettingsToStorage();
  onEditorInput();
});

colorPresets.forEach(btn => {
  btn.addEventListener('click', () => {
    colorPresets.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    inkColorInput.value = btn.dataset.color;
    activeAppearance.inkColor = btn.dataset.color;
    saveSettingsToStorage();
    onEditorInput();
  });
});

fontSizeInput.addEventListener('change', () => {
  activeAppearance.fontSize = parseInt(fontSizeInput.value) || 16;
  saveSettingsToStorage();
  onEditorInput();
});

lineGapInput.addEventListener('change', () => {
  activeLayout.lineSpacing = parseInt(lineGapInput.value) || 110;
  saveSettingsToStorage();
  onEditorInput();
});

jitterToggle.addEventListener('change', () => {
  activeAppearance.useJitter = jitterToggle.checked;
  saveSettingsToStorage();
  onEditorInput();
});

if (driftToggle) {
  driftToggle.addEventListener('change', () => {
    activeAppearance.useDrift = driftToggle.checked;
    saveSettingsToStorage();
    onEditorInput();
  });
}

if (creepToggle) {
  creepToggle.addEventListener('change', () => {
    activeAppearance.useCreep = creepToggle.checked;
    saveSettingsToStorage();
    onEditorInput();
  });
}

// ── Custom Glyph PNG Upload ──
glyphUploadBtn.addEventListener('click', () => glyphUploadInput.click());

glyphUploadInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  let loaded = 0;
  files.forEach(file => {
    const name = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        customGlyphMap[name] = img;
        loaded++;
        glyphStatus.textContent = `${loaded} glyphs`;
        glyphClearBtn.style.display = 'inline-block';
        if (loaded === files.length) {
          activeAppearance.fontFamily = 'custom-png';
          fontSelect.value = 'custom-png';
          saveSettingsToStorage();
          onEditorInput();
        }
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });
});

glyphClearBtn.addEventListener('click', () => {
  customGlyphMap = {};
  glyphStatus.textContent = '';
  glyphClearBtn.style.display = 'none';
  activeAppearance.fontFamily = 'Caveat';
  fontSelect.value = 'Caveat';
  glyphUploadArea.style.display = 'none';
  saveSettingsToStorage();
  onEditorInput();
});

// ── Preview Navigation & Refresh ──
const previewTitleBtn = $('preview-title-btn');
if (previewTitleBtn) {
  previewTitleBtn.addEventListener('click', () => {
    onEditorInput();
    setStatus('idle', '🔄 Refreshed live notebook preview.');
  });
}

$('prev-page-btn').addEventListener('click', () => {
  if (currentPreviewPageIndex > 0) {
    currentPreviewPageIndex--;
    updateLivePreview(activeDocModel);
    $('preview-viewport').scrollTop = 0;
  }
});

$('next-page-btn').addEventListener('click', () => {
  if (currentPreviewPageIndex < previewPagesList.length - 1) {
    currentPreviewPageIndex++;
    updateLivePreview(activeDocModel);
    $('preview-viewport').scrollTop = 0;
  }
});

// ── High-Res Page Generation ──
generateBtn.addEventListener('click', async () => {
  if (!activeDocModel.length) { setStatus('error', '⚠️ Please enter text first.'); return; }

  generateBtn.disabled = true;
  setStatus('working', 'Synthesizing high-res handwriting pages…');

  try {
    const { pages, skippedChars } = await renderPages(activeDocModel, (p) => {
      setStatus('working', `Synthesizing page ${p}…`);
    });

    generatedCanvases = pages;

    const previewContainer = document.getElementById('preview-page');
    previewContainer.innerHTML = '';
    const img = document.createElement('img');
    img.src = pages[currentPreviewPageIndex].toDataURL('image/png');
    img.style.width = '100%';
    img.style.height = 'auto';
    previewContainer.appendChild(img);

    renderThumbnails(pages);

    const n = pages.length;
    let statusMsg = `✅ ${n} page${n > 1 ? 's' : ''} synthesized at 300 DPI! Ready for download.`;
    if (skippedChars.size > 0) {
      statusMsg += ` (${skippedChars.size} unsupported glyphs handled via natural fallback)`;
    }

    setStatus('done', statusMsg);
    dlPngBtn.disabled = false;
    dlAllBtn.disabled = false;
    dlPdfBtn.disabled = false;

  } catch (err) {
    console.error(err);
    setStatus('error', `❌ Synthesis failed: ${err.message}`);
  } finally {
    generateBtn.disabled = false;
  }
});

// ── Downloads ──
dlPngBtn.addEventListener('click', () => {
  if (generatedCanvases[currentPreviewPageIndex]) {
    downloadCanvas(generatedCanvases[currentPreviewPageIndex], `inkforge_page_${currentPreviewPageIndex + 1}.png`);
  }
});

dlAllBtn.addEventListener('click', () => {
  generatedCanvases.forEach((c, i) => {
    setTimeout(() => downloadCanvas(c, `inkforge_page_${i + 1}.png`), i * 400);
  });
});

// ── Clean PDF Export ──
dlPdfBtn.addEventListener('click', async () => {
  if (!generatedCanvases.length) return;
  if (!window.jspdf) { alert('jsPDF not loaded'); return; }

  setStatus('working', `Exporting multi-page PDF (${generatedCanvases.length} pages)…`);
  try {
    const { jsPDF } = window.jspdf;
    const pdfW = 210; // A4 mm
    const pdfH = Math.round(pdfW * (activeLayout.pageH / activeLayout.pageW));
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfW, pdfH] });

    for (let i = 0; i < generatedCanvases.length; i++) {
      if (i > 0) doc.addPage([pdfW, pdfH], 'portrait');
      doc.addImage(generatedCanvases[i].toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, pdfW, pdfH);
    }

    doc.save('handwritten_notes.pdf');
    setStatus('done', `✅ Multi-page PDF successfully downloaded!`);
  } catch (err) {
    setStatus('error', `❌ PDF export failed: ${err.message}`);
  }
});

// ── PDF Text Extraction ──
pdfUploadBtn.addEventListener('click', () => pdfUploadInput.click());
pdfUploadInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !window.pdfjsLib) return;

  setStatus('working', `Extracting text from "${file.name}"…`);
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      fullText += tc.items.map(i => i.str).join(' ') + '\n\n';
    }
    editorSurface.innerHTML = `<p>${fullText.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
    onEditorInput();
    setStatus('done', `✅ Text extracted from ${file.name}`);
  } catch (err) {
    setStatus('error', `❌ PDF extraction failed: ${err.message}`);
  }
});

// ── Missing Characters Panel ──
missingToggleBtn.addEventListener('click', async () => {
  const panel = $('missing-chars-panel');
  const isOpen = panel.classList.toggle('open');
  if (isOpen) {
    const container = $('missing-chars-body');
    container.innerHTML = '<p class="dr-hint">Checking glyph coverage in myfont/…</p>';
    const results = await Promise.all(GLYPH_MANIFEST.map(async g => ({ ...g, present: (await loadImg(g.file)) !== null })));
    const missing = results.filter(r => !r.present);
    const present = results.filter(r => r.present);

    let html = `<p class="chars-summary">✅ <strong>${present.length}</strong> present | ℹ️ <strong>${missing.length}</strong> handled via vector fallback</p>`;
    if (missing.length) {
      html += '<table class="chars-table"><thead><tr><th>Char</th><th>File</th></tr></thead><tbody>';
      missing.forEach(g => {
        const safe = g.char === '<' ? '&lt;' : g.char === '>' ? '&gt;' : g.char === '&' ? '&amp;' : g.char;
        html += `<tr><td class="glyph-char">${safe}</td><td><code>${g.file}.png</code></td></tr>`;
      });
      html += '</tbody></table>';
    } else {
      html += '<p style="color:#4ade80;font-size:0.85rem">🎉 All glyphs present in directory!</p>';
    }
    container.innerHTML = html;
  }
});

// ── Storage & Reset ──
function saveSettingsToStorage() {
  const state = { layout: activeLayout, appearance: activeAppearance };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function loadSettingsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

resetBtn.addEventListener('click', () => {
  activeLayout = { ...DEFAULT_LAYOUT };
  activeAppearance = { ...DEFAULT_APPEARANCE };
  
  fontSelect.value = 'Caveat';
  penSelect.value = 'gel';
  paperStyleSelect.value = 'ruled';
  pageSizeSelect.value = 'ruled';
  customSizeRow.style.display = 'none';
  fontSizeInput.value = 16;
  lineGapInput.value = 110;
  inkColorInput.value = '#1a237e';
  jitterToggle.checked = true;
  if (driftToggle) driftToggle.checked = true;
  if (creepToggle) creepToggle.checked = true;

  saveSettingsToStorage();
  onEditorInput();
});

// ── Initial Boot ──
(function init() {
  initGlyphStudio();
  initMathAndDiagrams();

  const saved = loadSettingsFromStorage();
  if (saved) {
    activeLayout = { ...DEFAULT_LAYOUT, ...(saved.layout || {}) };
    activeAppearance = { ...DEFAULT_APPEARANCE, ...(saved.appearance || {}) };

    if (fontSelect) fontSelect.value = activeAppearance.fontFamily || 'Caveat';
    if (penSelect) penSelect.value = activeAppearance.penStyle || 'gel';
    if (paperStyleSelect) paperStyleSelect.value = activeAppearance.paperStyle || 'ruled';
    if (fontSizeInput) fontSizeInput.value = activeAppearance.fontSize || 16;
    if (lineGapInput) lineGapInput.value = activeLayout.lineSpacing || 110;
    if (inkColorInput) inkColorInput.value = activeAppearance.inkColor || '#1a237e';
    if (jitterToggle) jitterToggle.checked = activeAppearance.useJitter !== false;
    if (driftToggle) driftToggle.checked = activeAppearance.useDrift !== false;
    if (creepToggle) creepToggle.checked = activeAppearance.useCreep !== false;
  }

  setTimeout(onEditorInput, 80);
})();
