/* =====================================================================
   uji/periksa-browser.js — membuka aplikasi di Chromium sungguhan.

       node uji/periksa-browser.js

   Butuh Playwright. Kalau tidak ada, pemeriksaan ini dilewati dengan
   pesan, bukan error — aplikasinya sendiri tetap tanpa pustaka apa pun.

   Yang diperiksa:
   Bisa diarahkan ke alamat lain, misalnya untuk memeriksa hasil deploy
   atau server statis:

       BASIS=http://localhost:8080 node uji/periksa-browser.js

   - ketiga pustaka vendor termuat dari file lokal
   - tidak ada satu pun permintaan jaringan keluar (selain ke asal sendiri)
   - tidak ada console.error sepanjang alur
   - seluruh template: isinya tidak keluar dari kotak label, DAN tidak
     terpotong di dalam bagiannya sendiri (ini tidak terlihat dari luar
     karena tiap bagian memakai overflow:hidden)
   - dua template ukuran pasti benar-benar 100x25 mm dan 100x250 mm
   - impor contoh menghasilkan 60 baris dengan tanggal yang benar
   - data bertahan setelah halaman dimuat ulang
   - layar selebar 390 px: semua tombol terjangkau
   ===================================================================== */
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..');
var BASIS = process.env.BASIS || ('file://' + ROOT);
var ASAL = BASIS.replace(/\/+$/, '');

function muatPlaywright() {
  var kandidat = ['playwright', 'playwright-core',
                  '/opt/node22/lib/node_modules/playwright',
                  '/usr/lib/node_modules/playwright'];
  for (var i = 0; i < kandidat.length; i++) {
    try { return require(kandidat[i]); } catch (e) { /* coba berikutnya */ }
  }
  return null;
}

var pw = muatPlaywright();
if (!pw) {
  console.log('Playwright tidak ada — pemeriksaan browser dilewati.');
  console.log('Pasang dengan:  npm i -D playwright && npx playwright install chromium');
  console.log('(Aplikasinya sendiri tidak butuh ini. Pemeriksaan lain tetap jalan:');
  console.log(' node uji/periksa-impor.js  dan  node uji/periksa-anggaran.js)');
  process.exit(0);
}

var gagal = [];
function cek(nama, syarat, tambahan) {
  console.log('  ' + (syarat ? 'OK   ' : 'GAGAL') + '  ' + nama + (tambahan ? '  — ' + tambahan : ''));
  if (!syarat) gagal.push(nama + (tambahan ? ' (' + tambahan + ')' : ''));
}

(function () {
  console.log('Memeriksa: ' + ASAL);
  return pw.chromium.launch().then(function (browser) {
    var errs = [], reqs = [], page;

    return browser.newPage({ viewport: { width: 1440, height: 950 } }).then(function (p) {
      page = p;
      page.on('pageerror', function (e) { errs.push('pageerror: ' + e.message); });
      page.on('console', function (m) { if (m.type() === 'error') errs.push('console: ' + m.text()); });
      /* permintaan ke asal sendiri wajar saat dilayani lewat HTTP;
         yang dicari adalah permintaan ke luar, misalnya ke CDN font */
      page.on('request', function (r) {
        var u = r.url();
        if (u.indexOf('file://') === 0 || u.indexOf(ASAL) === 0) return;
        reqs.push(u);
      });

      return page.goto(ASAL + '/index.html');
    })
    .then(function () { return page.waitForTimeout(400); })
    .then(function () { return page.evaluate(function () { try { localStorage.clear(); } catch (e) {} }); })
    .then(function () { return page.reload(); })
    .then(function () { return page.waitForTimeout(400); })

    /* ---- pustaka vendor ---- */
    .then(function () {
      return page.evaluate(function () {
        return { XLSX: typeof XLSX, qrcode: typeof qrcode, JsBarcode: typeof JsBarcode };
      });
    })
    .then(function (libs) {
      console.log('\n== Pustaka vendor ==');
      cek('SheetJS termuat', libs.XLSX === 'object');
      cek('qrcode-generator termuat', libs.qrcode === 'function');
      cek('JsBarcode termuat', libs.JsBarcode === 'function');
    })

    /* ---- impor contoh ---- */
    .then(function () { return page.setInputFiles('#fileIn', path.join(ROOT, 'contoh/Format_Label_Dus.xlsx')); })
    .then(function () { return page.waitForTimeout(1000); })
    .then(function () { return page.click('#mapOk'); })
    .then(function () { return page.waitForTimeout(700); })
    .then(function () {
      return page.evaluate(function () {
        return {
          n: document.querySelectorAll('#gridBody tr').length,
          tgl: (document.querySelector('#gridBody tr:first-child input[data-k="tanggal"]') || {}).value,
          kode: (document.querySelector('#gridBody tr:first-child input[data-k="kode"]') || {}).value
        };
      });
    })
    .then(function (r) {
      console.log('\n== Impor ==');
      cek('impor contoh menghasilkan 60 baris', r.n === 60, r.n + ' baris');
      cek('tanggal seri Excel terbaca 14-04-2026', r.tgl === '14-04-2026', r.tgl);
      cek('kolom SKU/Kode masuk ke Kode', r.kode === '1061', r.kode);
    })

    /* ---- seluruh template ---- */
    .then(function () { return page.click('#tabPrint'); })
    .then(function () { return page.waitForTimeout(600); })
    .then(function () { return page.$$eval('#famTabs .famtab', function (n) { return n.map(function (x) { return x.getAttribute('data-fam'); }); }); })
    .then(function (fams) {
      console.log('\n== Template ==');
      var rantai = Promise.resolve(), diuji = 0;
      fams.forEach(function (fam) {
        rantai = rantai
          .then(function () { return page.click('[data-fam="' + fam + '"]'); })
          .then(function () { return page.waitForTimeout(500); })
          .then(function () { return page.$$eval('#tplPicker .tpl', function (n) { return n.map(function (x) { return x.getAttribute('data-tpl'); }); }); })
          .then(function (keys) {
            var sub = Promise.resolve();
            keys.forEach(function (k) {
              sub = sub
                .then(function () { return page.click('[data-tpl="' + k + '"]'); })
                .then(function () { return page.waitForTimeout(330); })
                .then(function () {
                  return page.evaluate(function () {
                    var MM = 96 / 25.4, mm = function (v) { return Math.round(v / MM * 10) / 10; };
                    var l = document.querySelector('#stage .lbl');
                    if (!l) return null;
                    var b = l.getBoundingClientRect();
                    var luber = 0;
                    l.querySelectorAll('*').forEach(function (n) {
                      var r = n.getBoundingClientRect();
                      var d = Math.max(0, r.right - b.right, b.left - r.left, r.bottom - b.bottom, b.top - r.top);
                      if (d > luber) luber = d;
                    });
                    var potong = [];
                    l.querySelectorAll('.gen > *, .g-hero, .g-rows, .g-route, .g-write, .g-big2').forEach(function (n) {
                      var dh = n.scrollHeight - n.clientHeight, dw = n.scrollWidth - n.clientWidth;
                      if (dh > 2 || dw > 2) {
                        var c = (n.className.baseVal !== undefined ? n.className.baseVal : n.className) || n.tagName;
                        potong.push(String(c).split(' ')[0] + ' -' + Math.round(Math.max(dh, dw) / MM) + 'mm');
                      }
                    });
                    return { w: mm(b.width), h: mm(b.height), luber: Math.round(luber / MM * 10) / 10, potong: potong,
                             per: +document.getElementById('cntPer').textContent };
                  });
                })
                .then(function (r) {
                  diuji++;
                  var ok = r && r.luber <= 0.6 && r.potong.length === 0;
                  console.log('  ' + (ok ? '.' : 'X') + ' ' + k.padEnd(15) +
                              (r ? r.w + ' x ' + r.h + ' mm, ' + r.per + '/lembar, ' +
                                   (r.potong.length ? 'TERPOTONG ' + r.potong.join(', ') : 'utuh') : 'KOSONG'));
                  if (!ok) gagal.push('template ' + k + (r && r.potong.length ? ': terpotong ' + r.potong.join(', ') : ': luber ' + (r ? r.luber : '?') + 'mm'));
                });
            });
            return sub;
          });
      });
      return rantai.then(function () { console.log('  (' + diuji + ' template diperiksa)'); });
    })

    /* ---- ukuran pasti ---- */
    .then(function () {
      console.log('\n== Ukuran pasti ==');
      return page.click('[data-fam="rak"]')
        .then(function () { return page.waitForTimeout(300); })
        .then(function () { return page.click('[data-tpl="rak100"]'); })
        .then(function () { return page.waitForTimeout(600); })
        .then(function () {
          return page.evaluate(function () {
            var MM = 96 / 25.4, l = document.querySelector('#stage .lbl').getBoundingClientRect();
            return { w: Math.round(l.width / MM * 100) / 100, h: Math.round(l.height / MM * 100) / 100,
                     per: +document.getElementById('cntPer').textContent,
                     lembar: +document.getElementById('cntPage').textContent };
          });
        })
        .then(function (r) {
          cek('Strip rak tepat 100 x 25 mm', r.w === 100 && r.h === 25, r.w + ' x ' + r.h + ' mm');
          cek('20 label per lembar A4', r.per === 20, r.per + '/lembar');
          cek('60 label jadi 3 lembar', r.lembar === 3, r.lembar + ' lembar');
        })
        .then(function () { return page.click('[data-fam="dus"]'); })
        .then(function () { return page.waitForTimeout(300); })
        .then(function () { return page.click('[data-tpl="dus250"]'); })
        .then(function () { return page.waitForTimeout(700); })
        .then(function () {
          return page.evaluate(function () {
            var MM = 96 / 25.4, l = document.querySelector('#stage .lbl').getBoundingClientRect();
            return { w: Math.round(l.width / MM * 100) / 100, h: Math.round(l.height / MM * 100) / 100,
                     per: +document.getElementById('cntPer').textContent };
          });
        })
        .then(function (r) {
          cek('Banner dus tepat 100 x 250 mm', r.w === 100 && r.h === 250, r.w + ' x ' + r.h + ' mm');
          cek('2 label per lembar A4', r.per === 2, r.per + '/lembar');
        });
    })

    /* ---- jalur cetak: lembar terakhir tidak kosong ---- */
    .then(function () {
      return page.evaluate(function () {
        window.print = function () {
          window.__snap = {
            lembar: document.querySelectorAll('#paper .sheet').length,
            label: document.querySelectorAll('#paper .lbl').length,
            terakhir: document.querySelectorAll('#paper .sheet:last-child .lbl').length
          };
        };
      });
    })
    .then(function () { return page.click('#btnPrint'); })
    .then(function () { return page.waitForTimeout(350); })
    .then(function () { return page.click('#sumOk'); })
    .then(function () { return page.waitForTimeout(1100); })
    .then(function () { return page.evaluate(function () { return window.__snap; }); })
    .then(function (s) {
      console.log('\n== Cetak ==');
      cek('60 label jadi 30 lembar', s && s.lembar === 30 && s.label === 60, s ? s.lembar + ' lembar / ' + s.label + ' label' : 'tidak ada');
      cek('lembar terakhir terisi penuh (tidak ada halaman kosong)', s && s.terakhir === 2, s ? s.terakhir + ' label' : '-');
    })

    /* ---- urungkan ---- */
    .then(function () { return page.click('#tabData'); })
    .then(function () { return page.waitForTimeout(300); })
    .then(function () { return page.click('#btnSplit'); })
    .then(function () { return page.waitForTimeout(500); })
    .then(function () { return page.$$eval('#gridBody tr', function (n) { return n.length; }); })
    .then(function (n) {
      console.log('\n== Urungkan ==');
      cek('pecah per dus menambah baris', n > 60, n + ' baris');
      return page.click('#btnUndo')
        .then(function () { return page.waitForTimeout(400); })
        .then(function () { return page.$$eval('#gridBody tr', function (x) { return x.length; }); })
        .then(function (m) { cek('urungkan mengembalikan ke 60 baris', m === 60, m + ' baris'); });
    })

    /* ---- bertahan setelah muat ulang ---- */
    .then(function () { return page.reload(); })
    .then(function () { return page.waitForTimeout(600); })
    .then(function () { return page.$$eval('#gridBody tr', function (n) { return n.length; }); })
    .then(function (n) {
      console.log('\n== Penyimpanan ==');
      cek('data bertahan setelah halaman dimuat ulang', n === 60, n + ' baris');
    })

    /* ---- layar 390 px ---- */
    .then(function () { return page.setViewportSize({ width: 390, height: 780 }); })
    .then(function () { return page.waitForTimeout(500); })
    .then(function () { return page.click('#tabPrint'); })
    .then(function () { return page.waitForTimeout(500); })
    .then(function () {
      return page.evaluate(function () {
        var buruk = [];
        document.querySelectorAll('button, select, input').forEach(function (n) {
          if (n.offsetParent === null) return;
          if (n.closest('.tablewrap') || n.closest('.canvas-scroll')) return;
          var r = n.getBoundingClientRect();
          if (r.left < -1 || r.right > window.innerWidth + 1) buruk.push((n.id || n.textContent || '').trim().slice(0, 20));
        });
        return { buruk: buruk, gulir: document.documentElement.scrollWidth - window.innerWidth };
      });
    })
    .then(function (r) {
      console.log('\n== Layar 390 px ==');
      cek('semua tombol terjangkau', r.buruk.length === 0, r.buruk.join(', '));
      cek('halaman tidak menggulir ke samping', r.gulir <= 0, r.gulir + 'px');
    })

    /* ---- jaringan & error ---- */
    .then(function () {
      console.log('\n== Jaringan & error ==');
      cek('tidak ada permintaan jaringan keluar', reqs.length === 0, reqs.slice(0, 3).join(' '));
      cek('tidak ada console.error', errs.length === 0, errs.slice(0, 3).join(' | '));
    })

    .then(function () { return browser.close(); })
    .then(function () {
      console.log('\ngagal: ' + gagal.length);
      gagal.forEach(function (g) { console.log('   ' + g); });
      process.exit(gagal.length ? 1 : 0);
    });
  });
})().catch(function (e) { console.error('GAGAL menjalankan:', e); process.exit(1); });
