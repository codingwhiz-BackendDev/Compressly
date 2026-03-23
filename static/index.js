 let currentFile = null;
    let currentTargetKb = 0;
    let compressedDataUrl = null;
    let compressedExt = 'jpg';
    let batchFiles = [];
    let batchResults = [];

    const PRESETS = {
      none: { width: 0, height: 0, targetKb: 0, format: 'auto' },
      waec_jamb: { width: 150, height: 200, targetKb: 20, format: 'jpg', quality: 85 },
      university: { width: 300, height: 400, targetKb: 50, format: 'jpg', quality: 85 },
      job: { width: 200, height: 200, targetKb: 100, format: 'jpg', quality: 90 },
    };
 
    function switchTab(tab) {
      ['single', 'batch'].forEach(t => {
        document.getElementById(`panel-${t}`).classList.toggle('hidden', t !== tab);
        document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
      });
    }

    // ── Drag & Drop ────────────────────────────────────────────
    function initDrop(zone, onFiles) {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
      zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('dragover');
        onFiles(e.dataTransfer.files);
      });
    }
    initDrop(document.getElementById('dropZone'), handleFileSelect);
    initDrop(document.getElementById('batchDropZone'), handleBatchSelect);

    // ── File Select ────────────────────────────────────────────
    function handleFileSelect(files) {
      if (!files || !files[0]) return;
      currentFile = files[0];
      showState('loading');
      setTimeout(() => compressSingle(), 100);
    }

    // ── Presets ────────────────────────────────────────────────
    function applyPreset(name) {
      document.querySelectorAll('.preset-pill').forEach(el => el.classList.remove('active'));
      document.getElementById(`preset-${name}`).classList.add('active');
      const p = PRESETS[name] || PRESETS.none;
      if (p.width) document.getElementById('resizeW').value = p.width;
      if (p.height) document.getElementById('resizeH').value = p.height;
      if (!p.width) { document.getElementById('resizeW').value = ''; document.getElementById('resizeH').value = ''; }
      if (p.targetKb) setTargetSize(p.targetKb);
      else setTargetSize(0);
      if (p.format && p.format !== 'auto') document.getElementById('formatSelect').value = p.format;
      else document.getElementById('formatSelect').value = 'auto';
      if (p.quality) { document.getElementById('qualitySlider').value = p.quality; document.getElementById('qualityVal').textContent = p.quality + '%'; }
    }

    // ── Target Size ────────────────────────────────────────────
    function setTargetSize(kb, custom = false) {
      currentTargetKb = kb;
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      const ids = { 0: 'sz-0', 20: 'sz-20', 50: 'sz-50', 100: 'sz-100' };
      if (ids[kb] && !custom) document.getElementById(ids[kb])?.classList.add('active');
      if (!custom) document.getElementById('customSizeInput').value = kb || '';
    }

    // ── UI State ───────────────────────────────────────────────
    function showState(s) {
      document.getElementById('emptyState').style.display = s === 'empty' ? 'flex' : 'none';
      document.getElementById('loadingState').style.display = s === 'loading' ? 'flex' : 'none';
      document.getElementById('resultsState').classList.toggle('hidden', s !== 'results');
      if (s === 'loading') animateProgress();
    }

    let progressInterval;
    function animateProgress() {
      let v = 0;
      const bar = document.getElementById('loadProgress');
      clearInterval(progressInterval);
      progressInterval = setInterval(() => {
        v = Math.min(v + Math.random() * 15, 90);
        bar.style.width = v + '%';
      }, 200);
    }
    function finishProgress() {
      clearInterval(progressInterval);
      document.getElementById('loadProgress').style.width = '100%';
    }

    // ── Compress Single ────────────────────────────────────────
    async function compressSingle() {
      if (!currentFile) { alert('Please upload an image first.'); return; }
      showState('loading');

      const quality = +document.getElementById('qualitySlider').value;
      const targetKb = currentTargetKb || (+document.getElementById('customSizeInput').value || 0);
      const width = +document.getElementById('resizeW').value || 0;
      const height = +document.getElementById('resizeH').value || 0;
      const format = document.getElementById('formatSelect').value;
      const prop = document.getElementById('proportional').checked;

      try {
        const result = await compressInBrowser(currentFile, { quality, targetKb, width, height, format, proportional: prop });
        finishProgress();
        setTimeout(() => showResults(result, currentFile), 300);
      } catch (err) {
        finishProgress();
        alert('Compression failed: ' + err.message);
        showState('empty');
      }
    }

    // ── Browser Compression (Canvas API) ──────────────────────
    async function compressInBrowser(file, opts) {
      const { quality = 85, targetKb = 0, width = 0, height = 0, format = 'auto', proportional = true } = opts;

      return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          try {
            // Determine output mime
            const origExt = file.name.split('.').pop().toLowerCase();
            let mime;
            if (format === 'jpg') mime = 'image/jpeg';
            else if (format === 'png') mime = 'image/png';
            else if (format === 'webp') mime = 'image/webp';
            else mime = origExt === 'png' ? 'image/png' : origExt === 'webp' ? 'image/webp' : 'image/jpeg';
            const ext = mime.split('/')[1].replace('jpeg', 'jpg');

            // Resize
            let tw = img.width, th = img.height;
            if (width && height) {
              if (proportional) {
                const r = Math.min(width / tw, height / th);
                tw = Math.round(tw * r); th = Math.round(th * r);
              } else { tw = width; th = height; }
            } else if (width) { th = Math.round(th * width / tw); tw = width; }
            else if (height) { tw = Math.round(tw * height / th); th = height; }

            const canvas = document.createElement('canvas');
            canvas.width = tw; canvas.height = th;
            const ctx = canvas.getContext('2d');
            if (mime === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, tw, th); }
            ctx.drawImage(img, 0, 0, tw, th);

            if (targetKb > 0) {
              // Binary search quality
              binarySearchQuality(canvas, mime, targetKb * 1024).then(({ dataUrl, size, finalQ }) => {
                resolve({ dataUrl, originalSize: file.size, compressedSize: size, mime, ext, width: tw, height: th, reduction: +(((file.size - size) / file.size) * 100).toFixed(1) });
              });
            } else {
              // Direct quality
              const q = mime === 'image/png' ? undefined : quality / 100;
              const dataUrl = q !== undefined ? canvas.toDataURL(mime, q) : canvas.toDataURL(mime);
              const size = dataUrlToBytes(dataUrl);
              resolve({ dataUrl, originalSize: file.size, compressedSize: size, mime, ext, width: tw, height: th, reduction: +(((file.size - size) / file.size) * 100).toFixed(1) });
            }
          } catch (e) { reject(e); }
        };
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = url;
      });
    }

    async function binarySearchQuality(canvas, mime, targetBytes) {
      if (mime === 'image/png') {
        // PNG: scale down canvas instead
        let scale = 1, best = canvas.toDataURL('image/png'), bestSize = dataUrlToBytes(best);
        while (bestSize > targetBytes && scale > 0.05) {
          scale *= 0.85;
          const c2 = document.createElement('canvas');
          c2.width = Math.max(1, Math.round(canvas.width * scale));
          c2.height = Math.max(1, Math.round(canvas.height * scale));
          c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
          best = c2.toDataURL('image/png');
          bestSize = dataUrlToBytes(best);
        }
        return { dataUrl: best, size: bestSize };
      }
      let lo = 0.05, hi = 1, bestUrl = null, bestSize = 0;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        const url = canvas.toDataURL(mime, mid);
        const sz = dataUrlToBytes(url);
        if (sz <= targetBytes) { bestUrl = url; bestSize = sz; lo = mid; }
        else hi = mid;
        if (hi - lo < 0.005) break;
      }
      if (!bestUrl) { // Still too big — scale canvas
        let scale = 0.9;
        while (scale > 0.05) {
          const c2 = document.createElement('canvas');
          c2.width = Math.max(1, Math.round(canvas.width * scale));
          c2.height = Math.max(1, Math.round(canvas.height * scale));
          c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
          const url = c2.toDataURL(mime, 0.6);
          const sz = dataUrlToBytes(url);
          if (sz <= targetBytes) { bestUrl = url; bestSize = sz; break; }
          scale -= 0.1;
        }
        if (!bestUrl) { bestUrl = canvas.toDataURL(mime, 0.1); bestSize = dataUrlToBytes(bestUrl); }
      }
      return { dataUrl: bestUrl, size: bestSize };
    }

    function dataUrlToBytes(dataUrl) {
      const b64 = dataUrl.split(',')[1];
      return Math.round(b64.length * 3 / 4);
    }

    // ── Show Results ───────────────────────────────────────────
    function showResults(result, originalFile) {
      compressedDataUrl = result.dataUrl;
      compressedExt = result.ext;

      document.getElementById('statOriginal').textContent = formatSize(result.originalSize);
      document.getElementById('statCompressed').textContent = formatSize(result.compressedSize);
      document.getElementById('statReduction').textContent = result.reduction + '%';
      document.getElementById('dimBadge').textContent = result.width + '×' + result.height + 'px';

      // Compare images
      const origUrl = URL.createObjectURL(originalFile);
      document.getElementById('compareOrigImg').src = origUrl;
      document.getElementById('compareCompImg').src = result.dataUrl;

      // Download
      const name = originalFile.name.replace(/\.[^.]+$/, '') + '_compressed.' + result.ext;
      document.getElementById('dlFilename').textContent = name;
      document.getElementById('dlInfo').textContent = formatSize(result.compressedSize) + ' • ' + result.mime;
      const dlBtn = document.getElementById('downloadBtn');
      dlBtn.href = result.dataUrl;
      dlBtn.download = name;

      showState('results');
      initCompareSlider();
    }

    function formatSize(bytes) {
      if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
      return bytes + ' B';
    }

    function resetTool() {
      currentFile = null; compressedDataUrl = null;
      document.getElementById('fileInput').value = '';
      showState('empty');
    }

    // ── Compare Slider ─────────────────────────────────────────
    function initCompareSlider() {
      const wrap = document.getElementById('compareWrap');
      const divider = document.getElementById('compareDivider');
      const handle = document.getElementById('compareHandle');
      const after = document.getElementById('compareAfterEl');
      let dragging = false;

      function setPos(x) {
        const rect = wrap.getBoundingClientRect();
        const pct = Math.max(5, Math.min(95, (x - rect.left) / rect.width * 100));
        divider.style.left = pct + '%';
        handle.style.left = pct + '%';
        after.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      }
      setPos(wrap.getBoundingClientRect().left + wrap.getBoundingClientRect().width * 0.5);

      wrap.addEventListener('mousedown', e => { dragging = true; setPos(e.clientX); });
      window.addEventListener('mousemove', e => { if (dragging) setPos(e.clientX); });
      window.addEventListener('mouseup', () => dragging = false);
      wrap.addEventListener('touchstart', e => { dragging = true; setPos(e.touches[0].clientX); });
      window.addEventListener('touchmove', e => { if (dragging) setPos(e.touches[0].clientX); });
      window.addEventListener('touchend', () => dragging = false);
    }

    // ── Batch ──────────────────────────────────────────────────
    function handleBatchSelect(files) {
      batchFiles = Array.from(files).slice(0, 20);
      renderBatchList();
      document.getElementById('batchCount').textContent = batchFiles.length + ' file' + (batchFiles.length !== 1 ? 's' : '');
    }

    function renderBatchList() {
      const list = document.getElementById('batchList');
      if (!batchFiles.length) {
        list.innerHTML = '<div class="text-center py-12 text-slate-600"><p class="text-4xl mb-3">🗂</p><p class="text-sm">No files queued yet</p></div>';
        return;
      }
      list.innerHTML = batchFiles.map((f, i) => `
    <div class="batch-item" id="bitem-${i}">
      <div class="w-10 h-10 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
        <img src="{% static '${URL.createObjectURL(f)}' %}" class="w-full h-full object-cover"/>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-white truncate">${f.name}</p>
        <p class="text-xs text-slate-500">${formatSize(f.size)}</p>
      </div>
      <div class="text-xs text-slate-500" id="bitem-status-${i}">Queued</div>
    </div>
  `).join('');
    }

    async function runBatch() {
      if (!batchFiles.length) { alert('No files selected.'); return; }
      batchResults = [];
      const preset = document.getElementById('batchPreset').value;
      const quality = +document.getElementById('batchQualSlider').value;
      const targetKb = +document.getElementById('batchTargetKb').value || 100;

      const progress = document.getElementById('batchOverallProgress');
      const progressBar = document.getElementById('batchProgressBar');
      const progressLabel = document.getElementById('batchProgressLabel');
      const progressPct = document.getElementById('batchProgressPct');
      progress.classList.remove('hidden');

      const PRESET_OPTS = {
        waec_jamb: { width: 150, height: 200, targetKb: 20, format: 'jpg', quality: 85 },
        university: { width: 300, height: 400, targetKb: 50, format: 'jpg', quality: 85 },
        job: { width: 200, height: 200, targetKb: 100, format: 'jpg', quality: 90 },
      };
      const opts = PRESET_OPTS[preset] || { quality, targetKb, width: 0, height: 0, format: 'auto' };

      for (let i = 0; i < batchFiles.length; i++) {
        const pct = Math.round((i / batchFiles.length) * 100);
        progressBar.style.width = pct + '%';
        progressPct.textContent = pct + '%';
        progressLabel.textContent = `Processing ${i + 1} of ${batchFiles.length}…`;
        const el = document.getElementById(`bitem-${i}`);
        const statusEl = document.getElementById(`bitem-status-${i}`);
        if (statusEl) statusEl.textContent = '⏳ Processing…';

        try {
          const result = await compressInBrowser(batchFiles[i], opts);
          batchResults.push({ name: batchFiles[i].name, result });
          if (el) el.classList.add('done');
          if (statusEl) statusEl.innerHTML = `<span class="text-green-400">✓ ${formatSize(result.compressedSize)}</span>`;
        } catch (e) {
          if (el) el.classList.add('error');
          if (statusEl) statusEl.innerHTML = `<span class="text-red-400">✗ Error</span>`;
        }
      }

      progressBar.style.width = '100%';
      progressPct.textContent = '100%';
      progressLabel.textContent = `Done! ${batchResults.length} compressed.`;
      document.getElementById('batchDownloadAll').classList.remove('hidden');
      document.getElementById('batchCount').textContent = batchResults.length + ' compressed';
    }

    async function downloadAllBatch() {
      if (!batchResults.length) return;
      const zip = new JSZip();
      batchResults.forEach(({ name, result }) => {
        const base64 = result.dataUrl.split(',')[1];
        const outName = name.replace(/\.[^.]+$/, '_compressed.' + result.ext);
        zip.file(outName, base64, { base64: true });
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'unicompress_batch.zip';
      a.click();
      URL.revokeObjectURL(url);
    }

    // ── Init ───────────────────────────────────────────────────
    document.getElementById('preset-none').classList.add('active');
    document.getElementById('sz-0').classList.add('active');
    showState('empty');