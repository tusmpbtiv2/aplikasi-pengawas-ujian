export type UserRole = 'ADMIN' | 'PANITIA' | 'VIEWER';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

export interface Teacher {
  id: string;
  name: string;
  gender: 'Laki-laki' | 'Perempuan';
  employee_number?: string | null;
  invigilator_code?: string | null; // Kode Pengawas e.g. P01, P02
  active: boolean;
  available_days: string[]; // e.g. ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Minggu']
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Building {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Room {
  id: string;
  building_id: string;
  name: string;
  code: string;
  capacity: number;
  active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  building?: Building;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  grade_level?: number | null;
  grade_levels?: string[]; // e.g. ['7', '8', '9']
  default_duration?: number;
  active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExamSchedule {
  id: string;
  exam_date: string; // 'YYYY-MM-DD'
  day_name: string;  // e.g. 'Senin'
  subject_id: string;
  start_time: string; // '07:30:00'
  end_time: string;   // '09:30:00'
  session: string;    // 'Sesi 1'
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  subject?: Subject;
}

export interface InvigilatorSchedule {
  id: string;
  exam_schedule_id: string;
  room_id: string;
  teacher_id?: string | null;
  role: 'Pengawas 1' | 'Pengawas 2' | 'Cadangan';
  status: 'Dijadwalkan' | 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha';
  actual_attendance_time?: string | null;
  replacement_teacher_id?: string | null;
  confirmed_by_admin?: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  exam_schedule?: ExamSchedule;
  room?: Room;
  teacher?: Teacher;
  replacement_teacher?: Teacher;
}

export interface Settings {
  id: string;
  school_name: string;
  school_address: string;
  school_logo?: string;
  exam_name: string;
  academic_year: string;
  semester?: string;
  default_invigilators_per_room: number;
  default_start_time?: string;
  default_duration?: number;
  break_duration?: number;
  honor_per_session?: number; // Honorarium pengawas per sesi / per mapel (Rp)
  theme?: 'light' | 'slate' | 'blue';
  date_format?: 'DD/MM/YYYY' | 'D MMMM YYYY';
  app_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at?: string;
}

export interface ConflictDetail {
  id: string;
  type: 'DOUBLE_BOOKING' | 'UNAVAILABLE_DAY' | 'UNASSIGNED_ROOM';
  severity: 'ERROR' | 'WARNING';
  description: string;
  exam_schedule_id?: string;
  teacher_id?: string;
  room_id?: string;
}

export type MenuItemId =
  | 'dashboard'
  | 'teachers'
  | 'buildings'
  | 'rooms'
  | 'subjects'
  | 'exam_schedules'
  | 'invigilator_schedules'
  | 'attendance'
  | 'print_center'
  | 'import_center'
  | 'export_center'
  | 'settings';
