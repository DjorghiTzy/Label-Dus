/* =====================================================================
   uji/periksa-impor.js — memeriksa jalur impor Excel.
   Hanya butuh Node, tanpa pustaka tambahan.

       node uji/periksa-impor.js

   Menjalankan data.js di luar browser, lalu membaca
   contoh/Format_Label_Dus.xlsx dan memastikan hasilnya sesuai harapan:
   sheet yang benar dipilih, baris judul hiasan dilewati, tanggal seri
   Excel dikonversi, dan baris ekor kosong dibuang.
   ===================================================================== */
'use strict';
var fs = require('fs');
var vm = require('vm');
var path = require('path');

var ROOT = path.join(__dirname, '..');
function baca(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* data.js ditulis untuk browser, jadi disediakan window/document seadanya. */
var win = {}; win.window = win;
var ctx = vm.createContext({
  window: win,
  document: { createElement: function () { return { style: {} }; },
              body: { appendChild: function () {}, removeChild: function () {} } },
  console: console, setTimeout: setTimeout,
  URL: { createObjectURL: function () { return ''; }, revokeObjectURL: function () {} },
  Blob: function () {}, localStorage: null
});
vm.runInContext(baca('vendor/xlsx.mini.min.js'), ctx, { filename: 'xlsx.mini.min.js' });
vm.runInContext(baca('assets/data.js'), ctx, { filename: 'data.js' });
var D = win.LG.data;

var buf = fs.readFileSync(path.join(ROOT, 'contoh/Format_Label_Dus.xlsx'));
var ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

var res = D.readWorkbook(ab);
var table = D.matrixToTable(res.matrix);
var map = D.guessMapping(table.headers);
var baris = D.applyMapping(table, map);

console.log('sheet dipilih  : ' + res.sheet + '  (dari ' + res.sheets.join(', ') + ')');
console.log('baris judul    : index ' + table.headerRow);
console.log('baris mentah   : ' + table.body.length + '  ->  terpakai: ' + baris.length);
console.log('pemetaan       :');
table.headers.forEach(function (h, i) {
  console.log('   ' + String(h || '(tanpa judul)').padEnd(22) + ' -> ' + (map[i] || '(lewati)'));
});

var gagal = 0;
function cek(nama, syarat, tambahan) {
  console.log('  ' + (syarat ? 'OK   ' : 'GAGAL') + '  ' + nama + (tambahan ? '  — ' + tambahan : ''));
  if (!syarat) gagal++;
}
console.log('\nDaftar periksa:');
cek('sheet DATA_PENERIMAAN dipilih, bukan PRINT/SETUP/README', res.sheet === 'DATA_PENERIMAAN');
cek('60 baris data terpakai (baris ekor dibuang)', baris.length === 60);
cek('tanggal seri Excel 46126 terbaca 14-04-2026', D.fmtDate(baris[0].tanggal) === '14-04-2026');
cek('kolom "SKU/Kode" masuk ke Kode', baris[0].kode === '1061');
cek('kolom "Nama Barang" masuk ke SKU', baris[0].sku === 'MC01');
cek('kolom "Dus Ke" masuk ke Kode dus', baris[0].kodeDus === 'MC01-1W');
function petaUntuk(judul) {
  var i = table.headers.indexOf(judul);
  return i < 0 ? '(kolom tidak ada)' : (map[i] || '');
}
cek('kolom "No" dilewati', petaUntuk('No') === '');
cek('kolom "Text Dus (x/total)" dilewati', petaUntuk('Text Dus (x/total)') === '');
cek('tidak ada baris tanpa tanggal', baris.filter(function (r) { return !r.tanggal; }).length === 0);
cek('nilai turunan dusText benar', D.dusText(baris[0]) === 'MC01-1W/1');
cek('nilai turunan bigCode benar', D.bigCode(baris[0]) === '1061');

/* pecah per dus */
var contoh = D.blank();
contoh.kodeDus = 'MC01-1W'; contoh.totalDus = 4; contoh.labelId = 'LBL-001';
var pecah = D.splitRow(contoh);
cek('pecah per dus: 1 baris Total Dus 4 menjadi 4 baris', pecah.length === 4);
cek('pecah per dus: kode dus dinomori ulang', pecah[2].kodeDus === 'MC01-3W');
cek('pecah per dus: Label ID diberi akhiran', pecah[2].labelId === 'LBL-001-3');

/* tanggal bentuk lain */
cek('tanggal 14/04/2026 terbaca', D.parseDate('14/04/2026') === '2026-04-14');
cek('tanggal 14-04-2026 terbaca', D.parseDate('14-04-2026') === '2026-04-14');
cek('tanggal 2026-04-14 tetap', D.parseDate('2026-04-14') === '2026-04-14');

/* ---- bolak-balik: ekspor lalu impor kembali harus utuh ---- */
console.log('\nBolak-balik ekspor -> impor:');
var asal = baris.slice(0, 20);
var aoa = [];
var judul = D.COLUMNS.map(function (c) { return c.t; });
aoa.push(judul);
asal.forEach(function (r) {
  aoa.push(D.COLUMNS.map(function (c) {
    return c.kind === 'date' ? D.fmtDate(r[c.k]) : (r[c.k] == null ? '' : String(r[c.k]));
  }));
});
var csv = aoa.map(function (baris) {
  return baris.map(function (v) {
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(',');
}).join('\r\n');

var t2 = D.matrixToTable(D.parseDelimited(csv));
var map2 = D.guessMapping(t2.headers);
var balik = D.applyMapping(t2, map2);

cek('semua ' + judul.length + ' kolom dikenali saat diimpor kembali',
    map2.filter(Boolean).length === judul.length,
    map2.filter(Boolean).length + '/' + judul.length + ' dikenali');
cek('jumlah baris tetap', balik.length === asal.length, balik.length + ' vs ' + asal.length);

var beda = [];
for (var bi = 0; bi < asal.length; bi++) {
  D.COLUMNS.forEach(function (c) {
    var a = String(asal[bi][c.k] == null ? '' : asal[bi][c.k]);
    var b = String(balik[bi][c.k] == null ? '' : balik[bi][c.k]);
    if (a !== b && beda.length < 5) beda.push('baris ' + (bi + 1) + ' kolom ' + c.t + ': "' + a + '" -> "' + b + '"');
  });
}
cek('isi tiap sel sama persis setelah bolak-balik', beda.length === 0, beda.join(' | '));

/* =====================================================================
   WORKBOOK MASTER GUDANG ACC

   Workbook aslinya punya empat sheet, dan tiga di antaranya rapi:
   "Data Issues" bahkan berbaris ribuan. Yang dicari tetap sheet SKU
   utama, "Draft Pengelompokan". Sekaligus diperiksa bahwa Prefix Lokasi
   tidak pernah berubah jadi lokasi final.
   ===================================================================== */
console.log('\nWorkbook master gudang ACC:');

var XL = ctx.XLSX || win.XLSX;
var wbAcc = XL.utils.book_new();

var master = [['Barcode', 'Name', 'Quantity On Hand', 'Unit', 'Kategori Sumber',
               'Area Draft', 'Kode Golongan', 'Golongan Draft', 'Prefix Lokasi',
               'Status Stok', 'Confidence', 'Catatan Klasifikasi', 'Lokasi Final']];
for (var ai = 0; ai < 40; ai++) {
  master.push(['194644167882', 'Anker Adp Fc 20W 2Port Usb/C A2348 White', 12, 'PCS', 'ACC',
               'A', 'CHR', 'Charger', 'A-CHR', 'READY', 0.92, 'otomatis',
               ai < 20 ? 'A-CHR-R01-B01-P0' + (ai % 9 + 1) : '']);
}
XL.utils.book_append_sheet(wbAcc, XL.utils.aoa_to_sheet(master), 'Draft Pengelompokan');

var ringkas = [['Kode Golongan', 'Golongan', 'Jumlah SKU']];
for (ai = 0; ai < 12; ai++) ringkas.push(['CHR', 'Charger', 10]);
XL.utils.book_append_sheet(wbAcc, XL.utils.aoa_to_sheet(ringkas), 'Summary Golongan');

/* sengaja dibuat paling panjang: dulu sheet ini yang menang */
var isu = [['Barcode', 'Name', 'Issue', 'Catatan']];
for (ai = 0; ai < 400; ai++) isu.push(['194644167882', 'Anker', 'duplikat', 'cek manual']);
XL.utils.book_append_sheet(wbAcc, XL.utils.aoa_to_sheet(isu), 'Data Issues');

var aturan = [['Kode', 'Aturan', 'Contoh']];
for (ai = 0; ai < 20; ai++) aturan.push(['CHR', 'charger dan adaptor', 'A-CHR']);
XL.utils.book_append_sheet(wbAcc, XL.utils.aoa_to_sheet(aturan), 'Kode & Aturan');

var bufAcc = XL.write(wbAcc, { type: 'array', bookType: 'xlsx' });
var resAcc = D.readWorkbook(bufAcc.buffer || bufAcc);
cek('sheet SKU utama yang dipilih, bukan "Data Issues"',
    resAcc.sheet === 'Draft Pengelompokan', resAcc.sheet);

var tAcc = D.matrixToTable(resAcc.matrix);
var mAcc = D.guessMapping(tAcc.headers);
var kolomAcc = {};
tAcc.headers.forEach(function (h, j) { if (mAcc[j]) kolomAcc[h] = mAcc[j]; });

cek('kolom "Barcode" dikenali', kolomAcc.Barcode === 'barcode', kolomAcc.Barcode);
cek('kolom "Name" masuk ke nama barang', kolomAcc.Name === 'sku', kolomAcc.Name);
cek('kolom "Area Draft" tidak jadi Zona', kolomAcc['Area Draft'] === 'area', kolomAcc['Area Draft']);
cek('kolom "Kode Golongan" tidak jadi Kode', kolomAcc['Kode Golongan'] === 'kodeGol', kolomAcc['Kode Golongan']);
cek('kolom "Golongan Draft" dikenali', kolomAcc['Golongan Draft'] === 'golongan', kolomAcc['Golongan Draft']);
cek('kolom "Prefix Lokasi" tidak jadi Lokasi final', kolomAcc['Prefix Lokasi'] === 'prefix', kolomAcc['Prefix Lokasi']);
cek('kolom "Lokasi Final" dikenali', kolomAcc['Lokasi Final'] === 'lokasi', kolomAcc['Lokasi Final']);

var barisAcc = D.applyMapping(tAcc, mAcc);
cek('semua 40 baris terbaca', barisAcc.length === 40, barisAcc.length + ' baris');
cek('lokasi final terbaca utuh', barisAcc[0].lokasi === 'A-CHR-R01-B01-P01', barisAcc[0].lokasi);
cek('prefix tersimpan terpisah', barisAcc[0].prefix === 'A-CHR', barisAcc[0].prefix);

var tanpaLokasi = barisAcc.filter(function (r) { return D.belumLokasiFinal(r); });
cek('20 baris tanpa lokasi final ditandai', tanpaLokasi.length === 20, tanpaLokasi.length + ' baris');
cek('prefix tidak pernah jadi lokasi final',
    tanpaLokasi.every(function (r) { return !String(r.lokasi || '').trim(); }));

var palsu = D.blank(); palsu.prefix = 'A-CHR'; palsu.lokasi = 'A-CHR';
cek('prefix yang tersalin ke kolom lokasi tetap ditolak',
    D.lokasiFinal(palsu) === '' && D.belumLokasiFinal(palsu) === true);

/* =====================================================================
   SHEET "Claude Import"

   Workbook saran lokasi punya enam sheet, dan tiga di antaranya sama-sama
   berisi daftar SKU. Yang dipakai harus sheet yang memang disiapkan untuk
   aplikasi ini, lengkap dengan Lokasi Final dan QR Payload jadi.
   ===================================================================== */
console.log('\nWorkbook saran lokasi (sheet "Claude Import"):');

var wbMap = XL.utils.book_new();

var saran = [['SARAN LOKASI GUDANG ACC PER TIPE / MODEL'], [''], [''],
             ['Area', 'Kode Golongan', 'Golongan', 'Brand', 'Tipe / Model', 'Jumlah SKU']];
for (var mi = 0; mi < 300; mi++) saran.push(['A', 'CHR', 'Charger', 'Anker', 'A2348', 4]);
XL.utils.book_append_sheet(wbMap, XL.utils.aoa_to_sheet(saran), 'Saran Per Tipe');

var perSku = [['DRAFT LOKASI FINAL PER SKU - GUDANG ACC'], [''], [''],
              ['No', 'Barcode', 'Name', 'Quantity On Hand', 'Unit', 'Area', 'Kode Golongan',
               'Golongan', 'Brand Saran', 'Tipe Saran', 'Prefix Lokasi', 'Rak', 'Baris',
               'Posisi', 'Lokasi Final', 'QR Payload', 'Status Stok', 'Status Mapping']];
for (mi = 0; mi < 500; mi++) {
  perSku.push([mi + 1, '194644167882', 'Anker Adp Fc 20W', 3, 'PCS', 'A', 'CHR', 'Charger',
               'Anker', 'A2348', 'A-CHR', 'R01', 'B01', 'P04', 'A-CHR-R01-B01-P04',
               '194644167882|A-CHR-R01-B01-P04', 'READY', 'DRAFT OK']);
}
XL.utils.book_append_sheet(wbMap, XL.utils.aoa_to_sheet(perSku), 'Lokasi Final SKU');

var imp = [['DATA IMPORT UNTUK REVISI APLIKASI LABEL RAK'],
           ['Gunakan sheet ini sebagai mapping final draft.'], [''],
           ['Barcode', 'Name', 'Area', 'Kode Golongan', 'Golongan', 'Brand', 'Tipe',
            'Prefix Lokasi', 'Lokasi Final', 'QR Payload', 'Status Mapping']];
imp.push(['194644167882', 'Anker Adp Fc 20W 2Port Usb/C A2348 White', 'A', 'CHR', 'Charger',
          'Anker', 'A2348', 'A-CHR', 'A-CHR-R01-B01-P04',
          '194644167882|A-CHR-R01-B01-P04', 'DRAFT OK']);
imp.push(['6953156286511', 'Baseus Car Chr A+A 30W Dual QC3.0', 'B', 'CCH', 'Car Charger',
          'Baseus', 'Car Chr A+A 30W Dual QC3.0', 'B-CCH', 'B-CCH-R01-B01-P06',
          '6953156286511|B-CCH-R01-B01-P06', 'REVIEW TIPE']);
imp.push(['', 'chr inf', 'A', 'CHR', 'Charger', 'chr', 'inf', 'A-CHR',
          'A-CHR-R01-B03-P03', '', 'REVIEW BARCODE']);
XL.utils.book_append_sheet(wbMap, XL.utils.aoa_to_sheet(imp), 'Claude Import');

var ring = [['RINGKASAN KEBUTUHAN RAK DRAFT'], [''], [''],
            ['Area', 'Kode', 'Golongan', 'Prefix', 'Total SKU']];
for (mi = 0; mi < 25; mi++) ring.push(['A', 'CHR', 'Charger', 'A-CHR', 40]);
XL.utils.book_append_sheet(wbMap, XL.utils.aoa_to_sheet(ring), 'Ringkasan Area');

var atur = [['ATURAN DRAFT MAPPING LOKASI GUDANG ACC'], [''],
            ['Parameter', 'Nilai', 'Tujuan', 'Boleh Diubah?', 'Catatan', 'Contoh'],
            ['Format Lokasi', 'AREA-KODE-Rxx-Bxx-Pxx', 'Alamat lokasi unik', 'Tidak', '', 'A-CHR-R01-B01-P01']];
XL.utils.book_append_sheet(wbMap, XL.utils.aoa_to_sheet(atur), 'Aturan Mapping');

var bufMap = XL.write(wbMap, { type: 'array', bookType: 'xlsx' });
var resMap = D.readWorkbook(bufMap.buffer || bufMap);
cek('sheet "Claude Import" yang dipilih', resMap.sheet === 'Claude Import', resMap.sheet);

var tMap = D.matrixToTable(resMap.matrix);
var mMap = D.guessMapping(tMap.headers);
var kolomMap = {};
tMap.headers.forEach(function (h, j) { if (mMap[j]) kolomMap[h] = mMap[j]; });

cek('kolom "Brand" dikenali', kolomMap.Brand === 'brand', kolomMap.Brand);
cek('kolom "Tipe" tidak jadi Varian', kolomMap.Tipe === 'tipe', kolomMap.Tipe);
cek('kolom "QR Payload" dikenali', kolomMap['QR Payload'] === 'qrPayload', kolomMap['QR Payload']);
cek('kolom "Status Mapping" dikenali', kolomMap['Status Mapping'] === 'statusMap', kolomMap['Status Mapping']);
cek('Barcode tidak tertukar dengan Kode Golongan',
    kolomMap.Barcode === 'barcode' && kolomMap['Kode Golongan'] === 'kodeGol',
    kolomMap.Barcode + ' / ' + kolomMap['Kode Golongan']);

var barisMap = D.applyMapping(tMap, mMap);
cek('tiga baris mapping terbaca', barisMap.length === 3, barisMap.length + ' baris');
cek('lokasi A-CHR-R01-B01-P04 terbaca benar',
    D.lokasiFinal(barisMap[0]) === 'A-CHR-R01-B01-P04', barisMap[0].lokasi);
cek('QR memakai payload dari Excel apa adanya',
    D.qrPayload(barisMap[0]) === '194644167882|A-CHR-R01-B01-P04', D.qrPayload(barisMap[0]));
cek('status DRAFT OK terbaca', D.statusMapping(barisMap[0]) === 'ok', barisMap[0].statusMap);
cek('status REVIEW TIPE terbaca', D.statusMapping(barisMap[1]) === 'tipe', barisMap[1].statusMap);
cek('status REVIEW BARCODE terbaca', D.statusMapping(barisMap[2]) === 'barcode', barisMap[2].statusMap);
cek('baris REVIEW BARCODE tidak dibuang dan lokasinya tetap utuh',
    D.lokasiFinal(barisMap[2]) === 'A-CHR-R01-B03-P03', barisMap[2].lokasi);
cek('QR baris tanpa barcode jatuh ke lokasi final, bukan prefix',
    D.qrPayload(barisMap[2]) === 'A-CHR-R01-B03-P03', D.qrPayload(barisMap[2]));

/* =====================================================================
   GENERATOR LOKASI RAK

   {PREFIX}-Rxx-Bxx-Pxx, 4 baris x 10 posisi per rak. Yang diperiksa:
   urutannya benar, tiap prefix punya antrean sendiri, lokasi yang sudah
   ada tidak pernah digeser, dan hasilnya sama kalau dijalankan lagi.
   ===================================================================== */
console.log('\nGenerator lokasi rak:');

function skuBaru(pre, bc, brand, tipe, nama, lok) {
  var r = D.blank();
  r.prefix = pre; r.barcode = bc; r.brand = brand; r.tipe = tipe; r.sku = nama;
  r.lokasi = lok || '';
  return r;
}

cek('prefix dikenali, lokasi final ditolak sebagai prefix',
    D.isPrefix('A-CHR') === true && D.isPrefix('A-CHR-R01-B01-P01') === false);
cek('lokasi final dikenali, prefix ditolak',
    D.isLokasiFinal('A-CHR-R01-B01-P01') === true && D.isLokasiFinal('A-CHR') === false);
/* R1-B1-P1 masih diterima kalau diketik orang — data lama tidak dibuang.
   Yang penting generatornya sendiri selalu menulis dua digit. */
cek('R1-B1-P1 yang diketik tangan tetap terbaca', D.isLokasiFinal('A-CHR-R1-B1-P1') === true);
cek('generator selalu menulis dua digit',
    (function () {
      var q, t;
      for (q = 0; q < 200; q++) {
        t = D.slotKeLokasi('A-CHR', q);
        if (!/-R\d{2}-B\d{2}-P\d{2}$/.test(t)) return false;
      }
      return true;
    })());
cek('kapasitas bawaan 4 baris x 10 posisi',
    D.KAPASITAS.baris === 4 && D.KAPASITAS.posisi === 10,
    D.KAPASITAS.baris + ' x ' + D.KAPASITAS.posisi);

cek('slot 0 jadi R01-B01-P01', D.slotKeLokasi('A-CHR', 0) === 'A-CHR-R01-B01-P01',
    D.slotKeLokasi('A-CHR', 0));
cek('slot 9 jadi R01-B01-P10', D.slotKeLokasi('A-CHR', 9) === 'A-CHR-R01-B01-P10',
    D.slotKeLokasi('A-CHR', 9));
cek('setelah P10 lanjut B02-P01', D.slotKeLokasi('A-CHR', 10) === 'A-CHR-R01-B02-P01',
    D.slotKeLokasi('A-CHR', 10));
cek('slot 39 jadi R01-B04-P10', D.slotKeLokasi('A-CHR', 39) === 'A-CHR-R01-B04-P10',
    D.slotKeLokasi('A-CHR', 39));
cek('setelah B04-P10 lanjut R02-B01-P01', D.slotKeLokasi('A-CHR', 40) === 'A-CHR-R02-B01-P01',
    D.slotKeLokasi('A-CHR', 40));
cek('tidak pernah muncul P11 atau B05',
    !/P(1[1-9]|[2-9]\d)|B(0[5-9]|[1-9]\d)/.test(
      (function () { var t = [], q; for (q = 0; q < 120; q++) t.push(D.slotKeLokasi('A-CHR', q)); return t.join(' '); })()));

/* satu prefix, 45 SKU -> harus melewati batas rak dengan benar */
var gen = [], gi;
for (gi = 0; gi < 45; gi++) gen.push(skuBaru('A-CHR', 'BC' + gi, 'Anker', 'T' + gi, 'Item ' + gi));
for (gi = 0; gi < 3; gi++) gen.push(skuBaru('B-CCH', 'CD' + gi, 'Baseus', 'U' + gi, 'Car ' + gi));
var hg = D.generateLokasi(gen);
cek('semua 48 baris dapat lokasi', hg.dibuat === 48, JSON.stringify(hg));

var lokA = gen.filter(function (r) { return r.prefix === 'A-CHR'; })
              .map(function (r) { return r.lokasi; }).sort();
cek('A-CHR mulai dari R01-B01-P01', lokA[0] === 'A-CHR-R01-B01-P01', lokA[0]);
cek('A-CHR yang ke-45 sampai R02-B01-P05', lokA[44] === 'A-CHR-R02-B01-P05', lokA[44]);
cek('prefix lain punya antrean sendiri',
    gen[45].lokasi === 'B-CCH-R01-B01-P01', gen[45].lokasi);
cek('tidak ada lokasi kembar', D.lokasiKembar(gen).length === 0,
    D.lokasiKembar(gen).join(', '));
cek('Rak/Baris/Posisi ikut terisi',
    gen[0].rak === 'R01' && gen[0].baris === 'B01' && gen[0].posisi === 'P01',
    [gen[0].rak, gen[0].baris, gen[0].posisi].join(' '));

/* jalankan lagi: tidak boleh ada yang bergeser */
var sebelum = gen.map(function (r) { return r.lokasi; }).join(',');
var hg2 = D.generateLokasi(gen);
cek('menjalankan ulang tidak membuat lokasi baru', hg2.dibuat === 0, JSON.stringify(hg2));
cek('lokasi yang sudah ada tidak bergeser',
    gen.map(function (r) { return r.lokasi; }).join(',') === sebelum);

/* lokasi existing dihormati, slot kosongnya diisi */
var campur = [
  skuBaru('A-CHR', 'X1', 'Anker', 'T1', 'Satu', 'A-CHR-R01-B01-P03'),
  skuBaru('A-CHR', 'X2', 'Anker', 'T2', 'Dua'),
  skuBaru('A-CHR', 'X3', 'Anker', 'T3', 'Tiga')
];
var hc = D.generateLokasi(campur);
cek('lokasi existing tidak ditimpa', campur[0].lokasi === 'A-CHR-R01-B01-P03', campur[0].lokasi);
cek('slot kosong diisi dari yang paling awal',
    campur[1].lokasi === 'A-CHR-R01-B01-P01' && campur[2].lokasi === 'A-CHR-R01-B01-P02',
    campur[1].lokasi + ' / ' + campur[2].lokasi);
cek('slot yang sudah terpakai dilewati', hc.sudahAda === 1 && hc.dibuat === 2, JSON.stringify(hc));

/* barcode jadi identitas: impor kedua kalinya tidak menggeser apa pun */
var ulang = [
  skuBaru('A-CHR', 'SAMA', 'Anker', 'T1', 'Satu', 'A-CHR-R01-B02-P07'),
  skuBaru('A-CHR', 'SAMA', 'Anker', 'T1', 'Satu (impor ulang)')
];
D.generateLokasi(ulang);
cek('barcode yang sama memakai lokasi yang sama',
    ulang[1].lokasi === 'A-CHR-R01-B02-P07', ulang[1].lokasi);

/* prefix kosong / tidak sah */
var tanpa = [skuBaru('', 'Y1', '', '', 'Tanpa prefix'),
             skuBaru('A-CHR-R01-B01-P01', 'Y2', '', '', 'Prefix keliru diisi lokasi')];
var ht = D.generateLokasi(tanpa);
cek('prefix kosong tidak digenerate', ht.tanpaPrefix === 1 && !tanpa[0].lokasi, JSON.stringify(ht));
cek('prefix yang sebenarnya lokasi final ditolak', ht.lokasiSalah === 1 && !tanpa[1].lokasi);

/* prefix tetap bukan lokasi final */
var pre1 = D.blank(); pre1.prefix = 'A-CHR'; pre1.lokasi = 'A-CHR';
cek('A-CHR di kolom lokasi tetap dianggap belum final',
    D.belumLokasiFinal(pre1) === true && D.lokasiFinal(pre1) === '');

/* QR ikut lokasi hasil generate */
var qr1 = skuBaru('A-CHR', '194644167882', 'Anker', 'A2348', 'Anker Adp Fc 20W');
D.generateLokasi([qr1]);
cek('QR memakai barcode|lokasi final',
    D.qrPayload(qr1) === '194644167882|A-CHR-R01-B01-P01', D.qrPayload(qr1));

/* ekspor -> impor: lokasi kembali persis sama */
var csvLok = D.COLUMNS.map(function (c) { return c.t; }).join(',') + '\r\n' +
  gen.slice(0, 5).map(function (r) {
    return D.COLUMNS.map(function (c) {
      var v = String(r[c.k] == null ? '' : r[c.k]);
      return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',');
  }).join('\r\n');
var tLok = D.matrixToTable(D.parseDelimited(csvLok));
var barisLok = D.applyMapping(tLok, D.guessMapping(tLok.headers));
cek('lokasi ikut dalam ekspor dan kembali utuh',
    barisLok.map(function (r) { return r.lokasi; }).join(',') ===
    gen.slice(0, 5).map(function (r) { return r.lokasi; }).join(','),
    barisLok.map(function (r) { return r.lokasi; }).join(','));
cek('Rak/Baris/Posisi ikut dalam ekspor',
    barisLok[0].rak === gen[0].rak && barisLok[0].baris === gen[0].baris &&
    barisLok[0].posisi === gen[0].posisi);
var hRestore = D.generateLokasi(barisLok);
cek('restore tidak membuat lokasi baru', hRestore.dibuat === 0, JSON.stringify(hRestore));

console.log('\ngagal: ' + gagal);
process.exit(gagal ? 1 : 0);
