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
    tpl: 'rak100', fam: 'rak',
    paper: 'a4', orient: 'portrait', paperW: 100, paperH: 150,
    lock: true, cellW: 100, cellH: 25,
    cols: 2, rows: 10, margin: 4, gap: 2,
    scale: 100, copies: 1, pageFrom: '', pageTo: '',
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

  /* ============================== URUNGKAN ==============================
     Hanya untuk tindakan yang mengubah susunan baris — hapus, pecah per
     dus, impor, dan sejenisnya. Mengetik di dalam sel tidak dicatat di
     sini karena browser sudah punya urungkan sendiri di kotak isian.
     ====================================================================== */
  var undoStack = [];
  var UNDO_MAX = 25;

  function cloneRows(list) {
    var out = [], i, k, c;
    for (i = 0; i < list.length; i++) {
      c = {};
      for (k in list[i]) if (list[i].hasOwnProperty(k)) c[k] = list[i][k];
      out.push(c);
    }
    return out;
  }

  /* Dipanggil SEBELUM baris diubah. */
  function markUndo(label) {
    undoStack.push({ rows: cloneRows(rows), label: label });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    refreshUndo();
  }

  function refreshUndo() {
    var b = $('btnUndo');
    if (!b) return;
    var top = undoStack[undoStack.length - 1];
    b.disabled = !top;
    b.title = top ? 'Urungkan: ' + top.label + ' (Ctrl+Z)' : 'Tidak ada yang bisa diurungkan';
  }

  function doUndo() {
    var last = undoStack.pop();
    if (!last) { toast('Tidak ada yang bisa diurungkan.'); return; }
    rows = last.rows;
    refreshUndo();
    renderTable(); schedulePreview(); doSave();
    toast('Diurungkan: ' + last.label + '.');
  }

  /* =============================== SIMPAN =============================== */
  function state() { return { rows: rows, opts: opts, at: Date.now() }; }

  function saveSoon() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 400);
  }
  function doSave() {
    var ok = D.save(state(), D.dbGet());
    var d = new Date();
    $('saveNote').textContent = ok
      ? 'Tersimpan ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
      : 'Tidak bisa menyimpan di browser ini';
  }
  function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  function restoreState() {
    var s = D.load(D.dbGet());
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
     tengah dan tidak terpotong — inilah yang membuat Dus 100 × 200 mm
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
      /* Dicocokkan per kata dan melintasi kolom, jadi "anker a2348" tetap
         ketemu walau merek ada di kolom Brand dan tipe di kolom Tipe.
         Seluruh kolom ikut dicari — termasuk barcode, nama, brand, tipe,
         golongan, dan lokasi final. */
      var kata = filters.q.toLowerCase().split(/\s+/), gabung = '', i, j;
      for (i = 0; i < D.COLUMNS.length; i++) gabung += String(r[D.COLUMNS[i].k] || '').toLowerCase() + ' ';
      for (j = 0; j < kata.length; j++) {
        if (kata[j] && gabung.indexOf(kata[j]) < 0) return false;
      }
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

      /* rekomendasi produk muncul sambil mengetik */
      if (k === 'kode' || k === 'varian') {
        var q = inp.value.trim();
        if (q.length >= 1) tipBuka(inp, q); else tipTutup();
      }
    });

    on(body, 'change', function (e) {
      var t = e.target, tr, i;
      if (t.getAttribute && t.getAttribute('data-act') === 'on') {
        tr = t.parentNode.parentNode; i = parseInt(tr.getAttribute('data-i'), 10);
        if (rows[i]) { rows[i]._on = t.checked; tr.className = t.checked ? '' : 'is-off'; }
        updateAllCheck(); saveSoon(); schedulePreview();
        return;
      }
      /* Mengetik barcode yang ada di katalog akan mengisi nama produk dan
         stoknya — tapi hanya kalau kolomnya masih kosong, supaya tidak
         menimpa yang sudah diketik sendiri. */
      if (t.getAttribute && t.getAttribute('data-k') === 'kode') {
        tr = t.parentNode.parentNode; i = parseInt(tr.getAttribute('data-i'), 10);
        if (!rows[i]) return;
        var pr = D.produkByBarcode(t.value, D.dbGet());
        if (pr) {
          var isi = [];
          if (!String(rows[i].varian || '').trim()) { rows[i].varian = String(pr[1] || ''); isi.push('nama'); }
          if (!String(rows[i].qty || '').trim()) {
            var sat = String(pr[3] || '').trim();
            rows[i].qty = (pr[2] || pr[2] === 0) ? (pr[2] + (sat ? ' ' + sat : '')) : '';
            isi.push('qty');
          }
          if (pr[4] && !String(rows[i].lokasi || '').trim()) { rows[i].lokasi = String(pr[4]); isi.push('lokasi'); }
          if (isi.length) {
            renderTable(); schedulePreview(); saveSoon();
            toast('Dari katalog: ' + pr[1]);
          }
        }
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
      markUndo(act === 'dup' ? 'gandakan baris' : 'hapus baris');
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

  /* ---- berpindah antar sel dengan papan ketik ----
     Mengisi 60 baris dengan Tab saja melelahkan: panah atas/bawah
     berpindah baris pada kolom yang sama, Enter turun satu baris, dan
     Enter di baris terakhir menambah baris baru. */
  function moveCell(inp, dir) {
    var tr = inp.parentNode.parentNode;
    var k = inp.getAttribute('data-k');
    var target = dir < 0 ? tr.previousElementSibling : tr.nextElementSibling;
    if (!target) return null;
    var next = target.querySelector('input[data-k="' + k + '"]');
    if (next) { next.focus(); next.select(); }
    return next;
  }

  function addRowAndFocus(k) {
    markUndo('tambah baris');
    rows.push(D.newRow(rows.length ? rows[rows.length - 1] : null));
    D.fillMissingIds(rows);
    renderTable(); schedulePreview(); doSave();
    var last = el('#gridBody tr:last-child input[data-k="' + k + '"]');
    if (last) { last.focus(); last.select(); }
  }

  function bindKeys() {
    on($('gridBody'), 'keydown', function (e) {
      var inp = e.target;
      if (!inp.getAttribute || !inp.getAttribute('data-k')) return;

      /* Selama daftar rekomendasi terbuka, panah dan Enter miliknya —
         bukan milik perpindahan antar sel. */
      if (!$('tip').hidden && tipInput === inp) {
        if (e.key === 'ArrowDown') { e.preventDefault(); tipSorot(tipAktif + 1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); tipSorot(tipAktif - 1); return; }
        if (e.key === 'Enter' && tipAktif >= 0) { e.preventDefault(); tipPilih(tipAktif); return; }
        if (e.key === 'Escape') { e.preventDefault(); tipTutup(); return; }
        if (e.key === 'Tab') { tipTutup(); }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) { moveCell(inp, -1); return; }
        if (!moveCell(inp, 1)) addRowAndFocus(inp.getAttribute('data-k'));
        return;
      }
      /* kolom zona dan status memakai daftar pilihan — panahnya milik
         daftar itu, jangan diambil alih */
      if (inp.getAttribute('list')) return;

      if (e.key === 'ArrowDown') { e.preventDefault(); moveCell(inp, 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveCell(inp, -1); }
      else if (e.key === 'Escape') { inp.blur(); }
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

  /* Menghitung jumlah label dan lembar TANPA membangun HTML-nya.
     Ringkasan sebelum cetak cuma butuh angka; dulu ia membangun seluruh
     lembar lalu membuangnya — 2 detik terbuang untuk 1500 baris. */
  function planSheets() {
    var lay = layout();
    var list = printableRows();
    var copies = Math.max(1, Math.min(50, parseInt(opts.copies, 10) || 1));
    var total = list.length * copies;
    var per = Math.max(1, opts.cols * opts.rows);
    var pages = Math.ceil(total / per) || 0;

    /* rentang lembar — untuk mencetak ulang setelah kertas macet */
    var from = Math.max(1, parseInt(opts.pageFrom, 10) || 1);
    var to = parseInt(opts.pageTo, 10) || pages;
    if (to > pages) to = pages;
    if (from > pages) from = pages || 1;
    if (to < from) to = from;
    var sebagian = pages > 0 && (from > 1 || to < pages);

    return { lay: lay, list: list, copies: copies, total: total,
             per: per, pages: pages, from: from, to: to,
             dicetak: pages ? (to - from + 1) : 0, sebagian: sebagian };
  }

  /* Bangun HTML lembar. limit = jumlah lembar maksimum yang digambar
     (0 = semua). Rentang lembar tetap dihormati. */
  function buildSheets(limit) {
    var tpl = T.byKey(opts.tpl);
    var o = renderOpts();
    var plan = planSheets();
    var lay = plan.lay;

    var items = [], i, c;
    for (i = 0; i < plan.list.length; i++) {
      for (c = 0; c < plan.copies; c++) items.push(plan.list[i]);
    }

    var per = plan.per;
    var mulai = plan.pages ? plan.from - 1 : 0;
    var akhir = plan.pages ? plan.to - 1 : -1;
    if (limit && akhir - mulai + 1 > limit) akhir = mulai + limit - 1;

    var sheetStyle = 'width:' + lay.paper.w + 'mm;height:' + lay.paper.h + 'mm;--k:' + o.k;
    var gridStyle = 'grid-template-columns:repeat(' + opts.cols + ',' + lay.cell.w + 'mm);' +
                    'grid-template-rows:repeat(' + opts.rows + ',' + lay.cell.h + 'mm);' +
                    'gap:' + opts.gap + 'mm;' +
                    'padding:' + lay.padY + 'mm ' + lay.padX + 'mm;';
    var cls = 'sheet' + (opts.cut ? ' cut' : '') + (opts.saveInk ? ' ink' : '');

    var out = [], p, n, row, digambar = 0;
    for (p = mulai; p <= akhir; p++) {
      out.push('<div class="' + cls + '" style="' + sheetStyle + '" data-page="Lembar ' +
               (p + 1) + ' / ' + plan.pages + '">');
      out.push('<div class="sheet-grid" style="' + gridStyle + '">');
      for (n = 0; n < per; n++) {
        row = items[p * per + n];
        if (!row) break;
        out.push('<div class="lbl ' + tpl.cls + ' ' + T.zCls(row.zona) + ' ' + T.sCls(row.status) + '">' +
                 tpl.render(row, o) + '</div>');
      }
      out.push('</div></div>');
      digambar++;
    }

    return { html: out.join(''), pages: plan.pages, perPage: per, total: plan.total,
             shown: digambar, lay: lay, plan: plan };
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
     pengganti lebih lebar, teks besar bisa terpotong, jadi ukurannya
     dikecilkan sampai benar-benar muat.

     Tapi mengecilkan tanpa batas merusak labelnya dengan cara lain:
     lokasi "GUDANG-B-LANTAI2-RAK07-SLOT23" pernah menyusut jadi 3,38 mm
     — sama besar dengan baris keterangan di bawahnya — sehingga
     hierarkinya runtuh dan kedua baris terlihat berdempet. Label rak
     yang harusnya terbaca dari 3 meter jadi tidak terbaca sama sekali.

     Karena itu: teks yang boleh dipatahkan (data-wrap) tidak dikecilkan
     melewati ambang; ia dipecah jadi dua baris. Dua baris 7 mm jauh
     lebih terbaca daripada satu baris 3,4 mm.

     Semua pengukuran dikerjakan sekaligus, baru semua penulisan, supaya
     browser hanya menghitung tata letak beberapa kali. */
  var FIT_AMBANG = 0.55;   /* di bawah 55% ukuran awal, lebih baik dipatahkan */

  function mmDariPx(px) { return px / (96 / 25.4); }

  function fitTexts(root) {
    var list = els('[data-fit]', root);
    if (!list.length) return;
    var awal = [], sizes = [], i, pass, need, n, cw, sw;

    for (i = 0; i < list.length; i++) {
      var f = parseFloat(list[i].style.fontSize) || 0;
      awal.push(f); sizes.push(f);
    }

    /* ---- tahap 1: pecah jadi dua baris kalau penyusutannya kebablasan ---- */
    var ubah = [];
    for (i = 0; i < list.length; i++) {
      n = list[i];
      if (!n.getAttribute('data-wrap')) continue;
      cw = n.clientWidth; sw = n.scrollWidth;
      if (cw <= 0 || sw <= cw + 0.5) continue;
      var satuBaris = sizes[i] * (cw / sw);
      if (satuBaris >= awal[i] * FIT_AMBANG) continue;   /* masih wajar, susutkan biasa */

      /* dua baris memuat kira-kira dua kali lebih banyak huruf */
      var dua = Math.min(awal[i], satuBaris * 1.9);
      /* jangan melebihi tinggi kotaknya sendiri kalau CSS membatasinya */
      var maxH = parseFloat(getComputedStyle(n).maxHeight);
      if (isFinite(maxH) && maxH > 0) dua = Math.min(dua, mmDariPx(maxH) / 2.05);
      ubah.push([i, Math.max(2, dua)]);
    }
    for (i = 0; i < ubah.length; i++) {
      var k = ubah[i][0];
      list[k].className += ' fit-wrap';
      sizes[k] = ubah[i][1];
      list[k].style.fontSize = (Math.round(sizes[k] * 100) / 100) + 'mm';
    }

    /* ---- tahap 2: susutkan yang masih melebar ATAU meninggi ----
       Tinggi penting untuk teks yang sudah dipatahkan: kalau tiga baris
       dipaksa masuk kotak dua baris, ekornya hilang — dan pada kode
       lokasi, ekor itulah bagian paling spesifik (…-SLOT23). */
    for (pass = 0; pass < 8; pass++) {
      need = [];
      for (i = 0; i < list.length; i++) {
        n = list[i];
        cw = n.clientWidth; sw = n.scrollWidth;
        var rasio = (cw > 0 && sw > cw + 0.5) ? cw / sw : 1;
        /* Toleransi sebesar seperempat baris. Tanpa ini, line-height di
           bawah 1 membuat scrollHeight selalu sedikit melebihi
           clientHeight, dan gelangnya menyusut tanpa henti. */
        var ch = n.clientHeight, sh = n.scrollHeight;
        var toleransi = Math.max(2, sizes[i] * 3.7795 * 0.25);
        if (ch > 0 && sh > ch + toleransi) rasio = Math.min(rasio, 0.92);
        if (rasio < 1) need.push([i, rasio]);
      }
      if (!need.length) return;
      for (i = 0; i < need.length; i++) {
        var j = need[i][0];
        sizes[j] = Math.max(2, sizes[j] * need[i][1] * 0.985);
        list[j].style.fontSize = (Math.round(sizes[j] * 100) / 100) + 'mm';
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

    renderCanvasEmpty(res.total);
    $('cntLabel').textContent = res.total;
    $('cntPage').textContent = res.plan.sebagian
      ? res.plan.dicetak + '/' + res.pages : res.pages;
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

  /* Tiga keadaan berbeda, tiga jalan keluar berbeda. */
  function renderCanvasEmpty(total) {
    var box = $('canvasEmpty');
    box.hidden = total > 0;
    if (total > 0) return;

    var adaBaris = rows.length > 0;
    var adaCentang = anyChecked();

    if (!adaBaris) {
      $('ceJudul').textContent = 'Belum ada data label';
      $('cePesan').textContent = 'Masukkan data dulu, baru labelnya bisa dicetak. ' +
        'Kalau cuma mau melihat-lihat dulu, pakai data contoh.';
      $('ceAksi').innerHTML =
        '<button type="button" class="btn btn-primary" data-ce="sample">Pakai data contoh</button>' +
        '<button type="button" class="btn" data-ce="import">Impor Excel / CSV</button>' +
        '<button type="button" class="btn" data-ce="data">Isi manual</button>';
    } else if (!adaCentang) {
      $('ceJudul').textContent = 'Belum ada baris yang dicentang';
      $('cePesan').textContent = 'Ada ' + rows.length + ' baris, tapi belum ada yang dicentang. ' +
        'Hanya baris bercentang yang ikut tercetak.';
      $('ceAksi').innerHTML =
        '<button type="button" class="btn btn-primary" data-ce="checkall">Centang semua ' + rows.length + ' baris</button>' +
        '<button type="button" class="btn" data-ce="data">Ke tab Data label</button>';
    } else {
      /* ada baris bercentang tapi hasilnya nol — biasanya rentang lembar */
      $('ceJudul').textContent = 'Tidak ada lembar pada rentang itu';
      $('cePesan').textContent = 'Kotak "Cetak lembar" di panel kiri membatasi lembar yang dicetak. ' +
        'Kosongkan kotak itu untuk mencetak semuanya.';
      $('ceAksi').innerHTML =
        '<button type="button" class="btn btn-primary" data-ce="resetrange">Kosongkan rentang lembar</button>';
    }
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

  /* ---- judul dokumen saat mencetak ----
     Browser menggambar sendiri baris kecil di tepi kertas: alamat halaman,
     tanggal, nomor halaman, dan judul dokumen. Hanya judul yang bisa
     dikendalikan dari sini — dikosongkan sebentar selagi mencetak, lalu
     dikembalikan. Sisanya (alamat dan nomor halaman) hanya hilang kalau
     "Header dan footer" di dialog printer dimatikan, dan itulah yang
     diingatkan di panel cetak serta di ringkasan sebelum mencetak. */
  var judulAsli = null, judulTimer = 0;

  function judulKosongkan() {
    if (judulAsli === null) judulAsli = document.title;
    try { document.title = ''; } catch (e) {}
    /* Kalau afterprint tidak pernah datang (sebagian browser lama), judul
       tetap kembali sendiri supaya tab tidak tinggal kosong. */
    if (judulTimer) clearTimeout(judulTimer);
    judulTimer = setTimeout(judulKembalikan, 60000);
  }

  function judulKembalikan() {
    if (judulTimer) { clearTimeout(judulTimer); judulTimer = 0; }
    if (judulAsli === null) return;
    try { document.title = judulAsli; } catch (e) {}
    judulAsli = null;
  }

  on(window, 'beforeprint', judulKosongkan);
  on(window, 'afterprint', judulKembalikan);

  /* ---- periksa data sebelum cetak ----
     Mencetak 60 label lalu baru sadar setengahnya tanpa lokasi itu mahal:
     kertas, tinta, dan waktu tempel. Jadi diperiksa dulu. */
  function auditRows(list) {
    var seen = {}, out = [], i, r, id;
    var noLok = 0, dupId = [], noCode = 0, dusSalah = 0, noQty = 0, prefixSaja = 0;
    var revTipe = 0, revBarcode = 0, st;

    for (i = 0; i < list.length; i++) {
      r = list[i];
      if (!String(r.lokasi || '').trim()) noLok++;
      /* Prefix lokasi (A-CHR) bukan alamat rak. Baris seperti ini tidak
         boleh ditempel sebagai label final tanpa peringatan — dan
         aplikasi tidak pernah menambahkan R/B/P sendiri. */
      else if (D.belumLokasiFinal && D.belumLokasiFinal(r)) prefixSaja++;
      if (!String(r.qty || '').trim()) noQty++;
      /* bigCode selalu jatuh ke Label ID sebagai pilihan terakhir, jadi
         yang diperiksa adalah ketiga kolom sumbernya — label dengan
         angka besar berisi "LBL-007" tidak berguna di gudang. */
      if (!String(r.kode || '').trim() && !String(r.sku || '').trim() &&
          !String(r.kodeDus || '').trim()) noCode++;
      id = String(r.labelId || '').trim();
      if (id) {
        if (seen[id] && dupId.indexOf(id) < 0) dupId.push(id);
        seen[id] = 1;
      }
      /* Status mapping dari file: barisnya tetap dicetak, cuma dihitung
         supaya ketahuan berapa yang masih perlu dicek. */
      st = D.statusMapping ? D.statusMapping(r) : '';
      if (st === 'tipe') revTipe++;
      else if (st === 'barcode') revBarcode++;
      var ke = parseInt(r.dusKe, 10), tot = parseInt(r.totalDus, 10);
      if (isFinite(ke) && isFinite(tot) && ke > tot) dusSalah++;
    }

    if (noCode) out.push({ t: 'berat', s: noCode + ' baris tanpa Kode, SKU, maupun Kode dus — angka besar di labelnya cuma berisi Label ID.' });
    if (dupId.length) out.push({ t: 'berat', s: dupId.length + ' Label ID kembar (' + dupId.slice(0, 3).join(', ') + (dupId.length > 3 ? ', …' : '') + '). Tekan "Nomori ulang" untuk membetulkan.' });
    if (dusSalah) out.push({ t: 'berat', s: dusSalah + ' baris punya Dus ke lebih besar dari Total dus.' });
    if (noLok) out.push({ t: 'berat', s: noLok + ' baris belum punya Lokasi final — labelnya dicetak bertanda "Lokasi belum diset". Isi kolom Lokasi final dulu; prefix seperti A-CHR tidak dipakai sebagai alamat rak.' });
    if (prefixSaja) out.push({ t: 'berat', s: prefixSaja + ' baris memakai prefix lokasi sebagai Lokasi final. Prefix hanya menunjukkan area dan golongan, belum rak/baris/posisi.' });
    if (revBarcode) out.push({ t: 'berat', s: revBarcode + ' baris berstatus REVIEW BARCODE — labelnya tetap dicetak, tapi QR-nya belum final karena barcodenya belum pasti.' });
    if (revTipe) out.push({ t: 'ringan', s: revTipe + ' baris berstatus REVIEW TIPE — tipe/model masih perlu dicek, lokasinya sendiri sudah terisi.' });
    if (noQty) out.push({ t: 'ringan', s: noQty + ' baris tanpa qty per dus.' });
    return out;
  }

  /* ---- ringkasan sebelum cetak ---- */
  function showSummary() {
    var res = planSheets(), tpl = T.byKey(opts.tpl), ps = res.lay.paper;
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
      '<li><span>Label per lembar</span><b>' + res.per + '</b></li>' +
      '<li><span>Jumlah lembar</span><b>' +
        (res.sebagian ? res.dicetak + ' (lembar ' + res.from + '–' + res.to + ' dari ' + res.pages + ')'
                      : res.pages) + '</b></li>' +
      '<li><span>Kertas di dialog printer</span><b>' + T.esc(paperName) + '</b></li>' +
      '</ul>' +
      (res.sebagian ? '<div class="sumtip"><b>Hanya sebagian yang dicetak:</b> lembar ' +
        res.from + ' sampai ' + res.to + ' dari ' + res.pages +
        '. Kosongkan kotak "Cetak lembar" di panel kiri untuk mencetak semuanya.</div>' : '') +
      auditHTML(printableRows()) +
      '<div class="sumtip"><b>Sebelum menekan Print, pastikan:</b><ul>' +
      '<li><b>Header dan footer</b> / <b>Headers and footers</b> — ' +
      'hilangkan centangnya, supaya alamat halaman, tanggal, dan nomor ' +
      'halaman tidak ikut tercetak</li>' +
      '<li>Margin: <b>None</b> / <b>Tidak ada</b></li>' +
      '<li>Skala: <b>100%</b> — bukan "Fit to page"</li>' +
      '<li><b>Background graphics</b> dicentang</li>' +
      '<li>Ukuran kertas sama dengan di atas</li>' +
      '</ul></div>';
    openModal('mSum');
  }

  function auditHTML(list) {
    var a = auditRows(list), i, h;
    if (!a.length) return '';
    h = '<div class="audit"><b>Periksa dulu:</b><ul>';
    for (i = 0; i < a.length; i++) {
      h += '<li class="' + (a[i].t === 'berat' ? 'bad' : 'soft') + '">' + T.esc(a[i].s) + '</li>';
    }
    return h + '</ul></div>';
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
        markUndo('pulihkan cadangan');
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

    markUndo($('mapReplace').checked ? 'ganti data dengan hasil impor' : 'impor ' + got.length + ' baris');
    if ($('mapReplace').checked) rows = got;
    else rows = rows.concat(got);
    D.fillMissingIds(rows);

    pendingImport = null;
    closeModal();
    renderTable(); schedulePreview(); doSave();
    toast(got.length + ' baris dimasukkan.');
  }

  /* ========================== BASIS DATA ==========================
     Berpindah basis data = menyimpan yang sekarang, lalu memuat yang
     dituju. Baris, pengaturan, dan tumpukan urungkan semuanya terpisah.
     ================================================================= */
  function buildDbPick() {
    var list = D.dbList(), h = [], i;
    for (i = 0; i < list.length; i++) {
      h.push('<button type="button" class="dbbtn" data-db="' + list[i].kunci + '">' +
             T.esc(list[i].nama) + '</button>');
    }
    $('dbBtns').innerHTML = '<span class="db-ind" id="dbInd" aria-hidden="true"></span>' + h.join('');
    syncDbPick();
  }

  function syncDbPick() {
    var aktif = D.dbGet(), tombolAktif = null;
    els('#dbBtns .dbbtn').forEach(function (b) {
      var on_ = b.getAttribute('data-db') === aktif;
      b.className = 'dbbtn' + (on_ ? ' is-on' : '');
      b.setAttribute('aria-pressed', on_ ? 'true' : 'false');
      if (on_) tombolAktif = b;
      var info = D.dbInfo(b.getAttribute('data-db'));
      b.title = info.nama + ' — ' + info.ket + ' (' + D.katalog(info.kunci).length + ' produk)';
    });
    geserPenanda('dbInd', tombolAktif);
  }

  function muatDb(kunci) {
    doSave();                       /* simpan yang sedang dibuka dulu */
    D.dbSet(kunci);
    undoStack = [];
    rows = [];
    var st = D.load(kunci);
    if (st && st.rows) {
      for (var i = 0; i < st.rows.length; i++) {
        var b = D.blank(), src = st.rows[i], c;
        for (c in b) if (b.hasOwnProperty(c) && src[c] !== undefined) b[c] = src[c];
        b._on = src._on !== false;
        rows.push(b);
      }
    }
    if (st && st.opts) {
      for (var k in DEF) if (DEF.hasOwnProperty(k) && st.opts[k] !== undefined) opts[k] = st.opts[k];
    }
    opts.fam = T.byKey(opts.tpl).fam || 'rak';
    filters.q = ''; filters.zona = ''; filters.status = ''; filters.onlyChecked = false;
    $('inSearch').value = '';
    refreshUndo(); syncDbPick(); buildTplPicker(); syncControls();
    renderTable(); schedulePreview();
    var info = D.dbInfo(kunci);
    toast('Basis data ' + info.nama + ' — ' + rows.length + ' baris, ' +
          D.katalog(kunci).length + ' produk di katalog.');
  }

  /* ==================== REKOMENDASI SAAT MENGETIK ====================
     Mengetik di kolom Kode atau Varian langsung memunculkan daftar
     produk yang cocok — tidak perlu membuka dialog katalog dulu.
     Cukup satu huruf: "899" saja sudah menyaring 402 produk jadi
     sepuluh teratas. ==================================================== */
  var tipHasil = [], tipAktif = -1, tipInput = null, tipBaris = -1;
  var tipMode = 'sel';          /* 'sel' = isi baris ini | 'cari' = tambah baris baru */
  var tipLagi = false;          /* ada baris "lihat semua" di bawah daftar */
  var tipQ = '';
  var TIP_MAX = 10;

  function tipTutup() {
    if (tipInput) tipInput.removeAttribute('aria-expanded');
    var tip = $('tip');
    tip.hidden = true;
    tip.innerHTML = '';                /* jangan sisakan hasil lama */
    tipHasil = []; tipAktif = -1; tipInput = null; tipBaris = -1;
    tipLagi = false; tipQ = '';
  }

  function tipTebal(teks, q) {
    var t = String(teks == null ? '' : teks);
    var kata = String(q || '').trim().toLowerCase().split(/\s+/);
    var low = t.toLowerCase(), tandai = [];
    for (var i = 0; i < kata.length; i++) {
      if (!kata[i]) continue;
      var dari = 0, at;
      while ((at = low.indexOf(kata[i], dari)) >= 0) {
        tandai.push([at, at + kata[i].length]);
        dari = at + kata[i].length;
      }
    }
    if (!tandai.length) return T.esc(t);
    tandai.sort(function (a, b) { return a[0] - b[0]; });
    var out = '', pos = 0;
    for (i = 0; i < tandai.length; i++) {
      if (tandai[i][0] < pos) continue;
      out += T.esc(t.slice(pos, tandai[i][0])) + '<mark>' +
             T.esc(t.slice(tandai[i][0], tandai[i][1])) + '</mark>';
      pos = tandai[i][1];
    }
    return out + T.esc(t.slice(pos));
  }

  function tipBuka(inp, q, mode) {
    var res = D.cariProduk(q, D.dbGet(), TIP_MAX);
    if (!res.hasil.length) { tipTutup(); return; }

    tipHasil = res.hasil; tipAktif = -1; tipInput = inp; tipQ = q;
    tipMode = mode || 'sel';
    if (tipMode === 'sel') {
      var tr = inp.parentNode.parentNode;
      tipBaris = parseInt(tr.getAttribute('data-i'), 10);
    } else {
      tipBaris = -1;
    }

    var h = [], i, pr;
    for (i = 0; i < tipHasil.length; i++) {
      pr = tipHasil[i];
      var sat = String(pr[3] || '').trim();
      h.push('<div class="tip-row" role="option" data-i="' + i + '">' +
             '<span class="bar">' + tipTebal(pr[0], q) + '</span>' +
             '<span class="nm">' + tipTebal(pr[1], q) + '</span>' +
             '<span class="st">' + T.esc(pr[2] + (sat ? ' ' + sat : '')) + '</span></div>');
    }
    /* Kalau hasilnya jauh lebih banyak daripada yang muat, sediakan jalan
       ke katalog lengkap — bukan cuma menyuruh mengetik lebih panjang.
       Barisnya ikut bisa dipilih dengan panah dan Enter. */
    tipLagi = res.cocok > tipHasil.length;
    if (tipLagi) {
      h.push('<div class="tip-row tip-lagi" role="option" data-i="' + tipHasil.length + '">' +
             '<span class="nm">Lihat semua <b>' + res.cocok + '</b> produk yang cocok dengan "' +
             T.esc(q) + '"</span><span class="st">buka katalog &#8594;</span></div>');
    }
    h.push('<div class="tip-foot">' +
           (tipMode === 'cari'
              ? 'Enter atau klik untuk menambahkan sebagai baris label baru.'
              : 'Enter atau klik untuk mengisi baris ini.') +
           '</div>');

    var tip = $('tip');
    tip.innerHTML = h.join('');
    tip.hidden = false;
    tipPosisi();
    inp.setAttribute('aria-expanded', 'true');
  }

  /* Menempatkan daftar di bawah sel, dibalik ke atas kalau mentok layar.
     Dipanggil ulang saat tabel digulir — bukan ditutup. Memfokuskan sel
     di tabel panjang membuat tabelnya ikut menggulir sedikit, dan kalau
     gulir itu menutup daftarnya, daftarnya hilang tepat saat dibuka. */
  function tipPosisi() {
    var tip = $('tip');
    if (tip.hidden || !tipInput) return;
    var r = tipInput.getBoundingClientRect();
    if (tipMode === 'sel') {
      var wrap = $('tableWrap').getBoundingClientRect();
      /* sel sudah tergulir keluar dari area tabel -> baru ditutup */
      if (r.bottom < wrap.top - 2 || r.top > wrap.bottom + 2) { tipTutup(); return; }
    }

    var lebar = Math.max(r.width, 420);
    if (lebar > window.innerWidth - 16) lebar = window.innerWidth - 16;
    tip.style.width = lebar + 'px';
    var kiri = Math.min(r.left, window.innerWidth - lebar - 8);
    tip.style.left = Math.max(8, kiri) + 'px';

    var tinggi = tip.offsetHeight;
    var bawah = window.innerHeight - r.bottom;
    if (bawah < tinggi + 12 && r.top > bawah) tip.style.top = Math.max(8, r.top - tinggi - 4) + 'px';
    else tip.style.top = (r.bottom + 4) + 'px';
  }

  function tipSorot(n) {
    var baris = els('#tip .tip-row');
    if (!baris.length) return;
    if (n < 0) n = baris.length - 1;
    if (n >= baris.length) n = 0;
    tipAktif = n;
    for (var i = 0; i < baris.length; i++) {
      var c = baris[i].className.replace(/\s*is-on\b/g, '');
      baris[i].className = c + (i === n ? ' is-on' : '');
    }
    if (baris[n].scrollIntoView) baris[n].scrollIntoView({ block: 'nearest' });
  }

  /* Memilih rekomendasi mengisi seluruh kolom produk — ini pilihan
     sadar pengguna, jadi boleh menimpa isi sebelumnya. */
  function tipPilih(n) {
    /* baris terakhir = "lihat semua", bukan produk */
    if (tipLagi && n === tipHasil.length) {
      var q = tipQ;
      tipTutup();
      bukaKatalog(q);
      return;
    }
    var pr = tipHasil[n];
    if (!pr) { tipTutup(); return; }

    /* dari kotak pencarian: produk ditambahkan sebagai baris baru */
    if (tipMode === 'cari') {
      markUndo('tambah produk dari pencarian');
      var baru = D.rowFromProduk(pr, rows.length ? rows[rows.length - 1] : null);
      rows.push(baru);
      D.fillMissingIds(rows);
      tipTutup();
      /* saringan dikosongkan supaya baris barunya langsung kelihatan */
      filters.q = ''; $('inSearch').value = '';
      renderTable(); schedulePreview(); doSave();
      toast('Ditambahkan: ' + pr[0] + ' — ' + pr[1]);
      var sel = el('#gridBody tr:last-child input[data-k="qty"]');
      if (sel) { sel.focus(); sel.select(); }
      return;
    }

    var i = tipBaris;
    if (!rows[i]) { tipTutup(); return; }
    markUndo('ambil produk dari katalog');
    rows[i].kode = String(pr[0] || '');
    rows[i].varian = String(pr[1] || '');
    var sat = String(pr[3] || '').trim();
    rows[i].qty = (pr[2] || pr[2] === 0) ? (pr[2] + (sat ? ' ' + sat : '')) : '';
    if (pr[4]) rows[i].lokasi = String(pr[4]);
    var kolom = tipInput ? tipInput.getAttribute('data-k') : 'kode';
    tipTutup();
    renderTable(); schedulePreview(); doSave();
    var lagi = el('#gridBody tr[data-i="' + i + '"] input[data-k="' + kolom + '"]');
    if (lagi) lagi.focus();
    toast(pr[0] + ' — ' + pr[1]);
  }

  /* ========================= KATALOG PRODUK ========================= */
  var katPilih = {};

  function bukaKatalog(q) {
    katPilih = {};
    $('katCari').value = q || '';
    var info = D.dbInfo(D.dbGet());
    $('katJudul').textContent = 'Cari produk — ' + info.nama;
    renderKatalog();
    openModal('mKat');
    setTimeout(function () { try { $('katCari').focus(); } catch (e) {} }, 40);
  }

  function renderKatalog() {
    var q = $('katCari').value;
    var res = D.cariProduk(q, D.dbGet(), 300);
    var h = [], i, pr;

    if (!res.total) {
      h.push('<tr><td colspan="5" class="kosong">Katalog basis data ini kosong. ' +
             'Berkas data/katalog-*.js mungkin tidak ikut tersalin.</td></tr>');
    } else if (!res.hasil.length) {
      h.push('<tr><td colspan="5" class="kosong">Tidak ada produk yang cocok dengan "' +
             T.esc(q) + '".</td></tr>');
    } else {
      for (i = 0; i < res.hasil.length; i++) {
        pr = res.hasil[i];
        var kode = String(pr[0]);
        var dipilih = !!katPilih[kode];
        h.push('<tr data-bar="' + T.esc(kode) + '"' + (dipilih ? ' class="is-pick"' : '') + '>' +
               '<td class="kat-pick"><input type="checkbox"' + (dipilih ? ' checked' : '') +
               ' aria-label="Pilih ' + T.esc(kode) + '"></td>' +
               '<td class="bar">' + T.esc(kode) + '</td>' +
               '<td>' + T.esc(pr[1]) + '</td>' +
               '<td class="num">' + T.esc(pr[2]) + '</td>' +
               '<td>' + T.esc(pr[3] || '') + '</td></tr>');
      }
    }
    $('katBody').innerHTML = h.join('');
    $('katInfo').textContent = res.total
      ? (q ? res.cocok + ' produk cocok' +
             (res.hasil.length < res.cocok ? ' — menampilkan ' + res.hasil.length + ' teratas' : '')
           : res.total + ' produk di katalog ' + D.dbInfo(D.dbGet()).nama +
             (res.hasil.length < res.total ? ' — menampilkan ' + res.hasil.length + ' teratas' : ''))
      : '';
    syncKatPilih();
  }

  function syncKatPilih() {
    var n = 0, k;
    for (k in katPilih) if (katPilih.hasOwnProperty(k)) n++;
    $('katPilih').textContent = n ? n + ' produk dipilih' : 'Belum ada yang dipilih';
    $('katOk').disabled = !n;
    var kotak = els('#katBody tr');
    var semua = kotak.length > 0;
    for (var i = 0; i < kotak.length; i++) {
      if (!katPilih[kotak[i].getAttribute('data-bar')]) { semua = false; break; }
    }
    $('katAll').checked = semua;
  }

  function tambahDariKatalog() {
    var list = D.katalog(D.dbGet()), tambah = [], i;
    for (i = 0; i < list.length; i++) {
      if (katPilih[String(list[i][0])]) tambah.push(list[i]);
    }
    if (!tambah.length) return;
    markUndo('tambah ' + tambah.length + ' produk dari katalog');
    var prev = rows.length ? rows[rows.length - 1] : null;
    for (i = 0; i < tambah.length; i++) {
      var r = D.rowFromProduk(tambah[i], prev);
      rows.push(r); prev = r;
    }
    D.fillMissingIds(rows);
    closeModal();
    showTab('data');
    renderTable(); schedulePreview(); doSave();
    toast(tambah.length + ' produk ditambahkan ke daftar.');
  }

  /* ======================== DIALOG KONFIRMASI ========================
     Menggantikan window.confirm. Pop-up bawaan browser menampilkan nama
     domain, tidak bisa ditata, dan menghentikan seluruh halaman. */
  var askLanjut = null;

  function tanya(opsi) {
    $('askJudul').textContent = opsi.judul || 'Konfirmasi';
    $('askPesan').textContent = opsi.pesan || '';
    var ok = $('askOk');
    ok.textContent = opsi.tombol || 'Ya';
    ok.className = 'btn ' + (opsi.bahaya ? 'btn-danger btn-solid' : 'btn-primary');
    $('askBatal').textContent = opsi.batal || 'Batal';
    askLanjut = opsi.lanjut || null;
    openModal('mAsk');
    setTimeout(function () { try { ok.focus(); } catch (e) {} }, 30);
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

  function famOf(key) {
    for (var i = 0; i < T.FAMILIES.length; i++) if (T.FAMILIES[i].key === key) return T.FAMILIES[i];
    return T.FAMILIES[0];
  }

  /* Pemilih hanya menampilkan satu keluarga. Dua puluh delapan kotak
     sekaligus terlalu panjang untuk digulir di panel sempit. */
  /* Tinggi gambaran mini mengikuti bentuk kertasnya, supaya lembar
     mendatar dan label thermal tidak terlihat sama dengan A4 tegak. */
  function miniHeight(t) {
    var pp = T.PAPERS[t.paper] || T.PAPERS.a4;
    var w = pp.w, hh = pp.h, sw;
    if (t.orient === 'landscape') { sw = w; w = hh; hh = sw; }
    var v = 24 * Math.sqrt((hh / w) / (297 / 210));
    return Math.max(13, Math.min(32, Math.round(v)));
  }

  function buildTplPicker() {
    var list = T.byFamily(opts.fam), h = [], i, t, c, r, cells, n;
    for (i = 0; i < list.length; i++) {
      t = list[i];
      c = t.mini[0]; r = Math.min(t.mini[1], 12);
      cells = '';
      for (n = 0; n < c * r; n++) cells += '<i></i>';
      h.push('<button type="button" class="tpl" role="radio" aria-checked="false" data-tpl="' + t.key + '">' +
             '<span class="tpl-mini" style="height:' + miniHeight(t) + 'px;' +
             'grid-template-columns:repeat(' + c + ',1fr);' +
             'grid-template-rows:repeat(' + r + ',1fr)">' + cells + '</span>' +
             '<b>' + T.esc(t.nama) + '</b><small>' + T.esc(t.ukuran) + '</small></button>');
    }
    $('tplPicker').innerHTML = h.join('');

    els('#famTabs .famtab').forEach(function (b) {
      var on_ = b.getAttribute('data-fam') === opts.fam;
      b.className = 'famtab' + (on_ ? ' is-on' : '');
      b.setAttribute('aria-selected', on_ ? 'true' : 'false');
    });
    $('famNote').textContent = famOf(opts.fam).desc + ' ' + list.length + ' template.';
  }

  function selectTemplate(key, resetDefaults) {
    var t = T.byKey(key);
    opts.tpl = t.key;
    if (t.fam) opts.fam = t.fam;
    if (resetDefaults) {
      opts.paper = t.paper; opts.orient = t.orient;
      opts.cols = t.cols; opts.rows = t.rows;
      opts.margin = t.margin; opts.gap = t.gap;
      opts.lock = !!t.fixed || (t.cellW !== undefined);
      if (t.cellW !== undefined) { opts.cellW = t.cellW; opts.cellH = t.cellH; }
      else { opts.lock = false; }
      if (t.opts) {
        opts.qr = !!t.opts.qr; opts.barcode = !!t.opts.barcode; opts.meta = !!t.opts.meta;
        /* label rak sebaiknya ber-QR lokasi, label dus ber-QR barang */
        opts.qrPattern = t.opts.qrPattern ||
          (t.fam === 'rak' ? '{lokasi}|{sku}|{qty}' : '{sku}|{kodeDus}|{qty}|{lokasi}');
      }
      opts.pageFrom = ''; opts.pageTo = '';
    }
    if (!opts.lock) { var cs = cellSize(); opts.cellW = cs.w; opts.cellH = cs.h; }
    syncControls();
  }

  /* Salin nilai opts ke seluruh kontrol di panel. */
  function syncControls() {
    var t = T.byKey(opts.tpl);

    if (!el('#tplPicker .tpl[data-tpl="' + opts.tpl + '"]')) buildTplPicker();
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
    $('inPageFrom').value = opts.pageFrom;
    $('inPageTo').value = opts.pageTo;

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
    opts.pageFrom = $('inPageFrom').value.replace(/[^0-9]/g, '');
    opts.pageTo = $('inPageTo').value.replace(/[^0-9]/g, '');
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
  /* Kedua tampilan tetap ada di tata letak; yang berpindah cuma
     visibility dan opacity, supaya bisa dianimasikan. Atribut hidden
     tidak dipakai lagi karena display:none mematikan animasi sekaligus
     membuat pratinjau tidak terukur. */
  /* Memindahkan penanda ke tombol yang aktif. Dipanggil juga saat
     ukuran jendela berubah, karena lebar tombolnya ikut berubah. */
  function geserPenanda(indId, tombolAktif) {
    var ind = $(indId);
    if (!ind || !tombolAktif) return;
    var induk = ind.parentNode.getBoundingClientRect();
    var t = tombolAktif.getBoundingClientRect();
    ind.style.setProperty('--x', (t.left - induk.left) + 'px');
    ind.style.setProperty('--w', t.width + 'px');
  }

  function showTab(which) {
    var dataOn = which === 'data';
    /* Arah geseran mengikuti urutan tabnya: Data label di kiri,
       Template & cetak di kanan. */
    $('viewData').className = 'view' + (dataOn ? ' is-on' : ' ke-kiri');
    $('viewPrint').className = 'view' + (dataOn ? ' ke-kanan' : ' is-on');
    $('viewData').removeAttribute('hidden');
    $('viewPrint').removeAttribute('hidden');
    $('viewData').setAttribute('aria-hidden', dataOn ? 'false' : 'true');
    $('viewPrint').setAttribute('aria-hidden', dataOn ? 'true' : 'false');
    $('tabData').className = 'tab' + (dataOn ? ' is-on' : '');
    $('tabPrint').className = 'tab' + (dataOn ? '' : ' is-on');
    $('tabData').setAttribute('aria-selected', dataOn ? 'true' : 'false');
    $('tabPrint').setAttribute('aria-selected', dataOn ? 'false' : 'true');
    geserPenanda('tabInd', dataOn ? $('tabData') : $('tabPrint'));
    tipTutup();
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
      '<li><b>Dus 100 × 200 mm</b> — banner untuk sisi depan dus, 2 label per lembar A4.</li></ul>' +
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
    bindKeys();

    D.dbRestore();
    buildDbPick();
    var had = restoreState();
    opts.fam = T.byKey(opts.tpl).fam || 'rak';
    buildTplPicker();
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
      markUndo('tambah baris');
      rows.push(D.newRow(rows.length ? rows[rows.length - 1] : null));
      D.fillMissingIds(rows);
      /* baris kosong tidak akan cocok dengan saringan yang sedang aktif,
         jadi ia akan langsung tersembunyi kalau saringannya dibiarkan */
      if (filters.q) { filters.q = ''; $('inSearch').value = ''; tipTutup(); }
      renderTable(); schedulePreview(); doSave();
      var last = el('#gridBody tr:last-child input[data-k="kode"]');
      if (last) { last.focus(); last.select(); }
    });

    on($('dbBtns'), 'click', function (e) {
      var b = e.target;
      while (b && b !== this && !(b.getAttribute && b.getAttribute('data-db'))) b = b.parentNode;
      if (!b || b === this) return;
      var kunci = b.getAttribute('data-db');
      if (kunci === D.dbGet()) return;
      muatDb(kunci);
    });

    /* pilih rekomendasi dengan tetikus */
    on($('tip'), 'mousedown', function (e) { e.preventDefault(); });   /* jangan lepas fokus */
    on($('tip'), 'click', function (e) {
      var b = e.target;
      while (b && b !== this && !(b.getAttribute && b.getAttribute('data-i'))) b = b.parentNode;
      if (!b || b === this) return;
      tipPilih(parseInt(b.getAttribute('data-i'), 10));
    });
    on($('tip'), 'mousemove', function (e) {
      var b = e.target;
      while (b && b !== this && !(b.getAttribute && b.getAttribute('data-i'))) b = b.parentNode;
      if (b && b !== this) tipSorot(parseInt(b.getAttribute('data-i'), 10));
    });
    /* tutup saat pindah fokus, menggulir tabel, atau ukuran jendela berubah */
    on($('gridBody'), 'focusout', function () { setTimeout(function () {
      var a = document.activeElement;
      if (!a || !a.getAttribute || !a.getAttribute('data-k')) tipTutup();
    }, 0); });
    on($('tableWrap'), 'scroll', tipPosisi);
    on(window, 'resize', tipTutup);

    on($('btnKatalog'), 'click', bukaKatalog);
    on($('katCari'), 'input', renderKatalog);
    on($('katOk'), 'click', tambahDariKatalog);
    on($('katAll'), 'change', function () {
      var v = this.checked;
      els('#katBody tr').forEach(function (tr) {
        var bar = tr.getAttribute('data-bar');
        if (!bar) return;
        if (v) katPilih[bar] = 1; else delete katPilih[bar];
      });
      renderKatalog();
    });
    on($('katBody'), 'click', function (e) {
      var tr = e.target;
      while (tr && tr !== this && tr.tagName !== 'TR') tr = tr.parentNode;
      if (!tr || tr === this) return;
      var bar = tr.getAttribute('data-bar');
      if (!bar) return;
      if (katPilih[bar]) delete katPilih[bar]; else katPilih[bar] = 1;
      tr.className = katPilih[bar] ? 'is-pick' : '';
      var cb = tr.querySelector('input[type=checkbox]');
      if (cb) cb.checked = !!katPilih[bar];
      syncKatPilih();
    });

    on($('btnUndo'), 'click', doUndo);
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
      markUndo('pecah per dus');
      rows = out;
      D.fillMissingIds(rows);
      renderTable(); schedulePreview(); doSave();
      toast('Selesai. Sekarang ada ' + rows.length + ' baris.');
    });

    on($('btnRenum'), 'click', function () {
      markUndo('nomori ulang');
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
      markUndo('gandakan ' + n + ' baris');
      rows = out; D.fillMissingIds(rows);
      renderTable(); schedulePreview(); doSave();
      toast(n + ' baris digandakan.');
    });

    on($('btnDelSel'), 'click', function () {
      var keep = [], n = 0, i;
      for (i = 0; i < rows.length; i++) { if (rows[i]._on) n++; else keep.push(rows[i]); }
      if (!n) { toast('Centang dulu baris yang mau dihapus.'); return; }
      tanya({
        judul: 'Hapus ' + n + ' baris?',
        pesan: 'Baris yang dicentang akan dihapus dari daftar. Bisa dibatalkan lagi '
             + 'lewat tombol Urungkan atau Ctrl+Z.',
        tombol: 'Hapus ' + n + ' baris', bahaya: true,
        lanjut: function () {
          markUndo('hapus ' + n + ' baris');
          rows = keep;
          renderTable(); schedulePreview(); doSave();
          toast(n + ' baris dihapus.');
        }
      });
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
        markUndo('isi data contoh');
        rows = D.sampleRows();
        renderTable(); schedulePreview(); doSave();
        toast('12 baris contoh dimasukkan.');
      } else if (act === 'clear') {
        tanya({
          judul: 'Kosongkan seluruh data label?',
          pesan: 'Semua ' + rows.length + ' baris akan dihapus dari basis data ini. '
               + 'Masih bisa diurungkan, tapi lebih aman buat cadangan .json dulu.',
          tombol: 'Kosongkan', bahaya: true,
          lanjut: function () {
            markUndo('kosongkan data');
            rows = []; D.wipe();
            renderTable(); schedulePreview(); doSave();
            toast('Data dikosongkan.');
          }
        });
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
      else if (s === 'manual') { markUndo('tambah baris'); rows.push(D.newRow(null)); D.fillMissingIds(rows); renderTable(); doSave(); }
      else if (s === 'sample') { markUndo('isi data contoh'); rows = D.sampleRows(); renderTable(); schedulePreview(); doSave(); }
    });

    /* ---- pencarian & saringan ---- */
    on($('inSearch'), 'input', function () {
      filters.q = this.value.trim();
      renderTable();
      /* Mengetik di sini bukan cuma menyaring baris yang sudah ada —
         katalog produk ikut dicari, supaya bisa langsung menambah
         barang yang belum pernah dimasukkan. */
      if (filters.q.length >= 1) tipBuka(this, filters.q, 'cari');
      else tipTutup();
    });
    on($('inSearch'), 'focus', function () {
      if (this.value.trim().length >= 1) tipBuka(this, this.value.trim(), 'cari');
    });
    on($('inSearch'), 'blur', function () {
      setTimeout(function () { if (tipMode === 'cari') tipTutup(); }, 160);
    });
    on($('inSearch'), 'keydown', function (e) {
      if ($('tip').hidden || tipInput !== this) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); tipSorot(tipAktif + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); tipSorot(tipAktif - 1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        tipPilih(tipAktif >= 0 ? tipAktif : 0);
      } else if (e.key === 'Escape') { e.preventDefault(); tipTutup(); }
    });
    on($('fZona'), 'change', function () { filters.zona = this.value; renderTable(); });
    on($('fStatus'), 'change', function () { filters.status = this.value; renderTable(); });
    on($('fOnlyChecked'), 'change', function () { filters.onlyChecked = this.checked; renderTable(); });

    /* ---- panel cetak ---- */
    on($('famTabs'), 'click', function (e) {
      var b = e.target;
      while (b && b !== this && !(b.getAttribute && b.getAttribute('data-fam'))) b = b.parentNode;
      if (!b || b === this) return;
      var fam = b.getAttribute('data-fam');
      if (fam === opts.fam) return;
      opts.fam = fam;
      buildTplPicker();
      /* pindah ke template pertama keluarga itu supaya pratinjau ikut berganti */
      var first = T.byFamily(fam)[0];
      if (first) selectTemplate(first.key, true);
      schedulePreview(); saveSoon();
    });

    on($('tplPicker'), 'click', function (e) {
      var b = e.target;
      while (b && b !== this && !(b.getAttribute && b.getAttribute('data-tpl'))) b = b.parentNode;
      if (!b || b === this) return;
      selectTemplate(b.getAttribute('data-tpl'), true);
      schedulePreview(); saveSoon();
    });

    ['selPaper', 'selOrient', 'inPaperW', 'inPaperH', 'chkLock', 'inCellW', 'inCellH',
     'inCols', 'inRows', 'inMargin', 'inGap', 'inCopies', 'inQRPattern',
     'inPageFrom', 'inPageTo',
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

    /* ---- tombol pada kanvas kosong ---- */
    on($('canvasEmpty'), 'click', function (e) {
      var b = e.target;
      while (b && b !== this && !(b.getAttribute && b.getAttribute('data-ce'))) b = b.parentNode;
      if (!b || b === this) return;
      var act = b.getAttribute('data-ce');
      if (act === 'sample') {
        markUndo('isi data contoh');
        rows = D.sampleRows();
        renderTable(); schedulePreview(); doSave();
        toast('12 baris contoh dimasukkan.');
      } else if (act === 'import') {
        showTab('data'); $('fileIn').value = ''; $('fileIn').click();
      } else if (act === 'data') {
        showTab('data');
      } else if (act === 'checkall') {
        markUndo('centang semua baris');
        for (var i = 0; i < rows.length; i++) rows[i]._on = true;
        renderTable(); schedulePreview(); doSave();
      } else if (act === 'resetrange') {
        opts.pageFrom = ''; opts.pageTo = '';
        syncControls(); schedulePreview(); saveSoon();
      }
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
    on($('sumOk'), 'click', function () {
      closeModal();
      var plan = planSheets();
      /* menyiapkan ratusan lembar butuh beberapa detik; beri kabar dulu
         supaya tidak terlihat seperti menggantung */
      if (plan.dicetak > 8) toast('Menyiapkan ' + plan.dicetak + ' lembar…');
      setTimeout(doPrint, plan.dicetak > 8 ? 120 : 60);
    });
    on($('btnCalib'), 'click', printCalibration);

    /* ---- modal ---- */
    on($('askOk'), 'click', function () {
      var f = askLanjut; askLanjut = null;
      closeModal();
      if (f) setTimeout(f, 60);
    });
    on($('mapOk'), 'click', confirmMapping);
    on($('backdrop'), 'click', closeModal);
    els('[data-close]').forEach(function (b) { on(b, 'click', closeModal); });
    on(document, 'keydown', function (e) {
      if (e.key === 'Escape' && openId) closeModal();
      /* Ctrl+Z hanya diambil alih di luar kotak isian — di dalam kotak,
         urungkan bawaan browser yang lebih tepat. */
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        var t = e.target, tag = t && t.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !openId) {
          e.preventDefault();
          doUndo();
        }
      }
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

    /* tempatkan penanda tanpa animasi saat pertama kali */
    ['tabInd', 'dbInd'].forEach(function (id) {
      var n = $(id); if (n) n.style.transition = 'none';
    });
    showTab('data');
    syncDbPick();
    setTimeout(function () {
      ['tabInd', 'dbInd'].forEach(function (id) {
        var n = $(id); if (n) n.style.transition = '';
      });
    }, 60);

    on(window, 'resize', function () {
      geserPenanda('tabInd', $('tabData').className.indexOf('is-on') >= 0 ? $('tabData') : $('tabPrint'));
      syncDbPick();
    });

    refreshUndo();
    $('statRight').textContent = 'Data disimpan di komputer ini saja.';
    schedulePreview();
  }

  function anyChecked() {
    for (var i = 0; i < rows.length; i++) if (rows[i]._on) return true;
    return false;
  }

  /* dipakai uji/ untuk menyuntik data dalam jumlah besar */
  window.__setRows = function (list) {
    rows = list;
    renderTable(); schedulePreview();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, false);
  } else {
    init();
  }

})(window, document);
