/* =====================================================================
   templates.js — definisi kertas + sembilan template label.
   Setiap render() mengembalikan potongan HTML untuk satu label.
   Semua ukuran di dalam label memakai mm.
   ===================================================================== */
(function (window) {
  'use strict';

  var LG = window.LG = window.LG || {};
  var D = LG.data;

  /* ------------------------------------------------------------------
     UKURAN KERTAS
     ------------------------------------------------------------------ */
  var PAPERS = {
    a4:       { t: 'A4 — 210 × 297 mm',         w: 210, h: 297 },
    f4:       { t: 'F4 / Folio — 215 × 330 mm', w: 215, h: 330 },
    letter:   { t: 'Letter — 216 × 279 mm',     w: 216, h: 279 },
    a5:       { t: 'A5 — 148 × 210 mm',         w: 148, h: 210 },
    t100x50:  { t: 'Thermal 100 × 50 mm',       w: 100, h: 50 },
    t100x100: { t: 'Thermal 100 × 100 mm',      w: 100, h: 100 },
    custom:   { t: 'Ukuran sendiri…',           w: 100, h: 150 }
  };
  var PAPER_ORDER = ['a4', 'f4', 'letter', 'a5', 't100x50', 't100x100', 'custom'];

  /* ------------------------------------------------------------------
     PEMBANTU
     ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var ZMAP = {
    hijau: 'z-hijau', green: 'z-hijau', ok: 'z-hijau',
    merah: 'z-merah', red: 'z-merah',
    kuning: 'z-kuning', yellow: 'z-kuning',
    'new': 'z-new', baru: 'z-new',
    hold: 'z-hold', tahan: 'z-hold'
  };
  var SMAP = {
    ready: 'st-ready', siap: 'st-ready', ok: 'st-ready',
    pending: 'st-pending', tunggu: 'st-pending', proses: 'st-pending',
    'new': 'st-new', baru: 'st-new',
    hold: 'st-hold', tahan: 'st-hold',
    rusak: 'st-rusak', damaged: 'st-rusak', reject: 'st-rusak'
  };

  function zCls(v) { return ZMAP[D.norm(v)] || 'z-lain'; }
  function sCls(v) { return SMAP[D.norm(v)] || 'st-lain'; }

  /* Tinggi huruf yang muat dalam lebar tertentu.
     Dihitung dari panjang teks, bukan dari pengukuran DOM, supaya
     ratusan label tetap cepat dirender. */
  function fit(text, availMm, maxMm, ratio) {
    var n = String(text == null ? '' : text).length || 1;
    var f = availMm / (n * (ratio || 0.52));
    if (f > maxMm) f = maxMm;
    if (f < 2.2) f = 2.2;
    return Math.round(f * 100) / 100;
  }

  /* ---- QR ---- */
  var qrOK = (typeof window.qrcode !== 'undefined');
  function qrSvg(text) {
    if (!qrOK || !text) return '';
    var q;
    try {
      q = window.qrcode(0, 'M');
      q.addData(String(text));
      q.make();
    } catch (e) { return ''; }
    var n = q.getModuleCount(), r, c, d = '', quiet = 2, s = n + quiet * 2;
    for (r = 0; r < n; r++) {
      for (c = 0; c < n; c++) {
        if (q.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
      }
    }
    return '<svg class="qr" viewBox="0 0 ' + s + ' ' + s + '" preserveAspectRatio="xMidYMid meet" ' +
           'shape-rendering="crispEdges" aria-hidden="true">' +
           '<rect width="' + s + '" height="' + s + '" fill="#FFFFFF"/>' +
           '<path transform="translate(' + quiet + ',' + quiet + ')" fill="#000000" d="' + d + '"/></svg>';
  }

  /* ---- barcode: kerangka saja, diisi app.js setelah masuk DOM ---- */
  var bcOK = (typeof window.JsBarcode !== 'undefined');
  function bcSvg(text) {
    if (!bcOK || !text) return '';
    return '<svg class="bc" data-bc="' + esc(text) + '" aria-hidden="true"></svg>';
  }

  function qrText(row, pattern) {
    var p = pattern || '{sku}|{kodeDus}|{qty}|{lokasi}';
    return p.replace(/\{(\w+)\}/g, function (m, k) {
      if (k === 'dusText') return D.dusText(row);
      if (k === 'bigCode') return D.bigCode(row);
      if (k === 'tanggal') return D.fmtDate(row.tanggal);
      return row[k] == null ? '' : String(row[k]);
    }).replace(/\|{2,}/g, '|').replace(/^\||\|$/g, '');
  }

  /* barcode dibuat dari kode dus bila ada, kalau tidak dari kode besar */
  function bcText(row) {
    return String(row.kodeDus || '').trim() || D.bigCode(row);
  }

  function lokasiOf(row, o) {
    return o.blankLokasi ? '' : String(row.lokasi || '').trim();
  }

  function subOf(row) {
    var sku = String(row.sku || '').trim();
    var vr = String(row.varian || '').trim();
    if (sku && vr) return esc(sku) + ' <em>·</em> ' + esc(vr);
    return esc(sku || vr);
  }

  function subPlain(row) {
    var sku = String(row.sku || '').trim(), vr = String(row.varian || '').trim();
    return sku && vr ? sku + ' · ' + vr : (sku || vr);
  }

  /* ==================================================================
     1. LABEL RAK — 100 × 25 mm (ukuran pasti)
     ================================================================== */
  function renderRak100(row, o) {
    var loc = lokasiOf(row, o) || String(row.kode || '').trim() || D.bigCode(row);
    var useQr = o.qr && qrOK;
    /* lebar tersisa untuk kode lokasi: 100 − pita − sisi kanan − padding − garis */
    var avail = 100 - 4.5 - 0.6 - 3.2 - (useQr ? 18.2 : 0) - 6.4;
    var fs = fit(loc, avail, 15, 0.5) * o.k;

    var meta = [];
    if (subPlain(row)) meta.push('<span class="sku">' + esc(subPlain(row)) + '</span>');
    if (row.qty) meta.push('<span class="qty">' + esc(row.qty) + '</span>');
    if (D.dusText(row)) meta.push('<span class="dus">' + esc(D.dusText(row)) + '</span>');
    if (o.meta && row.tanggal) meta.push('<span class="dus">' + esc(D.fmtDate(row.tanggal)) + '</span>');

    return '' +
      '<div class="band"></div>' +
      '<div class="r-main">' +
        '<div class="big r-loc" data-fit style="font-size:' + fs + 'mm">' + esc(loc || '—') + '</div>' +
        (meta.length ? '<div class="r-meta">' + meta.join('') + '</div>' : '') +
      '</div>' +
      '<div class="r-side">' +
        (useQr ? qrSvg(qrText(row, o.qrPattern)) : '') +
        (row.zona ? '<div class="chip">' + esc(row.zona) + '</div>' : '') +
      '</div>';
  }

  /* ==================================================================
     2. LABEL DUS — 100 × 250 mm (ukuran pasti)
     ================================================================== */
  function renderDus250(row, o) {
    var code = D.bigCode(row);
    var fs = fit(code, 91.2, 34, 0.5) * o.k;
    var loc = lokasiOf(row, o);
    var useQr = o.qr && qrOK;
    var useBc = o.barcode && bcOK;

    function drow(lb, vl, cls) {
      return '<div class="d-row ' + (cls || '') + '">' +
               '<div class="lb">' + esc(lb) + '</div>' +
               '<div class="vl">' + (vl === '' ? '&nbsp;' : esc(vl)) + '</div>' +
             '</div>';
    }

    var list = '';
    list += drow('Qty / Dus', row.qty || '—');
    list += drow('Dus', D.dusText(row) || '—');
    if (o.meta) list += drow('Supplier', row.supplier || '—', 'sm');
    list += drow('GRN / SJ', row.grn || '—', 'sm');
    list += drow('Lokasi', loc, 'write');

    var codes = '';
    if (useQr || useBc) {
      codes = '<div class="d-codes">' +
        (useQr ? qrSvg(qrText(row, o.qrPattern)) : '') +
        (useBc ? '<div class="bcwrap">' + bcSvg(bcText(row)) +
                 '<div class="bctxt">' + esc(bcText(row)) + '</div></div>' : '') +
        '</div>';
    } else {
      codes = '<div class="d-codes"></div>';
    }

    var foot = '';
    if (o.meta) {
      foot = '<div class="d-foot"><span>' + esc(D.fmtDate(row.tanggal) || '—') + '</span>' +
             '<span>' + esc(row.pic || '') + '</span></div>';
    } else {
      foot = '<div class="d-foot"><span>' + esc(row.pic || '') + '</span><span></span></div>';
    }

    return '' +
      '<div class="tbar"><span>Label Dus</span><span class="id">' + esc(row.labelId || '') + '</span></div>' +
      '<div class="d-body">' +
        '<div class="d-hero">' +
          '<div class="big" data-fit style="font-size:' + fs + 'mm">' + esc(code || '—') + '</div>' +
          (subPlain(row) ? '<div class="sub">' + subOf(row) + '</div>' : '') +
        '</div>' +
        '<div class="d-rule"></div>' +
        '<div class="d-list">' + list + '</div>' +
        codes +
        '<div class="d-chips">' +
          '<div class="chip">' + esc(row.zona || '—') + '</div>' +
          '<div class="chip s">' + esc(row.status || '—') + '</div>' +
        '</div>' +
        foot +
      '</div>';
  }

  /* ==================================================================
     3. DUS STANDAR — 2 × 4
     ================================================================== */
  function renderDus8(row, o) {
    var code = D.bigCode(row);
    var useQr = o.qr && qrOK;
    var avail = o.cw - 3.5 - 6 - (useQr ? 22 : 0) - 0.6;
    var fs = fit(code, avail, o.ch * 0.30, 0.5) * o.k;
    var loc = lokasiOf(row, o);

    function r(lb, vl, cls) {
      return '<div class="g-r ' + (cls || '') + '"><b>' + esc(lb) + '</b>' +
             '<span>' + (vl === '' ? '&nbsp;' : esc(vl)) + '</span></div>';
    }

    return '' +
      '<div class="band"></div>' +
      '<div class="g-main">' +
        '<div class="g-top"><span>Label Dus</span><span class="id">' + esc(row.labelId || '') + '</span></div>' +
        '<div class="g-mid">' +
          '<div class="g-code">' +
            '<div class="big" data-fit style="font-size:' + fs + 'mm">' + esc(code || '—') + '</div>' +
            (subPlain(row) ? '<div class="sub">' + subOf(row) + '</div>' : '') +
          '</div>' +
          (useQr ? qrSvg(qrText(row, o.qrPattern)) : '') +
        '</div>' +
        '<div class="g-rows">' +
          r('Qty / Dus', row.qty || '—') +
          r('Dus', D.dusText(row) || '—') +
          r('Lokasi', loc, 'write') +
        '</div>' +
        '<div class="g-foot">' +
          '<div class="chip">' + esc(row.zona || '—') + '</div>' +
          '<div class="chip s">' + esc(row.status || '—') + '</div>' +
          (o.meta ? '<div class="when">' + esc(D.fmtDate(row.tanggal)) + '</div>' : '') +
        '</div>' +
      '</div>';
  }

  /* ==================================================================
     4. DUS RINGKAS — 3 × 4
     ================================================================== */
  function renderDus12(row, o) {
    var code = D.bigCode(row);
    var fs = fit(code, o.cw - 8, o.ch * 0.26, 0.5) * o.k;
    var loc = lokasiOf(row, o);

    function r(lb, vl, cls) {
      return '<div class="c-r ' + (cls || '') + '"><b>' + esc(lb) + '</b>' +
             '<span>' + (vl === '' ? '&nbsp;' : esc(vl)) + '</span></div>';
    }

    return '' +
      '<div class="c-top"><span>' + esc(row.labelId || '') + '</span>' +
        '<span>' + esc(o.meta ? D.fmtDate(row.tanggal) : '') + '</span></div>' +
      '<div class="c-hero">' +
        '<div class="big" data-fit style="font-size:' + fs + 'mm">' + esc(code || '—') + '</div>' +
        (subPlain(row) ? '<div class="sub">' + subOf(row) + '</div>' : '') +
      '</div>' +
      '<div class="c-rows">' +
        r('Qty', row.qty || '—') +
        r('Dus', D.dusText(row) || '—') +
        r('Lokasi', loc, 'write') +
      '</div>' +
      '<div class="c-foot">' +
        '<div class="chip">' + esc(row.zona || '—') + '</div>' +
        '<div class="chip s">' + esc(row.status || '—') + '</div>' +
      '</div>';
  }

  /* ==================================================================
     5. DUS BESAR — 2 × 2 + barcode
     ================================================================== */
  function renderDus4(row, o) {
    var code = D.bigCode(row);
    var useQr = o.qr && qrOK;
    var useBc = o.barcode && bcOK;
    var avail = o.cw - 7 - (useQr ? 30 : 0) - 0.8;
    var fs = fit(code, avail, o.ch * 0.22, 0.5) * o.k;
    var loc = lokasiOf(row, o);

    function r(lb, vl, cls) {
      return '<div class="b-r ' + (cls || '') + '"><b>' + esc(lb) + '</b>' +
             '<span>' + (vl === '' ? '&nbsp;' : esc(vl)) + '</span></div>';
    }

    return '' +
      '<div class="tbar"><span>Label Dus</span><span class="id">' + esc(row.labelId || '') + '</span></div>' +
      '<div class="b-body">' +
        '<div class="b-hero">' +
          '<div class="txt">' +
            '<div class="big" data-fit style="font-size:' + fs + 'mm">' + esc(code || '—') + '</div>' +
            (subPlain(row) ? '<div class="sub">' + subOf(row) + '</div>' : '') +
          '</div>' +
          (useQr ? qrSvg(qrText(row, o.qrPattern)) : '') +
        '</div>' +
        '<div class="b-rows">' +
          r('Qty / Dus', row.qty || '—') +
          r('Dus', D.dusText(row) || '—') +
          (o.meta ? r('Supplier', row.supplier || '—') : '') +
          r('Lokasi', loc, 'write') +
        '</div>' +
        (useBc ? '<div class="b-bc">' + bcSvg(bcText(row)) +
                 '<div class="bctxt">' + esc(bcText(row)) + '</div></div>' : '') +
        '<div class="b-foot">' +
          '<div class="chip">' + esc(row.zona || '—') + '</div>' +
          '<div class="chip s">' + esc(row.status || '—') + '</div>' +
        '</div>' +
      '</div>';
  }

  /* ==================================================================
     6. LABEL RAK / BIN — 2 × 6 strip
     ================================================================== */
  function renderRak(row, o) {
    var loc = lokasiOf(row, o) || String(row.kode || '').trim() || D.bigCode(row);
    var useQr = o.qr && qrOK;
    var avail = o.cw - 4 - 5 - (useQr ? 17 : 0) - (row.zona ? 6.5 : 0) - 2;
    var fs = fit(loc, avail, o.ch * 0.55, 0.5) * o.k;

    var meta = [];
    if (subPlain(row)) meta.push('<span><b>' + esc(subPlain(row)) + '</b></span>');
    if (row.qty) meta.push('<span>' + esc(row.qty) + '</span>');
    if (D.dusText(row)) meta.push('<span>' + esc(D.dusText(row)) + '</span>');

    return '' +
      '<div class="band"></div>' +
      '<div class="k-main">' +
        '<div class="big" data-fit style="font-size:' + fs + 'mm">' + esc(loc || '—') + '</div>' +
        (meta.length ? '<div class="k-meta">' + meta.join('') + '</div>' : '') +
      '</div>' +
      '<div class="k-side">' +
        (useQr ? qrSvg(qrText(row, o.qrPattern)) : '') +
        (row.zona ? '<div class="chip">' + esc(row.zona) + '</div>' : '') +
      '</div>';
  }

  /* ==================================================================
     7. MINI — 4 × 6 stiker kecil
     ================================================================== */
  function renderMini(row, o) {
    var code = D.bigCode(row);
    var fs = fit(code, o.cw - 5, o.ch * 0.38, 0.5) * o.k;
    var loc = lokasiOf(row, o);
    return '' +
      '<div class="big" data-fit style="font-size:' + fs + 'mm">' + esc(code || '—') + '</div>' +
      (subPlain(row) ? '<div class="m-sub">' + subOf(row) + '</div>' : '') +
      '<div class="m-row"><span>' + esc(row.qty || '') + '</span>' +
        '<span>' + esc(D.dusText(row)) + '</span></div>' +
      '<div class="m-row"><span>' + esc(loc || '·····') + '</span>' +
        '<span>' + esc(row.zona || '') + '</span></div>';
  }

  /* ==================================================================
     8. THERMAL — 1 label per lembar
     ================================================================== */
  function renderThermal(row, o) {
    var code = D.bigCode(row);
    var useQr = o.qr && qrOK;
    var useBc = o.barcode && bcOK;
    var avail = o.cw - 5 - (useQr ? 25 : 0) - 0.8;
    var fs = fit(code, avail, o.ch * 0.30, 0.5) * o.k;
    var loc = lokasiOf(row, o);

    return '' +
      '<div class="t-top"><span>' + esc(row.labelId || '') + '</span>' +
        '<span>' + esc(o.meta ? D.fmtDate(row.tanggal) : '') + '</span></div>' +
      '<div class="t-mid">' +
        '<div class="t-txt">' +
          '<div class="big" data-fit style="font-size:' + fs + 'mm">' + esc(code || '—') + '</div>' +
          (subPlain(row) ? '<div class="sub">' + subOf(row) + '</div>' : '') +
          '<div class="meta">' + esc(row.qty || '') +
            (D.dusText(row) ? ' · ' + esc(D.dusText(row)) : '') +
            (loc ? ' · ' + esc(loc) : '') + '</div>' +
        '</div>' +
        (useQr ? qrSvg(qrText(row, o.qrPattern)) : '') +
      '</div>' +
      (useBc ? '<div class="t-bc">' + bcSvg(bcText(row)) + '</div>' : '') +
      '<div class="t-foot">' +
        '<div class="chip">' + esc(row.zona || '—') + '</div>' +
        '<div class="chip s">' + esc(row.status || '—') + '</div>' +
      '</div>';
  }

  /* ==================================================================
     9. KARTU GANTUNG — 2 × 2, status raksasa
     ================================================================== */
  function renderTag(row, o) {
    var st = String(row.status || '—').trim();
    var fsS = fit(st, o.cw - 10, o.ch * 0.20, 0.52) * o.k;
    var loc = lokasiOf(row, o);
    var useQr = o.qr && qrOK;

    function r(lb, vl, cls) {
      return '<div class="t-r ' + (cls || '') + '"><b>' + esc(lb) + '</b>' +
             '<span>' + (vl === '' ? '&nbsp;' : esc(vl)) + '</span></div>';
    }

    return '' +
      '<div class="hole"></div>' +
      '<div class="t-head"></div>' +
      '<div class="t-status" data-fit style="font-size:' + fsS + 'mm">' + esc(st) + '</div>' +
      '<div class="t-code">' +
        '<div class="sub">' + esc(D.bigCode(row) || '—') +
          (subPlain(row) ? ' · ' + esc(subPlain(row)) : '') + '</div>' +
      '</div>' +
      '<div class="t-rows">' +
        r('Qty / Dus', row.qty || '—') +
        r('Dus', D.dusText(row) || '—') +
        (o.meta ? r('Tanggal', D.fmtDate(row.tanggal) || '—') : '') +
        r('Lokasi', loc, 'write') +
      '</div>' +
      '<div class="t-foot">' +
        (useQr ? qrSvg(qrText(row, o.qrPattern)) : '') +
        '<div class="t-zone"><div class="chip">' + esc(row.zona || '—') + '</div></div>' +
      '</div>';
  }

  /* ==================================================================
     DAFTAR TEMPLATE
     fixed:true  -> ukuran label dikunci dan tidak boleh diubah
     mini        -> gambaran kecil di pemilih template (kolom, baris)
     ================================================================== */
  var TEMPLATES = [
    {
      key: 'rak100', nama: 'Rak 100 × 25', ukuran: '100 × 25 mm',
      cls: 'lbl-rak100', fixed: true,
      desc: 'Strip rak 10 × 2,5 cm. Kode lokasi terbaca dari 3 meter. 20 label per lembar A4.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 10,
      cellW: 100, cellH: 25, margin: 4, gap: 2,
      opts: { qr: true, barcode: false, meta: false },
      mini: [2, 10], render: renderRak100
    },
    {
      key: 'dus250', nama: 'Dus 100 × 250', ukuran: '100 × 250 mm',
      cls: 'lbl-dus250', fixed: true,
      desc: 'Banner tegak 10 × 25 cm untuk sisi depan dus. 2 label per lembar A4.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 1,
      cellW: 100, cellH: 250, margin: 4, gap: 4,
      opts: { qr: true, barcode: true, meta: true },
      mini: [2, 1], render: renderDus250
    },
    {
      key: 'dus8', nama: 'Dus standar', ukuran: '2 × 4 per A4',
      cls: 'lbl-dus8',
      desc: 'Pengganti sheet PRINT_LABEL_8UP. Delapan label per lembar.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 4,
      margin: 6, gap: 4,
      opts: { qr: true, barcode: false, meta: true },
      mini: [2, 4], render: renderDus8
    },
    {
      key: 'dus12', nama: 'Dus ringkas', ukuran: '3 × 4 per A4',
      cls: 'lbl-dus12',
      desc: 'Dua belas label kecil per lembar untuk dus bertumpuk.',
      paper: 'a4', orient: 'portrait', cols: 3, rows: 4,
      margin: 6, gap: 3,
      opts: { qr: false, barcode: false, meta: true },
      mini: [3, 4], render: renderDus12
    },
    {
      key: 'dus4', nama: 'Dus besar', ukuran: '2 × 2 per A4',
      cls: 'lbl-dus4',
      desc: 'Empat label besar dengan barcode CODE128.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 2,
      margin: 6, gap: 4,
      opts: { qr: true, barcode: true, meta: true },
      mini: [2, 2], render: renderDus4
    },
    {
      key: 'rak', nama: 'Rak / bin', ukuran: '2 × 6 per A4',
      cls: 'lbl-rak',
      desc: 'Strip rak proporsional. Ukurannya ikut kertas, bukan dikunci.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 6,
      margin: 6, gap: 3,
      opts: { qr: true, barcode: false, meta: false },
      mini: [2, 6], render: renderRak
    },
    {
      key: 'mini24', nama: 'Mini', ukuran: '4 × 6 per A4',
      cls: 'lbl-mini',
      desc: 'Stiker kecil untuk barang satuan atau rak dalam.',
      paper: 'a4', orient: 'portrait', cols: 4, rows: 6,
      margin: 6, gap: 3,
      opts: { qr: false, barcode: false, meta: false },
      mini: [4, 6], render: renderMini
    },
    {
      key: 'thermal', nama: 'Thermal', ukuran: '100 × 50 mm',
      cls: 'lbl-thermal',
      desc: 'Satu label per lembar untuk printer thermal 100 × 50 mm.',
      paper: 't100x50', orient: 'portrait', cols: 1, rows: 1,
      margin: 2, gap: 0,
      opts: { qr: true, barcode: true, meta: true },
      mini: [1, 1], render: renderThermal
    },
    {
      key: 'tag', nama: 'Kartu gantung', ukuran: '2 × 2 per A4',
      cls: 'lbl-tag',
      desc: 'Kartu status dengan lubang gantung. Kata status dibaca dari jauh.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 2,
      margin: 8, gap: 6,
      opts: { qr: true, barcode: false, meta: true },
      mini: [2, 2], render: renderTag
    }
  ];

  function byKey(k) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].key === k) return TEMPLATES[i];
    return TEMPLATES[0];
  }

  /* ------------------------------------------------------------------ */
  LG.tpl = {
    PAPERS: PAPERS,
    PAPER_ORDER: PAPER_ORDER,
    TEMPLATES: TEMPLATES,
    byKey: byKey,
    esc: esc,
    zCls: zCls,
    sCls: sCls,
    fit: fit,
    qrSvg: qrSvg,
    qrText: qrText,
    bcText: bcText,
    hasQR: qrOK,
    hasBarcode: bcOK
  };

})(window);
