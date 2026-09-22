import * as XLSX from 'xlsx';
import { Teacher, Building, Room, Subject, ExamSchedule, InvigilatorSchedule } from '../types/database';

/**
 * Parse an uploaded file (CSV or XLSX) into raw array of row objects
 */
export const parseSpreadsheetFile = async (
  file: File
): Promise<{ headers: string[]; rows: Record<string, any>[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('File tidak dapat dibaca atau kosong');
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        if (!worksheet) {
          throw new Error('Lembar kerja (sheet) tidak ditemukan di dalam file');
        }

        // Extract raw JSON rows (header row included)
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
          defval: '',
          raw: false,
        });

        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        // Get headers from first row keys
        const headers = Object.keys(jsonData[0] || {});

        resolve({ headers, rows: jsonData });
      } catch (err: any) {
        reject(new Error(err?.message || 'Gagal memproses file spreadsheet'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Terjadi kesalahan saat membaca file'));
    };

    reader.readAsBinaryString(file);
  });
};

/**
 * Export data array to XLSX or CSV download
 */
export const exportToSpreadsheet = (
  data: Record<string, any>[],
  filename: string,
  format: 'xlsx' | 'csv' = 'xlsx',
  sheetName = 'Data'
) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  if (format === 'csv') {
    XLSX.writeFile(workbook, `${filename}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, `${filename}.xlsx`, { bookType: 'xlsx' });
  }
};

/**
 * Specialized Exports
 */
export const exportTeachersToSpreadsheet = (teachers: Teacher[], format: 'xlsx' | 'csv' = 'xlsx') => {
  const data = teachers.map((t, idx) => ({
    No: idx + 1,
    Nama: t.name,
    NIP: t.employee_number || '-',
    'Jenis Kelamin': t.gender,
    Status: t.active ? 'Aktif' : 'Non-Aktif',
    'Hari Ketersediaan': t.available_days?.join(', ') || '-',
    Catatan: t.notes || '-',
  }));
  exportToSpreadsheet(data, 'Data_Guru_SMP_Bhinneka_Tunggal_Ika', format, 'Data Guru');
};

export const exportRoomsToSpreadsheet = (rooms: Room[], buildings: Building[], format: 'xlsx' | 'csv' = 'xlsx') => {
  const data = rooms.map((r, idx) => {
    const bldg = buildings.find((b) => b.id === r.building_id);
    return {
      No: idx + 1,
      Gedung: bldg?.name || '-',
      'Kode Gedung': bldg?.code || '-',
      'Nama Ruang': r.name,
      'Kode Ruang': r.code,
      Kapasitas: r.capacity,
      Status: r.active ? 'Aktif' : 'Non-Aktif',
      Catatan: r.notes || '-',
    };
  });
  exportToSpreadsheet(data, 'Data_Ruang_Ujian_SMP_Bhinneka_Tunggal_Ika', format, 'Data Ruang');
};

export const exportSubjectsToSpreadsheet = (subjects: Subject[], format: 'xlsx' | 'csv' = 'xlsx') => {
  const data = subjects.map((s, idx) => ({
    No: idx + 1,
    'Nama Mata Pelajaran': s.name,
    Kode: s.code,
    Tingkat: s.grade_level ? `Kelas ${s.grade_level}` : 'Semua',
    'Durasi (Menit)': s.default_duration || 90,
    Status: s.active ? 'Aktif' : 'Non-Aktif',
    Catatan: s.notes || '-',
  }));
  exportToSpreadsheet(data, 'Data_Mata_Pelajaran_SMP_Bhinneka_Tunggal_Ika', format, 'Mata Pelajaran');
};

export const exportExamSchedulesToSpreadsheet = (
  examSchedules: ExamSchedule[],
  subjects: Subject[],
  format: 'xlsx' | 'csv' = 'xlsx'
) => {
  const data = examSchedules.map((es, idx) => {
    const sub = subjects.find((s) => s.id === es.subject_id);
    return {
      No: idx + 1,
      'Tanggal Ujian': es.exam_date,
      Hari: es.day_name,
      Sesi: es.session,
      'Jam Mulai': es.start_time,
      'Jam Selesai': es.end_time,
      'Mata Pelajaran': sub?.name || '-',
      'Kode Mapel': sub?.code || '-',
      Catatan: es.notes || '-',
    };
  });
  exportToSpreadsheet(data, 'Jadwal_Ujian_SMP_Bhinneka_Tunggal_Ika', format, 'Jadwal Ujian');
};

export const exportInvigilatorsToSpreadsheet = (
  invigilators: any[],
  format: 'xlsx' | 'csv' = 'xlsx'
) => {
  exportToSpreadsheet(invigilators, 'Jadwal_Pengawas_SMP_Bhinneka_Tunggal_Ika', format, 'Jadwal Pengawas');
};

/**
 * Download sample template files
 */
export const downloadTeacherTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
  const sampleData = [
    {
      Nama: 'Drs. H. Ahmad Sudrajat, M.Pd.',
      NIP: '197503152000031002',
      JK: 'Laki-laki',
      'Hari Tersedia': 'Senin,Selasa,Rabu,Kamis,Jumat',
      Status: 'Aktif',
      Catatan: 'Koordinator Pengawas Ujian',
    },
    {
      Nama: 'Siti Rahmawati, S.Pd.',
      NIP: '198207182006042018',
      JK: 'Perempuan',
      'Hari Tersedia': 'Senin,Rabu,Jumat',
      Status: 'Aktif',
      Catatan: 'Guru Bahasa Indonesia',
    },
    {
      Nama: 'Budi Hartono, S.Si.',
      NIP: '198511042010011015',
      JK: 'Laki-laki',
      'Hari Tersedia': 'Selasa,Kamis,Sabtu',
      Status: 'Aktif',
      Catatan: 'Guru IPA',
    },
  ];
  exportToSpreadsheet(sampleData, 'Template_Import_Guru', format, 'Template Guru');
};

export const downloadBuildingTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
  const sampleData = [
    {
      'Nama Gedung': 'Gedung Utama A',
      Kode: 'GDA',
      Alamat: 'Lantai 1-2 Sayap Barat',
      Catatan: 'Gedung ruang kelas VII dan VIII',
    },
    {
      'Nama Gedung': 'Gedung Timur B',
      Kode: 'GDB',
      Alamat: 'Lantai 1-2 Sayap Timur',
      Catatan: 'Gedung kelas IX dan Lab Komputer',
    },
  ];
  exportToSpreadsheet(sampleData, 'Template_Import_Gedung', format, 'Template Gedung');
};

export const downloadRoomTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
  const sampleData = [
    {
      Gedung: 'Gedung Utama A',
      'Nama Ruang': 'Ruang 01 (Kelas VII-A)',
      Kode: 'R-01',
      Kapasitas: 32,
      Status: 'Aktif',
      Catatan: 'Lantai 1 Sayap Barat',
    },
    {
      Gedung: 'Gedung Utama A',
      'Nama Ruang': 'Ruang 02 (Kelas VII-B)',
      Kode: 'R-02',
      Kapasitas: 32,
      Status: 'Aktif',
      Catatan: 'Lantai 1 Sayap Barat',
    },
    {
      Gedung: 'Gedung Timur B',
      'Nama Ruang': 'Ruang 05 (Lab Komputer)',
      Kode: 'R-05',
      Kapasitas: 36,
      Status: 'Aktif',
      Catatan: 'Lab Komputer Lantai 2',
    },
  ];
  exportToSpreadsheet(sampleData, 'Template_Import_Ruang', format, 'Template Ruang');
};

export const downloadSubjectTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
  const sampleData = [
    {
      'Nama Mata Pelajaran': 'Bahasa Indonesia',
      Kode: 'BIN-01',
      Status: 'Aktif',
      Catatan: 'Kurikulum Merdeka',
    },
    {
      'Nama Mata Pelajaran': 'Matematika',
      Kode: 'MTK-02',
      Status: 'Aktif',
      Catatan: 'Ujian Berbasis Kertas & Digital',
    },
    {
      'Nama Mata Pelajaran': 'Ilmu Pengetahuan Alam (IPA)',
      Kode: 'IPA-03',
      Status: 'Aktif',
      Catatan: 'Teori & Praktik',
    },
  ];
  exportToSpreadsheet(sampleData, 'Template_Import_Mata_Pelajaran', format, 'Template Mapel');
};

export const downloadExamScheduleTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
  const sampleData = [
    {
      Tanggal: '2026-09-22',
      Hari: 'Senin',
      'Mata Pelajaran': 'Matematika',
      Sesi: 'Sesi 1',
      'Jam Mulai': '07:30',
      'Jam Selesai': '09:00',
      Catatan: 'Ujian Utama Sesi 1',
    },
    {
      Tanggal: '2026-09-22',
      Hari: 'Senin',
      'Mata Pelajaran': 'Bahasa Indonesia',
      Sesi: 'Sesi 2',
      'Jam Mulai': '09:30',
      'Jam Selesai': '11:00',
      Catatan: 'Sesi 2 Siang',
    },
    {
      Tanggal: '2026-09-23',
      Hari: 'Selasa',
      'Mata Pelajaran': 'Ilmu Pengetahuan Alam (IPA)',
      Sesi: 'Sesi 1',
      'Jam Mulai': '07:30',
      'Jam Selesai': '09:30',
      Catatan: 'Teori Biologi & Fisika',
    },
  ];
  exportToSpreadsheet(sampleData, 'Template_Import_Jadwal_Ujian', format, 'Template Jadwal');
};

/**
 * Export Daftar Hadir Pengawas Harian to Excel (.xlsx)
 * Format Kolom: No | Ruang | Sesi & Waktu | Mata Pelajaran | Nama Pengawas | Kode | Tanda Tangan | Ket.
 */
export const exportDailyAttendanceToExcel = (
  attendanceRows: {
    no: number;
    roomName: string;
    sessionTime: string;
    subjectName: string;
    teacherName: string;
    invigilatorCode: string;
    sigText?: string;
    notes?: string;
  }[],
  meta: {
    schoolName: string;
    examName: string;
    academicYear: string;
    dayAndDate: string;
    sessionInfo?: string;
  }
) => {
  const data = attendanceRows.map((r) => ({
    No: r.no,
    Ruang: r.roomName,
    'Sesi & Waktu': r.sessionTime,
    'Mata Pelajaran': r.subjectName,
    'Nama Pengawas': r.teacherName,
    Kode: r.invigilatorCode,
    'Tanda Tangan': r.sigText || '.......................',
    'Ket.': r.notes || '-',
  }));

  const cleanDate = meta.dayAndDate.replace(/[\/,\s]+/g, '_').toLowerCase();
  const filename = `Daftar_Hadir_Pengawas_${cleanDate}`;
  exportToSpreadsheet(data, filename, 'xlsx', 'Daftar Hadir Pengawas');
};

/**
 * Export Master Matriks Jadwal All Ujian & Lampiran Guru to Excel (.xlsx)
 * Generates a workbook with 2 sheets:
 * 1. Matriks Jadwal Ruang (Rooms x Exam Sessions with Invigilator Code & Name)
 * 2. Lampiran Guru & Kode Pengawas
 */
export const exportAllExamMatrixToExcel = (
  rooms: Room[],
  buildings: Building[],
  uniqueExamSessions: ExamSchedule[],
  invigilatorSchedules: InvigilatorSchedule[],
  teachers: Teacher[],
  meta: {
    schoolName: string;
    examName: string;
    academicYear: string;
  }
) => {
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const activeRooms = rooms.filter((r) => r.active);

  // 1. Build Matrix Rows (Sheet 1)
  const matrixData = activeRooms.map((room, rIdx) => {
    const b = buildings.find((bg) => bg.id === room.building_id);
    const rowObj: Record<string, any> = {
      No: rIdx + 1,
      'Ruang Ujian': room.name,
      'Kode Ruang': room.code,
      Gedung: b?.name ? `${b.name} (${b.code})` : '-',
    };

    uniqueExamSessions.forEach((exam) => {
      const inv1 = invigilatorSchedules.find(
        (i) => i.exam_schedule_id === exam.id && i.room_id === room.id && i.role === 'Pengawas 1'
      );
      const inv2 = invigilatorSchedules.find(
        (i) => i.exam_schedule_id === exam.id && i.room_id === room.id && i.role === 'Pengawas 2'
      );

      const t1 = inv1?.teacher_id ? teacherMap.get(inv1.teacher_id) : null;
      const t2 = inv2?.teacher_id ? teacherMap.get(inv2.teacher_id) : null;

      const sessionLabel = `${exam.day_name || ''} ${exam.exam_date} (${exam.session})`;
      rowObj[`${sessionLabel} - P1`] = t1 ? `${t1.invigilator_code || 'P'} (${t1.name})` : '-';
      rowObj[`${sessionLabel} - P2`] = t2 ? `${t2.invigilator_code || 'P'} (${t2.name})` : '-';
    });

    return rowObj;
  });

  // 2. Build Lampiran Guru (Sheet 2)
  const teacherStats = teachers.map((t, idx) => {
    const dutyCount = invigilatorSchedules.filter((i) => i.teacher_id === t.id).length;
    return {
      No: idx + 1,
      'Kode Pengawas': t.invigilator_code || '-',
      'Nama Lengkap & Gelar': t.name,
      NIP: t.employee_number || '-',
      'Jenis Kelamin': t.gender || '-',
      'Total Sesi Mengawas': dutyCount,
      Status: t.active ? 'Aktif' : 'Non-Aktif',
      'Hari Ketersediaan': t.available_days?.join(', ') || 'Semua Hari',
      Catatan: t.notes || '-',
    };
  });

  // 3. Create Multi-Sheet Workbook
  const workbook = XLSX.utils.book_new();
  const wsMatrix = XLSX.utils.json_to_sheet(matrixData);
  const wsTeachers = XLSX.utils.json_to_sheet(teacherStats);

  XLSX.utils.book_append_sheet(workbook, wsMatrix, 'Matriks Jadwal Ruang');
  XLSX.utils.book_append_sheet(workbook, wsTeachers, 'Lampiran Guru & Kode');

  const cleanExamName = (meta.examName || 'Master_Jadwal').replace(/[\/,\s]+/g, '_');
  XLSX.writeFile(workbook, `Master_Jadwal_Pengawas_${cleanExamName}.xlsx`, { bookType: 'xlsx' });
};


