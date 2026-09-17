#!/bin/sh
# Menjalankan seluruh pemeriksaan. Dari folder mana pun:
#     sh uji/jalankan.sh
set -e
cd "$(dirname "$0")/.."

echo "=== 1/3  Sintaks JavaScript ==="
for f in assets/*.js; do node --check "$f" && echo "  OK   $f"; done

echo
echo "=== 2/3  Jalur impor Excel ==="
node uji/periksa-impor.js | tail -22

echo
echo "=== 3a/3 Anggaran tinggi template ==="
node uji/periksa-anggaran.js | tail -4

echo
echo "=== 3b/3 Aplikasi di browser ==="
node uji/periksa-browser.js | tail -30

echo
echo "Semua pemeriksaan selesai."
