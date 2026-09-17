# Label Dus & Rak

Aplikasi untuk membuat dan mencetak **label gudang** — label dus dan label
rak — langsung dari laptop atau HP. Menggantikan file Excel `PRINT_LABEL`
yang ukurannya tidak pasti saat dicetak dan rumusnya rusak setiap kali
ditambah kolom.

Satu aturan yang dipegang: **satu baris data = satu label.** Data
dimasukkan sekali, lalu bisa dicetak dalam sembilan bentuk label.

---

## Cara memakai (untuk staf gudang)

### 1. Membuka aplikasi

**Klik dua kali `index.html`.** Selesai.

Tidak perlu internet, tidak perlu memasang apa pun, dan bisa dijalankan
dari flashdisk. Kalau folder ini disalin ke komputer lain, salin
**seluruh folder**, jangan hanya `index.html` saja.

### 2. Memasukkan data

Ada empat cara, semuanya di tab **Data label**:

| Cara | Kapan dipakai |
|---|---|
| **Impor Excel / CSV** | Sudah punya file `.xlsx` atau `.csv` dari bagian penerimaan |
| **Tempel dari Excel** | Cukup beberapa baris: blok di Excel → Ctrl+C → tempel di kotak |
| **Seret file** | Tarik file Excel/CSV ke mana saja di jendela aplikasi |
| **+ Baris** | Ketik sendiri satu per satu |

Setelah memilih file, muncul kotak **Cocokkan kolom**. Aplikasi sudah
menebak sendiri kolom mana masuk ke mana — periksa sebentar, betulkan
kalau ada yang salah, lalu tekan **Masukkan data**.

Yang ditangani otomatis:

- Sheet dipilih sendiri (yang namanya mengandung "DATA"; sheet
  `PRINT`, `SETUP`, `CETAK`, `README` dilewati).
- Baris judul hiasan di atas header dilewati sendiri.
- Tanggal Excel berupa angka (`46126`) dibaca jadi `14-04-2026`.
  Format `14/04/2026` dan `14-04-2026` juga diterima.
- Kolom `No` dan `Text Dus (x/total)` dilewati.
- Baris ekor yang hanya berisi zona/status/PIC dibuang.

Coba dulu dengan `contoh/Format_Label_Dus.xlsx` — hasilnya 60 baris.

### 3. Merapikan data

- **Centang** baris yang mau dicetak. Yang tidak dicentang tampil redup
  dan tidak ikut tercetak.
- **Pecah per dus** — satu baris dengan Total Dus 4 menjadi 4 baris,
  nomor dusnya diisi 1 sampai 4.
- **Nomori ulang** — isi ulang seluruh Label ID jadi berurutan dari
  `LBL-001`.
- **Cari** dan saringan **zona** / **status** untuk mencari baris tertentu.
- Klik langsung di sel mana pun untuk mengubah isinya.
- **Urungkan** membatalkan tindakan terakhir yang mengubah susunan baris
  — hapus, pecah per dus, nomori ulang, impor, sampai 25 langkah ke
  belakang. Pintasannya **Ctrl+Z** (di luar kotak isian; di dalam kotak,
  Ctrl+Z tetap milik browser untuk membatalkan ketikan).

Mengisi banyak baris dengan papan ketik:

| Tombol | Hasil |
|---|---|
| **Tab** / **Shift+Tab** | Pindah sel ke kanan / kiri |
| **↓** / **↑** | Pindah baris, tetap di kolom yang sama |
| **Enter** | Turun satu baris |
| **Enter** di baris terakhir | Tambah baris baru, langsung siap diketik |
| **Shift+Enter** | Naik satu baris |
| **Esc** | Keluar dari sel |

Data tersimpan sendiri di browser komputer ini. Tutup browser, buka lagi
besok — data masih ada. **Buat cadangan `.json` secara berkala** lewat
menu *Ekspor & cadangan*; data yang hanya ada di browser bisa hilang
kalau riwayat browser dibersihkan.

### 4. Mencetak

Pindah ke tab **Template & cetak**:

1. Pilih template di panel kiri.
2. Periksa penghitung di atas pratinjau: berapa label, berapa lembar.
3. Tekan **Cetak sekarang** → muncul ringkasan → **Buka dialog cetak**.

Ringkasan itu juga **memeriksa datanya dulu** dan memberi tahu kalau ada
Label ID kembar, baris tanpa kode barang, atau Dus ke yang lebih besar
dari Total dus — lebih murah daripada baru sadar setelah 60 label
tercetak. Baris tanpa lokasi hanya disebut sebagai catatan, karena
kolomnya sengaja dikosongkan untuk ditulis tangan.

**Di dialog printer, tiga hal ini wajib:**

- Margin: **None** / **Tidak ada**
- Skala: **100%** — bukan "Fit to page" atau "Shrink to fit"
- **Background graphics** / **Grafik latar**: dicentang

Kalau salah satu meleset, ukuran label ikut meleset.

### 5. Kalau ukuran hasil cetak terasa salah

Tekan **Cetak halaman kalibrasi printer** di panel kiri bawah. Halaman
itu berisi kotak 100 × 100 mm dan penggaris 150 mm. Ukur hasil cetaknya
dengan penggaris sungguhan:

- Kotak lebih kecil dari 10 cm → skala printer belum 100%.
- Tepi terpotong → margin printer belum *None*.
- Masih meleset → ukuran kertas di printer belum sama dengan pilihan di aplikasi.

---

## Template label

Ada **dua keluarga**, dan tab di atas pemilih template memisahkan keduanya.
Yang dipilih tersimpan, jadi besok aplikasi terbuka di keluarga yang sama.

### Label rak — 14 template

Ditempel di bibir rak, tiang, atau lorong. Isi utamanya **kode lokasi**,
dibuat sebesar mungkin karena dibaca sambil berjalan.

| Template | Ukuran | Per lembar | Dipakai untuk |
|---|---|---|---|
| **Strip 100 × 25** | 100 × 25 mm | 20 | Strip rak baku. Terbaca dari 3 meter |
| Strip 100 × 38 | 100 × 38 mm | 14 | Strip yang juga memuat SKU dan qty |
| Kartu bin 100 × 50 | 100 × 50 mm | 10 | Rak picking yang sering di-scan |
| Strip 75 × 25 | 75 × 25 mm | 20 | Rak sempit |
| Bin mini 50 × 25 | 50 × 25 mm | 40 | Laci dan kotak kecil |
| Strip lorong 150 × 30 | 150 × 30 mm | 9 | Balok rak, terbaca dari ujung gang |
| Papan lorong | 1 per A4 mendatar | 1 | Papan gantung penanda lorong |
| Label tiang | 25 × 100 mm tegak | 14 | Tiang rak, dibaca dari samping |
| Rak FIFO | 100 × 38 mm | 14 | Tanggal masuk besar, stok lama diambil duluan |
| Rak QR | 2 × 6 per A4 | 12 | Gudang yang serba scan |
| Rak barcode | 2 × 8 per A4 | 16 | Pemindai laras |
| Rak blok warna | 2 × 6 per A4 | 12 | Membagi gudang jadi area berwarna |
| Papan bin | 1 × 4 per A4 | 4 | Papan selebar kertas untuk satu bin |
| Rak proporsional | 2 × 6 per A4 | 12 | Kertas tidak baku — ukuran ikut kertas |

### Label dus — 14 template

Ditempel di sisi dus. Isi utamanya **kode barang**, ditambah qty, nomor
dus, dan kolom lokasi untuk ditulis tangan.

| Template | Ukuran | Per lembar | Dipakai untuk |
|---|---|---|---|
| **Banner 100 × 250** | 100 × 250 mm | 2 | Banner baku untuk sisi depan dus |
| Banner 100 × 140 | 100 × 140 mm | 4 | Dus yang sisinya tidak setinggi 25 cm |
| Dus A5 penuh | 1 per lembar A5 | 1 | Dus besar atau palet |
| Dus standar | 2 × 4 per A4 | 8 | Pengganti sheet `PRINT_LABEL_8UP` |
| Dus ringkas | 3 × 4 per A4 | 12 | Dus bertumpuk |
| Dus besar | 2 × 2 per A4 | 4 | Label besar dengan barcode |
| Dus mini | 4 × 6 per A4 | 24 | Barang satuan atau dus isi sedikit |
| Thermal 100 × 50 | 100 × 50 mm | 1 | Printer thermal |
| Thermal 100 × 100 | 100 × 100 mm | 1 | Thermal persegi, muat QR + barcode |
| Kartu gantung | 2 × 2 per A4 | 4 | Kartu status berlubang |
| Dus barang pecah | 2 × 2 per A4 | 4 | Tanda stensil: jangan dibanting, jauhkan dari air |
| Dus FIFO | 2 × 3 per A4 | 6 | Stok yang keluar menurut urutan datang |
| Dus periksa QC | 2 × 3 per A4 | 6 | Ada kotak centang, dicentang langsung di dus |
| Dus rute simpan | 2 × 2 per A4 | 4 | Dari supplier menuju lokasi rak |

Yang dicetak **tebal** adalah dua template dengan ukuran fisik pasti —
ukurannya dikunci dan tidak bisa diubah. Template lain yang ukurannya
disebut dalam mm juga terkunci; yang ditulis "n × n per A4" ikut kertas.

Ukuran huruf di label mengikuti **jarak baca**, bukan selera: kode lokasi
dan kode besar dibaca dari 3 meter, qty dan kode dus dari 1 meter,
tanggal dan supplier dari dekat.

## Mengubah ukuran label

### Cara pertama: lewat aplikasi (tidak mengubah kode)

Di panel **Tata letak**:

- Centang **Kunci ukuran label dalam mm**, lalu isi **Lebar label** dan
  **Tinggi label**. Ukuran label tetap segitu walaupun kertasnya diganti.
- Hilangkan centangnya kalau label harus ikut membesar/mengecil mengikuti
  kertas — ukurannya dihitung dari kertas dikurangi margin dan jarak.
- **Muat maksimal** mengisi kolom dan baris sebanyak yang muat.

Ini tidak bisa dilakukan pada template **Rak 100 × 25** dan
**Dus 100 × 250**: ukurannya sengaja dikunci.

### Cara kedua: mengubah ukuran bawaan template (perlu buka kode)

Buka `assets/templates.js`, cari daftar `TEMPLATES` di bawah, lalu ubah
angka pada template yang dimaksud:

```js
{
  key: 'rak100', nama: 'Rak 100 × 25', ukuran: '100 × 25 mm',
  cls: 'lbl-rak100', fixed: true,
  paper: 'a4', orient: 'portrait',
  cols: 2, rows: 10,          // kolom × baris per lembar
  cellW: 100, cellH: 25,      // ukuran satu label, dalam mm
  margin: 4, gap: 2,          // margin kertas & jarak antar label, mm
  ...
}
```

Setelah itu sesuaikan juga gayanya di `assets/label.css` pada blok
`.lbl-rak100` — di sana semua ukuran ditulis dalam `mm`, tidak pernah
`px` atau `%`, supaya hasil cetak sama dengan ukuran sebenarnya.

Aturan yang dipakai saat menghitung tata letak: **margin adalah batas
atas, bukan angka mati.** Kalau barisan label lebih lebar dari sisa
kertas, margin mengecil sendiri supaya label tetap di tengah dan tidak
terpotong. Contohnya template Dus: 2 × 100 mm + jarak 4 mm = 204 mm,
sementara A4 hanya 210 mm — margin otomatis jadi 3 mm, bukan 4 mm.

### Cara ketiga: membuat template baru

Sebagian besar template bukan blok CSS sendiri-sendiri, melainkan
**susunan bagian**. Satu template ditulis sebagai daftar:

```js
stack({
  key: 'rakbaru', fam: 'rak', nama: 'Strip baru', ukuran: '100 × 30 mm',
  fixed: true,
  paper: 'a4', orient: 'portrait', cols: 2, rows: 9,
  cellW: 100, cellH: 30, margin: 4, gap: 2,   // mm — untuk kertas
  opts: { qr: true, barcode: false, meta: false },
  mini: [2, 9], band: 'left', padU: 0.35, gapU: 0.25,
  parts: [
    { p: 'hero', h: 'fill', src: 'lokasi', size: 5.0, sub: false },
    { p: 'meta', h: 1.2, list: ['skuvar', 'qty'], size: .95 }
  ]
})
```

Tambahkan hasilnya ke larik `RAK` atau `DUS` di `assets/templates.js`.
Pemilih template, penyimpanan, dan mesin cetak mengikuti sendiri.

**Satuan u.** Tinggi tiap bagian (`h`) dan ukuran huruf (`size`) memakai
satuan `u`, bukan mm. Satu u = sepersepuluh tinggi label, jadi setiap
label selalu setinggi **10u** berapa pun ukuran fisiknya. Aturannya:

```
jumlah(h) + 2 × padU + (jumlah bagian − 1) × gapU  ≤  10
```

Satu bagian boleh memakai `h: 'fill'` untuk mengambil sisa ruang.
Perhatikan `padU`/`gapU` (satuan u, jarak **di dalam** label) berbeda dari
`margin`/`gap` (mm, jarak **antar** label di kertas).

Bagian yang tersedia: `title`, `hero`, `meta`, `rows`, `write`, `big2`,
`route`, `codes`, `qrbig`, `bc`, `chips`, `boxes`, `marks`, `note`,
`foot`, `rule`, `gap`.

Dua pemeriksaan menjaga aturan ini — jalankan keduanya setelah mengubah
template:

- **Pemeriksa anggaran** menghitung apakah jumlah `h` masih ≤ 10u dan
  apakah tiap ukuran huruf muat di kotaknya.
- **Pemeriksa di browser** membuka setiap template dan memastikan tidak
  ada isi yang terpotong, baik keluar dari label maupun di dalam
  bagiannya sendiri.

### Menambah kolom data baru

1. Tambahkan satu baris di `COLUMNS` pada `assets/data.js`.
2. Tambahkan nama-nama lain kolom itu di `ALIAS` supaya ikut dikenali saat impor.
3. Pakai di template yang butuh, di `assets/templates.js`.

Tabel, impor, ekspor, dan penyimpanan mengikuti sendiri — tidak ada rumus
yang perlu diperbaiki.

---

## Isi folder

```
index.html            kerangka + seluruh markup
assets/
  tokens.css          warna, huruf, jarak (tema terang & gelap)
  app.css             kerangka aplikasi
  label.css           HANYA gaya label + aturan @media print
  data.js             model data, localStorage, impor, ekspor
  templates.js        definisi + render tiap template label
  app.js              perekat: event, tabel, pratinjau, cetak
vendor/               pustaka lokal (lihat vendor/README.md)
contoh/
  Format_Label_Dus.xlsx  file contoh, 60 baris
uji/                  pemeriksaan untuk pengembang (lihat uji/README.md)
arsip/
  label-dus-rak-versi-lama.html   versi lama satu-file, disimpan sebagai arsip
```

Urutan `<script>` di `index.html` tidak boleh diubah:
vendor → `data.js` → `templates.js` → `app.js`.

---

## Batasan yang dipegang

- HTML + CSS + JavaScript biasa. Tanpa backend, database, npm, build step,
  atau framework.
- Jalan dengan klik dua kali `index.html` dari `file://`, jadi **tanpa
  `import`/`export` ES module** — satu IIFE per file.
- Pustaka disalin lokal ke `vendor/`, **tidak ada satu pun permintaan
  jaringan** saat aplikasi dibuka. Huruf pun memakai yang sudah ada di
  komputer, bukan Google Fonts.
- `localStorage` selalu dibungkus `try/catch`. Kalau diblokir, aplikasi
  tetap tampil normal, hanya tidak bisa menyimpan otomatis.
- Ekspor tetap berupa file yang diunduh, bukan disimpan di browser.
- JavaScript ES5/ES2015 supaya aman untuk browser gudang (Chrome/Edge
  2019 ke atas).

---

## Keputusan yang diambil sendiri

Beberapa hal tidak diatur di permintaan awal, jadi diputuskan begini dan
dicatat di sini:

1. **Aplikasi diletakkan di akar repo**, bukan di dalam subfolder
   `label-gudang/`. Alasannya repo ini memang folder proyeknya; dengan
   begitu `index.html` langsung terlihat saat folder dibuka.
2. **Ukuran huruf besar dikecilkan otomatis setelah dirender.** Perkiraan
   dari panjang teks saja tidak cukup: kalau komputer gudang tidak punya
   huruf condensed, huruf penggantinya lebih lebar dan `1061` bisa
   terpotong jadi `10…`. Jadi setelah label digambar, lebarnya diukur dan
   ukuran hurufnya disusutkan sampai benar-benar muat. Pengukuran
   dilakukan sekaligus untuk semua label, baru penulisannya, supaya tidak
   lambat.
3. **Pratinjau dibatasi 30 lembar**, tapi yang dicetak tetap semuanya.
   Tanpa batas ini, data 500 baris membuat pratinjau berat tanpa guna.
4. **Pemisah halaman dipasang sebelum lembar kedua dan seterusnya**
   (`.sheet + .sheet { break-before: page }`), bukan sesudah lembar
   terakhir. Ini yang mencegah halaman kosong di akhir hasil cetak.
5. **Saat mencetak, lembar dipindahkan ke `<div id="paper">` yang berada
   langsung di bawah `<body>`.** Dengan begitu seluruh kerangka aplikasi
   bisa disembunyikan tanpa menyisakan pembungkus yang menghasilkan
   halaman kosong.
6. **Zona dan status boleh diisi bebas**, tidak dibatasi lima pilihan.
   Nilai di luar daftar tetap tampil, warnanya abu-abu netral.
7. **Kolom lokasi yang kosong tetap dicetak sebagai garis tebal** untuk
   ditulis tangan pakai spidol — bukan disembunyikan.
8. **Versi lama satu-file dipindahkan ke `arsip/`**, tidak dihapus, supaya
   masih bisa dibuka kalau ada yang perlu dibandingkan.
9. **Template ditulis sebagai daftar bagian, bukan CSS sendiri-sendiri.**
   Dua puluh delapan template dengan CSS masing-masing akan jadi beban
   pemeliharaan; dengan mesin bersama, satu perbaikan langsung berlaku
   untuk semuanya.
10. **Tinggi diukur dalam satuan u, bukan mm.** Percobaan pertama memakai
   patokan yang bergantung lebar dan hasilnya tidak bisa diprediksi:
   susunan yang sama muat di satu label tapi terpotong di label lain.
   Dengan aturan "setiap label setinggi 10u", anggaran tiap bagian bisa
   dihitung dan diperiksa otomatis.
11. **Kolom "Diperiksa oleh" di label QC sengaja dikosongkan** walaupun
   kolom PIC ada isinya — tanda tangan pemeriksaan harus dibubuhkan di
   dus, bukan dicetak dari data.
12. **Urungkan hanya mencatat perubahan susunan baris**, bukan setiap
   ketikan. Di dalam kotak isian, Ctrl+Z bawaan browser sudah lebih tepat
   dan lebih halus; mengambil alihnya justru merugikan.
13. **Pemeriksaan ditaruh di dalam repo, bukan hanya dijalankan sekali.**
   README menyebut ada pemeriksaan, jadi filenya harus ada dan bisa
   dijalankan ulang. Dua dari tiga sengaja dibuat tanpa pustaka apa pun
   supaya tetap bisa dipakai di komputer yang tidak boleh memasang npm.

---

## Menjalankan pemeriksaan

```sh
sh uji/jalankan.sh
```

Tiga pemeriksaan, dua di antaranya hanya butuh Node:

| Perintah | Butuh | Memeriksa |
|---|---|---|
| `node uji/periksa-impor.js` | Node | Jalur impor Excel dari ujung ke ujung |
| `node uji/periksa-anggaran.js` | Node | Anggaran tinggi tiap template |
| `node uji/periksa-browser.js` | Node + Playwright | Aplikasi sungguhan di Chromium |

Yang ketiga berhenti dengan pesan kalau Playwright tidak terpasang, bukan
error. **Aplikasinya sendiri tetap tanpa pustaka apa pun** — folder `uji/`
murni alat bantu pengembang dan tidak pernah dimuat oleh `index.html`.

Yang paling berharga dari pemeriksa browser: ia menemukan **isi yang
terpotong di dalam bagiannya sendiri**. Tiap bagian label memakai
`overflow:hidden`, jadi teks kepanjangan hilang tanpa jejak — labelnya
tetap terlihat rapi dan tetap lolos pemeriksaan "ada yang keluar dari
kotak label". Satu-satunya cara menemukannya adalah membandingkan
`scrollHeight` dengan `clientHeight` tiap bagian di browser sungguhan.
Rinciannya ada di `uji/README.md`.

## Pemeriksaan yang sudah dijalankan

| Pemeriksaan | Hasil |
|---|---|
| Buka `index.html` tanpa internet, semua fitur jalan | lolos — 0 permintaan jaringan |
| Impor `contoh/Format_Label_Dus.xlsx` | 60 baris; `46126` → `14-04-2026`; `SKU/Kode` → Kode; `Nama Barang` → SKU |
| Cetak PDF Strip rak 100 × 25 | label terukur **100 × 25 mm**, 20 per lembar A4, 60 label = 3 lembar |
| Cetak PDF Banner dus 100 × 250 | label terukur **100 × 250 mm**, 2 per lembar A4, 60 label = 30 lembar |
| Halaman kosong di akhir | tidak ada |
| Halaman kalibrasi | kotak terukur 100 × 100 mm, penggaris 150 mm |
| Data bertahan setelah browser ditutup | lolos |
| Urungkan mengembalikan 180 baris hasil pecah per dus ke 60 | lolos |
| Navigasi papan ketik: panah, Enter, Enter di baris terakhir | lolos |
| Periksa data sebelum cetak menandai 5 jenis masalah | lolos |
| `uji/periksa-browser.js` berhenti rapi tanpa Playwright | lolos, keluar dengan kode 0 |
| Layar 390 px | semua tombol terjangkau, halaman tidak menggulir ke samping |
| `console.error` sepanjang alur impor → edit → saring → cetak | tidak ada |
| 28 template, isi tidak melebihi kotak label | lolos |
| 28 template, tidak ada isi terpotong di dalam bagiannya | lolos |
| Anggaran tinggi 10u untuk 19 template bermesin bersama | lolos |
| Label tiang 25 × 100 mm (isi diputar 90°) | terukur 25 mm, jarak baris 27 mm |
| Banner 100 × 140 mm | terukur 100 × 140 mm, 4 per A4, 60 label = 15 lembar |
