-- ========================================================================
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
  grade_level INT,
  grade_levels TEXT[] DEFAULT ARRAY['7', '8', '9']::TEXT[],
  default_duration INT DEFAULT 90 NOT NULL,
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
  day_name TEXT NOT NULL,
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
  school_address TEXT NOT NULL DEFAULT 'Jl. Raya Pendidikan No. 01',
  school_logo TEXT,
  exam_name TEXT NOT NULL DEFAULT 'ASESMEN SUMATIF / UJIAN SEKOLAH',
  academic_year TEXT NOT NULL DEFAULT '2026/2027',
  semester TEXT NOT NULL DEFAULT 'Ganjil',
  principal_name TEXT DEFAULT 'Drs. Moh. Mas''ud, S.Pd, M.Pd',
  principal_nip TEXT DEFAULT 'P - 01',
  committee_chairman_name TEXT DEFAULT 'Muhammad Ainul Yaqin, M.Pd.I',
  committee_chairman_nip TEXT DEFAULT 'P - 02',
  committee_secretary_name TEXT DEFAULT 'Mochammad Amiruddin, S.Pd.I',
  document_city TEXT DEFAULT 'Jombang',
  document_date DATE DEFAULT '2026-10-10',
  honor_per_session INTEGER DEFAULT 50000,
  default_invigilators_per_room INTEGER NOT NULL DEFAULT 1,
  default_start_time TIME DEFAULT '07:30:00' NOT NULL,
  default_duration INTEGER DEFAULT 60 NOT NULL,
  break_duration INTEGER DEFAULT 30 NOT NULL,
  app_name TEXT DEFAULT 'Sistem Manajemen Ujian & Pengawas Ruang' NOT NULL,
  theme TEXT DEFAULT 'blue' NOT NULL,
  date_format TEXT DEFAULT 'DD/MM/YYYY' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Migrasi jika tabel settings sudah ada di Supabase
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS principal_name TEXT DEFAULT 'Drs. Moh. Mas''ud, S.Pd, M.Pd';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS principal_nip TEXT DEFAULT 'P - 01';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS committee_chairman_name TEXT DEFAULT 'Muhammad Ainul Yaqin, M.Pd.I';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS committee_chairman_nip TEXT DEFAULT 'P - 02';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS committee_secretary_name TEXT DEFAULT 'Mochammad Amiruddin, S.Pd.I';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS document_city TEXT DEFAULT 'Jombang';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS document_date DATE DEFAULT '2026-10-10';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS honor_per_session INTEGER DEFAULT 50000;

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

-- Hak Akses Penuh untuk anon & authenticated
CREATE POLICY "Allow public all access profiles" ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access teachers" ON public.teachers FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access buildings" ON public.buildings FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access rooms" ON public.rooms FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access subjects" ON public.subjects FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access exam_schedules" ON public.exam_schedules FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access invigilator_schedules" ON public.invigilator_schedules FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access settings" ON public.settings FOR ALL TO public USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------
-- TRIGGER: Otomatis Tambah profiles ketika User Daftar di auth.users
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
INSERT INTO public.settings (
  id,
  school_name,
  school_address,
  exam_name,
  academic_year,
  semester,
  principal_name,
  principal_nip,
  committee_chairman_name,
  committee_chairman_nip,
  committee_secretary_name,
  document_city,
  document_date,
  default_invigilators_per_room,
  default_start_time,
  default_duration,
  break_duration,
  honor_per_session
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'SMP BHINNEKA TUNGGAL IKA',
  'Jl. Raya Pendidikan No. 01',
  'ASESMEN SUMATIF / UJIAN SEKOLAH',
  '2026/2027',
  'Ganjil',
  'Drs. Moh. Mas''ud, S.Pd, M.Pd',
  'P - 01',
  'Muhammad Ainul Yaqin, M.Pd.I',
  'P - 02',
  'Mochammad Amiruddin, S.Pd.I',
  'Jombang',
  '2026-10-10',
  1,
  '07:30:00',
  60,
  30,
  50000
) ON CONFLICT (id) DO UPDATE SET
  school_name = EXCLUDED.school_name,
  school_address = EXCLUDED.school_address,
  exam_name = EXCLUDED.exam_name,
  academic_year = EXCLUDED.academic_year,
  semester = EXCLUDED.semester,
  principal_name = EXCLUDED.principal_name,
  principal_nip = EXCLUDED.principal_nip,
  committee_chairman_name = EXCLUDED.committee_chairman_name,
  committee_chairman_nip = EXCLUDED.committee_chairman_nip,
  committee_secretary_name = EXCLUDED.committee_secretary_name,
  document_city = EXCLUDED.document_city,
  document_date = EXCLUDED.document_date,
  default_invigilators_per_room = EXCLUDED.default_invigilators_per_room,
  honor_per_session = EXCLUDED.honor_per_session;
