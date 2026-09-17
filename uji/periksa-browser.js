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
   - dua template ukuran pasti benar-benar 100x25 mm dan 100x200 mm
   - impor contoh menghasilkan 60 baris dengan tanggal yang benar
   - data bertahan setelah halaman dimuat ulang
   - layar selebar 390 px: semua tombol terjangkau
   ===================================================================== */
'use strict';
var urutLokasi = '';
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
        .then(function () { return page.click('[data-tpl="dus200"]'); })
        .then(function () { return page.waitForTimeout(700); })
        .then(function () {
          return page.evaluate(function () {
            var MM = 96 / 25.4, l = document.querySelector('#stage .lbl').getBoundingClientRect();
            return { w: Math.round(l.width / MM * 100) / 100, h: Math.round(l.height / MM * 100) / 100,
                     per: +document.getElementById('cntPer').textContent };
          });
        })
        .then(function (r) {
          cek('Banner dus tepat 100 x 200 mm', r.w === 100 && r.h === 200, r.w + ' x ' + r.h + ' mm');
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

    /* ---- dua basis data + katalog produk ---- */
    .then(function () {
      console.log('\n== Basis data & katalog ==');
      return page.evaluate(function () {
        var k = (window.LG && window.LG.katalog) || {};
        return { cv: k.cv ? k.cv.produk.length : 0, ol: k.ol ? k.ol.produk.length : 0,
                 tombol: document.querySelectorAll('#dbBtns .dbbtn').length };
      })
      .then(function (r) {
        cek('katalog CV termuat', r.cv > 0, r.cv + ' produk');
        cek('katalog OL termuat', r.ol > 0, r.ol + ' produk');
        cek('ada dua tombol basis data', r.tombol === 2, r.tombol + ' tombol');
      })
      /* pemeriksaan sebelumnya berhenti di tab cetak; katalog ada di tab data */
      .then(function () { return page.click('#tabData'); })
      .then(function () { return page.waitForTimeout(400); })
      /* CV sekarang berisi 60 baris hasil impor; pindah ke OL harus kosong */
      .then(function () { return page.click('[data-db="ol"]'); })
      .then(function () { return page.waitForTimeout(800); })
      .then(function () { return page.$$eval('#gridBody tr', function (n) { return n.length; }); })
      .then(function (n) { cek('pindah ke OL: datanya terpisah', n === 0, n + ' baris'); })
      /* tambah produk dari katalog OL */
      .then(function () { return page.click('#btnKatalog'); })
      .then(function () { return page.waitForTimeout(500); })
      .then(function () { return page.fill('#katCari', 'ACCOL'); })
      .then(function () { return page.waitForTimeout(400); })
      .then(function () { return page.click('#katAll'); })
      .then(function () { return page.waitForTimeout(300); })
      .then(function () { return page.click('#katOk'); })
      .then(function () { return page.waitForTimeout(800); })
      .then(function () { return page.$$eval('#gridBody tr', function (n) { return n.length; }); })
      .then(function (n) { cek('produk katalog masuk jadi baris label', n > 0, n + ' baris'); })
      /* isi otomatis dari barcode */
      .then(function () { return page.click('#btnAdd'); })
      .then(function () { return page.waitForTimeout(400); })
      .then(function () { return page.fill('#gridBody tr:last-child input[data-k="kode"]', 'ADPCHR005'); })
      .then(function () { return page.press('#gridBody tr:last-child input[data-k="kode"]', 'Tab'); })
      .then(function () { return page.waitForTimeout(600); })
      .then(function () {
        return page.evaluate(function () {
          var tr = document.querySelector('#gridBody tr:last-child');
          return tr.querySelector('input[data-k="varian"]').value;
        });
      })
      .then(function (v) { cek('ketik barcode mengisi nama produk', v.indexOf('Adapter Charger') === 0, v.slice(0, 32)); })
      /* kembali ke CV, datanya harus utuh */
      .then(function () { return page.click('[data-db="cv"]'); })
      .then(function () { return page.waitForTimeout(800); })
      .then(function () { return page.$$eval('#gridBody tr', function (n) { return n.length; }); })
      .then(function (n) { cek('kembali ke CV: 60 baris tetap utuh', n === 60, n + ' baris'); });
    })

    /* ---- rekomendasi produk saat mengetik ---- */
    .then(function () {
      console.log('\n== Rekomendasi saat mengetik ==');
      return page.click('#btnAdd')
        .then(function () { return page.waitForTimeout(400); })
        .then(function () { return page.click('#gridBody tr:last-child input[data-k="kode"]'); })
        /* "ugreen" ada di katalog CV; ADPCHR cuma ada di OL, dan
           pemeriksaan ini berjalan saat basis data CV yang aktif */
        .then(function () { return page.type('#gridBody tr:last-child input[data-k="kode"]', 'ugreen', { delay: 40 }); })
        .then(function () { return page.waitForTimeout(500); })
        .then(function () {
          return page.evaluate(function () {
            return { tampil: !document.getElementById('tip').hidden,
                     n: document.querySelectorAll('#tip .tip-row').length,
                     tebal: document.querySelectorAll('#tip mark').length };
          });
        })
        .then(function (r) {
          cek('daftar rekomendasi muncul sambil mengetik', r.tampil && r.n > 0, r.n + ' hasil');
          cek('bagian yang cocok ditebalkan', r.tebal > 0, r.tebal + ' penanda');
        })
        /* panah + Enter memilih */
        .then(function () { return page.keyboard.press('ArrowDown'); })
        .then(function () { return page.waitForTimeout(150); })
        .then(function () { return page.keyboard.press('Enter'); })
        .then(function () { return page.waitForTimeout(600); })
        .then(function () {
          return page.evaluate(function () {
            var tr = document.querySelector('#gridBody tr:last-child');
            return { kode: tr.querySelector('input[data-k="kode"]').value,
                     varian: tr.querySelector('input[data-k="varian"]').value,
                     qty: tr.querySelector('input[data-k="qty"]').value,
                     tertutup: document.getElementById('tip').hidden };
          });
        })
        .then(function (r) {
          cek('Enter mengambil produk yang disorot', !!r.kode, r.kode);
          cek('nama dan qty ikut terisi', /ugreen/i.test(r.varian) && !!r.qty,
              r.varian.slice(0, 30) + ' / ' + r.qty);
          cek('daftar tertutup setelah dipilih', r.tertutup);
        })
        /* pencarian per kata, bukan potongan utuh */
        .then(function () { return page.click('#btnAdd'); })
        .then(function () { return page.waitForTimeout(400); })
        .then(function () { return page.click('#gridBody tr:last-child input[data-k="varian"]'); })
        .then(function () { return page.type('#gridBody tr:last-child input[data-k="varian"]', 'ugreen hub', { delay: 30 }); })
        .then(function () { return page.waitForTimeout(500); })
        .then(function () { return page.$$eval('#tip .tip-row', function (n) { return n.length; }); })
        .then(function (n) {
          cek('dua kata yang tidak berdampingan tetap ketemu', n > 0, n + ' hasil untuk "ugreen hub"');
        })
        .then(function () { return page.keyboard.press('Escape'); })
        .then(function () { return page.waitForTimeout(200); })
        .then(function () { return page.evaluate(function () { return document.getElementById('tip').hidden; }); })
        .then(function (h) { cek('Escape menutup daftar', h === true); })
        /* satu huruf sudah cukup, dan kata kunci umum dapat "lihat semua" */
        .then(function () { return page.click('#inSearch'); })
        .then(function () { return page.fill('#inSearch', ''); })
        .then(function () { return page.type('#inSearch', 'a', { delay: 60 }); })
        .then(function () { return page.waitForTimeout(500); })
        .then(function () {
          return page.evaluate(function () {
            return { produk: document.querySelectorAll('#tip .tip-row:not(.tip-lagi)').length,
                     lagi: !!document.querySelector('#tip .tip-lagi'),
                     teks: (document.querySelector('#tip .tip-lagi .nm') || {}).textContent || '' };
          });
        })
        .then(function (r) {
          cek('satu huruf "a" sudah memunculkan hasil', r.produk > 0, r.produk + ' produk');
          cek('kata kunci umum dapat baris "lihat semua"', r.lagi, r.teks.slice(0, 44));
        })
        /* panah sampai baris terakhir lalu Enter -> katalog terbuka */
        .then(function () {
          return page.$$eval('#tip .tip-row', function (n) { return n.length; });
        })
        .then(function (n) {
          var rantai = Promise.resolve();
          for (var i = 0; i < n; i++) {
            rantai = rantai.then(function () { return page.keyboard.press('ArrowDown'); });
          }
          return rantai;
        })
        .then(function () { return page.waitForTimeout(250); })
        .then(function () {
          return page.evaluate(function () {
            var s = document.querySelector('#tip .tip-row.is-on');
            /* menyorot tidak boleh menghapus kelas lain yang menempel */
            return s ? s.className.indexOf('tip-lagi') >= 0 : false;
          });
        })
        .then(function (ok) { cek('panah sampai baris "lihat semua", kelasnya tetap utuh', ok); })
        .then(function () { return page.keyboard.press('Enter'); })
        .then(function () { return page.waitForTimeout(600); })
        .then(function () {
          return page.evaluate(function () {
            return { buka: !document.getElementById('mKat').hidden,
                     q: document.getElementById('katCari').value };
          });
        })
        .then(function (r) {
          cek('Enter membuka katalog dengan kata kuncinya', r.buka && r.q === 'a', 'katCari="' + r.q + '"');
        })
        .then(function () { return page.click('#mKat [data-close]'); })
        .then(function () { return page.waitForTimeout(300); })
        .then(function () { return page.fill('#inSearch', ''); })
        .then(function () { return page.waitForTimeout(300); })
        /* kolom Kadaluarsa sudah dicabut */
        .then(function () {
          return page.$$eval('#gridHead th', function (n) {
            return n.map(function (x) { return x.textContent.trim(); });
          });
        })
        .then(function (kol) {
          cek('kolom Kadaluarsa sudah tidak ada',
              !kol.some(function (x) { return /kadaluarsa/i.test(x); }), kol.length + ' kolom');
        })
        /* bersihkan baris uji sampai benar-benar kembali 60 */
        .then(function () {
          return page.evaluate(function () {
            var batas = 0;
            while (document.querySelectorAll('#gridBody tr').length > 60 && batas++ < 20) {
              var t = document.querySelectorAll('#gridBody tr');
              var b = t[t.length - 1].querySelector('.rowact.del');
              if (!b) break;
              b.click();
            }
            return document.querySelectorAll('#gridBody tr').length;
          });
        })
        .then(function () { return page.waitForTimeout(500); })
        .then(function () { return page.$$eval('#gridBody tr', function (n) { return n.length; }); })
        .then(function (n) { cek('baris uji dibersihkan, kembali 60', n === 60, n + ' baris'); });
    })

    /* ---- tidak ada lagi pop-up bawaan browser ---- */
    .then(function () {
      console.log('\n== Dialog konfirmasi ==');
      var munculPopup = false;
      page.on('dialog', function (d) { munculPopup = true; d.dismiss(); });
      return page.evaluate(function () {
        /* centang satu baris lalu tekan Hapus */
        var cb = document.querySelector('#gridBody tr input[data-act="on"]');
        if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      })
      .then(function () { return page.click('#btnDelSel'); })
      .then(function () { return page.waitForTimeout(500); })
      .then(function () {
        return page.evaluate(function () {
          var m = document.getElementById('mAsk');
          return { tampil: m && !m.hidden, judul: document.getElementById('askJudul').textContent };
        });
      })
      .then(function (r) {
        cek('dialog konfirmasi sendiri yang muncul', r.tampil, r.judul);
        cek('bukan window.confirm bawaan browser', !munculPopup);
      })
      .then(function () { return page.click('#mAsk [data-close]'); })
      .then(function () { return page.waitForTimeout(300); });
    })

    /* ---- rentang lembar untuk cetak ulang ---- */
    .then(function () { return page.click('#tabPrint'); })
    .then(function () { return page.waitForTimeout(600); })
    .then(function () {
      console.log('\n== Rentang lembar ==');
      return page.evaluate(function () {
        document.getElementById('inPageFrom').value = '7';
        document.getElementById('inPageFrom').dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('inPageTo').value = '9';
        document.getElementById('inPageTo').dispatchEvent(new Event('change', { bubbles: true }));
      })
      .then(function () { return page.waitForTimeout(700); })
      .then(function () {
        return page.evaluate(function () {
          var s = document.querySelectorAll('#stage .sheet');
          return { digambar: s.length,
                   pertama: s.length ? s[0].getAttribute('data-page') : '',
                   penghitung: document.getElementById('cntPage').textContent };
        });
      })
      .then(function (r) {
        cek('rentang 7-9 menggambar 3 lembar', r.digambar === 3, r.digambar + ' lembar');
        cek('lembar pertama adalah lembar 7', /Lembar 7 /.test(r.pertama), r.pertama);
        cek('penghitung menunjukkan sebagian', r.penghitung.indexOf('/') > 0, r.penghitung);
      })
      .then(function () {
        return page.evaluate(function () {
          window.__snap2 = null;
          window.print = function () {
            var s = document.querySelectorAll('#paper .sheet');
            window.__snap2 = { lembar: s.length, pertama: s.length ? s[0].getAttribute('data-page') : '' };
          };
        });
      })
      .then(function () { return page.click('#btnPrint'); })
      .then(function () { return page.waitForTimeout(400); })
      .then(function () { return page.click('#sumOk'); })
      .then(function () { return page.waitForTimeout(900); })
      .then(function () { return page.evaluate(function () { return window.__snap2; }); })
      .then(function (s) {
        cek('yang dikirim ke printer hanya 3 lembar', s && s.lembar === 3, s ? s.lembar + ' lembar' : '-');
        cek('dimulai dari lembar 7', s && /Lembar 7 /.test(s.pertama), s ? s.pertama : '-');
      })
      /* kembalikan ke semua */
      .then(function () {
        return page.evaluate(function () {
          ['inPageFrom', 'inPageTo'].forEach(function (id) {
            var n = document.getElementById(id);
            n.value = ''; n.dispatchEvent(new Event('change', { bubbles: true }));
          });
        });
      })
      .then(function () { return page.waitForTimeout(600); })
      .then(function () { return page.evaluate(function () { return document.getElementById('cntPage').textContent; }); })
      .then(function (t) { cek('dikosongkan kembali ke 30 lembar', t === '30', t); });
    })

    /* ---- pola QR mengikuti keluarga ---- */
    .then(function () {
      console.log('\n== Pola QR per keluarga ==');
      return page.click('[data-fam="rak"]')
        .then(function () { return page.waitForTimeout(400); })
        .then(function () { return page.inputValue('#inQRPattern'); })
        .then(function (v) { cek('label rak memakai QR payload', v === '{qrPayload}', v); })
        .then(function () { return page.click('[data-fam="dus"]'); })
        .then(function () { return page.waitForTimeout(400); })
        .then(function () { return page.inputValue('#inQRPattern'); })
        .then(function (v) { cek('label dus memakai QR barang', v.indexOf('{sku}') === 0, v); });
    })

    /* ---- label rak gudang ACC ---- */
    .then(function () {
      console.log('\n== Label rak: lokasi final, nama barang, barcode ==');
      return page.click('[data-fam="rak"]')
        .then(function () { return page.waitForTimeout(300); })
        .then(function () { return page.click('[data-tpl="rak100"]'); })
        .then(function () { return page.waitForTimeout(800); })
        .then(function () {
          return page.evaluate(function () {
            var D = window.LG.data, T = window.LG.tpl;
            var baris = D.sampleRows();
            var acc = null, kosong = null, i;
            for (i = 0; i < baris.length; i++) {
              if (baris[i].barcode === '194644167882') acc = baris[i];
              if (!String(baris[i].lokasi || '').trim() && !kosong) kosong = baris[i];
            }
            /* baris dengan prefix tersalin ke kolom lokasi final */
            var palsu = D.blank();
            palsu.prefix = 'A-CHR'; palsu.lokasi = 'A-CHR';

            /* Label dirender langsung dari templatenya, jadi pemeriksaan
               ini tidak bergantung pada data apa yang sedang dimuat. */
            var tpl = T.byKey('rak100');
            var o = { cw: 100, ch: 25, k: 1, qr: true, barcode: false, meta: false,
                      qrPattern: '{qrPayload}' };
            var kotak = document.createElement('div');
            kotak.innerHTML = tpl.render(acc, o) + tpl.render(kosong, o);
            var teks = [kotak.textContent];

            /* status mapping: baris review tetap dirender, hanya ditandai */
            var revT = D.blank(), revB = D.blank();
            revT.lokasi = 'B-CCH-R01-B01-P06'; revT.sku = 'Baseus Car Chr A+A 30W';
            revT.tipe = 'Car Chr A+A 30W Dual QC3.0'; revT.barcode = '6953156286511';
            revT.statusMap = 'REVIEW TIPE';
            revB.lokasi = 'A-CHR-R01-B03-P03'; revB.sku = 'chr inf';
            revB.statusMap = 'REVIEW BARCODE';
            var kotak2 = document.createElement('div');
            kotak2.innerHTML = tpl.render(revT, o) + tpl.render(revB, o);

            return {
              qr: T.qrText(acc, '{barcode}|{lokasi}'),
              lokasiFinal: D.lokasiFinal(acc),
              prefixBukanLokasi: D.lokasiFinal(palsu),
              kosongBelum: D.belumLokasiFinal(kosong),
              adaLokasiBesar: /A-CHR-R01-B01-P04/.test(teks.join(' ')),
              adaNama: /Anker Adp Fc 20W/.test(teks.join(' ')),
              adaBarcode: /194644167882/.test(teks.join(' ')),
              adaPeringatan: /Lokasi belum diset/i.test(teks.join(' ')),
              adaTipe: /A2348/.test(teks.join(' ')),
              qrPakaiPayload: T.qrText(acc, '{qrPayload}'),
              revTampil: /B-CCH-R01-B01-P06/.test(kotak2.textContent) &&
                         /A-CHR-R01-B03-P03/.test(kotak2.textContent),
              revTandaTipe: /Cek tipe/i.test(kotak2.textContent),
              revTandaBarcode: /QR belum final/i.test(kotak2.textContent)
            };
          });
        })
        .then(function (r) {
          cek('QR rak berisi barcode|lokasi final',
              r.qr === '194644167882|A-CHR-R01-B01-P04', r.qr);
          cek('lokasi final terbaca utuh', r.lokasiFinal === 'A-CHR-R01-B01-P04', r.lokasiFinal);
          cek('prefix A-CHR tidak dianggap lokasi final', r.prefixBukanLokasi === '',
              JSON.stringify(r.prefixBukanLokasi));
          cek('baris tanpa lokasi ditandai belum final', r.kosongBelum === true);
          cek('lokasi final jadi teks utama label', r.adaLokasiBesar === true);
          cek('nama barang tampil di label', r.adaNama === true);
          cek('barcode tampil di label', r.adaBarcode === true);
          cek('label tanpa lokasi final diberi peringatan', r.adaPeringatan === true);
          cek('tipe/model tampil di label', r.adaTipe === true);
          cek('QR memakai QR Payload dari file mapping',
              r.qrPakaiPayload === '194644167882|A-CHR-R01-B01-P04', r.qrPakaiPayload);
          cek('baris REVIEW tetap tercetak, tidak dibuang', r.revTampil === true);
          cek('REVIEW TIPE diberi tanda ringan', r.revTandaTipe === true);
          cek('REVIEW BARCODE diberi tanda QR belum final', r.revTandaBarcode === true);
        });
    })

    /* ---- urungkan ---- */
    .then(function () { return page.click('#tabData'); })
    .then(function () { return page.waitForTimeout(400); })
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
          /* Tampilan yang tidak aktif sengaja digeser keluar layar untuk
             animasi. Isinya tidak terlihat dan tidak bisa diklik, jadi
             bukan "tombol yang tak terjangkau". */
          var v = n.closest('.view');
          if (v && v.className.indexOf('is-on') < 0) return;
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

    /* ---- alur: data mentah -> generate lokasi -> cetak ---- */
    .then(function () {
      console.log('\n== Alur generate lokasi lalu cetak ==');
      /* bagian sebelumnya mengecilkan jendela ke 390 px; pratinjau
         diperkecil transform CSS supaya muat, jadi jendelanya
         dikembalikan dulu sebelum label diukur */
      return page.setViewportSize({ width: 1440, height: 950 })
        .then(function () { return page.evaluate(function () {
        var D = window.LG.data, baris = [], pre = ['A-CHR', 'B-CCH', 'C-CBL', 'D-PWB'], i, r;
        for (i = 0; i < 50; i++) {
          r = D.blank();
          r.labelId = 'LBL-' + (i + 1); r._on = true;
          r.barcode = '1946441678' + (10 + i);
          r.sku = 'Anker Adp Fc 20W 2Port Usb/C A' + (2300 + i) + ' White';
          r.brand = 'Anker'; r.tipe = 'A' + (2300 + Math.floor(i / 4));
          r.prefix = pre[i % 4]; r.golongan = 'Charger';
          baris.push(r);
        }
        D.save({ rows: baris, opts: {} }, 'cv');
      }); })
        .then(function () { return page.reload(); })
        .then(function () { return page.waitForTimeout(800); })
        .then(function () { return page.click('#btnGenLok'); })
        .then(function () { return page.waitForTimeout(700); })
        .then(function () {
          return page.evaluate(function () {
            var D = window.LG.data, R = D.load('cv').rows;
            var aCHR = R.filter(function (r) { return r.prefix === 'A-CHR'; })
                        .map(function (r) { return r.lokasi; }).sort();
            return {
              semuaPunyaLokasi: R.every(function (r) { return D.isLokasiFinal(r.lokasi); }),
              awal: aCHR[0], keSebelas: aCHR[10],
              bPrefix: R.filter(function (r) { return r.prefix === 'B-CCH'; })
                        .map(function (r) { return r.lokasi; }).sort()[0],
              bagian: [R[0].rak, R[0].baris, R[0].posisi].join(' '),
              kembar: D.lokasiKembar(R).length,
              qr: D.qrPayload(R[0]),
              urut: R.map(function (r) { return r.lokasi; }).join(',')
            };
          });
        })
        .then(function (r) {
          cek('semua baris dapat Lokasi final', r.semuaPunyaLokasi === true);
          cek('mulai dari R01-B01-P01', r.awal === 'A-CHR-R01-B01-P01', r.awal);
          cek('yang ke-11 lanjut ke B02-P01', r.keSebelas === 'A-CHR-R01-B02-P01', r.keSebelas);
          cek('prefix lain mulai dari nol lagi', r.bPrefix === 'B-CCH-R01-B01-P01', r.bPrefix);
          cek('Rak/Baris/Posisi ikut terisi di tabel', r.bagian === 'R01 B01 P01', r.bagian);
          cek('tidak ada lokasi kembar', r.kembar === 0, r.kembar + ' kembar');
          cek('QR jadi barcode|lokasi final',
              r.qr === '194644167810|A-CHR-R01-B01-P01', r.qr);
          urutLokasi = r.urut;
        })
        /* generate kedua kali: tidak ada yang bergeser */
        .then(function () { return page.click('#btnGenLok'); })
        .then(function () { return page.waitForTimeout(600); })
        .then(function () {
          return page.evaluate(function () {
            return window.LG.data.load('cv').rows.map(function (r) { return r.lokasi; }).join(',');
          });
        })
        .then(function (v) { cek('generate ulang tidak menggeser lokasi', v === urutLokasi); })
        /* lokasi bertahan setelah halaman dimuat ulang */
        .then(function () { return page.reload(); })
        .then(function () { return page.waitForTimeout(800); })
        .then(function () {
          return page.evaluate(function () {
            return window.LG.data.load('cv').rows.map(function (r) { return r.lokasi; }).join(',');
          });
        })
        .then(function (v) { cek('lokasi bertahan setelah dimuat ulang', v === urutLokasi); })
        /* cetak langsung dari Data label */
        .then(function () { return page.click('#btnPrintRak'); })
        .then(function () { return page.waitForTimeout(1300); })
        .then(function () {
          return page.evaluate(function () {
            var MM = 96 / 25.4, l = document.querySelector('#stage .lbl');
            var g = l ? l.getBoundingClientRect() : null;
            return {
              w: g ? Math.round(g.width / MM * 100) / 100 : 0,
              h: g ? Math.round(g.height / MM * 100) / 100 : 0,
              per: +document.getElementById('cntPer').textContent,
              pola: document.getElementById('inQRPattern').value,
              ringkasan: !document.getElementById('mSum').hidden,
              teks: l ? l.textContent : ''
            };
          });
        })
        .then(function (r) {
          cek('cetak dari Data label memakai template rak 100 x 25 mm',
              r.w === 100 && r.h === 25, r.w + ' x ' + r.h + ' mm');
          cek('tetap 20 label per lembar A4', r.per === 20, r.per + '/lembar');
          cek('QR label memakai QR Payload', r.pola === '{qrPayload}', r.pola);
          cek('ringkasan sebelum cetak terbuka', r.ringkasan === true);
          cek('label memakai lokasi tersimpan, bukan prefix',
              /A-CHR-R01-B01-P01/.test(r.teks) && !/^A-CHR$/.test(r.teks.trim()), r.teks.slice(0, 40));
        })
        .then(function () {
          return page.evaluate(function () { document.body.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
        })
        .then(function () { return page.waitForTimeout(300); });
    })


    /* ---- gerak antarmuka ---- */
    .then(function () {
      console.log('\n== Gerak antarmuka ==');
      return page.click('#tabPrint')
        .then(function () { return page.waitForTimeout(700); })
        .then(function () { return page.click('[data-fam="rak"]'); })
        .then(function () { return page.waitForTimeout(500); })
        .then(function () {
          return page.evaluate(function () {
            var n = document.getElementById('famInd');
            return { x: n.style.getPropertyValue('--x'), w: n.style.getPropertyValue('--w') };
          });
        })
        .then(function (a) {
          return page.click('[data-fam="dus"]')
            .then(function () { return page.waitForTimeout(500); })
            .then(function () {
              return page.evaluate(function () {
                var n = document.getElementById('famInd');
                return { x: n.style.getPropertyValue('--x'), w: n.style.getPropertyValue('--w') };
              });
            })
            .then(function (b) {
              cek('penanda keluarga template ikut meluncur',
                  a.x !== b.x && parseFloat(b.w) > 0, a.x + ' -> ' + b.x);
            });
        })
        /* modal: menutup pun dianimasikan, lalu benar-benar bersih */
        .then(function () { return page.click('#btnHelp'); })
        .then(function () { return page.waitForTimeout(400); })
        .then(function () { return page.keyboard.press('Escape'); })
        .then(function () { return page.waitForTimeout(80); })
        .then(function () {
          return page.evaluate(function () { return document.getElementById('mHelp').className; });
        })
        .then(function (c) { cek('modal memutar animasi saat ditutup', /menutup/.test(c), c); })
        .then(function () { return page.waitForTimeout(400); })
        .then(function () {
          return page.evaluate(function () {
            var m = document.getElementById('mHelp');
            return m.hidden && !/menutup/.test(m.className) && document.getElementById('backdrop').hidden;
          });
        })
        .then(function (ok) { cek('setelah animasi, modal dan latarnya bersih', ok === true); })
        /* membuka modal lain di tengah animasi tutup tidak boleh ikut hilang */
        .then(function () { return page.click('#btnHelp'); })
        .then(function () { return page.waitForTimeout(250); })
        .then(function () { return page.keyboard.press('Escape'); })
        .then(function () { return page.click('#tabData'); })
        .then(function () { return page.click('#btnKatalog'); })
        .then(function () { return page.waitForTimeout(500); })
        .then(function () {
          return page.evaluate(function () {
            return !document.getElementById('mKat').hidden && !document.getElementById('backdrop').hidden;
          });
        })
        .then(function (ok) { cek('modal berikutnya tidak ikut tertutup', ok === true); })
        .then(function () { return page.keyboard.press('Escape'); })
        .then(function () { return page.waitForTimeout(400); })
        /* menu turun memakai visibility supaya bisa dianimasikan */
        .then(function () { return page.click('#btnExport'); })
        .then(function () { return page.waitForTimeout(350); })
        .then(function () {
          return page.evaluate(function () {
            return getComputedStyle(document.querySelector('#menuExport .menu-pop')).visibility;
          });
        })
        .then(function (v) { cek('menu turun terbuka', v === 'visible', v); })
        .then(function () { return page.click('#statLeft'); })
        .then(function () { return page.waitForTimeout(400); })
        .then(function () {
          return page.evaluate(function () {
            var c = getComputedStyle(document.querySelector('#menuExport .menu-pop'));
            return c.visibility + '/' + c.opacity;
          });
        })
        .then(function (v) { cek('menu turun tertutup rapi', v === 'hidden/0', v); });
    })

    /* ---- data contoh ---- */
    .then(function () {
      console.log('\n== Data contoh ==');
      return page.evaluate(function () {
        var D = window.LG.data, R = D.sampleRows();
        var pre = {}, i;
        for (i = 0; i < R.length; i++) if (R[i].prefix) pre[R[i].prefix] = 1;
        return {
          jumlah: R.length,
          tanpaLokasi: R.filter(function (r) { return D.belumLokasiFinal(r); }).length,
          prefix: Object.keys(pre).length,
          lengkap: R.filter(function (r) {
            return r.barcode && r.sku && r.brand && r.tipe && r.golongan && r.prefix &&
                   r.supplier && r.grn && r.pic && r.tanggal;
          }).length,
          adaReviewTipe: R.some(function (r) { return D.statusMapping(r) === 'tipe'; }),
          adaReviewBarcode: R.some(function (r) { return D.statusMapping(r) === 'barcode'; }),
          adaDus: R.filter(function (r) { return r.kodeDus; }).length,
          qrIsi: R.filter(function (r) { return r.qrPayload; }).length
        };
      });
    })
    .then(function (r) {
      cek('data contoh berisi 30 baris', r.jumlah === 30, r.jumlah + ' baris');
      cek('semua kolom penting terisi', r.lengkap >= 27, r.lengkap + '/30 lengkap');
      cek('ada beberapa prefix berbeda', r.prefix >= 5, r.prefix + ' prefix');
      cek('ada baris tanpa lokasi final untuk mencoba generator',
          r.tanpaLokasi === 3, r.tanpaLokasi + ' baris');
      cek('ada contoh REVIEW TIPE dan REVIEW BARCODE',
          r.adaReviewTipe && r.adaReviewBarcode);
      cek('ada baris bergaya dus untuk template Label dus', r.adaDus >= 8, r.adaDus + ' baris');
      cek('QR Payload sudah terisi untuk yang punya lokasi', r.qrIsi >= 24, r.qrIsi + ' baris');
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
