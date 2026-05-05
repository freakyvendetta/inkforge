/**
 * InkForge Studio — app.js
 * Advanced rich-text to realistic handwriting rendering engine.
 *
 * Architecture:
 * DOM (contenteditable) ──> Document Model (Paragraphs & Runs)
 *                               ├──> Live Webfont Preview (Instant, Cached, Debounced)
 *                               └──> Canvas Synthesis Engine (High-Res 300 DPI, Pen Physics, Drift, Dual Glyphs)
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
  { char: ',',  file: 'coma',   desc: 'Comma' },
  { char: '.',  file: 'fs',     desc: 'Period / Full stop' },
  { char: '?',  file: 'que',    desc: 'Question mark' },
  { char: '!',  file: 'excl',   desc: 'Exclamation mark' },
  { char: "'",  file: 'apos',   desc: 'Apostrophe' },
  { char: '"',  file: 'quo',    desc: 'Double quote' },
  { char: ':',  file: 'colon',  desc: 'Colon' },
  { char: ';',  file: 'semi',   desc: 'Semicolon' },
  { char: '-',  file: 'sub',    desc: 'Hyphen / minus' },
  { char: '+',  file: 'plus',   desc: 'Plus' },
  { char: '=',  file: 'equal',  desc: 'Equals' },
  { char: '*',  file: 'star',   desc: 'Asterisk' },
  { char: '/',  file: 'div',    desc: 'Slash / divide' },
  { char: '\\', file: 'bslash', desc: 'Backslash' },
  { char: '|',  file: 'pipe',   desc: 'Pipe' },
  { char: '%',  file: 'perc',   desc: 'Percent' },
  { char: '&',  file: 'amp',    desc: 'Ampersand' },
  { char: '@',  file: 'at',     desc: 'At sign' },
  { char: '_',  file: 'under',  desc: 'Underscore' },
  { char: '^',  file: 'caret',  desc: 'Caret' },
  { char: '~',  file: 'tilde',  desc: 'Tilde' },
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
// High resolution 300 DPI print standard: A4 = 2480 x 3508 px
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
  useDrift:     false,
});

const PAGE_SIZE_PRESETS = {
  ruled:  { label: 'Standard Ruled', pageW: 2480, pageH: 3508, marginTop: 450, marginLeft: 290, lineSpacing: 110 },
  a4:     { label: 'A4 Sheet',      pageW: 2480, pageH: 3508, marginTop: 420, marginLeft: 260, lineSpacing: 105 },
  letter: { label: 'US Letter',     pageW: 2550, pageH: 3300, marginTop: 400, marginLeft: 270, lineSpacing: 105 },
};

const STORAGE_KEY = 'inkforge-config-v4';

let activeLayout = { ...DEFAULT_LAYOUT };
let activeAppearance = { ...DEFAULT_APPEARANCE };
let customGlyphMap = {}; // filename -> Image for uploaded custom PNG glyphs

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
  if (activeAppearance.fontFamily === 'custom-png' && customGlyphMap[name]) {
    return Promise.resolve(customGlyphMap[name]);
  }
  if (imgCache[name]) return imgCache[name];
  const promise = new Promise((resolve) => {
    const img = new Image();
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
    for (const run of para.runs) {
      for (const ch of run.text) {
        if (ch === '$') { needed.add('dol1'); needed.add('dol2'); continue; }
        if (VALID_CHARS.includes(ch)) needed.add(getCharFilename(ch, 0));
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
          headingLevel: 0,
          alignment: 'left',
          listType: currentList,
          listItemIndex: listIdx,
          runs: [{ text, bold: false, italic: false, underline: false }]
        });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
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
    parseInlineNodes(node, runs, false, false, false);

    if (runs.length === 0) {
      runs.push({ text: '', bold: false, italic: false, underline: false });
    }

    paragraphs.push({
      headingLevel,
      alignment,
      listType: currentList || (tag === 'li' ? 'unordered' : null),
      listItemIndex: listIdx,
      runs
    });
  }

  function parseInlineNodes(element, runs, isBold, isItalic, isUnderline) {
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        if (text) {
          runs.push({ text, bold: isBold, italic: isItalic, underline: isUnderline });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        const b = isBold || tag === 'b' || tag === 'strong' || child.style.fontWeight === 'bold' || parseInt(child.style.fontWeight) >= 600;
        const i = isItalic || tag === 'i' || tag === 'em' || child.style.fontStyle === 'italic';
        const u = isUnderline || tag === 'u' || (child.style.textDecoration && child.style.textDecoration.includes('underline'));
        
        if (tag === 'br') {
          runs.push({ text: '\n', bold: b, italic: i, underline: u });
        } else {
          parseInlineNodes(child, runs, b, i, u);
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
      headingLevel: 0,
      alignment: 'left',
      listType: null,
      listItemIndex: 1,
      runs: [{ text: '', bold: false, italic: false, underline: false }]
    });
  }

  return paragraphs;
}

// ─── 5. Fast Canvas Compositor & Tinting Engine ──────────────────────────────
function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  return {
    r: parseInt(c.slice(0, 2), 16) || 0,
    g: parseInt(c.slice(2, 4), 16) || 0,
    b: parseInt(c.slice(4, 6), 16) || 0,
  };
}

// GPU-accelerated source-in compositing (100x faster than CPU loop)
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
    // Ruled notebook: clean off-white ivory paper with red margin and blue ruled lines
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, lo.pageW, lo.pageH);

    // Subtle paper texture grain
    ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
    for (let i = 0; i < lo.pageW; i += 300) {
      ctx.fillRect(i, 0, 1, lo.pageH);
    }

    // Red vertical margin line
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lo.marginLeft - 20, 0);
    ctx.lineTo(lo.marginLeft - 20, lo.pageH);
    ctx.stroke();

    // Blue horizontal ruled lines
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1.8;
    const maxY = lo.pageH - lo.marginBottom;
    for (let y = lo.marginTop; y <= maxY; y += lo.lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(lo.pageW, y);
      ctx.stroke();
    }

  } else if (style === 'grid') {
    // Engineering Math / Grid Paper
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

    // Margin rule
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lo.marginLeft - 20, 0); ctx.lineTo(lo.marginLeft - 20, lo.pageH);
    ctx.stroke();

  } else if (style === 'vintage') {
    // Vintage Sepia Parchment
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
    // Dark Blackboard
    ctx.fillStyle = '#161a23';
    ctx.fillRect(0, 0, lo.pageW, lo.pageH);

    ctx.strokeStyle = '#273142';
    ctx.lineWidth = 1.5;
    const maxY = lo.pageH - lo.marginBottom;
    for (let y = lo.marginTop; y <= maxY; y += lo.lineSpacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(lo.pageW, y); ctx.stroke();
    }

  } else {
    // Blank variants
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
  const pen = activeAppearance.penStyle;
  const inkColor = activeAppearance.inkColor;
  const isCustomPng = activeAppearance.fontFamily === 'custom-png';

  // Base font size scaling (pt to 300 DPI canvas px)
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
    curX = d.textStartX + (useJitter ? jitter(0, 25) : 0);
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
    curX = d.textStartX + (useJitter ? jitter(0, 25) : 0);
    lineIdx = 1;
  }

  const headingMultipliers = { 0: 1.0, 1: 1.5, 2: 1.3, 3: 1.15 };

  // Calculate baseline drift for realism
  function getBaselineOffset(x) {
    if (!useDrift) return 0;
    return Math.sin(x / 240) * 3.5 + Math.cos(x / 580) * 2.0;
  }

  // Pen stroke setup
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

  // Measure word width
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
          // Fallback vector measurement
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

  // Render a word onto canvas
  async function renderWord(word, runFormat, fontPx, scale, wrapMidWord) {
    const wordStartX = curX;
    const ruleBaselineY = lo.marginTop + lineIdx * lo.lineSpacing;

    if (isCustomPng) {
      // PNG glyph rendering with graceful vector fallback for missing symbols
      for (let ci = 0; ci < word.length; ci++) {
        const ch = word[ci];
        const name = getCharFilename(ch, ci);
        const img = await loadImg(name);

        const jx = useJitter ? jitter(-1, 2) : 0;
        const jy = useJitter ? jitter(-2, 2) : 0;
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
          // Vector fallback (renders characters like ! ; ' & % that are not in myfont)
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
      // Vector Google Handwriting Font with micro-jitter & rotation
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

        const jx = useJitter ? jitter(-1, 2) : 0;
        const jy = useJitter ? jitter(-2, 2) : 0;
        const rot = useJitter ? (jitter(-15, 15) * Math.PI) / 1800 : 0; // micro-rotation
        const drift = getBaselineOffset(curX);
        const textY = ruleBaselineY - 10 + drift + jy;

        ctx.translate(curX + jx, textY);
        if (rot !== 0) ctx.rotate(rot);
        ctx.fillText(ch, 0, 0);

        // Underline bold simulation for specific pen styles
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
  }

  // Iterate paragraphs
  for (let pi = 0; pi < docModel.length; pi++) {
    const para = docModel[pi];
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

    // List bullet / index
    if (para.listType === 'unordered') {
      await renderWord('•', { bold: true, italic: false, underline: false }, fontPx, scale, false);
      curX += 16;
    } else if (para.listType === 'ordered') {
      await renderWord(`${para.listItemIndex || 1}.`, { bold: true, italic: false, underline: false }, fontPx, scale, false);
      curX += 16;
    }

    // Split runs into word tokens
    const tokens = [];
    for (const run of para.runs) {
      const parts = run.text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        tokens.push({ text: p, run, isSpace: /^\s+$/.test(p) });
      }
    }

    // Line wrapping & rendering
    let tokenIdx = 0;
    while (tokenIdx < tokens.length) {
      const tok = tokens[tokenIdx];

      if (tok.isSpace) {
        curX += (useJitter ? jitter(14, 22) : 18) * tok.text.length;
        tokenIdx++;
        continue;
      }

      const wordW = await measureWordWidth(tok.text, tok.run, fontPx, scale);

      // Line overflow
      if (curX + wordW > d.textEndX) {
        if (tok.text.length > 12 && wordW > d.contentW * 0.5) {
          // Break very long strings cleanly
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

function doUpdateLivePreview(docModel) {
  const container = document.getElementById('preview-page');
  const indicator = document.getElementById('page-indicator');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const viewport = document.getElementById('preview-viewport');
  if (!container || !viewport) return;

  const lo = deriveLayout(activeLayout);
  const bgCanvas = createBackground(activeLayout);
  const bgUrl = bgCanvas.toDataURL();
  const fontChoice = activeAppearance.fontFamily === 'custom-png' ? 'Caveat' : activeAppearance.fontFamily;
  const baseFontSize = Math.round((activeAppearance.fontSize || 16) * 1.6);

  // Divide document into estimated pages
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
  const scale = 0.28; // Responsive scale for preview

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

// ─── 10. UI Wiring & Customization Panel ─────────────────────────────────────
const $ = id => document.getElementById(id);

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

// ── Preview Navigation ──
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

  saveSettingsToStorage();
  onEditorInput();
});

// ── Initial Boot ──
(function init() {
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
  }

  setTimeout(onEditorInput, 80);
})();
