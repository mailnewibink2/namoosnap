# Namoo Snap 📸💍
**Digital Guest Photo Share & Live Gallery for Weddings**

Aplikasi web modern berbasis React dan Vite yang memungkinkan para tamu undangan pernikahan mengunggah foto momen bersama kedua mempelai secara langsung dari smartphone mereka dengan kompresi gambar otomatis, ditampilkan di layar proyektor secara real-time, dan dimoderasi oleh kru Wedding Organizer (WO).

---

## 🌟 Fitur Utama

1. **Upload Foto Tamu (`GuestUpload.jsx`)**
   - Header bertema wedding "Namoo Snap".
   - Input Nama Tamu & Doa/Ucapan Singkat.
   - **Kompresi Canvas Otomatis di Frontend**: Meresize gambar maksimal lebar 1200px dan kualitas JPEG 0.8 sebelum diunggah untuk menghemat bandwidth & mempercepat pengiriman.
   - Live preview ukuran file sebelum & sesudah kompresi (menghitung persentase hemat ukuran).
   - Unggah langsung ke Supabase Storage (bucket `wedding-photos`) dan simpan metadata ke database PostgreSQL (tabel `photos`).
   - Efek konfeti saat foto berhasil terkirim.

2. **Live Gallery & Slideshow Proyektor (`LiveSlideshow.jsx`)**
   - Header "Namoo Snap - Live Gallery".
   - Menampilkan foto yang sudah disetujui (`is_approved = true`).
   - **Realtime Subscription Supabase**: Foto baru langsung muncul otomatis di layar tanpa perlu refresh browser.
   - Rotasi otomatis (slideshow) tiap beberapa detik dengan kontrol play/pause, durasi, dan tombol layar penuh (Fullscreen mode).
   - Glassmorphic caption card menampilkan nama tamu dan ucapan doa.

3. **Dashboard Moderasi WO (`AdminModeration.jsx`)**
   - Kru WO dapat memantau seluruh foto yang masuk secara real-time.
   - Filter tab: *Menunggu Moderasi*, *Sudah Ditayangkan*, dan *Semua Foto*.
   - Tombol **"Tayangkan"** (Approve) dan **"Hapus"** (Delete) foto yang tidak layak/duplikat.
   - Tombol **"Tayangkan Semua"** untuk approval massal.
   - Lightbox modal untuk melihat foto resolusi penuh.

---

## 🛠️ Panduan Persiapan Supabase

### 1. Buat Tabel & Policy
Buka dashboard Supabase Anda di [supabase.com](https://supabase.com), masuk ke **SQL Editor**, lalu jalankan query dari file [`supabase_setup.sql`](./supabase_setup.sql).

### 2. Atur Variabel Lingkungan (`.env`)
Salin file `.env.example` menjadi `.env` lalu masukkan kredensial Supabase Anda:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
```

---

## 🚀 Menjalankan Aplikasi Secara Lokal

1. **Pasang Dependensi**:
   ```bash
   npm install
   ```

2. **Jalankan Server Development**:
   ```bash
   npm run dev
   ```
   Aplikasi akan terbuka di browser pada `http://localhost:3000`.

3. **Build untuk Produksi**:
   ```bash
   npm run build
   ```

---

## 📁 Struktur File Proyek

```
Namoo Snap/
├── index.html
├── package.json
├── vite.config.js
├── supabase_setup.sql
├── .env.example
├── .env
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── supabaseClient.js
│   └── components/
│       ├── GuestUpload.jsx
│       ├── LiveSlideshow.jsx
│       └── AdminModeration.jsx
└── README.md
```
