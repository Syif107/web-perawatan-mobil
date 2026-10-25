# Armada Pelayan Kemanusiaan — Jadwal & Bukti Perawatan Armada

Web sederhana untuk mengatur jadwal perawatan armada pelayanan kemanusiaan, lengkap dengan nama petugas dan foto sebagai bukti bahwa perawatan benar-benar dilakukan. Semua data disimpan lokal di browser — tanpa akun, tanpa server, tanpa upload foto ke internet.

Halaman utama dibuka dengan kalimat **“ATAS BERKAT ROCHMAT ALLOH YANG MAHA KUASA”** di bagian paling atas. Nama situs adalah **Armada Pelayan Kemanusiaan**, dengan tema beranda **“Melaksanakan hubungan kepada sesama manusia.”**

![Status siap pakai](https://img.shields.io/badge/status-siap%20pakai-c9f25f?style=flat-square&labelColor=0f1618) ![Tanpa build](https://img.shields.io/badge/build-tidak%20perlu-c9f25f?style=flat-square&labelColor=0f1618)

## Fitur

- **Slide jadwal perawatan** — setiap catatan tampil sebagai slide yang bisa digeser, dengan tombol navigasi, titik indikator, dan penghitung slide.
- **Nama mobil / armada & nomor polisi** — nama bisa diketik bebas dan otomatis disarankan dari armada yang sudah pernah dicatat.
- **Tanggal perawatan** — status otomatis: *Terjadwal*, *Hari ini*, *Terlambat*, atau *Selesai*.
- **Bentuk perawatan** — bisa dipilih dari saran (ganti oli, servis rem, servis AC, dll.) atau diketik sendiri.
- **Nama petugas** — catat siapa yang mengerjakan perawatan; nama tampil di slide dan disarankan otomatis untuk catatan berikutnya.
- **Foto bukti** — unggah dari galeri/kamera, bisa juga lewat drag & drop. Foto dikompresi otomatis dan bisa dibuka dalam ukuran penuh.
- **Biaya & catatan** — opsional, untuk melengkapi riwayat perawatan.
- **Tandai selesai** — simpan tanggal selesai dan lihat riwayatnya di slide.
- **Filter** — lihat semua, yang terjadwal, hari ini, terlambat, atau yang sudah selesai.
- **Edit & hapus** — perbarui jadwal atau hapus beserta foto buktinya (dengan konfirmasi).
- **Responsif** — nyaman dipakai di desktop maupun HP; slide bisa digeser dengan swipe.
- **Penyimpanan lokal** — memakai IndexedDB, jadi data tetap ada setelah halaman ditutup atau di-refresh.

## Cara Membuka

Tidak perlu instalasi atau build.

1. Buka folder ini.
2. Klik dua kali `index.html` (disarankan Chrome atau Edge), atau drag ke jendela browser.
3. Klik **Tambah jadwal**, isi data armada, tanggal, bentuk perawatan, nama petugas, dan foto bukti.
4. Simpan, lalu gunakan slide/panah untuk melihat jadwal lainnya.

Opsional, bila ingin menjalankan lewat server lokal:

```bash
# Python
python -m http.server 8000

# atau Node.js
npx serve .
```

Lalu buka `http://localhost:8000`.

> Saat dipakai di HP, buka file/halaman yang sama dari browser HP untuk mengakses kamera dan galeri. Foto tetap tersimpan di browser perangkat tersebut.

## Penyimpanan Data

- Database: **IndexedDB** dengan nama `garasi-rawat`, object store `jadwal`.
- Foto disimpan sebagai JPEG terkompresi (sisi terpanjang maksimal 1600 px) di dalam catatan jadwal.
- Tidak ada data yang dikirim ke server mana pun.
- Menghapus data situs (*clear site data*), memakai mode privat, atau berganti browser/perangkat akan menghilangkan data lama. Data juga tidak otomatis tersinkron antar perangkat.
- Bila aplikasi dibuka langsung dari file, gunakan lokasi file yang sama agar browser mengenali penyimpanan yang sama.

## Struktur Proyek

```text
web-perawatan-mobil/
├── index.html      # Struktur halaman, form, dialog, dan template slide
├── styles.css      # Tampilan, animasi, dan layout responsif
├── app.js          # Logika jadwal, carousel, foto, dan IndexedDB
├── favicon.svg     # Ikon aplikasi
└── README.md
```

## Catatan Teknis

- HTML, CSS, dan JavaScript murni. Tidak ada framework, bundler, atau dependensi npm.
- Gambar diproses di sisi klien dengan `<canvas>` sebelum disimpan, sehingga tidak membebani penyimpanan browser.
- Tipografi memakai Google Fonts (*Plus Jakarta Sans* dan *Instrument Serif*); bila offline, browser akan memakai font fallback tanpa mengganggu fungsi.
