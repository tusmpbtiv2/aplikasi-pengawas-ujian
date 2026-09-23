import {
  Building,
  Room,
  Teacher,
  Subject,
  ExamSchedule,
  InvigilatorSchedule,
  Settings,
  AppUser,
  ExamProject,
} from '../types/database';

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'u-admin-1',
    email: 'admin@smpbhinneka.sch.id',
    full_name: 'Administrator Ujian',
    role: 'ADMIN',
    active: true,
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    id: 'u-panitia-1',
    email: 'panitia@smpbhinneka.sch.id',
    full_name: 'Budi Santoso, S.Pd. (Ketua Panitia)',
    role: 'PANITIA',
    active: true,
    created_at: '2026-09-05T09:00:00Z',
  },
  {
    id: 'u-panitia-2',
    email: 'sekretaris@smpbhinneka.sch.id',
    full_name: 'Siti Rahmawati, S.Pd. (Sekretaris)',
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

export const INITIAL_BUILDINGS: Building[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Gedung Utama A',
    code: 'GDA',
    address: 'Lantai 1-3 Sayap Barat',
    notes: 'Ruang 01 - Ruang 23 (Kelas VII & VIII)',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Gedung Timur B',
    code: 'GDB',
    address: 'Lantai 1-3 Sayap Timur',
    notes: 'Ruang 24 - Ruang 45 (Kelas IX & Lab Komputer)',
  },
];

// Generate 45 Complete Active Rooms for SMP Bhinneka Tunggal Ika
export const INITIAL_ROOMS: Room[] = Array.from({ length: 45 }, (_, i) => {
  const roomNum = i + 1;
  const numStr = String(roomNum).padStart(2, '0');
  const buildingId = roomNum <= 23 ? INITIAL_BUILDINGS[0].id : INITIAL_BUILDINGS[1].id;
  const bCode = roomNum <= 23 ? 'GDA' : 'GDB';
  const grade = roomNum <= 15 ? 'VII' : roomNum <= 30 ? 'VIII' : 'IX';
  const classLetter = String.fromCharCode(65 + ((roomNum - 1) % 5));
  const floor = roomNum <= 15 ? 'Lantai 1' : roomNum <= 30 ? 'Lantai 2' : 'Lantai 3';

  return {
    id: `c0000000-0000-0000-0000-${String(roomNum).padStart(12, '0')}`,
    building_id: buildingId,
    name: `Ruang ${numStr} (Kelas ${grade}-${classLetter})`,
    code: `R-${numStr}`,
    capacity: 32,
    active: true,
    notes: `${bCode} ${floor}`,
  };
});

// Full initial teacher list (55 teachers) with availability Senin - Sabtu
const FIRST_NAMES_L = [
  'Ahmad', 'Budi', 'Chandra', 'Dedi', 'Eko', 'Fajar', 'Gunawan', 'Hadi',
  'Irfan', 'Joko', 'Kurniawan', 'Lukman', 'Mulyadi', 'Nugroho', 'Oki',
  'Prasetyo', 'Rian', 'Surya', 'Taufik', 'Untung', 'Wahyu', 'Yusuf',
  'Zainal', 'Bambang', 'Hendra', 'Agus', 'Ridwan', 'Saputra'
];
const FIRST_NAMES_P = [
  'Ani', 'Dewi', 'Endang', 'Fitri', 'Gita', 'Haryati', 'Indah', 'Juwita',
  'Kartika', 'Lestari', 'Maya', 'Nurul', 'Putri', 'Ratna', 'Siti',
  'Tri', 'Utami', 'Wulan', 'Yuliana', 'Zahra', 'Sri', 'Rina', 'Mega',
  'Sari', 'Kusuma', 'Ayu', 'Rini'
];
const LAST_NAMES = [
  'Sudrajat', 'Rahmawati', 'Santoso', 'Hidayah', 'Prasetyo', 'Lestari',
  'Wijaya', 'Kusuma', 'Hidayat', 'Saputra', 'Setiawan', 'Nugraha',
  'Wibowo', 'Siregar', 'Harahap', 'Suryono', 'Utomo', 'Purnomo', 'Firmansyah'
];

export const INITIAL_TEACHERS: Teacher[] = Array.from({ length: 55 }, (_, i) => {
  const teacherNum = i + 1;
  const isMale = teacherNum % 2 === 1;
  const fName = isMale
    ? FIRST_NAMES_L[(teacherNum - 1) % FIRST_NAMES_L.length]
    : FIRST_NAMES_P[(teacherNum - 1) % FIRST_NAMES_P.length];
  const lName = LAST_NAMES[(teacherNum * 2) % LAST_NAMES.length];
  const gelar = isMale ? (teacherNum === 1 ? 'M.Pd.' : 'S.Pd.') : (teacherNum % 4 === 0 ? 'M.Pd.' : 'S.Pd.');
  const titlePrefix = teacherNum === 1 ? 'Drs. H. ' : (teacherNum === 2 ? '' : '');
  const name = `${titlePrefix}${fName} ${lName}, ${gelar}`.trim();
  const code = `P${String(teacherNum).padStart(2, '0')}`;
  const nip = `198${String((teacherNum % 15) + 70).padStart(2, '0')}${String((teacherNum % 12) + 1).padStart(2, '0')}15201${String(teacherNum % 10)}01${isMale ? '1' : '2'}00${String(teacherNum).padStart(2, '0')}`;

  // Default available days includes Senin, Selasa, Rabu, Kamis, Jumat, Sabtu
  let avail = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  if (teacherNum % 7 === 0) {
    avail = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  } else if (teacherNum % 11 === 0) {
    avail = ['Senin', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  }

  return {
    id: `d0000000-0000-0000-0000-${String(teacherNum).padStart(12, '0')}`,
    name,
    gender: isMale ? 'Laki-laki' : 'Perempuan',
    employee_number: nip,
    invigilator_code: code,
    active: true,
    available_days: avail,
    notes: teacherNum === 1
      ? 'Koordinator / Pengawas Ujian'
      : teacherNum === 2
      ? 'Panitia Pelaksana'
      : `Guru Pengawas (${code})`,
  };
});

export const INITIAL_SUBJECTS: Subject[] = [
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
    name: 'Pendidikan Agama Islam (PAI)',
    code: 'PAI-02',
    grade_level: 7,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Pendidikan Agama & Budi Pekerti',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000003',
    name: 'Matematika',
    code: 'MTK-03',
    grade_level: 7,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Kalkulator tidak diperkenankan',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000004',
    name: 'Pendidikan Pancasila & Kewarganegaraan (PPKn)',
    code: 'PPK-04',
    grade_level: 7,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Kurikulum Merdeka',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000005',
    name: 'Ilmu Pengetahuan Alam (IPA)',
    code: 'IPA-05',
    grade_level: 8,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Teori Biologi dan Fisika',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000006',
    name: 'Ilmu Pengetahuan Sosial (IPS)',
    code: 'IPS-06',
    grade_level: 8,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Geografi, Sejarah, Sosiologi, Ekonomi',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000007',
    name: 'Bahasa Inggris',
    code: 'BIG-07',
    grade_level: 9,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Listening & Reading Comprehension',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000008',
    name: 'Pendidikan Jasmani, Olahraga & Kesehatan (PJOK)',
    code: 'PJK-08',
    grade_level: 7,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Teori Kesehatan & Olahraga',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000009',
    name: 'Informatika',
    code: 'INF-09',
    grade_level: 7,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Literasi Digital & Berpikir Komputasional',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000010',
    name: 'Bahasa Daerah / Sunda',
    code: 'BDR-10',
    grade_level: 7,
    grade_levels: ['7', '8', '9'],
    active: true,
    notes: 'Muatan Lokal Wajib',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000011',
    name: 'Prakarya',
    code: 'PKR-11',
    grade_level: 7,
    grade_levels: ['7', '8'],
    active: true,
    notes: 'Kerajinan, Rekayasa, Budidaya (Kelas 7 & 8)',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000012',
    name: 'Seni Budaya',
    code: 'SBD-12',
    grade_level: 9,
    grade_levels: ['9'],
    active: true,
    notes: 'Seni Rupa & Seni Musik (Kelas 9)',
  },
];

// Helper to calculate date offsets anchored to realistic semester dates
const getAnchoredDate = (dayOffset: number): string => {
  // Use fixed or offset dates
  const base = new Date();
  base.setDate(base.getDate() + dayOffset);
  return base.toISOString().split('T')[0];
};

export const INITIAL_EXAM_SCHEDULES: ExamSchedule[] = [
  // HARI 1: SENIN
  {
    id: 'f0000000-0000-0000-0000-000000000001',
    exam_date: getAnchoredDate(1),
    day_name: 'Senin',
    subject_id: INITIAL_SUBJECTS[0].id, // Bahasa Indonesia
    start_time: '07:30:00',
    end_time: '09:30:00',
    session: 'Sesi 1',
    notes: 'Hari pertama ujian semester',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000002',
    exam_date: getAnchoredDate(1),
    day_name: 'Senin',
    subject_id: INITIAL_SUBJECTS[1].id, // PAI
    start_time: '10:00:00',
    end_time: '11:30:00',
    session: 'Sesi 2',
    notes: 'Sesi siang Pendidikan Agama',
  },
  // HARI 2: SELASA
  {
    id: 'f0000000-0000-0000-0000-000000000003',
    exam_date: getAnchoredDate(2),
    day_name: 'Selasa',
    subject_id: INITIAL_SUBJECTS[2].id, // Matematika
    start_time: '07:30:00',
    end_time: '09:30:00',
    session: 'Sesi 1',
    notes: 'Matematika',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000004',
    exam_date: getAnchoredDate(2),
    day_name: 'Selasa',
    subject_id: INITIAL_SUBJECTS[3].id, // PPKn
    start_time: '10:00:00',
    end_time: '11:30:00',
    session: 'Sesi 2',
    notes: 'PPKn',
  },
  // HARI 3: RABU
  {
    id: 'f0000000-0000-0000-0000-000000000005',
    exam_date: getAnchoredDate(3),
    day_name: 'Rabu',
    subject_id: INITIAL_SUBJECTS[4].id, // IPA
    start_time: '07:30:00',
    end_time: '09:30:00',
    session: 'Sesi 1',
    notes: 'IPA Terpadu',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000006',
    exam_date: getAnchoredDate(3),
    day_name: 'Rabu',
    subject_id: INITIAL_SUBJECTS[5].id, // IPS
    start_time: '10:00:00',
    end_time: '11:30:00',
    session: 'Sesi 2',
    notes: 'IPS Terpadu',
  },
  // HARI 4: KAMIS
  {
    id: 'f0000000-0000-0000-0000-000000000007',
    exam_date: getAnchoredDate(4),
    day_name: 'Kamis',
    subject_id: INITIAL_SUBJECTS[6].id, // Bahasa Inggris
    start_time: '07:30:00',
    end_time: '09:30:00',
    session: 'Sesi 1',
    notes: 'Bahasa Inggris',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000008',
    exam_date: getAnchoredDate(4),
    day_name: 'Kamis',
    subject_id: INITIAL_SUBJECTS[7].id, // PJOK
    start_time: '10:00:00',
    end_time: '11:30:00',
    session: 'Sesi 2',
    notes: 'PJOK',
  },
  // HARI 5: JUMAT
  {
    id: 'f0000000-0000-0000-0000-000000000009',
    exam_date: getAnchoredDate(5),
    day_name: 'Jumat',
    subject_id: INITIAL_SUBJECTS[8].id, // Informatika
    start_time: '07:30:00',
    end_time: '09:00:00',
    session: 'Sesi 1',
    notes: 'Informatika',
  },
  // HARI 6: SABTU (Skenario Spesifik User: Sesi 1 Bahasa Daerah, Sesi 2 Prakarya Kls 7-8 & Seni Budaya Kls 9 diawasi 1 pengawas yang sama)
  {
    id: 'f0000000-0000-0000-0000-000000000010',
    exam_date: getAnchoredDate(6),
    day_name: 'Sabtu',
    subject_id: INITIAL_SUBJECTS[9].id, // Bahasa Daerah
    start_time: '07:30:00',
    end_time: '09:00:00',
    session: 'Sesi 1',
    notes: 'Bahasa Daerah',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000011',
    exam_date: getAnchoredDate(6),
    day_name: 'Sabtu',
    subject_id: INITIAL_SUBJECTS[10].id, // Prakarya (Kls 7 & 8)
    start_time: '09:30:00',
    end_time: '11:00:00',
    session: 'Sesi 2',
    notes: 'Prakarya (Kelas 7 & 8) - Bersamaan di Ruang Ujian',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000012',
    exam_date: getAnchoredDate(6),
    day_name: 'Sabtu',
    subject_id: INITIAL_SUBJECTS[11].id, // Seni Budaya (Kls 9)
    start_time: '09:30:00',
    end_time: '11:00:00',
    session: 'Sesi 2',
    notes: 'Seni Budaya (Kelas 9) - Bersamaan di Ruang Ujian',
  },
];

// Pre-generate initial invigilator assignments for active rooms
export const INITIAL_INVIGILATOR_SCHEDULES: InvigilatorSchedule[] = (() => {
  const list: InvigilatorSchedule[] = [];
  let assignCounter = 1;

  // Assign teachers across exams and rooms
  INITIAL_EXAM_SCHEDULES.forEach((exam) => {
    // For each room (up to 45 rooms)
    INITIAL_ROOMS.forEach((room, roomIdx) => {
      // Pick a teacher based on rotation
      const teacherIdx = (roomIdx + assignCounter) % INITIAL_TEACHERS.length;
      const teacher = INITIAL_TEACHERS[teacherIdx];

      list.push({
        id: `10000000-0000-0000-0000-${String(assignCounter).padStart(12, '0')}`,
        exam_schedule_id: exam.id,
        room_id: room.id,
        teacher_id: teacher.id,
        role: 'Pengawas 1',
        status: 'Dijadwalkan',
        notes: `Pengawas ${room.code}`,
      });
      assignCounter++;
    });
  });

  return list;
})();

export const INITIAL_SETTINGS: Settings = {
  id: 'settings-default',
  school_name: 'SMP BHINNEKA TUNGGAL IKA',
  school_address: 'Jl. Raya Pendidikan No. 01',
  school_logo: '',
  exam_name: 'ASESMEN SUMATIF / UJIAN SEKOLAH',
  academic_year: '2026/2027',
  semester: 'Ganjil',
  principal_name: "Drs. Moh. Mas'ud, S.Pd, M.Pd",
  principal_nip: 'P - 01',
  committee_chairman_name: 'Muhammad Ainul Yaqin, M.Pd.I',
  committee_chairman_nip: 'P - 02',
  committee_secretary_name: 'Mochammad Amiruddin, S.Pd.I',
  document_city: 'Jombang',
  document_date: '2026-10-10',
  default_invigilators_per_room: 1,
  default_start_time: '07:30',
  default_duration: 60,
  break_duration: 30,
  honor_per_session: 50000,
  app_name: 'Sistem Manajemen Ujian & Pengawas Ruang',
  theme: 'blue',
  date_format: 'DD/MM/YYYY',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

export const INITIAL_PROJECTS: ExamProject[] = [
  {
    id: 'proj-real-sumatif-2026',
    name: 'Asesmen Sumatif / Ujian Sekolah 2026/2027',
    academic_year: '2026/2027',
    semester: 'Ganjil',
    exam_name: 'ASESMEN SUMATIF / UJIAN SEKOLAH',
    description: 'Kegiatan Asesmen Sumatif / Ujian Sekolah Tahun Pelajaran 2026/2027.',
    created_at: '2026-09-01T08:00:00Z',
    is_active: true,
    exam_schedules: INITIAL_EXAM_SCHEDULES,
    invigilator_schedules: INITIAL_INVIGILATOR_SCHEDULES,
    settings_override: {
      exam_name: 'ASESMEN SUMATIF / UJIAN SEKOLAH',
      academic_year: '2026/2027',
      semester: 'Ganjil',
    },
  },
];
