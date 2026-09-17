/* =====================================================================
   app.js — perekat: tabel, impor, pratinjau, cetak.
   ===================================================================== */
(function (window, document) {
  'use strict';

  var LG = window.LG, D = LG.data, T = LG.tpl;
  var PAPERS = T.PAPERS;

  /* ---------------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function el(sel, root) { return (root || document).querySelector(sel); }
  function els(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(node, ev, fn) { if (node) node.addEventListener(ev, fn, false); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function num(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : dflt; }

  /* ================================ STATE ================================ */
  var DEF = {
    tpl: 'rak100',
    paper: 'a4', orient: 'portrait', paperW: 100, paperH: 150,
    lock: true, cellW: 100, cellH: 25,
    cols: 2, rows: 10, margin: 4, gap: 2,
    scale: 100, copies: 1,
    qr: true, qrPattern: '{sku}|{kodeDus}|{qty}|{lokasi}',
    barcode: false, blankLokasi: false, meta: false, cut: false, saveInk: false
  };

  var rows = [];
  var opts = {};
  var filters = { q: '', zona: '', status: '', onlyChecked: false };
  var zoom = 0;                 /* 0 = ikuti lebar kanvas */
  var pendingImport = null;     /* {table, label} saat dialog pemetaan terbuka */
  var saveTimer = null, previewTimer = null;
  var PREVIEW_MAX = 30;         /* lembar yang digambar di pratinjau */

  for (var dk in DEF) if (DEF.hasOwnProperty(dk)) opts[dk] = DEF[dk];

  /* ================================ TOAST ================================ */
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* =============================== SIMPAN =============================== */
  function state() { return { rows: rows, opts: opts, at: Date.now() }; }

  function saveSoon() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 400);
  }
  function doSave() {
    var ok = D.save(state());
    var d = new Date();
    $('saveNote').textContent = ok
      ? 'Tersimpan ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
      : 'Tidak bisa menyimpan di browser ini';
  }
  function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  function restoreState() {
    var s = D.load();
    if (!s) return false;
    if (s.opts) for (var k in DEF) if (DEF.hasOwnProperty(k) && s.opts[k] !== undefined) opts[k] = s.opts[k];
    if (s.rows && s.rows.length) {
      rows = [];
      for (var i = 0; i < s.rows.length; i++) {
        var b = D.blank(), src = s.rows[i], c;
        for (c in b) if (b.hasOwnProperty(c) && src[c] !== undefined) b[c] = src[c];
        b._on = src._on !== false;
        rows.push(b);
      }
    }
    return true;
  }

  /* ============================== UKURAN ============================== */
  function paperSize() {
    var p = PAPERS[opts.paper] || PAPERS.a4;
    var w = opts.paper === 'custom' ? num(opts.paperW, 100) : p.w;
    var h = opts.paper === 'custom' ? num(opts.paperH, 150) : p.h;
    if (opts.orient === 'landscape') { var t = w; w = h; h = t; }
    return { w: w, h: h };
  }

  function cellSize() {
    if (opts.lock) return { w: num(opts.cellW, 100), h: num(opts.cellH, 25) };
    var ps = paperSize();
    var w = (ps.w - 2 * opts.margin - (opts.cols - 1) * opts.gap) / opts.cols;
    var h = (ps.h - 2 * opts.margin - (opts.rows - 1) * opts.gap) / opts.rows;
    return { w: Math.max(5, r2(w)), h: Math.max(5, r2(h)) };
  }

  /* Margin dipakai sebagai batas atas. Kalau barisan label lebih lebar
     dari sisa kertas, padding mengecil sendiri supaya label tetap di
     tengah dan tidak terpotong — inilah yang membuat Dus 100 × 250 mm
     (2 × 100 + 4 = 204 mm) tetap muat pas di A4 210 mm. */
  function layout() {
    var ps = paperSize(), cs = cellSize();
    var gw = opts.cols * cs.w + (opts.cols - 1) * opts.gap;
    var gh = opts.rows * cs.h + (opts.rows - 1) * opts.gap;
    return {
      paper: ps, cell: cs, gridW: gw, gridH: gh,
      padX: Math.max(0, Math.min(opts.margin, (ps.w - gw) / 2)),
      padY: Math.max(0, Math.min(opts.margin, (ps.h - gh) / 2)),
      overflow: (gw > ps.w + 0.05) || (gh > ps.h + 0.05)
    };
  }

  function autoFit() {
    var ps = paperSize(), cs = cellSize();
    var c = Math.floor((ps.w - 2 * opts.margin + opts.gap) / (cs.w + opts.gap));
    var r = Math.floor((ps.h - 2 * opts.margin + opts.gap) / (cs.h + opts.gap));
    opts.cols = Math.max(1, Math.min(20, c));
    opts.rows = Math.max(1, Math.min(40, r));
  }

  /* ============================ TABEL DATA ============================ */
  function buildHead() {
    var h = '<tr><th class="col-pick"><input type="checkbox" id="chkAll" aria-label="Centang semua"></th><th class="col-act"></th>';
    for (var i = 0; i < D.COLUMNS.length; i++) {
      h += '<th style="min-width:' + D.COLUMNS[i].w + 'px">' + T.esc(D.COLUMNS[i].t) + '</th>';
    }
    h += '<th class="col-act"></th></tr>';
    $('gridHead').innerHTML = h;
    on($('chkAll'), 'change', function () {
      var v = this.checked, list = visibleRows();
      for (var i = 0; i < list.length; i++) rows[list[i]]._on = v;
      renderTable(); schedulePreview(); saveSoon();
    });
  }

  function matches(r) {
    if (filters.onlyChecked && !r._on) return false;
    if (filters.zona && String(r.zona) !== filters.zona) return false;
    if (filters.status && String(r.status) !== filters.status) return false;
    if (filters.q) {
      var q = filters.q.toLowerCase(), hit = false;
      for (var i = 0; i < D.COLUMNS.length; i++) {
        if (String(r[D.COLUMNS[i].k] || '').toLowerCase().indexOf(q) >= 0) { hit = true; break; }
      }
      if (!hit) return false;
    }
    return true;
  }

  function visibleRows() {
    var out = [];
    for (var i = 0; i < rows.length; i++) if (matches(rows[i])) out.push(i);
    return out;
  }

  function renderTable() {
    var idx = visibleRows(), body = [], i, j, r, c, v;

    for (i = 0; i < idx.length; i++) {
      r = rows[idx[i]];
      body.push('<tr data-i="' + idx[i] + '"' + (r._on ? '' : ' class="is-off"') + '>');
      body.push('<td class="col-pick"><input type="checkbox" data-act="on"' + (r._on ? ' checked' : '') +
                ' aria-label="Cetak baris ini"></td>');
      body.push('<td class="rownum">' + (idx[i] + 1) + '</td>');
      for (j = 0; j < D.COLUMNS.length; j++) {
        c = D.COLUMNS[j];
        v = c.kind === 'date' ? D.fmtDate(r[c.k]) : (r[c.k] == null ? '' : r[c.k]);
        body.push('<td class="' + (c.cls || '') + '"><input type="text" data-k="' + c.k + '" value="' +
                  T.esc(v) + '"' + (c.list ? ' list="' + c.list + '"' : '') +
                  ' aria-label="' + T.esc(c.t) + '"></td>');
      }
      body.push('<td class="col-act">' +
                '<button type="button" class="rowact" data-act="dup" title="Gandakan baris">⧉</button>' +
                '<button type="button" class="rowact del" data-act="del" title="Hapus baris">✕</button></td>');
      body.push('</tr>');
    }

    $('gridBody').innerHTML = body.join('');

    var isEmpty = rows.length === 0;
    $('emptyState').hidden = !isEmpty;
    $('tableWrap').hidden = isEmpty;

    var onCount = 0;
    for (i = 0; i < rows.length; i++) if (rows[i]._on) onCount++;
    $('pillCount').textContent = idx.length === rows.length
      ? rows.length + ' baris'
      : idx.length + ' dari ' + rows.length + ' baris';
    $('statLeft').textContent = rows.length + ' baris · ' + onCount + ' dicentang untuk dicetak';

    var all = $('chkAll');
    if (all) all.checked = idx.length > 0 && idx.every(function (k) { return rows[k]._on; });

    refreshFilterOptions();
  }

  function refreshFilterOptions() {
    fillSelect($('fZona'), uniq('zona'), filters.zona, 'Semua zona');
    fillSelect($('fStatus'), uniq('status'), filters.status, 'Semua status');
  }
  function uniq(k) {
    var seen = {}, out = [], i, v;
    for (i = 0; i < rows.length; i++) {
      v = String(rows[i][k] || '').trim();
      if (v && !seen[v]) { seen[v] = 1; out.push(v); }
    }
    return out.sort();
  }
  function fillSelect(sel, list, cur, allLabel) {
    if (!sel) return;
    var h = '<option value="">' + T.esc(allLabel) + '</option>', i;
    for (i = 0; i < list.length; i++) {
      h += '<option value="' + T.esc(list[i]) + '"' + (list[i] === cur ? ' selected' : '') + '>' +
           T.esc(list[i]) + '</option>';
    }
    sel.innerHTML = h;
    sel.value = cur || '';
  }

  /* ---- perubahan isi sel ---- */
  function bindTable() {
    var body = $('gridBody');

    on(body, 'input', function (e) {
      var inp = e.target;
      if (!inp.getAttribute || !inp.getAttribute('data-k')) return;
      var tr = inp.parentNode.parentNode, i = parseInt(tr.getAttribute('data-i'), 10);
      var k = inp.getAttribute('data-k');
      if (!rows[i]) return;
      if (k === 'tanggal') return;                 /* diproses saat selesai mengetik */
      rows[i][k] = inp.value;
      saveSoon(); schedulePreview();
    });

    on(body, 'change', function (e) {
      var t = e.target, tr, i;
      if (t.getAttribute && t.getAttribute('data-act') === 'on') {
        tr = t.parentNode.parentNode; i = parseInt(tr.getAttribute('data-i'), 10);
        if (rows[i]) { rows[i]._on = t.checked; tr.className = t.checked ? '' : 'is-off'; }
        updateAllCheck(); saveSoon(); schedulePreview();
        return;
      }
      if (t.getAttribute && t.getAttribute('data-k') === 'tanggal') {
        tr = t.parentNode.parentNode; i = parseInt(tr.getAttribute('data-i'), 10);
        if (!rows[i]) return;
        var iso = D.parseDate(t.value);
        rows[i].tanggal = iso;
        t.value = D.fmtDate(iso);
        saveSoon(); schedulePreview();
      }
    });

    on(body, 'click', function (e) {
      var b = e.target;
      if (!b.getAttribute) return;
      var act = b.getAttribute('data-act');
      if (act !== 'dup' && act !== 'del') return;
      var tr = b.parentNode.parentNode, i = parseInt(tr.getAttribute('data-i'), 10);
      if (!rows[i]) return;
      if (act === 'dup') {
        var c = {}, k;
        for (k in rows[i]) if (rows[i].hasOwnProperty(k)) c[k] = rows[i][k];
        c.labelId = '';
        rows.splice(i + 1, 0, c);
        D.fillMissingIds(rows);
      } else {
        rows.splice(i, 1);
      }
      renderTable(); schedulePreview(); doSave();
    });
  }

  function updateAllCheck() {
    var idx = visibleRows(), all = $('chkAll');
    if (all) all.checked = idx.length > 0 && idx.every(function (k) { return rows[k]._on; });
    var onCount = 0;
    for (var i = 0; i < rows.length; i++) if (rows[i]._on) onCount++;
    $('statLeft').textContent = rows.length + ' baris · ' + onCount + ' dicentang untuk dicetak';
  }

  /* ============================ PRATINJAU ============================ */
  function printableRows() {
    var out = [], i;
    for (i = 0; i < rows.length; i++) if (rows[i]._on) out.push(rows[i]);
    return out;
  }

  function renderOpts() {
    var cs = cellSize();
    return {
      k: opts.scale / 100,
      cw: cs.w, ch: cs.h,
      qr: !!opts.qr, barcode: !!opts.barcode,
      blankLokasi: !!opts.blankLokasi, meta: !!opts.meta,
      qrPattern: opts.qrPattern
    };
  }

  /* Bangun HTML seluruh lembar. limit = jumlah lembar maksimum (0 = semua). */
  function buildSheets(limit) {
    var tpl = T.byKey(opts.tpl);
    var lay = layout();
    var o = renderOpts();
    var list = printableRows();
    var copies = Math.max(1, Math.min(50, parseInt(opts.copies, 10) || 1));
    var items = [], i, c;
    for (i = 0; i < list.length; i++) for (c = 0; c < copies; c++) items.push(list[i]);

    var per = Math.max(1, opts.cols * opts.rows);
    var pages = Math.ceil(items.length / per) || 0;
    var shown = limit ? Math.min(pages, limit) : pages;

    var sheetStyle = 'width:' + lay.paper.w + 'mm;height:' + lay.paper.h + 'mm;--k:' + o.k;
    var gridStyle = 'grid-template-columns:repeat(' + opts.cols + ',' + lay.cell.w + 'mm);' +
                    'grid-template-rows:repeat(' + opts.rows + ',' + lay.cell.h + 'mm);' +
                    'gap:' + opts.gap + 'mm;' +
                    'padding:' + lay.padY + 'mm ' + lay.padX + 'mm;';
    var cls = 'sheet' + (opts.cut ? ' cut' : '') + (opts.saveInk ? ' ink' : '');

    var out = [], p, n, row;
    for (p = 0; p < shown; p++) {
      out.push('<div class="' + cls + '" style="' + sheetStyle + '" data-page="Lembar ' + (p + 1) + ' / ' + pages + '">');
      out.push('<div class="sheet-grid" style="' + gridStyle + '">');
      for (n = 0; n < per; n++) {
        row = items[p * per + n];
        if (!row) break;
        out.push('<div class="lbl ' + tpl.cls + ' ' + T.zCls(row.zona) + ' ' + T.sCls(row.status) + '">' +
                 tpl.render(row, o) + '</div>');
      }
      out.push('</div></div>');
    }

    return { html: out.join(''), pages: pages, perPage: per, total: items.length, shown: shown, lay: lay };
  }

  function applyBarcodes(root) {
    if (!window.JsBarcode) return;
    var list = els('svg.bc[data-bc]', root), i, svg;
    for (i = 0; i < list.length; i++) {
      svg = list[i];
      try {
        window.JsBarcode(svg, svg.getAttribute('data-bc'), {
          format: 'CODE128', displayValue: false, margin: 0,
          width: 2, height: 60, background: 'transparent'
        });
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('class', 'bc');
      } catch (e) { /* kode tidak bisa dijadikan barcode: biarkan kosong */ }
    }
  }

  /* Huruf condensed tidak selalu ada di komputer gudang. Kalau font
     pengganti lebih lebar, teks besar bisa terpotong jadi "10…", jadi
     ukuran hurufnya dikecilkan sampai benar-benar muat.
     Semua pengukuran dikerjakan sekaligus, baru semua penulisan —
     supaya browser hanya menghitung tata letak beberapa kali, bukan
     sekali untuk tiap label. */
  function fitTexts(root) {
    var list = els('[data-fit]', root);
    if (!list.length) return;
    var sizes = [], i, pass, need, n, cw, sw;
    for (i = 0; i < list.length; i++) sizes.push(parseFloat(list[i].style.fontSize) || 0);
    for (pass = 0; pass < 3; pass++) {
      need = [];
      for (i = 0; i < list.length; i++) {
        n = list[i]; cw = n.clientWidth; sw = n.scrollWidth;
        if (cw > 0 && sw > cw + 0.5) need.push([i, cw / sw]);
      }
      if (!need.length) return;
      for (i = 0; i < need.length; i++) {
        var k = need[i][0];
        sizes[k] = Math.max(2, sizes[k] * need[i][1] * 0.985);
        list[k].style.fontSize = (Math.round(sizes[k] * 100) / 100) + 'mm';
      }
    }
  }

  function schedulePreview() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 120);
  }

  function renderPreview() {
    var res = buildSheets(PREVIEW_MAX);
    var stage = $('stage');
    stage.innerHTML = res.html;
    applyBarcodes(stage);
    fitTexts(stage);

    $('canvasEmpty').hidden = res.total > 0;
    $('cntLabel').textContent = res.total;
    $('cntPage').textContent = res.pages;
    $('cntPer').textContent = res.perPage;
    $('cntSize').textContent = res.lay.cell.w + ' × ' + res.lay.cell.h + ' mm · kertas ' +
                               res.lay.paper.w + ' × ' + res.lay.paper.h + ' mm';

    var warn = $('fitWarn');
    if (res.lay.overflow) {
      warn.hidden = false;
      warn.textContent = 'Label tidak muat di kertas: butuh ' + r2(res.lay.gridW) + ' × ' + r2(res.lay.gridH) +
                         ' mm, kertas hanya ' + res.lay.paper.w + ' × ' + res.lay.paper.h +
                         ' mm. Kurangi kolom, baris, atau ukuran label.';
    } else if (res.pages > res.shown) {
      warn.hidden = false;
      warn.textContent = 'Pratinjau menampilkan ' + res.shown + ' lembar pertama. Semua ' + res.pages +
                         ' lembar tetap ikut tercetak.';
    } else {
      warn.hidden = true;
    }

    setPageRule();
    applyZoom();
  }

  function setPageRule() {
    var ps = paperSize();
    $('pageStyle').textContent = '@page{size:' + ps.w + 'mm ' + ps.h + 'mm;margin:0}';
  }

  /* ---- zoom ---- */
  function fitZoom() {
    var box = $('canvasScroll'), stage = $('stage');
    var w = stage.scrollWidth;
    if (!w) return 1;
    var avail = box.clientWidth - 48;
    return Math.max(0.05, Math.min(1, avail / w));
  }

  function applyZoom() {
    var stage = $('stage'), sbox = $('stageBox');
    var z = zoom || fitZoom();
    stage.style.transform = 'scale(' + z + ')';
    sbox.style.width = Math.ceil(stage.scrollWidth * z) + 'px';
    sbox.style.height = Math.ceil(stage.scrollHeight * z) + 'px';
    $('lblZoom').textContent = Math.round(z * 100) + '%';
  }

  /* ============================== CETAK ============================== */
  var movedNodes = null;

  function moveToPaper(nodes) {
    var paper = $('paper');
    paper.innerHTML = '';
    movedNodes = nodes;
    for (var i = 0; i < nodes.length; i++) paper.appendChild(nodes[i]);
  }

  function restoreFromPaper() {
    var paper = $('paper'), stage = $('stage');
    if (movedNodes) {
      for (var i = 0; i < movedNodes.length; i++) stage.appendChild(movedNodes[i]);
      movedNodes = null;
    }
    paper.innerHTML = '';
  }

  function doPrint() {
    setPageRule();
    /* Untuk cetak, seluruh lembar dibangun — bukan hanya yang tampil di pratinjau. */
    var res = buildSheets(0);
    var holder = document.createElement('div');
    holder.innerHTML = res.html;
    var nodes = Array.prototype.slice.call(holder.children);
    applyBarcodes(holder);

    var paper = $('paper');
    paper.innerHTML = '';
    for (var i = 0; i < nodes.length; i++) paper.appendChild(nodes[i]);
    movedNodes = null;
    /* #paper hanya tampil saat mencetak. Untuk mengukur teks, kertas
       dimunculkan sebentar di luar layar supaya tidak berkedip. */
    paper.style.cssText = 'display:block;position:fixed;left:-20000px;top:0';
    fitTexts(paper);
    paper.style.cssText = '';

    window.print();
    setTimeout(function () { paper.innerHTML = ''; }, 500);
  }

  /* Ctrl+P: pindahkan lembar pratinjau ke #paper supaya hasilnya sama. */
  on(window, 'beforeprint', function () {
    var paper = $('paper');
    if (paper.firstChild) return;                 /* sudah disiapkan doPrint() */
    setPageRule();
    var stage = $('stage');
    moveToPaper(Array.prototype.slice.call(stage.children));
  });
  on(window, 'afterprint', function () { restoreFromPaper(); });

  /* ---- ringkasan sebelum cetak ---- */
  function showSummary() {
    var res = buildSheets(0), tpl = T.byKey(opts.tpl), ps = res.lay.paper;
    if (!res.total) { toast('Belum ada baris yang dicentang untuk dicetak.'); return; }
    var paperName = opts.paper === 'custom'
      ? ps.w + ' × ' + ps.h + ' mm (ukuran sendiri)'
      : (PAPERS[opts.paper] ? PAPERS[opts.paper].t : '') +
        (opts.orient === 'landscape' ? ' — mendatar' : '');

    $('sumBody').innerHTML =
      '<ul class="sumlist">' +
      '<li><span>Template</span><b>' + T.esc(tpl.nama) + '</b></li>' +
      '<li><span>Ukuran satu label</span><b>' + res.lay.cell.w + ' × ' + res.lay.cell.h + ' mm</b></li>' +
      '<li><span>Jumlah label</span><b>' + res.total + '</b></li>' +
      '<li><span>Label per lembar</span><b>' + res.perPage + '</b></li>' +
      '<li><span>Jumlah lembar</span><b>' + res.pages + '</b></li>' +
      '<li><span>Kertas di dialog printer</span><b>' + T.esc(paperName) + '</b></li>' +
      '</ul>' +
      '<div class="sumtip"><b>Sebelum menekan Print, pastikan:</b><ul>' +
      '<li>Margin: <b>None</b> / <b>Tidak ada</b></li>' +
      '<li>Skala: <b>100%</b> — bukan "Fit to page"</li>' +
      '<li><b>Background graphics</b> dicentang</li>' +
      '<li>Ukuran kertas sama dengan di atas</li>' +
      '</ul></div>';
    openModal('mSum');
  }

  /* ---- halaman kalibrasi ---- */
  function printCalibration() {
    var ps = paperSize(), i, ticks = '', rule = '';
    for (i = 10; i < 100; i += 10) {
      ticks += '<div class="tick h" style="top:' + i + 'mm;width:' + (i % 50 === 0 ? 8 : 4) + 'mm"></div>';
      ticks += '<div class="tick v" style="left:' + i + 'mm;height:' + (i % 50 === 0 ? 8 : 4) + 'mm"></div>';
    }
    for (i = 0; i <= 150; i += 5) {
      rule += '<div class="t" style="left:' + i + 'mm;height:' + (i % 10 === 0 ? 5 : 2.5) + 'mm"></div>';
      if (i % 10 === 0) rule += '<div class="n" style="left:' + i + 'mm">' + i + '</div>';
    }

    $('pageStyle').textContent = '@page{size:' + ps.w + 'mm ' + ps.h + 'mm;margin:0}';
    $('paper').innerHTML =
      '<div class="sheet" style="width:' + ps.w + 'mm;height:' + ps.h + 'mm">' +
      '<div class="calib">' +
      '<h1>Kalibrasi printer</h1>' +
      '<p>Cetak halaman ini, lalu ukur kotak dan penggaris di bawah dengan penggaris sungguhan. ' +
      'Kalau ukurannya sudah tepat, semua label juga akan tercetak dengan ukuran yang benar.</p>' +
      '<div class="calib-box">' + ticks + '<span class="lbltxt">100 × 100 mm</span></div>' +
      '<div class="calib-rule">' + rule + '</div>' +
      '<ol>' +
      '<li>Kotak di atas harus <b>tepat 100 mm × 100 mm</b> (10 cm × 10 cm).</li>' +
      '<li>Penggaris harus <b>tepat 150 mm</b> dari garis 0 sampai garis 150.</li>' +
      '<li>Kalau hasilnya lebih kecil: di dialog printer setel <b>Skala 100%</b>, bukan "Fit to page" atau "Shrink to fit".</li>' +
      '<li>Kalau tepinya terpotong: setel <b>Margin: None</b> dan centang <b>Background graphics</b>.</li>' +
      '<li>Kalau masih meleset, pastikan <b>ukuran kertas di printer</b> sama dengan ukuran kertas yang dipilih di aplikasi.</li>' +
      '</ol>' +
      '</div></div>';
    window.print();
    setTimeout(function () { $('paper').innerHTML = ''; setPageRule(); }, 500);
  }

  /* ============================== IMPOR ============================== */
  function handleFile(file) {
    if (!file) return;
    var name = (file.name || '').toLowerCase();

    if (/\.json$/.test(name)) { readJSON(file); return; }

    if (/\.(csv|txt)$/.test(name)) {
      var fr = new FileReader();
      fr.onload = function () {
        var matrix = D.parseDelimited(String(fr.result));
        openMapping(D.matrixToTable(matrix), file.name);
      };
      fr.onerror = function () { toast('File tidak bisa dibaca.'); };
      fr.readAsText(file);
      return;
    }

    if (typeof XLSX === 'undefined') {
      toast('Pustaka Excel tidak termuat. Pakai file CSV atau tempel dari Excel.');
      return;
    }
    var fr2 = new FileReader();
    fr2.onload = function () {
      try {
        var res = D.readWorkbook(fr2.result);
        openMapping(D.matrixToTable(res.matrix), file.name + ' — sheet "' + res.sheet + '"');
      } catch (e) {
        toast('File Excel tidak bisa dibaca: ' + (e && e.message ? e.message : 'format tidak dikenal'));
      }
    };
    fr2.onerror = function () { toast('File tidak bisa dibaca.'); };
    fr2.readAsArrayBuffer(file);
  }

  function readJSON(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var o = JSON.parse(String(fr.result));
        var list = o && o.rows ? o.rows : (o instanceof Array ? o : null);
        if (!list) { toast('Isi cadangan tidak dikenali.'); return; }
        rows = [];
        for (var i = 0; i < list.length; i++) {
          var b = D.blank(), k;
          for (k in b) if (b.hasOwnProperty(k) && list[i][k] !== undefined) b[k] = list[i][k];
          b._on = list[i]._on !== false;
          rows.push(b);
        }
        if (o.opts) for (var ok in DEF) if (DEF.hasOwnProperty(ok) && o.opts[ok] !== undefined) opts[ok] = o.opts[ok];
        D.fillMissingIds(rows);
        syncControls(); renderTable(); schedulePreview(); doSave();
        toast('Cadangan dipulihkan: ' + rows.length + ' baris.');
      } catch (e) { toast('Berkas cadangan rusak atau bukan .json yang benar.'); }
    };
    fr.readAsText(file);
  }

  /* ---- dialog pemetaan kolom ---- */
  function openMapping(table, label) {
    if (!table.headers.length || !table.body.length) {
      toast('Tidak menemukan baris data di file itu.');
      return;
    }
    pendingImport = table;
    var map = D.guessMapping(table.headers);
    var known = 0, i;
    for (i = 0; i < map.length; i++) if (map[i]) known++;

    $('mapSummary').textContent = label + ' — ' + table.body.length + ' baris data, ' +
      table.headers.length + ' kolom, ' + known + ' kolom dikenali otomatis. ' +
      'Periksa dulu, betulkan kalau ada yang salah.';

    var optionsHtml = '<option value="">— lewati kolom ini —</option>';
    for (i = 0; i < D.COLUMNS.length; i++) {
      optionsHtml += '<option value="' + D.COLUMNS[i].k + '">' + T.esc(D.COLUMNS[i].t) + '</option>';
    }

    var h = [], sample;
    for (i = 0; i < table.headers.length; i++) {
      sample = '';
      for (var b = 0; b < table.body.length && b < 6; b++) {
        var v = table.body[b][i];
        if (String(v == null ? '' : v).trim() !== '') { sample = v; break; }
      }
      if (D.COLUMNS.length && map[i] === 'tanggal') sample = D.fmtDate(D.parseDate(sample)) || sample;
      h.push('<tr' + (map[i] ? '' : ' class="skipped"') + '>' +
             '<td>' + T.esc(table.headers[i] || '(tanpa judul)') + '</td>' +
             '<td><select data-c="' + i + '">' + optionsHtml + '</select></td>' +
             '<td class="sample">' + T.esc(String(sample == null ? '' : sample)) + '</td></tr>');
    }
    $('mapBody').innerHTML = h.join('');
    els('#mapBody select').forEach(function (s, n) { s.value = map[n] || ''; });
    $('mapReplace').checked = rows.length === 0;
    openModal('mMap');
  }

  function confirmMapping() {
    if (!pendingImport) { closeModal(); return; }
    var map = [], seen = {}, dup = false;
    els('#mapBody select').forEach(function (s) {
      var v = s.value;
      if (v && seen[v]) { dup = true; v = ''; }
      if (v) seen[v] = 1;
      map.push(v);
    });
    if (dup) toast('Ada kolom tujuan yang dipilih dua kali — yang kedua dilewati.');

    var got = D.applyMapping(pendingImport, map);
    if (!got.length) { toast('Tidak ada baris yang terisi setelah dipetakan.'); return; }

    if ($('mapReplace').checked) rows = got;
    else rows = rows.concat(got);
    D.fillMissingIds(rows);

    pendingImport = null;
    closeModal();
    renderTable(); schedulePreview(); doSave();
    toast(got.length + ' baris dimasukkan.');
  }

  /* ============================== MODAL ============================== */
  var openId = null;
  function openModal(id) {
    closeModal();
    openId = id;
    $('backdrop').hidden = false;
    $(id).hidden = false;
    var f = el('input,select,textarea,button', $(id));
    if (f) try { f.focus(); } catch (e) {}
  }
  function closeModal() {
    if (openId) $(openId).hidden = true;
    openId = null;
    $('backdrop').hidden = true;
  }

  /* ============================== PANEL ============================== */
  function buildPaperSelect() {
    var h = '', i, k;
    for (i = 0; i < T.PAPER_ORDER.length; i++) {
      k = T.PAPER_ORDER[i];
      h += '<option value="' + k + '">' + T.esc(PAPERS[k].t) + '</option>';
    }
    $('selPaper').innerHTML = h;
  }

  function buildTplPicker() {
    var h = [], i, t, c, r, cells;
    for (i = 0; i < T.TEMPLATES.length; i++) {
      t = T.TEMPLATES[i];
      c = t.mini[0]; r = t.mini[1];
      cells = '';
      for (var n = 0; n < Math.min(c * r, 24); n++) cells += '<i></i>';
      h.push('<button type="button" class="tpl" role="radio" aria-checked="false" data-tpl="' + t.key + '">' +
             '<span class="tpl-mini" style="grid-template-columns:repeat(' + c + ',1fr);' +
             'grid-template-rows:repeat(' + Math.min(r, 8) + ',1fr)">' + cells + '</span>' +
             '<b>' + T.esc(t.nama) + '</b><small>' + T.esc(t.ukuran) + '</small></button>');
    }
    $('tplPicker').innerHTML = h.join('');
  }

  function selectTemplate(key, resetDefaults) {
    var t = T.byKey(key);
    opts.tpl = t.key;
    if (resetDefaults) {
      opts.paper = t.paper; opts.orient = t.orient;
      opts.cols = t.cols; opts.rows = t.rows;
      opts.margin = t.margin; opts.gap = t.gap;
      opts.lock = !!t.fixed || (t.cellW !== undefined);
      if (t.cellW !== undefined) { opts.cellW = t.cellW; opts.cellH = t.cellH; }
      else { opts.lock = false; }
      if (t.opts) {
        opts.qr = !!t.opts.qr; opts.barcode = !!t.opts.barcode; opts.meta = !!t.opts.meta;
      }
    }
    if (!opts.lock) { var cs = cellSize(); opts.cellW = cs.w; opts.cellH = cs.h; }
    syncControls();
  }

  /* Salin nilai opts ke seluruh kontrol di panel. */
  function syncControls() {
    var t = T.byKey(opts.tpl);

    els('#tplPicker .tpl').forEach(function (b) {
      var on_ = b.getAttribute('data-tpl') === opts.tpl;
      b.className = 'tpl' + (on_ ? ' is-on' : '');
      b.setAttribute('aria-checked', on_ ? 'true' : 'false');
    });
    $('tplNote').textContent = t.desc + (t.fixed ? ' Ukuran label dikunci dan tidak bisa diubah.' : '');

    $('selPaper').value = opts.paper;
    $('selOrient').value = opts.orient;
    $('rowCustomPaper').hidden = opts.paper !== 'custom';
    $('inPaperW').value = opts.paperW;
    $('inPaperH').value = opts.paperH;

    var cs = cellSize();
    $('chkLock').checked = !!opts.lock;
    $('chkLock').disabled = !!t.fixed;
    $('inCellW').value = cs.w;
    $('inCellH').value = cs.h;
    $('inCellW').disabled = $('inCellH').disabled = !opts.lock || !!t.fixed;
    $('inCols').value = opts.cols;
    $('inRows').value = opts.rows;
    $('inMargin').value = opts.margin;
    $('inGap').value = opts.gap;
    $('inScale').value = opts.scale;
    $('outScale').textContent = opts.scale + '%';
    $('inCopies').value = opts.copies;

    $('chkQR').checked = !!opts.qr;
    $('chkQR').disabled = !T.hasQR;
    $('fldQR').hidden = !opts.qr || !T.hasQR;
    $('inQRPattern').value = opts.qrPattern;
    $('chkBarcode').checked = !!opts.barcode;
    $('chkBlankLokasi').checked = !!opts.blankLokasi;
    $('chkMeta').checked = !!opts.meta;
    $('chkCut').checked = !!opts.cut;
    $('chkSaveInk').checked = !!opts.saveInk;
  }

  /* Baca kontrol -> opts */
  function readControls() {
    var t = T.byKey(opts.tpl);
    opts.paper = $('selPaper').value;
    opts.orient = $('selOrient').value;
    opts.paperW = Math.max(20, num($('inPaperW').value, 100));
    opts.paperH = Math.max(20, num($('inPaperH').value, 150));
    if (!t.fixed) opts.lock = $('chkLock').checked;
    if (opts.lock && !t.fixed) {
      opts.cellW = Math.max(5, num($('inCellW').value, opts.cellW));
      opts.cellH = Math.max(5, num($('inCellH').value, opts.cellH));
    }
    opts.cols = Math.max(1, Math.min(20, parseInt($('inCols').value, 10) || 1));
    opts.rows = Math.max(1, Math.min(40, parseInt($('inRows').value, 10) || 1));
    opts.margin = Math.max(0, num($('inMargin').value, 0));
    opts.gap = Math.max(0, num($('inGap').value, 0));
    opts.scale = Math.max(70, Math.min(140, parseInt($('inScale').value, 10) || 100));
    opts.copies = Math.max(1, Math.min(50, parseInt($('inCopies').value, 10) || 1));
    opts.qr = $('chkQR').checked;
    opts.qrPattern = $('inQRPattern').value;
    opts.barcode = $('chkBarcode').checked;
    opts.blankLokasi = $('chkBlankLokasi').checked;
    opts.meta = $('chkMeta').checked;
    opts.cut = $('chkCut').checked;
    opts.saveInk = $('chkSaveInk').checked;
  }

  function panelChanged() {
    readControls();
    syncControls();
    schedulePreview();
    saveSoon();
  }

  /* =============================== TEMA =============================== */
  function applyTheme(mode) {
    var root = document.documentElement;
    if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
    else root.removeAttribute('data-theme');
    try { localStorage.setItem('labelgudang.theme', mode); } catch (e) {}
  }
  function currentTheme() {
    try { return localStorage.getItem('labelgudang.theme') || 'auto'; } catch (e) { return 'auto'; }
  }

  /* =============================== TAB =============================== */
  function showTab(which) {
    var dataOn = which === 'data';
    $('viewData').className = 'view' + (dataOn ? ' is-on' : '');
    $('viewPrint').className = 'view' + (dataOn ? '' : ' is-on');
    $('viewData').hidden = !dataOn;
    $('viewPrint').hidden = dataOn;
    $('tabData').className = 'tab' + (dataOn ? ' is-on' : '');
    $('tabPrint').className = 'tab' + (dataOn ? '' : ' is-on');
    $('tabData').setAttribute('aria-selected', dataOn ? 'true' : 'false');
    $('tabPrint').setAttribute('aria-selected', dataOn ? 'false' : 'true');
    if (!dataOn) { renderPreview(); }
  }

  /* ============================== BANTUAN ============================== */
  function helpHTML() {
    return '' +
      '<h3>Alurnya tiga langkah</h3>' +
      '<ol><li>Masukkan data di tab <b>Data label</b> — impor, tempel, atau ketik sendiri.</li>' +
      '<li>Centang baris yang mau dicetak.</li>' +
      '<li>Pindah ke tab <b>Template &amp; cetak</b>, pilih template, tekan <b>Cetak sekarang</b>.</li></ol>' +
      '<h3>Supaya ukuran label benar</h3>' +
      '<ul><li>Di dialog printer: margin <b>None</b>, skala <b>100%</b>, centang <b>Background graphics</b>.</li>' +
      '<li>Ragu? Tekan <b>Cetak halaman kalibrasi printer</b> lalu ukur hasilnya dengan penggaris.</li></ul>' +
      '<h3>Dua template dengan ukuran pasti</h3>' +
      '<ul><li><b>Rak 100 × 25 mm</b> — strip untuk bibir rak, 20 label per lembar A4.</li>' +
      '<li><b>Dus 100 × 250 mm</b> — banner untuk sisi depan dus, 2 label per lembar A4.</li></ul>' +
      '<h3>Data Anda</h3>' +
      '<p>Semua data hanya tersimpan di browser komputer ini. Tidak ada yang dikirim ke mana pun. ' +
      'Buat cadangan <b>.json</b> secara berkala lewat menu <b>Ekspor &amp; cadangan</b>.</p>' +
      (T.hasQR ? '' : '<p><b>Catatan:</b> pustaka QR tidak termuat, jadi pilihan QR disembunyikan.</p>') +
      (typeof XLSX === 'undefined' ? '<p><b>Catatan:</b> pustaka Excel tidak termuat. Impor/ekspor .xlsx tidak tersedia; pakai CSV.</p>' : '');
  }

  /* ============================== MULAI ============================== */
  function init() {
    applyTheme(currentTheme());
    buildHead();
    buildPaperSelect();
    buildTplPicker();
    bindTable();

    var had = restoreState();
    if (!had || !rows.length) selectTemplate(opts.tpl, true);
    syncControls();
    renderTable();
    setPageRule();

    if (had) doSave();

    /* ---- tab ---- */
    on($('tabData'), 'click', function () { showTab('data'); });
    on($('tabPrint'), 'click', function () { showTab('print'); });

    /* ---- tema & bantuan ---- */
    on($('btnTheme'), 'click', function () {
      var cur = currentTheme();
      var next = cur === 'auto' ? 'light' : (cur === 'light' ? 'dark' : 'auto');
      applyTheme(next);
      toast('Tema: ' + (next === 'auto' ? 'ikut sistem' : next === 'light' ? 'terang' : 'gelap'));
    });
    on($('btnHelp'), 'click', function () { $('helpBody').innerHTML = helpHTML(); openModal('mHelp'); });

    /* ---- toolbar data ---- */
    on($('btnAdd'), 'click', function () {
      rows.push(D.newRow(rows.length ? rows[rows.length - 1] : null));
      D.fillMissingIds(rows);
      renderTable(); schedulePreview(); doSave();
      var last = el('#gridBody tr:last-child input[data-k="kode"]');
      if (last) { last.focus(); last.select(); }
    });

    on($('btnImport'), 'click', function () { $('fileIn').value = ''; $('fileIn').click(); });
    on($('fileIn'), 'change', function () { if (this.files && this.files[0]) handleFile(this.files[0]); });
    on($('fileJson'), 'change', function () { if (this.files && this.files[0]) readJSON(this.files[0]); });

    on($('btnPaste'), 'click', function () { $('pasteBox').value = ''; openModal('mPaste'); });
    on($('pasteOk'), 'click', function () {
      var txt = $('pasteBox').value;
      if (!txt.trim()) { toast('Belum ada yang ditempel.'); return; }
      closeModal();
      openMapping(D.matrixToTable(D.parseDelimited(txt)), 'Tempelan dari Excel');
    });

    on($('btnSplit'), 'click', function () {
      var out = [], i, any = false, target = anyChecked();
      for (i = 0; i < rows.length; i++) {
        if (target && !rows[i]._on) { out.push(rows[i]); continue; }
        var got = D.splitRow(rows[i]);
        if (got.length > 1) any = true;
        out = out.concat(got);
      }
      if (!any) { toast('Tidak ada baris dengan Total Dus lebih dari 1.'); return; }
      rows = out;
      D.fillMissingIds(rows);
      renderTable(); schedulePreview(); doSave();
      toast('Selesai. Sekarang ada ' + rows.length + ' baris.');
    });

    on($('btnRenum'), 'click', function () {
      D.renumber(rows);
      renderTable(); schedulePreview(); doSave();
      toast('Label ID dinomori ulang dari LBL-001.');
    });

    on($('btnDupSel'), 'click', function () {
      var out = [], i, k, c, n = 0;
      for (i = 0; i < rows.length; i++) {
        out.push(rows[i]);
        if (rows[i]._on) {
          c = {};
          for (k in rows[i]) if (rows[i].hasOwnProperty(k)) c[k] = rows[i][k];
          c.labelId = '';
          out.push(c); n++;
        }
      }
      if (!n) { toast('Centang dulu baris yang mau digandakan.'); return; }
      rows = out; D.fillMissingIds(rows);
      renderTable(); schedulePreview(); doSave();
      toast(n + ' baris digandakan.');
    });

    on($('btnDelSel'), 'click', function () {
      var keep = [], n = 0, i;
      for (i = 0; i < rows.length; i++) { if (rows[i]._on) n++; else keep.push(rows[i]); }
      if (!n) { toast('Centang dulu baris yang mau dihapus.'); return; }
      if (!window.confirm('Hapus ' + n + ' baris yang dicentang?')) return;
      rows = keep;
      renderTable(); schedulePreview(); doSave();
      toast(n + ' baris dihapus.');
    });

    /* ---- menu ekspor ---- */
    var menu = $('menuExport');
    on($('btnExport'), 'click', function (e) {
      e.stopPropagation();
      var open = menu.className.indexOf('is-open') < 0;
      menu.className = 'menu' + (open ? ' is-open' : '');
      $('btnExport').setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    on(document, 'click', function () {
      menu.className = 'menu';
      $('btnExport').setAttribute('aria-expanded', 'false');
    });
    on(menu, 'click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act) return;
      menu.className = 'menu';
      if (act === 'xlsx') {
        if (!rows.length) { toast('Belum ada data.'); return; }
        if (typeof XLSX === 'undefined') { toast('Pustaka Excel tidak termuat. Pakai CSV.'); return; }
        D.exportXLSX(rows); toast('File Excel diunduh.');
      } else if (act === 'csv') {
        if (!rows.length) { toast('Belum ada data.'); return; }
        D.exportCSV(rows); toast('File CSV diunduh.');
      } else if (act === 'json') {
        D.exportJSON(state()); toast('Cadangan diunduh.');
      } else if (act === 'restore') {
        $('fileJson').value = ''; $('fileJson').click();
      } else if (act === 'sample') {
        rows = D.sampleRows();
        renderTable(); schedulePreview(); doSave();
        toast('12 baris contoh dimasukkan.');
      } else if (act === 'clear') {
        if (!window.confirm('Kosongkan seluruh data label? Tindakan ini tidak bisa dibatalkan.')) return;
        rows = []; D.wipe();
        renderTable(); schedulePreview(); doSave();
        toast('Data dikosongkan.');
      }
    });

    /* ---- keadaan kosong ---- */
    on($('emptyState'), 'click', function (e) {
      var b = e.target;
      while (b && b !== this && !(b.getAttribute && b.getAttribute('data-start'))) b = b.parentNode;
      if (!b || b === this) return;
      var s = b.getAttribute('data-start');
      if (s === 'import') { $('fileIn').value = ''; $('fileIn').click(); }
      else if (s === 'paste') { $('pasteBox').value = ''; openModal('mPaste'); }
      else if (s === 'manual') { rows.push(D.newRow(null)); D.fillMissingIds(rows); renderTable(); doSave(); }
      else if (s === 'sample') { rows = D.sampleRows(); renderTable(); schedulePreview(); doSave(); }
    });

    /* ---- pencarian & saringan ---- */
    on($('inSearch'), 'input', function () { filters.q = this.value.trim(); renderTable(); });
    on($('fZona'), 'change', function () { filters.zona = this.value; renderTable(); });
    on($('fStatus'), 'change', function () { filters.status = this.value; renderTable(); });
    on($('fOnlyChecked'), 'change', function () { filters.onlyChecked = this.checked; renderTable(); });

    /* ---- panel cetak ---- */
    on($('tplPicker'), 'click', function (e) {
      var b = e.target;
      while (b && b !== this && !(b.getAttribute && b.getAttribute('data-tpl'))) b = b.parentNode;
      if (!b || b === this) return;
      selectTemplate(b.getAttribute('data-tpl'), true);
      schedulePreview(); saveSoon();
    });

    ['selPaper', 'selOrient', 'inPaperW', 'inPaperH', 'chkLock', 'inCellW', 'inCellH',
     'inCols', 'inRows', 'inMargin', 'inGap', 'inCopies', 'inQRPattern',
     'chkQR', 'chkBarcode', 'chkBlankLokasi', 'chkMeta', 'chkCut', 'chkSaveInk'
    ].forEach(function (id) {
      on($(id), 'change', panelChanged);
      on($(id), 'input', panelChanged);
    });
    on($('inScale'), 'input', function () {
      opts.scale = parseInt(this.value, 10) || 100;
      $('outScale').textContent = opts.scale + '%';
      schedulePreview(); saveSoon();
    });

    on($('btnAutoFit'), 'click', function () {
      autoFit(); syncControls(); schedulePreview(); saveSoon();
      toast('Diisi ' + opts.cols + ' kolom × ' + opts.rows + ' baris.');
    });

    /* ---- zoom ---- */
    on($('btnZoomIn'), 'click', function () {
      zoom = Math.min(3, (zoom || fitZoom()) * 1.25); applyZoom();
    });
    on($('btnZoomOut'), 'click', function () {
      zoom = Math.max(0.05, (zoom || fitZoom()) / 1.25); applyZoom();
    });
    on($('btnZoomFit'), 'click', function () { zoom = 0; applyZoom(); });
    on(window, 'resize', function () { if (!zoom) applyZoom(); });

    /* ---- cetak ---- */
    on($('btnPrint'), 'click', showSummary);
    on($('sumOk'), 'click', function () { closeModal(); setTimeout(doPrint, 60); });
    on($('btnCalib'), 'click', printCalibration);

    /* ---- modal ---- */
    on($('mapOk'), 'click', confirmMapping);
    on($('backdrop'), 'click', closeModal);
    els('[data-close]').forEach(function (b) { on(b, 'click', closeModal); });
    on(document, 'keydown', function (e) {
      if (e.key === 'Escape' && openId) closeModal();
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        showTab('print');
        setTimeout(showSummary, 60);
      }
    });

    /* ---- seret & lepas ---- */
    var dragDepth = 0;
    on(window, 'dragenter', function (e) {
      if (!e.dataTransfer) return;
      e.preventDefault(); dragDepth++; $('dropHint').hidden = false;
    });
    on(window, 'dragover', function (e) { e.preventDefault(); });
    on(window, 'dragleave', function () { dragDepth--; if (dragDepth <= 0) { dragDepth = 0; $('dropHint').hidden = true; } });
    on(window, 'drop', function (e) {
      e.preventDefault(); dragDepth = 0; $('dropHint').hidden = true;
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        showTab('data');
        handleFile(e.dataTransfer.files[0]);
      }
    });

    /* ---- pustaka yang tidak termuat: sembunyikan fiturnya ---- */
    if (!T.hasQR) { $('chkQR').parentNode.hidden = true; $('fldQR').hidden = true; opts.qr = false; }
    if (!T.hasBarcode) { $('chkBarcode').parentNode.hidden = true; opts.barcode = false; }
    if (typeof XLSX === 'undefined') {
      var x = el('#menuExport [data-act="xlsx"]'); if (x) x.hidden = true;
    }

    $('statRight').textContent = 'Data disimpan di komputer ini saja.';
    schedulePreview();
  }

  function anyChecked() {
    for (var i = 0; i < rows.length; i++) if (rows[i]._on) return true;
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, false);
  } else {
    init();
  }

})(window, document);
