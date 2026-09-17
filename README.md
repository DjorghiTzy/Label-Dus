# Label Dus & Rak

Aplikasi untuk membuat dan mencetak **label gudang** — label dus dan label
rak — langsung dari laptop atau HP. Menggantikan file Excel `PRINT_LABEL`
yang ukurannya tidak pasti saat dicetak dan rumusnya rusak setiap kali
ditambah kolom.

Satu aturan yang dipegang: **satu baris data = satu label.** Data
dimasukkan sekali, lalu bisa dicetak dalam sembilan bentuk label.

---

## Dua basis data: CV dan OL

Di kanan atas ada pemilih **BASIS DATA — CV / OL**. Keduanya benar-benar
terpisah: baris label, pengaturan cetak, dan katalog produknya sendiri-
sendiri. Berpindah tidak pernah mencampur data; yang sedang dibuka
disimpan dulu, lalu yang dituju dimuat.

| | Isi | Katalog produk |
|---|---|---|
| **CV** | Barang umum: elektronik, peralatan, aksesori | 731 produk |
| **OL** | Aksesori ponsel: charger, kabel, case, tempered glass | 245 produk |

Pilihan basis data ikut tersimpan, jadi besok aplikasi terbuka di tempat
yang sama.

### Katalog produk

Tombol **Cari produk** di tab Data label membuka katalog basis data yang
sedang aktif. Ketik nama produk atau barcode, centang yang dibutuhkan,
lalu **Tambah ke daftar** — semuanya langsung jadi baris label lengkap
dengan nama dan stoknya.

### Rekomendasi sambil mengetik

Ketik di **kotak pencarian** di atas tabel — bahkan saat daftarnya masih
kosong. **Satu huruf sudah cukup**: ketik `a`, produk yang cocok langsung
muncul, dan Enter menambahkannya sebagai baris label baru.

Kotak yang sama tetap menyaring baris yang sudah ada, jadi ia melayani
dua hal sekaligus: mencari di daftar Anda, dan mencari di katalog.

Bisa juga langsung di kolom **Kode** atau **Varian** kalau barisnya sudah
ada — di situ rekomendasinya mengisi baris itu, bukan menambah baris.

- Ketik `899` → sepuluh teratas dari 402 produk yang cocok
- Ketik `ugreen hub` → ketemu walaupun kedua kata itu tidak berdampingan
  di nama produknya
- Bagian yang cocok ditebalkan, lengkap dengan stok dan satuannya

| Tombol | Hasil |
|---|---|
| **↓ / ↑** | Pindah antar rekomendasi |
| **Enter** | Ambil yang sedang disorot |
| **Esc** | Tutup daftarnya |
| Klik | Ambil yang diklik |

Kaki daftarnya selalu menyebut apa yang akan terjadi — "menambahkan
sebagai baris label baru" atau "mengisi baris ini" — supaya tidak
tertukar.

**Kalau kata kuncinya umum**, di bawah daftar muncul baris
**"Lihat semua N produk yang cocok"**. Menekannya membuka katalog lengkap
dengan kata kunci itu sudah terisi — jadi mengetik satu huruf pun tetap
ada jalan keluarnya, bukan cuma sepuluh teratas.

Memilih rekomendasi mengisi Kode, nama produk, dan qty sekaligus. Kalau
Anda hanya mengetik barcode lengkap lalu pindah sel, pengisian tetap
jalan — tapi hanya ke kolom yang masih kosong, supaya yang sudah diketik
sendiri tidak tertimpa.

Katalognya ada di `data/katalog-cv.js` dan `data/katalog-ol.js`, dimuat
lewat `<script>` biasa — bukan `fetch`, karena `fetch` diblokir saat
halaman dibuka dengan `file://`.

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

- Sheet dipilih sendiri berdasarkan **isinya**, bukan namanya: yang
  dihitung adalah berapa judul kolom yang dikenali dan berapa baris
  datanya. Sheet pendamping (`Data Issues`, `Summary Golongan`,
  `Ringkasan Area`, `Kode & Aturan`) dan sheet petunjuk (`PRINT`,
  `SETUP`, `README`) tidak pernah menang selama ada sheet SKU yang
  strukturnya sehat. Kalau ada sheet **`Claude Import`**, itulah yang
  dipakai — sheet itu memang disiapkan untuk aplikasi ini. Kalau tidak
  ada, yang terpilih `Draft Pengelompokan`.
- Header `Prefix Lokasi`, `Prefix Location`, `Prefix`, dan `Area Prefix`
  sama-sama dibaca sebagai **Prefix lokasi**.
- Kolom **`QR Payload`** dipakai apa adanya. Kalau file mapping sudah
  menuliskan isi QR-nya, aplikasi tidak menyusun ulang.
- Kolom **`Status Mapping`** menandai baris: `DRAFT OK` bersih,
  `REVIEW TIPE` diberi tanda ringan, `REVIEW BARCODE` diberi tanda bahwa
  QR-nya belum final. Tidak ada baris yang dibuang karena statusnya.
- `Prefix Lokasi` (`A-CHR`) masuk ke kolomnya sendiri, bukan ke
  **Lokasi final**. Prefix cuma menunjukkan area dan golongan — rak,
  baris, dan posisi (`R01-B01-P01`) tidak pernah ditebak aplikasi.
- Baris judul hiasan di atas header dilewati sendiri.
- Tanggal Excel berupa angka (`46126`) dibaca jadi `14-04-2026`.
  Format `14/04/2026` dan `14-04-2026` juga diterima.
- Kolom `No` dan `Text Dus (x/total)` dilewati.
- Baris ekor yang hanya berisi zona/status/PIC dibuang.

Coba dulu dengan `contoh/Format_Label_Dus.xlsx` — hasilnya 60 baris. File
itu sengaja dibuat berantakan seperti file Excel lama: ada baris judul
hiasan, sheet `PRINT_LABEL_8UP` yang harus dilewati, tanggal berupa angka
seri, dan puluhan baris ekor kosong. Ada juga `contoh/Format_Label_Dus.csv`
yang sudah memakai judul kolom aplikasi ini.

### Generate lokasi rak

Data mentah biasanya cuma punya **Prefix lokasi** (`A-CHR`) — belum rak,
baris, dan posisinya. Tombol **Generate lokasi** di baris tombol atas
mengisi kolom **Lokasi final** untuk baris yang masih kosong:

```
A-CHR-R01-B01-P01   ← {PREFIX}-Rxx-Bxx-Pxx
```

Satu rak = 4 baris × 10 posisi = 40 slot. Urutannya `P01`…`P10`, lalu
`B01`…`B04`, lalu pindah ke `R02`. Tiap prefix punya antrean sendiri:
`B-CCH` mulai lagi dari `B-CCH-R01-B01-P01`.

Yang dipegang:

- Baris yang **sudah** punya Lokasi final tidak pernah diubah atau
  dipindah.
- Slot yang sudah terpakai dilewati — tidak ada lokasi kembar.
- Barcode yang sama memakai lokasi yang sama, jadi mengimpor file yang
  sama dua kali tidak menggeser apa pun.
- Prefix lokasi kosong berarti barisnya dilewati, bukan ditebak.
- Urutan pengisian: prefix → brand → tipe → nama, supaya varian satu
  tipe berdekatan di rak.

Lokasi final tetap bisa diketik sendiri di tabel. Yang diketik orang
menang — aplikasi tidak pernah mengembalikannya ke hasil generator, hanya
mengingatkan kalau formatnya salah atau lokasinya kembar.

Tombol **Print label rak** mencetak baris yang dicentang memakai lokasi
yang sudah tersimpan. Tidak ada lokasi yang dibuat di jalur cetak; baris
tanpa Lokasi final diperingatkan dulu.

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

**Mencetak ulang sebagian.** Kalau kertas macet di lembar 7, tidak perlu
mengulang semuanya: isi **Cetak lembar ke- 7 sampai 9** di panel kiri.
Pratinjau, penghitung, dan hasil cetaknya ikut menyesuaikan, dan
penomoran lembar tetap memakai nomor aslinya ("Lembar 7 / 30").
Kosongkan kedua kotak itu untuk kembali mencetak semuanya.

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

Ada **dua keluarga** berisi 28 template. Tab **Label rak / Label dus** di
atas pemilih memisahkan keduanya, dan tab itu menempel di atas panel —
tidak ikut tergulir hilang saat menelusuri daftar template.
Yang dipilih tersimpan, jadi besok aplikasi terbuka di keluarga yang sama.

### Label rak — 14 template

Ditempel di bibir rak, tiang, atau lorong. Isi utamanya **kode lokasi**,
dibuat sebesar mungkin karena dibaca sambil berjalan.

| Template | Ukuran | Per lembar | Dipakai untuk |
|---|---|---|---|
| **Strip 100 × 25** | 100 × 25 mm | 20 | Strip rak baku: lokasi final, nama barang, tipe, barcode, QR |
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
| **Banner 100 × 200** | 100 × 200 mm | 2 | Banner baku untuk sisi depan dus |
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
**Dus 100 × 200**: ukurannya sengaja dikunci.

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
data/
  katalog-cv.js       katalog produk CV (731 produk)
  katalog-ol.js       katalog produk OL (245 produk)
assets/
  tokens.css          warna, huruf, jarak (tema terang & gelap)
  app.css             kerangka aplikasi
  label.css           HANYA gaya label + aturan @media print
  data.js             model data, localStorage, impor, ekspor
  templates.js        definisi + render tiap template label
  app.js              perekat: event, tabel, pratinjau, cetak
vendor/               pustaka lokal (lihat vendor/README.md)
contoh/
  Format_Label_Dus.xlsx  file contoh, 60 baris (meniru file Excel lama)
  Format_Label_Dus.csv   file contoh format CSV, 20 baris
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
13. **Pola QR berbeda per keluarga.** Label rak memakai
   `{lokasi}|{sku}|{qty}` karena yang dipindai di rak adalah lokasinya;
   label dus memakai `{sku}|{kodeDus}|{qty}|{lokasi}` karena yang
   dipindai di dus adalah barangnya. Tetap bisa diubah sendiri.
14. **Ringkasan sebelum cetak tidak lagi membangun HTML.** Dulu ia
   memanggil fungsi yang merender seluruh lembar hanya untuk membaca
   angkanya, lalu membuang hasilnya — untuk 1500 baris itu sekitar dua
   detik terbuang. Sekarang angkanya dihitung langsung: 4 ms.
15. **"Dus ke" punya dua arti, dan itu dibedakan dari isi filenya.** Di
   file Excel lama, kolom "Dus Ke" justru berisi kode dus (`MC01-1W`),
   jadi aliasnya mengarah ke Kode dus. Tapi ekspor aplikasi ini punya
   "Kode dus" dan "Dus ke" sebagai dua kolom berbeda. Aturannya sekarang:
   kalau kedua kolom itu ada di file yang sama, "Dus ke" pasti nomor
   urut. Tanpa ini, mengekspor lalu mengimpor kembali kehilangan satu
   kolom — ketahuan lewat pemeriksaan bolak-balik.
16. **QR disimpan sementara (cache).** Membuat QR adalah bagian termahal
   saat mencetak, dan satu gudang biasanya punya banyak baris dengan isi
   QR yang sama. Cache dibatasi 4000 entri supaya tidak menggerus ingatan
   browser pada data besar.
17. **Tab keluarga dibuat menempel, dan pemilih template dibatasi
   tingginya.** Lima belas kartu setinggi 91 px memakan 812 px dan
   mendorong pengaturan "Kertas" sampai 1088 px — jauh di luar layar
   pada jendela 910 px. Lebih buruk lagi, tab "Label rak / Label dus"
   tergulir hilang setelah 120 px, sehingga keluarga kedua praktis tidak
   terlihat. Sekarang tabnya menempel, kartunya diringkas jadi 68 px,
   dan pemilihnya digulir sendiri — "Kertas" turun ke 648 px.
18. **Kanvas kosong menawarkan jalan keluar, bukan cuma pemberitahuan.**
   Layar pertama yang dilihat orang saat membuka aplikasi adalah kanvas
   kosong. Sekarang ia membedakan tiga keadaan — belum ada data, ada data
   tapi belum dicentang, dan rentang lembar yang mengosongkan hasil —
   dan masing-masing memberi tombol yang langsung menyelesaikannya.
19. **Teks yang tidak muat dipatahkan, bukan dikecilkan terus.** Kode
   lokasi `GUDANG-B-LANTAI2-RAK07-SLOT23` pernah menyusut jadi 3,38 mm —
   sama besar dengan baris keterangan di bawahnya — sehingga hierarkinya
   runtuh dan kedua baris terlihat berdempet. Sekarang teks yang boleh
   dipatahkan berhenti menyusut di 55% ukuran awalnya lalu dipecah jadi
   dua baris: 5,91 mm dan utuh sampai `SLOT23`, bukan 3,38 mm.
20. **Pop-up bawaan browser diganti dialog sendiri.** `window.confirm`
   menampilkan nama domain, tidak bisa ditata, dan menghentikan seluruh
   halaman. Dialog sendiri juga bisa menjelaskan akibatnya — misalnya
   mengingatkan bahwa penghapusan masih bisa diurungkan.
21. **Perpindahan tab memakai visibility, bukan display.** Dengan
   `display:none` animasi tidak jalan dan pratinjau cetak tidak terukur
   sampai tabnya dibuka. Sekarang keduanya tetap ada di tata letak dan
   bersilang-pudar — sekaligus menghilangkan kedipan "menyesuaikan zoom"
   saat pertama kali pindah tab.
22. **Katalog produk dimuat lewat `<script>`, bukan `fetch`.** Di
   `file://`, `fetch` diblokir aturan asal-usul. Data ditulis sebagai
   berkas JavaScript yang menempelkan dirinya ke `window.LG.katalog`.
23. **Katalog dicari per kata, bukan sebagai potongan utuh.** Mengetik
   "ugreen hub" dulu memberi nol hasil, padahal ada empat produk yang
   cocok — kedua kata itu hanya tidak berdampingan. Hasilnya juga
   diperingkat, karena "899" saja cocok dengan 402 produk dan urutanlah
   yang menentukan daftarnya berguna atau tidak.
24. **Daftar rekomendasi ikut bergeser saat tabel digulir, bukan
   ditutup.** Memfokuskan sel di tabel panjang membuat tabelnya
   menggulir sedikit — kalau gulir itu menutup daftarnya, daftarnya
   hilang tepat pada saat dibuka.
25. **Kotak pencarian melayani dua hal.** Menyaring baris yang sudah ada
   tidak berguna kalau daftarnya masih kosong — dan justru saat kosong
   itulah orang paling butuh menemukan barang. Jadi kotak yang sama juga
   mencari katalog dan bisa langsung menambahkan hasilnya.
26. **Perpindahan tab digeser mendatar, bukan dipudarkan.** Percobaan
   pertama memakai pudar dengan geseran tegak 8 px — nyaris tak terlihat.
   Sekarang tampilannya benar-benar bergeser mengikuti urutan tabnya, dan
   satu keping penanda meluncur di belakang tombol yang aktif, termasuk
   pada pemilih CV/OL.
27. **Kolom Kadaluarsa dicabut kembali.** Kolom itu saya tambahkan atas
   inisiatif sendiri, bukan diminta. Setelah dinilai tidak terpakai, ia
   dicabut sampai ke akarnya — alias impor, ekspor, file contoh, dan dua
   template FEFO yang berdiri di atasnya. Template kembali 28.
28. **Kata kunci umum diberi jalan keluar, bukan disuruh mengetik lebih
   panjang.** Mengetik satu huruf wajar dilakukan; menyuruh orang
   memperpanjang ketikannya bukan jawaban. Baris "Lihat semua N produk"
   membuka katalog lengkap dengan kata kunci itu sudah terisi.
29. **Pemeriksaan ditaruh di dalam repo, bukan hanya dijalankan sekali.**
   README menyebut ada pemeriksaan, jadi filenya harus ada dan bisa
   dijalankan ulang. Dua dari tiga sengaja dibuat tanpa pustaka apa pun
   supaya tetap bisa dipakai di komputer yang tidak boleh memasang npm.

---

## Kecepatan pada data besar

Diukur di Chromium, template Strip rak 100 × 25 (20 label per lembar):

| Baris | Tabel | Ringkasan cetak | Bangun + kirim ke printer |
|---|---|---|---|
| 500 | 30 ms | 6 ms | 269 ms (25 lembar) |
| 1500 | 90 ms | 4 ms | 551 ms (75 lembar) |
| 1500, tiap QR unik | 90 ms | 5 ms | 1,4 detik (75 lembar) |
| 3000, tiap QR unik | 257 ms | 3 ms | 2,2 detik (150 lembar) |

Pratinjau dibatasi 30 lembar supaya tetap ringan; yang dicetak tetap
semuanya. Kalau lembar yang disiapkan lebih dari 8, muncul pesan
"Menyiapkan N lembar…" supaya tidak terlihat seperti menggantung.

## Menjalankan pemeriksaan

```sh
sh uji/jalankan.sh
```

Tiga pemeriksaan, dua di antaranya hanya butuh Node:

| Perintah | Butuh | Memeriksa |
|---|---|---|
| `node uji/periksa-impor.js` | Node | Jalur impor Excel + bolak-balik ekspor→impor |
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
| Generator lokasi: urutan P01→P10, B01→B04, lalu R02 | lolos |
| Tiap prefix punya antrean sendiri | lolos |
| Lokasi yang sudah ada tidak pernah digeser, termasuk saat digenerate ulang | lolos |
| Barcode yang sama memakai lokasi yang sama saat impor ulang | lolos |
| Tidak ada lokasi kembar, tidak ada P11 atau B05 | lolos |
| Lokasi bertahan setelah halaman dimuat ulang | lolos |
| Cetak dari Data label memakai lokasi tersimpan, 100 × 25 mm, 20 per A4 | lolos |
| Bolak-balik ekspor → impor | 28/28 kolom kembali, tiap sel sama persis |
| Impor `contoh/Format_Label_Dus.csv` | 20 baris, 28/28 kolom dikenali |
| Workbook saran lokasi | sheet `Claude Import` terpilih di antara enam sheet |
| `Brand`, `Tipe`, `QR Payload`, `Status Mapping` dikenali terpisah | lolos |
| QR memakai `QR Payload` dari Excel apa adanya | lolos |
| Baris `REVIEW TIPE` / `REVIEW BARCODE` tetap tercetak, hanya ditandai | lolos |
| Workbook master gudang ACC | `Draft Pengelompokan` terpilih, bukan `Data Issues` |
| `Barcode`, `Area Draft`, `Kode Golongan`, `Golongan Draft` dikenali sendiri | lolos |
| `Prefix Lokasi` tidak pernah jadi lokasi final | lolos |
| QR label rak berisi `194644167882\|A-CHR-R01-B01-P01` | lolos |
| Baris tanpa lokasi final ditandai "Lokasi belum diset" | lolos |
| Cetak PDF Strip rak 100 × 25 | label terukur **100 × 25 mm**, 20 per lembar A4, 60 label = 3 lembar |
| Cetak PDF Banner dus 100 × 200 | label terukur **100 × 200 mm**, 2 per lembar A4, 60 label = 30 lembar |
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
| Cetak ulang lembar 7–9: pratinjau, penghitung, dan hasil cetak sama-sama 3 lembar | lolos |
| Pola QR berbeda antara keluarga rak dan dus | lolos |
| Katalog CV (731) dan OL (245) termuat | lolos |
| Pindah basis data: datanya benar-benar terpisah | lolos |
| Tambah produk dari katalog jadi baris label | lolos |
| Ketik barcode mengisi nama produk otomatis | lolos |
| Rekomendasi muncul sambil mengetik, bagian cocok ditebalkan | lolos |
| Satu huruf "a" sudah memunculkan hasil | lolos |
| Kata kunci umum dapat baris "Lihat semua 660 produk" | lolos |
| Baris itu bisa dipanah dan membuka katalog dengan kata kuncinya | lolos |
| ↓/↑ dan Enter memilih rekomendasi | lolos |
| Pencarian per kata: "ugreen hub" ketemu 4, dulu 0 | lolos |
| Dialog konfirmasi sendiri, bukan `window.confirm` | lolos |
| Lokasi panjang dipatahkan dua baris, tidak menyusut jadi 3,38 mm | lolos |
| 14 template rak: tidak ada elemen yang tumpang tindih | lolos |
| Dijalankan lewat HTTP (server statis), bukan hanya `file://` | hasil sama persis |
| Label tiang 25 × 100 mm (isi diputar 90°) | terukur 25 mm, jarak baris 27 mm |
| Banner 100 × 140 mm | terukur 100 × 140 mm, 4 per A4, 60 label = 15 lembar |
