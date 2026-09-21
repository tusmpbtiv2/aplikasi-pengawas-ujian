# Sistem Manajemen Ujian Sekolah (SMP BHINNEKA TUNGGAL IKA)

Aplikasi manajemen operasional ujian sekolah dan penyusunan jadwal pengawas otomatis & manual untuk **SMP Bhinneka Tunggal Ika**, dirancang khusus menangani kapasitas riil:
- **2 Gedung** (Gedung Utama A & Gedung Timur B)
- **45 Ruang Ujian Aktif** (Kelas VII, VIII, IX & Lab Komputer)
- **50+ Guru Pengawas** dengan preferensi hari ketersediaan (*available days*)
- Dukungan konfigurasi jumlah pengawas per ruang (1 atau 2 pengawas)

---

## Fitur Utama

1. **Dashboard Eksekutif & Monitoring Ujian**
   - 8 Metrik Operasional Utama: Total Guru, Guru Aktif, Gedung, Ruang Ujian, Mata Pelajaran, Jadwal Ujian, Slot Terisi, dan Deteksi Konflik/Bentrok.
   - Grafik Interaktif (Recharts): Distribusi Beban Jaga per Guru, Jadwal Ujian per Tanggal & Sesi.
   - Tabel Ujian Mendatang dengan status keterisian pengawas real-time.

2. **Jadwal Pengawas Ujian (Auto-Scheduler & Manual)**
   - **Algoritma Deterministic Fair Scheduling**: Menjamin keadilan beban jaga antar guru, mematuhi preferensi hari, mencegah double-booking di jam yang sama, serta rotasi gedung dan ruang.
   - **Manual Override & Quick Replace**: Fitur penggantian pengawas darurat (sakit/izin) dengan rekomendasi guru pengganti yang berstatus *available*.
   - **Pencegahan Konflik & Audit**: Deteksi instan jika terjadi bentrok jadwal atau guru bertugas di hari libur tugasnya.
   - **Filter Multi-Kriteria**: Tanggal, Sesi, Gedung, Ruang, Nama Guru, dan Status Kehadiran.
   - **Mode Cetak Berita Acara & Lembar Tugas**: Cetak format resmi siap tanda tangan kepala sekolah dan panitia.

3. **Master Data Komprehensif**
   - **Data Guru**: NIP, nama lengkap, gender, preferensi hari aktif, nomor kontak, dan catatan tugas.
   - **Data Gedung & Ruang**: 2 Gedung dengan 45 ruang berkapasitas 32-36 siswa per ruang.
   - **Mata Pelajaran & Jadwal Ujian**: Pengaturan tanggal, waktu mulai, durasi menit, dan sesi.

4. **Import Center (Pusat Impor Berkas)**
   - Mendukung berkas Excel (`.xlsx`) dan CSV (`.csv`).
   - Download template resmi untuk: Guru, Gedung, Ruang, Mata Pelajaran, dan Jadwal Ujian.
   - Validasi data otomatis sebelum disimpan (pengecekan format, NIP unik, nama wajib, dll).
   - Pratinjau (*preview*) baris data sebelum konfirmasi import.

5. **Export Center (Pusat Ekspor & Laporan)**
   - Ekspor dalam format CSV, Excel Spreadsheet, dan Cetak Langsung (Print-ready).
   - Ekspor Data Guru, Ruang Ujian, Mata Pelajaran, Jadwal Ujian, Jadwal Pengawas, dan Ringkasan Beban Tugas Guru.

6. **Manajemen Pengguna & Hak Akses (Role-Based Access Control)**
   - **Admin**: Akses penuh ke seluruh konfigurasi, master data, jadwal, dan reset sistem.
   - **Panitia**: Pengelolaan data ujian, penjadwalan pengawas, dan pencetakan berita acara.
   - **Viewer / Pengawas**: Akses monitor dashboard dan melihat jadwal pengawas pribadi/umum.

7. **Pengaturan Sistem, Backup & Reset Data**
   - Identitas Sekolah (Nama, Alamat, Logo Sekolah, Tahun Ajaran, Semester).
   - Pengaturan Default Ujian (Durasi menit, jam mulai, jeda antar sesi, jumlah pengawas per ruang).
   - Fitur **Backup JSON** sekali klik untuk arsip panitia.
   - Fitur **Reset Aman** dengan modal konfirmasi ganda (Reset Pengawas saja, Reset Jadwal Ujian, atau Reset ke Data Bawaan).

---

## Teknologi yang Digunakan

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Motion.
- **Data Processing & Spreadsheet**: XLSX (SheetJS) untuk import/export Excel & CSV.
- **Backend / Database**: Supabase PostgreSQL dengan Row-Level Security (RLS) & Offline Seed Fallback.
- **Hosting / Deployment**: Netlify dengan Single Page Application (SPA) routing (`_redirects`).

---

## Cara Menjalankan Aplikasi

1. Clone repositori:
   ```bash
   git clone <repo-url>
   cd smp-bhinneka-ujian
   ```

2. Instal dependensi:
   ```bash
   npm install
   ```

3. Konfigurasi Variabel Lingkungan:
   Salin `.env.example` ke `.env`:
   ```bash
   cp .env.example .env
   ```
   *(Opsional) Masukkan URL dan ANON KEY Supabase Anda jika ingin menghubungkan database cloud.*

4. Jalankan server pengembang:
   ```bash
   npm run dev
   ```

5. Build untuk produksi:
   ```bash
   npm run build
   ```

---

## Struktur Proyek

```
src/
├── components/
│   ├── dashboard/          # Komponen metrik, grafik & tabel dashboard
│   ├── invigilators/       # Modal generate, assignment, print & quick-replace
│   ├── layout/             # Sidebar, Header, Modals
│   └── views/              # Halaman: Dashboard, Guru, Gedung, Ruang, Mapel,
│                           # Jadwal Ujian, Jadwal Pengawas, Import, Export, Settings
├── context/
│   ├── AuthContext.tsx     # Otentikasi dan simulasi peran (Admin, Panitia, Viewer)
│   └── DataContext.tsx     # State management terpusat, validasi, seed demo, backup/reset
├── lib/
│   ├── excelHelper.ts      # Engine Import/Export Excel & CSV + download template
│   ├── invigilatorHelper.ts# Engine algoritma penjadwalan & deteksi bentrok
│   └── supabase.ts         # Client Supabase & deteksi koneksi
└── types/
    └── database.ts         # Definisi TypeScript untuk seluruh entitas database
```

---

Dibuat untuk Panitia Ujian Sekolah **SMP Bhinneka Tunggal Ika**.
