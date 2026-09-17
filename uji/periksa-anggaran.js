/* =====================================================================
   uji/periksa-anggaran.js — memeriksa anggaran tinggi tiap template.
   Hanya butuh Node, tanpa pustaka tambahan.

       node uji/periksa-anggaran.js

   Template yang memakai mesin tata letak bersama menyusun isinya dari
   daftar bagian. Tinggi tiap bagian memakai satuan u, dan satu label
   selalu setinggi 10u, jadi aturannya bisa dihitung:

       jumlah(h) + 2*padU + (n-1)*gapU  <=  10

   Diperiksa juga: ukuran huruf harus muat di kotaknya sendiri, dan
   kolom judul harus cukup lebar untuk teks judulnya.
   ===================================================================== */
'use strict';
var fs = require('fs');
var vm = require('vm');
var path = require('path');

var ROOT = path.join(__dirname, '..');
function baca(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var win = {}; win.window = win;
var ctx = vm.createContext({ window: win, document: {}, console: console });
vm.runInContext(baca('vendor/xlsx.mini.min.js'), ctx, { filename: 'xlsx.mini.min.js' });
vm.runInContext(baca('assets/data.js'), ctx, { filename: 'data.js' });
vm.runInContext(baca('assets/templates.js'), ctx, { filename: 'templates.js' });
var T = win.LG.tpl;

var TINGGI_BARIS = 1.2;   /* tinggi baris + jarak + garis, relatif ukuran huruf */
var LEBAR_HURUF  = 0.71;  /* lebar rata-rata huruf kapital tebal + jarak huruf */

var gagal = [], catatan = [];

console.log('Keluarga template: ' + T.FAMILIES.map(function (f) {
  return f.nama + ' (' + T.byFamily(f.key).length + ')';
}).join(', ') + '  — total ' + T.TEMPLATES.length + '\n');

T.TEMPLATES.forEach(function (t) {
  if (!t.parts) { catatan.push(t.key + ': memakai render sendiri, tidak ikut diperiksa'); return; }

  var padU = t.padU === undefined ? 0.5 : t.padU;
  var gapU = t.gapU === undefined ? 0.3 : t.gapU;
  var n = t.parts.length;
  var tetap = 0, fill = 0;

  t.parts.forEach(function (p) {
    if (p.h === 'fill') fill++;
    else if (p.h === 'auto') catatan.push(t.key + ': memakai h:auto, tingginya tidak bisa dihitung');
    else tetap += p.h;
  });

  var sisip = 2 * padU + (n - 1) * gapU;
  var pakai = tetap + sisip;
  var sisa = 10 - pakai;

  if (pakai > 10) gagal.push(t.key + ': lebih dari 10u (' + pakai.toFixed(2) + 'u)');
  else if (fill > 0 && sisa < 0.8) gagal.push(t.key + ': sisa untuk bagian "fill" cuma ' + sisa.toFixed(2) + 'u');
  else if (fill === 0 && sisa > 1.5) catatan.push(t.key + ': ' + sisa.toFixed(2) + 'u tidak terpakai');

  /* ukuran huruf vs tinggi kotaknya */
  t.parts.forEach(function (p) {
    if (p.h === 'fill' || p.h === 'auto' || !p.size) return;
    var jml = (p.p === 'rows' && p.list) ? p.list.length : 1;
    var butuh = p.size * jml * TINGGI_BARIS;
    if (butuh > p.h + 0.01) {
      gagal.push(t.key + '/' + p.p + ': huruf ' + p.size + 'u x' + jml +
                 ' butuh ' + butuh.toFixed(2) + 'u, kotaknya cuma ' + p.h + 'u');
    }
  });

  /* lebar kolom judul vs panjang teks judulnya */
  t.parts.forEach(function (p) {
    if (p.p !== 'rows' || !p.list) return;
    var labSize = p.labSize || 0.4, labW = p.labW || 2.6, panjang = '';
    p.list.forEach(function (k) {
      var lab = (p.labels && p.labels[k]) || T.FIELD_LABEL(k);
      if (lab.length > panjang.length) panjang = lab;
    });
    var butuh = panjang.length * LEBAR_HURUF * labSize;
    if (butuh > labW + 0.01) {
      gagal.push(t.key + '/rows: judul "' + panjang + '" butuh ' + butuh.toFixed(2) +
                 'u, kolomnya cuma ' + labW + 'u');
    }
  });

  var rusak = gagal.length && gagal[gagal.length - 1].indexOf(t.key + ':') === 0;
  console.log('  ' + (rusak ? 'X' : '.') + ' ' + t.key.padEnd(15) +
              'tetap ' + tetap.toFixed(2).padStart(5) +
              ' + sisip ' + sisip.toFixed(2) +
              ' = ' + pakai.toFixed(2).padStart(5) +
              '   sisa untuk ' + fill + ' fill: ' + sisa.toFixed(2) + 'u');
});

console.log('\ncatatan: ' + catatan.length);
catatan.forEach(function (c) { console.log('   ' + c); });
console.log('gagal: ' + gagal.length);
gagal.forEach(function (g) { console.log('   ' + g); });
process.exit(gagal.length ? 1 : 0);
