# ✍️ InkForge Studio — Text to Realistic Handwriting

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Backend](https://img.shields.io/badge/Stack-Vanilla%20HTML%2FCSS%2FJS-orange.svg)](#tech-stack)
[![Canvas API](https://img.shields.io/badge/Engine-HTML5%20Canvas%20300%20DPI-green.svg)](#features)
[![Export](https://img.shields.io/badge/Export-PNG%20%7C%20Multi--page%20PDF-purple.svg)](#export)

**InkForge Studio** is a high-performance, client-side web application that synthesizes typed text, documents, and notes into authentic, human-like handwritten pages. It simulates realistic pen physics, paper textures, baseline undulations, and natural character jitter — ready for instant high-resolution PNG or multi-page PDF export.

Zero installation, zero server dependencies — runs completely in the browser.

---

## ✨ Features

- 🖋️ **Dual Handwriting Synthesis Engines**:
  - **Curated Vector Handwriting Styles**: *Caveat* (Natural Cursive), *Kalam* (Neat Ballpoint), *Indie Flower* (Casual Notebook), *Shadows Into Light* (Organic Script), *Homemade Apple* (Authentic Flow), and *Patrick Hand* (Clean Student Print).
  - **Custom Glyph Mode**: Use your own scanned handwriting glyphs (`myfont/` transparent PNGs) with GPU-accelerated `source-in` compositing and automatic vector fallbacks for missing symbols.
- ✒️ **Multi-Pen Physics Simulation**:
  - **Gel Pen**: Deep, smooth, saturated ink.
  - **Ballpoint Pen**: Realistic stroke opacity variance and micro-texture.
  - **Fountain Pen**: Variable ink shading and stroke pooling.
  - **Pencil**: Graphite matte translucency.
- 📜 **Authentic Paper Textures**:
  - **Ruled Notebook**: Classic margin line with blue horizontal rulings.
  - **Grid / Math Paper**: Engineering square grids for math and technical notes.
  - **Vintage Parchment**: Warm sepia tones and organic vignetting.
  - **Blank (White & Cream)**: Clean stationery.
  - **Chalkboard / Dark**: Inverted dark mode paper.
- 🖌️ **Interactive Glyph Studio**:
  - Draw custom handwriting glyphs directly in your browser using mouse or stylus.
  - Typography reference guidelines (ascender, midline, baseline, and descender).
  - Smooth pressure-sensitive strokes, eraser tool, undo history, and canvas clearing.
  - Automatic LocalStorage persistence and one-click JSON glyph pack export/import.
- 📐 **LaTeX Mathematical Formula Synthesizer**:
  - Insert complex calculus, linear algebra, Greek symbols, and equations via integrated KaTeX.
  - Quick-insert syntax buttons for common academic and mathematical structures.
  - Dynamic ink-color synchronization matching the active notebook pen.
- 🖼️ **Sketches & Embedded Diagrams**:
  - Embed lab diagrams, circuit drawings, and figures directly between notebook lines.
  - Automatic vertical space calculation, line snapping, and editable handwritten figure captions.
- 📑 **Multi-Page Visual Thumbnail Navigator**:
  - Live mini-canvas previews of all pages in the document.
  - Instant click-to-scroll navigation and active page indicators.
- 🌊 **Organic Human Imperfections**:
  - **Baseline Drift**: Subtle, smooth wavy baseline undulation across lines.
  - **Micro-Jitter**: Natural positional and angular micro-rotations per character.
  - **Margin Creep**: Simulates natural hand and arm fatigue wandering down the page.
  - **Scratch-Out Scribbles**: Realistic multi-pass pen scribbles for strikethrough (`<s>`) text.
  - **Wavy Underlines**: Hand-drawn wavy strokes beneath underlined words.
- ⚡ **Optimized Performance (300 DPI Print Standard)**:
  - Generates crisp `2480 x 3508 px` (A4 standard at 300 DPI) using 80% less memory than legacy implementations.
  - Cached paper backgrounds and debounced live preview eliminate keystroke lag.
  - Zero-CORS offline execution with pre-bundled Base64 glyph data.
- 📄 **Document Import & Export**:
  - Import raw text directly from PDF documents via `PDF.js`.
  - Download individual pages as PNGs or export all pages as a bundled multi-page PDF via `jsPDF`.

---

## 🚀 Quick Start

### 1. Run Locally

Serve with any local static HTTP server:

```bash
cd textToHandwritten-main

# Using Python 3:
python -m http.server 8000

# Or using Node.js:
npx serve .
```

Open `http://localhost:8000` in your web browser.

### 2. Deploy to GitHub Pages

Because **InkForge** is 100% static client-side code:
1. Push this repository to GitHub.
2. In your repository, go to **Settings > Pages**.
3. Under **Build and deployment**, select **Source: Deploy from a branch** (`main` / root).
4. Your handwritten studio is live on `https://<username>.github.io/<repo-name>/`!

---

## 🎨 Adding Your Custom Handwriting Font

You can digitize your own personal handwriting using the `myfont/` directory or the built-in **Glyph Studio**:

1. **Option A (Glyph Studio - Easiest)**: Open **🖌️ Glyph Studio** in the control panel and draw characters directly on the guideline canvas using your stylus or mouse. They are saved automatically to your browser's LocalStorage!
2. **Option B (Scan & Crop)**:
   - Write every character on white paper using a dark pen.
   - Photograph and crop tightly around each character.
   - Remove the background so each image is a transparent PNG.
   - Scale images so the height is **160px** (maintaining aspect ratio).
   - Name the images according to the convention below and place them into `myfont/`:

| Character | Filename |
|---|---|
| Lowercase `a`–`z` | `a.png` – `z.png` |
| Uppercase `A`–`Z` | `ca.png` – `cz.png` |
| Digits `0`–`9` | `0.png` – `9.png` |
| Punctuation & Symbols | `coma.png` (,), `fs.png` (.), `que.png` (?), `equal.png` (=), etc. |

*Use the built-in **🔍 Coverage** panel in the toolbar to check which glyphs are available in your directory.*

---

## 🛠️ Tech Stack

- **Vanilla HTML5, CSS3, & Modern JavaScript (ES6+)** — zero heavy frameworks, ultra-fast load times.
- **HTML5 Canvas API** — client-side GPU compositing, transform matrices, and procedural paper styling.
- **KaTeX** (CDN) — fast math rendering directly on the canvas.
- **PDF.js** (CDN) — client-side PDF text extraction.
- **jsPDF** (CDN) — client-side multi-page PDF document generation.

---

## 🗺️ Project Roadmap & Milestones

- [x] **Milestone 1: Core Engine Overhaul**
  - Fix broken canvas download handler and tab memory blowouts.
  - Implement GPU-accelerated `source-in` glyph tinting.
  - Introduce print-standard 300 DPI resolution (`2480 x 3508 px`).
  - Eliminate typing lag with cached background renders and debounced live preview.
- [x] **Milestone 2: Realism & Multi-Style Simulation**
  - Integrate curated handwriting web fonts (Caveat, Kalam, Indie Flower, etc.).
  - Add Pen Styles (Gel, Ballpoint, Fountain, Pencil).
  - Add Paper Textures (Ruled Notebook, Math Grid, Vintage Parchment, Blackboard).
  - Implement natural Baseline Drift and rotational micro-jitter.
- [x] **Milestone 3: Advanced Academic Studio & Features**
  - Mathematical formula rendering (LaTeX/KaTeX embedded directly on ruled lines).
  - Diagram, sketch, and figure embedding with handwritten captions.
  - Multi-page thumbnail visual navigator with smooth scroll and active page jump.
  - Organic handwriting flaws (natural margin creep and multi-pass pen scratch-outs).
  - Interactive Glyph Studio with stylus drawing, guideline box, LocalStorage sync, and JSON pack export.
- [ ] **Milestone 4: Automated Glyph Extractor**
  - Built-in photo scanner: upload a single sheet containing a character grid to auto-slice and generate custom PNG fonts automatically.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

