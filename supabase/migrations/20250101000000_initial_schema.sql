-- ==============================================================================
-- SIM-PENGAWAS UJIAN - SMP BHINNEKA TUNGGAL IKA
-- Supabase Database Schema Migration
-- Standard PostgreSQL with UUIDs, Foreign Keys, Indexes, Triggers, and RLS
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. HELPER FUNCTION FOR UPDATED_AT
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. PROFILES TABLE (Supabase Auth Integration)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('ADMIN', 'VIEWER')),
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Pengguna Baru'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'VIEWER')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to check if current user is ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. TEACHERS (DATA GURU)
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nip TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT CHECK (gender IN ('L', 'P')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_proctor_duty INTEGER NOT NULL DEFAULT 5 CHECK (max_proctor_duty >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BUILDINGS (GEDUNG)
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  floor_count INTEGER NOT NULL DEFAULT 1 CHECK (floor_count > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ROOMS (RUANG)
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 30 CHECK (capacity > 0),
  proctor_quota INTEGER NOT NULL DEFAULT 1 CHECK (proctor_quota > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SUBJECTS (MATA PELAJARAN)
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 90 CHECK (duration_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. SESSIONS (SESI UJIAN)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_session_time CHECK (start_time < end_time)
);

-- 9. EXAMS (DATA UJIAN)
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL,
  semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
  exam_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_exam_date CHECK (start_date <= end_date)
);

-- 10. EXAM SCHEDULES (JADWAL UJIAN PER RUANG DAN SESI)
CREATE TABLE IF NOT EXISTS public.exam_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  exam_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_room_session_date UNIQUE (room_id, session_id, exam_date)
);

-- 11. TEACHER AVAILABILITY (KETERSEDIAAN GURU)
CREATE TABLE IF NOT EXISTS public.teacher_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_teacher_date_session UNIQUE (teacher_id, exam_date, session_id)
);

-- 12. PROCTOR SCHEDULES (JADWAL PENGAWAS)
CREATE TABLE IF NOT EXISTS public.proctor_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_schedule_id UUID NOT NULL REFERENCES public.exam_schedules(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'PENGAWAS_1' CHECK (role IN ('PENGAWAS_1', 'PENGAWAS_2', 'CADANGAN')),
  status TEXT NOT NULL DEFAULT 'DITUGASKAN' CHECK (status IN ('DITUGASKAN', 'HADIR', 'DIGANTIKAN', 'TIDAK_HADIR')),
  substitute_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. CONFLICTS (LOG VALIDASI KONFLIK JADWAL)
CREATE TABLE IF NOT EXISTS public.conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_schedule_id UUID REFERENCES public.exam_schedules(id) ON DELETE CASCADE,
  proctor_schedule_id UUID REFERENCES public.proctor_schedules(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('DOUBLE_BOOKING', 'UNAVAILABLE_TEACHER', 'OVER_QUOTA', 'ROOM_DOUBLE_BOOKING', 'MISSING_PROCTOR')),
  severity TEXT NOT NULL DEFAULT 'WARNING' CHECK (severity IN ('WARNING', 'ERROR')),
  description TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_teachers_nip ON public.teachers(nip);
CREATE INDEX IF NOT EXISTS idx_teachers_name ON public.teachers(name);
CREATE INDEX IF NOT EXISTS idx_rooms_building ON public.rooms(building_id);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_subjects_code ON public.subjects(code);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_exam ON public.exam_schedules(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_date ON public.exam_schedules(exam_date);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_room_session ON public.exam_schedules(room_id, session_id, exam_date);
CREATE INDEX IF NOT EXISTS idx_teacher_availability_lookup ON public.teacher_availability(teacher_id, exam_date, session_id);
CREATE INDEX IF NOT EXISTS idx_proctor_schedules_lookup ON public.proctor_schedules(exam_schedule_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_proctor_schedules_teacher ON public.proctor_schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON public.conflicts(is_resolved) WHERE is_resolved = FALSE;

-- ==============================================================================
-- UPDATED_AT TRIGGERS
-- ==============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'teachers', 'buildings', 'rooms', 'subjects',
    'sessions', 'exams', 'exam_schedules', 'teacher_availability',
    'proctor_schedules', 'conflicts'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t, t);
  END LOOP;
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin());

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'teachers', 'buildings', 'rooms', 'subjects',
    'sessions', 'exams', 'exam_schedules', 'teacher_availability',
    'proctor_schedules', 'conflicts'
  ]
  LOOP
    EXECUTE format('CREATE POLICY "Allow select for authenticated users on %I" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Allow insert for admin on %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t, t);
    EXECUTE format('CREATE POLICY "Allow update for admin on %I" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);
    EXECUTE format('CREATE POLICY "Allow delete for admin on %I" ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', t, t);
  END LOOP;
END;
$$;
