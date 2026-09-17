# Pemeriksaan

Folder ini **hanya untuk pengembang**. Aplikasinya sendiri tidak memakai
apa pun dari sini — `index.html` tetap bisa diklik dua kali tanpa Node,
tanpa npm, dan tanpa internet.

## Menjalankan semuanya

```sh
sh uji/jalankan.sh
```

## Menjalankan satu per satu

| Perintah | Butuh apa | Memeriksa apa |
|---|---|---|
| `node uji/periksa-impor.js` | Node saja | Jalur impor Excel: sheet yang dipilih, baris judul, tanggal seri Excel, baris ekor, pecah per dus |
| `node uji/periksa-anggaran.js` | Node saja | Anggaran tinggi tiap template: `jumlah(h) + 2×padU + (n−1)×gapU ≤ 10` |
| `node uji/periksa-browser.js` | Node + Playwright | Aplikasi sungguhan di Chromium |

Dua yang pertama jalan tanpa memasang apa pun. Yang ketiga butuh
Playwright; kalau tidak ada, ia berhenti dengan pesan, bukan error:

```sh
npm i -D playwright && npx playwright install chromium
```

## Kenapa ada tiga

Ketiganya menangkap jenis kesalahan yang berbeda, dan yang terakhir
menangkap yang paling sulit terlihat.

**`periksa-impor.js`** menjaga hal-hal yang mudah rusak diam-diam saat
daftar alias kolom diubah: `46126` harus tetap terbaca `14-04-2026`,
`SKU/Kode` harus tetap masuk ke Kode, dan 78 baris mentah harus tetap
menyusut jadi 60 baris terpakai.

**`periksa-anggaran.js`** menghitung, tanpa membuka browser, apakah
susunan bagian sebuah template masih muat. Ini murah, jadi bisa
dijalankan setiap kali angka di `templates.js` disentuh.

**`periksa-browser.js`** memeriksa hal yang tidak bisa dihitung di atas
kertas. Yang paling penting: **isi yang terpotong di dalam bagiannya
sendiri.** Setiap bagian label memakai `overflow:hidden`, jadi teks yang
kepanjangan hilang tanpa jejak — labelnya tetap terlihat rapi di layar
dan tetap lolos pemeriksaan "ada yang keluar dari kotak label". Satu-
satunya cara menemukannya adalah membandingkan `scrollHeight` dengan
`clientHeight` tiap bagian di browser sungguhan.

Pemeriksa ini pernah menemukan empat kesalahan nyata yang tidak terlihat
dari layar:

1. Nama `gap` terpakai untuk dua arti — jarak antar label di kertas dan
   jarak antar bagian di dalam label — sehingga 12 template punya jarak
   dalam 40 mm dan isinya terdorong keluar.
2. Panah pada template "rute simpan" masih memakai ukuran huruf kerangka
   aplikasi dalam px, jadi tidak ikut membesar-mengecil bersama label.
3. Tiga tanda stensil selebar tinggi barisnya tidak muat bertiga pada
   label selebar 97 mm — ikon payungnya terpotong.
4. Pita peringatan "Barang mudah pecah" lebih lebar dari labelnya.

## Ukuran dalam mm

`periksa-browser.js` mengukur label di layar. Untuk memastikan hasil
**cetaknya** juga benar, cetak ke PDF lalu ukur di PDF — atau tekan
**Cetak halaman kalibrasi printer** di aplikasi dan ukur hasil cetaknya
dengan penggaris sungguhan.
