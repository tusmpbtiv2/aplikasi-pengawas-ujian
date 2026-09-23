import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Teacher,
  Building,
  Room,
  Subject,
  ExamSchedule,
  InvigilatorSchedule,
  Settings,
  ConflictDetail,
  AppUser,
  ExamProject,
} from '../types/database';
import { isPanitiaTeacher } from '../lib/invigilatorHelper';
import { INITIAL_PROJECTS } from '../data/initialData';

// LocalStorage Keys for persistent offline / Netlify storage
const STORAGE_KEYS = {
  TEACHERS: 'sim_teachers_data_v2',
  BUILDINGS: 'sim_buildings_data_v2',
  ROOMS: 'sim_rooms_data_v2',
  SUBJECTS: 'sim_subjects_data_v2',
  EXAM_SCHEDULES: 'sim_exam_schedules_data_v2',
  INVIGILATOR_SCHEDULES: 'sim_invigilator_schedules_data_v2',
  SETTINGS: 'sim_settings_data_v2',
  USERS: 'sim_users_data_v2',
  PROJECTS: 'sim_projects_data_v2',
  ACTIVE_PROJECT: 'sim_active_project_id_v2',
  DELETED_PROJECTS: 'sim_deleted_project_ids_v2',
};

function getStoredWithMigration<T>(primaryKey: string, legacyKeys: string[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = localStorage.getItem(primaryKey);
    if (val) {
      const parsed = JSON.parse(val);
      if (parsed !== null && parsed !== undefined) return parsed;
    }
    // Check legacy / previous version keys to restore user data from earlier sessions
    for (const legKey of legacyKeys) {
      const legVal = localStorage.getItem(legKey);
      if (legVal) {
        try {
          const parsed = JSON.parse(legVal);
          if (parsed !== null && parsed !== undefined) {
            localStorage.setItem(primaryKey, legVal);
            return parsed;
          }
        } catch {
          // continue checking other legacy keys
        }
      }
    }
  } catch (e) {
    console.warn(`Failed reading storage key (${primaryKey}):`, e);
  }
  return fallback;
}

function getStored<T>(key: string, fallback: T): T {
  return getStoredWithMigration(key, [], fallback);
}

function setStored<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn(`Failed to save to localStorage (${key}):`, e);
  }
}

// Initial default seed data for immediate demonstration and offline fallback
const INITIAL_SETTINGS: Settings = {
  id: 'a0000000-0000-0000-0000-000000000001',
  school_name: 'SMP BHINNEKA TUNGGAL IKA',
  school_address: 'Jl. Pendidikan No. 45, Jakarta',
  school_logo: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=128&auto=format&fit=crop&q=80',
  exam_name: 'Penilaian Akhir Semester (PAS) Genap',
  academic_year: '2024/2025',
  semester: 'Genap',
  default_invigilators_per_room: 2,
  default_start_time: '07:30',
  default_duration: 90,
  break_duration: 30,
  honor_per_session: 40000,
  theme: 'blue',
  date_format: 'DD/MM/YYYY',
  app_name: 'Sistem Manajemen Ujian Sekolah',
  principal_name: 'Drs. H. Mulyono, M.Pd.',
  principal_nip: '19680512 199403 1 005',
  committee_chairman_name: 'Budi Santoso, S.Pd.',
  committee_chairman_nip: '19750814 200003 1 002',
  document_city: 'Jakarta',
};

const INITIAL_USERS: AppUser[] = [
  {
    id: 'u-admin-1',
    email: 'admin@smpbhinneka.sch.id',
    full_name: 'Administrator Ujian Utama',
    role: 'ADMIN',
    active: true,
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    id: 'u-panitia-1',
    email: 'panitia@smpbhinneka.sch.id',
    full_name: 'Drs. H. Ahmad Sudrajat, M.Pd.',
    role: 'PANITIA',
    active: true,
    created_at: '2026-09-05T09:00:00Z',
  },
  {
    id: 'u-panitia-2',
    email: 'sekretaris@smpbhinneka.sch.id',
    full_name: 'Siti Rahmawati, S.Pd.',
    role: 'PANITIA',
    active: true,
    created_at: '2026-09-06T09:30:00Z',
  },
  {
    id: 'u-viewer-1',
    email: 'monitoring@smpbhinneka.sch.id',
    full_name: 'Pengawas Pembina / Viewer',
    role: 'VIEWER',
    active: true,
    created_at: '2026-09-10T10:00:00Z',
  },
];

const INITIAL_BUILDINGS: Building[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Gedung Utama A',
    code: 'GDA',
    address: 'Lantai 1-2 Sayap Barat',
    notes: 'Gedung ruang kelas VII dan VIII',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Gedung Timur B',
    code: 'GDB',
    address: 'Lantai 1-2 Sayap Timur',
    notes: 'Gedung ruang kelas IX dan Lab Komputer',
  },
];

const INITIAL_ROOMS: Room[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    building_id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Ruang 01 (Kelas VII-A)',
    code: 'R-01',
    capacity: 32,
    active: true,
    notes: 'Dilengkapi pendingin ruangan',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    building_id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Ruang 02 (Kelas VII-B)',
    code: 'R-02',
    capacity: 32,
    active: true,
    notes: 'Kapasitas 32 siswa',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    building_id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Ruang 03 (Kelas VIII-A)',
    code: 'R-03',
    capacity: 30,
    active: true,
    notes: 'Lantai 2 Gedung A',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000004',
    building_id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Ruang 04 (Kelas IX-A)',
    code: 'R-04',
    capacity: 30,
    active: true,
    notes: 'Gedung B Lantai 1',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000005',
    building_id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Ruang 05 (Lab Komputer)',
    code: 'R-05',
    capacity: 36,
    active: true,
    notes: 'Ujian berbasis komputer',
  },
];

const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    name: 'Drs. H. Ahmad Sudrajat, M.Pd.',
    gender: 'Laki-laki',
    employee_number: '197503152000031002',
    invigilator_code: 'P01',
    active: true,
    available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Minggu'],
    notes: 'Koordinator Pengawas Ujian',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    name: 'Siti Rahmawati, S.Pd.',
    gender: 'Perempuan',
    employee_number: '198207122008012015',
    invigilator_code: 'P02',
    active: true,
    available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis'],
    notes: 'Guru Bahasa Indonesia',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    name: 'Budi Santoso, M.Si.',
    gender: 'Laki-laki',
    employee_number: '198511242010011009',
    invigilator_code: 'P03',
    active: true,
    available_days: ['Senin', 'Rabu', 'Kamis', 'Jumat', 'Minggu'],
    notes: 'Guru IPA Terpadu',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    name: 'Nurul Hidayah, S.Pd.',
    gender: 'Perempuan',
    employee_number: '199004182014022008',
    invigilator_code: 'P04',
    active: true,
    available_days: ['Senin', 'Selasa', 'Kamis', 'Jumat'],
    notes: 'Guru Bahasa Inggris',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000005',
    name: 'Eko Prasetyo, S.Pd.',
    gender: 'Laki-laki',
    employee_number: '198809052012011011',
    invigilator_code: 'P05',
    active: true,
    available_days: ['Senin', 'Selasa', 'Rabu', 'Jumat'],
    notes: 'Guru PPKn',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000006',
    name: 'Dewi Lestari, S.Pd.',
    gender: 'Perempuan',
    employee_number: '199301202019032014',
    invigilator_code: 'P06',
    active: true,
    available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Minggu'],
    notes: 'Guru Seni Budaya',
  },
];

const INITIAL_SUBJECTS: Subject[] = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    name: 'Bahasa Indonesia',
    code: 'BIN-01',
    grade_level: 7,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Mata pelajaran wajib nasional',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000002',
    name: 'Matematika',
    code: 'MTK-02',
    grade_level: 7,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Kalkulator tidak diperkenankan',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000003',
    name: 'Ilmu Pengetahuan Alam (IPA)',
    code: 'IPA-03',
    grade_level: 8,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Teori Biologi dan Fisika',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000004',
    name: 'Bahasa Inggris',
    code: 'BIG-04',
    grade_level: 9,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Termasuk lembar listening/reading',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000005',
    name: 'Pendidikan Pancasila & Kewarganegaraan (PPKn)',
    code: 'PPK-05',
    grade_level: 7,
    grade_levels: ['7', '8'],
    active: true,
    notes: 'Kurikulum Merdeka',
  },
];

// Helper to format date offset
const getDateString = (daysOffset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};

const INITIAL_EXAM_SCHEDULES: ExamSchedule[] = [
  {
    id: 'f0000000-0000-0000-0000-000000000001',
    exam_date: getDateString(1),
    day_name: 'Senin',
    subject_id: 'e0000000-0000-0000-0000-000000000001',
    start_time: '07:30:00',
    end_time: '09:30:00',
    session: 'Sesi 1',
    notes: 'Hari pertama ujian semester',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000002',
    exam_date: getDateString(1),
    day_name: 'Senin',
    subject_id: 'e0000000-0000-0000-0000-000000000005',
    start_time: '10:00:00',
    end_time: '11:30:00',
    session: 'Sesi 2',
    notes: 'Sesi siang PPKn',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000003',
    exam_date: getDateString(2),
    day_name: 'Selasa',
    subject_id: 'e0000000-0000-0000-0000-000000000002',
    start_time: '07:30:00',
    end_time: '09:30:00',
    session: 'Sesi 1',
    notes: 'Matematika',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000004',
    exam_date: getDateString(3),
    day_name: 'Rabu',
    subject_id: 'e0000000-0000-0000-0000-000000000003',
    start_time: '07:30:00',
    end_time: '09:30:00',
    session: 'Sesi 1',
    notes: 'IPA Terpadu',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000005',
    exam_date: getDateString(4),
    day_name: 'Kamis',
    subject_id: 'e0000000-0000-0000-0000-000000000004',
    start_time: '07:30:00',
    end_time: '09:30:00',
    session: 'Sesi 1',
    notes: 'Bahasa Inggris',
  },
];

const INITIAL_INVIGILATOR_SCHEDULES: InvigilatorSchedule[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    exam_schedule_id: 'f0000000-0000-0000-0000-000000000001',
    room_id: 'c0000000-0000-0000-0000-000000000001',
    teacher_id: 'd0000000-0000-0000-0000-000000000001',
    role: 'Pengawas 1',
    status: 'Dijadwalkan',
    notes: 'Pengawas Ruang 01',
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    exam_schedule_id: 'f0000000-0000-0000-0000-000000000001',
    room_id: 'c0000000-0000-0000-0000-000000000002',
    teacher_id: 'd0000000-0000-0000-0000-000000000002',
    role: 'Pengawas 1',
    status: 'Dijadwalkan',
    notes: 'Pengawas Ruang 02',
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    exam_schedule_id: 'f0000000-0000-0000-0000-000000000002',
    room_id: 'c0000000-0000-0000-0000-000000000001',
    teacher_id: 'd0000000-0000-0000-0000-000000000003',
    role: 'Pengawas 1',
    status: 'Dijadwalkan',
    notes: 'Pengawas Ruang 01 Sesi 2',
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    exam_schedule_id: 'f0000000-0000-0000-0000-000000000003',
    room_id: 'c0000000-0000-0000-0000-000000000001',
    teacher_id: 'd0000000-0000-0000-0000-000000000004',
    role: 'Pengawas 1',
    status: 'Dijadwalkan',
    notes: 'Pengawas Matematika',
  },
];

interface DataContextType {
  loading: boolean;
  error: string | null;
  teachers: Teacher[];
  buildings: Building[];
  rooms: Room[];
  subjects: Subject[];
  examSchedules: ExamSchedule[];
  invigilatorSchedules: InvigilatorSchedule[];
  settings: Settings;
  conflicts: ConflictDetail[];

  // Projects / Kegiatan Ujian Multi-Event
  projects: ExamProject[];
  activeProjectId: string;
  activeProject: ExamProject | undefined;
  switchProject: (projectId: string) => Promise<boolean>;
  createProject: (params: {
    name: string;
    academic_year: string;
    semester: string;
    exam_name: string;
    duplicateCurrentSchedule?: boolean;
    description?: string;
  }) => Promise<{ success: boolean; id?: string }>;
  updateProject: (id: string, updates: Partial<ExamProject>) => Promise<{ success: boolean }>;
  deleteProject: (id: string) => Promise<{ success: boolean; error?: string }>;
  syncLocalToSupabase: () => Promise<{ success: boolean; message: string }>;
  
  // Stats
  emptyScheduleSlotsCount: number;
  scheduledInvigilatorsCount: number;

  refreshAll: () => Promise<void>;

  // Teachers CRUD
  addTeacher: (teacher: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; error?: string }>;
  addTeachersBatch: (teachers: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>[]) => Promise<{ success: boolean; count: number; error?: string }>;
  updateTeacher: (id: string, updates: Partial<Teacher>) => Promise<{ success: boolean; error?: string }>;
  deleteTeacher: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Buildings CRUD
  addBuilding: (building: Omit<Building, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; error?: string }>;
  addBuildingsBatch: (buildings: Omit<Building, 'id' | 'created_at' | 'updated_at'>[]) => Promise<{ success: boolean; count: number; error?: string }>;
  updateBuilding: (id: string, updates: Partial<Building>) => Promise<{ success: boolean; error?: string }>;
  deleteBuilding: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Rooms CRUD
  addRoom: (room: Omit<Room, 'id' | 'created_at' | 'updated_at' | 'building'>) => Promise<{ success: boolean; error?: string }>;
  addRoomsBatch: (rooms: Omit<Room, 'id' | 'created_at' | 'updated_at' | 'building'>[]) => Promise<{ success: boolean; count: number; error?: string }>;
  updateRoom: (id: string, updates: Partial<Room>) => Promise<{ success: boolean; error?: string }>;
  deleteRoom: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Subjects CRUD
  addSubject: (subject: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; error?: string }>;
  addSubjectsBatch: (subjects: Omit<Subject, 'id' | 'created_at' | 'updated_at'>[]) => Promise<{ success: boolean; count: number; error?: string }>;
  updateSubject: (id: string, updates: Partial<Subject>) => Promise<{ success: boolean; error?: string }>;
  deleteSubject: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Exam Schedules CRUD
  addExamSchedule: (schedule: Omit<ExamSchedule, 'id' | 'created_at' | 'updated_at' | 'subject'>) => Promise<{ success: boolean; error?: string }>;
  addExamSchedulesBatch: (schedules: Omit<ExamSchedule, 'id' | 'created_at' | 'updated_at' | 'subject'>[]) => Promise<{ success: boolean; count: number; error?: string }>;
  updateExamSchedule: (id: string, updates: Partial<ExamSchedule>) => Promise<{ success: boolean; error?: string }>;
  deleteExamSchedule: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Invigilator Schedules CRUD
  addInvigilatorSchedule: (inv: Omit<InvigilatorSchedule, 'id' | 'created_at' | 'updated_at' | 'exam_schedule' | 'room' | 'teacher'>) => Promise<{ success: boolean; error?: string }>;
  addInvigilatorSchedulesBatch: (
    items: Omit<InvigilatorSchedule, 'id' | 'created_at' | 'updated_at' | 'exam_schedule' | 'room' | 'teacher'>[],
    options?: { overwriteExisting?: boolean; examScheduleIds?: string[]; roomIds?: string[] }
  ) => Promise<{ success: boolean; count: number; error?: string }>;
  clearInvigilatorSchedules: (examScheduleIds?: string[], roomIds?: string[]) => Promise<{ success: boolean; count: number; error?: string }>;
  quickUpdateInvigilatorStatus: (id: string, newStatus: 'Dijadwalkan' | 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha') => Promise<{ success: boolean; error?: string }>;
  quickReplaceInvigilator: (id: string, newTeacherId: string | null, oldStatus?: 'Dijadwalkan' | 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha') => Promise<{ success: boolean; error?: string }>;
  quickConfirmAttendance: (id: string, status: 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha', actualTime?: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
  quickSubstituteInvigilator: (scheduleId: string, substituteTeacherId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  batchConfirmAttendance: (updates: { id: string; status: 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha'; actualTime?: string; notes?: string }[]) => Promise<{ success: boolean; error?: string }>;
  updateInvigilatorSchedule: (id: string, updates: Partial<InvigilatorSchedule>) => Promise<{ success: boolean; error?: string }>;
  deleteInvigilatorSchedule: (id: string) => Promise<{ success: boolean; error?: string }>;
  seedDemo45RoomsAndTeachers: () => Promise<{ success: boolean; message: string }>;

  // Users & Roles
  users: AppUser[];
  addUser: (user: Omit<AppUser, 'id' | 'created_at'>) => Promise<{ success: boolean; error?: string }>;
  updateUser: (id: string, updates: Partial<AppUser>) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Settings, Backup & Reset
  updateSettings: (updates: Partial<Settings>) => Promise<{ success: boolean; error?: string }>;
  backupData: () => any;
  resetData: (mode: 'INVIGILATORS_ONLY' | 'EXAMS_AND_INVIGILATORS' | 'RESET_TO_DEFAULT' | 'ALL_DATA') => Promise<{ success: boolean; message: string }>;

  // Persistent Server Storage & Sync Status
  isServerSynced: boolean;
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';
  forceSaveToServer: () => Promise<boolean>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deletedProjectIds, setDeletedProjectIds] = useState<string[]>(() =>
    getStoredWithMigration<string[]>(
      STORAGE_KEYS.DELETED_PROJECTS,
      ['sim_deleted_projects'],
      ['proj-pas-genap-2025', 'proj-asaj-2025']
    )
  );

  const [projects, setProjects] = useState<ExamProject[]>(() => {
    const deleted = getStoredWithMigration<string[]>(
      STORAGE_KEYS.DELETED_PROJECTS,
      ['sim_deleted_projects'],
      ['proj-pas-genap-2025', 'proj-asaj-2025']
    );
    const stored = getStoredWithMigration<ExamProject[]>(
      STORAGE_KEYS.PROJECTS,
      ['sim_projects_data', 'sim_projects', 'sim_projects_v1'],
      []
    );
    if (stored && stored.length > 0) {
      const valid = stored.filter((p) => !deleted.includes(p.id));
      if (valid.length > 0) return valid;
    }
    return [
      {
        id: 'proj-real-sumatif-2026',
        name: 'Asesmen Sumatif / Ujian Sekolah 2026/2027',
        exam_name: 'ASESMEN SUMATIF / UJIAN SEKOLAH',
        academic_year: '2026/2027',
        semester: 'Ganjil',
        created_at: new Date().toISOString(),
        is_active: true,
        exam_schedules: [],
        invigilator_schedules: [],
      },
    ];
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const deleted = getStoredWithMigration<string[]>(
      STORAGE_KEYS.DELETED_PROJECTS,
      ['sim_deleted_projects'],
      ['proj-pas-genap-2025', 'proj-asaj-2025']
    );
    const storedActive = getStoredWithMigration<string>(
      STORAGE_KEYS.ACTIVE_PROJECT,
      ['sim_active_project_id', 'sim_active_project'],
      ''
    );
    if (storedActive && !deleted.includes(storedActive)) {
      return storedActive;
    }
    const storedProjects = getStoredWithMigration<ExamProject[]>(
      STORAGE_KEYS.PROJECTS,
      ['sim_projects_data', 'sim_projects'],
      []
    );
    const valid = storedProjects.filter((p) => !deleted.includes(p.id));
    if (valid.length > 0) return valid[0].id;
    return 'proj-real-sumatif-2026';
  });

  const [teachers, setTeachers] = useState<Teacher[]>(() =>
    getStoredWithMigration<Teacher[]>(STORAGE_KEYS.TEACHERS, ['sim_teachers_data', 'sim_teachers'], INITIAL_TEACHERS)
  );
  const [buildings, setBuildings] = useState<Building[]>(() =>
    getStoredWithMigration<Building[]>(STORAGE_KEYS.BUILDINGS, ['sim_buildings_data', 'sim_buildings'], INITIAL_BUILDINGS)
  );
  const [rooms, setRooms] = useState<Room[]>(() =>
    getStoredWithMigration<Room[]>(STORAGE_KEYS.ROOMS, ['sim_rooms_data', 'sim_rooms'], INITIAL_ROOMS)
  );
  const [subjects, setSubjects] = useState<Subject[]>(() =>
    getStoredWithMigration<Subject[]>(STORAGE_KEYS.SUBJECTS, ['sim_subjects_data', 'sim_subjects'], INITIAL_SUBJECTS)
  );

  const [examSchedules, setExamSchedules] = useState<ExamSchedule[]>(() => {
    const storedProjects = getStoredWithMigration<ExamProject[]>(
      STORAGE_KEYS.PROJECTS,
      ['sim_projects_data', 'sim_projects'],
      []
    );
    const storedActiveId = getStoredWithMigration<string>(
      STORAGE_KEYS.ACTIVE_PROJECT,
      ['sim_active_project_id'],
      ''
    );
    const proj = storedProjects?.find((p) => p.id === storedActiveId) || storedProjects?.[0];
    if (proj && Array.isArray(proj.exam_schedules) && proj.exam_schedules.length > 0) {
      return proj.exam_schedules;
    }
    return getStoredWithMigration<ExamSchedule[]>(
      STORAGE_KEYS.EXAM_SCHEDULES,
      ['sim_exam_schedules_data', 'sim_exam_schedules'],
      INITIAL_EXAM_SCHEDULES
    );
  });

  const [invigilatorSchedules, setInvigilatorSchedules] = useState<InvigilatorSchedule[]>(() => {
    const storedProjects = getStoredWithMigration<ExamProject[]>(
      STORAGE_KEYS.PROJECTS,
      ['sim_projects_data', 'sim_projects'],
      []
    );
    const storedActiveId = getStoredWithMigration<string>(
      STORAGE_KEYS.ACTIVE_PROJECT,
      ['sim_active_project_id'],
      ''
    );
    const proj = storedProjects?.find((p) => p.id === storedActiveId) || storedProjects?.[0];
    if (proj && Array.isArray(proj.invigilator_schedules) && proj.invigilator_schedules.length > 0) {
      return proj.invigilator_schedules;
    }
    return getStoredWithMigration<InvigilatorSchedule[]>(
      STORAGE_KEYS.INVIGILATOR_SCHEDULES,
      ['sim_invigilator_schedules_data', 'sim_invigilator_schedules'],
      INITIAL_INVIGILATOR_SCHEDULES
    );
  });

  const [settings, setSettings] = useState<Settings>(() =>
    getStoredWithMigration<Settings>(STORAGE_KEYS.SETTINGS, ['sim_settings_data', 'sim_settings'], INITIAL_SETTINGS)
  );
  const [users, setUsers] = useState<AppUser[]>(() =>
    getStoredWithMigration<AppUser[]>(STORAGE_KEYS.USERS, ['sim_users_data', 'sim_users'], INITIAL_USERS)
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Server persistence state
  const [isServerSynced, setIsServerSynced] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Synchronize state changes to localStorage
  useEffect(() => { setStored(STORAGE_KEYS.TEACHERS, teachers); }, [teachers]);
  useEffect(() => { setStored(STORAGE_KEYS.BUILDINGS, buildings); }, [buildings]);
  useEffect(() => { setStored(STORAGE_KEYS.ROOMS, rooms); }, [rooms]);
  useEffect(() => { setStored(STORAGE_KEYS.SUBJECTS, subjects); }, [subjects]);
  useEffect(() => { setStored(STORAGE_KEYS.EXAM_SCHEDULES, examSchedules); }, [examSchedules]);
  useEffect(() => { setStored(STORAGE_KEYS.INVIGILATOR_SCHEDULES, invigilatorSchedules); }, [invigilatorSchedules]);
  useEffect(() => { setStored(STORAGE_KEYS.SETTINGS, settings); }, [settings]);
  useEffect(() => { setStored(STORAGE_KEYS.USERS, users); }, [users]);
  useEffect(() => { setStored(STORAGE_KEYS.PROJECTS, projects); }, [projects]);
  useEffect(() => { setStored(STORAGE_KEYS.ACTIVE_PROJECT, activeProjectId); }, [activeProjectId]);
  useEffect(() => { setStored(STORAGE_KEYS.DELETED_PROJECTS, deletedProjectIds); }, [deletedProjectIds]);

  // Keep active project schedules synchronized in projects array
  useEffect(() => {
    if (!activeProjectId) return;
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === activeProjectId);
      if (idx === -1) return prev;
      const current = prev[idx];
      if (current.exam_schedules === examSchedules && current.invigilator_schedules === invigilatorSchedules) {
        return prev;
      }
      const updated = [...prev];
      updated[idx] = {
        ...current,
        exam_schedules: examSchedules,
        invigilator_schedules: invigilatorSchedules,
        updated_at: new Date().toISOString(),
      };
      return updated;
    });
  }, [examSchedules, invigilatorSchedules, activeProjectId]);

  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0];
  }, [projects, activeProjectId]);

  // Fetch all data from Supabase
  const refreshAll = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;

    setLoading(true);
    setError(null);

    try {
      const [
        teachersRes,
        buildingsRes,
        roomsRes,
        subjectsRes,
        examSchedulesRes,
        invigilatorRes,
        settingsRes,
      ] = await Promise.all([
        supabase.from('teachers').select('*').order('name'),
        supabase.from('buildings').select('*').order('name'),
        supabase.from('rooms').select('*, building:buildings(*)').order('code'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('exam_schedules').select('*, subject:subjects(*)').order('exam_date').order('start_time'),
        supabase.from('invigilator_schedules').select('*, exam_schedule:exam_schedules(*, subject:subjects(*)), room:rooms(*), teacher:teachers!invigilator_schedules_teacher_id_fkey(*)'),
        supabase.from('settings').select('*').limit(1).maybeSingle(),
      ]);

      if (teachersRes.data && teachersRes.data.length > 0) setTeachers(teachersRes.data);
      if (buildingsRes.data && buildingsRes.data.length > 0) setBuildings(buildingsRes.data);
      if (roomsRes.data && roomsRes.data.length > 0) setRooms(roomsRes.data);
      if (subjectsRes.data && subjectsRes.data.length > 0) setSubjects(subjectsRes.data);
      if (examSchedulesRes.data && examSchedulesRes.data.length > 0) setExamSchedules(examSchedulesRes.data);
      if (invigilatorRes.data && invigilatorRes.data.length > 0) setInvigilatorSchedules(invigilatorRes.data);
      if (settingsRes.data) setSettings(settingsRes.data);

      // Keep projects synchronized with real Supabase schedules
      if (examSchedulesRes.data && examSchedulesRes.data.length > 0) {
        setProjects((prev) => {
          const currentId = activeProjectId || prev[0]?.id || 'proj-real-sumatif-2026';
          const existingIdx = prev.findIndex((p) => p.id === currentId);
          if (existingIdx !== -1) {
            const copy = [...prev];
            copy[existingIdx] = {
              ...copy[existingIdx],
              exam_schedules: examSchedulesRes.data || [],
              invigilator_schedules: invigilatorRes.data || [],
              updated_at: new Date().toISOString(),
            };
            return copy;
          } else {
            return [
              {
                id: currentId,
                name: 'Asesmen Sumatif / Ujian Sekolah 2026/2027',
                exam_name: 'ASESMEN SUMATIF / UJIAN SEKOLAH',
                academic_year: '2026/2027',
                semester: 'Ganjil',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_active: true,
                exam_schedules: examSchedulesRes.data || [],
                invigilator_schedules: invigilatorRes.data || [],
              },
            ];
          }
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengambil data dari Supabase';
      console.warn('Supabase fetch error, fallback to memory state:', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Save current application state to persistent server API (/api/data)
  const saveToServer = useCallback(
    async (overrides?: Record<string, any>): Promise<boolean> => {
      try {
        setSyncStatus('saving');
        const payload = {
          projects,
          activeProjectId,
          deletedProjectIds,
          examSchedules,
          invigilatorSchedules,
          settings,
          teachers,
          buildings,
          rooms,
          subjects,
          users,
          clientTimestamp: new Date().toISOString(),
          ...overrides,
        };
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setSyncStatus('saved');
          setIsServerSynced(true);
          return true;
        } else {
          setSyncStatus('error');
          return false;
        }
      } catch (err) {
        console.warn('[DataContext] Save to server error:', err);
        setSyncStatus('error');
        return false;
      }
    },
    [
      projects,
      activeProjectId,
      deletedProjectIds,
      examSchedules,
      invigilatorSchedules,
      settings,
      teachers,
      buildings,
      rooms,
      subjects,
      users,
    ]
  );

  const forceSaveToServer = useCallback(async () => {
    return await saveToServer();
  }, [saveToServer]);

  // Load and hydrate from persistent server API on mount
  useEffect(() => {
    let isMounted = true;
    async function loadServerData() {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) return;
        const result = await res.json();
        if (!isMounted) return;

        if (result.initialized && result.data) {
          const s = result.data;
          const serverDeleted: string[] = Array.isArray(s.deletedProjectIds) ? s.deletedProjectIds : [];
          if (serverDeleted.length > 0) {
            setDeletedProjectIds((prev) => Array.from(new Set([...prev, ...serverDeleted])));
          }

          if (Array.isArray(s.projects) && s.projects.length > 0) {
            const activeProjects = s.projects.filter((p: ExamProject) => !serverDeleted.includes(p.id));
            if (activeProjects.length > 0) {
              setProjects(activeProjects);
              const targetId =
                s.activeProjectId && activeProjects.some((p: ExamProject) => p.id === s.activeProjectId)
                  ? s.activeProjectId
                  : activeProjects[0].id;
              setActiveProjectId(targetId);

              const currentProj = activeProjects.find((p: ExamProject) => p.id === targetId) || activeProjects[0];
              if (Array.isArray(currentProj.exam_schedules) && currentProj.exam_schedules.length > 0) {
                setExamSchedules(currentProj.exam_schedules);
              } else if (Array.isArray(s.examSchedules)) {
                setExamSchedules(s.examSchedules);
              }

              if (Array.isArray(currentProj.invigilator_schedules) && currentProj.invigilator_schedules.length > 0) {
                setInvigilatorSchedules(currentProj.invigilator_schedules);
              } else if (Array.isArray(s.invigilatorSchedules)) {
                setInvigilatorSchedules(s.invigilatorSchedules);
              }
            }
          }

          if (s.settings) setSettings(s.settings);
          if (Array.isArray(s.teachers) && s.teachers.length > 0) setTeachers(s.teachers);
          if (Array.isArray(s.buildings) && s.buildings.length > 0) setBuildings(s.buildings);
          if (Array.isArray(s.rooms) && s.rooms.length > 0) setRooms(s.rooms);
          if (Array.isArray(s.subjects) && s.subjects.length > 0) setSubjects(s.subjects);
          if (Array.isArray(s.users) && s.users.length > 0) setUsers(s.users);

          setIsServerSynced(true);
        } else {
          // If server data not yet initialized, trigger Supabase synchronization
          try {
            await fetch('/api/sync-supabase', { method: 'POST' });
            refreshAll();
          } catch (_) {}
        }
      } catch (err) {
        console.warn('[DataContext] Server hydration fallback to local storage:', err);
      }
    }
    loadServerData();
    return () => {
      isMounted = false;
    };
  }, [refreshAll]);

  // Debounced auto-save to server on state modifications
  useEffect(() => {
    // Crucial safeguard: Do not auto-save until initial server hydration is complete
    if (!isServerSynced) return;

    const timer = setTimeout(() => {
      saveToServer();
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    isServerSynced,
    projects,
    activeProjectId,
    deletedProjectIds,
    examSchedules,
    invigilatorSchedules,
    settings,
    teachers,
    buildings,
    rooms,
    subjects,
    users,
    saveToServer,
  ]);

  // Conflict detection
  const conflicts = useMemo<ConflictDetail[]>(() => {
    const list: ConflictDetail[] = [];

    // 1. Double booking: Teacher assigned to multiple DIFFERENT rooms at the same date & time/session
    const teacherSlotMap = new Map<string, InvigilatorSchedule[]>();

    invigilatorSchedules.forEach((inv) => {
      if (!inv.teacher_id) return;
      const exam = examSchedules.find((es) => es.id === inv.exam_schedule_id);
      if (!exam) return;

      const key = `${inv.teacher_id}_${exam.exam_date}_${exam.session}`;
      const existing = teacherSlotMap.get(key) || [];
      existing.push(inv);
      teacherSlotMap.set(key, existing);
    });

    teacherSlotMap.forEach((assignments) => {
      // Konflik HANYA jika guru ditugaskan di lebih dari 1 ruangan berbeda pada sesi yang sama.
      // Jika di ruangan yang sama (misal ada mapel Prakarya kls 7-8 dan Seni Budaya kls 9 di sesi 2),
      // guru yang sama cukup mengawasi ruang tersebut tanpa dianggap bentrok jadwal.
      const distinctRoomIds = Array.from(new Set(assignments.map((a) => a.room_id)));
      if (distinctRoomIds.length > 1) {
        const teacher = teachers.find((t) => t.id === assignments[0].teacher_id);
        const exam = examSchedules.find((es) => es.id === assignments[0].exam_schedule_id);
        const roomNames = distinctRoomIds
          .map((rId) => rooms.find((r) => r.id === rId)?.name || 'Ruang')
          .join(', ');

        list.push({
          id: `db_${assignments[0].id}`,
          type: 'DOUBLE_BOOKING',
          severity: 'ERROR',
          description: `Guru ${teacher?.name || 'Pengawas'} terjadwal mengawas ganda di beberapa ruang berbeda (${roomNames}) pada ${exam?.exam_date} (${exam?.session}).`,
          exam_schedule_id: exam?.id,
          teacher_id: teacher?.id,
        });
      }
    });

    // 2. Unavailable day: Teacher assigned on a day not in their available_days
    invigilatorSchedules.forEach((inv) => {
      if (!inv.teacher_id) return;
      const teacher = teachers.find((t) => t.id === inv.teacher_id);
      const exam = examSchedules.find((es) => es.id === inv.exam_schedule_id);
      if (!teacher || !exam) return;

      // Panitia teachers are standby on campus every day, so they are not flagged as unavailable
      if (!isPanitiaTeacher(teacher) && teacher.available_days && !teacher.available_days.includes(exam.day_name)) {
        list.push({
          id: `unavail_${inv.id}`,
          type: 'UNAVAILABLE_DAY',
          severity: 'WARNING',
          description: `Guru ${teacher.name} dijadwalkan pada hari ${exam.day_name} (${exam.exam_date}), namun tidak termasuk dalam pilihan ketersediaan hari mengawasnya.`,
          exam_schedule_id: exam.id,
          teacher_id: teacher.id,
        });
      }
    });

    // 3. Unassigned rooms: Active rooms that do not have an invigilator for a session
    // Dikelompokkan per sesi (tanggal + sesi) agar sesi dengan lebih dari 1 mapel (misal Prakarya & Seni Budaya)
    // tidak menghasilkan notifikasi ruangan kosong ganda selama ruangan tersebut sudah memiliki pengawas.
    const sessionGroupMap = new Map<string, ExamSchedule[]>();
    examSchedules.forEach((exam) => {
      const sKey = `${exam.exam_date}_${exam.session}`;
      if (!sessionGroupMap.has(sKey)) sessionGroupMap.set(sKey, []);
      sessionGroupMap.get(sKey)!.push(exam);
    });

    sessionGroupMap.forEach((examsInSession, sKey) => {
      const firstExam = examsInSession[0];
      const examIdsInSession = new Set(examsInSession.map((e) => e.id));
      const activeRooms = rooms.filter((r) => r.active);

      activeRooms.forEach((room) => {
        const hasInvigilator = invigilatorSchedules.some(
          (inv) => examIdsInSession.has(inv.exam_schedule_id) && inv.room_id === room.id && !!inv.teacher_id
        );
        if (!hasInvigilator) {
          list.push({
            id: `empty_${sKey}_${room.id}`,
            type: 'UNASSIGNED_ROOM',
            severity: 'WARNING',
            description: `Ruang ${room.name} (${room.code}) pada sesi ujian ${firstExam.exam_date} (${firstExam.session}) belum memiliki guru pengawas.`,
            exam_schedule_id: firstExam.id,
            room_id: room.id,
          });
        }
      });
    });

    return list;
  }, [invigilatorSchedules, examSchedules, teachers, rooms]);

  // Statistics
  const emptyScheduleSlotsCount = useMemo(() => {
    let count = 0;
    const activeRooms = rooms.filter((r) => r.active);
    examSchedules.forEach((exam) => {
      activeRooms.forEach((room) => {
        const assigned = invigilatorSchedules.some(
          (inv) => inv.exam_schedule_id === exam.id && inv.room_id === room.id && inv.teacher_id
        );
        if (!assigned) count++;
      });
    });
    return count;
  }, [rooms, examSchedules, invigilatorSchedules]);

  const scheduledInvigilatorsCount = useMemo(() => {
    return invigilatorSchedules.filter((inv) => !!inv.teacher_id).length;
  }, [invigilatorSchedules]);

  // ==================== CRUD TEACHERS ====================
  const addTeacher = async (payload: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>) => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : `teacher_${Date.now()}`;
    const newRecord: Teacher = { ...payload, id: newId, created_at: new Date().toISOString() };
    
    setTeachers((prev) => [newRecord, ...prev]);

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('teachers').insert([newRecord]);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const addTeachersBatch = async (payloads: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>[]) => {
    if (payloads.length === 0) return { success: true, count: 0 };
    const now = new Date().toISOString();
    const newRecords: Teacher[] = payloads.map((p, idx) => ({
      ...p,
      id: crypto.randomUUID ? crypto.randomUUID() : `teacher_${Date.now()}_${idx}`,
      created_at: now,
    }));

    setTeachers((prev) => [...newRecords, ...prev]);

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('teachers').insert(newRecords);
        if (error) return { success: false, count: 0, error: error.message };
      }
    }
    return { success: true, count: newRecords.length };
  };

  const updateTeacher = async (id: string, updates: Partial<Teacher>) => {
    setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('teachers').update(updates).eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const deleteTeacher = async (id: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    setInvigilatorSchedules((prev) => prev.map((inv) => (inv.teacher_id === id ? { ...inv, teacher_id: null } : inv)));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('teachers').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  // ==================== CRUD BUILDINGS ====================
  const addBuilding = async (payload: Omit<Building, 'id' | 'created_at' | 'updated_at'>) => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : `b_${Date.now()}`;
    const newRecord: Building = { ...payload, id: newId, created_at: new Date().toISOString() };
    
    setBuildings((prev) => [newRecord, ...prev]);

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('buildings').insert([newRecord]);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const addBuildingsBatch = async (batch: Omit<Building, 'id' | 'created_at' | 'updated_at'>[]) => {
    const newRecords: Building[] = batch.map((b, idx) => ({
      ...b,
      id: crypto.randomUUID ? crypto.randomUUID() : `b_${Date.now()}_${idx}`,
      created_at: new Date().toISOString(),
    }));

    setBuildings((prev) => [...newRecords, ...prev]);

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('buildings').insert(newRecords);
        if (error) return { success: false, count: 0, error: error.message };
      }
    }
    return { success: true, count: newRecords.length };
  };

  const updateBuilding = async (id: string, updates: Partial<Building>) => {
    setBuildings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('buildings').update(updates).eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const deleteBuilding = async (id: string) => {
    setBuildings((prev) => prev.filter((b) => b.id !== id));
    setRooms((prev) => prev.filter((r) => r.building_id !== id));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('buildings').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  // ==================== CRUD ROOMS ====================
  const addRoom = async (payload: Omit<Room, 'id' | 'created_at' | 'updated_at' | 'building'>) => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : `r_${Date.now()}`;
    const newRecord: Room = { ...payload, id: newId, created_at: new Date().toISOString() };
    
    setRooms((prev) => [newRecord, ...prev]);

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('rooms').insert([newRecord]);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const addRoomsBatch = async (payloads: Omit<Room, 'id' | 'created_at' | 'updated_at' | 'building'>[]) => {
    if (payloads.length === 0) return { success: true, count: 0 };
    const now = new Date().toISOString();
    const newRecords: Room[] = payloads.map((p, idx) => ({
      ...p,
      id: crypto.randomUUID ? crypto.randomUUID() : `r_${Date.now()}_${idx}`,
      created_at: now,
    }));

    setRooms((prev) => [...newRecords, ...prev]);

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('rooms').insert(newRecords);
        if (error) return { success: false, count: 0, error: error.message };
      }
    }
    return { success: true, count: newRecords.length };
  };

  const updateRoom = async (id: string, updates: Partial<Room>) => {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('rooms').update(updates).eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const deleteRoom = async (id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
    setInvigilatorSchedules((prev) => prev.filter((inv) => inv.room_id !== id));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('rooms').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  // ==================== CRUD SUBJECTS ====================
  const addSubject = async (payload: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : `sub_${Date.now()}`;
    const newRecord: Subject = { ...payload, id: newId, created_at: new Date().toISOString() };
    
    setSubjects((prev) => [newRecord, ...prev]);

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('subjects').insert([newRecord]);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const addSubjectsBatch = async (payloads: Omit<Subject, 'id' | 'created_at' | 'updated_at'>[]) => {
    if (payloads.length === 0) return { success: true, count: 0 };
    const now = new Date().toISOString();
    const newRecords: Subject[] = payloads.map((p, idx) => ({
      ...p,
      id: crypto.randomUUID ? crypto.randomUUID() : `sub_${Date.now()}_${idx}`,
      created_at: now,
    }));

    setSubjects((prev) => [...newRecords, ...prev]);

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('subjects').insert(newRecords);
        if (error) return { success: false, count: 0, error: error.message };
      }
    }
    return { success: true, count: newRecords.length };
  };

  const updateSubject = async (id: string, updates: Partial<Subject>) => {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('subjects').update(updates).eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const deleteSubject = async (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    setExamSchedules((prev) => prev.filter((es) => es.subject_id !== id));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  // ==================== CRUD EXAM SCHEDULES ====================
  const addExamSchedule = async (payload: Omit<ExamSchedule, 'id' | 'created_at' | 'updated_at' | 'subject'>) => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : `es_${Date.now()}`;
    const newRecord: ExamSchedule = { ...payload, id: newId, created_at: new Date().toISOString() };
    
    setExamSchedules((prev) => [newRecord, ...prev]);

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('exam_schedules').insert([newRecord]);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const addExamSchedulesBatch = async (payloads: Omit<ExamSchedule, 'id' | 'created_at' | 'updated_at' | 'subject'>[]) => {
    if (payloads.length === 0) return { success: true, count: 0 };
    const now = new Date().toISOString();
    const newRecords: ExamSchedule[] = payloads.map((p, idx) => ({
      ...p,
      id: crypto.randomUUID ? crypto.randomUUID() : `es_${Date.now()}_${idx}`,
      created_at: now,
    }));

    setExamSchedules((prev) => [...newRecords, ...prev]);

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('exam_schedules').insert(newRecords);
        if (error) return { success: false, count: 0, error: error.message };
      }
    }
    return { success: true, count: newRecords.length };
  };

  const updateExamSchedule = async (id: string, updates: Partial<ExamSchedule>) => {
    setExamSchedules((prev) => prev.map((es) => (es.id === id ? { ...es, ...updates } : es)));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('exam_schedules').update(updates).eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const deleteExamSchedule = async (id: string) => {
    setExamSchedules((prev) => prev.filter((es) => es.id !== id));
    setInvigilatorSchedules((prev) => prev.filter((inv) => inv.exam_schedule_id !== id));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('exam_schedules').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  // ==================== CRUD INVIGILATOR SCHEDULES ====================
  const addInvigilatorSchedule = async (payload: Omit<InvigilatorSchedule, 'id' | 'created_at' | 'updated_at' | 'exam_schedule' | 'room' | 'teacher'>) => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : `inv_${Date.now()}`;
    const newRecord: InvigilatorSchedule = { ...payload, id: newId, created_at: new Date().toISOString() };
    
    // Check if slot already exists
    const existingIndex = invigilatorSchedules.findIndex(
      (inv) => inv.exam_schedule_id === payload.exam_schedule_id && inv.room_id === payload.room_id && inv.role === payload.role
    );

    if (existingIndex >= 0) {
      // Update existing
      setInvigilatorSchedules((prev) => prev.map((item, idx) => (idx === existingIndex ? { ...item, ...payload } : item)));
    } else {
      setInvigilatorSchedules((prev) => [newRecord, ...prev]);
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('invigilator_schedules').upsert([newRecord]);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const updateInvigilatorSchedule = async (id: string, updates: Partial<InvigilatorSchedule>) => {
    setInvigilatorSchedules((prev) => prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('invigilator_schedules').update(updates).eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  const addInvigilatorSchedulesBatch = async (
    items: Omit<InvigilatorSchedule, 'id' | 'created_at' | 'updated_at' | 'exam_schedule' | 'room' | 'teacher'>[],
    options?: { overwriteExisting?: boolean; examScheduleIds?: string[]; roomIds?: string[] }
  ) => {
    if (items.length === 0) return { success: true, count: 0 };
    const now = new Date().toISOString();
    const newRecords: InvigilatorSchedule[] = items.map((p, idx) => ({
      ...p,
      id: crypto.randomUUID ? crypto.randomUUID() : `inv_${Date.now()}_${idx}`,
      created_at: now,
    }));

    setInvigilatorSchedules((prev) => {
      let filtered = prev;
      if (options?.overwriteExisting) {
        filtered = prev.filter((existing) => {
          const matchExam = !options.examScheduleIds || options.examScheduleIds.includes('ALL') || options.examScheduleIds.includes(existing.exam_schedule_id);
          const matchRoom = !options.roomIds || options.roomIds.includes('ALL') || options.roomIds.includes(existing.room_id);
          return !(matchExam && matchRoom);
        });
      } else {
        // Only replace exact matches (same exam, room, role)
        const newKeys = new Set(newRecords.map((n) => `${n.exam_schedule_id}_${n.room_id}_${n.role}`));
        filtered = prev.filter((existing) => !newKeys.has(`${existing.exam_schedule_id}_${existing.room_id}_${existing.role}`));
      }
      return [...newRecords, ...filtered];
    });

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        if (options?.overwriteExisting && options.examScheduleIds && options.examScheduleIds.length > 0 && !options.examScheduleIds.includes('ALL')) {
          await supabase.from('invigilator_schedules').delete().in('exam_schedule_id', options.examScheduleIds);
        }
        const { error } = await supabase.from('invigilator_schedules').upsert(newRecords);
        if (error) return { success: false, count: 0, error: error.message };
      }
    }
    return { success: true, count: newRecords.length };
  };

  const clearInvigilatorSchedules = async (examScheduleIds?: string[], roomIds?: string[]) => {
    setInvigilatorSchedules((prev) => {
      return prev.filter((inv) => {
        const matchExam = !examScheduleIds || examScheduleIds.length === 0 || examScheduleIds.includes('ALL') || examScheduleIds.includes(inv.exam_schedule_id);
        const matchRoom = !roomIds || roomIds.length === 0 || roomIds.includes('ALL') || roomIds.includes(inv.room_id);
        return !(matchExam && matchRoom);
      });
    });

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        let query = supabase.from('invigilator_schedules').delete();
        if (examScheduleIds && examScheduleIds.length > 0 && !examScheduleIds.includes('ALL')) {
          query = query.in('exam_schedule_id', examScheduleIds);
        }
        if (roomIds && roomIds.length > 0 && !roomIds.includes('ALL')) {
          query = query.in('room_id', roomIds);
        }
        const { error } = await query;
        if (error) return { success: false, count: 0, error: error.message };
      }
    }
    return { success: true, count: 0 };
  };

  const quickUpdateInvigilatorStatus = async (
    id: string,
    newStatus: 'Dijadwalkan' | 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha'
  ) => {
    return updateInvigilatorSchedule(id, { status: newStatus });
  };

  const quickReplaceInvigilator = async (
    id: string,
    newTeacherId: string | null,
    oldStatus: 'Dijadwalkan' | 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha' = 'Digantikan'
  ) => {
    const target = invigilatorSchedules.find((inv) => inv.id === id);
    if (!target) {
      return updateInvigilatorSchedule(id, {
        teacher_id: newTeacherId,
        status: newTeacherId ? 'Dijadwalkan' : oldStatus,
      });
    }

    const targetExam = examSchedules.find((e) => e.id === target.exam_schedule_id);
    if (!targetExam) {
      return updateInvigilatorSchedule(id, {
        teacher_id: newTeacherId,
        status: newTeacherId ? 'Dijadwalkan' : oldStatus,
      });
    }

    // Temukan seluruh jadwal ujian bersamaan di tanggal & sesi yang sama untuk ruangan & peran ini
    const siblingExams = examSchedules.filter(
      (e) => e.exam_date === targetExam.exam_date && e.session === targetExam.session
    );
    const siblingExamIds = new Set(siblingExams.map((e) => e.id));

    const matchingAssignments = invigilatorSchedules.filter(
      (inv) => siblingExamIds.has(inv.exam_schedule_id) && inv.room_id === target.room_id && inv.role === target.role
    );

    for (const assignment of matchingAssignments) {
      await updateInvigilatorSchedule(assignment.id, {
        teacher_id: newTeacherId,
        status: newTeacherId ? 'Dijadwalkan' : oldStatus,
      });
    }

    return { success: true };
  };

  const quickConfirmAttendance = async (
    id: string,
    status: 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha',
    actualTime?: string,
    notes?: string
  ) => {
    const timeStr = actualTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const target = invigilatorSchedules.find((inv) => inv.id === id);
    if (!target) {
      return updateInvigilatorSchedule(id, {
        status,
        actual_attendance_time: status === 'Hadir' ? timeStr : null,
        confirmed_by_admin: true,
        notes: notes !== undefined ? notes : undefined,
      });
    }

    const targetExam = examSchedules.find((e) => e.id === target.exam_schedule_id);
    if (!targetExam) {
      return updateInvigilatorSchedule(id, {
        status,
        actual_attendance_time: status === 'Hadir' ? timeStr : null,
        confirmed_by_admin: true,
        notes: notes !== undefined ? notes : undefined,
      });
    }

    const siblingExams = examSchedules.filter(
      (e) => e.exam_date === targetExam.exam_date && e.session === targetExam.session
    );
    const siblingExamIds = new Set(siblingExams.map((e) => e.id));

    const matchingAssignments = invigilatorSchedules.filter(
      (inv) => siblingExamIds.has(inv.exam_schedule_id) && inv.room_id === target.room_id && inv.role === target.role
    );

    for (const assignment of matchingAssignments) {
      await updateInvigilatorSchedule(assignment.id, {
        status,
        actual_attendance_time: status === 'Hadir' ? timeStr : null,
        confirmed_by_admin: true,
        notes: notes !== undefined ? notes : undefined,
      });
    }

    return { success: true };
  };

  const quickSubstituteInvigilator = async (
    scheduleId: string,
    substituteTeacherId: string,
    reason: string
  ) => {
    const existing = invigilatorSchedules.find((inv) => inv.id === scheduleId);
    const oldTeacher = teachers.find((t) => t.id === existing?.teacher_id);
    const oldName = oldTeacher ? oldTeacher.name : 'Pengawas Terjadwal';

    const note = `[Penggantian Darurat] Menggantikan ${oldName}. Alasan: ${reason || 'Berhalangan mendadak'}`;
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (!existing) {
      return updateInvigilatorSchedule(scheduleId, {
        teacher_id: substituteTeacherId,
        replacement_teacher_id: null,
        status: 'Hadir',
        actual_attendance_time: timeStr,
        confirmed_by_admin: true,
        notes: note,
      });
    }

    const targetExam = examSchedules.find((e) => e.id === existing.exam_schedule_id);
    if (!targetExam) {
      return updateInvigilatorSchedule(scheduleId, {
        teacher_id: substituteTeacherId,
        replacement_teacher_id: existing.teacher_id || null,
        status: 'Hadir',
        actual_attendance_time: timeStr,
        confirmed_by_admin: true,
        notes: note,
      });
    }

    const siblingExams = examSchedules.filter(
      (e) => e.exam_date === targetExam.exam_date && e.session === targetExam.session
    );
    const siblingExamIds = new Set(siblingExams.map((e) => e.id));

    const matchingAssignments = invigilatorSchedules.filter(
      (inv) => siblingExamIds.has(inv.exam_schedule_id) && inv.room_id === existing.room_id && inv.role === existing.role
    );

    for (const assignment of matchingAssignments) {
      await updateInvigilatorSchedule(assignment.id, {
        teacher_id: substituteTeacherId,
        replacement_teacher_id: assignment.teacher_id || null,
        status: 'Hadir',
        actual_attendance_time: timeStr,
        confirmed_by_admin: true,
        notes: note,
      });
    }

    return { success: true };
  };

  const batchConfirmAttendance = async (
    updates: { id: string; status: 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha'; actualTime?: string; notes?: string }[]
  ) => {
    const updateMap = new Map(updates.map((u) => [u.id, u]));
    const defaultTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    setInvigilatorSchedules((prev) =>
      prev.map((inv) => {
        const u = updateMap.get(inv.id);
        if (!u) return inv;
        return {
          ...inv,
          status: u.status,
          actual_attendance_time: u.status === 'Hadir' ? (u.actualTime || defaultTime) : null,
          confirmed_by_admin: true,
          notes: u.notes !== undefined ? u.notes : inv.notes,
          updated_at: new Date().toISOString(),
        };
      })
    );

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        for (const u of updates) {
          await supabase.from('invigilator_schedules').update({
            status: u.status,
            actual_attendance_time: u.status === 'Hadir' ? (u.actualTime || defaultTime) : null,
            confirmed_by_admin: true,
            notes: u.notes,
          }).eq('id', u.id);
        }
      }
    }
    return { success: true };
  };

  const deleteInvigilatorSchedule = async (id: string) => {
    setInvigilatorSchedules((prev) => prev.filter((inv) => inv.id !== id));

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('invigilator_schedules').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
      }
    }
    return { success: true };
  };

  // Seed sample full dataset (2 buildings, 45 rooms, 50 teachers)
  const seedDemo45RoomsAndTeachers = async (): Promise<{ success: boolean; message: string }> => {
    // 1. Ensure 2 Buildings
    let gda = buildings.find((b) => b.code === 'GDA') || buildings[0];
    let gdb = buildings.find((b) => b.code === 'GDB') || buildings[1];

    if (!gda) {
      gda = {
        id: 'b0000000-0000-0000-0000-000000000001',
        name: 'Gedung Utama A',
        code: 'GDA',
        address: 'Lantai 1-3 Sayap Barat',
        notes: 'Ruang 01 - Ruang 23',
      };
    }
    if (!gdb) {
      gdb = {
        id: 'b0000000-0000-0000-0000-000000000002',
        name: 'Gedung Timur B',
        code: 'GDB',
        address: 'Lantai 1-3 Sayap Timur',
        notes: 'Ruang 24 - Ruang 45',
      };
    }

    // 2. Generate 45 Rooms
    const newRooms: Room[] = [];
    for (let i = 1; i <= 45; i++) {
      const numStr = String(i).padStart(2, '0');
      const buildingId = i <= 23 ? gda.id : gdb.id;
      const bCode = i <= 23 ? 'A' : 'B';
      const floor = i <= 15 ? 'Lantai 1' : i <= 30 ? 'Lantai 2' : 'Lantai 3';
      newRooms.push({
        id: `room_auto_${i}`,
        building_id: buildingId,
        name: `Ruang ${numStr} (Kelas ${i <= 15 ? 'VII' : i <= 30 ? 'VIII' : 'IX'}-${String.fromCharCode(65 + ((i - 1) % 5))})`,
        code: `R-${numStr}`,
        capacity: 32,
        active: true,
        notes: `Gedung ${bCode} ${floor}`,
      });
    }

    // 3. Generate 55 Teachers with diverse schedules and availability
    const firstNamesL = ['Ahmad', 'Budi', 'Chandra', 'Dedi', 'Eko', 'Fajar', 'Gunawan', 'Hadi', 'Irfan', 'Joko', 'Kurniawan', 'Lukman', 'Mulyadi', 'Nugroho', 'Oki', 'Prasetyo', 'Rian', 'Surya', 'Taufik', 'Untung', 'Wahyu', 'Yusuf', 'Zainal', 'Bambang', 'Hendra', 'Agus', 'Ridwan', 'Saputra'];
    const firstNamesP = ['Ani', 'Dewi', 'Endang', 'Fitri', 'Gita', 'Haryati', 'Indah', 'Juwita', 'Kartika', 'Lestari', 'Maya', 'Nurul', 'Putri', 'Ratna', 'Siti', 'Tri', 'Utami', 'Wulan', 'Yuliana', 'Zahra', 'Sri', 'Rina', 'Mega', 'Sari', 'Kusuma', 'Ayu', 'Rini'];
    const lastNames = ['Pratama', 'Santoso', 'Wijaya', 'Kusuma', 'Lestari', 'Hidayat', 'Saputra', 'Setiawan', 'Nugraha', 'Wibowo', 'Siregar', 'Harahap', 'Suryono', 'Utomo', 'Sudrajat', 'Purnomo', 'Mahendra', 'Firmansyah'];

    const newTeachers: Teacher[] = [];
    const allDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

    for (let i = 1; i <= 55; i++) {
      const isMale = i % 2 === 1;
      const fName = isMale ? firstNamesL[(i - 1) % firstNamesL.length] : firstNamesP[(i - 1) % firstNamesP.length];
      const lName = lastNames[(i * 3) % lastNames.length];
      const gelar = isMale ? 'S.Pd.' : (i % 3 === 0 ? 'M.Pd.' : 'S.Pd.');
      const name = `${fName} ${lName}, ${gelar}`;
      const nip = `198${String((i % 15) + 70).padStart(2, '0')}${String((i % 12) + 1).padStart(2, '0')}15201${String(i % 10)}01${isMale ? '1' : '2'}00${String(i).padStart(2, '0')}`;

      // Distribute availability days: most available 4-5 days, some 3 days
      let avail: string[] = [];
      if (i % 5 === 0) {
        avail = ['Senin', 'Selasa', 'Rabu', 'Kamis'];
      } else if (i % 7 === 0) {
        avail = ['Senin', 'Rabu', 'Kamis', 'Jumat'];
      } else if (i % 9 === 0) {
        avail = ['Selasa', 'Rabu', 'Kamis', 'Jumat'];
      } else if (i % 11 === 0) {
        avail = ['Senin', 'Selasa', 'Kamis', 'Jumat'];
      } else {
        avail = [...allDays];
      }

      newTeachers.push({
        id: `teacher_auto_${i}`,
        name,
        gender: isMale ? 'Laki-laki' : 'Perempuan',
        employee_number: nip,
        invigilator_code: `P${String(i).padStart(2, '0')}`,
        active: true,
        available_days: avail,
        notes: `Guru Pengawas SMP Bhinneka Tunggal Ika (Kode: P${String(i).padStart(2, '0')})`,
      });
    }

    setBuildings([gda, gdb]);
    setRooms(newRooms);
    setTeachers(newTeachers);

    return {
      success: true,
      message: `Berhasil menyiapkan data: 2 Gedung, 45 Ruang aktif (GDA & GDB), dan 55 Guru siap bertugas mengawas!`,
    };
  };

  // ==================== SETTINGS ====================
  const updateSettings = async (updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));

    // Keep activeProject synchronized with the updated exam_name / academic_year / semester
    if (activeProjectId && (updates.exam_name || updates.academic_year || updates.semester)) {
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id === activeProjectId) {
            const newExamName = updates.exam_name !== undefined ? updates.exam_name : proj.exam_name;
            const newYear = updates.academic_year !== undefined ? updates.academic_year : proj.academic_year;
            const newSemester = updates.semester !== undefined ? updates.semester : proj.semester;
            return {
              ...proj,
              exam_name: newExamName,
              academic_year: newYear,
              semester: newSemester,
              name: `${newExamName} (${newYear})`,
              updated_at: new Date().toISOString(),
            };
          }
          return proj;
        })
      );
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase && settings.id) {
        // Safe update with iterative missing-column fallback
        // Prevents "Could not find the 'xyz' column of 'settings' in the schema cache"
        const payload: Record<string, any> = { ...updates };
        let attempts = 0;
        while (attempts < 10 && Object.keys(payload).length > 0) {
          attempts++;
          const { error } = await supabase.from('settings').update(payload).eq('id', settings.id);
          if (!error) break;

          // Check if error is due to a missing column in Supabase schema cache
          const match =
            error.message.match(/Could not find the '([^']+)' column/i) ||
            error.message.match(/column "?([^"'\s]+)"? of relation "settings" does not exist/i) ||
            error.message.match(/column "?([^"'\s]+)"? does not exist/i);

          if (match && match[1]) {
            const missingCol = match[1];
            console.warn(
              `[Supabase] Kolom '${missingCol}' belum terdaftar di tabel settings Supabase. Mengabaikan kolom ini dari payload remote sync:`,
              error.message
            );
            delete payload[missingCol];
          } else {
            console.warn('[Supabase] Gagal menyimpan pengaturan ke remote:', error.message);
            if (
              error.message.toLowerCase().includes('schema cache') ||
              error.message.toLowerCase().includes('column')
            ) {
              break;
            }
            return { success: false, error: error.message };
          }
        }
      }
    }
    return { success: true };
  };

  // ==================== USER & ROLE MANAGEMENT ====================
  const addUser = async (payload: Omit<AppUser, 'id' | 'created_at'>) => {
    const newUser: AppUser = {
      ...payload,
      id: crypto.randomUUID ? crypto.randomUUID() : `u_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setUsers((prev) => [newUser, ...prev]);
    return { success: true };
  };

  const updateUser = async (id: string, updates: Partial<AppUser>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
    return { success: true };
  };

  const deleteUser = async (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    return { success: true };
  };

  // ==================== BACKUP & RESET ====================
  const backupData = () => {
    return {
      backup_version: '2.0',
      exported_at: new Date().toISOString(),
      school_name: settings.school_name,
      academic_year: settings.academic_year,
      semester: settings.semester,
      exam_name: settings.exam_name,
      metrics: {
        total_teachers: teachers.length,
        active_teachers: teachers.filter((t) => t.active).length,
        total_buildings: buildings.length,
        total_rooms: rooms.length,
        active_rooms: rooms.filter((r) => r.active).length,
        total_subjects: subjects.length,
        total_exam_schedules: examSchedules.length,
        total_invigilator_assignments: invigilatorSchedules.filter((i) => !!i.teacher_id).length,
        total_conflicts: conflicts.length,
      },
      data: {
        settings,
        users,
        buildings,
        rooms,
        teachers,
        subjects,
        exam_schedules: examSchedules,
        invigilator_schedules: invigilatorSchedules,
      },
    };
  };

  const resetData = async (
    mode: 'INVIGILATORS_ONLY' | 'EXAMS_AND_INVIGILATORS' | 'RESET_TO_DEFAULT' | 'ALL_DATA'
  ): Promise<{ success: boolean; message: string }> => {
    try {
      if (mode === 'INVIGILATORS_ONLY') {
        setInvigilatorSchedules([]);
        if (isSupabaseConfigured()) {
          const supabase = getSupabase();
          if (supabase) {
            await supabase.from('invigilator_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
        return { success: true, message: 'Seluruh jadwal penugasan pengawas ujian berhasil di-reset.' };
      }

      if (mode === 'EXAMS_AND_INVIGILATORS') {
        setInvigilatorSchedules([]);
        setExamSchedules([]);
        if (isSupabaseConfigured()) {
          const supabase = getSupabase();
          if (supabase) {
            await supabase.from('invigilator_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('exam_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
        return { success: true, message: 'Seluruh jadwal ujian & jadwal penugasan pengawas berhasil di-reset.' };
      }

      if (mode === 'RESET_TO_DEFAULT') {
        setTeachers(INITIAL_TEACHERS);
        setBuildings(INITIAL_BUILDINGS);
        setRooms(INITIAL_ROOMS);
        setSubjects(INITIAL_SUBJECTS);
        setExamSchedules(INITIAL_EXAM_SCHEDULES);
        setInvigilatorSchedules(INITIAL_INVIGILATOR_SCHEDULES);
        setSettings(INITIAL_SETTINGS);
        return { success: true, message: 'Sistem berhasil dikembalikan ke dataset default sekolah.' };
      }

      if (mode === 'ALL_DATA') {
        setTeachers([]);
        setBuildings([]);
        setRooms([]);
        setSubjects([]);
        setExamSchedules([]);
        setInvigilatorSchedules([]);
        return { success: true, message: 'Seluruh data operasional ujian telah dikosongkan.' };
      }

      return { success: false, message: 'Mode reset tidak dikenali.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal menjalankan reset data.' };
    }
  };

  // ==================== MULTI-PROJECT MANAGEMENT ====================
  const switchProject = async (targetId: string): Promise<boolean> => {
    const target = projects.find((p) => p.id === targetId);
    if (!target) return false;

    // Snapshot current active project's schedules
    const updatedProjects = projects.map((proj) =>
      proj.id === activeProjectId
        ? {
            ...proj,
            exam_schedules: [...examSchedules],
            invigilator_schedules: [...invigilatorSchedules],
            updated_at: new Date().toISOString(),
          }
        : proj
    );

    setProjects(updatedProjects);
    setActiveProjectId(targetId);
    setExamSchedules(target.exam_schedules || []);
    setInvigilatorSchedules(target.invigilator_schedules || []);

    // Update settings to reflect target project metadata
    setSettings((prev) => ({
      ...prev,
      exam_name: target.exam_name || target.name,
      academic_year: target.academic_year || prev.academic_year,
      semester: target.semester || prev.semester,
    }));

    await saveToServer({
      projects: updatedProjects,
      activeProjectId: targetId,
      examSchedules: target.exam_schedules || [],
      invigilatorSchedules: target.invigilator_schedules || [],
    });

    return true;
  };

  const createProject = async (params: {
    name: string;
    academic_year: string;
    semester: string;
    exam_name: string;
    duplicateCurrentSchedule?: boolean;
    description?: string;
  }): Promise<{ success: boolean; id?: string }> => {
    const newId = `proj_${Date.now()}`;
    const newExamSchedules = params.duplicateCurrentSchedule ? [...examSchedules] : [];
    const newInvSchedules = params.duplicateCurrentSchedule ? [...invigilatorSchedules] : [];

    const newProj: ExamProject = {
      id: newId,
      name: params.name,
      academic_year: params.academic_year,
      semester: params.semester,
      exam_name: params.exam_name,
      description: params.description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      exam_schedules: newExamSchedules,
      invigilator_schedules: newInvSchedules,
    };

    const updatedCurrent = projects.map((p) =>
      p.id === activeProjectId
        ? { ...p, exam_schedules: [...examSchedules], invigilator_schedules: [...invigilatorSchedules] }
        : p
    );
    const updatedProjects = [newProj, ...updatedCurrent];

    setProjects(updatedProjects);
    setActiveProjectId(newId);
    setExamSchedules(newExamSchedules);
    setInvigilatorSchedules(newInvSchedules);

    setSettings((prev) => ({
      ...prev,
      exam_name: params.exam_name || params.name,
      academic_year: params.academic_year,
      semester: params.semester,
    }));

    await saveToServer({
      projects: updatedProjects,
      activeProjectId: newId,
      examSchedules: newExamSchedules,
      invigilatorSchedules: newInvSchedules,
    });

    return { success: true, id: newId };
  };

  const updateProject = async (id: string, updates: Partial<ExamProject>): Promise<{ success: boolean }> => {
    const updated = projects.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p));
    setProjects(updated);
    if (id === activeProjectId && (updates.name || updates.exam_name || updates.academic_year || updates.semester)) {
      setSettings((prev) => ({
        ...prev,
        exam_name: updates.exam_name || updates.name || prev.exam_name,
        academic_year: updates.academic_year || prev.academic_year,
        semester: updates.semester || prev.semester,
      }));
    }
    await saveToServer({ projects: updated });
    return { success: true };
  };

  const deleteProject = async (id: string): Promise<{ success: boolean; error?: string }> => {
    // 1. Permanently record project ID in deleted list so fallback or initial data NEVER restores it
    const updatedDeleted = Array.from(new Set([...deletedProjectIds, id]));
    setDeletedProjectIds(updatedDeleted);
    setStored(STORAGE_KEYS.DELETED_PROJECTS, updatedDeleted);

    if (projects.length <= 1) {
      const freshProject: ExamProject = {
        id: 'proj_' + Date.now(),
        name: 'Ujian Baru',
        exam_name: 'UJIAN SEKOLAH',
        academic_year: settings.academic_year || '2024/2025',
        semester: settings.semester || 'Genap',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        exam_schedules: [],
        invigilator_schedules: [],
      };
      setProjects([freshProject]);
      setActiveProjectId(freshProject.id);
      setExamSchedules([]);
      setInvigilatorSchedules([]);
      setSettings((prev) => ({
        ...prev,
        exam_name: freshProject.exam_name,
        academic_year: freshProject.academic_year,
        semester: freshProject.semester,
      }));
      await saveToServer({
        projects: [freshProject],
        activeProjectId: freshProject.id,
        deletedProjectIds: updatedDeleted,
        examSchedules: [],
        invigilatorSchedules: [],
      });
      return { success: true };
    }

    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);

    let nextActiveId = activeProjectId;
    let nextExamSchedules = examSchedules;
    let nextInvSchedules = invigilatorSchedules;

    if (activeProjectId === id) {
      const next = remaining[0];
      nextActiveId = next.id;
      nextExamSchedules = next.exam_schedules || [];
      nextInvSchedules = next.invigilator_schedules || [];

      setActiveProjectId(next.id);
      setExamSchedules(nextExamSchedules);
      setInvigilatorSchedules(nextInvSchedules);
      setSettings((prev) => ({
        ...prev,
        exam_name: next.exam_name || next.name,
        academic_year: next.academic_year,
        semester: next.semester,
      }));
    }

    await saveToServer({
      projects: remaining,
      activeProjectId: nextActiveId,
      deletedProjectIds: updatedDeleted,
      examSchedules: nextExamSchedules,
      invigilatorSchedules: nextInvSchedules,
    });

    return { success: true };
  };

  const syncLocalToSupabase = async (): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        message: 'Supabase belum dikonfigurasi. Masukkan Supabase URL dan Anon Key di Pengaturan terlebih dahulu.',
      };
    }
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, message: 'Klien Supabase tidak dapat diinisialisasi.' };
    }
    setLoading(true);
    try {
      if (buildings.length > 0) {
        await supabase.from('buildings').upsert(buildings, { onConflict: 'id' });
      }
      if (rooms.length > 0) {
        const cleanRooms = rooms.map(({ building, ...rest }) => rest);
        await supabase.from('rooms').upsert(cleanRooms, { onConflict: 'id' });
      }
      if (teachers.length > 0) {
        await supabase.from('teachers').upsert(teachers, { onConflict: 'id' });
      }
      if (subjects.length > 0) {
        await supabase.from('subjects').upsert(subjects, { onConflict: 'id' });
      }
      if (examSchedules.length > 0) {
        const cleanExams = examSchedules.map(({ subject, ...rest }) => rest);
        await supabase.from('exam_schedules').upsert(cleanExams, { onConflict: 'id' });
      }
      if (invigilatorSchedules.length > 0) {
        const cleanInvs = invigilatorSchedules.map(({ exam_schedule, room, teacher, ...rest }) => rest);
        await supabase.from('invigilator_schedules').upsert(cleanInvs, { onConflict: 'id' });
      }
      if (settings.id) {
        const payload: Record<string, any> = { ...settings };
        let attempts = 0;
        while (attempts < 10 && Object.keys(payload).length > 0) {
          attempts++;
          const { error } = await supabase.from('settings').upsert([payload], { onConflict: 'id' });
          if (!error) break;
          const match =
            error.message.match(/Could not find the '([^']+)' column/i) ||
            error.message.match(/column "?([^"'\s]+)"? of relation "settings" does not exist/i) ||
            error.message.match(/column "?([^"'\s]+)"? does not exist/i);
          if (match && match[1]) {
            delete payload[match[1]];
          } else {
            break;
          }
        }
      }
      setLoading(false);
      return {
        success: true,
        message: `Sinkronisasi cloud berhasil! ${teachers.length} Guru, ${rooms.length} Ruang, ${examSchedules.length} Jadwal Ujian, dan ${invigilatorSchedules.length} Penugasan Pengawas telah tersimpan di Supabase.`,
      };
    } catch (err: any) {
      setLoading(false);
      return { success: false, message: `Gagal sinkronisasi: ${err?.message || 'Terjadi kesalahan saat upload'}` };
    }
  };

  return (
    <DataContext.Provider
      value={{
        loading,
        error,
        teachers,
        buildings,
        rooms,
        subjects,
        examSchedules,
        invigilatorSchedules,
        settings,
        users,
        conflicts,
        projects,
        activeProjectId,
        activeProject,
        switchProject,
        createProject,
        updateProject,
        deleteProject,
        syncLocalToSupabase,
        emptyScheduleSlotsCount,
        scheduledInvigilatorsCount,
        refreshAll,
        addTeacher,
        addTeachersBatch,
        updateTeacher,
        deleteTeacher,
        addBuilding,
        addBuildingsBatch,
        updateBuilding,
        deleteBuilding,
        addRoom,
        addRoomsBatch,
        updateRoom,
        deleteRoom,
        addSubject,
        addSubjectsBatch,
        updateSubject,
        deleteSubject,
        addExamSchedule,
        addExamSchedulesBatch,
        updateExamSchedule,
        deleteExamSchedule,
        addInvigilatorSchedule,
        addInvigilatorSchedulesBatch,
        clearInvigilatorSchedules,
        quickUpdateInvigilatorStatus,
        quickReplaceInvigilator,
        quickConfirmAttendance,
        quickSubstituteInvigilator,
        batchConfirmAttendance,
        updateInvigilatorSchedule,
        deleteInvigilatorSchedule,
        seedDemo45RoomsAndTeachers,
        updateSettings,
        addUser,
        updateUser,
        deleteUser,
        backupData,
        resetData,
        isServerSynced,
        syncStatus,
        forceSaveToServer,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
