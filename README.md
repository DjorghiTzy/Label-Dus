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

Data tersimpan sendiri di browser komputer ini. Tutup browser, buka lagi
besok — data masih ada. **Buat cadangan `.json` secara berkala** lewat
menu *Ekspor & cadangan*; data yang hanya ada di browser bisa hilang
kalau riwayat browser dibersihkan.

### 4. Mencetak

Pindah ke tab **Template & cetak**:

1. Pilih template di panel kiri.
2. Periksa penghitung di atas pratinjau: berapa label, berapa lembar.
3. Tekan **Cetak sekarang** → muncul ringkasan → **Buka dialog cetak**.

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

Dua template pertama **ukuran fisiknya pasti** dan tidak bisa diubah.

| Template | Ukuran | Per lembar A4 | Dipakai untuk |
|---|---|---|---|
| **Rak 100 × 25** | 100 × 25 mm | 20 (2 × 10) | Bibir rak, dibaca sambil berjalan dari 2–3 meter |
| **Dus 100 × 250** | 100 × 250 mm | 2 (2 × 1) | Sisi depan dus |
| Dus standar | 2 × 4 per A4 | 8 | Pengganti sheet `PRINT_LABEL_8UP` |
| Dus ringkas | 3 × 4 per A4 | 12 | Dus bertumpuk |
| Dus besar | 2 × 2 per A4 | 4 | Label besar dengan barcode |
| Rak / bin | 2 × 6 per A4 | 12 | Strip rak, ukurannya ikut kertas |
| Mini | 4 × 6 per A4 | 24 | Stiker kecil |
| Thermal | 100 × 50 mm | 1 | Printer thermal |
| Kartu gantung | 2 × 2 per A4 | 4 | Kartu status berlubang |

Ukuran huruf di label mengikuti **jarak baca**, bukan selera: kode lokasi
dan kode besar dibaca dari 3 meter, qty dan kode dus dari 1 meter,
tanggal dan supplier dari dekat.

---

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

---

## Pemeriksaan yang sudah dijalankan

| Pemeriksaan | Hasil |
|---|---|
| Buka `index.html` tanpa internet, semua fitur jalan | lolos — 0 permintaan jaringan |
| Impor `contoh/Format_Label_Dus.xlsx` | 60 baris; `46126` → `14-04-2026`; `SKU/Kode` → Kode; `Nama Barang` → SKU |
| Cetak PDF template Rak | label terukur **100 × 25 mm**, 20 per lembar A4, 60 label = 3 lembar |
| Cetak PDF template Dus | label terukur **100 × 250 mm**, 2 per lembar A4 |
| Halaman kosong di akhir | tidak ada |
| Halaman kalibrasi | kotak terukur 100 × 100 mm, penggaris 150 mm |
| Data bertahan setelah browser ditutup | lolos |
| Layar 390 px | semua tombol terjangkau, halaman tidak menggulir ke samping |
| `console.error` sepanjang alur impor → edit → saring → cetak | tidak ada |
| Sembilan template, isi tidak melebihi kotak label | lolos |
