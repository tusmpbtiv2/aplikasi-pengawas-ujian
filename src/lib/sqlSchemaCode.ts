export const SUPABASE_SQL_SCHEMA = `-- ========================================================================
-- SISTEM MANAJEMEN UJIAN SEKOLAH
-- SMP BHINNEKA TUNGGAL IKA
-- Supabase PostgreSQL Schema & Initial Seed
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------
-- 1. TABLE: profiles (User Profile connected to auth.users)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('ADMIN', 'PANITIA', 'VIEWER')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------
-- 2. TABLE: teachers (Data Guru & Pengawas)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Laki-laki', 'Perempuan')),
  employee_number TEXT, -- NIP atau NUPTK
  invigilator_code TEXT, -- Kode Pengawas e.g. P01, P02
  active BOOLEAN DEFAULT true NOT NULL,
  available_days TEXT[] DEFAULT ARRAY['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']::TEXT[] NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------
-- 3. TABLE: buildings (Data Gedung)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------
-- 4. TABLE: rooms (Data Ruang Ujian)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  capacity INTEGER DEFAULT 30 NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------
-- 5. TABLE: subjects (Mata Pelajaran)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  grade_level INT, -- 7, 8, 9, atau NULL jika umum
  grade_levels TEXT[] DEFAULT ARRAY['7', '8', '9']::TEXT[],
  default_duration INT DEFAULT 90 NOT NULL, -- durasi default dalam menit
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------
-- 6. TABLE: exam_schedules (Jadwal Ujian)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_date DATE NOT NULL,
  day_name TEXT NOT NULL, -- e.g. 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  session TEXT DEFAULT 'Sesi 1' NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------
-- 7. TABLE: invigilator_schedules (Jadwal Pengawas Ujian)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invigilator_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_schedule_id UUID NOT NULL REFERENCES public.exam_schedules(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'Pengawas 1' NOT NULL CHECK (role IN ('Pengawas 1', 'Pengawas 2', 'Cadangan')),
  status TEXT DEFAULT 'Dijadwalkan' NOT NULL CHECK (status IN ('Dijadwalkan', 'Hadir', 'Izin', 'Sakit', 'Digantikan', 'Alpha')),
  actual_attendance_time TIME,
  replacement_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  confirmed_by_admin BOOLEAN DEFAULT false NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_assignment_per_slot UNIQUE (exam_schedule_id, room_id, role)
);

-- ------------------------------------------------------------------------
-- 8. TABLE: settings (Pengaturan Sekolah & Ujian)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name TEXT NOT NULL DEFAULT 'SMP BHINNEKA TUNGGAL IKA',
  school_address TEXT NOT NULL DEFAULT 'Jl. Pendidikan No. 45, Jakarta',
  school_logo TEXT,
  exam_name TEXT NOT NULL DEFAULT 'Penilaian Akhir Semester (PAS) Genap',
  academic_year TEXT NOT NULL DEFAULT '2024/2025',
  semester TEXT NOT NULL DEFAULT 'Genap',
  principal_name TEXT DEFAULT 'Drs. H. Mulyono, M.Pd.',
  principal_nip TEXT DEFAULT '19680512 199403 1 005',
  committee_chairman_name TEXT DEFAULT 'Budi Santoso, S.Pd.',
  committee_chairman_nip TEXT DEFAULT '19750814 200003 1 002',
  committee_secretary_name TEXT,
  document_city TEXT DEFAULT 'Jakarta',
  document_date DATE,
  honor_per_session INTEGER DEFAULT 40000,
  default_invigilators_per_room INTEGER NOT NULL DEFAULT 2,
  default_start_time TIME DEFAULT '07:30:00' NOT NULL,
  default_duration INTEGER DEFAULT 90 NOT NULL,
  break_duration INTEGER DEFAULT 30 NOT NULL,
  app_name TEXT DEFAULT 'Sistem Manajemen Ujian Sekolah' NOT NULL,
  theme TEXT DEFAULT 'blue' NOT NULL,
  date_format TEXT DEFAULT 'DD/MM/YYYY' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Migration jika tabel public.settings sudah ada sebelumnya
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS principal_name TEXT DEFAULT 'Drs. H. Mulyono, M.Pd.';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS principal_nip TEXT DEFAULT '19680512 199403 1 005';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS committee_chairman_name TEXT DEFAULT 'Budi Santoso, S.Pd.';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS committee_chairman_nip TEXT DEFAULT '19750814 200003 1 002';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS committee_secretary_name TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS document_city TEXT DEFAULT 'Jakarta';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS document_date DATE;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS honor_per_session INTEGER DEFAULT 40000;

-- ------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invigilator_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow full read & write access for public (anon & authenticated)
-- Ensures CSV/Excel import, automated scheduling, and all app operations work seamlessly
CREATE POLICY "Allow public all access profiles" ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access teachers" ON public.teachers FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access buildings" ON public.buildings FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access rooms" ON public.rooms FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access subjects" ON public.subjects FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access exam_schedules" ON public.exam_schedules FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access invigilator_schedules" ON public.invigilator_schedules FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access settings" ON public.settings FOR ALL TO public USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------
-- TRIGGER: Handle new user registration from auth.users -> public.profiles
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'ADMIN')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ========================================================================
-- SEED DATA AWAL (SMP BHINNEKA TUNGGAL IKA)
-- ========================================================================

-- Settings
INSERT INTO public.settings (id, school_name, school_address, exam_name, academic_year, default_invigilators_per_room)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'SMP BHINNEKA TUNGGAL IKA',
  'Jl. Pendidikan No. 45, Jakarta',
  'Penilaian Akhir Semester (PAS) Genap',
  '2024/2025',
  2
) ON CONFLICT (id) DO NOTHING;

-- 2 Gedung
INSERT INTO public.buildings (id, name, code, address, notes)
VALUES 
  ('b0000000-0000-0000-0000-000000000001', 'Gedung Utama A', 'GDA', 'Lantai 1-2 Sayap Barat', 'Gedung ruang kelas VII dan VIII'),
  ('b0000000-0000-0000-0000-000000000002', 'Gedung Timur B', 'GDB', 'Lantai 1-2 Sayap Timur', 'Gedung ruang kelas IX dan Lab')
ON CONFLICT (code) DO NOTHING;

-- Ruang Ujian
INSERT INTO public.rooms (id, building_id, name, code, capacity, active, notes)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Ruang 01 (Kelas VII-A)', 'R-01', 32, true, 'Dilengkapi pendingin ruangan'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Ruang 02 (Kelas VII-B)', 'R-02', 32, true, 'Kapasitas penuh 32 siswa'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Ruang 03 (Kelas VIII-A)', 'R-03', 30, true, 'Ruang ujian tengah'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'Ruang 04 (Kelas IX-A)', 'R-04', 30, true, 'Gedung B Lantai 1'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Ruang 05 (Lab Komputer)', 'R-05', 36, true, 'Untuk ujian berbasis komputer')
ON CONFLICT (code) DO NOTHING;

-- Guru & Pengawas
INSERT INTO public.teachers (id, name, gender, employee_number, invigilator_code, active, available_days, notes)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Drs. H. Ahmad Sudrajat, M.Pd.', 'Laki-laki', '197503152000031002', 'P01', true, ARRAY['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'], 'Guru Senior Matematika'),
  ('d0000000-0000-0000-0000-000000000002', 'Siti Rahmawati, S.Pd.', 'Perempuan', '198207122008012015', 'P02', true, ARRAY['Senin', 'Selasa', 'Rabu', 'Kamis'], 'Guru Bahasa Indonesia'),
  ('d0000000-0000-0000-0000-000000000003', 'Budi Santoso, M.Si.', 'Laki-laki', '198511242010011009', 'P03', true, ARRAY['Senin', 'Rabu', 'Kamis', 'Jumat'], 'Guru IPA Terpadu'),
  ('d0000000-0000-0000-0000-000000000004', 'Nurul Hidayah, S.Pd.', 'Perempuan', '199004182014022008', 'P04', true, ARRAY['Senin', 'Selasa', 'Kamis', 'Jumat'], 'Guru Bahasa Inggris'),
  ('d0000000-0000-0000-0000-000000000005', 'Eko Prasetyo, S.Pd.', 'Laki-laki', '198809052012011011', 'P05', true, ARRAY['Senin', 'Selasa', 'Rabu', 'Jumat'], 'Guru IPS & PKn'),
  ('d0000000-0000-0000-0000-000000000006', 'Dewi Lestari, S.Pd.', 'Perempuan', '199301202019032014', 'P06', true, ARRAY['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'], 'Guru Seni Budaya')
ON CONFLICT DO NOTHING;

-- Mata Pelajaran
INSERT INTO public.subjects (id, name, code)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'Bahasa Indonesia', 'BIN-01'),
  ('e0000000-0000-0000-0000-000000000002', 'Matematika', 'MTK-02'),
  ('e0000000-0000-0000-0000-000000000003', 'Ilmu Pengetahuan Alam (IPA)', 'IPA-03'),
  ('e0000000-0000-0000-0000-000000000004', 'Bahasa Inggris', 'BIG-04'),
  ('e0000000-0000-0000-0000-000000000005', 'Pendidikan Pancasila & Kewarganegaraan (PPKn)', 'PPK-05')
ON CONFLICT (code) DO NOTHING;

-- Jadwal Ujian
INSERT INTO public.exam_schedules (id, exam_date, day_name, subject_id, start_time, end_time, session, notes)
VALUES
  ('f0000000-0000-0000-0000-000000000001', CURRENT_DATE + INTERVAL '1 day', 'Senin', 'e0000000-0000-0000-0000-000000000001', '07:30:00', '09:30:00', 'Sesi 1', 'Hari pertama ujian semester'),
  ('f0000000-0000-0000-0000-000000000002', CURRENT_DATE + INTERVAL '1 day', 'Senin', 'e0000000-0000-0000-0000-000000000005', '10:00:00', '11:30:00', 'Sesi 2', 'Ujian sesi siang'),
  ('f0000000-0000-0000-0000-000000000003', CURRENT_DATE + INTERVAL '2 day', 'Selasa', 'e0000000-0000-0000-0000-000000000002', '07:30:00', '09:30:00', 'Sesi 1', 'Ujian Matematika serentak'),
  ('f0000000-0000-0000-0000-000000000004', CURRENT_DATE + INTERVAL '3 day', 'Rabu', 'e0000000-0000-0000-0000-000000000003', '07:30:00', '09:30:00', 'Sesi 1', 'Ujian IPA Teori'),
  ('f0000000-0000-0000-0000-000000000005', CURRENT_DATE + INTERVAL '4 day', 'Kamis', 'e0000000-0000-0000-0000-000000000004', '07:30:00', '09:30:00', 'Sesi 1', 'Ujian Bahasa Inggris')
ON CONFLICT DO NOTHING;

-- Penugasan Pengawas
INSERT INTO public.invigilator_schedules (id, exam_schedule_id, room_id, teacher_id, role, status, notes)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Pengawas 1', 'Dijadwalkan', 'Pengawas Ruang 01'),
  ('10000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Pengawas 1', 'Dijadwalkan', 'Pengawas Ruang 02'),
  ('10000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Pengawas 1', 'Dijadwalkan', 'Pengawas Ruang 01 Sesi 2'),
  ('10000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Pengawas 1', 'Dijadwalkan', 'Pengawas Matematika')
ON CONFLICT DO NOTHING;
`;

export const SUPABASE_RLS_FIX_SQL = `-- ========================================================================
-- PERBAIKAN CEPAT RLS SUPABASE & SINKRONISASI KOLOM PENGATURAN
-- Mengatasi:
-- 1. Error: "Could not find the 'committee_chairman_name' column of 'settings' in the schema cache"
-- 2. Error: "new row violates row-level security policy for table 'teachers'"
-- Jalankan skrip ini di SQL Editor Supabase Anda, lalu klik "RUN"
-- ========================================================================

-- Pastikan kolom-kolom baru pada tabel settings sudah terdaftar:
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS principal_name TEXT DEFAULT 'Drs. H. Mulyono, M.Pd.';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS principal_nip TEXT DEFAULT '19680512 199403 1 005';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS committee_chairman_name TEXT DEFAULT 'Budi Santoso, S.Pd.';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS committee_chairman_nip TEXT DEFAULT '19750814 200003 1 002';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS committee_secretary_name TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS document_city TEXT DEFAULT 'Jakarta';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS document_date DATE;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS honor_per_session INTEGER DEFAULT 40000;

-- 1. Tabel teachers (Guru)
DROP POLICY IF EXISTS "Allow anon select teachers" ON public.teachers;
DROP POLICY IF EXISTS "Allow authenticated read teachers" ON public.teachers;
DROP POLICY IF EXISTS "Allow authenticated manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Allow public all access teachers" ON public.teachers;
CREATE POLICY "Allow public all access teachers" ON public.teachers FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Tabel buildings (Gedung)
DROP POLICY IF EXISTS "Allow anon select buildings" ON public.buildings;
DROP POLICY IF EXISTS "Allow authenticated read buildings" ON public.buildings;
DROP POLICY IF EXISTS "Allow authenticated manage buildings" ON public.buildings;
DROP POLICY IF EXISTS "Allow public all access buildings" ON public.buildings;
CREATE POLICY "Allow public all access buildings" ON public.buildings FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Tabel rooms (Ruangan)
DROP POLICY IF EXISTS "Allow anon select rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow authenticated read rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow authenticated manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow public all access rooms" ON public.rooms;
CREATE POLICY "Allow public all access rooms" ON public.rooms FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. Tabel subjects (Mata Pelajaran)
DROP POLICY IF EXISTS "Allow anon select subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow authenticated read subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow authenticated manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow public all access subjects" ON public.subjects;
CREATE POLICY "Allow public all access subjects" ON public.subjects FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. Tabel exam_schedules (Jadwal Ujian)
DROP POLICY IF EXISTS "Allow anon select exam_schedules" ON public.exam_schedules;
DROP POLICY IF EXISTS "Allow authenticated read exam_schedules" ON public.exam_schedules;
DROP POLICY IF EXISTS "Allow authenticated manage exam_schedules" ON public.exam_schedules;
DROP POLICY IF EXISTS "Allow public all access exam_schedules" ON public.exam_schedules;
CREATE POLICY "Allow public all access exam_schedules" ON public.exam_schedules FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. Tabel invigilator_schedules (Jadwal Pengawas)
DROP POLICY IF EXISTS "Allow anon select invigilator_schedules" ON public.invigilator_schedules;
DROP POLICY IF EXISTS "Allow authenticated read invigilator_schedules" ON public.invigilator_schedules;
DROP POLICY IF EXISTS "Allow authenticated manage invigilator_schedules" ON public.invigilator_schedules;
DROP POLICY IF EXISTS "Allow public all access invigilator_schedules" ON public.invigilator_schedules;
CREATE POLICY "Allow public all access invigilator_schedules" ON public.invigilator_schedules FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Tabel settings (Pengaturan Sekolah)
DROP POLICY IF EXISTS "Allow anon select settings" ON public.settings;
DROP POLICY IF EXISTS "Allow authenticated read settings" ON public.settings;
DROP POLICY IF EXISTS "Allow authenticated manage settings" ON public.settings;
DROP POLICY IF EXISTS "Allow public all access settings" ON public.settings;
CREATE POLICY "Allow public all access settings" ON public.settings FOR ALL TO public USING (true) WITH CHECK (true);

-- 8. Tabel profiles (Profil Pengguna)
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public all access profiles" ON public.profiles;
CREATE POLICY "Allow public all access profiles" ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);
`;

export const SUPABASE_DISABLE_RLS_SQL = `-- Alternatif: Nonaktifkan Row Level Security jika Anda tidak memerlukan pembatasan akses
ALTER TABLE public.teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invigilator_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
`;
