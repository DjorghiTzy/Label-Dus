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
  var qrCache = {}, qrCacheN = 0;

  function qrSvg(text) {
    if (!qrOK || !text) return '';
    if (qrCache[text] !== undefined) return qrCache[text];
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
    var svg = '<svg class="qr" viewBox="0 0 ' + s + ' ' + s + '" preserveAspectRatio="xMidYMid meet" ' +
              'shape-rendering="crispEdges" aria-hidden="true">' +
              '<rect width="' + s + '" height="' + s + '" fill="#FFFFFF"/>' +
              '<path transform="translate(' + quiet + ',' + quiet + ')" fill="#000000" d="' + d + '"/></svg>';
    /* dibatasi supaya data besar tidak menggerus ingatan browser */
    if (qrCacheN > 4000) { qrCache = {}; qrCacheN = 0; }
    qrCache[text] = svg; qrCacheN++;
    return svg;
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
    var fs = 15 * o.k;          /* ukuran puncak; app.js menyusutkan atau memecah */

    var meta = [];
    if (subPlain(row)) meta.push('<span class="sku">' + esc(subPlain(row)) + '</span>');
    if (row.qty) meta.push('<span class="qty">' + esc(row.qty) + '</span>');
    if (D.dusText(row)) meta.push('<span class="dus">' + esc(D.dusText(row)) + '</span>');
    if (o.meta && row.tanggal) meta.push('<span class="dus">' + esc(D.fmtDate(row.tanggal)) + '</span>');

    return '' +
      '<div class="band"></div>' +
      '<div class="r-main">' +
        '<div class="big r-loc" data-fit data-wrap="2" style="font-size:' + fs + 'mm">' +
        esc(loc || '—') + '</div>' +
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
    var fs = 34 * o.k;
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
          '<div class="big" data-fit data-wrap="2" style="font-size:' + fs + 'mm">' +
          esc(code || '—') + '</div>' +
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
    var fs = o.ch * 0.55 * o.k;

    var meta = [];
    if (subPlain(row)) meta.push('<span><b>' + esc(subPlain(row)) + '</b></span>');
    if (row.qty) meta.push('<span>' + esc(row.qty) + '</span>');
    if (D.dusText(row)) meta.push('<span>' + esc(D.dusText(row)) + '</span>');

    return '' +
      '<div class="band"></div>' +
      '<div class="k-main">' +
        '<div class="big" data-fit data-wrap="2" style="font-size:' + fs + 'mm">' +
        esc(loc || '—') + '</div>' +
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
     MESIN TATA LETAK BERSAMA

     Dua puluh delapan template tidak berarti dua puluh delapan blok CSS.
     Sebagian besar template hanyalah susunan blok yang sama dengan urutan
     dan tinggi berbeda, jadi tata letaknya ditulis sebagai daftar bagian:

         parts: [ {p:'title', h:1.2}, {p:'hero', h:'fill'}, ... ]

     Tinggi (h) dinyatakan dalam satuan u, bukan mm. Satu u dihitung dari
     ukuran label — u = min(lebar/10, tinggi/4) — sehingga susunan yang
     sama tetap seimbang pada strip 50 × 25 mm maupun banner A5.
     Ukuran huruf memakai satuan yang sama, dan app.js menyusutkannya lagi
     kalau ternyata tidak muat.
     ================================================================== */

  function mmv(v) { return (Math.round(v * 100) / 100) + 'mm'; }

  /* Satu u = sepersepuluh tinggi label. Artinya setiap label selalu
     setinggi 10u, berapa pun ukuran fisiknya, jadi anggaran tinggi tiap
     bagian bisa dihitung dan diperiksa:

         jumlah(h) + 2*padU + (n-1)*gapU <= 10

     Lebar tidak ikut menentukan u — ukuran huruf sudah dibatasi terhadap
     lebar oleh fit(), lalu app.js menyusutkannya lagi kalau perlu. */
  function unitOf(cw, ch) { return ch / 10; }

  /* Kolom data yang bisa dipanggil dari daftar parts. */
  var FIELD = {
    qty:      ['Qty / Dus', function (r) { return r.qty; }],
    dus:      ['Dus',       function (r) { return D.dusText(r); }],
    supplier: ['Supplier',  function (r) { return r.supplier; }],
    grn:      ['GRN / SJ',  function (r) { return r.grn; }],
    sku:      ['SKU',       function (r) { return r.sku; }],
    varian:   ['Varian',    function (r) { return r.varian; }],
    tanggal:  ['Tanggal',   function (r) { return D.fmtDate(r.tanggal); }],
    masuk:    ['Masuk',     function (r) { return D.fmtDate(r.tanggal); }],
    kadaluarsa: ['Kadaluarsa', function (r) { return D.fmtDate(r.kadaluarsa); }],
    pic:      ['PIC',       function (r) { return r.pic; }],
    kode:     ['Kode',      function (r) { return r.kode; }],
    labelId:  ['Label ID',  function (r) { return r.labelId; }],
    zona:     ['Zona',      function (r) { return r.zona; }],
    status:   ['Status',    function (r) { return r.status; }],
    catatan:  ['Catatan',   function (r) { return r.catatan; }],
    totalDus: ['Total dus', function (r) { return r.totalDus; }],
    lokasi:   ['Lokasi',    function (r, o) { return lokasiOf(r, o); }],
    skuvar:   ['SKU',       function (r) { return subPlain(r); }]
  };

  function fieldVal(key, row, o) {
    var f = FIELD[key];
    if (!f) return '';
    var v = f[1](row, o);
    return v == null ? '' : String(v);
  }
  function fieldLab(key, part) {
    if (part && part.labels && part.labels[key]) return part.labels[key];
    return FIELD[key] ? FIELD[key][0] : key;
  }

  function heroText(row, o, src) {
    if (src === 'lokasi') {
      return lokasiOf(row, o) || String(row.kode || '').trim() || D.bigCode(row);
    }
    if (src === 'status') return String(row.status || '—').trim();
    if (src === 'zona') return String(row.zona || '—').trim();
    if (src === 'tanggal') return D.fmtDate(row.tanggal) || '—';
    if (src === 'kadaluarsa') return D.fmtDate(row.kadaluarsa) || '—';
    if (src === 'dus') return D.dusText(row) || '—';
    if (src && row[src] !== undefined) return String(row[src] || '').trim();
    return D.bigCode(row);
  }

  /* Tanda stensil peti — digambar, bukan huruf, supaya tetap terbaca
     walaupun printernya kasar. */
  var MARKS = {
    fragile: '<path d="M20 5h24l-4 20-6 4v22h8v5H22v-5h8V29l-6-4z" fill="currentColor"/>',
    up: '<path d="M16 58V22M16 8l-9 13h18zM48 58V22M48 8l-9 13h18z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>',
    dry: '<path d="M32 4v8M6 32a26 26 0 0 1 52 0zM32 32v20a7 7 0 0 1-14 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>',
    stack: '<path d="M6 12h52v16H6zM6 36h52v16H6z" fill="none" stroke="currentColor" stroke-width="5"/>',
    knife: '<path d="M8 20h30l18 12-18 12H8z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>'
  };
  function markSvg(kind, sizeMm) {
    var d = MARKS[kind];
    if (!d) return '';
    return '<svg class="gm" viewBox="0 0 64 64" aria-hidden="true" style="width:' +
           mmv(sizeMm) + '">' + d + '</svg>';
  }

  /* ---- satu bagian -> potongan HTML ---- */
  function partHTML(part, row, o, u) {
    var i, h, k, v, cls = part.cls ? ' ' + part.cls : '';

    switch (part.p) {

      case 'gap':
        return '<div class="g-gap"></div>';

      case 'rule':
        return '<div class="g-rule' + cls + '"></div>';

      case 'title':
        return '<div class="g-title tbar' + cls + '" style="font-size:' + mmv((part.size || 0.5) * u) +
               ';padding:0 ' + mmv(0.5 * u) + '">' +
               '<span>' + esc(part.text || 'Label') + '</span>' +
               (part.id === false ? '' : '<span class="id">' + esc(row.labelId || '') + '</span>') +
               '</div>';

      case 'hero':
        var ht = heroText(row, o, part.src);
        var hs = (part.size || 2.2) * u * o.k;
        return '<div class="g-hero' + cls + (part.align ? ' a-' + part.align : '') + '">' +
               '<div class="big" data-fit data-wrap="2" style="font-size:' + mmv(hs) + '">' +
               esc(ht || '—') + '</div>' +
               (part.sub === false || !subPlain(row) ? '' :
                 '<div class="g-sub" style="font-size:' + mmv((part.subSize || 0.72) * u * o.k) + '">' +
                 subOf(row) + '</div>') +
               '</div>';

      case 'meta':
        var bits = [];
        for (i = 0; i < (part.list || []).length; i++) {
          v = fieldVal(part.list[i], row, o);
          if (v) bits.push('<span>' + esc(v) + '</span>');
        }
        return '<div class="g-meta' + cls + '" style="font-size:' + mmv((part.size || 0.5) * u * o.k) +
               ';gap:' + mmv(0.5 * u) + '">' + bits.join('') + '</div>';

      case 'rows':
        h = [];
        for (i = 0; i < (part.list || []).length; i++) {
          k = part.list[i];
          v = fieldVal(k, row, o);
          h.push('<div class="g-row"><b style="font-size:' + mmv((part.labSize || 0.4) * u * o.k) +
                 ';width:' + mmv((part.labW || 2.6) * u) + '">' + esc(fieldLab(k, part)) + '</b>' +
                 '<span style="font-size:' + mmv((part.size || 0.82) * u * o.k) + '">' +
                 (v ? esc(v) : '—') + '</span></div>');
        }
        return '<div class="g-rows' + cls + '">' + h.join('') + '</div>';

      case 'write':
        v = part.blank ? '' : fieldVal(part.key || 'lokasi', row, o);
        return '<div class="g-write' + cls + '">' +
               '<b style="font-size:' + mmv((part.labSize || 0.44) * u * o.k) + '">' +
               esc(part.label || fieldLab(part.key || 'lokasi', part)) + '</b>' +
               '<span style="font-size:' + mmv((part.size || 0.95) * u * o.k) + '">' +
               (v ? esc(v) : '&nbsp;') + '</span></div>';

      case 'big2':
        v = fieldVal(part.key || 'tanggal', row, o) || '—';
        return '<div class="g-big2' + cls + '">' +
               '<b style="font-size:' + mmv((part.labSize || 0.45) * u * o.k) + '">' +
               esc(part.label || fieldLab(part.key || 'tanggal', part)) + '</b>' +
               '<div class="big" data-fit style="font-size:' +
               mmv(fit(v, o.cw - 2.4 * u, (part.size || 1.5) * u, 0.5) * o.k) + '">' + esc(v) + '</div></div>';

      case 'route':
        var from = String(row.supplier || '—').trim();
        var to = lokasiOf(row, o);
        return '<div class="g-route' + cls + '">' +
               '<div class="rt"><b style="font-size:' + mmv(0.35 * u * o.k) + '">Dari</b>' +
               '<span data-fit style="font-size:' + mmv(fit(from, o.cw - 3 * u, (part.size || 1.1) * u, 0.5) * o.k) +
               '">' + esc(from) + '</span></div>' +
               '<div class="ar" style="font-size:' + mmv(0.45 * u) + '">&#9660;</div>' +
               '<div class="rt to"><b style="font-size:' + mmv(0.35 * u * o.k) + '">Ke lokasi</b>' +
               '<span class="wl" data-fit style="font-size:' +
               mmv(fit(to || 'XX-XX-XXX', o.cw - 3 * u, (part.size || 1.1) * u, 0.5) * o.k) + '">' +
               (to ? esc(to) : '&nbsp;') + '</span></div></div>';

      case 'codes':
        var useQ = part.qr !== false && o.qr && qrOK;
        var useB = part.bc === true && o.barcode && bcOK;
        if (!useQ && !useB) return '<div class="g-codes' + cls + '"></div>';
        return '<div class="g-codes' + cls + (useQ && !useB ? ' q-only' : '') +
               '" style="gap:' + mmv(0.5 * u) + '">' +
               (useQ ? qrSvg(qrText(row, o.qrPattern)) : '') +
               (useB ? '<div class="bcwrap"><svg class="bc" data-bc="' + esc(bcText(row)) + '"></svg>' +
                       '<div class="bctxt" style="font-size:' + mmv(0.4 * u * o.k) + '">' +
                       esc(bcText(row)) + '</div></div>' : '') +
               '</div>';

      case 'qrbig':
        if (!o.qr || !qrOK) return '<div class="g-qrbig' + cls + '"></div>';
        return '<div class="g-qrbig' + cls + '">' + qrSvg(qrText(row, o.qrPattern)) + '</div>';

      case 'bc':
        if (!o.barcode || !bcOK) return '<div class="g-bc' + cls + '"></div>';
        return '<div class="g-bc' + cls + '">' +
               '<svg class="bc" data-bc="' + esc(bcText(row)) + '"></svg>' +
               (part.text === false ? '' : '<div class="bctxt" style="font-size:' +
                 mmv(0.4 * u * o.k) + '">' + esc(bcText(row)) + '</div>') + '</div>';

      case 'chips':
        var one = part.only;
        var zc = '<div class="chip" style="font-size:' + mmv((part.size || 0.85) * u * o.k) +
                 ';border-radius:' + mmv(0.12 * u) + '">' + esc(row.zona || '—') + '</div>';
        var sc = '<div class="chip s" style="font-size:' + mmv((part.size || 0.85) * u * o.k) +
                 ';border-radius:' + mmv(0.12 * u) + '">' + esc(row.status || '—') + '</div>';
        return '<div class="g-chips' + cls + (part.dir === 'col' ? ' col' : '') +
               '" style="gap:' + mmv(0.25 * u) + '">' +
               (one === 'status' ? sc : one === 'zona' ? zc : zc + sc) + '</div>';

      case 'boxes':
        h = [];
        var bsz = mmv((part.size || 0.5) * u * 1.35);
        for (i = 0; i < (part.items || []).length; i++) {
          h.push('<div class="g-box"><i style="width:' + bsz + ';height:' + bsz +
                 '"></i><span>' + esc(part.items[i]) + '</span></div>');
        }
        return '<div class="g-boxes' + cls + '" style="font-size:' + mmv((part.size || 0.5) * u * o.k) +
               ';gap:' + mmv(0.4 * u) + '">' + h.join('') + '</div>';

      case 'marks':
        h = [];
        var mn = (part.items || []).length || 1;
        var mgap = 0.6 * u;
        var mavail = o.cw - 2 * (o.padU || 0.5) * u - (mn - 1) * mgap;
        var msz = Math.max(2, Math.min((part.h === 'fill' ? 4 : part.h) * u, mavail / mn));
        for (i = 0; i < mn; i++) h.push(markSvg(part.items[i], msz));
        return '<div class="g-marks' + cls + '" style="gap:' + mmv(mgap) + '">' + h.join('') + '</div>';

      case 'note':
        return '<div class="g-note' + cls + '" data-fit style="font-size:' +
               mmv((part.size || 0.6) * u * o.k) + ';padding:0 ' + mmv(0.3 * u) + '">' +
               esc(part.text || '') + '</div>';

      case 'foot':
        var L = part.left === undefined ? fieldVal('tanggal', row, o) : fieldVal(part.left, row, o);
        var R = part.right === undefined ? fieldVal('pic', row, o) : fieldVal(part.right, row, o);
        if (!o.meta && part.left === undefined) L = '';
        return '<div class="g-foot' + cls + '" style="font-size:' + mmv((part.size || 0.42) * u * o.k) + '">' +
               '<span>' + esc(L) + '</span><span>' + esc(R) + '</span></div>';
    }
    return '';
  }

  /* ---- daftar bagian -> fungsi render ---- */
  function makeStack(def) {
    return function (row, o) {
      /* Label tiang dirotasi 90°: isinya disusun sebagai strip mendatar
         biasa lalu diputar, supaya alur teks dan penyusutan huruf tetap
         bekerja seperti label lain. */
      var cw = def.rot ? o.ch : o.cw;
      var ch = def.rot ? o.cw : o.ch;
      var u = unitOf(cw, ch);

      var oo = {}, kk;
      for (kk in o) if (o.hasOwnProperty(kk)) oo[kk] = o[kk];
      oo.cw = cw; oo.ch = ch;
      oo.padU = def.padU === undefined ? 0.5 : def.padU;

      var tracks = [], body = [], i, part;
      for (i = 0; i < def.parts.length; i++) {
        part = def.parts[i];
        tracks.push(part.h === 'fill' ? 'minmax(0,1fr)' : part.h === 'auto' ? 'auto' : mmv(part.h * u));
        body.push(partHTML(part, row, oo, u));
      }

      /* padU / gapU memakai satuan u. Namanya sengaja berbeda dari
         'margin' dan 'gap' milik kertas, yang satuannya mm dan mengatur
         jarak antar label — bukan jarak di dalam label. */
      var padU = def.padU === undefined ? 0.5 : def.padU;
      var gapU = def.gapU === undefined ? 0.3 : def.gapU;
      var stack = '<div class="gen" style="grid-template-rows:' + tracks.join(' ') +
                  ';padding:' + mmv(padU * u) + ';row-gap:' + mmv(gapU * u) + '">' + body.join('') + '</div>';

      var band = '';
      if (def.band && def.band !== 'none') {
        band = '<div class="band" style="' + (def.band === 'top' ? 'height' : 'width') + ':' +
               mmv((def.bandW || 0.45) * u) + '"></div>';
      }

      var gwCls = 'gw' + (def.band === 'top' ? ' b-top' : '');
      var gwStyle = def.rot ? ' style="width:' + mmv(cw) + ';height:' + mmv(ch) + '"' : '';
      return '<div class="' + gwCls + '"' + gwStyle + '>' + band + stack + '</div>';
    };
  }

  /* Bungkus ringkas untuk mendaftarkan template berbasis mesin di atas. */
  function stack(def) {
    def.render = makeStack(def);
    def.cls = 'lbl-gen' + (def.rot ? ' lbl-rot' : '') + (def.flat ? ' flat' : '') +
              (def.round ? ' round' : '') + (def.cls ? ' ' + def.cls : '');
    return def;
  }

  /* ==================================================================
     DUA KELUARGA TEMPLATE

     fam:'rak'  -> ditempel di bibir rak, tiang, atau papan lorong
     fam:'dus'  -> ditempel di sisi dus

     fixed:true -> ukuran fisik dikunci, tidak boleh diubah pengguna
     ================================================================== */

  var FAMILIES = [
    { key: 'rak', nama: 'Label rak',
      desc: 'Ditempel di bibir rak, tiang, atau lorong. Dibaca sambil berjalan.' },
    { key: 'dus', nama: 'Label dus',
      desc: 'Ditempel di sisi dus. Dibaca saat berdiri di depan tumpukan.' }
  ];

  /* ------------------------------ LABEL RAK ------------------------------ */
  var RAK = [
    {
      key: 'rak100', fam: 'rak', nama: 'Strip 100 × 25', ukuran: '100 × 25 mm',
      cls: 'lbl-rak100', fixed: true,
      desc: 'Strip rak baku 10 × 2,5 cm. Kode lokasi terbaca dari 3 meter. 20 label per lembar A4.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 10,
      cellW: 100, cellH: 25, margin: 4, gap: 2,
      opts: { qr: true, barcode: false, meta: false, qrPattern: '{lokasi}|{sku}|{qty}' },
      mini: [2, 10], render: renderRak100
    },

    stack({
      key: 'rak100x38', fam: 'rak', nama: 'Strip 100 × 38', ukuran: '100 × 38 mm', fixed: true,
      desc: 'Strip lebih tinggi: lokasi besar, ditambah baris SKU dan qty yang masih terbaca dari 2 meter.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 7,
      cellW: 100, cellH: 38, margin: 4, gap: 2,
      opts: { qr: true, barcode: false, meta: false },
      mini: [2, 7], band: 'left', bandW: 0.5, padU: 0.35, gapU: 0.25,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 5.0, sub: false },
        { p: 'rows', h: 2.4, list: ['skuvar', 'qty'], labW: 3.3, labSize: .5, size: 1.0 },
        { p: 'meta', h: .8, list: ['dus', 'zona'], size: .65 }
      ]
    }),

    stack({
      key: 'rakbin50', fam: 'rak', nama: 'Kartu bin 100 × 50', ukuran: '100 × 50 mm', fixed: true,
      desc: 'Kartu bin lengkap dengan QR besar. Untuk rak picking yang sering di-scan.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 5,
      cellW: 100, cellH: 50, margin: 4, gap: 3,
      opts: { qr: true, barcode: false, meta: true },
      mini: [2, 5], band: 'left', bandW: 0.4, padU: 0.35, gapU: 0.25,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 4.4, subSize: .8 },
        { p: 'rows', h: 2.8, list: ['qty', 'dus'], labW: 3.3, labSize: .5, size: 1.0 },
        { p: 'foot', h: .8, size: .5 }
      ]
    }),

    stack({
      key: 'rak75', fam: 'rak', nama: 'Strip 75 × 25', ukuran: '75 × 25 mm', fixed: true,
      desc: 'Strip pendek untuk rak sempit. Hanya lokasi dan SKU.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 10,
      cellW: 75, cellH: 25, margin: 4, gap: 2,
      opts: { qr: false, barcode: false, meta: false },
      mini: [2, 10], band: 'left', bandW: 0.5, padU: 0.3, gapU: 0.2,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 5.8, sub: false },
        { p: 'meta', h: 1.2, list: ['skuvar', 'qty'], size: .95 }
      ]
    }),

    stack({
      key: 'rakmini50', fam: 'rak', nama: 'Bin mini 50 × 25', ukuran: '50 × 25 mm', fixed: true,
      desc: 'Label bin terkecil, 40 per lembar A4. Untuk laci dan kotak kecil.',
      paper: 'a4', orient: 'portrait', cols: 4, rows: 10,
      cellW: 50, cellH: 25, margin: 2, gap: 2,
      opts: { qr: false, barcode: false, meta: false },
      mini: [4, 10], band: 'left', bandW: 0.5, padU: 0.3, gapU: 0.2,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 5.8, sub: false },
        { p: 'meta', h: 1.2, list: ['skuvar'], size: 1.0 }
      ]
    }),

    stack({
      key: 'rakstrip150', fam: 'rak', nama: 'Strip lorong 150 × 30', ukuran: '150 × 30 mm', fixed: true,
      desc: 'Strip panjang untuk balok rak. Lokasi memanjang, terbaca dari ujung lorong.',
      paper: 'a4', orient: 'portrait', cols: 1, rows: 9,
      cellW: 150, cellH: 30, margin: 4, gap: 2,
      opts: { qr: true, barcode: false, meta: false },
      mini: [1, 9], band: 'left', bandW: 0.45, padU: 0.3, gapU: 0.2,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 5.6, sub: false },
        { p: 'meta', h: 1.2, list: ['skuvar', 'qty', 'dus'], size: .9 }
      ]
    }),

    stack({
      key: 'raklorong', fam: 'rak', nama: 'Papan lorong', ukuran: '1 per A4 mendatar',
      desc: 'Satu papan per lembar. Huruf lorong sebesar mungkin, digantung di ujung gang.',
      paper: 'a4', orient: 'landscape', cols: 1, rows: 1, margin: 8, gap: 0,
      opts: { qr: false, barcode: false, meta: false },
      mini: [1, 1], band: 'top', bandW: 0.35, padU: 0.4, gapU: 0.3,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 6.0, subSize: 1.0, align: 'center' },
        { p: 'chips', h: 1.3, only: 'zona', size: 1.0 }
      ]
    }),

    stack({
      key: 'raktiang', fam: 'rak', nama: 'Label tiang', ukuran: '25 × 100 mm tegak', fixed: true,
      desc: 'Dipasang di tiang rak, dibaca dari samping. Isinya diputar 90°.',
      paper: 'a4', orient: 'portrait', cols: 7, rows: 2,
      cellW: 25, cellH: 100, margin: 4, gap: 2,
      opts: { qr: false, barcode: false, meta: false },
      mini: [7, 2], rot: true, band: 'left', bandW: 0.5, padU: 0.3, gapU: 0.2,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 5.8, sub: false },
        { p: 'meta', h: 1.2, list: ['skuvar'], size: .95 }
      ]
    }),

    stack({
      key: 'rakfifo', fam: 'rak', nama: 'Rak FIFO', ukuran: '100 × 38 mm', fixed: true,
      desc: 'Strip rak dengan tanggal masuk besar, supaya stok lama terlihat dan diambil duluan.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 7,
      cellW: 100, cellH: 38, margin: 4, gap: 2,
      opts: { qr: false, barcode: false, meta: true },
      mini: [2, 7], band: 'left', bandW: 0.5, padU: 0.35, gapU: 0.25,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 3.4, sub: false },
        { p: 'big2', h: 3.6, key: 'masuk', label: 'Masuk', size: 2.2, labSize: .55 },
        { p: 'meta', h: 1.2, list: ['skuvar', 'qty'], size: .65 }
      ]
    }),

    stack({
      key: 'rakqr', fam: 'rak', nama: 'Rak QR', ukuran: '2 × 6 per A4',
      desc: 'QR mendominasi, kode lokasi jadi pendamping. Untuk gudang yang serba scan.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 6, margin: 6, gap: 3,
      opts: { qr: true, barcode: false, meta: false },
      mini: [2, 6], band: 'left', bandW: 0.35, padU: 0.35, gapU: 0.25,
      parts: [
        { p: 'qrbig', h: 'fill' },
        { p: 'hero', h: 2.2, src: 'lokasi', size: 1.7, sub: false, align: 'center' },
        { p: 'meta', h: 1.2, list: ['skuvar'], size: .7 }
      ]
    }),

    stack({
      key: 'rakbar', fam: 'rak', nama: 'Rak barcode', ukuran: '2 × 8 per A4',
      desc: 'Barcode CODE128 memanjang penuh di bawah kode lokasi. Untuk pemindai laras.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 8, margin: 6, gap: 2,
      opts: { qr: false, barcode: true, meta: false },
      mini: [2, 8], band: 'left', bandW: 0.4, padU: 0.3, gapU: 0.2,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 3.8, sub: false },
        { p: 'bc', h: 3.6 },
        { p: 'meta', h: 1.0, list: ['skuvar', 'qty'], size: .6 }
      ]
    }),

    stack({
      key: 'rakblok', fam: 'rak', nama: 'Rak blok warna', ukuran: '2 × 6 per A4',
      desc: 'Seluruh label diwarnai zona. Dipakai untuk membagi gudang jadi area yang terlihat dari jauh.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 6, margin: 6, gap: 3,
      opts: { qr: false, barcode: false, meta: false },
      mini: [2, 6], cls: 'fill-zona', band: 'none', padU: 0.4, gapU: 0.25,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 4.6, subSize: 1.0, align: 'center' },
        { p: 'meta', h: 1.2, list: ['zona', 'qty'], size: .9 }
      ]
    }),

    stack({
      key: 'raksusun', fam: 'rak', nama: 'Papan bin', ukuran: '1 × 4 per A4',
      desc: 'Papan selebar kertas untuk satu bin: lokasi besar, qty, dus, dan nomor GRN.',
      paper: 'a4', orient: 'portrait', cols: 1, rows: 4, margin: 6, gap: 3,
      opts: { qr: true, barcode: false, meta: true },
      mini: [1, 4], band: 'left', bandW: 0.35, padU: 0.35, gapU: 0.25,
      parts: [
        { p: 'title', h: 1.0, text: 'Lokasi rak', size: .55 },
        { p: 'hero', h: 'fill', src: 'lokasi', size: 3.6, subSize: .8 },
        { p: 'rows', h: 4.0, list: ['qty', 'dus', 'grn'], labW: 3.3, labSize: .5, size: 1.0 },
        { p: 'chips', h: .8, size: .6 }
      ]
    }),

    stack({
      key: 'rakfefo', fam: 'rak', nama: 'Rak FEFO', ukuran: '100 × 38 mm', fixed: true,
      desc: 'Seperti Rak FIFO, tapi yang besar adalah tanggal kadaluarsa — untuk barang bertanggal.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 7,
      cellW: 100, cellH: 38, margin: 4, gap: 2,
      opts: { qr: false, barcode: false, meta: true, qrPattern: '{lokasi}|{sku}|{kadaluarsa}' },
      mini: [2, 7], band: 'left', bandW: 0.5, padU: 0.35, gapU: 0.25,
      parts: [
        { p: 'hero', h: 'fill', src: 'lokasi', size: 3.4, sub: false },
        { p: 'big2', h: 3.6, key: 'kadaluarsa', label: 'Kadaluarsa', size: 2.2, labSize: .55 },
        { p: 'meta', h: 1.2, list: ['skuvar', 'qty'], size: .65 }
      ]
    }),

    {
      key: 'rakprop', fam: 'rak', nama: 'Rak proporsional', ukuran: '2 × 6 per A4',
      cls: 'lbl-rak',
      desc: 'Strip rak yang ukurannya ikut kertas, bukan dikunci. Berguna untuk kertas tidak baku.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 6, margin: 6, gap: 3,
      opts: { qr: true, barcode: false, meta: false },
      mini: [2, 6], render: renderRak
    }
  ];

  /* ------------------------------ LABEL DUS ------------------------------ */
  var DUS = [
    {
      key: 'dus250', fam: 'dus', nama: 'Banner 100 × 250', ukuran: '100 × 250 mm',
      cls: 'lbl-dus250', fixed: true,
      desc: 'Banner tegak 10 × 25 cm untuk sisi depan dus. 2 label per lembar A4.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 1,
      cellW: 100, cellH: 250, margin: 4, gap: 4,
      opts: { qr: true, barcode: true, meta: true },
      mini: [2, 1], render: renderDus250
    },

    stack({
      key: 'dus140', fam: 'dus', nama: 'Banner 100 × 140', ukuran: '100 × 140 mm', fixed: true,
      desc: 'Banner pendek, 4 per lembar A4. Untuk dus yang sisinya tidak setinggi 25 cm.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 2,
      cellW: 100, cellH: 140, margin: 4, gap: 4,
      opts: { qr: true, barcode: false, meta: true },
      mini: [2, 2], padU: 0.35, gapU: 0.22,
      parts: [
        { p: 'title', h: .7, text: 'Label Dus', size: .32 },
        { p: 'hero', h: 'fill', size: 1.5, subSize: .45 },
        { p: 'rule', h: .05 },
        { p: 'rows', h: 1.45, list: ['qty', 'dus'], labW: 1.75, labSize: .26, size: .5 },
        { p: 'write', h: 1.0, key: 'lokasi', size: .55, labSize: .26 },
        { p: 'codes', h: 1.6 },
        { p: 'chips', h: .55, size: .4 },
        { p: 'foot', h: .35, size: .22 }
      ]
    }),

    stack({
      key: 'dusA5', fam: 'dus', nama: 'Dus A5 penuh', ukuran: '1 per lembar A5',
      desc: 'Satu label memenuhi selembar A5. Untuk dus besar atau palet.',
      paper: 'a5', orient: 'portrait', cols: 1, rows: 1, margin: 6, gap: 0,
      opts: { qr: true, barcode: true, meta: true },
      mini: [1, 1], padU: 0.3, gapU: 0.2,
      parts: [
        { p: 'title', h: .6, text: 'Label Dus', size: .28 },
        { p: 'hero', h: 'fill', size: 1.8, subSize: .45 },
        { p: 'rule', h: .04 },
        { p: 'rows', h: 2.5, list: ['qty', 'dus', 'supplier', 'grn'], labW: 1.5, labSize: .23, size: .45 },
        { p: 'write', h: .85, key: 'lokasi', size: .5, labSize: .23 },
        { p: 'codes', h: 1.3, bc: true },
        { p: 'chips', h: .5, size: .36 },
        { p: 'foot', h: .21, size: .18 }
      ]
    }),

    {
      key: 'dus8', fam: 'dus', nama: 'Dus standar', ukuran: '2 × 4 per A4',
      cls: 'lbl-dus8',
      desc: 'Pengganti sheet PRINT_LABEL_8UP. Delapan label per lembar.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 4, margin: 6, gap: 4,
      opts: { qr: true, barcode: false, meta: true },
      mini: [2, 4], render: renderDus8
    },
    {
      key: 'dus12', fam: 'dus', nama: 'Dus ringkas', ukuran: '3 × 4 per A4',
      cls: 'lbl-dus12',
      desc: 'Dua belas label kecil per lembar untuk dus bertumpuk.',
      paper: 'a4', orient: 'portrait', cols: 3, rows: 4, margin: 6, gap: 3,
      opts: { qr: false, barcode: false, meta: true },
      mini: [3, 4], render: renderDus12
    },
    {
      key: 'dus4', fam: 'dus', nama: 'Dus besar', ukuran: '2 × 2 per A4',
      cls: 'lbl-dus4',
      desc: 'Empat label besar dengan barcode CODE128.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 2, margin: 6, gap: 4,
      opts: { qr: true, barcode: true, meta: true },
      mini: [2, 2], render: renderDus4
    },
    {
      key: 'dus24', fam: 'dus', nama: 'Dus mini', ukuran: '4 × 6 per A4',
      cls: 'lbl-mini',
      desc: 'Stiker kecil untuk barang satuan atau dus isi sedikit.',
      paper: 'a4', orient: 'portrait', cols: 4, rows: 6, margin: 6, gap: 3,
      opts: { qr: false, barcode: false, meta: false },
      mini: [4, 6], render: renderMini
    },
    {
      key: 'dusthermal', fam: 'dus', nama: 'Thermal 100 × 50', ukuran: '100 × 50 mm',
      cls: 'lbl-thermal',
      desc: 'Satu label per lembar untuk printer thermal 100 × 50 mm.',
      paper: 't100x50', orient: 'portrait', cols: 1, rows: 1, margin: 2, gap: 0,
      opts: { qr: true, barcode: true, meta: true },
      mini: [1, 1], render: renderThermal
    },

    stack({
      key: 'dusthermal100', fam: 'dus', nama: 'Thermal 100 × 100', ukuran: '100 × 100 mm',
      desc: 'Label thermal persegi. Muat QR, barcode, dan kolom lokasi sekaligus.',
      paper: 't100x100', orient: 'portrait', cols: 1, rows: 1, margin: 2, gap: 0,
      opts: { qr: true, barcode: true, meta: true },
      mini: [1, 1], padU: 0.3, gapU: 0.22,
      parts: [
        { p: 'hero', h: 'fill', size: 1.9, subSize: .5 },
        { p: 'rows', h: 1.8, list: ['qty', 'dus'], labW: 1.8, labSize: .28, size: .55 },
        { p: 'write', h: 1.2, key: 'lokasi', size: .6, labSize: .28 },
        { p: 'codes', h: 2.0, bc: true },
        { p: 'chips', h: .8, size: .5 }
      ]
    }),

    {
      key: 'dustag', fam: 'dus', nama: 'Kartu gantung', ukuran: '2 × 2 per A4',
      cls: 'lbl-tag',
      desc: 'Kartu status dengan lubang gantung. Kata status dibaca dari jauh.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 2, margin: 8, gap: 6,
      opts: { qr: true, barcode: false, meta: true },
      mini: [2, 2], render: renderTag
    },

    stack({
      key: 'dusfragile', fam: 'dus', nama: 'Dus barang pecah', ukuran: '2 × 2 per A4',
      desc: 'Tanda stensil peti — jangan dibanting, jangan terbalik, jauhkan dari air — di atas data dus.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 2, margin: 6, gap: 4,
      opts: { qr: false, barcode: false, meta: true },
      mini: [2, 2], padU: 0.35, gapU: 0.22,
      parts: [
        { p: 'note', h: .6, text: 'Barang mudah pecah', size: .35 },
        { p: 'marks', h: 'fill', items: ['fragile', 'up', 'dry'] },
        { p: 'rule', h: .05 },
        { p: 'hero', h: 1.6, size: 1.1, subSize: .38 },
        { p: 'rows', h: 1.5, list: ['qty', 'dus'], labW: 1.7, labSize: .26, size: .5 },
        { p: 'write', h: 1.0, key: 'lokasi', size: .55, labSize: .26 },
        { p: 'foot', h: .3, size: .22 }
      ]
    }),

    stack({
      key: 'dusfifo', fam: 'dus', nama: 'Dus FIFO', ukuran: '2 × 3 per A4',
      desc: 'Tanggal masuk jadi bagian terbesar. Untuk stok yang harus keluar menurut urutan datang.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 3, margin: 6, gap: 4,
      opts: { qr: false, barcode: false, meta: true },
      mini: [2, 3], band: 'top', bandW: 0.4, padU: 0.35, gapU: 0.22,
      parts: [
        { p: 'big2', h: 'fill', key: 'masuk', label: 'Tanggal masuk', size: 2.2, labSize: .35 },
        { p: 'rule', h: .05 },
        { p: 'hero', h: 1.8, size: 1.2, subSize: .4 },
        { p: 'rows', h: 1.8, list: ['qty', 'dus'], labW: 1.7, labSize: .26, size: .5 },
        { p: 'chips', h: .8, only: 'status', size: .5 }
      ]
    }),

    stack({
      key: 'dusqc', fam: 'dus', nama: 'Dus periksa QC', ukuran: '2 × 3 per A4',
      desc: 'Ada kotak centang untuk pemeriksaan isi, segel, dan jumlah — dicentang langsung di dus.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 3, margin: 6, gap: 4,
      opts: { qr: false, barcode: false, meta: true },
      mini: [2, 3], band: 'left', bandW: 0.35, padU: 0.35, gapU: 0.2,
      parts: [
        { p: 'title', h: .7, text: 'Periksa dus', size: .32 },
        { p: 'hero', h: 'fill', size: 1.2, subSize: .38 },
        { p: 'rows', h: 1.6, list: ['qty', 'dus'], labW: 1.7, labSize: .25, size: .48 },
        { p: 'boxes', h: 1.7, items: ['Isi sesuai', 'Segel utuh', 'Jumlah cocok', 'Tidak rusak'], size: .32 },
        { p: 'write', h: 1.0, key: 'pic', label: 'Diperiksa oleh', size: .5, labSize: .25, blank: true },
        { p: 'foot', h: .3, size: .22, right: 'grn' }
      ]
    }),

    stack({
      key: 'dusfefo', fam: 'dus', nama: 'Dus FEFO', ukuran: '2 × 3 per A4',
      desc: 'Tanggal kadaluarsa paling besar, tanggal masuk di bawahnya. Untuk barang bertanggal.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 3, margin: 6, gap: 4,
      opts: { qr: false, barcode: false, meta: true },
      mini: [2, 3], band: 'top', bandW: 0.4, padU: 0.35, gapU: 0.22,
      parts: [
        { p: 'big2', h: 'fill', key: 'kadaluarsa', label: 'Kadaluarsa', size: 2.2, labSize: .35 },
        { p: 'rule', h: .05 },
        { p: 'hero', h: 1.8, size: 1.2, subSize: .4 },
        { p: 'rows', h: 1.8, list: ['masuk', 'qty'], labW: 1.7, labSize: .26, size: .5 },
        { p: 'chips', h: .8, only: 'status', size: .5 }
      ]
    }),

    stack({
      key: 'duskirim', fam: 'dus', nama: 'Dus rute simpan', ukuran: '2 × 2 per A4',
      desc: 'Dari supplier menuju lokasi rak. Dipakai saat dus dipindah dari area terima ke rak.',
      paper: 'a4', orient: 'portrait', cols: 2, rows: 2, margin: 6, gap: 4,
      opts: { qr: true, barcode: false, meta: true },
      mini: [2, 2], padU: 0.35, gapU: 0.22,
      parts: [
        { p: 'title', h: .7, text: 'Simpan ke rak', size: .32 },
        { p: 'route', h: 3.4, size: .75 },
        { p: 'rows', h: 'fill', list: ['skuvar', 'qty', 'dus'], labW: 1.7, labSize: .26, size: .5 },
        { p: 'codes', h: 1.4 },
        { p: 'chips', h: .55, size: .4 }
      ]
    })
  ];

  var TEMPLATES = RAK.concat(DUS);


  function byKey(k) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].key === k) return TEMPLATES[i];
    return TEMPLATES[0];
  }

  function byFamily(fam) {
    var out = [], i;
    for (i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].fam === fam) out.push(TEMPLATES[i]);
    return out;
  }

  /* ------------------------------------------------------------------ */
  LG.tpl = {
    PAPERS: PAPERS,
    PAPER_ORDER: PAPER_ORDER,
    TEMPLATES: TEMPLATES,
    FAMILIES: FAMILIES,
    byKey: byKey,
    byFamily: byFamily,
    esc: esc,
    zCls: zCls,
    sCls: sCls,
    fit: fit,
    FIELD_LABEL: function (k) { return FIELD[k] ? FIELD[k][0] : k; },
    qrSvg: qrSvg,
    qrText: qrText,
    bcText: bcText,
    hasQR: qrOK,
    hasBarcode: bcOK
  };

})(window);
