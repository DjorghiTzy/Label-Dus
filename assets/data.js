/* =====================================================================
   data.js — model data, penyimpanan, impor, ekspor.
   Tanpa module: satu IIFE, hasilnya ditaruh di window.LG.data
   ===================================================================== */
(function (window, document) {
  'use strict';

  var LG = window.LG = window.LG || {};

  /* ------------------------------------------------------------------
     KOLOM
     ------------------------------------------------------------------ */
  var COLUMNS = [
    { k: 'labelId',  t: 'Label ID',    w: 92,  cls: 'code' },
    { k: 'tanggal',  t: 'Tanggal',     w: 96,  cls: '', kind: 'date' },
    { k: 'supplier', t: 'Supplier',    w: 130 },
    { k: 'grn',      t: 'No GRN / SJ', w: 110, cls: 'code' },
    { k: 'kode',     t: 'Kode',        w: 92,  cls: 'code' },
    { k: 'sku',      t: 'SKU',         w: 96,  cls: 'code' },
    { k: 'barcode',  t: 'Barcode',     w: 116, cls: 'code' },
    { k: 'varian',   t: 'Varian',      w: 104 },
    { k: 'qty',      t: 'Qty per dus', w: 98 },
    { k: 'kodeDus',  t: 'Kode dus',    w: 100, cls: 'code' },
    { k: 'dusKe',    t: 'Dus ke',      w: 68,  cls: 'num' },
    { k: 'totalDus', t: 'Total dus',   w: 78,  cls: 'num' },
    /* Lokasi = LOKASI FINAL, satu-satunya yang boleh dicetak sebagai
       alamat rak. Bentuknya A-CHR-R01-B01-P01. */
    { k: 'lokasi',   t: 'Lokasi final', w: 126, cls: 'code' },
    /* Prefix lokasi (A-CHR) hanya menunjukkan area + golongan. Ini BUKAN
       lokasi final dan tidak pernah disalin ke kolom Lokasi final —
       R/B/P tidak boleh ditebak aplikasi. */
    { k: 'prefix',   t: 'Prefix lokasi', w: 106, cls: 'code' },
    { k: 'area',     t: 'Area',        w: 72 },
    { k: 'kodeGol',  t: 'Kode golongan', w: 100, cls: 'code' },
    { k: 'golongan', t: 'Golongan',    w: 110 },
    { k: 'zona',     t: 'Zona',        w: 92,  list: 'dlZona' },
    { k: 'status',   t: 'Status',      w: 96,  list: 'dlStatus' },
    { k: 'pic',      t: 'PIC',         w: 100 },
    { k: 'catatan',  t: 'Catatan',     w: 160 }
  ];

  /* Kolom yang dianggap "penting". Baris yang seluruh kolom pentingnya
     kosong dibuang saat impor — di file lama ada puluhan baris ekor
     yang hanya berisi zona/status/PIC. */
  var PENTING = ['kode', 'sku', 'barcode', 'varian', 'qty', 'kodeDus', 'totalDus', 'lokasi',
                 'prefix', 'grn', 'supplier', 'tanggal'];

  /* ------------------------------------------------------------------
     ALIAS NAMA KOLOM
     Kunci sudah dinormalkan: huruf kecil, tanpa spasi/tanda baca.
     ------------------------------------------------------------------ */
  var ALIAS = {
    labelid: 'labelId', idlabel: 'labelId', nolabel: 'labelId', kodelabel: 'labelId',

    tanggal: 'tanggal', tanggalterima: 'tanggal', tglterima: 'tanggal', tgl: 'tanggal',
    tanggalmasuk: 'tanggal', date: 'tanggal', tanggaldatang: 'tanggal',

    supplier: 'supplier', pemasok: 'supplier', vendor: 'supplier', namasupplier: 'supplier',

    grn: 'grn', nogrn: 'grn', nogrnsj: 'grn', grnsj: 'grn', nosj: 'grn',
    suratjalan: 'grn', nosuratjalan: 'grn', dokumen: 'grn',

    kode: 'kode', skukode: 'kode', kodesku: 'kode', koderak: 'kode',
    kodeinternal: 'kode', kodebarang: 'kode', itemcode: 'kode', kodeitem: 'kode',

    /* Barcode berdiri sendiri. Sebelumnya tidak dikenali sama sekali,
       jadi kolom barcode master gudang ikut hilang saat impor. */
    barcode: 'barcode', kodebarcode: 'barcode', barcodesku: 'barcode',
    nobarcode: 'barcode', ean: 'barcode', ean13: 'barcode', upc: 'barcode',
    gtin: 'barcode', barkode: 'barcode',

    sku: 'sku', namabarang: 'sku', namaitem: 'sku', nama: 'sku', item: 'sku',
    itemname: 'sku', deskripsi: 'sku', barang: 'sku',
    /* Master gudang ACC memakai judul Inggris "Name" untuk nama barang. */
    name: 'sku', productname: 'sku', namaproduk: 'sku', description: 'sku',
    namasku: 'sku',

    varian: 'varian', warna: 'varian', varianwarna: 'varian', warnavarian: 'varian',
    variant: 'varian', color: 'varian', tipe: 'varian',

    qty: 'qty', qtyperdus: 'qty', qtydus: 'qty', isidus: 'qty', isiperdus: 'qty',
    jumlahperdus: 'qty', jumlah: 'qty', isi: 'qty', quantity: 'qty',
    /* "Quantity On Hand" adalah stok, bukan penentu posisi rak. Dipetakan
       ke Qty supaya datanya tidak hilang; pengguna bisa mengubahnya di
       jendela pemetaan kolom sebelum impor dijalankan. */
    quantityonhand: 'qty', qtyonhand: 'qty', stokonhand: 'qty',

    kodedus: 'kodeDus', duske: 'kodeDus', dusketext: 'kodeDus', textduske: 'kodeDus',
    kodekarton: 'kodeDus',

    duskeno: 'dusKe', nourutdus: 'dusKe', urutandus: 'dusKe', dusnomor: 'dusKe', nodus: 'dusKe',

    totaldus: 'totalDus', jumlahdus: 'totalDus', totdus: 'totalDus', totaldos: 'totalDus',
    totalkarton: 'totalDus',

    /* LOKASI FINAL. Nama header yang dipakai gudang ACC ikut didaftarkan
       supaya tidak tertukar dengan prefix. */
    lokasi: 'lokasi', lokasirak: 'lokasi', rak: 'lokasi', bin: 'lokasi',
    binlocation: 'lokasi', location: 'lokasi', letak: 'lokasi', posisi: 'lokasi',
    lokasifinal: 'lokasi', lokasirakfinal: 'lokasi', lokasiakhir: 'lokasi',
    locationcode: 'lokasi', kodelokasi: 'lokasi', finallocation: 'lokasi',
    lokasilengkap: 'lokasi', alamatrak: 'lokasi',

    /* PREFIX LOKASI (A-CHR) — area + golongan saja, belum alamat rak.
       Alias eksaknya harus ada, kalau tidak pencocokan sebagian akan
       menariknya ke 'lokasi' karena mengandung kata "lokasi". */
    prefix: 'prefix', prefixlokasi: 'prefix', lokasiprefix: 'prefix',
    prefixrak: 'prefix', awalanlokasi: 'prefix', prefixlocation: 'prefix',

    /* Area (A, B, C) dan golongan (CHR / Charger) berdiri sendiri.
       Dulu "Area" jatuh ke Zona; sekarang Zona hanya dari kata zona. */
    area: 'area', areadraft: 'area', areagudang: 'area', arealokasi: 'area',
    kodegolongan: 'kodeGol', kodegol: 'kodeGol', golongankode: 'kodeGol',
    kodekategori: 'kodeGol', kodegrup: 'kodeGol',
    golongan: 'golongan', golongandraft: 'golongan', namagolongan: 'golongan',
    grup: 'golongan', kelompok: 'golongan',

    zona: 'zona', zone: 'zona', zonarak: 'zona', zonagudang: 'zona',

    status: 'status', kondisi: 'status', statusbarang: 'status',

    pic: 'pic', petugas: 'pic', penanggungjawab: 'pic', operator: 'pic', checker: 'pic',

    catatan: 'catatan', keterangan: 'catatan', ket: 'catatan', note: 'catatan',
    notes: 'catatan', remark: 'catatan', remarks: 'catatan'
  };

  /* Kolom yang otomatis dilewati. */
  var SKIP = { no: 1, nomor: 1, nourut: 1, textdus: 1, textdusxtotal: 1, dusxtotal: 1, seq: 1 };

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function guessKey(header) {
    var n = norm(header);
    if (!n) return '';
    if (SKIP[n]) return '__skip__';
    if (ALIAS[n]) return ALIAS[n];
    /* cocokkan sebagian: "tanggal terima barang" -> tanggal */
    var best = '', bestLen = 0, a;
    for (a in ALIAS) {
      if (!ALIAS.hasOwnProperty(a)) continue;
      if (a.length >= 3 && n.indexOf(a) >= 0 && a.length > bestLen) { best = ALIAS[a]; bestLen = a.length; }
    }
    return best;
  }

  /* ------------------------------------------------------------------
     LOKASI FINAL

     Hanya kolom "Lokasi final" yang boleh dicetak sebagai alamat rak.
     Prefix lokasi (A-CHR) menunjukkan area dan golongan, tapi belum
     menunjukkan rak, baris, dan posisi. Aplikasi tidak pernah menebak
     R01/B01/P01 — kalau belum ada, labelnya ditandai belum siap.
     ------------------------------------------------------------------ */
  function lokasiFinal(row) {
    if (!row) return '';
    var lok = String(row.lokasi || '').trim();
    if (!lok) return '';
    var pre = String(row.prefix || '').trim();
    /* Kalau isinya persis sama dengan prefix, itu bukan lokasi final —
       sekadar prefix yang tersalin ke kolom yang salah. */
    if (pre && norm(lok) === norm(pre)) return '';
    return lok;
  }

  function belumLokasiFinal(row) { return !lokasiFinal(row); }

  /* ------------------------------------------------------------------
     TANGGAL
     ------------------------------------------------------------------ */
  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  /* Angka seri Excel -> YYYY-MM-DD. 46126 -> 2026-04-14 */
  function serialToISO(n) {
    if (!isFinite(n) || n <= 0 || n > 600000) return '';
    var d = new Date(Math.round((n - 25569) * 86400000));
    if (isNaN(d.getTime())) return '';
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  function parseDate(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return serialToISO(v);
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return '';
      return v.getFullYear() + '-' + pad2(v.getMonth() + 1) + '-' + pad2(v.getDate());
    }
    var s = String(v).trim();
    if (!s) return '';
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
      var p = s.split('-');
      return p[0] + '-' + pad2(p[1]) + '-' + pad2(p[2]);
    }
    /* 14/04/2026 atau 14-04-2026 atau 14.04.26 */
    var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      var y = parseInt(m[3], 10);
      if (y < 100) y += (y < 70 ? 2000 : 1900);
      return y + '-' + pad2(m[2]) + '-' + pad2(m[1]);
    }
    if (/^\d+(\.\d+)?$/.test(s)) return serialToISO(parseFloat(s));
    return '';
  }

  /* YYYY-MM-DD -> DD-MM-YYYY */
  function fmtDate(iso) {
    if (!iso) return '';
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + '-' + m[2] + '-' + m[1] : String(iso);
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* ------------------------------------------------------------------
     BARIS
     ------------------------------------------------------------------ */
  function blank() {
    var r = {}, i;
    for (i = 0; i < COLUMNS.length; i++) r[COLUMNS[i].k] = '';
    r._on = true;
    return r;
  }

  /* Baris baru mewarisi tanggal, supplier, PIC, zona, status dari baris sebelumnya. */
  var WARIS = ['tanggal', 'supplier', 'pic', 'zona', 'status', 'grn'];
  function newRow(prev) {
    var r = blank(), i;
    if (prev) for (i = 0; i < WARIS.length; i++) r[WARIS[i]] = prev[WARIS[i]] || '';
    if (!r.tanggal) r.tanggal = todayISO();
    return r;
  }

  function isEmptyRow(r) {
    for (var i = 0; i < PENTING.length; i++) {
      if (String(r[PENTING[i]] == null ? '' : r[PENTING[i]]).trim() !== '') return false;
    }
    return true;
  }

  /* Label ID otomatis: LBL-001 */
  function makeId(n) {
    var s = String(n);
    while (s.length < 3) s = '0' + s;
    return 'LBL-' + s;
  }

  function renumber(rows) {
    for (var i = 0; i < rows.length; i++) rows[i].labelId = makeId(i + 1);
    return rows;
  }

  function fillMissingIds(rows) {
    var used = {}, i, n = 1;
    for (i = 0; i < rows.length; i++) if (rows[i].labelId) used[rows[i].labelId] = 1;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].labelId) continue;
      while (used[makeId(n)]) n++;
      rows[i].labelId = makeId(n);
      used[rows[i].labelId] = 1;
    }
    return rows;
  }

  /* ---- nilai turunan: dihitung saat render, tidak pernah disimpan ---- */
  function dusText(r) {
    var tot = String(r.totalDus == null ? '' : r.totalDus).trim();
    var kd = String(r.kodeDus == null ? '' : r.kodeDus).trim();
    var ke = String(r.dusKe == null ? '' : r.dusKe).trim();
    var head = kd || ke;
    if (!head) return tot ? '/' + tot : '';
    return tot ? head + '/' + tot : head;
  }

  function bigCode(r) {
    return String(r.kode || '').trim() || String(r.sku || '').trim() ||
           String(r.kodeDus || '').trim() || String(r.labelId || '').trim();
  }

  /* Pecah satu baris dengan Total Dus = N menjadi N baris. */
  function splitRow(r) {
    var tot = parseInt(r.totalDus, 10);
    if (!isFinite(tot) || tot < 2) return [r];
    var out = [], i, c, base = String(r.kodeDus || '').trim();
    /* buang akhiran angka lama: MC01-1W -> MC01-  ... hanya kalau berpola <teks><angka><huruf?> */
    for (i = 1; i <= tot; i++) {
      c = {};
      for (var k in r) if (r.hasOwnProperty(k)) c[k] = r[k];
      c.dusKe = i;
      c.totalDus = tot;
      if (base) c.kodeDus = renumberKodeDus(base, i);
      if (r.labelId) c.labelId = r.labelId + '-' + i;
      out.push(c);
    }
    return out;
  }

  /* MC01-1W dengan dus ke-3 menjadi MC01-3W. Kalau tidak ada angka
     di dalam kode dus, angka ditambahkan di belakang: MC01 -> MC01-3 */
  function renumberKodeDus(base, i) {
    var m = base.match(/^(.*?)(\d+)([^\d]*)$/);
    if (m) return m[1] + i + m[3];
    return base + '-' + i;
  }

  /* ------------------------------------------------------------------
     BASIS DATA & PENYIMPANAN

     Ada dua basis data terpisah — CV dan OL — masing-masing punya
     barisnya sendiri, pengaturannya sendiri, dan katalog produknya
     sendiri. Keduanya tidak pernah bercampur: kuncinya beda, dan
     katalognya pun nol barcode yang sama.

     localStorage selalu dibungkus try/catch; kalau diblokir, aplikasi
     tetap jalan, hanya tidak bisa menyimpan otomatis.
     ------------------------------------------------------------------ */
  var DB = [
    { kunci: 'cv', nama: 'CV', ket: 'Barang umum: elektronik, peralatan, aksesori.' },
    { kunci: 'ol', nama: 'OL', ket: 'Aksesori ponsel: charger, kabel, case, tempered glass.' }
  ];
  var KEY_DB = 'labelgudang.db';
  var dbAktif = 'cv';

  function keyFor(kunci) { return 'labelgudang.v1.' + (kunci || dbAktif); }

  function dbList() { return DB.slice(0); }
  function dbInfo(kunci) {
    for (var i = 0; i < DB.length; i++) if (DB[i].kunci === kunci) return DB[i];
    return DB[0];
  }
  function dbGet() { return dbAktif; }
  function dbSet(kunci) {
    dbAktif = dbInfo(kunci).kunci;
    try { localStorage.setItem(KEY_DB, dbAktif); } catch (e) {}
    return dbAktif;
  }
  function dbRestore() {
    try {
      var v = localStorage.getItem(KEY_DB);
      if (v) dbAktif = dbInfo(v).kunci;
    } catch (e) {}
    return dbAktif;
  }

  /* Katalog produk dimuat lewat <script> dari data/katalog-*.js.
     Kalau berkasnya tidak ada, katalognya kosong — bukan error. */
  function katalog(kunci) {
    var k = (window.LG && window.LG.katalog) ? window.LG.katalog[kunci || dbAktif] : null;
    return (k && k.produk) ? k.produk : [];
  }

  /* Satu produk katalog -> satu baris label. */
  function rowFromProduk(pr, prev) {
    var r = newRow(prev);
    r.labelId = '';
    r.kode = String(pr[0] || '');
    r.sku = '';
    r.varian = String(pr[1] || '');
    var jml = pr[2], sat = String(pr[3] || '').trim();
    r.qty = (jml || jml === 0) ? (jml + (sat ? ' ' + sat : '')) : '';
    if (pr[4]) r.lokasi = String(pr[4]);
    return r;
  }

  /* Pencarian katalog.

     Dicocokkan per kata, bukan sebagai satu potongan utuh: "ugreen hub"
     harus menemukan "Ugreen Adapter Hub Usb C 7In1" walaupun kedua kata
     itu tidak berdampingan. Pencocokan potongan utuh memberi nol hasil
     untuk urutan kata yang wajar diketik orang.

     Hasilnya diurutkan supaya yang paling mungkin dimaksud muncul
     duluan — mengetik "899" mendapat 402 produk, jadi urutan menentukan
     apakah daftarnya berguna atau tidak. */
  function cariProduk(q, kunci, batas) {
    var list = katalog(kunci), i, j;
    batas = batas || 200;
    q = String(q || '').trim().toLowerCase();

    if (!q) {
      return { hasil: list.slice(0, batas), total: list.length, cocok: list.length };
    }

    var kata = q.split(/\s+/), cocok = [];
    for (i = 0; i < list.length; i++) {
      var bar = String(list[i][0]).toLowerCase();
      var nama = String(list[i][1]).toLowerCase();
      var gabung = bar + ' ' + nama;
      var semua = true;
      for (j = 0; j < kata.length; j++) {
        if (gabung.indexOf(kata[j]) < 0) { semua = false; break; }
      }
      if (!semua) continue;

      /* peringkat berdasarkan kata pertama */
      var k0 = kata[0], nilai;
      if (bar.indexOf(k0) === 0) nilai = 0;
      else if (nama.indexOf(k0) === 0) nilai = 1;
      else if (bar.indexOf(k0) >= 0) nilai = 2;
      else if ((' ' + nama).indexOf(' ' + k0) >= 0) nilai = 3;   /* awal sebuah kata */
      else nilai = 4;
      cocok.push([nilai, list[i][1], list[i]]);
    }

    cocok.sort(function (a, b) {
      if (a[0] !== b[0]) return a[0] - b[0];
      return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
    });

    var out = [];
    for (i = 0; i < cocok.length && i < batas; i++) out.push(cocok[i][2]);
    return { hasil: out, total: list.length, cocok: cocok.length };
  }

  function produkByBarcode(kode, kunci) {
    var list = katalog(kunci), i;
    kode = String(kode || '').trim().toLowerCase();
    if (!kode) return null;
    for (i = 0; i < list.length; i++) {
      if (String(list[i][0]).toLowerCase() === kode) return list[i];
    }
    return null;
  }

  function save(state, kunci) {
    try {
      localStorage.setItem(keyFor(kunci), JSON.stringify(state));
      return true;
    } catch (e) { return false; }
  }

  function load(kunci) {
    try {
      var raw = localStorage.getItem(keyFor(kunci));
      /* pindahan dari versi satu-basis-data */
      if (!raw && (kunci || dbAktif) === 'cv') raw = localStorage.getItem('labelgudang.v1');
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (o && typeof o === 'object') ? o : null;
    } catch (e) { return null; }
  }

  function wipe(kunci) { try { localStorage.removeItem(keyFor(kunci)); } catch (e) {} }

  /* ------------------------------------------------------------------
     IMPOR — dari file ke matriks (larik dari larik)
     ------------------------------------------------------------------ */
  /* Sheet yang jelas bukan daftar barang: petunjuk, lembar cetak, grafik. */
  var BAD_SHEET = /print|setup|readme|cetak|petunjuk|help|pivot|chart|grafik|kamus|glossar/i;

  /* Sheet pendamping di workbook master gudang: daftar masalah, ringkasan,
     atau tabel aturan. Isinya memang rapi dan berjudul, jadi tanpa aturan
     ini "Data Issues" bisa menang hanya karena namanya mengandung "data" —
     itulah yang dulu membuat aplikasi memilih sheet yang salah. */
  var SIDE_SHEET = /issue|summary|ringkasan|rekap|aturan|rule|legend|referensi|catatan\s*klasifikasi/i;

  /* Nama yang biasanya dipakai untuk sheet SKU utama. */
  var MASTER_SHEET = /draft\s*pengelompokan|pengelompokan|master|daftar\s*sku|sku|barang|item|produk|data/i;

  /* Nilai satu sheet dilihat dari isinya, bukan namanya:
     berapa banyak judul kolom yang dikenali, dan berapa baris datanya. */
  function nilaiSheet(matrix) {
    var hr = findHeaderRow(matrix);
    var row = matrix[hr] || [], c, j, v, g;
    var kenal = 0, terisi = 0, sudah = {};
    for (c = 0; c < row.length; c++) {
      v = String(row[c] == null ? '' : row[c]).trim();
      if (!v) continue;
      terisi++;
      g = guessKey(v);
      if (g && g !== '__skip__' && !sudah[g]) { sudah[g] = 1; kenal++; }
    }
    var isi = 0, ada;
    for (c = hr + 1; c < matrix.length && isi <= 200; c++) {
      ada = false;
      row = matrix[c] || [];
      for (j = 0; j < row.length; j++) {
        if (String(row[j] == null ? '' : row[j]).trim() !== '') { ada = true; break; }
      }
      if (ada) isi++;
    }
    return { kenal: kenal, kolom: terisi, isi: isi, headerRow: hr };
  }

  function skorSheet(nama, n) {
    if (!n.isi) return -1000;                       /* kosong, tidak berguna */
    var sk = n.kenal * 10 + Math.min(n.isi, 100) * 0.4 + Math.min(n.kolom, 20) * 0.2;
    if (/draft\s*pengelompokan/i.test(nama)) sk += 18;
    else if (MASTER_SHEET.test(nama)) sk += 6;
    if (SIDE_SHEET.test(nama)) sk -= 25;
    if (BAD_SHEET.test(nama)) sk -= 60;
    return sk;
  }

  /* Dipakai kalau hanya nama sheet yang tersedia (mis. dari CSV multi-file). */
  function pickSheetName(names) {
    var cand = [], i;
    for (i = 0; i < names.length; i++) if (!BAD_SHEET.test(names[i]) && !SIDE_SHEET.test(names[i])) cand.push(names[i]);
    if (!cand.length) cand = names.slice(0);
    for (i = 0; i < cand.length; i++) if (MASTER_SHEET.test(cand[i])) return cand[i];
    return cand[0];
  }

  /* Cari baris judul: file asli punya 2–3 baris hiasan sebelum header. */
  function findHeaderRow(matrix) {
    var lim = Math.min(15, matrix.length), best = 0, bestScore = -1, r, c, row, hits, filled, g, sc;
    for (r = 0; r < lim; r++) {
      row = matrix[r] || [];
      hits = 0; filled = 0;
      for (c = 0; c < row.length; c++) {
        var v = String(row[c] == null ? '' : row[c]).trim();
        if (!v) continue;
        filled++;
        g = guessKey(v);
        if (g && g !== '__skip__') hits++;
        else if (g === '__skip__') hits += 0.5;
      }
      sc = hits * 10 + filled * 0.1;
      if (sc > bestScore) { bestScore = sc; best = r; }
    }
    return bestScore <= 0 ? 0 : best;
  }

  function matrixToTable(matrix) {
    var hr = findHeaderRow(matrix);
    var headers = (matrix[hr] || []).map(function (v) { return String(v == null ? '' : v).trim(); });
    /* buang kolom ekor yang judulnya kosong seluruhnya */
    var last = headers.length - 1;
    while (last >= 0 && !headers[last]) last--;
    headers = headers.slice(0, last + 1);
    var body = [], i, j, row, out, any;
    for (i = hr + 1; i < matrix.length; i++) {
      row = matrix[i] || [];
      out = []; any = false;
      for (j = 0; j < headers.length; j++) {
        out.push(row[j] == null ? '' : row[j]);
        if (String(row[j] == null ? '' : row[j]).trim() !== '') any = true;
      }
      if (any) body.push(out);
    }
    return { headers: headers, body: body, headerRow: hr };
  }

  function readWorkbook(ab) {
    if (typeof XLSX === 'undefined') throw new Error('Pustaka Excel tidak tersedia.');
    var wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
    var names = wb.SheetNames, i, m, n, sk;
    var terbaik = -1e9, pilih = -1, matriks = [], nilai = [], skor = [];

    for (i = 0; i < names.length; i++) {
      m = XLSX.utils.sheet_to_json(wb.Sheets[names[i]],
            { header: 1, raw: true, defval: '', blankrows: true });
      n = nilaiSheet(m);
      sk = skorSheet(names[i], n);
      matriks.push(m); nilai.push(n); skor.push(sk);
    }

    /* Sheet utama harus punya struktur tabel yang masuk akal. Kalau ada
       satu saja yang memenuhi, sheet pendamping tidak pernah dilirik. */
    var layak = [];
    for (i = 0; i < names.length; i++) {
      if (nilai[i].kenal >= 3 && nilai[i].isi >= 1 &&
          !SIDE_SHEET.test(names[i]) && !BAD_SHEET.test(names[i])) layak.push(i);
    }
    var daftar = layak.length ? layak : null;

    for (i = 0; i < names.length; i++) {
      if (daftar && daftar.indexOf(i) < 0) continue;
      if (skor[i] > terbaik) { terbaik = skor[i]; pilih = i; }
    }
    if (pilih < 0) pilih = 0;

    return {
      matrix: matriks[pilih],
      sheet: names[pilih],
      sheets: names,
      kenal: nilai[pilih].kenal,
      barisData: nilai[pilih].isi
    };
  }

  /* ---- CSV / teks bertab ---- */
  function detectDelim(text) {
    var line = text.split(/\r?\n/)[0] || '';
    var counts = { '\t': 0, ';': 0, ',': 0, '|': 0 }, inQ = false, i, ch;
    for (i = 0; i < line.length; i++) {
      ch = line.charAt(i);
      if (ch === '"') inQ = !inQ;
      else if (!inQ && counts.hasOwnProperty(ch)) counts[ch]++;
    }
    var best = ',', bv = -1, d;
    for (d in counts) if (counts.hasOwnProperty(d) && counts[d] > bv) { bv = counts[d]; best = d; }
    return bv > 0 ? best : '\t';
  }

  function parseDelimited(text, delim) {
    text = String(text).replace(/^﻿/, '');
    if (!delim) delim = detectDelim(text);
    var rows = [], row = [], cur = '', inQ = false, i, ch, nx;
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      if (inQ) {
        if (ch === '"') {
          nx = text.charAt(i + 1);
          if (nx === '"') { cur += '"'; i++; } else inQ = false;
        } else cur += ch;
        continue;
      }
      if (ch === '"') { inQ = true; continue; }
      if (ch === delim) { row.push(cur); cur = ''; continue; }
      if (ch === '\r') continue;
      if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
      cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    /* buang baris kosong di ekor */
    while (rows.length && rows[rows.length - 1].join('').trim() === '') rows.pop();
    return rows;
  }

  /* ------------------------------------------------------------------
     PEMETAAN KOLOM
     ------------------------------------------------------------------ */
  function guessMapping(headers) {
    var map = [], i, g, taken = {};
    var rapi = [];
    for (i = 0; i < headers.length; i++) rapi.push(norm(headers[i]));

    /* "Dus Ke" di file Excel lama berisi kode dus (MC01-1W), jadi
       aliasnya mengarah ke kodeDus. Tapi ekspor aplikasi ini punya
       "Kode dus" DAN "Dus ke" sebagai dua kolom berbeda. Kalau keduanya
       ada di file yang sama, "Dus ke" pasti nomor urut — tanpa aturan
       ini, mengekspor lalu mengimpor kembali kehilangan kolom itu. */
    var adaKodeDus = false;
    for (i = 0; i < rapi.length; i++) if (rapi[i] === 'kodedus') adaKodeDus = true;

    for (i = 0; i < headers.length; i++) {
      g = (adaKodeDus && rapi[i] === 'duske') ? 'dusKe' : guessKey(headers[i]);
      if (g === '__skip__' || !g) g = '';
      if (g && taken[g]) g = '';       /* satu kolom tujuan hanya sekali */
      if (g) taken[g] = 1;
      map.push(g);
    }
    return map;
  }

  function applyMapping(table, map) {
    var rows = [], i, j, src, r, key, v;
    for (i = 0; i < table.body.length; i++) {
      src = table.body[i];
      r = blank();
      for (j = 0; j < map.length; j++) {
        key = map[j];
        if (!key) continue;
        v = src[j];
        if (key === 'tanggal') r.tanggal = parseDate(v);
        else if (key === 'dusKe' || key === 'totalDus') {
          v = String(v == null ? '' : v).trim();
          r[key] = v === '' ? '' : (isFinite(parseFloat(v)) ? String(parseInt(parseFloat(v), 10)) : v);
        } else {
          r[key] = String(v == null ? '' : v).trim();
        }
      }
      if (isEmptyRow(r)) continue;
      rows.push(r);
    }
    return rows;
  }

  /* ------------------------------------------------------------------
     EKSPOR
     ------------------------------------------------------------------ */
  function stamp() {
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' +
           pad2(d.getHours()) + pad2(d.getMinutes());
  }

  function rowsToAOA(rows) {
    var head = [], i, j, aoa = [], line;
    for (i = 0; i < COLUMNS.length; i++) head.push(COLUMNS[i].t);
    head.push('Text Dus (x/total)');
    aoa.push(head);
    for (i = 0; i < rows.length; i++) {
      line = [];
      for (j = 0; j < COLUMNS.length; j++) {
        var k = COLUMNS[j].k;
        line.push(k === 'tanggal' ? fmtDate(rows[i][k]) : (rows[i][k] == null ? '' : rows[i][k]));
      }
      line.push(dusText(rows[i]));
      aoa.push(line);
    }
    return aoa;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function exportXLSX(rows) {
    if (typeof XLSX === 'undefined') return false;
    var ws = XLSX.utils.aoa_to_sheet(rowsToAOA(rows));
    var wb = XLSX.utils.book_new();
    ws['!cols'] = COLUMNS.map(function (c) { return { wch: Math.max(10, Math.round(c.w / 7)) }; })
                         .concat([{ wch: 16 }]);
    XLSX.utils.book_append_sheet(wb, ws, 'DATA');
    XLSX.writeFile(wb, 'Label-Gudang-' + stamp() + '.xlsx');
    return true;
  }

  function exportCSV(rows) {
    var aoa = rowsToAOA(rows), i, j, out = [], line;
    for (i = 0; i < aoa.length; i++) {
      line = [];
      for (j = 0; j < aoa[i].length; j++) {
        var v = String(aoa[i][j] == null ? '' : aoa[i][j]);
        line.push(/[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
      }
      out.push(line.join(','));
    }
    /* BOM supaya Excel membaca huruf beraksen dengan benar */
    downloadBlob(new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
                 'Label-Gudang-' + stamp() + '.csv');
    return true;
  }

  function exportJSON(state) {
    downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
                 'Cadangan-Label-Gudang-' + stamp() + '.json');
    return true;
  }

  /* ------------------------------------------------------------------
     DATA CONTOH
     ------------------------------------------------------------------ */
  /* kode, sku, varian, qty, kodeDus, dusKe, totalDus, lokasi final, zona,
     status, barcode, area, kode golongan, golongan, prefix lokasi */
  var SAMPLE = [
    ['1061', 'MC01', 'WHITE',  '25 BOX',  'MC01-1W', 1, 1, 'G2-F2-S03', 'HIJAU',  'READY',
      '8991002101061', 'G2', 'MCB', 'Mug Ceramic', 'G2-MCB'],
    ['1061', 'MC01', 'BLACK',  '25 BOX',  'MC01-1B', 1, 2, 'G2-F2-S04', 'HIJAU',  'READY',
      '8991002101062', 'G2', 'MCB', 'Mug Ceramic', 'G2-MCB'],
    ['1062', 'MC02', 'WHITE',  '113 PCS', 'MC02-1W', 1, 4, 'G2-F3-S01', 'KUNING', 'PENDING',
      '8991002101070', 'G2', 'MCB', 'Mug Ceramic', 'G2-MCB'],
    ['1062', 'MC02', 'WHITE',  '113 PCS', 'MC02-2W', 2, 4, 'G2-F3-S01', 'KUNING', 'PENDING',
      '8991002101070', 'G2', 'MCB', 'Mug Ceramic', 'G2-MCB'],
    ['1071', 'TP18', 'NATURAL', '18 TPL', 'TP18-1N', 1, 3, 'G1-A1-S07', 'HIJAU',  'READY',
      '8991002101087', 'G1', 'TPL', 'Tempat Pensil', 'G1-TPL'],
    ['1071', 'TP18', 'NATURAL', '18 TPL', 'TP18-2N', 2, 3, 'G1-A1-S08', 'HIJAU',  'READY',
      '8991002101087', 'G1', 'TPL', 'Tempat Pensil', 'G1-TPL'],
    /* dua baris ini sengaja belum punya lokasi final: labelnya harus
       tercetak bertanda "Lokasi belum diset", bukan memakai prefiksnya */
    ['1088', 'KB44', 'BIRU',   '40 PCS',  'KB44-1B', 1, 2, '',          'NEW',    'NEW',
      '8991002101094', 'G4', 'KBL', 'Kabel', 'G4-KBL'],
    ['1088', 'KB44', 'BIRU',   '40 PCS',  'KB44-2B', 2, 2, '',          'NEW',    'NEW',
      '8991002101094', 'G4', 'KBL', 'Kabel', 'G4-KBL'],
    ['1093', 'RS07', 'MERAH',  '60 PCS',  'RS07-1M', 1, 1, 'G3-C2-S11', 'MERAH',  'RUSAK',
      '8991002101100', 'G3', 'RSK', 'Rak Susun', 'G3-RSK'],
    ['1101', 'GL22', 'CLEAR',  '12 SET',  'GL22-1C', 1, 2, 'G1-B4-S02', 'HOLD',   'HOLD',
      '8991002101117', 'G1', 'GLS', 'Gelas', 'G1-GLS'],
    ['1101', 'GL22', 'CLEAR',  '12 SET',  'GL22-2C', 2, 2, 'G1-B4-S02', 'HOLD',   'HOLD',
      '8991002101117', 'G1', 'GLS', 'Gelas', 'G1-GLS'],
    ['1115', 'ND09', 'GREY',   '96 PCS',  'ND09-1G', 1, 1, 'G4-D1-S05', 'HIJAU',  'READY',
      '8991002101124', 'G4', 'NDL', 'Nampan Dulang', 'G4-NDL'],
    /* contoh gaya gudang ACC: lokasi final lengkap A-CHR-R01-B01-P01 */
    ['A2348', 'Anker Adp Fc 20W 2Port Usb/C A2348 White', '', '1 PCS', '', '', '',
      'A-CHR-R01-B01-P01', 'HIJAU', 'READY',
      '194644167882', 'A', 'CHR', 'Charger', 'A-CHR'],
    ['A2637', 'Anker Powerline III Usb-C 1.8M Black', '', '1 PCS', '', '', '',
      'A-KBL-R02-B03-P05', 'HIJAU', 'READY',
      '194644072148', 'A', 'KBL', 'Kabel', 'A-KBL']
  ];

  function sampleRows() {
    var out = [], i, s, r;
    for (i = 0; i < SAMPLE.length; i++) {
      s = SAMPLE[i];
      r = blank();
      r.labelId = makeId(i + 1);
      r.tanggal = '2026-04-14';
      r.supplier = 'MEEPLUS';
      r.grn = 'GRN-2604-' + pad2(i + 1);
      r.kode = s[0]; r.sku = s[1]; r.varian = s[2]; r.qty = s[3];
      r.kodeDus = s[4];
      r.dusKe = s[5] === '' ? '' : String(s[5]);
      r.totalDus = s[6] === '' ? '' : String(s[6]);
      r.lokasi = s[7]; r.zona = s[8]; r.status = s[9];
      r.barcode = s[10]; r.area = s[11]; r.kodeGol = s[12];
      r.golongan = s[13]; r.prefix = s[14];
      r.pic = 'MEEPLUS';
      out.push(r);
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  LG.data = {
    COLUMNS: COLUMNS,
    norm: norm,
    guessKey: guessKey,
    parseDate: parseDate,
    fmtDate: fmtDate,
    todayISO: todayISO,
    serialToISO: serialToISO,
    blank: blank,
    newRow: newRow,
    isEmptyRow: isEmptyRow,
    makeId: makeId,
    renumber: renumber,
    fillMissingIds: fillMissingIds,
    dusText: dusText,
    bigCode: bigCode,
    splitRow: splitRow,
    save: save,
    load: load,
    wipe: wipe,
    dbList: dbList,
    dbInfo: dbInfo,
    dbGet: dbGet,
    dbSet: dbSet,
    dbRestore: dbRestore,
    katalog: katalog,
    cariProduk: cariProduk,
    produkByBarcode: produkByBarcode,
    rowFromProduk: rowFromProduk,
    readWorkbook: readWorkbook,
    pickSheetName: pickSheetName,
    lokasiFinal: lokasiFinal,
    belumLokasiFinal: belumLokasiFinal,
    parseDelimited: parseDelimited,
    matrixToTable: matrixToTable,
    guessMapping: guessMapping,
    applyMapping: applyMapping,
    exportXLSX: exportXLSX,
    exportCSV: exportCSV,
    exportJSON: exportJSON,
    downloadBlob: downloadBlob,
    sampleRows: sampleRows
  };

})(window, document);
