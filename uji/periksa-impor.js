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

console.log('\ngagal: ' + gagal);
process.exit(gagal ? 1 : 0);
