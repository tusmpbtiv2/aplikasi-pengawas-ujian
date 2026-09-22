import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Printer,
  FileText,
  CreditCard,
  Calendar,
  Grid,
  Users,
  CheckCircle2,
  Building2,
  DoorOpen,
  BookOpen,
  Filter,
  Download,
  Info,
  ChevronRight,
  Sparkles,
  ExternalLink,
  AlertCircle,
  X,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { Teacher, Room, ExamSchedule, InvigilatorSchedule } from '../../types/database';
import { formatIndonesianDate, formatIndonesianDayAndDate } from '../../lib/scheduleHelper';
import { exportDailyAttendanceToExcel, exportAllExamMatrixToExcel } from '../../lib/excelHelper';
import { FileSpreadsheet } from 'lucide-react';

const SchoolKopLogo: React.FC<{ logoUrl?: string; size?: 'sm' | 'md' | 'lg' }> = ({ logoUrl, size = 'lg' }) => {
  const [imgError, setImgError] = useState(false);

  const dimensionClasses = {
    sm: 'w-12 h-12 max-h-12 max-w-12',
    md: 'w-14 h-14 max-h-14 max-w-14',
    lg: 'w-20 h-20 max-h-20 max-w-20',
  }[size];

  const wrapperClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  }[size];

  if (logoUrl && !imgError) {
    return (
      <div className={`${wrapperClasses} shrink-0 flex items-center justify-center`}>
        <img
          src={logoUrl}
          alt="Logo Sekolah"
          className={`${dimensionClasses} object-contain print:block`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Indonesian education emblem / crest fallback
  return (
    <div className={`${wrapperClasses} shrink-0 flex items-center justify-center`}>
      <svg viewBox="0 0 100 100" className={`${dimensionClasses} text-black print:block`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" stroke="#000" strokeWidth="2.5" fill="#fff" />
        <circle cx="50" cy="50" r="41" stroke="#000" strokeWidth="1" strokeDasharray="3 2" />
        <path d="M50 18 L53 26 L61 27 L55 33 L57 41 L50 37 L43 41 L45 33 L39 27 L47 26 Z" fill="#000" />
        <path d="M26 58 Q50 48 74 58 L74 63 Q50 53 26 63 Z" fill="#000" />
        <path d="M50 50 L50 63" stroke="#000" strokeWidth="2" />
        <path d="M35 70 Q50 64 65 70" stroke="#000" strokeWidth="2" fill="none" />
        <path d="M42 76 Q50 72 58 76" stroke="#000" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
};

type PrintTab = 'f4_attendance' | 'a5_card' | 'all_matrix';

export const PrintCenterView: React.FC = () => {
  const {
    settings,
    examSchedules,
    rooms,
    teachers,
    buildings,
    subjects,
    invigilatorSchedules,
  } = useData();

  const [activeTab, setActiveTab] = useState<PrintTab>('f4_attendance');
  const [isPrintSandboxModalOpen, setIsPrintSandboxModalOpen] = useState(false);

  // Filters for F4 Attendance
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(examSchedules.map((es) => es.exam_date))).sort();
  }, [examSchedules]);

  const [selectedDateF4, setSelectedDateF4] = useState<string>(uniqueDates[0] || '');
  const [selectedSessionF4, setSelectedSessionF4] = useState<string>('ALL');
  const [selectedBuildingF4, setSelectedBuildingF4] = useState<string>('ALL');

  // Filters for A5 Card
  const [selectedTeacherA5, setSelectedTeacherA5] = useState<string>('ALL'); // 'ALL' or teacherId

  // Synchronize state with URL parameters if provided (e.g. when opened in a new tab)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as PrintTab | null;
      if (tabParam && ['f4_attendance', 'a5_card', 'all_matrix'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      const dateParam = params.get('date');
      if (dateParam) setSelectedDateF4(dateParam);
      const sessionParam = params.get('session');
      if (sessionParam) setSelectedSessionF4(sessionParam);
      const buildingParam = params.get('building');
      if (buildingParam) setSelectedBuildingF4(buildingParam);
      const teacherParam = params.get('teacher');
      if (teacherParam) setSelectedTeacherA5(teacherParam);
    } catch (e) {
      // ignore
    }
  }, []);

  // Generate target URL for standalone print in a new tab (bypasses iframe sandbox flags)
  const getPrintUrl = () => {
    const params = new URLSearchParams();
    params.set('menu', 'print_center');
    params.set('tab', activeTab);
    if (selectedDateF4) params.set('date', selectedDateF4);
    if (selectedSessionF4) params.set('session', selectedSessionF4);
    if (selectedBuildingF4) params.set('building', selectedBuildingF4);
    if (selectedTeacherA5) params.set('teacher', selectedTeacherA5);
    params.set('print_only', 'true');
    params.set('autoPrint', 'true');
    return `?${params.toString()}`;
  };

  // Trigger browser print with sandbox / iframe fallback
  const handlePrint = () => {
    let directPrintTriggered = false;
    try {
      window.print();
      directPrintTriggered = true;
    } catch (err) {
      console.warn('Direct window.print() was intercepted or failed:', err);
    }

    // Inside iframe preview environments (like AI Studio), window.print() can be suppressed
    // by iframe sandbox without 'allow-modals'. If we are in an iframe or if print failed:
    if (window.self !== window.top) {
      try {
        const win = window.open(getPrintUrl(), '_blank');
        if (win) return;
      } catch (popupErr) {
        console.warn('window.open was blocked by browser:', popupErr);
      }
      setIsPrintSandboxModalOpen(true);
    }
  };

  // -------------------------------------------------------------
  // DATA FOR F4 DAFTAR HADIR
  // -------------------------------------------------------------
  const f4AttendanceData = useMemo(() => {
    return invigilatorSchedules
      .filter((inv) => {
        const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
        if (!exam) return false;
        if (selectedDateF4 && exam.exam_date !== selectedDateF4) return false;
        if (selectedSessionF4 !== 'ALL' && exam.session !== selectedSessionF4) return false;

        const room = rooms.find((r) => r.id === inv.room_id);
        if (selectedBuildingF4 !== 'ALL' && room?.building_id !== selectedBuildingF4) return false;

        return true;
      })
      .map((inv) => {
        const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
        const room = rooms.find((r) => r.id === inv.room_id);
        const b = room ? buildings.find((bg) => bg.id === room.building_id) : null;
        const sub = exam ? subjects.find((s) => s.id === exam.subject_id) : null;
        const teacher = teachers.find((t) => t.id === inv.teacher_id);
        return {
          ...inv,
          exam,
          room,
          building: b,
          subject: sub,
          teacher,
        };
      })
      .sort((a, b) => {
        const timeDiff = (a.exam?.start_time || '').localeCompare(b.exam?.start_time || '');
        if (timeDiff !== 0) return timeDiff;
        const roomDiff = (a.room?.code || '').localeCompare(b.room?.code || '', undefined, { numeric: true });
        if (roomDiff !== 0) return roomDiff;
        return (a.role || '').localeCompare(b.role || '');
      });
  }, [
    invigilatorSchedules,
    examSchedules,
    rooms,
    buildings,
    subjects,
    teachers,
    selectedDateF4,
    selectedSessionF4,
    selectedBuildingF4,
  ]);

  const handleExportDailyExcel = () => {
    if (!selectedDateF4) return;
    const formattedDayAndDate = formatIndonesianDayAndDate(selectedDateF4);

    const exportRows = f4AttendanceData.map((item, index) => ({
      no: index + 1,
      roomName: `${item.room?.name || 'Ruang'} (${item.building?.code || ''})`,
      sessionTime: `${item.exam?.session || '-'} (${item.exam?.start_time.slice(0, 5)} - ${item.exam?.end_time.slice(0, 5)})`,
      subjectName: item.subject?.name || '-',
      teacherName: item.teacher?.name || 'Belum Ditugaskan',
      invigilatorCode: item.teacher?.invigilator_code || '-',
      sigText: item.status === 'Hadir' ? 'HADIR' : '.......................',
      notes: item.status || item.notes || '-',
    }));

    exportDailyAttendanceToExcel(exportRows, {
      schoolName: settings.school_name || 'SMP BHINNEKA TUNGGAL IKA',
      examName: settings.exam_name || 'UJIAN SEKOLAH',
      academicYear: settings.academic_year || '2024/2025',
      dayAndDate: formattedDayAndDate,
      sessionInfo: selectedSessionF4 === 'ALL' ? 'Semua Sesi Ujian' : selectedSessionF4,
    });
  };

  const handleExportMatrixExcel = () => {
    exportAllExamMatrixToExcel(
      rooms,
      buildings,
      uniqueExamSessions,
      invigilatorSchedules,
      teachers,
      {
        schoolName: settings.school_name || 'SMP BHINNEKA TUNGGAL IKA',
        examName: settings.exam_name || 'UJIAN SEKOLAH',
        academicYear: settings.academic_year || '2024/2025',
      }
    );
  };

  // -------------------------------------------------------------
  // DATA FOR A5 KARTU PENGAWAS
  // -------------------------------------------------------------
  const activeTeachers = useMemo(() => {
    return teachers
      .filter((t) => t.active)
      .sort((a, b) =>
        (a.invigilator_code || '').localeCompare(b.invigilator_code || '', undefined, { numeric: true })
      );
  }, [teachers]);

  const a5CardsTeachers = useMemo(() => {
    if (selectedTeacherA5 === 'ALL') {
      return activeTeachers;
    }
    return activeTeachers.filter((t) => t.id === selectedTeacherA5);
  }, [activeTeachers, selectedTeacherA5]);

  // -------------------------------------------------------------
  // DATA FOR ALL MATRIX (Kode Pengawas + Lampiran)
  // -------------------------------------------------------------
  const activeRooms = useMemo(() => {
    return rooms
      .filter((r) => r.active)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [rooms]);

  const uniqueExamSessions = useMemo(() => {
    return examSchedules.sort((a, b) => {
      if (a.exam_date !== b.exam_date) return a.exam_date.localeCompare(b.exam_date);
      return a.start_time.localeCompare(b.start_time);
    });
  }, [examSchedules]);

  // Teacher lookup map
  const teacherMap = useMemo(() => {
    const map = new Map<string, Teacher>();
    teachers.forEach((t) => map.set(t.id, t));
    return map;
  }, [teachers]);

  // Workload count per teacher for attachment
  const teacherWorkloadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    invigilatorSchedules.forEach((inv) => {
      if (inv.teacher_id) {
        counts.set(inv.teacher_id, (counts.get(inv.teacher_id) || 0) + 1);
      }
    });
    return counts;
  }, [invigilatorSchedules]);

  return (
    <div className="space-y-6">
      {/* Page Header (Hidden when printing) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
              Pusat Cetak Dokumen Ujian
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">{settings.school_name || 'SMP Bhinneka Tunggal Ika'}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Cetak Dokumen Resmi Pengawas Ujian
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar Hadir Harian (Ukuran F4), Kartu Jadwal Guru (Ukuran A5), dan Master Jadwal All Ujian
            dalam bentuk Kode Pengawas beserta lampirannya.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'f4_attendance' && (
            <button
              onClick={handleExportDailyExcel}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              title="Download Daftar Hadir Pengawas Harian format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh Excel (.xlsx)</span>
            </button>
          )}

          {activeTab === 'all_matrix' && (
            <button
              onClick={handleExportMatrixExcel}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              title="Download Master Matriks Jadwal All Ujian & Lampiran format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh Excel (.xlsx)</span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              title="Cetak langsung menggunakan browser print"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang (Print / PDF)</span>
            </button>

            <a
              href={getPrintUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
              title="Buka dokumen di tab baru tanpa batas frame untuk langsung mencetak atau simpan sebagai PDF"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka di Tab Baru (Cetak / PDF)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Signatories Quick Reference Strip (Hidden when printing) */}
      <div className="print:hidden bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            Pejabat Penandatangan Dokumen:
          </span>
          <span>
            Kepala Sekolah: <strong>{settings.principal_name || 'Drs. H. Mulyono, M.Pd.'}</strong> (NIP. {settings.principal_nip || '-'})
          </span>
          <span className="text-slate-300">|</span>
          <span>
            Ketua Panitia: <strong>{settings.committee_chairman_name || 'Budi Santoso, S.Pd.'}</strong> (NIP. {settings.committee_chairman_nip || '-'})
          </span>
          <span className="text-slate-300">|</span>
          <span>
            Kota: <strong>{settings.document_city || 'Jakarta'}</strong>
          </span>
        </div>
        <span className="text-[11px] text-blue-600 font-semibold">
          (Ubah nama/NIP di menu Pengaturan &rarr; B. Pejabat & Penandatangan)
        </span>
      </div>

      {/* Mode Selector Tabs (Hidden when printing) */}
      <div className="print:hidden grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tab 1: F4 Attendance */}
        <button
          onClick={() => setActiveTab('f4_attendance')}
          className={`p-4 text-left border rounded-2xl transition-all cursor-pointer ${
            activeTab === 'f4_attendance'
              ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeTab === 'f4_attendance' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Daftar Hadir Pengawas Harian</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded">
                Kertas F4 / Folio (215 x 330 mm)
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Format resmi berita acara & daftar hadir pengawas per hari dan sesi ujian.
          </p>
        </button>

        {/* Tab 2: A5 Card */}
        <button
          onClick={() => setActiveTab('a5_card')}
          className={`p-4 text-left border rounded-2xl transition-all cursor-pointer ${
            activeTab === 'a5_card'
              ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeTab === 'a5_card' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Kartu Jadwal Pengawas Guru</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                Kertas A5 (148 x 210 mm)
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Kartu penugasan individu untuk dibagikan ke masing-masing guru pengawas.
          </p>
        </button>

        {/* Tab 3: All Matrix */}
        <button
          onClick={() => setActiveTab('all_matrix')}
          className={`p-4 text-left border rounded-2xl transition-all cursor-pointer ${
            activeTab === 'all_matrix'
              ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeTab === 'all_matrix' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Grid className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Jadwal Pengawas All Ujian</span>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.2 rounded">
                Format Kode Pengawas + Lampiran
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Matriks kode pengawas seluruh ruang dilampiri daftar kode & nama lengkap guru.
          </p>
        </button>
      </div>

      {/* Filter Control Bar for Active Tab (Hidden when printing) */}
      <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        {activeTab === 'f4_attendance' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Tanggal Ujian *
              </label>
              <select
                value={selectedDateF4}
                onChange={(e) => setSelectedDateF4(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {uniqueDates.map((date) => (
                  <option key={date} value={date}>
                    {formatIndonesianDate(date)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Filter Sesi</label>
              <select
                value={selectedSessionF4}
                onChange={(e) => setSelectedSessionF4(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="ALL">Semua Sesi</option>
                <option value="Sesi 1">Sesi 1</option>
                <option value="Sesi 2">Sesi 2</option>
                <option value="Sesi 3">Sesi 3</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Filter Gedung</label>
              <select
                value={selectedBuildingF4}
                onChange={(e) => setSelectedBuildingF4(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="ALL">Semua Gedung ({buildings.length})</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'a5_card' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="sm:w-80">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Guru Pengawas (atau Semua)
              </label>
              <select
                value={selectedTeacherA5}
                onChange={(e) => setSelectedTeacherA5(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="ALL">Cetak Semua Kartu Guru ({activeTeachers.length} Guru)</option>
                {activeTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.invigilator_code || 'GURU'}] {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Jika memilih "Semua Guru", browser akan otomatis membuat halaman baru (A5 page-break)
                untuk tiap guru.
              </span>
            </div>
          </div>
        )}

        {activeTab === 'all_matrix' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                Menampilkan matriks <strong>{activeRooms.length} Ruangan</strong> &times;{' '}
                <strong>{uniqueExamSessions.length} Sesi Ujian</strong> dengan Kode Pengawas (P01, P02...)
                dan Lampiran Daftar Nama Guru.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportMatrixExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                title="Download Excel Matriks & Lampiran Kode Pengawas"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Unduh Matriks (.xlsx)</span>
              </button>
              <span className="text-[11px] text-slate-400">Ukuran Rekomendasi: F4 / A4 Landscape</span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. PRINT PREVIEW: DAFTAR HADIR PENGAWAS HARIAN (F4 / FOLIO)              */}
      {/* ========================================================================= */}
      {activeTab === 'f4_attendance' && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm print:p-0 print:border-none print:shadow-none print-f4-wrapper">
          {/* Official School Header / Kop Surat with School Logo on Left */}
          <div className="pb-4 mb-4 border-b-2 border-black flex items-center justify-between gap-4">
            <SchoolKopLogo logoUrl={settings.school_logo} size="lg" />

            <div className="flex-1 text-center space-y-0.5">
              <div className="text-lg font-black uppercase tracking-widest text-black">
                {settings.school_name || 'SMP BHINNEKA TUNGGAL IKA'}
              </div>
              <div className="text-xs text-black font-medium">
                {settings.school_address || 'Jl. Pendidikan No. 1, Jakarta'}
              </div>
              <div className="pt-2 text-sm font-black uppercase tracking-wide text-black underline">
                DAFTAR HADIR & BERITA ACARA PENGAWAS RUANG
              </div>
              <div className="text-xs font-bold text-black uppercase">
                {settings.exam_name || 'UJIAN SEKOLAH'} &bull; TAHUN PELAJARAN {settings.academic_year || '2025/2026'}
              </div>
            </div>

            <div className="w-20 shrink-0 hidden sm:block print:block"></div>
          </div>

          {/* Metadata Pelaksanaan */}
          <div className="grid grid-cols-2 text-xs text-black font-semibold mb-4 gap-2">
            <div>
              <span>Hari / Tanggal : </span>
              <strong className="text-black">
                {selectedDateF4 ? formatIndonesianDayAndDate(selectedDateF4) : '-'}
              </strong>
            </div>
            <div className="text-right">
              <span>Sesi / Waktu : </span>
              <strong className="text-black">
                {selectedSessionF4 === 'ALL' ? 'Semua Sesi Ujian (Sesi 1 & 2)' : selectedSessionF4}
              </strong>
            </div>
          </div>

          {/* F4 Attendance Table (Susunan Kolom: No, Ruang, Sesi/Waktu, Mapel, Nama Pengawas, Kode, Tanda Tangan, Ket) */}
          <table className="w-full text-left border-collapse border border-black text-xs text-black">
            <thead>
              <tr className="bg-slate-100 print:bg-transparent border-b border-black text-center font-bold">
                <th className="border border-black py-2 px-2 w-10">No</th>
                <th className="border border-black py-2 px-3 w-28">Ruang</th>
                <th className="border border-black py-2 px-2 w-28">Sesi / Waktu</th>
                <th className="border border-black py-2 px-3">Mata Pelajaran</th>
                <th className="border border-black py-2 px-3">Nama Pengawas</th>
                <th className="border border-black py-2 px-2 w-16">Kode</th>
                <th className="border border-black py-2 px-3 w-36">Tanda Tangan</th>
                <th className="border border-black py-2 px-2 w-20">Ket.</th>
              </tr>
            </thead>
            <tbody>
              {f4AttendanceData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="border border-black py-8 text-center text-slate-500 italic">
                    Tidak ada jadwal pengawas untuk kriteria tanggal / sesi / gedung ini.
                  </td>
                </tr>
              ) : (
                f4AttendanceData.map((item, index) => {
                  const isOdd = (index + 1) % 2 !== 0;
                  return (
                    <tr key={`${item.id}_${index}`} className="border-b border-black">
                      <td className="border border-black py-2 px-2 text-center font-medium">{index + 1}</td>
                      <td className="border border-black py-2 px-3">
                        <strong className="block">{item.room?.name || 'Ruang'}</strong>
                        {item.building?.code && (
                          <span className="text-[10px] text-slate-600 block">{item.building.code}</span>
                        )}
                      </td>
                      <td className="border border-black py-2 px-2 text-center text-[11px]">
                        <span className="font-semibold block">{item.exam?.session || '-'}</span>
                        <span className="text-[10px] text-slate-600 font-mono">
                          {item.exam?.start_time.slice(0, 5)} - {item.exam?.end_time.slice(0, 5)}
                        </span>
                      </td>
                      <td className="border border-black py-2 px-3 font-medium">
                        {item.subject?.name || '-'}
                      </td>
                      <td className="border border-black py-2 px-3 font-semibold">
                        {item.teacher?.name || (
                          <span className="text-slate-400 italic">Belum Ditugaskan</span>
                        )}
                      </td>
                      <td className="border border-black py-2 px-2 text-center font-black font-mono">
                        {item.teacher?.invigilator_code || '-'}
                      </td>
                      <td className="border border-black py-2 px-3 align-middle">
                        {item.status === 'Hadir' ? (
                          <div className="text-emerald-800 text-[11px] font-bold text-center">
                            HADIR
                          </div>
                        ) : (
                          <div className={`text-[10px] ${isOdd ? 'text-left pl-1' : 'text-right pr-2'} min-h-[28px] flex items-end`}>
                            <span>{index + 1}. ..........................</span>
                          </div>
                        )}
                      </td>
                      <td className="border border-black py-2 px-2 text-center text-[10px]">
                        {item.status || item.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Signature Block */}
          <div className="grid grid-cols-2 text-xs text-black font-semibold mt-8 pt-4 gap-8">
            <div className="text-center">
              <div>Mengetahui,</div>
              <div className="font-bold">Kepala {settings.school_name || 'Sekolah'}</div>
              <div className="h-16"></div>
              <div className="font-bold underline">{settings.principal_name || 'Drs. H. Mulyono, M.Pd.'}</div>
              <div className="text-[11px]">
                {settings.principal_nip ? `NIP. ${settings.principal_nip}` : 'NIP. 196805121994031005'}
              </div>
            </div>

            <div className="text-center">
              <div>{settings.document_city || 'Jakarta'}, {selectedDateF4 ? formatIndonesianDate(selectedDateF4) : '...'}</div>
              <div className="font-bold">Ketua Panitia Ujian Sekolah</div>
              <div className="h-16"></div>
              <div className="font-bold underline">{settings.committee_chairman_name || 'Budi Santoso, S.Pd.'}</div>
              <div className="text-[11px]">
                {settings.committee_chairman_nip ? `NIP. ${settings.committee_chairman_nip}` : 'NIP. 197508142000031002'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PRINT PREVIEW: KARTU JADWAL PENGAWAS GURU (UKURAN A5)                  */}
      {/* ========================================================================= */}
      {activeTab === 'a5_card' && (
        <div className="space-y-6">
          {a5CardsTeachers.map((teacher, tIdx) => {
            const schedules = invigilatorSchedules
              .filter((inv) => inv.teacher_id === teacher.id)
              .map((inv) => {
                const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
                const room = rooms.find((r) => r.id === inv.room_id);
                const building = room ? buildings.find((b) => b.id === room.building_id) : null;
                const subject = exam ? subjects.find((s) => s.id === exam.subject_id) : null;
                return {
                  ...inv,
                  exam,
                  room,
                  building,
                  subject,
                };
              })
              .sort((a, b) => {
                if (a.exam && b.exam) {
                  if (a.exam.exam_date !== b.exam.exam_date) return a.exam.exam_date.localeCompare(b.exam.exam_date);
                  return a.exam.start_time.localeCompare(b.exam.start_time);
                }
                return 0;
              });

            return (
              <div
                key={teacher.id}
                className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm print:p-0 print:border-none print:shadow-none print-a5-card"
                style={{ breakAfter: 'page' }}
              >
                {/* A5 Header with School Logo on Left */}
                <div className="pb-2 mb-3 border-b-2 border-black flex items-center justify-between gap-3">
                  <SchoolKopLogo logoUrl={settings.school_logo} size="md" />

                  <div className="flex-1 text-center space-y-0.5">
                    <div className="text-xs font-black uppercase tracking-wider text-black">
                      {settings.school_name || 'SMP BHINNEKA TUNGGAL IKA'}
                    </div>
                    <div className="text-sm font-black uppercase tracking-wide text-black underline">
                      KARTU TUGAS PENGAWAS RUANG UJIAN
                    </div>
                    <div className="text-[10px] font-bold text-black uppercase">
                      {settings.exam_name || 'UJIAN SEKOLAH'} &bull; TP {settings.academic_year || '2025/2026'}
                    </div>
                  </div>

                  <div className="w-14 shrink-0 hidden sm:block print:block"></div>
                </div>

                {/* Teacher Info Box */}
                <div className="grid grid-cols-2 bg-slate-50 print:bg-transparent border border-black p-2.5 mb-3 text-xs text-black">
                  <div>
                    <div className="flex gap-2">
                      <span className="w-24 font-bold text-slate-600">Nama Guru:</span>
                      <strong className="text-black">{teacher.name}</strong>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-24 font-bold text-slate-600">Jenis Kelamin:</span>
                      <span>{teacher.gender}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <span className="font-bold text-slate-600">Kode Pengawas:</span>
                      <span className="px-2 py-0.5 bg-black text-white font-black font-mono rounded text-xs">
                        {teacher.invigilator_code || 'GURU'}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>NIP/Kode:</span>
                      <span>{teacher.employee_number || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Table of Duties */}
                <table className="w-full text-left border-collapse border border-black text-xs text-black mb-3">
                  <thead>
                    <tr className="bg-slate-100 print:bg-transparent border-b border-black text-center font-bold">
                      <th className="border border-black py-1.5 px-2 w-8">No</th>
                      <th className="border border-black py-1.5 px-2">Hari, Tanggal</th>
                      <th className="border border-black py-1.5 px-2 w-20">Sesi & Jam</th>
                      <th className="border border-black py-1.5 px-2">Mata Pelajaran</th>
                      <th className="border border-black py-1.5 px-2 w-24">Ruang & Gedung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="border border-black py-4 text-center text-slate-500 italic">
                          Belum ada jadwal pengawasan yang ditugaskan untuk guru ini.
                        </td>
                      </tr>
                    ) : (
                      schedules.map((item, idx) => (
                        <tr key={item.id} className="border-b border-black">
                          <td className="border border-black py-1.5 px-2 text-center">{idx + 1}</td>
                          <td className="border border-black py-1.5 px-2 font-medium">
                            {item.exam?.exam_date ? formatIndonesianDayAndDate(item.exam.exam_date, item.exam.day_name) : '-'}
                          </td>
                          <td className="border border-black py-1.5 px-2 text-center font-mono text-[11px]">
                            {item.exam?.session} ({item.exam?.start_time.slice(0, 5)})
                          </td>
                          <td className="border border-black py-1.5 px-2 font-semibold">
                            {item.subject?.name}
                          </td>
                          <td className="border border-black py-1.5 px-2 font-bold">
                            {item.room?.name} ({item.building?.code})
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Signature Block (Tata Tertib Dihapus) */}
                <div className="flex justify-end text-xs text-black pt-4">
                  <div className="text-center w-56">
                    <div>{settings.document_city || 'Jakarta'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div className="font-bold">Ketua Panitia Ujian</div>
                    <div className="h-14"></div>
                    <div className="font-bold underline">{settings.committee_chairman_name || 'Budi Santoso, S.Pd.'}</div>
                    <div className="text-[11px]">
                      {settings.committee_chairman_nip ? `NIP. ${settings.committee_chairman_nip}` : 'NIP. 197508142000031002'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PRINT PREVIEW: MASTER JADWAL ALL UJIAN (KODE PENGAWAS + LAMPIRAN)     */}
      {/* ========================================================================= */}
      {activeTab === 'all_matrix' && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm print:p-0 print:border-none print:shadow-none space-y-8">
          {/* SECTION A: MASTER MATRIKS KODE PENGAWAS */}
          <div className="space-y-4">
            <div className="pb-3 border-b-2 border-black flex items-center justify-between gap-4">
              <SchoolKopLogo logoUrl={settings.school_logo} size="md" />

              <div className="flex-1 text-center space-y-0.5">
                <div className="text-xs font-black uppercase tracking-wider text-black">
                  {settings.school_name || 'SMP BHINNEKA TUNGGAL IKA'}
                </div>
                <div className="text-base font-black uppercase tracking-wide text-black underline">
                  MASTER JADWAL PENGAWAS RUANG UJIAN (FORMAT KODE PENGAWAS)
                </div>
                <div className="text-xs font-bold text-black uppercase">
                  {settings.exam_name || 'UJIAN SEKOLAH'} &bull; TAHUN PELAJARAN {settings.academic_year || '2025/2026'}
                </div>
              </div>

              <div className="w-14 shrink-0 hidden sm:block print:block"></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-black text-xs text-black">
                <thead>
                  <tr className="bg-slate-100 print:bg-transparent border-b border-black text-center font-bold">
                    <th rowSpan={2} className="border border-black py-2 px-2 w-8">No</th>
                    <th rowSpan={2} className="border border-black py-2 px-3 w-28">Ruang Ujian</th>
                    <th rowSpan={2} className="border border-black py-2 px-2 w-16">Gedung</th>
                    {uniqueExamSessions.map((exam) => (
                      <th
                        key={exam.id}
                        colSpan={2}
                        className="border border-black py-1 px-2 text-center text-[10px]"
                      >
                        <div>{formatIndonesianDate(exam.exam_date).slice(0, 10)}</div>
                        <div className="font-mono">{exam.session}</div>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-50 print:bg-transparent border-b border-black text-center text-[10px] font-bold">
                    {uniqueExamSessions.map((exam) => (
                      <React.Fragment key={`${exam.id}_roles`}>
                        <th className="border border-black py-1 px-1 w-10">P1</th>
                        <th className="border border-black py-1 px-1 w-10">P2</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeRooms.map((room, rIdx) => {
                    const b = buildings.find((bg) => bg.id === room.building_id);

                    return (
                      <tr key={room.id} className="border-b border-black">
                        <td className="border border-black py-1.5 px-2 text-center">{rIdx + 1}</td>
                        <td className="border border-black py-1.5 px-3 font-bold">
                          {room.name} ({room.code})
                        </td>
                        <td className="border border-black py-1.5 px-2 text-center text-[10px]">
                          {b?.code || '-'}
                        </td>

                        {uniqueExamSessions.map((exam) => {
                          const inv1 = invigilatorSchedules.find(
                            (i) => i.exam_schedule_id === exam.id && i.room_id === room.id && i.role === 'Pengawas 1'
                          );
                          const inv2 = invigilatorSchedules.find(
                            (i) => i.exam_schedule_id === exam.id && i.room_id === room.id && i.role === 'Pengawas 2'
                          );

                          const teacher1 = inv1?.teacher_id ? teacherMap.get(inv1.teacher_id) : null;
                          const teacher2 = inv2?.teacher_id ? teacherMap.get(inv2.teacher_id) : null;

                          return (
                            <React.Fragment key={`${room.id}_${exam.id}`}>
                              <td className="border border-black py-1 px-1 text-center font-black font-mono text-[11px]">
                                {teacher1 ? teacher1.invigilator_code || 'P' : '-'}
                              </td>
                              <td className="border border-black py-1 px-1 text-center font-black font-mono text-[11px]">
                                {teacher2 ? teacher2.invigilator_code || 'P' : '-'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION B: LAMPIRAN KODE PENGAWAS DAN NAMA GURU */}
          <div className="pt-6 border-t-2 border-black space-y-4" style={{ breakBefore: 'page' }}>
            <div className="pb-2 border-b border-black flex items-center justify-between gap-4">
              <SchoolKopLogo logoUrl={settings.school_logo} size="sm" />

              <div className="flex-1 text-center space-y-0.5">
                <div className="text-sm font-black uppercase tracking-wide text-black underline">
                  LAMPIRAN: DAFTAR KODE PENGAWAS DAN NAMA LENGKAP GURU
                </div>
                <div className="text-[11px] font-bold text-black uppercase">
                  {settings.school_name || 'SMP BHINNEKA TUNGGAL IKA'} &bull; {settings.exam_name || 'UJIAN SEKOLAH'}
                </div>
              </div>

              <div className="w-12 shrink-0 hidden sm:block print:block"></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-black text-xs text-black">
                <thead>
                  <tr className="bg-slate-100 print:bg-transparent border-b border-black text-center font-bold">
                    <th className="border border-black py-2 px-2 w-10">No</th>
                    <th className="border border-black py-2 px-3 w-28">Kode Pengawas</th>
                    <th className="border border-black py-2 px-4">Nama Lengkap Guru</th>
                    <th className="border border-black py-2 px-3 w-28">Jenis Kelamin</th>
                    <th className="border border-black py-2 px-3 w-28 text-center">Total Mengawas</th>
                    <th className="border border-black py-2 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTeachers.map((t, idx) => {
                    const totalTugas = teacherWorkloadCounts.get(t.id) || 0;

                    return (
                      <tr key={t.id} className="border-b border-black">
                        <td className="border border-black py-1.5 px-2 text-center">{idx + 1}</td>
                        <td className="border border-black py-1.5 px-3 font-black font-mono text-center">
                          <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] print:bg-transparent print:text-black">
                            {t.invigilator_code || `P${String(idx + 1).padStart(2, '0')}`}
                          </span>
                        </td>
                        <td className="border border-black py-1.5 px-4 font-bold">
                          {t.name}
                        </td>
                        <td className="border border-black py-1.5 px-3">
                          {t.gender}
                        </td>
                        <td className="border border-black py-1.5 px-3 text-center font-bold font-mono">
                          {totalTugas} Sesi
                        </td>
                        <td className="border border-black py-1.5 px-3 text-[11px] text-slate-600">
                          {t.notes || 'Guru Pengawas'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-2 text-xs text-black font-semibold mt-8 pt-4 gap-8">
              <div className="text-center">
                <div>Mengetahui,</div>
                <div className="font-bold">Kepala {settings.school_name || 'Sekolah'}</div>
                <div className="h-16"></div>
                <div className="font-bold underline">{settings.principal_name || 'Drs. H. Mulyono, M.Pd.'}</div>
                <div className="text-[11px]">
                  {settings.principal_nip ? `NIP. ${settings.principal_nip}` : 'NIP. 196805121994031005'}
                </div>
              </div>

              <div className="text-center">
                <div>{settings.document_city || 'Jakarta'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div className="font-bold">Ketua Panitia Ujian Sekolah</div>
                <div className="h-16"></div>
                <div className="font-bold underline">{settings.committee_chairman_name || 'Budi Santoso, S.Pd.'}</div>
                <div className="text-[11px]">
                  {settings.committee_chairman_nip ? `NIP. ${settings.committee_chairman_nip}` : 'NIP. 197508142000031002'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog for Iframe/Sandbox Environment Guidance */}
      {isPrintSandboxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Cetak Dokumen & Unduh PDF</h3>
                  <p className="text-xs text-slate-500">Mode cetak resmi resolusi penuh</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintSandboxModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Batas Keamanan Iframe Browser</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Aplikasi saat ini berada di dalam jendela preview iframe yang membatasi kotak dialog printer bawaan browser.
                Untuk mencetak atau menyimpan PDF tanpa watermark atau potongan frame, buka dokumen di tab baru.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href={getPrintUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsPrintSandboxModalOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka di Tab Baru Sekarang (Otomatis Cetak)</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setIsPrintSandboxModalOpen(false);
                  try {
                    window.print();
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Coba Cetak di Jendela Ini Lagi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
