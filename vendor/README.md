# Pustaka pihak ketiga

Semua pustaka di sini **disalin sebagai file lokal**, tidak diambil dari
internet. Aplikasi tidak pernah membuat satu pun permintaan jaringan.

| File | Pustaka | Versi | Lisensi |
|---|---|---|---|
| `xlsx.mini.min.js` | SheetJS (build `mini`) | 0.18.5 | Apache-2.0 — `xlsx-LICENSE.txt` |
| `qrcode.js` | qrcode-generator | 1.4.4 | MIT — teks lisensi ada di bagian atas file |
| `JsBarcode.code128.min.js` | JsBarcode (build CODE128 saja) | 3.11.6 | MIT — `jsbarcode-LICENSE.txt` |

Kalau salah satu file hilang atau gagal dimuat, aplikasi tetap berjalan:
fitur yang memakainya disembunyikan, bukan memunculkan error.

- `qrcode.js` hilang → pilihan **Tampilkan QR code** hilang.
- `JsBarcode.code128.min.js` hilang → pilihan **barcode** hilang.
- `xlsx.mini.min.js` hilang → impor/ekspor `.xlsx` hilang; CSV dan
  "Tempel dari Excel" tetap bisa dipakai.

## Mengganti versi

Unduh build yang setara dari npm, ganti filenya dengan nama yang sama,
lalu buka `index.html` dan periksa ketiga fitur di atas. Jangan mengubah
urutan `<script>` di `index.html`: vendor → `data.js` → `templates.js` → `app.js`.
