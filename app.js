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
const FONT_LIBRARY_STORAGE_KEY = 'inkforge-custom-font-library-v1';

let customFontLibrary = {
  activeFontId: 'default',
  fonts: {
    'default': {
      id: 'default',
      name: 'Default Scanned (myfont/)',
      glyphs: {}
    }
  }
};

let myFontDirectoryHandle = null;

function isCustomFont(fontFamily) {
  return fontFamily === 'custom-png' || (typeof fontFamily === 'string' && (fontFamily.startsWith('custom:') || fontFamily === 'custom'));
}

function getActiveCustomFontId() {
  if (activeAppearance.fontFamily && typeof activeAppearance.fontFamily === 'string' && activeAppearance.fontFamily.startsWith('custom:')) {
    return activeAppearance.fontFamily.replace('custom:', '');
  }
  return customFontLibrary.activeFontId || 'default';
}

function getActiveCustomFont() {
  const fontId = getActiveCustomFontId();
  if (!customFontLibrary.fonts[fontId]) {
    customFontLibrary.fonts[fontId] = { id: fontId, name: 'Custom Font', glyphs: {} };
  }
  return customFontLibrary.fonts[fontId];
}

function saveFontLibrary() {
  try {
    localStorage.setItem(FONT_LIBRARY_STORAGE_KEY, JSON.stringify(customFontLibrary));
  } catch (err) {
    console.warn('Failed to save font library to localStorage:', err);
  }
}

function updateCustomFontsDropdown() {
  const optgroup = $('custom-fonts-optgroup');
  if (!optgroup) return;

  optgroup.innerHTML = '';

  // Default font
  const defaultOpt = document.createElement('option');
  defaultOpt.value = 'custom-png';
  const defGlyphs = Object.keys(customFontLibrary.fonts['default']?.glyphs || {}).length;
  defaultOpt.textContent = `Default Scanned (myfont/)${defGlyphs > 0 ? ` [${defGlyphs} glyphs]` : ''}`;
  optgroup.appendChild(defaultOpt);

  // Other fonts
  Object.values(customFontLibrary.fonts).forEach(f => {
    if (f.id === 'default') return;
    const opt = document.createElement('option');
    opt.value = `custom:${f.id}`;
    const count = Object.keys(f.glyphs || {}).length;
    opt.textContent = `${f.name} (${count} glyphs)`;
    optgroup.appendChild(opt);
  });

  // Create new option
  const newOpt = document.createElement('option');
  newOpt.value = '__new_custom_font__';
  newOpt.textContent = '➕ Create New Custom Font...';
  optgroup.appendChild(newOpt);

  if (isCustomFont(activeAppearance.fontFamily)) {
    fontSelect.value = activeAppearance.fontFamily;
  }
}

function switchActiveCustomFont(fontId) {
  if (!customFontLibrary.fonts[fontId]) {
    fontId = 'default';
  }
  customFontLibrary.activeFontId = fontId;
  const font = customFontLibrary.fonts[fontId];

  // Clear and reload customGlyphMap
  customGlyphMap = {};
  if (font && font.glyphs) {
    Object.entries(font.glyphs).forEach(([name, dataUrl]) => {
      const img = new Image();
      img.onload = () => { customGlyphMap[name] = img; };
      img.src = dataUrl;
    });
  }

  activeAppearance.fontFamily = fontId === 'default' ? 'custom-png' : `custom:${fontId}`;
  if (fontSelect) fontSelect.value = activeAppearance.fontFamily;
  const glyphArea = $('custom-glyph-area');
  if (glyphArea) glyphArea.style.display = 'inline-flex';
  updateCustomFontsDropdown();
  saveFontLibrary();
  saveSettingsToStorage();
  onEditorInput();
}

function createNewCustomFont(name) {
  const newId = 'font_' + Date.now();
  customFontLibrary.fonts[newId] = {
    id: newId,
    name: name,
    glyphs: {}
  };
  switchActiveCustomFont(newId);
  return newId;
}

function loadFontLibrary() {
  try {
    const raw = localStorage.getItem(FONT_LIBRARY_STORAGE_KEY);
    if (raw) {
      customFontLibrary = JSON.parse(raw);
    }
  } catch {}

  if (!customFontLibrary.fonts || typeof customFontLibrary.fonts !== 'object') {
    customFontLibrary.fonts = {};
  }
  if (!customFontLibrary.fonts['default']) {
    customFontLibrary.fonts['default'] = {
      id: 'default',
      name: 'Default Scanned (myfont/)',
      glyphs: {}
    };
  }

  // Migrate legacy USER_GLYPHS_STORAGE_KEY into default if present
  try {
    const legacy = localStorage.getItem(USER_GLYPHS_STORAGE_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      Object.assign(customFontLibrary.fonts['default'].glyphs, parsedLegacy);
    }
  } catch {}

  const activeId = getActiveCustomFontId();
  if (customFontLibrary.fonts[activeId]) {
    customFontLibrary.activeFontId = activeId;
    const font = customFontLibrary.fonts[activeId];
    Object.entries(font.glyphs || {}).forEach(([name, dataUrl]) => {
      const img = new Image();
      img.onload = () => { customGlyphMap[name] = img; };
      img.src = dataUrl;
    });
  }

  updateCustomFontsDropdown();
}

async function linkMyFontFolder() {
  if (!('showDirectoryPicker' in window)) {
    alert('The File System Access API is supported in modern desktop browsers (Chrome, Edge, Opera, Brave). In unsupported browsers, use Download .PNG or Export Font Pack.');
    return;
  }
  try {
    myFontDirectoryHandle = await window.showDirectoryPicker({
      id: 'inkforge-myfont-dir',
      mode: 'readwrite',
      startIn: 'documents'
    });
    const badge = $('linked-folder-status');
    if (badge) {
      badge.textContent = `✓ Linked: ${myFontDirectoryHandle.name}/`;
      badge.style.display = 'inline-flex';
    }
    const linkBtn = $('link-myfont-folder-btn');
    if (linkBtn) {
      linkBtn.textContent = `📁 Linked: '${myFontDirectoryHandle.name}/'`;
      linkBtn.style.borderColor = '#22c55e';
      linkBtn.style.color = '#4ade80';
    }
    setStatus('done', `📁 Linked to "${myFontDirectoryHandle.name}" folder! Saved glyphs will write directly to disk.`);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Directory picker error:', err);
    }
  }
}

async function writeGlyphToLinkedFolder(fileName, dataUrl) {
  if (!myFontDirectoryHandle) return false;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const fileHandle = await myFontDirectoryHandle.getFileHandle(`${fileName}.png`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (err) {
    console.warn('Direct file write failed:', err);
    return false;
  }
}

function handleFontPackFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      let glyphs = {};
      let fontName = file.name.replace(/\.[^/.]+$/, "");

      if (data && typeof data === 'object') {
        if (data.format === 'inkforge-font-pack' && data.glyphs) {
          glyphs = data.glyphs;
          if (data.fontName) fontName = data.fontName;
        } else if (data.glyphs) {
          glyphs = data.glyphs;
          if (data.fontName) fontName = data.fontName;
        } else {
          // Flat map of { filename: dataUrl }
          glyphs = data;
        }
      }

      const glyphCount = Object.keys(glyphs).length;
      if (glyphCount === 0) {
        alert('No glyphs found in the imported file.');
        return;
      }

      const newId = 'font_' + Date.now();
      customFontLibrary.fonts[newId] = {
        id: newId,
        name: fontName,
        glyphs: glyphs
      };
      saveFontLibrary();
      switchActiveCustomFont(newId);
      setStatus('done', `🎉 Successfully imported "${fontName}" (${glyphCount} characters)!`);
    } catch (err) {
      alert('Failed to parse font pack JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function openNewFontModal() {
  const modal = $('new-font-modal');
  const input = $('new-font-name-input');
  if (!modal) return;
  modal.style.display = 'flex';
  if (input) {
    input.value = `Custom Style ${Object.keys(customFontLibrary.fonts).length + 1}`;
    input.focus();
    input.select();
  }
}

function closeNewFontModal() {
  const modal = $('new-font-modal');
  if (modal) modal.style.display = 'none';
}

function initNewFontModal() {
  const closeBtn = $('close-new-font-modal-btn');
  const cancelBtn = $('cancel-new-font-btn');
  const confirmBtn = $('confirm-new-font-btn');
  const input = $('new-font-name-input');

  [closeBtn, cancelBtn].forEach(btn => {
    if (btn) btn.addEventListener('click', closeNewFontModal);
  });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const name = (input ? input.value.trim() : '') || `Custom Style ${Object.keys(customFontLibrary.fonts).length + 1}`;
      createNewCustomFont(name);
      closeNewFontModal();
      glyphStudioModal.style.display = 'flex';
      onSelectedCharChange();
      setStatus('done', `✨ Created font profile "${name}"! Draw your characters below.`);
    });
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (confirmBtn) confirmBtn.click();
      } else if (e.key === 'Escape') {
        closeNewFontModal();
      }
    });
  }
}

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
  if (!isCustomFont(activeAppearance.fontFamily)) return;
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
    let compAlign = '';
    try { compAlign = window.getComputedStyle ? window.getComputedStyle(node).textAlign : ''; } catch {}
    const alignStyle = node.style.textAlign || node.getAttribute('align') || compAlign;
    if (alignStyle === 'center' || alignStyle === 'right') alignment = alignStyle;

    const runs = [];
    parseInlineNodes(node, runs, false, false, false, false, 0);

    if (runs.length === 0) {
      runs.push({ text: '', bold: false, italic: false, underline: false, strike: false, headingLevel: 0 });
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

  function parseInlineNodes(element, runs, isBold, isItalic, isUnderline, isStrike, headingLevel = 0) {
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        if (text) {
          runs.push({
            text,
            bold: isBold,
            italic: isItalic,
            underline: isUnderline,
            strike: isStrike,
            headingLevel: headingLevel
          });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        const b = isBold || tag === 'b' || tag === 'strong' || child.style.fontWeight === 'bold' || parseInt(child.style.fontWeight) >= 600;
        const i = isItalic || tag === 'i' || tag === 'em' || child.style.fontStyle === 'italic';
        const u = isUnderline || tag === 'u' || (child.style.textDecoration && child.style.textDecoration.includes('underline'));
        const s = isStrike || tag === 's' || tag === 'strike' || tag === 'del' || (child.style.textDecoration && child.style.textDecoration.includes('line-through'));

        let h = headingLevel;
        if (tag === 'h1' || child.classList?.contains('ink-h1') || child.dataset?.level === '1') h = 1;
        else if (tag === 'h2' || child.classList?.contains('ink-h2') || child.dataset?.level === '2') h = 2;
        else if (tag === 'h3' || child.classList?.contains('ink-h3') || child.dataset?.level === '3') h = 3;

        if (tag === 'br') {
          runs.push({ text: '\n', bold: b, italic: i, underline: u, strike: s, headingLevel: h });
        } else {
          parseInlineNodes(child, runs, b, i, u, s, h);
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
    ctx.transform(1, 0, -0.15, 1, x + 0.15 * h, y);
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
  const isCustomPng = isCustomFont(activeAppearance.fontFamily);

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

  async function measureWordWidth(word, runFormat, baseFontPx, baseScale) {
    const runH = runFormat.headingLevel || 0;
    const hMult = runH === 1 ? 1.45 : runH === 2 ? 1.25 : runH === 3 ? 1.15 : 1.0;
    const fontPx = Math.round(baseFontPx * hMult);
    const scale = baseScale * hMult;

    if (isCustomPng) {
      let w = 0;
      for (let ci = 0; ci < word.length; ci++) {
        const ch = word[ci];
        const name = getCharFilename(ch, ci);
        const img = await loadImg(name);
        if (img) {
          w += Math.round(img.width * scale) + (runFormat.italic ? 4 : (useJitter ? 3 : 2));
        } else {
          ctx.save();
          ctx.font = `${runFormat.bold ? 'bold ' : ''}${runFormat.italic ? 'italic ' : ''}${fontPx}px "Caveat", cursive`;
          w += ctx.measureText(ch).width + (runFormat.italic ? 3 : (useJitter ? 3 : 2));
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

  async function renderWord(word, runFormat, baseFontPx, baseScale, wrapMidWord) {
    const runH = runFormat.headingLevel || 0;
    const hMult = runH === 1 ? 1.45 : runH === 2 ? 1.25 : runH === 3 ? 1.15 : 1.0;
    const fontPx = Math.round(baseFontPx * hMult);
    const scale = baseScale * hMult;

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

    const tokens = [];
    for (const run of para.runs) {
      const parts = run.text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        tokens.push({ text: p, run, isSpace: /^\s+$/.test(p) });
      }
    }

    if (!tokens.length && !para.listType) continue;

    // Pre-measure all tokens
    const measuredTokens = [];
    for (let ti = 0; ti < tokens.length; ti++) {
      const tok = tokens[ti];
      const w = tok.isSpace ? (useJitter ? 18 : 16) * tok.text.length : await measureWordWidth(tok.text, tok.run, fontPx, scale);
      measuredTokens.push({ ...tok, width: w });
    }

    const listPrefixW = para.listType === 'unordered' ? 42 : para.listType === 'ordered' ? 52 : 0;
    const lines = [];
    let curLine = [];
    let curLineW = 0;
    const maxLineW = d.contentW - 10;

    for (let ti = 0; ti < measuredTokens.length; ti++) {
      const tok = measuredTokens[ti];
      const availW = maxLineW - (lines.length === 0 ? listPrefixW : 0);

      if (curLineW + tok.width > availW && curLine.length > 0 && !tok.isSpace) {
        lines.push({ tokens: curLine, width: curLineW });
        curLine = [tok];
        curLineW = tok.width;
      } else {
        curLine.push(tok);
        curLineW += tok.width;
      }
    }
    if (curLine.length > 0 || (para.listType && lines.length === 0)) {
      lines.push({ tokens: curLine, width: curLineW });
    }

    // Render lines with exact alignment
    for (let li = 0; li < lines.length; li++) {
      if (li > 0) {
        if (!advanceLine()) await savePage();
      }

      const lineObj = lines[li];
      const totalW = lineObj.width + (li === 0 ? listPrefixW : 0);
      const freeSpace = d.contentW - totalW;

      if (para.alignment === 'center') {
        curX = d.textStartX + Math.max(0, Math.round(freeSpace / 2));
      } else if (para.alignment === 'right') {
        curX = d.textStartX + Math.max(0, Math.round(freeSpace));
      } else {
        curX = d.textStartX + (useJitter ? jitter(0, 8) : 0);
      }

      // If first line of a list, draw the list bullet / number
      if (li === 0) {
        if (para.listType === 'unordered') {
          await renderWord('•', { bold: true, italic: false, underline: false, strike: false }, fontPx, scale, false);
          curX += 20;
        } else if (para.listType === 'ordered') {
          await renderWord(`${para.listItemIndex || 1}.`, { bold: true, italic: false, underline: false, strike: false }, fontPx, scale, false);
          curX += 20;
        }
      }

      for (const tok of lineObj.tokens) {
        if (tok.isSpace) {
          curX += tok.width;
        } else {
          await renderWord(tok.text, tok.run, fontPx, scale, false);
        }
      }
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
  const hasCustomOrMedia = isCustomFont(activeAppearance.fontFamily) || docModel.some(p => p.type === 'diagram' || p.type === 'math');

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
      if (run.italic) styles += 'font-style:italic;';
      if (run.bold) styles += 'font-weight:700; text-shadow: 1px 0px 0px currentColor;';
      if (run.underline) styles += 'text-decoration:underline;';
      if (run.strike) styles += 'text-decoration:line-through; color:rgba(239,68,68,0.85);';

      const runH = run.headingLevel || 0;
      if (runH > 0) {
        const mults = { 1: 1.45, 2: 1.25, 3: 1.15 };
        styles += `font-size:${Math.round(scaledFontSize * (mults[runH] || 1.0))}px; font-weight:700;`;
      }

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

  const toggleGhostBtn = $('toggle-ghost-btn');
  if (toggleGhostBtn) {
    toggleGhostBtn.addEventListener('click', () => {
      ghostGuideEnabled = !ghostGuideEnabled;
      toggleGhostBtn.classList.toggle('active', ghostGuideEnabled);
      const selectedOpt = glyphCharPicker.options[glyphCharPicker.selectedIndex];
      const targetChar = selectedOpt ? selectedOpt.dataset.char : 'a';
      renderGhostGuide(targetChar);
    });
  }

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

  const dlSinglePngBtn = $('download-drawn-png-btn');
  if (dlSinglePngBtn) {
    dlSinglePngBtn.addEventListener('click', () => {
      const fileName = glyphCharPicker.value;
      saveDrawnCharacter();
      const existing = customGlyphMap[fileName] || (window.DEFAULT_MYFONT_GLYPHS && window.DEFAULT_MYFONT_GLYPHS[fileName]);
      if (existing) {
        const src = existing.src || existing;
        const a = document.createElement('a');
        a.href = src;
        a.download = `${fileName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setStatus('done', `⬇ Downloaded "${fileName}.png" into your downloads!`);
      }
    });
  }

  const linkMyFontBtn = $('link-myfont-folder-btn');
  if (linkMyFontBtn) {
    linkMyFontBtn.addEventListener('click', linkMyFontFolder);
  }
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

let ghostGuideEnabled = true;

function renderGhostGuide(char) {
  const ghostCanvas = $('glyph-ghost-canvas');
  if (!ghostCanvas) return;
  const gctx = ghostCanvas.getContext('2d');
  gctx.clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
  if (!ghostGuideEnabled || !char) return;

  gctx.save();
  gctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  gctx.font = '200px "Patrick Hand", "Caveat", "Outfit", sans-serif';
  gctx.textAlign = 'center';
  gctx.textBaseline = 'alphabetic';
  gctx.fillText(char, ghostCanvas.width / 2, 220);
  gctx.restore();
}

async function onSelectedCharChange() {
  const selectedFile = glyphCharPicker.value;
  currentCharFilename.textContent = `${selectedFile}.png`;

  const selectedOpt = glyphCharPicker.options[glyphCharPicker.selectedIndex];
  const targetChar = selectedOpt ? selectedOpt.dataset.char : 'a';
  renderGhostGuide(targetChar);

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
  img.onload = async () => {
    customGlyphMap[fileName] = img;
    currentCharStatus.textContent = 'Saved (Custom)';
    currentCharStatus.className = 'glyph-badge badge-present';
    glyphCurrentPreview.innerHTML = `<img src="${dataUrl}" />`;

    // Persist into active custom font profile
    const activeFont = getActiveCustomFont();
    if (!activeFont.glyphs) activeFont.glyphs = {};
    activeFont.glyphs[fileName] = dataUrl;
    saveFontLibrary();

    // Persist to legacy LocalStorage key as well
    try {
      const saved = JSON.parse(localStorage.getItem(USER_GLYPHS_STORAGE_KEY) || '{}');
      saved[fileName] = dataUrl;
      localStorage.setItem(USER_GLYPHS_STORAGE_KEY, JSON.stringify(saved));
    } catch {}

    // Direct write to disk if user linked their 'myfont/' directory
    let savedToDisk = false;
    if (myFontDirectoryHandle) {
      savedToDisk = await writeGlyphToLinkedFolder(fileName, dataUrl);
    }

    // Switch to custom font mode if not already
    const activeFontId = getActiveCustomFontId();
    activeAppearance.fontFamily = activeFontId === 'default' ? 'custom-png' : `custom:${activeFontId}`;
    if (fontSelect) fontSelect.value = activeAppearance.fontFamily;
    if ($('custom-glyph-area')) $('custom-glyph-area').style.display = 'inline-flex';
    updateCustomFontsDropdown();
    saveSettingsToStorage();
    onEditorInput();

    if (savedToDisk) {
      setStatus('done', `💾 Saved "${fileName}.png" directly to hard drive ('${myFontDirectoryHandle.name}/') & profile "${activeFont.name}"!`);
    } else {
      setStatus('done', `✅ Saved glyph "${fileName}.png" into profile "${activeFont.name}"!`);
    }
  };
  img.src = dataUrl;
}

function exportGlyphPack() {
  const activeFont = getActiveCustomFont();
  const pack = {
    format: 'inkforge-font-pack',
    version: '1.4.0',
    fontId: activeFont.id,
    fontName: activeFont.name,
    exportedAt: new Date().toISOString(),
    glyphs: {}
  };

  GLYPH_MANIFEST.forEach(g => {
    if (customGlyphMap[g.file]) {
      pack.glyphs[g.file] = customGlyphMap[g.file].src;
    } else if (activeFont.glyphs && activeFont.glyphs[g.file]) {
      pack.glyphs[g.file] = activeFont.glyphs[g.file];
    } else if (window.DEFAULT_MYFONT_GLYPHS && window.DEFAULT_MYFONT_GLYPHS[g.file]) {
      pack.glyphs[g.file] = window.DEFAULT_MYFONT_GLYPHS[g.file];
    }
  });

  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const safeName = (activeFont.name || 'custom-font').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  a.download = `inkforge-${safeName}-glyphs.json`;
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

// ── Helper: Find closest block element inside editor ──
function getClosestBlock(node) {
  if (!node) return null;
  const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'li', 'blockquote', 'section'];
  let cur = node;
  while (cur && cur !== editorSurface) {
    if (cur.nodeType === Node.ELEMENT_NODE && blockTags.includes(cur.tagName.toLowerCase())) {
      return cur;
    }
    cur = cur.parentNode;
  }
  return null;
}

// ── Helper: Expand collapsed selection to surrounding word ──
function expandRangeToWord(range) {
  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  const text = node.textContent;
  let start = range.startOffset;
  let end = range.endOffset;

  while (start > 0 && /\S/.test(text[start - 1])) {
    start--;
  }
  while (end < text.length && /\S/.test(text[end])) {
    end++;
  }
  range.setStart(node, start);
  range.setEnd(node, end);
}

// ── Scoped Heading Formatter (Word/Phrase or Line) ──
function applyHeadingToSelection(level) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  if (range.collapsed) {
    expandRangeToWord(range);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  if (range.collapsed) return;

  let container = range.commonAncestorContainer;
  if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
  const existingHeading = container.closest ? container.closest('.ink-heading, h1, h2, h3') : null;

  if (existingHeading) {
    const currentLvl = parseInt(existingHeading.dataset?.level || (existingHeading.tagName === 'H1' ? 1 : existingHeading.tagName === 'H2' ? 2 : existingHeading.tagName === 'H3' ? 3 : 0));
    if (currentLvl === level) {
      // Toggle off: unwrap heading back to normal text
      if (existingHeading.classList.contains('ink-heading')) {
        const parent = existingHeading.parentNode;
        while (existingHeading.firstChild) {
          parent.insertBefore(existingHeading.firstChild, existingHeading);
        }
        parent.removeChild(existingHeading);
      } else {
        document.execCommand('formatBlock', false, 'p');
      }
      onEditorInput();
      updateToolbarState();
      return;
    }
  }

  const block = getClosestBlock(container);
  const isEntireBlock = block && range.toString().trim() === block.textContent.trim();

  if (isEntireBlock && block !== editorSurface && ['H1','H2','H3','P','DIV'].includes(block.tagName)) {
    document.execCommand('formatBlock', false, `h${level}`);
  } else {
    // Style specifically the selected word or words
    const span = document.createElement('span');
    span.className = `ink-heading ink-h${level}`;
    span.dataset.level = String(level);

    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);
    } catch {
      document.execCommand('formatBlock', false, `h${level}`);
    }
  }

  onEditorInput();
  updateToolbarState();
}

// ── Text Alignment Handler ──
function applyAlignment(align) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  let container = range.commonAncestorContainer;
  if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;

  const block = getClosestBlock(container);
  if (block && block !== editorSurface) {
    block.style.textAlign = align;
  } else {
    document.execCommand(align === 'center' ? 'justifyCenter' : align === 'right' ? 'justifyRight' : 'justifyLeft', false, null);
  }
  onEditorInput();
  updateToolbarState();
}

// ── Central Toolbar State Synchronizer ──
function updateToolbarState() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  const bBtn = $('tb-bold');
  const iBtn = $('tb-italic');
  const uBtn = $('tb-underline');
  const sBtn = $('tb-strike');
  if (bBtn) bBtn.classList.toggle('active', document.queryCommandState('bold'));
  if (iBtn) iBtn.classList.toggle('active', document.queryCommandState('italic'));
  if (uBtn) uBtn.classList.toggle('active', document.queryCommandState('underline'));
  if (sBtn) sBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));

  let container = sel.getRangeAt(0).commonAncestorContainer;
  if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;

  // Headings
  const h1Btn = $('tb-h1');
  const h2Btn = $('tb-h2');
  const h3Btn = $('tb-h3');
  const headingEl = container.closest ? container.closest('.ink-heading, h1, h2, h3') : null;
  let hLevel = 0;
  if (headingEl) {
    hLevel = parseInt(headingEl.dataset?.level || (headingEl.tagName === 'H1' ? 1 : headingEl.tagName === 'H2' ? 2 : headingEl.tagName === 'H3' ? 3 : 0));
  }
  if (h1Btn) h1Btn.classList.toggle('active', hLevel === 1);
  if (h2Btn) h2Btn.classList.toggle('active', hLevel === 2);
  if (h3Btn) h3Btn.classList.toggle('active', hLevel === 3);

  // Lists
  const ulBtn = $('tb-ul');
  const olBtn = $('tb-ol');
  const inUl = !!(container.closest && container.closest('ul'));
  const inOl = !!(container.closest && container.closest('ol'));
  if (ulBtn) ulBtn.classList.toggle('active', inUl);
  if (olBtn) olBtn.classList.toggle('active', inOl);

  // Alignments (mutually exclusive)
  const alBtn = $('tb-align-left');
  const acBtn = $('tb-align-center');
  const arBtn = $('tb-align-right');
  const block = getClosestBlock(container);
  let align = 'left';
  if (block) {
    align = block.style.textAlign || (window.getComputedStyle ? window.getComputedStyle(block).textAlign : 'left');
    if (!align || align === 'start') align = 'left';
  }
  if (alBtn) alBtn.classList.toggle('active', align === 'left');
  if (acBtn) acBtn.classList.toggle('active', align === 'center');
  if (arBtn) arBtn.classList.toggle('active', align === 'right' || align === 'end');
}

// ── Toolbar Actions ──
document.querySelectorAll('.tb-btn[data-cmd]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const cmd = btn.dataset.cmd;

    if (cmd === 'h1') applyHeadingToSelection(1);
    else if (cmd === 'h2') applyHeadingToSelection(2);
    else if (cmd === 'h3') applyHeadingToSelection(3);
    else if (cmd === 'justifyLeft') applyAlignment('left');
    else if (cmd === 'justifyCenter') applyAlignment('center');
    else if (cmd === 'justifyRight') applyAlignment('right');
    else {
      document.execCommand(cmd, false, null);
      onEditorInput();
      updateToolbarState();
    }
  });
});

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (sel && sel.anchorNode && editorSurface && editorSurface.contains(sel.anchorNode)) {
    updateToolbarState();
  }
});

editorSurface.addEventListener('keyup', updateToolbarState);
editorSurface.addEventListener('mouseup', updateToolbarState);

editorSurface.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand('insertText', false, '    ');
    onEditorInput();
    return;
  }

  if (e.key === 'Enter') {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      let container = range.startContainer;
      if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
      const li = container.closest ? container.closest('li') : null;
      if (li) {
        // If pressing Enter on empty bullet/number, exit list into normal paragraph
        if (!li.textContent.trim()) {
          e.preventDefault();
          const list = li.closest('ul, ol');
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          if (list) {
            list.parentNode.insertBefore(p, list.nextSibling);
            li.remove();
            if (!list.children.length) list.remove();
          } else {
            li.parentNode.insertBefore(p, li.nextSibling);
            li.remove();
          }
          const newRange = document.createRange();
          newRange.setStart(p, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          onEditorInput();
          updateToolbarState();
          return;
        }
        // Non-empty li: let browser create next <li> and ensure live updates
        setTimeout(() => {
          onEditorInput();
          updateToolbarState();
        }, 0);
      }
    }
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
  const val = fontSelect.value;
  if (val === '__new_custom_font__') {
    openNewFontModal();
    fontSelect.value = isCustomFont(activeAppearance.fontFamily) ? activeAppearance.fontFamily : 'Caveat';
    return;
  }

  if (val === 'custom-png') {
    switchActiveCustomFont('default');
  } else if (val.startsWith('custom:')) {
    const fontId = val.replace('custom:', '');
    switchActiveCustomFont(fontId);
  } else {
    activeAppearance.fontFamily = val;
    glyphUploadArea.style.display = 'none';
    saveSettingsToStorage();
    onEditorInput();
  }
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
  const activeFont = getActiveCustomFont();
  if (!activeFont.glyphs) activeFont.glyphs = {};

  files.forEach(file => {
    const name = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        customGlyphMap[name] = img;
        activeFont.glyphs[name] = evt.target.result;
        loaded++;
        glyphStatus.textContent = `${loaded} glyphs`;
        glyphClearBtn.style.display = 'inline-block';
        if (loaded === files.length) {
          saveFontLibrary();
          const activeFontId = getActiveCustomFontId();
          activeAppearance.fontFamily = activeFontId === 'default' ? 'custom-png' : `custom:${activeFontId}`;
          if (fontSelect) fontSelect.value = activeAppearance.fontFamily;
          updateCustomFontsDropdown();
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
  const activeFont = getActiveCustomFont();
  activeFont.glyphs = {};
  customGlyphMap = {};
  glyphStatus.textContent = '';
  glyphClearBtn.style.display = 'none';
  saveFontLibrary();
  activeAppearance.fontFamily = 'Caveat';
  fontSelect.value = 'Caveat';
  glyphUploadArea.style.display = 'none';
  updateCustomFontsDropdown();
  saveSettingsToStorage();
  onEditorInput();
});

// ── Font Pack Import & Drag-and-Drop ──
const importFontBtn = $('import-font-btn');
const fontPackImportInput = $('font-pack-import-input');
if (importFontBtn && fontPackImportInput) {
  importFontBtn.addEventListener('click', () => fontPackImportInput.click());
  fontPackImportInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleFontPackFile(file);
      fontPackImportInput.value = '';
    }
  });
}

window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    const file = e.dataTransfer.files[0];
    if (file.name.endsWith('.json') || file.name.endsWith('.inkfont')) {
      handleFontPackFile(file);
    }
  }
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
      html += '<table class="chars-table"><thead><tr><th>Char</th><th>File</th><th>Action</th></tr></thead><tbody>';
      missing.forEach(g => {
        const safe = g.char === '<' ? '&lt;' : g.char === '>' ? '&gt;' : g.char === '&' ? '&amp;' : g.char;
        html += `<tr><td class="glyph-char">${safe}</td><td><code>${g.file}.png</code></td><td><button class="draw-missing-glyph-btn" data-file="${g.file}">🖌️ Draw in Studio</button></td></tr>`;
      });
      html += '</tbody></table>';
    } else {
      html += '<p style="color:#4ade80;font-size:0.85rem">🎉 All glyphs present in directory!</p>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.draw-missing-glyph-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const file = btn.dataset.file;
        panel.classList.remove('open');
        glyphStudioModal.style.display = 'flex';
        glyphCharPicker.value = file;
        onSelectedCharChange();
      });
    });
  }
});

// ─── 13. 2-Minute Fast Handwriting Creator Wizard ────────────────────────────
const WIZARD_CATEGORIES = {
  lower: GLYPH_MANIFEST.filter(g => g.char >= 'a' && g.char <= 'z'),
  upper: GLYPH_MANIFEST.filter(g => g.char >= 'A' && g.char <= 'Z'),
  digits: GLYPH_MANIFEST.filter(g => g.char >= '0' && g.char <= '9'),
  symbols: GLYPH_MANIFEST.filter(g => !((g.char >= 'a' && g.char <= 'z') || (g.char >= 'A' && g.char <= 'Z') || (g.char >= '0' && g.char <= '9'))),
};

let currentWizardCat = 'lower';
let currentWizardIndex = 0;
let wizardDrawCtx = null;
let wizardIsDrawing = false;
let wizardUndoStack = [];
let wizardGhostEnabled = true;

function renderWizardGhost() {
  const ghostCanvas = $('wizard-ghost-canvas');
  if (!ghostCanvas) return;
  const gctx = ghostCanvas.getContext('2d');
  gctx.clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
  if (!wizardGhostEnabled) return;

  const list = WIZARD_CATEGORIES[currentWizardCat];
  const item = list[currentWizardIndex];
  if (!item) return;

  gctx.save();
  gctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  gctx.font = '200px "Patrick Hand", "Caveat", "Outfit", sans-serif';
  gctx.textAlign = 'center';
  gctx.textBaseline = 'alphabetic';
  gctx.fillText(item.char, ghostCanvas.width / 2, 220);
  gctx.restore();
}

function populateWizardChips() {
  const container = $('wizard-char-chips');
  if (!container) return;
  container.innerHTML = '';
  const list = WIZARD_CATEGORIES[currentWizardCat];

  list.forEach((item, idx) => {
    const chip = document.createElement('div');
    chip.className = 'wizard-chip';
    if (idx === currentWizardIndex) chip.classList.add('active');
    if (customGlyphMap[item.file] || (window.DEFAULT_MYFONT_GLYPHS && window.DEFAULT_MYFONT_GLYPHS[item.file])) {
      chip.classList.add('done');
    }
    chip.textContent = item.char;
    chip.addEventListener('click', () => {
      currentWizardIndex = idx;
      setupWizardStep();
    });
    container.appendChild(chip);
  });
}

async function setupWizardStep() {
  const list = WIZARD_CATEGORIES[currentWizardCat];
  if (currentWizardIndex < 0) currentWizardIndex = 0;
  if (currentWizardIndex >= list.length) currentWizardIndex = list.length - 1;
  const item = list[currentWizardIndex];
  if (!item) return;

  const targetCharEl = $('wizard-target-char');
  const targetDescEl = $('wizard-target-desc');
  const stepLabelEl = $('wizard-step-label');
  const fillEl = $('wizard-progress-fill');

  if (targetCharEl) targetCharEl.textContent = item.char;
  if (targetDescEl) targetDescEl.textContent = item.desc;
  if (stepLabelEl) stepLabelEl.innerHTML = `Character <b>${currentWizardIndex + 1}</b> of <b>${list.length}</b>: <b>${item.char}</b>`;

  const pct = Math.round(((currentWizardIndex + 1) / list.length) * 100);
  if (fillEl) fillEl.style.width = `${pct}%`;

  const wizardCanvas = $('wizard-draw-canvas');
  if (wizardDrawCtx && wizardCanvas) {
    wizardDrawCtx.clearRect(0, 0, wizardCanvas.width, wizardCanvas.height);
    wizardUndoStack = [];

    const existing = await loadImg(item.file);
    if (existing) {
      const scale = 1.3;
      const dx = (wizardCanvas.width - existing.width * scale) / 2;
      const dy = (wizardCanvas.height - existing.height * scale) / 2;
      wizardDrawCtx.drawImage(existing, dx, dy, existing.width * scale, existing.height * scale);
    }
  }

  renderWizardGhost();
  populateWizardChips();
}

function saveAndAdvanceWizard(dir) {
  const list = WIZARD_CATEGORIES[currentWizardCat];
  const item = list[currentWizardIndex];
  const wizardCanvas = $('wizard-draw-canvas');
  if (!item || !wizardCanvas || !wizardDrawCtx) {
    advanceWizard(dir);
    return;
  }

  const idata = wizardDrawCtx.getImageData(0, 0, wizardCanvas.width, wizardCanvas.height);
  const d = idata.data;
  let minX = wizardCanvas.width, maxX = 0, minY = wizardCanvas.height, maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < wizardCanvas.height; y++) {
    for (let x = 0; x < wizardCanvas.width; x++) {
      if (d[(y * wizardCanvas.width + x) * 4 + 3] > 15) {
        hasPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (hasPixels) {
    const pad = 10;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(wizardCanvas.width, maxX + pad);
    maxY = Math.min(wizardCanvas.height, maxY + pad);

    const cropW = Math.max(10, maxX - minX);
    const cropH = Math.max(10, maxY - minY);
    const targetH = 160;
    const targetW = Math.round((cropW / cropH) * targetH);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = targetW;
    cropCanvas.height = targetH;
    const cctx = cropCanvas.getContext('2d');
    cctx.drawImage(wizardCanvas, minX, minY, cropW, cropH, 0, 0, targetW, targetH);

    const dataUrl = cropCanvas.toDataURL('image/png');
    const img = new Image();
    img.onload = async () => {
      customGlyphMap[item.file] = img;
      const activeFont = getActiveCustomFont();
      if (!activeFont.glyphs) activeFont.glyphs = {};
      activeFont.glyphs[item.file] = dataUrl;
      saveFontLibrary();

      try {
        const saved = JSON.parse(localStorage.getItem(USER_GLYPHS_STORAGE_KEY) || '{}');
        saved[item.file] = dataUrl;
        localStorage.setItem(USER_GLYPHS_STORAGE_KEY, JSON.stringify(saved));
      } catch {}

      if (myFontDirectoryHandle) {
        await writeGlyphToLinkedFolder(item.file, dataUrl);
      }
    };
    img.src = dataUrl;
  }

  advanceWizard(dir);
}

function advanceWizard(dir) {
  const list = WIZARD_CATEGORIES[currentWizardCat];
  currentWizardIndex += dir;
  if (currentWizardIndex >= list.length) {
    if (currentWizardCat === 'lower') {
      currentWizardCat = 'upper';
      currentWizardIndex = 0;
    } else if (currentWizardCat === 'upper') {
      currentWizardCat = 'digits';
      currentWizardIndex = 0;
    } else if (currentWizardCat === 'digits') {
      currentWizardCat = 'symbols';
      currentWizardIndex = 0;
    } else {
      currentWizardIndex = list.length - 1;
    }
    document.querySelectorAll('.wizard-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.cat === currentWizardCat);
    });
  } else if (currentWizardIndex < 0) {
    currentWizardIndex = 0;
  }
  setupWizardStep();
}

function initHandwritingWizard() {
  const wizardModal = $('wizard-modal');
  const openWizardBtn = $('open-wizard-btn');
  const closeWizardBtn = $('close-wizard-btn');
  const wizardCanvas = $('wizard-draw-canvas');
  if (!wizardModal || !wizardCanvas) return;

  wizardDrawCtx = wizardCanvas.getContext('2d', { willReadFrequently: true });
  wizardDrawCtx.lineCap = 'round';
  wizardDrawCtx.lineJoin = 'round';

  if (openWizardBtn) {
    openWizardBtn.addEventListener('click', () => {
      wizardModal.style.display = 'flex';
      setupWizardStep();
    });
  }

  if (closeWizardBtn) {
    closeWizardBtn.addEventListener('click', () => {
      wizardModal.style.display = 'none';
    });
  }

  document.querySelectorAll('.wizard-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.wizard-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentWizardCat = tab.dataset.cat;
      currentWizardIndex = 0;
      setupWizardStep();
    });
  });

  const ghostToggle = $('wizard-ghost-toggle');
  if (ghostToggle) {
    ghostToggle.addEventListener('change', () => {
      wizardGhostEnabled = ghostToggle.checked;
      renderWizardGhost();
    });
  }

  function getCoords(e) {
    const rect = wizardCanvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (cx - rect.left) * (wizardCanvas.width / rect.width),
      y: (cy - rect.top) * (wizardCanvas.height / rect.height)
    };
  }

  wizardCanvas.addEventListener('mousedown', (e) => {
    wizardUndoStack.push(wizardDrawCtx.getImageData(0, 0, wizardCanvas.width, wizardCanvas.height));
    wizardIsDrawing = true;
    const { x, y } = getCoords(e);
    wizardDrawCtx.beginPath();
    wizardDrawCtx.moveTo(x, y);
    wizardDrawCtx.lineWidth = 5;
    wizardDrawCtx.strokeStyle = '#111827';
    wizardDrawCtx.lineTo(x, y);
    wizardDrawCtx.stroke();
  });

  window.addEventListener('mousemove', (e) => {
    if (!wizardIsDrawing) return;
    const { x, y } = getCoords(e);
    wizardDrawCtx.lineTo(x, y);
    wizardDrawCtx.stroke();
  });

  window.addEventListener('mouseup', () => { wizardIsDrawing = false; });

  wizardCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    wizardUndoStack.push(wizardDrawCtx.getImageData(0, 0, wizardCanvas.width, wizardCanvas.height));
    wizardIsDrawing = true;
    const { x, y } = getCoords(e);
    wizardDrawCtx.beginPath();
    wizardDrawCtx.moveTo(x, y);
    wizardDrawCtx.lineWidth = 5;
    wizardDrawCtx.strokeStyle = '#111827';
    wizardDrawCtx.lineTo(x, y);
    wizardDrawCtx.stroke();
  }, { passive: false });

  wizardCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!wizardIsDrawing) return;
    const { x, y } = getCoords(e);
    wizardDrawCtx.lineTo(x, y);
    wizardDrawCtx.stroke();
  }, { passive: false });

  wizardCanvas.addEventListener('touchend', () => { wizardIsDrawing = false; });

  const undoBtn = $('wizard-undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (wizardUndoStack.length > 0) {
        const last = wizardUndoStack.pop();
        wizardDrawCtx.putImageData(last, 0, 0);
      }
    });
  }

  const clearBtn = $('wizard-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      wizardDrawCtx.clearRect(0, 0, wizardCanvas.width, wizardCanvas.height);
      wizardUndoStack = [];
    });
  }

  const nextBtn = $('wizard-next-btn');
  if (nextBtn) nextBtn.addEventListener('click', () => { saveAndAdvanceWizard(1); });

  const prevBtn = $('wizard-prev-btn');
  if (prevBtn) prevBtn.addEventListener('click', () => { saveAndAdvanceWizard(-1); });

  const skipBtn = $('wizard-skip-btn');
  if (skipBtn) skipBtn.addEventListener('click', () => { advanceWizard(1); });

  const finishBtn = $('wizard-finish-btn');
  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      wizardModal.style.display = 'none';
      const activeFontId = getActiveCustomFontId();
      activeAppearance.fontFamily = activeFontId === 'default' ? 'custom-png' : `custom:${activeFontId}`;
      if (fontSelect) fontSelect.value = activeAppearance.fontFamily;
      if ($('custom-glyph-area')) $('custom-glyph-area').style.display = 'inline-flex';
      updateCustomFontsDropdown();
      saveSettingsToStorage();
      onEditorInput();
      setStatus('done', '🎉 Personalized handwriting active! Document rendered.');
    });
  }

  const exportBtn = $('wizard-export-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportGlyphPack);

  window.addEventListener('keydown', (e) => {
    if (wizardModal.style.display !== 'none' && e.key === 'Enter') {
      e.preventDefault();
      saveAndAdvanceWizard(1);
    }
  });
}

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
  loadFontLibrary();
  initGlyphStudio();
  initMathAndDiagrams();
  initHandwritingWizard();
  initNewFontModal();

  const saved = loadSettingsFromStorage();
  if (saved) {
    activeLayout = { ...DEFAULT_LAYOUT, ...(saved.layout || {}) };
    activeAppearance = { ...DEFAULT_APPEARANCE, ...(saved.appearance || {}) };

    if (fontSelect) fontSelect.value = activeAppearance.fontFamily || 'Caveat';
    if (isCustomFont(activeAppearance.fontFamily)) {
      const area = $('custom-glyph-area');
      if (area) area.style.display = 'inline-flex';
    }
    if (penSelect) penSelect.value = activeAppearance.penStyle || 'gel';
    if (paperStyleSelect) paperStyleSelect.value = activeAppearance.paperStyle || 'ruled';
    if (fontSizeInput) fontSizeInput.value = activeAppearance.fontSize || 16;
    if (lineGapInput) lineGapInput.value = activeLayout.lineSpacing || 110;
    if (inkColorInput) inkColorInput.value = activeAppearance.inkColor || '#1a237e';
    if (jitterToggle) jitterToggle.checked = activeAppearance.useJitter !== false;
    if (driftToggle) driftToggle.checked = activeAppearance.useDrift !== false;
    if (creepToggle) creepToggle.checked = activeAppearance.useCreep !== false;
  }

  updateCustomFontsDropdown();
  setTimeout(onEditorInput, 80);
})();
