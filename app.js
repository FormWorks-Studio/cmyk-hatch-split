(function () {
  'use strict';

  const MAX_DIMENSION = 900; // working resolution cap (line generation is expensive x4 channels)
  const CELL_SIZE = 3;       // density/gradient field sampling cell, in source pixels
  const HATCH_STEP = 2;      // px per integration step when tracing a stroke
  const CROSSHATCH_THRESHOLD = 0.6; // darkness (0-1) above which the crosshatch layer kicks in

  const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif'];
  const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

  const CHANNEL_LABELS = { c: 'Cyan', m: 'Magenta', y: 'Yellow', k: 'Key (Black)', combined: 'Combined' };
  const CHANNEL_FILE_NAMES = { c: 'cyan', m: 'magenta', y: 'yellow', k: 'black' };
  const CHANNEL_ORDER = ['c', 'm', 'y', 'k'];
  const CHANNEL_COLORS = { c: [0, 173, 239], m: [236, 0, 140], y: [255, 241, 0], k: [35, 31, 32] };
  // Classic print screen angles, reused here as a per-channel hatch-direction
  // offset so the four plates don't moiré against each other when combined.
  const CHANNEL_ANGLE_OFFSET = { c: 15, m: 75, y: 0, k: 45 };
  // Per-channel seeds for Truchet's tile-flip choice, so the four plates
  // don't all draw an identical tile arrangement.
  const CHANNEL_SEEDS = { c: 11, m: 23, y: 37, k: 53 };

  // ── DOM refs ──────────────────────────────────────────────
  const fileInput = document.getElementById('file-input');
  const chooseBtn = document.getElementById('choose-btn');
  const dropZone = document.getElementById('drop-zone');
  const cropper_wrap = document.getElementById('crop-wrap');
  const cropImage = document.getElementById('crop-image');
  const confirmCropBtn = document.getElementById('confirm-crop-btn');
  const cancelCropBtn = document.getElementById('cancel-crop-btn');
  const originalWrap = document.getElementById('original-wrap');
  const originalCanvas = document.getElementById('original-canvas');
  const channelsSection = document.getElementById('channels');
  const status = document.getElementById('status');

  const modeButtons = document.querySelectorAll('.mode-btn[data-mode]');
  const singleControls = document.getElementById('single-controls');
  const hatchControls = document.getElementById('hatch-controls');
  const microprintControls = document.getElementById('microprint-controls');
  const flowDirectionControls = document.getElementById('flow-direction-controls');
  const lineSharedControls = document.getElementById('line-shared-controls');
  const weightCtrl = document.getElementById('weight-ctrl');

  const densitySlider = document.getElementById('density-slider');
  const densityVal = document.getElementById('density-val');
  const hatchDensitySlider = document.getElementById('hatch-density-slider');
  const hatchDensityVal = document.getElementById('hatch-density-val');

  const microprintTextInput = document.getElementById('microprint-text');
  const microprintDensitySlider = document.getElementById('microprint-density-slider');
  const microprintDensityVal = document.getElementById('microprint-density-val');
  const microprintLengthSlider = document.getElementById('microprint-length-slider');
  const microprintLengthVal = document.getElementById('microprint-length-val');
  const charSizeSlider = document.getElementById('char-size-slider');
  const charSizeVal = document.getElementById('char-size-val');
  const charSpacingSlider = document.getElementById('char-spacing-slider');
  const charSpacingVal = document.getElementById('char-spacing-val');

  const dirFixedBtn = document.getElementById('dir-fixed-btn');
  const dirParallelLinesBtn = document.getElementById('dir-parallel-lines-btn');
  const dirOrganicBtn = document.getElementById('dir-organic-btn');
  const dirParallelBtn = document.getElementById('dir-parallel-btn');
  const directionAngleCtrl = document.getElementById('direction-angle-ctrl');
  const parallelRigidityCtrl = document.getElementById('parallel-rigidity-ctrl');
  const flowRigidityCtrl = document.getElementById('flow-rigidity-ctrl');

  const directionSlider = document.getElementById('direction-slider');
  const directionVal = document.getElementById('direction-val');
  const parallelRigiditySlider = document.getElementById('parallel-rigidity-slider');
  const parallelRigidityVal = document.getElementById('parallel-rigidity-val');
  const flowRigiditySlider = document.getElementById('flow-rigidity-slider');
  const flowRigidityVal = document.getElementById('flow-rigidity-val');
  const strokeLenSlider = document.getElementById('stroke-len-slider');
  const strokeLenVal = document.getElementById('stroke-len-val');
  const lengthRandSlider = document.getElementById('length-rand-slider');
  const lengthRandVal = document.getElementById('length-rand-val');

  // ── Hatch Pattern (Straight/Cross-Grid/Contour/Stipple/Zigzag/Truchet) ──
  const patternButtons = document.querySelectorAll('.mode-btn[data-pattern]');
  const hatchCommonControls = document.getElementById('hatch-common-controls');
  const crossgridControls = document.getElementById('crossgrid-controls');
  const contourControls = document.getElementById('contour-controls');
  const stippleControls = document.getElementById('stipple-controls');
  const zigzagControls = document.getElementById('zigzag-controls');
  const truchetControls = document.getElementById('truchet-controls');

  const crossAngleSlider = document.getElementById('cross-angle-slider');
  const crossAngleVal = document.getElementById('cross-angle-val');
  const contourLevelsSlider = document.getElementById('contour-levels-slider');
  const contourLevelsVal = document.getElementById('contour-levels-val');
  const stippleDensitySlider = document.getElementById('stipple-density-slider');
  const stippleDensityVal = document.getElementById('stipple-density-val');
  const dotSizeSlider = document.getElementById('dot-size-slider');
  const dotSizeVal = document.getElementById('dot-size-val');
  const relaxationSlider = document.getElementById('relaxation-slider');
  const relaxationVal = document.getElementById('relaxation-val');
  const zigzagAmpSlider = document.getElementById('zigzag-amp-slider');
  const zigzagAmpVal = document.getElementById('zigzag-amp-val');
  const zigzagFreqSlider = document.getElementById('zigzag-freq-slider');
  const zigzagFreqVal = document.getElementById('zigzag-freq-val');
  const tileSizeSlider = document.getElementById('tile-size-slider');
  const tileSizeVal = document.getElementById('tile-size-val');
  const contrastSlider = document.getElementById('contrast-slider');
  const contrastVal = document.getElementById('contrast-val');
  const exposureSlider = document.getElementById('exposure-slider');
  const exposureVal = document.getElementById('exposure-val');
  const saturationSlider = document.getElementById('saturation-slider');
  const saturationVal = document.getElementById('saturation-val');
  const weightSlider = document.getElementById('weight-slider');
  const weightVal = document.getElementById('weight-val');

  const zoomModal = document.getElementById('zoom-modal');
  const zoomImage = document.getElementById('zoom-image');
  const zoomTitle = document.getElementById('zoom-title');
  const zoomClose = document.getElementById('zoom-close');
  const zoomViewport = document.getElementById('zoom-viewport');
  const zoomPrev = document.getElementById('zoom-prev');
  const zoomNext = document.getElementById('zoom-next');

  const combinedWrap = document.getElementById('combined-wrap');
  const combinedCanvas = document.getElementById('combined-canvas');
  const combinedOpacitySlider = document.getElementById('combined-opacity-slider');
  const combinedOpacityValue = document.getElementById('combined-opacity-value');
  const combinedColorInputs = {
    c: document.getElementById('combined-cyan-color'),
    m: document.getElementById('combined-magenta-color'),
    y: document.getElementById('combined-yellow-color'),
    k: document.getElementById('combined-key-color'),
  };

  const channelCanvases = {
    c: document.querySelector('.channel-card[data-channel="c"] canvas'),
    m: document.querySelector('.channel-card[data-channel="m"] canvas'),
    y: document.querySelector('.channel-card[data-channel="y"] canvas'),
    k: document.querySelector('.channel-card[data-channel="k"] canvas'),
  };

  // Per-channel density multiplier — scales whichever density slider is
  // active (Scribble/Hatch/Path Density) for just that one plate.
  const channelDensityRows = {};
  const channelDensitySliders = {};
  const channelDensityVals = {};
  const channelLineCounts = {};
  document.querySelectorAll('.channel-card').forEach(card => {
    const key = card.dataset.channel;
    channelDensityRows[key] = card.querySelector('.channel-density-row');
    channelDensitySliders[key] = card.querySelector('.channel-density-slider');
    channelDensityVals[key] = card.querySelector('.channel-density-val');
    channelLineCounts[key] = card.querySelector('.channel-line-count');
  });
  function channelDensityMult(key) {
    return Number(channelDensitySliders[key].value) / 100;
  }
  function updateChannelLineCount(key) {
    const data = channelStrokes[key];
    const n = data.items.length;
    const noun = data.kind === 'dots' ? 'dot' : 'line';
    channelLineCounts[key].textContent = `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`;
  }

  let cropper = null;
  let channelState = null; // { width, height, c, m, y, k } — per-pixel gray arrays, low=more ink
  let channelStrokes = {
    c: { kind: 'lines', items: [] }, m: { kind: 'lines', items: [] },
    y: { kind: 'lines', items: [] }, k: { kind: 'lines', items: [] },
  };
  let cachedSatWeights = null; // saturation field, built once per image, shared by all 4 channels
  let renderMode = 'continuous'; // 'continuous' | 'single' | 'hatch' | 'microprint'
  let directionMode = 'fixed';   // 'fixed' | 'parallelLines' | 'organic' | 'parallel'
  let hatchPattern = 'straight'; // 'straight' | 'crossgrid' | 'contour' | 'stipple' | 'zigzag' | 'truchet'
  let srcW = 0, srcH = 0;
  let sourceFileName = 'photo';

  let zoomedChannel = null;
  let zoomScale = 1, zoomPanX = 0, zoomPanY = 0;
  let isPanning = false, panDragStartX = 0, panDragStartY = 0, panStartX = 0, panStartY = 0;

  // Declared up here (not near its other slider-wiring code below) because
  // setDirectionMode('fixed') calls this synchronously during initial script
  // execution, before that later code would otherwise run.
  let renderTimer = null;
  function scheduleRender() {
    if (status) status.textContent = 'Rendering…';
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderAllChannels, 120);
  }

  // For Exposure/Saturation: these change the CMYK split itself, not just
  // how it's drawn, so the channels have to be rebuilt before re-rendering.
  function scheduleChannelRecompute() {
    if (status) status.textContent = 'Rendering…';
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      recomputeChannelsFromOriginal();
      renderAllChannels();
    }, 120);
  }

  // ── Upload ────────────────────────────────────────────────
  chooseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (file) handleFile(file);
  });

  ['dragenter', 'dragover'].forEach(evt =>
    dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); })
  );
  dropZone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  function getExtension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  }
  function isSupportedImage(file) {
    return SUPPORTED_EXTENSIONS.includes(getExtension(file.name)) ||
      SUPPORTED_MIME_TYPES.includes(file.type);
  }
  function isHeic(file) {
    const ext = getExtension(file.name);
    return ext === 'heic' || ext === 'heif' ||
      file.type === 'image/heic' || file.type === 'image/heif';
  }

  async function handleFile(file) {
    if (!isSupportedImage(file)) {
      status.textContent = 'Please choose a JPEG, PNG, or HEIC photo.';
      return;
    }

    sourceFileName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    originalWrap.classList.add('hidden');
    channelsSection.classList.add('hidden');
    combinedWrap.classList.add('hidden');

    try {
      let blob = file;
      if (isHeic(file)) {
        status.textContent = 'Converting HEIC photo…';
        blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
        if (Array.isArray(blob)) blob = blob[0];
      }
      startCrop(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
      status.textContent = 'Could not read that photo.';
    }
  }

  // ── Crop (Cropper.js) ────────────────────────────────────
  function startCrop(url) {
    if (cropper) { cropper.destroy(); cropper = null; }
    status.textContent = 'Drag to adjust the crop, then confirm.';
    cropImage.onload = () => {
      cropper = new Cropper(cropImage, { viewMode: 1, autoCropArea: 1, background: false, responsive: true });
    };
    cropImage.onerror = () => { status.textContent = 'Could not load that image.'; };
    cropImage.src = url;
    cropper_wrap.classList.remove('hidden');
  }

  function closeCrop() {
    if (cropper) { cropper.destroy(); cropper = null; }
    cropImage.onload = null;
    cropImage.onerror = null;
    URL.revokeObjectURL(cropImage.src);
    cropImage.src = '';
    cropper_wrap.classList.add('hidden');
  }

  confirmCropBtn.addEventListener('click', () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({
      maxWidth: MAX_DIMENSION,
      maxHeight: MAX_DIMENSION,
      imageSmoothingQuality: 'high',
    });
    closeCrop();
    processImage(canvas);
  });

  cancelCropBtn.addEventListener('click', () => {
    closeCrop();
    status.textContent = '';
  });

  // ── CMYK channel extraction ──────────────────────────────
  function processImage(source) {
    const width = source.width;
    const height = source.height;

    originalCanvas.width = width;
    originalCanvas.height = height;
    const octx = originalCanvas.getContext('2d');
    octx.drawImage(source, 0, 0, width, height);
    originalWrap.classList.remove('hidden');

    recomputeChannelsFromOriginal();

    channelsSection.classList.remove('hidden');
    combinedWrap.classList.remove('hidden');
    updateExportButtonsState();
    renderAllChannels();
    status.textContent = `Done — ${width}×${height}px`;
  }

  // Re-reads the untouched pixels straight off #original-canvas (never
  // mutated in place), applies Exposure/Saturation, then re-splits into
  // CMYK. Called once on upload and again whenever those two sliders move,
  // so edits never compound on top of a previous pass.
  function recomputeChannelsFromOriginal() {
    const width = originalCanvas.width;
    const height = originalCanvas.height;
    if (!width || !height) return;

    const octx = originalCanvas.getContext('2d');
    const srcData = octx.getImageData(0, 0, width, height);
    const data = srcData.data;
    const pixelCount = width * height;

    const exposureFactor = 1 + Number(exposureSlider.value) / 100;
    const satFactor = Number(saturationSlider.value) / 100;

    const adjusted = new Uint8ClampedArray(data.length);
    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      let r = data[o] * exposureFactor;
      let g = data[o + 1] * exposureFactor;
      let b = data[o + 2] * exposureFactor;

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * satFactor;
      g = gray + (g - gray) * satFactor;
      b = gray + (b - gray) * satFactor;

      adjusted[o] = r; adjusted[o + 1] = g; adjusted[o + 2] = b; adjusted[o + 3] = data[o + 3];
    }
    const adjustedData = new ImageData(adjusted, width, height);

    const cGray = new Uint8ClampedArray(pixelCount);
    const mGray = new Uint8ClampedArray(pixelCount);
    const yGray = new Uint8ClampedArray(pixelCount);
    const kGray = new Uint8ClampedArray(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      const r = adjusted[o] / 255, g = adjusted[o + 1] / 255, b = adjusted[o + 2] / 255;

      const k = 1 - Math.max(r, g, b);
      const denom = 1 - k;
      const c = denom === 0 ? 0 : (1 - r - k) / denom;
      const m = denom === 0 ? 0 : (1 - g - k) / denom;
      const y = denom === 0 ? 0 : (1 - b - k) / denom;

      cGray[i] = Math.round((1 - c) * 255);
      mGray[i] = Math.round((1 - m) * 255);
      yGray[i] = Math.round((1 - y) * 255);
      kGray[i] = Math.round((1 - k) * 255);
    }

    channelState = { width, height, c: cGray, m: mGray, y: yGray, k: kGray };
    srcW = width; srcH = height;
    cachedSatWeights = buildSaturationField(adjustedData, width, height).sat;
  }

  // ── Darkness field per channel (low gray value = more ink = darker) ──
  function buildDensityFieldFromGray(gray, w, h, gamma) {
    const cols = Math.ceil(w / CELL_SIZE);
    const rows = Math.ceil(h / CELL_SIZE);
    const darkness = new Float64Array(cols * rows);
    const weights = new Float64Array(cols * rows);

    for (let cy = 0; cy < rows; cy++) {
      const y0 = cy * CELL_SIZE, y1 = Math.min(h, y0 + CELL_SIZE);
      for (let cx = 0; cx < cols; cx++) {
        const x0 = cx * CELL_SIZE, x1 = Math.min(w, x0 + CELL_SIZE);
        let sum = 0, count = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            sum += (255 - gray[y * w + x]);
            count++;
          }
        }
        const dark = count > 0 ? (sum / count) / 255 : 0;
        const idx = cy * cols + cx;
        darkness[idx] = dark;
        weights[idx] = Math.pow(dark, gamma);
      }
    }
    return { darkness, weights, cols, rows };
  }

  // ── Saturation field (from the original RGB photo, shared by all channels) ──
  function buildSaturationField(imageData, w, h) {
    const cols = Math.ceil(w / CELL_SIZE);
    const rows = Math.ceil(h / CELL_SIZE);
    const sat = new Float64Array(cols * rows);
    const data = imageData.data;

    for (let cy = 0; cy < rows; cy++) {
      const y0 = cy * CELL_SIZE, y1 = Math.min(h, y0 + CELL_SIZE);
      for (let cx = 0; cx < cols; cx++) {
        const x0 = cx * CELL_SIZE, x1 = Math.min(w, x0 + CELL_SIZE);
        let sum = 0, count = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const p = (y * w + x) * 4;
            const r = data[p] / 255, g = data[p + 1] / 255, b = data[p + 2] / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const l = (max + min) / 2;
            const s = (max === min) ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
            sum += s;
            count++;
          }
        }
        sat[cy * cols + cx] = count > 0 ? sum / count : 0;
      }
    }
    return { sat, cols, rows };
  }

  // ── Weighted random points: dark cells pull in proportionally more ──
  function generatePoints(weights, cols, rows, n) {
    const cdf = new Float64Array(weights.length);
    let acc = 0;
    for (let i = 0; i < weights.length; i++) { acc += weights[i]; cdf[i] = acc; }
    if (acc <= 0) return [];

    const points = [];
    for (let i = 0; i < n; i++) {
      const r = Math.random() * acc;
      let lo = 0, hi = cdf.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cdf[mid] < r) lo = mid + 1; else hi = mid;
      }
      const cx = lo % cols, cy = Math.floor(lo / cols);
      const x0 = cx * CELL_SIZE, y0 = cy * CELL_SIZE;
      points.push([
        Math.min(srcW, x0 + Math.random() * CELL_SIZE),
        Math.min(srcH, y0 + Math.random() * CELL_SIZE)
      ]);
    }
    return points;
  }

  // ── Single continuous path: greedy nearest-neighbor walk via spatial grid ──
  function buildPath(points, w, h) {
    const n = points.length;
    if (n < 2) return points.slice();

    const cellSize = Math.max(1, Math.sqrt((w * h) / n));
    const cols = Math.max(1, Math.ceil(w / cellSize));
    const rows = Math.max(1, Math.ceil(h / cellSize));

    const cellKey = (i) => {
      const cx = Math.min(cols - 1, Math.floor(points[i][0] / cellSize));
      const cy = Math.min(rows - 1, Math.floor(points[i][1] / cellSize));
      return cy * cols + cx;
    };

    const buckets = new Map();
    for (let i = 0; i < n; i++) {
      const k = cellKey(i);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    }
    function removeFromBucket(i) {
      const k = cellKey(i);
      const arr = buckets.get(k);
      if (!arr) return;
      const pos = arr.indexOf(i);
      if (pos !== -1) arr.splice(pos, 1);
      if (arr.length === 0) buckets.delete(k);
    }

    const order = [];
    let current = 0;
    order.push(current);
    removeFromBucket(current);

    const maxRadius = Math.max(cols, rows);

    for (let step = 1; step < n; step++) {
      const px = points[current][0], py = points[current][1];
      const ccx = Math.min(cols - 1, Math.floor(px / cellSize));
      const ccy = Math.min(rows - 1, Math.floor(py / cellSize));

      let best = -1, bestD = Infinity, foundRadius = -1;

      for (let radius = 0; radius <= maxRadius; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const gx = ccx + dx, gy = ccy + dy;
            if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
            const arr = buckets.get(gy * cols + gx);
            if (!arr) continue;
            for (const idx of arr) {
              const ddx = points[idx][0] - px, ddy = points[idx][1] - py;
              const d = ddx * ddx + ddy * ddy;
              if (d < bestD) { bestD = d; best = idx; }
            }
          }
        }
        if (best !== -1 && foundRadius === -1) foundRadius = radius;
        if (foundRadius !== -1 && radius >= foundRadius + 1) break;
      }

      if (best === -1) break;
      order.push(best);
      removeFromBucket(best);
      current = best;
    }

    return order.map(i => points[i]);
  }

  // ── Gradient field over the darkness grid, smoothed for large-scale form ──
  function buildGradientField(darkness, cols, rows) {
    const at = (x, y) => darkness[
      Math.min(rows - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))
    ];
    let gx = new Float64Array(cols * rows);
    let gy = new Float64Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        gx[y * cols + x] = (at(x + 1, y) - at(x - 1, y)) / 2;
        gy[y * cols + x] = (at(x, y + 1) - at(x, y - 1)) / 2;
      }
    }
    gx = smoothField(gx, cols, rows, 2);
    gy = smoothField(gy, cols, rows, 2);
    return { gx, gy };
  }

  function smoothField(field, cols, rows, passes) {
    let src = field;
    for (let p = 0; p < passes; p++) {
      const dst = new Float64Array(src.length);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let sum = 0, cnt = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
              sum += src[ny * cols + nx]; cnt++;
            }
          }
          dst[y * cols + x] = sum / cnt;
        }
      }
      src = dst;
    }
    return src;
  }

  function flowDirAt(gx, gy, defDx, defDy) {
    const mag = Math.hypot(gx, gy);
    const t = Math.min(1, mag * 10);
    const len = mag || 1;
    const nx = -gy / len, ny = gx / len;
    const dx = nx * t + defDx * (1 - t);
    const dy = ny * t + defDy * (1 - t);
    const l2 = Math.hypot(dx, dy) || 1;
    return [dx / l2, dy / l2];
  }

  const FLOW_ANCHOR_K = 5;

  function flowAnchorCount(spacing, cols, rows) {
    const n = Math.round((cols * rows) / (spacing * spacing));
    return Math.max(8, Math.min(4000, n));
  }

  function buildOrganicFlowField(satWeights, cols, rows, anchorCount, w, h) {
    const anchors = generatePoints(satWeights, cols, rows, anchorCount);
    if (anchors.length === 0) return () => [1, 0];

    const vectors = anchors.map(() => {
      const a = Math.random() * Math.PI * 2;
      return [Math.cos(a), Math.sin(a)];
    });

    const cellSize = Math.max(1, Math.sqrt((w * h) / anchors.length));
    const bCols = Math.max(1, Math.ceil(w / cellSize));
    const bRows = Math.max(1, Math.ceil(h / cellSize));
    const buckets = new Map();
    anchors.forEach(([x, y], i) => {
      const bx = Math.min(bCols - 1, Math.floor(x / cellSize));
      const by = Math.min(bRows - 1, Math.floor(y / cellSize));
      const k = by * bCols + bx;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    });
    const maxRadius = Math.max(bCols, bRows);

    return function sampleAt(x, y) {
      const bx = Math.min(bCols - 1, Math.max(0, Math.floor(x / cellSize)));
      const by = Math.min(bRows - 1, Math.max(0, Math.floor(y / cellSize)));

      const found = [];
      for (let radius = 0; radius <= maxRadius; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const gx2 = bx + dx, gy2 = by + dy;
            if (gx2 < 0 || gy2 < 0 || gx2 >= bCols || gy2 >= bRows) continue;
            const arr = buckets.get(gy2 * bCols + gx2);
            if (arr) for (const idx of arr) found.push(idx);
          }
        }
        if (found.length >= FLOW_ANCHOR_K) break;
      }

      let vx = 0, vy = 0, wsum = 0;
      for (const idx of found) {
        const [ax, ay] = anchors[idx];
        const d2 = (ax - x) * (ax - x) + (ay - y) * (ay - y);
        const wgt = 1 / (d2 + 1);
        vx += vectors[idx][0] * wgt;
        vy += vectors[idx][1] * wgt;
        wsum += wgt;
      }
      if (wsum === 0) return [1, 0];
      vx /= wsum; vy /= wsum;
      const len = Math.hypot(vx, vy) || 1;
      return [vx / len, vy / len];
    };
  }

  function traceStroke(seedX, seedY, gx, gy, cols, rows, getDefaultDir, gradientScale, halfLen, stepSize, w, h) {
    const dirAt = (x, y) => {
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / CELL_SIZE)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / CELL_SIZE)));
      const [ddx, ddy] = getDefaultDir(x, y);
      return flowDirAt(gx[cy * cols + cx] * gradientScale, gy[cy * cols + cx] * gradientScale, ddx, ddy);
    };

    function walk(sign) {
      const pts = [];
      let x = seedX, y = seedY;
      let [dx, dy] = dirAt(x, y);
      dx *= sign; dy *= sign;
      for (let i = 0; i < halfLen; i++) {
        let [ndx, ndy] = dirAt(x, y);
        if (ndx * dx + ndy * dy < 0) { ndx = -ndx; ndy = -ndy; }
        dx = ndx; dy = ndy;
        x += dx * stepSize; y += dy * stepSize;
        if (x < 0 || y < 0 || x > w || y > h) break;
        pts.push([x, y]);
      }
      return pts;
    }

    const fwd = walk(1);
    const bwd = walk(-1).reverse();
    return bwd.concat([[seedX, seedY]], fwd);
  }

  function straightStroke(cx, cy, angle, halfLen, stepSize) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const pts = [];
    for (let i = -halfLen; i <= halfLen; i++) {
      pts.push([cx + dx * i * stepSize, cy + dy * i * stepSize]);
    }
    return pts;
  }

  function randomizeLength(baseLen, randomFraction) {
    if (randomFraction <= 0) return baseLen;
    const factor = 1 + (Math.random() * 2 - 1) * randomFraction;
    return Math.max(2, baseLen * factor);
  }

  // Shared by Hatch and Microprint: a default-direction sampler (constant
  // angle, or an organic flow field) plus how much real photo edges are
  // allowed to bend that default away.
  function buildDirectionGetter(satWeights, cols, rows, dirMode, directionRad, flowRigidity, w, h) {
    return (dirMode === 'organic' || dirMode === 'parallel')
      ? buildOrganicFlowField(satWeights, cols, rows, flowAnchorCount(flowRigidity, cols, rows), w, h)
      : (() => { const fdx = Math.cos(directionRad), fdy = Math.sin(directionRad); return () => [fdx, fdy]; })();
  }

  // One layer of darkness-seeded, flow-traced polylines — the primary hatch
  // layer, and the entirety of what Microprint's text paths are traced onto.
  function traceLayer(weights, cols, rows, targetN, baseLenPx, lengthRandomness, gx, gy, getDefaultDir, gradientScale, stepSize, w, h) {
    const strokes = [];
    const seeds = generatePoints(weights, cols, rows, targetN);
    for (const [sx, sy] of seeds) {
      const halfLen = Math.max(1, Math.round(randomizeLength(baseLenPx, lengthRandomness) / (2 * stepSize)));
      const s = traceStroke(sx, sy, gx, gy, cols, rows, getDefaultDir, gradientScale, halfLen, stepSize, w, h);
      if (s.length > 1) strokes.push(s);
    }
    return strokes;
  }

  function generateHatchStrokes(darkness, weights, satWeights, cols, rows, targetN, baseLenPx, lengthRandomness, dirMode, directionRad, parallelRigidity, flowRigidity, w, h) {
    const { gx, gy } = buildGradientField(darkness, cols, rows);
    const stepSize = HATCH_STEP;

    const getDefaultDir = buildDirectionGetter(satWeights, cols, rows, dirMode, directionRad, flowRigidity, w, h);
    const gradientScale = (dirMode === 'parallelLines' || dirMode === 'parallel') ? (1 - parallelRigidity / 100) : 1;

    const strokes = traceLayer(weights, cols, rows, targetN, baseLenPx, lengthRandomness, gx, gy, getDefaultDir, gradientScale, stepSize, w, h);

    if (dirMode === 'parallel' || dirMode === 'parallelLines') return strokes;

    const crossSeeds = generatePoints(weights, cols, rows, targetN);
    for (const [sx, sy] of crossSeeds) {
      const cx = Math.min(cols - 1, Math.floor(sx / CELL_SIZE));
      const cy = Math.min(rows - 1, Math.floor(sy / CELL_SIZE));
      if (darkness[cy * cols + cx] <= CROSSHATCH_THRESHOLD) continue;

      const [ddx, ddy] = getDefaultDir(sx, sy);
      const [ldx, ldy] = flowDirAt(gx[cy * cols + cx] * gradientScale, gy[cy * cols + cx] * gradientScale, ddx, ddy);
      const crossAngle = Math.atan2(ldy, ldx) + Math.PI / 2;

      const halfLen = Math.max(1, Math.round(randomizeLength(baseLenPx, lengthRandomness) / (2 * stepSize)));
      const cross = straightStroke(sx, sy, crossAngle, halfLen, stepSize);
      if (cross.length > 1) strokes.push(cross);
    }

    return strokes;
  }

  // ── Cross-Grid: two full darkness-weighted passes at a fixed angle to
  // ── each other, rather than only crossing above a darkness threshold.
  function generateCrossHatchGrid(darkness, weights, satWeights, cols, rows, targetN, baseLenPx, lengthRandomness, dirMode, directionRad, parallelRigidity, flowRigidity, crossAngleRad, w, h) {
    const { gx, gy } = buildGradientField(darkness, cols, rows);
    const stepSize = HATCH_STEP;
    const getDefaultDir = buildDirectionGetter(satWeights, cols, rows, dirMode, directionRad, flowRigidity, w, h);
    const gradientScale = (dirMode === 'parallelLines' || dirMode === 'parallel') ? (1 - parallelRigidity / 100) : 1;

    const pass1 = traceLayer(weights, cols, rows, targetN, baseLenPx, lengthRandomness, gx, gy, getDefaultDir, gradientScale, stepSize, w, h);

    const cos = Math.cos(crossAngleRad), sin = Math.sin(crossAngleRad);
    const getCrossDir = (x, y) => {
      const [dx, dy] = getDefaultDir(x, y);
      return [dx * cos - dy * sin, dx * sin + dy * cos];
    };
    const pass2 = traceLayer(weights, cols, rows, targetN, baseLenPx, lengthRandomness, gx, gy, getCrossDir, gradientScale, stepSize, w, h);

    return pass1.concat(pass2);
  }

  // ── Zigzag: same flow-following tracer as Straight hatch, but each stroke
  // ── oscillates perpendicular to its own direction as it travels.
  function traceZigzagStroke(seedX, seedY, gx, gy, cols, rows, getDefaultDir, gradientScale, halfLen, stepSize, w, h, amplitude, frequency) {
    const dirAt = (x, y) => {
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / CELL_SIZE)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / CELL_SIZE)));
      const [ddx, ddy] = getDefaultDir(x, y);
      return flowDirAt(gx[cy * cols + cx] * gradientScale, gy[cy * cols + cx] * gradientScale, ddx, ddy);
    };

    function walk(sign) {
      const pts = [];
      let x = seedX, y = seedY;
      let [dx, dy] = dirAt(x, y);
      dx *= sign; dy *= sign;
      let dist = 0;
      for (let i = 0; i < halfLen; i++) {
        let [ndx, ndy] = dirAt(x, y);
        if (ndx * dx + ndy * dy < 0) { ndx = -ndx; ndy = -ndy; }
        dx = ndx; dy = ndy;
        x += dx * stepSize; y += dy * stepSize;
        dist += stepSize;
        if (x < 0 || y < 0 || x > w || y > h) break;
        const perpX = -dy, perpY = dx;
        const offset = Math.sin((dist / stepSize) * frequency) * amplitude;
        pts.push([x + perpX * offset, y + perpY * offset]);
      }
      return pts;
    }

    const fwd = walk(1);
    const bwd = walk(-1).reverse();
    return bwd.concat([[seedX, seedY]], fwd);
  }

  function generateZigzagStrokes(darkness, weights, satWeights, cols, rows, targetN, baseLenPx, lengthRandomness, dirMode, directionRad, parallelRigidity, flowRigidity, amplitude, frequency, w, h) {
    const { gx, gy } = buildGradientField(darkness, cols, rows);
    const stepSize = HATCH_STEP;
    const getDefaultDir = buildDirectionGetter(satWeights, cols, rows, dirMode, directionRad, flowRigidity, w, h);
    const gradientScale = (dirMode === 'parallelLines' || dirMode === 'parallel') ? (1 - parallelRigidity / 100) : 1;

    const strokes = [];
    const seeds = generatePoints(weights, cols, rows, targetN);
    for (const [sx, sy] of seeds) {
      const halfLen = Math.max(1, Math.round(randomizeLength(baseLenPx, lengthRandomness) / (2 * stepSize)));
      const s = traceZigzagStroke(sx, sy, gx, gy, cols, rows, getDefaultDir, gradientScale, halfLen, stepSize, w, h, amplitude, frequency);
      if (s.length > 1) strokes.push(s);
    }
    return strokes;
  }

  // ── Contour: marching squares over the (contrast-shaped) darkness field,
  // ── tracing several equal-tone bands through the image like a topo map.
  function marchingSquaresLevel(field, cols, rows, level) {
    const segments = [];
    const at = (x, y) => field[y * cols + x];
    const lerp = (x0, y0, x1, y1, v0, v1) => {
      const denom = v1 - v0;
      const t = Math.abs(denom) > 1e-9 ? (level - v0) / denom : 0.5;
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    };

    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols - 1; x++) {
        const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
        let idx = 0;
        if (tl > level) idx |= 8;
        if (tr > level) idx |= 4;
        if (br > level) idx |= 2;
        if (bl > level) idx |= 1;
        if (idx === 0 || idx === 15) continue;

        const top = () => lerp(x, y, x + 1, y, tl, tr);
        const right = () => lerp(x + 1, y, x + 1, y + 1, tr, br);
        const bottom = () => lerp(x, y + 1, x + 1, y + 1, bl, br);
        const left = () => lerp(x, y, x, y + 1, tl, bl);

        if (idx === 5) { segments.push([top(), left()]); segments.push([bottom(), right()]); continue; }
        if (idx === 10) { segments.push([top(), right()]); segments.push([bottom(), left()]); continue; }

        const EDGE_PAIRS = {
          1: [left, bottom], 2: [bottom, right], 3: [left, right], 4: [top, right],
          6: [top, bottom], 7: [top, left], 8: [top, left], 9: [top, bottom],
          11: [top, right], 12: [left, right], 13: [bottom, right], 14: [left, bottom],
        };
        const pair = EDGE_PAIRS[idx];
        if (pair) segments.push([pair[0](), pair[1]()]);
      }
    }
    return segments;
  }

  function generateContourLines(weights, cols, rows, numLevels, cellSize) {
    const strokes = [];
    for (let i = 1; i <= numLevels; i++) {
      const level = i / (numLevels + 1);
      const segs = marchingSquaresLevel(weights, cols, rows, level);
      for (const [[x0, y0], [x1, y1]] of segs) {
        strokes.push([[x0 * cellSize, y0 * cellSize], [x1 * cellSize, y1 * cellSize]]);
      }
    }
    return strokes;
  }

  // ── Stipple: weighted Voronoi stippling — start from darkness-weighted
  // ── random points, then relax them toward their cell's weighted centroid
  // ── a few times so they settle into an organic, evenly-spaced field that
  // ── still concentrates in dark areas.
  function weightedVoronoiStipple(weights, cols, rows, n, iterations, w, h) {
    let points = generatePoints(weights, cols, rows, n);
    if (points.length < 2 || iterations <= 0) return points;

    for (let iter = 0; iter < iterations; iter++) {
      const flat = new Float64Array(points.length * 2);
      points.forEach((p, i) => { flat[i * 2] = p[0]; flat[i * 2 + 1] = p[1]; });
      const delaunay = new d3.Delaunay(flat);

      const sumX = new Float64Array(points.length);
      const sumY = new Float64Array(points.length);
      const sumW = new Float64Array(points.length);

      let guess = 0;
      for (let gy = 0; gy < rows; gy++) {
        const py = (gy + 0.5) * CELL_SIZE;
        guess = delaunay.find(0.5 * CELL_SIZE, py, guess);
        for (let gx = 0; gx < cols; gx++) {
          const px = (gx + 0.5) * CELL_SIZE;
          guess = delaunay.find(px, py, guess);
          const wgt = weights[gy * cols + gx] + 1e-6;
          sumX[guess] += px * wgt;
          sumY[guess] += py * wgt;
          sumW[guess] += wgt;
        }
      }

      points = points.map((p, i) => sumW[i] > 1e-6
        ? [Math.min(w, Math.max(0, sumX[i] / sumW[i])), Math.min(h, Math.max(0, sumY[i] / sumW[i]))]
        : p);
    }
    return points;
  }

  // ── Truchet: a grid of tiles, each filled with 1-3 nested quarter-circle
  // ── arc pairs (darkness controls how many). Every tile touches all four
  // ── edge midpoints exactly once, so neighboring tiles always connect
  // ── into flowing, maze-like curves regardless of each tile's own flip.
  function hashRandom(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }

  function arcPoints(cx, cy, r, a0, a1, steps) {
    const pts = [];
    const n = steps || 8;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }

  function generateTruchetTiles(weights, cols, rows, tileSize, seed, w, h) {
    const strokes = [];
    const gridCols = Math.ceil(w / tileSize);
    const gridRows = Math.ceil(h / tileSize);

    for (let ty = 0; ty < gridRows; ty++) {
      for (let tx = 0; tx < gridCols; tx++) {
        const x0 = tx * tileSize, y0 = ty * tileSize;
        const gx0 = Math.min(cols - 1, Math.floor(x0 / CELL_SIZE));
        const gy0 = Math.min(rows - 1, Math.floor(y0 / CELL_SIZE));
        const gx1 = Math.max(gx0 + 1, Math.min(cols, Math.ceil((x0 + tileSize) / CELL_SIZE)));
        const gy1 = Math.max(gy0 + 1, Math.min(rows, Math.ceil((y0 + tileSize) / CELL_SIZE)));

        let sum = 0, count = 0;
        for (let gy = gy0; gy < gy1; gy++) {
          for (let gx = gx0; gx < gx1; gx++) { sum += weights[gy * cols + gx]; count++; }
        }
        const coverage = count > 0 ? Math.min(1, sum / count) : 0;
        if (coverage < 0.05) continue;

        const numArcs = 1 + Math.round(coverage * 2);
        const flip = hashRandom(tx, ty, seed) < 0.5;

        const c1x = flip ? x0 + tileSize : x0, c1y = y0;
        const c2x = flip ? x0 : x0 + tileSize, c2y = y0 + tileSize;
        const a1start = flip ? Math.PI / 2 : 0, a1end = flip ? Math.PI : Math.PI / 2;
        const a2start = flip ? Math.PI * 1.5 : Math.PI, a2end = flip ? Math.PI * 2 : Math.PI * 1.5;

        for (let k = 1; k <= numArcs; k++) {
          const r = (tileSize / 2) * (k / (numArcs + 0.4));
          strokes.push(arcPoints(c1x, c1y, r, a1start, a1end));
          strokes.push(arcPoints(c2x, c2y, r, a2start, a2end));
        }
      }
    }
    return strokes;
  }

  // ── Microprint: same darkness-seeded flow paths as hatch's primary layer,
  // ── no crosshatch — the paths are meant to carry readable repeating text,
  // ── which a crossing second layer would just turn to mush.
  function generateMicroprintPaths(darkness, weights, satWeights, cols, rows, targetN, baseLenPx, lengthRandomness, dirMode, directionRad, parallelRigidity, flowRigidity, w, h) {
    const { gx, gy } = buildGradientField(darkness, cols, rows);
    const stepSize = HATCH_STEP;
    const getDefaultDir = buildDirectionGetter(satWeights, cols, rows, dirMode, directionRad, flowRigidity, w, h);
    const gradientScale = (dirMode === 'parallelLines' || dirMode === 'parallel') ? (1 - parallelRigidity / 100) : 1;
    return traceLayer(weights, cols, rows, targetN, baseLenPx, lengthRandomness, gx, gy, getDefaultDir, gradientScale, stepSize, w, h);
  }

  // ── Walk a polyline at a fixed arc-length step per character, placing one
  // ── character of `text` (repeating) at each step, rotated to the local
  // ── path tangent — the classic "text on a path" technique, same idea as
  // ── the repeating microprint lines on currency.
  function walkPathForText(path, text, spacingMult, charWidthCache, ctx) {
    if (!text || path.length < 2) return [];
    const placements = [];
    let charIndex = 0;
    let distSinceLast = 0;

    function widthOf(ch) {
      let wdt = charWidthCache[ch];
      if (wdt === undefined) {
        wdt = ctx.measureText(ch).width;
        charWidthCache[ch] = wdt;
      }
      return wdt;
    }

    let need = Math.max(1, widthOf(text[0]) * spacingMult);

    for (let i = 0; i < path.length - 1; i++) {
      const [x0, y0] = path[i], [x1, y1] = path[i + 1];
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      if (segLen === 0) continue;
      let travelled = 0;
      while (distSinceLast + (segLen - travelled) >= need) {
        const remain = need - distSinceLast;
        const t = (travelled + remain) / segLen;
        const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
        const angle = Math.atan2(y1 - y0, x1 - x0);
        const ch = text[charIndex % text.length];
        placements.push({ x: px, y: py, angle, char: ch });
        charIndex++;
        travelled += remain;
        distSinceLast = 0;
        need = Math.max(1, widthOf(text[charIndex % text.length]) * spacingMult);
      }
      distSinceLast += (segLen - travelled);
    }
    return placements;
  }

  function escapeXML(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Continuous (plain grayscale) render, for the Continuous mode ──
  function renderContinuous(gray, width, height) {
    const out = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < gray.length; i++) {
      const v = gray[i];
      const o = i * 4;
      out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = 255;
    }
    return new ImageData(out, width, height);
  }

  // ── Per-channel stroke computation ───────────────────────
  // Returns { kind: 'lines', items: [[[x,y],...], ...] } for every pattern
  // except Stipple, which returns { kind: 'dots', items: [[x,y],...], dotRadius }.
  function computeChannelStrokes(key) {
    const { width, height } = channelState;
    const gray = channelState[key];
    const gamma = Number(contrastSlider.value) / 100;
    const { darkness, weights, cols, rows } = buildDensityFieldFromGray(gray, width, height, gamma);
    const densityMult = channelDensityMult(key);

    if (renderMode === 'single') {
      const targetN = Math.round(Number(densitySlider.value) * densityMult);
      const points = generatePoints(weights, cols, rows, targetN);
      const path = points.length ? buildPath(points, width, height) : [];
      return { kind: 'lines', items: path.length ? [path] : [] };
    }

    const baseDirDeg = Number(directionSlider.value);
    const channelDirDeg = (baseDirDeg + CHANNEL_ANGLE_OFFSET[key]) % 180;
    const directionRad = channelDirDeg * Math.PI / 180;
    const parallelRigidity = Number(parallelRigiditySlider.value);
    const flowRigidity = Number(flowRigiditySlider.value);
    const satWeights = (directionMode === 'organic' || directionMode === 'parallel') ? cachedSatWeights : null;

    if (renderMode === 'microprint') {
      const targetN = Math.round(Number(microprintDensitySlider.value) * densityMult);
      const pathLen = Number(microprintLengthSlider.value);
      return { kind: 'lines', items: generateMicroprintPaths(darkness, weights, satWeights, cols, rows, targetN, pathLen, 0.3, directionMode, directionRad, parallelRigidity, flowRigidity, width, height) };
    }

    // renderMode === 'hatch' — dispatch on the selected Hatch Pattern.
    const strokeLen = Number(strokeLenSlider.value);
    const lengthRand = Number(lengthRandSlider.value) / 100;

    if (hatchPattern === 'crossgrid') {
      const targetN = Math.round(Number(hatchDensitySlider.value) * densityMult);
      const crossAngleRad = Number(crossAngleSlider.value) * Math.PI / 180;
      return { kind: 'lines', items: generateCrossHatchGrid(darkness, weights, satWeights, cols, rows, targetN, strokeLen, lengthRand, directionMode, directionRad, parallelRigidity, flowRigidity, crossAngleRad, width, height) };
    }
    if (hatchPattern === 'contour') {
      const levels = Number(contourLevelsSlider.value);
      return { kind: 'lines', items: generateContourLines(weights, cols, rows, levels, CELL_SIZE) };
    }
    if (hatchPattern === 'stipple') {
      const targetN = Math.round(Number(stippleDensitySlider.value) * densityMult);
      const iterations = Number(relaxationSlider.value);
      const dotRadius = Number(dotSizeSlider.value);
      const points = weightedVoronoiStipple(weights, cols, rows, targetN, iterations, width, height);
      return { kind: 'dots', items: points, dotRadius };
    }
    if (hatchPattern === 'zigzag') {
      const targetN = Math.round(Number(hatchDensitySlider.value) * densityMult);
      const amplitude = Number(zigzagAmpSlider.value);
      const frequency = Number(zigzagFreqSlider.value) / 100;
      return { kind: 'lines', items: generateZigzagStrokes(darkness, weights, satWeights, cols, rows, targetN, strokeLen, lengthRand, directionMode, directionRad, parallelRigidity, flowRigidity, amplitude, frequency, width, height) };
    }
    if (hatchPattern === 'truchet') {
      const tileSize = Number(tileSizeSlider.value);
      return { kind: 'lines', items: generateTruchetTiles(weights, cols, rows, tileSize, CHANNEL_SEEDS[key], width, height) };
    }

    // default: straight
    const targetN = Math.round(Number(hatchDensitySlider.value) * densityMult);
    return { kind: 'lines', items: generateHatchStrokes(darkness, weights, satWeights, cols, rows, targetN, strokeLen, lengthRand, directionMode, directionRad, parallelRigidity, flowRigidity, width, height) };
  }

  function renderAllChannels() {
    if (!channelState) return;
    const { width, height } = channelState;
    const weight = Number(weightSlider.value) / 10;

    CHANNEL_ORDER.forEach(key => {
      const canvas = channelCanvases[key];
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (renderMode === 'continuous') {
        channelStrokes[key] = { kind: 'lines', items: [] };
        updateChannelLineCount(key);
        ctx.putImageData(renderContinuous(channelState[key], width, height), 0, 0);
        return;
      }

      const strokes = computeChannelStrokes(key);
      channelStrokes[key] = strokes;
      updateChannelLineCount(key);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);

      if (renderMode === 'microprint') {
        const text = (microprintTextInput.value || '').trim();
        const fontSizePx = Number(charSizeSlider.value);
        const spacingMult = Number(charSpacingSlider.value) / 100;
        ctx.fillStyle = '#000';
        ctx.font = `${fontSizePx}px monospace`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const charWidthCache = {};
        for (const path of strokes.items) {
          const placements = walkPathForText(path, text, spacingMult, charWidthCache, ctx);
          for (const p of placements) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillText(p.char, 0, 0);
            ctx.restore();
          }
        }
        return;
      }

      if (strokes.kind === 'dots') {
        ctx.fillStyle = '#000';
        for (const [px, py] of strokes.items) {
          ctx.beginPath();
          ctx.arc(px, py, strokes.dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = weight;
      ctx.strokeStyle = '#000';
      for (const s of strokes.items) {
        if (s.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(s[0][0], s[0][1]);
        for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
        ctx.stroke();
      }
    });

    updateZoomImage();
    renderCombined();
    updateStatusLine();
  }

  function updateStatusLine() {
    if (!channelState) return;
    const { width, height } = channelState;
    if (renderMode === 'continuous') {
      status.textContent = `Done — ${width}×${height}px`;
      return;
    }
    const counts = CHANNEL_ORDER.map(k => channelStrokes[k].items.length);
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) {
      status.textContent = 'No strokes generated — raise density or contrast.';
    } else {
      status.textContent = `${width}×${height}px — ${total.toLocaleString()} strokes across 4 plates`;
    }
  }

  // ── Combined preview ──────────────────────────────────────
  const combinedLayerCanvas = document.createElement('canvas');

  function renderCombined() {
    if (!channelState) return;
    const { width, height } = channelState;
    combinedCanvas.width = width;
    combinedCanvas.height = height;
    combinedLayerCanvas.width = width;
    combinedLayerCanvas.height = height;

    const ctx = combinedCanvas.getContext('2d');
    const layerCtx = combinedLayerCanvas.getContext('2d');
    const opacity = Number(combinedOpacitySlider.value) / 100;

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    CHANNEL_ORDER.forEach(key => {
      const src = channelCanvases[key].getContext('2d').getImageData(0, 0, width, height).data;
      const layer = layerCtx.createImageData(width, height);
      const [r, g, b] = CHANNEL_COLORS[key];
      for (let i = 0; i < width * height; i++) {
        const o = i * 4;
        const ink = (255 - src[o]) / 255;
        layer.data[o] = r;
        layer.data[o + 1] = g;
        layer.data[o + 2] = b;
        layer.data[o + 3] = Math.round(ink * opacity * 255);
      }
      layerCtx.putImageData(layer, 0, 0);
      ctx.drawImage(combinedLayerCanvas, 0, 0);
    });
  }

  // ── Mode / control wiring ─────────────────────────────────
  // Direction (Fixed/Parallel Lines/Organic/Parallel Flow) only means
  // something for patterns that trace an oriented path.
  function directionControlsApplicable() {
    if (renderMode === 'microprint') return true;
    if (renderMode !== 'hatch') return false;
    return hatchPattern === 'straight' || hatchPattern === 'crossgrid' || hatchPattern === 'zigzag';
  }
  // The per-channel Density slider only means something for patterns with
  // an actual point/stroke count (Contour uses Levels, Truchet a fixed grid).
  function densityMultApplicable() {
    if (renderMode === 'continuous') return false;
    if (renderMode === 'hatch') return hatchPattern !== 'contour' && hatchPattern !== 'truchet';
    return true;
  }

  function updateHatchPatternVisibility() {
    hatchCommonControls.classList.toggle('hidden', !(hatchPattern === 'straight' || hatchPattern === 'crossgrid' || hatchPattern === 'zigzag'));
    crossgridControls.classList.toggle('hidden', hatchPattern !== 'crossgrid');
    contourControls.classList.toggle('hidden', hatchPattern !== 'contour');
    stippleControls.classList.toggle('hidden', hatchPattern !== 'stipple');
    zigzagControls.classList.toggle('hidden', hatchPattern !== 'zigzag');
    truchetControls.classList.toggle('hidden', hatchPattern !== 'truchet');
    flowDirectionControls.classList.toggle('hidden', !directionControlsApplicable());
    weightCtrl.classList.toggle('hidden', renderMode === 'microprint' || (renderMode === 'hatch' && hatchPattern === 'stipple'));
    CHANNEL_ORDER.forEach(key => {
      channelDensityRows[key].classList.toggle('hidden', !densityMultApplicable());
    });
  }

  function updateControlVisibility() {
    singleControls.classList.toggle('hidden', renderMode !== 'single');
    hatchControls.classList.toggle('hidden', renderMode !== 'hatch');
    microprintControls.classList.toggle('hidden', renderMode !== 'microprint');
    lineSharedControls.classList.toggle('hidden', renderMode === 'continuous');
    updateHatchPatternVisibility();
  }

  function setHatchPattern(next) {
    hatchPattern = next;
    patternButtons.forEach(b => b.classList.toggle('active', b.dataset.pattern === hatchPattern));
    updateHatchPatternVisibility();
    scheduleRender();
  }
  patternButtons.forEach(btn => {
    btn.addEventListener('click', () => setHatchPattern(btn.dataset.pattern));
  });

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMode = btn.dataset.mode;
      updateControlVisibility();
      updateExportButtonsState();
      scheduleRender();
    });
  });
  updateControlVisibility();

  function setDirectionMode(next) {
    directionMode = next;
    dirFixedBtn.classList.toggle('active', directionMode === 'fixed');
    dirParallelLinesBtn.classList.toggle('active', directionMode === 'parallelLines');
    dirOrganicBtn.classList.toggle('active', directionMode === 'organic');
    dirParallelBtn.classList.toggle('active', directionMode === 'parallel');
    directionAngleCtrl.classList.toggle('hidden', directionMode !== 'fixed' && directionMode !== 'parallelLines');
    parallelRigidityCtrl.classList.toggle('hidden', directionMode !== 'parallelLines' && directionMode !== 'parallel');
    flowRigidityCtrl.classList.toggle('hidden', directionMode !== 'organic' && directionMode !== 'parallel');
    scheduleRender();
  }
  dirFixedBtn.addEventListener('click', () => setDirectionMode('fixed'));
  dirParallelLinesBtn.addEventListener('click', () => setDirectionMode('parallelLines'));
  dirOrganicBtn.addEventListener('click', () => setDirectionMode('organic'));
  dirParallelBtn.addEventListener('click', () => setDirectionMode('parallel'));
  setDirectionMode('fixed');

  function updateLabels() {
    densityVal.textContent = Number(densitySlider.value).toLocaleString();
    hatchDensityVal.textContent = Number(hatchDensitySlider.value).toLocaleString();
    directionVal.textContent = Number(directionSlider.value) + '°';
    parallelRigidityVal.textContent = Number(parallelRigiditySlider.value) + '%';
    flowRigidityVal.textContent = Number(flowRigiditySlider.value);
    strokeLenVal.textContent = Number(strokeLenSlider.value) + 'px';
    lengthRandVal.textContent = Number(lengthRandSlider.value) + '%';
    contrastVal.textContent = (Number(contrastSlider.value) / 100).toFixed(2) + '×';
    const exposureNum = Number(exposureSlider.value);
    exposureVal.textContent = (exposureNum > 0 ? '+' : '') + exposureNum + '%';
    saturationVal.textContent = Number(saturationSlider.value) + '%';
    weightVal.textContent = (Number(weightSlider.value) / 10).toFixed(1) + 'px';
    microprintDensityVal.textContent = Number(microprintDensitySlider.value).toLocaleString();
    microprintLengthVal.textContent = Number(microprintLengthSlider.value) + 'px';
    charSizeVal.textContent = Number(charSizeSlider.value) + 'px';
    charSpacingVal.textContent = Number(charSpacingSlider.value) + '%';
    crossAngleVal.textContent = Number(crossAngleSlider.value) + '°';
    contourLevelsVal.textContent = Number(contourLevelsSlider.value);
    stippleDensityVal.textContent = Number(stippleDensitySlider.value).toLocaleString();
    dotSizeVal.textContent = Number(dotSizeSlider.value) + 'px';
    relaxationVal.textContent = Number(relaxationSlider.value);
    zigzagAmpVal.textContent = Number(zigzagAmpSlider.value) + 'px';
    zigzagFreqVal.textContent = Number(zigzagFreqSlider.value);
    tileSizeVal.textContent = Number(tileSizeSlider.value) + 'px';
  }

  const allSliders = [
    densitySlider, hatchDensitySlider, directionSlider, parallelRigiditySlider, flowRigiditySlider,
    strokeLenSlider, lengthRandSlider, contrastSlider, weightSlider, microprintDensitySlider,
    microprintLengthSlider, charSizeSlider, charSpacingSlider,
    crossAngleSlider, contourLevelsSlider, stippleDensitySlider, dotSizeSlider, relaxationSlider,
    zigzagAmpSlider, zigzagFreqSlider, tileSizeSlider,
  ];
  allSliders.forEach(el => {
    el.addEventListener('input', () => { updateLabels(); scheduleRender(); });
  });
  microprintTextInput.addEventListener('input', () => scheduleRender());

  // Exposure/Saturation change the source pixels the CMYK split is computed
  // from, so these rebuild the channels rather than just re-rendering them.
  [exposureSlider, saturationSlider].forEach(el => {
    el.addEventListener('input', () => { updateLabels(); scheduleChannelRecompute(); });
  });

  CHANNEL_ORDER.forEach(key => {
    channelDensitySliders[key].addEventListener('input', () => {
      channelDensityVals[key].textContent = channelDensitySliders[key].value + '%';
      scheduleRender();
    });
  });

  updateLabels();

  // ── Combined preview controls ─────────────────────────────
  combinedOpacitySlider.addEventListener('input', () => {
    if (document.activeElement !== combinedOpacityValue) combinedOpacityValue.value = combinedOpacitySlider.value;
    renderCombined();
  });
  function clampNum(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function commitCombinedOpacityInput() {
    let v = parseInt(combinedOpacityValue.value, 10);
    if (!isFinite(v)) v = Number(combinedOpacitySlider.value);
    v = clampNum(v, 0, 100);
    combinedOpacitySlider.value = v;
    combinedOpacityValue.value = v;
    renderCombined();
  }
  combinedOpacityValue.addEventListener('change', commitCombinedOpacityInput);
  combinedOpacityValue.addEventListener('keydown', e => { if (e.key === 'Enter') combinedOpacityValue.blur(); });
  combinedOpacityValue.addEventListener('focus', () => combinedOpacityValue.select());

  function hexToRgb(hex) {
    const num = parseInt(hex.replace('#', ''), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  Object.entries(combinedColorInputs).forEach(([key, input]) => {
    input.addEventListener('input', () => {
      CHANNEL_COLORS[key] = hexToRgb(input.value);
      renderCombined();
    });
  });

  // ── Zoom modal (inspection only — no duplicated controls) ──
  const ZOOM_ORDER = [...CHANNEL_ORDER, 'combined'];

  Object.entries(channelCanvases).forEach(([key, canvas]) => {
    canvas.addEventListener('click', () => openZoom(key));
  });
  combinedCanvas.addEventListener('click', () => openZoom('combined'));

  function openZoom(key) {
    zoomedChannel = key;
    zoomTitle.textContent = CHANNEL_LABELS[key];
    updateZoomImage();
    resetZoomTransform();
    zoomModal.classList.remove('hidden');
  }
  function closeZoom() {
    zoomModal.classList.add('hidden');
    zoomedChannel = null;
  }
  function navigateZoom(direction) {
    if (!zoomedChannel) return;
    const idx = ZOOM_ORDER.indexOf(zoomedChannel);
    const nextIdx = (idx + direction + ZOOM_ORDER.length) % ZOOM_ORDER.length;
    openZoom(ZOOM_ORDER[nextIdx]);
  }
  function updateZoomImage() {
    if (!zoomedChannel) return;
    const sourceCanvas = zoomedChannel === 'combined' ? combinedCanvas : channelCanvases[zoomedChannel];
    zoomImage.src = sourceCanvas.toDataURL('image/png');
  }
  function resetZoomTransform() {
    zoomScale = 1; zoomPanX = 0; zoomPanY = 0;
    applyZoomTransform();
  }
  function applyZoomTransform() {
    zoomImage.style.transform = `translate(${zoomPanX}px, ${zoomPanY}px) scale(${zoomScale})`;
  }

  zoomClose.addEventListener('click', closeZoom);
  zoomModal.addEventListener('click', e => { if (e.target === zoomModal) closeZoom(); });
  zoomPrev.addEventListener('click', () => navigateZoom(-1));
  zoomNext.addEventListener('click', () => navigateZoom(1));
  document.addEventListener('keydown', e => {
    if (zoomModal.classList.contains('hidden')) return;
    if (e.key === 'Escape') { closeZoom(); return; }
    if (document.activeElement && (document.activeElement.type === 'range' || document.activeElement.type === 'number')) return;
    if (e.key === 'ArrowLeft') navigateZoom(-1);
    else if (e.key === 'ArrowRight') navigateZoom(1);
  });

  const MIN_ZOOM = 1, MAX_ZOOM = 6;
  zoomViewport.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    zoomScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomScale + delta * zoomScale));
    if (zoomScale === 1) { zoomPanX = 0; zoomPanY = 0; }
    applyZoomTransform();
  }, { passive: false });
  zoomViewport.addEventListener('dblclick', () => resetZoomTransform());
  zoomViewport.addEventListener('mousedown', e => {
    if (zoomScale <= 1) return;
    isPanning = true;
    zoomViewport.classList.add('dragging');
    panDragStartX = e.clientX; panDragStartY = e.clientY;
    panStartX = zoomPanX; panStartY = zoomPanY;
  });
  window.addEventListener('mousemove', e => {
    if (!isPanning) return;
    zoomPanX = panStartX + (e.clientX - panDragStartX);
    zoomPanY = panStartY + (e.clientY - panDragStartY);
    applyZoomTransform();
  });
  window.addEventListener('mouseup', () => {
    isPanning = false;
    zoomViewport.classList.remove('dragging');
  });

  // ── Export: PNG / SVG / DXF ────────────────────────────────
  function updateExportButtonsState() {
    const disableSvg = renderMode === 'continuous';
    const disableDxf = renderMode === 'continuous' || renderMode === 'microprint';
    document.querySelectorAll('.download-btn[data-format="svg"]').forEach(btn => {
      btn.disabled = disableSvg;
      btn.title = disableSvg ? 'Switch to Single Line, Hatch Lines, or Microprint to export vector strokes' : '';
    });
    document.querySelectorAll('.download-btn[data-format="dxf"]').forEach(btn => {
      btn.disabled = disableDxf;
      btn.title = disableDxf
        ? (renderMode === 'microprint' ? 'DXF export isn\'t available for Microprint text' : 'Switch to Single Line or Hatch Lines to export vector strokes')
        : '';
    });
  }
  updateExportButtonsState();

  function round2(n) { return Math.round(n * 100) / 100; }

  function buildLineSVG(strokes, width, height, weight) {
    let polylines = '';
    for (const s of strokes) {
      if (s.length < 2) continue;
      const pts = s.map(p => round2(p[0]) + ',' + round2(p[1])).join(' ');
      polylines += `<polyline points="${pts}"/>`;
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
      `<g fill="none" stroke="#000000" stroke-width="${round2(weight)}" stroke-linecap="round" stroke-linejoin="round">${polylines}</g></svg>`;
  }

  function buildDotSVG(points, radius, width, height) {
    let circles = '';
    for (const [x, y] of points) {
      circles += `<circle cx="${round2(x)}" cy="${round2(y)}" r="${round2(radius)}"/>`;
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
      `<g fill="#000000">${circles}</g></svg>`;
  }

  function buildMicroprintSVG(paths, text, fontSizePx, spacingMult, width, height) {
    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    mctx.font = `${fontSizePx}px monospace`;
    const charWidthCache = {};

    let textEls = '';
    for (const path of paths) {
      const placements = walkPathForText(path, text, spacingMult, charWidthCache, mctx);
      for (const p of placements) {
        const deg = round2(p.angle * 180 / Math.PI);
        textEls += `<text x="0" y="0" transform="translate(${round2(p.x)},${round2(p.y)}) rotate(${deg})">${escapeXML(p.char)}</text>`;
      }
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
      `<g font-family="monospace" font-size="${fontSizePx}" fill="#000000" text-anchor="middle" dominant-baseline="middle">${textEls}</g></svg>`;
  }

  // DXF R12 (AC1009) — legacy POLYLINE/VERTEX/SEQEND entities, the most
  // universally compatible dialect for handing geometry to CAD/plotters.
  function buildDXF(strokes, height) {
    const L = [];
    const w = (code, val) => { L.push(String(code), String(val)); };

    w(0, 'SECTION'); w(2, 'HEADER');
    w(9, '$ACADVER'); w(1, 'AC1009');
    w(0, 'ENDSEC');

    w(0, 'SECTION'); w(2, 'TABLES');
    w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 1);
    w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, '0.0');
    w(0, 'ENDTAB');
    w(0, 'TABLE'); w(2, 'LAYER'); w(70, 1);
    w(0, 'LAYER'); w(2, '0'); w(70, 0); w(62, 7); w(6, 'CONTINUOUS');
    w(0, 'ENDTAB');
    w(0, 'ENDSEC');

    w(0, 'SECTION'); w(2, 'ENTITIES');
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      w(0, 'POLYLINE');
      w(8, '0');
      w(66, 1);
      w(70, 0);
      for (const [x, y] of stroke) {
        w(0, 'VERTEX');
        w(8, '0');
        w(10, x.toFixed(4));
        w(20, (height - y).toFixed(4));
      }
      w(0, 'SEQEND');
    }
    w(0, 'ENDSEC');
    w(0, 'EOF');

    return L.join('\n');
  }

  function buildDotDXF(points, radius, height) {
    const L = [];
    const w = (code, val) => { L.push(String(code), String(val)); };

    w(0, 'SECTION'); w(2, 'HEADER');
    w(9, '$ACADVER'); w(1, 'AC1009');
    w(0, 'ENDSEC');

    w(0, 'SECTION'); w(2, 'TABLES');
    w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 1);
    w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, '0.0');
    w(0, 'ENDTAB');
    w(0, 'TABLE'); w(2, 'LAYER'); w(70, 1);
    w(0, 'LAYER'); w(2, '0'); w(70, 0); w(62, 7); w(6, 'CONTINUOUS');
    w(0, 'ENDTAB');
    w(0, 'ENDSEC');

    w(0, 'SECTION'); w(2, 'ENTITIES');
    for (const [x, y] of points) {
      w(0, 'CIRCLE');
      w(8, '0');
      w(10, x.toFixed(4));
      w(20, (height - y).toFixed(4));
      w(30, '0.0');
      w(40, radius.toFixed(4));
    }
    w(0, 'ENDSEC');
    w(0, 'EOF');

    return L.join('\n');
  }

  function buildDownloadFilename(channel, ext) {
    return `${CHANNEL_FILE_NAMES[channel]}-${sourceFileName}-${renderMode}.${ext}`;
  }

  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.channel-card');
      const channel = card.dataset.channel;
      const format = btn.dataset.format;
      if (format === 'png') downloadPNG(channel);
      else if (format === 'svg') downloadSVG(channel);
      else if (format === 'dxf') downloadDXF(channel);
    });
  });

  function downloadPNG(channel) {
    const canvas = channelCanvases[channel];
    const link = document.createElement('a');
    link.download = buildDownloadFilename(channel, 'png');
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function downloadSVG(channel) {
    if (!channelState || renderMode === 'continuous') return;
    const { width, height } = channelState;
    const data = channelStrokes[channel];
    let svg;
    if (data.kind === 'dots') {
      svg = buildDotSVG(data.items, data.dotRadius, width, height);
    } else if (renderMode === 'microprint') {
      const text = (microprintTextInput.value || '').trim();
      const fontSizePx = Number(charSizeSlider.value);
      const spacingMult = Number(charSpacingSlider.value) / 100;
      svg = buildMicroprintSVG(data.items, text, fontSizePx, spacingMult, width, height);
    } else {
      const weight = Number(weightSlider.value) / 10;
      svg = buildLineSVG(data.items, width, height, weight);
    }
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = buildDownloadFilename(channel, 'svg');
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadDXF(channel) {
    if (!channelState || renderMode === 'continuous' || renderMode === 'microprint') return;
    const { height } = channelState;
    const data = channelStrokes[channel];
    const dxf = data.kind === 'dots' ? buildDotDXF(data.items, data.dotRadius, height) : buildDXF(data.items, height);
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = buildDownloadFilename(channel, 'dxf');
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }
})();
