import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Calendar,
  Clock,
  Building2,
  DoorOpen,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UserX,
  ArrowRightLeft,
  DollarSign,
  Download,
  Printer,
  Search,
  Filter,
  Check,
  Users,
  FileSpreadsheet,
  BadgeCheck,
  XCircle,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { InvigilatorSchedule, Teacher } from '../../types/database';
import { formatIndonesianDate } from '../../lib/scheduleHelper';
import { Modal } from '../common/Modal';

export const AttendanceView: React.FC = () => {
  const {
    invigilatorSchedules,
    examSchedules,
    rooms,
    buildings,
    subjects,
    teachers,
    settings,
    updateSettings,
    quickConfirmAttendance,
    quickSubstituteInvigilator,
    batchConfirmAttendance,
  } = useData();

  const { success: toastSuccess, error: toastError } = useToast();

  // Active Tab: 'daily' | 'treasury'
  const [activeTab, setActiveTab] = useState<'daily' | 'treasury'>('daily');

  // Daily Filters
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(examSchedules.map((es) => es.exam_date))).sort();
  }, [examSchedules]);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    if (uniqueDates.includes(today)) return today;
    return uniqueDates[0] || '';
  });

  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Treasury Filters
  const [treasurySubjectFilter, setTreasurySubjectFilter] = useState<string>('ALL');
  const [treasuryDateFilter, setTreasuryDateFilter] = useState<string>('ALL');
  const [honorPerSession, setHonorPerSession] = useState<number>(
    settings?.honor_per_session || 40000
  );
  const [isEditingHonor, setIsEditingHonor] = useState<boolean>(false);

  // Selected IDs for batch checklist
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);

  // Substitution Modal State
  const [substitutionModalOpen, setSubstitutionModalOpen] = useState<boolean>(false);
  const [targetScheduleForSub, setTargetScheduleForSub] = useState<InvigilatorSchedule | null>(null);
  const [replacementTeacherId, setReplacementTeacherId] = useState<string>('');
  const [replacementReason, setReplacementReason] = useState<string>('Berhalangan mendadak (Sakit)');
  const [replacementNotes, setReplacementNotes] = useState<string>('');
  const [submittingSub, setSubmittingSub] = useState<boolean>(false);

  // Enriched daily schedules
  const dailySchedules = useMemo(() => {
    return invigilatorSchedules
      .filter((inv) => {
        const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
        if (!exam) return false;
        if (selectedDate && exam.exam_date !== selectedDate) return false;
        if (selectedSession !== 'ALL' && exam.session !== selectedSession) return false;

        const room = rooms.find((r) => r.id === inv.room_id);
        if (selectedBuilding !== 'ALL' && room?.building_id !== selectedBuilding) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const teacher = teachers.find((t) => t.id === inv.teacher_id);
          const sub = subjects.find((s) => s.id === exam.subject_id);
          const teacherMatch = teacher?.name.toLowerCase().includes(q) || teacher?.invigilator_code?.toLowerCase().includes(q);
          const roomMatch = room?.name.toLowerCase().includes(q) || room?.code.toLowerCase().includes(q);
          const subMatch = sub?.name.toLowerCase().includes(q);
          return teacherMatch || roomMatch || subMatch;
        }

        return true;
      })
      .map((inv) => {
        const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
        const room = rooms.find((r) => r.id === inv.room_id);
        const building = room ? buildings.find((b) => b.id === room.building_id) : null;
        const subject = exam ? subjects.find((s) => s.id === exam.subject_id) : null;
        const teacher = teachers.find((t) => t.id === inv.teacher_id);
        const replacementTeacher = inv.replacement_teacher_id
          ? teachers.find((t) => t.id === inv.replacement_teacher_id)
          : null;

        return {
          ...inv,
          exam,
          room,
          building,
          subject,
          teacher,
          replacementTeacher,
        };
      })
      .sort((a, b) => {
        const timeCompare = (a.exam?.start_time || '').localeCompare(b.exam?.start_time || '');
        if (timeCompare !== 0) return timeCompare;
        return (a.room?.code || '').localeCompare(b.room?.code || '', undefined, { numeric: true });
      });
  }, [
    invigilatorSchedules,
    examSchedules,
    rooms,
    buildings,
    subjects,
    teachers,
    selectedDate,
    selectedSession,
    selectedBuilding,
    searchQuery,
  ]);

  // Statistics for the selected day
  const stats = useMemo(() => {
    const total = dailySchedules.length;
    const hadir = dailySchedules.filter((s) => s.status === 'Hadir').length;
    const digantikan = dailySchedules.filter((s) => s.status === 'Digantikan').length;
    const izinSakit = dailySchedules.filter((s) => s.status === 'Izin' || s.status === 'Sakit').length;
    const alpha = dailySchedules.filter((s) => s.status === 'Alpha').length;
    const dijadwalkan = dailySchedules.filter((s) => s.status === 'Dijadwalkan').length;

    return { total, hadir, digantikan, izinSakit, alpha, dijadwalkan };
  }, [dailySchedules]);

  // Handle Quick Attendance Confirm
  const handleQuickStatus = async (
    scheduleId: string,
    status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpha'
  ) => {
    const res = await quickConfirmAttendance(scheduleId, status);
    if (res.success) {
      toastSuccess(`Status berhasil diubah menjadi ${status}`);
    } else {
      toastError(res.error || 'Gagal mengubah status');
    }
  };

  // Batch confirm all visible as Hadir
  const handleBatchConfirmAllVisible = async () => {
    const targetIds = dailySchedules.filter((s) => s.status !== 'Hadir').map((s) => s.id);
    if (targetIds.length === 0) {
      toastSuccess('Semua pengawas pada filter ini sudah terkonfirmasi Hadir.');
      return;
    }

    const updates = targetIds.map((id) => ({
      id,
      status: 'Hadir' as const,
      actualTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    }));

    const res = await batchConfirmAttendance(updates);
    if (res.success) {
      toastSuccess(`Berhasil mengonfirmasi Hadir untuk ${targetIds.length} pengawas.`);
      setSelectedScheduleIds([]);
    } else {
      toastError(res.error || 'Gagal konfirmasi massal.');
    }
  };

  // Batch confirm selected checkboxes
  const handleBatchConfirmSelected = async (status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpha') => {
    if (selectedScheduleIds.length === 0) {
      toastError('Pilih setidaknya satu pengawas.');
      return;
    }

    const updates = selectedScheduleIds.map((id) => ({
      id,
      status,
      actualTime: status === 'Hadir' ? new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : undefined,
    }));

    const res = await batchConfirmAttendance(updates);
    if (res.success) {
      toastSuccess(`Berhasil memperbarui ${selectedScheduleIds.length} pengawas menjadi ${status}.`);
      setSelectedScheduleIds([]);
    } else {
      toastError(res.error || 'Gagal update status terpilih.');
    }
  };

  // Open Substitution Modal
  const handleOpenSubstitution = (schedule: InvigilatorSchedule) => {
    setTargetScheduleForSub(schedule);
    setReplacementTeacherId('');
    setReplacementReason('Berhalangan mendadak (Sakit)');
    setReplacementNotes('');
    setSubstitutionModalOpen(true);
  };

  // Submit Substitution
  const handleSubmitSubstitution = async () => {
    if (!targetScheduleForSub || !replacementTeacherId) {
      toastError('Silakan pilih guru pengganti.');
      return;
    }

    setSubmittingSub(true);
    const res = await quickSubstituteInvigilator(
      targetScheduleForSub.id,
      replacementTeacherId,
      replacementReason
    );
    setSubmittingSub(false);

    if (res.success) {
      toastSuccess('Guru pengganti berhasil ditugaskan & dikonfirmasi Hadir!');
      setSubstitutionModalOpen(false);
      setTargetScheduleForSub(null);
    } else {
      toastError(res.error || 'Gagal menugaskan guru pengganti.');
    }
  };

  // Save Honorarium Setting
  const handleSaveHonor = async () => {
    await updateSettings({ honor_per_session: honorPerSession });
    setIsEditingHonor(false);
    toastSuccess('Tarif honor per sesi pengawas berhasil disimpan.');
  };

  // -------------------------------------------------------------
  // REKAP BENDAHARA (Dihitung per Mata Pelajaran & Sesi)
  // -------------------------------------------------------------
  const treasuryReport = useMemo(() => {
    // We group by teacherId, and calculate per subject
    interface SubjectBreakdown {
      subjectId: string;
      subjectName: string;
      subjectCode: string;
      count: number;
    }

    interface TeacherTreasuryItem {
      teacherId: string;
      teacherName: string;
      invigilatorCode: string;
      gender: string;
      employeeNumber: string;
      subjectBreakdowns: SubjectBreakdown[];
      totalSessionsAttended: number;
      totalHonor: number;
      allConfirmed: boolean;
    }

    const teacherMap = new Map<string, TeacherTreasuryItem>();

    // Initialize all active teachers
    teachers
      .filter((t) => t.active)
      .forEach((t) => {
        teacherMap.set(t.id, {
          teacherId: t.id,
          teacherName: t.name,
          invigilatorCode: t.invigilator_code || '-',
          gender: t.gender,
          employeeNumber: t.employee_number || '-',
          subjectBreakdowns: [],
          totalSessionsAttended: 0,
          totalHonor: 0,
          allConfirmed: true,
        });
      });

    // Tally attendance
    invigilatorSchedules.forEach((inv) => {
      // Must be confirmed Hadir or Digantikan (if this teacher was the active replacement)
      const isAttended = inv.status === 'Hadir' || inv.status === 'Digantikan';
      if (!isAttended || !inv.teacher_id) return;

      const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
      if (!exam) return;

      // Filter by treasury date if set
      if (treasuryDateFilter !== 'ALL' && exam.exam_date !== treasuryDateFilter) return;

      // Filter by treasury subject if set
      if (treasurySubjectFilter !== 'ALL' && exam.subject_id !== treasurySubjectFilter) return;

      const subject = subjects.find((s) => s.id === exam.subject_id);
      if (!subject) return;

      let item = teacherMap.get(inv.teacher_id);
      if (!item) {
        const t = teachers.find((tc) => tc.id === inv.teacher_id);
        item = {
          teacherId: inv.teacher_id,
          teacherName: t?.name || 'Guru Tidak Dikenal',
          invigilatorCode: t?.invigilator_code || '-',
          gender: t?.gender || 'Laki-laki',
          employeeNumber: t?.employee_number || '-',
          subjectBreakdowns: [],
          totalSessionsAttended: 0,
          totalHonor: 0,
          allConfirmed: true,
        };
        teacherMap.set(inv.teacher_id, item);
      }

      item.totalSessionsAttended += 1;
      if (!inv.confirmed_by_admin) {
        item.allConfirmed = false;
      }

      // Add to subject breakdown
      const existingSub = item.subjectBreakdowns.find((sb) => sb.subjectId === subject.id);
      if (existingSub) {
        existingSub.count += 1;
      } else {
        item.subjectBreakdowns.push({
          subjectId: subject.id,
          subjectName: subject.name,
          subjectCode: subject.code,
          count: 1,
        });
      }
    });

    // Calculate total honor
    const currentHonorRate = settings?.honor_per_session || honorPerSession || 40000;
    const result: TeacherTreasuryItem[] = [];

    teacherMap.forEach((item) => {
      item.totalHonor = item.totalSessionsAttended * currentHonorRate;
      if (item.totalSessionsAttended > 0) {
        result.push(item);
      }
    });

    // Sort by invigilator code or name
    return result.sort((a, b) => a.invigilatorCode.localeCompare(b.invigilatorCode, undefined, { numeric: true }));
  }, [
    teachers,
    invigilatorSchedules,
    examSchedules,
    subjects,
    treasuryDateFilter,
    treasurySubjectFilter,
    settings?.honor_per_session,
    honorPerSession,
  ]);

  // Grand totals for treasury
  const grandTotalSessions = useMemo(() => {
    return treasuryReport.reduce((acc, curr) => acc + curr.totalSessionsAttended, 0);
  }, [treasuryReport]);

  const grandTotalHonor = useMemo(() => {
    return treasuryReport.reduce((acc, curr) => acc + curr.totalHonor, 0);
  }, [treasuryReport]);

  // Export Treasury to CSV
  const handleExportTreasuryCSV = () => {
    const rate = settings?.honor_per_session || honorPerSession || 40000;
    const headers = [
      'No',
      'Kode Pengawas',
      'Nama Guru',
      'Rincian Mata Pelajaran & Sesi',
      'Total Sesi Hadir',
      'Honor per Sesi (Rp)',
      'Total Honor Diterima (Rp)',
      'Status Verifikasi Admin',
    ];

    const rows = treasuryReport.map((t, idx) => {
      const subjectDetail = t.subjectBreakdowns
        .map((sb) => `${sb.subjectName} (${sb.count} sesi)`)
        .join('; ');

      return [
        idx + 1,
        `"${t.invigilatorCode}"`,
        `"${t.teacherName}"`,
        `"${subjectDetail}"`,
        t.totalSessionsAttended,
        rate,
        t.totalHonor,
        t.allConfirmed ? 'Sudah Diverifikasi' : 'Pending Verifikasi',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Laporan_Honor_Pengawas_Bendahara_${settings?.school_name?.replace(/\s+/g, '_') || 'SMP'}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toastSuccess('File rekap bendahara berhasil diunduh (CSV).');
  };

  return (
    <div className="space-y-6">
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
              Pengawasan & Keuangan
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">SMP Bhinneka Tunggal Ika</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Kehadiran Pengawas & Laporan Bendahara
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Konfirmasi kehadiran pengawas di ruang ujian oleh admin, penanganan guru pengganti darurat,
            dan rekap honorarium per mata pelajaran untuk pelaporan ke bendahara.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'daily'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Pengawas Hari Ini & Konfirmasi</span>
          </button>
          <button
            onClick={() => setActiveTab('treasury')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'treasury'
                ? 'bg-white text-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Rekap Laporan Bendahara</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PENGAWAS HARI INI & KONFIRMASI KEHADIRAN                           */}
      {/* ========================================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Tanggal Ujian */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  Tanggal Pelaksanaan
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {uniqueDates.map((date) => (
                    <option key={date} value={date}>
                      {formatIndonesianDate(date)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sesi Ujian */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Sesi Ujian
                </label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="ALL">Semua Sesi</option>
                  <option value="Sesi 1">Sesi 1</option>
                  <option value="Sesi 2">Sesi 2</option>
                  <option value="Sesi 3">Sesi 3</option>
                </select>
              </div>

              {/* Gedung */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  Gedung
                </label>
                <select
                  value={selectedBuilding}
                  onChange={(e) => setSelectedBuilding(e.target.value)}
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

              {/* Pencarian Nama Guru / Kode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-blue-600" />
                  Cari Guru / Ruang
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama, kode pengawas, atau ruang..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Tugas
                </span>
                <span className="text-base font-black text-slate-800">{stats.total}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Hadir
                </span>
                <span className="text-base font-black text-emerald-700">{stats.hadir}</span>
              </div>
              <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-center">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                  Digantikan
                </span>
                <span className="text-base font-black text-purple-700">{stats.digantikan}</span>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Izin / Sakit
                </span>
                <span className="text-base font-black text-amber-700">{stats.izinSakit}</span>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                  Belum Verifikasi
                </span>
                <span className="text-base font-black text-blue-700">{stats.dijadwalkan}</span>
              </div>
            </div>
          </div>

          {/* Action Header & Bulk Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  dailySchedules.length > 0 &&
                  selectedScheduleIds.length === dailySchedules.length
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedScheduleIds(dailySchedules.map((s) => s.id));
                  } else {
                    setSelectedScheduleIds([]);
                  }
                }}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span className="text-xs font-semibold text-slate-700">
                Pilih Semua ({selectedScheduleIds.length} dari {dailySchedules.length} dipilih)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedScheduleIds.length > 0 && (
                <>
                  <button
                    onClick={() => handleBatchConfirmSelected('Hadir')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ceklist Hadir ({selectedScheduleIds.length})</span>
                  </button>
                  <button
                    onClick={() => handleBatchConfirmSelected('Izin')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    <span>Izin</span>
                  </button>
                  <button
                    onClick={() => handleBatchConfirmSelected('Alpha')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    <span>Alpha</span>
                  </button>
                </>
              )}

              <button
                onClick={handleBatchConfirmAllVisible}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors ml-auto"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Konfirmasi Semua Hadir Hari Ini</span>
              </button>
            </div>
          </div>

          {/* Daily Invigilator List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4 w-10 text-center">
                      <span className="sr-only">Pilih</span>
                    </th>
                    <th className="py-3 px-4">Ruang & Gedung</th>
                    <th className="py-3 px-4">Sesi & Mata Pelajaran</th>
                    <th className="py-3 px-4">Peran</th>
                    <th className="py-3 px-4">Pengawas Terjadwal</th>
                    <th className="py-3 px-4">Status & Waktu</th>
                    <th className="py-3 px-4 text-right">Aksi Konfirmasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {dailySchedules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold">Tidak ada jadwal pengawas pada filter ini</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Silakan pilih tanggal lain atau generate jadwal pengawas terlebih dahulu.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    dailySchedules.map((item) => {
                      const isSelected = selectedScheduleIds.includes(item.id);

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isSelected ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedScheduleIds((prev) => [...prev, item.id]);
                                } else {
                                  setSelectedScheduleIds((prev) =>
                                    prev.filter((id) => id !== item.id)
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                            />
                          </td>

                          {/* Ruang & Gedung */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">
                              {item.room?.name} ({item.room?.code})
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>{item.building?.name || 'Gedung Sekolah'}</span>
                            </div>
                          </td>

                          {/* Sesi & Mapel */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-700">
                                {item.exam?.session}
                              </span>
                              <span>{item.exam?.start_time.slice(0, 5)} - {item.exam?.end_time.slice(0, 5)}</span>
                            </div>
                            <div className="text-[11px] text-blue-600 font-bold mt-0.5 flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              <span>{item.subject?.name}</span>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                item.role === 'Pengawas 1'
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.role === 'Pengawas 2'
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.role}
                            </span>
                          </td>

                          {/* Teacher */}
                          <td className="py-3 px-4">
                            {item.teacher ? (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.2 bg-slate-800 text-white rounded text-[10px] font-black tracking-wider">
                                    {item.teacher.invigilator_code || 'GURU'}
                                  </span>
                                  <span className="font-bold text-slate-900">
                                    {item.teacher.name}
                                  </span>
                                </div>
                                {item.replacementTeacher && (
                                  <div className="text-[10px] text-purple-700 font-semibold mt-0.5 flex items-center gap-1">
                                    <ArrowRightLeft className="w-3 h-3" />
                                    <span>
                                      Pengganti darurat: {item.teacher.name} (
                                      {item.teacher.invigilator_code})
                                    </span>
                                  </div>
                                )}
                                {item.notes && (
                                  <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                                    {item.notes}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[11px] font-bold">
                                Belum Ditugaskan
                              </span>
                            )}
                          </td>

                          {/* Status Kehadiran */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                                  item.status === 'Hadir'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.status === 'Digantikan'
                                    ? 'bg-purple-100 text-purple-800'
                                    : item.status === 'Izin'
                                    ? 'bg-amber-100 text-amber-800'
                                    : item.status === 'Sakit'
                                    ? 'bg-orange-100 text-orange-800'
                                    : item.status === 'Alpha'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {item.status === 'Hadir' && <CheckCircle2 className="w-3 h-3" />}
                                {item.status === 'Digantikan' && <ArrowRightLeft className="w-3 h-3" />}
                                {item.status === 'Alpha' && <XCircle className="w-3 h-3" />}
                                <span>{item.status}</span>
                              </span>

                              {item.actual_attendance_time && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Masuk: {item.actual_attendance_time}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick Hadir Button */}
                              {item.status !== 'Hadir' && (
                                <button
                                  onClick={() => handleQuickStatus(item.id, 'Hadir')}
                                  title="Konfirmasi Hadir"
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Hadir</span>
                                </button>
                              )}

                              {/* Ganti Pengawas Button */}
                              <button
                                onClick={() => handleOpenSubstitution(item)}
                                title="Ganti guru lain jika mendadak tidak hadir"
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Ganti Guru</span>
                              </button>

                              {/* Dropdown status lainnya */}
                              <select
                                value={item.status}
                                onChange={(e) =>
                                  handleQuickStatus(
                                    item.id,
                                    e.target.value as 'Hadir' | 'Izin' | 'Sakit' | 'Alpha'
                                  )
                                }
                                className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                              >
                                <option value="Dijadwalkan">Dijadwalkan</option>
                                <option value="Hadir">Hadir</option>
                                <option value="Izin">Izin</option>
                                <option value="Sakit">Sakit</option>
                                <option value="Alpha">Alpha</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REKAP BENDAHARA (Dihitung per Mata Pelajaran & Sesi)               */}
      {/* ========================================================================= */}
      {activeTab === 'treasury' && (
        <div className="space-y-6">
          {/* Treasury Filter & Honorarium Settings Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                    Laporan Keuangan Ujian
                  </span>
                  <span className="text-xs text-slate-500">
                    Rekapitulasi Honorarium Pengawas Ruang
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Laporan Rekapitulasi Kehadiran untuk Bendahara Sekolah
                </h2>
                <p className="text-xs text-slate-500">
                  Dihitung berdasarkan jumlah sesi dan mata pelajaran yang diawasi oleh masing-masing guru.
                </p>
              </div>

              {/* Setting Honor per Sesi */}
              <div className="flex items-center gap-3 bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Tarif Honor per Sesi / Mapel
                  </span>
                  {isEditingHonor ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-emerald-900">Rp</span>
                      <input
                        type="number"
                        value={honorPerSession}
                        onChange={(e) => setHonorPerSession(Number(e.target.value))}
                        className="w-28 px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-bold text-slate-800 focus:outline-hidden"
                      />
                      <button
                        onClick={handleSaveHonor}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700"
                      >
                        Simpan
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-emerald-900">
                        Rp {honorPerSession.toLocaleString('id-ID')}
                      </span>
                      <button
                        onClick={() => setIsEditingHonor(true)}
                        className="text-[11px] font-bold text-emerald-700 hover:underline"
                      >
                        Ubah
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Filter Mata Pelajaran
                </label>
                <select
                  value={treasurySubjectFilter}
                  onChange={(e) => setTreasurySubjectFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="ALL">Semua Mata Pelajaran ({subjects.length})</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Filter Tanggal Ujian
                </label>
                <select
                  value={treasuryDateFilter}
                  onChange={(e) => setTreasuryDateFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="ALL">Semua Tanggal Ujian</option>
                  {uniqueDates.map((date) => (
                    <option key={date} value={date}>
                      {formatIndonesianDate(date)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={handleExportTreasuryCSV}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Rekap Excel (CSV)</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak</span>
                </button>
              </div>
            </div>
          </div>

          {/* Treasury Summary Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Jumlah Guru Bertugas
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {treasuryReport.length} <span className="text-xs font-normal text-slate-500">Guru</span>
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total Sesi/Mapel Diawasi
              </span>
              <span className="text-2xl font-black text-blue-600 mt-1 block">
                {grandTotalSessions} <span className="text-xs font-normal text-slate-500">Sesi</span>
              </span>
            </div>

            <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-200 shadow-xs">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Total Anggaran Honorarium Bendahara
              </span>
              <span className="text-2xl font-black text-emerald-800 mt-1 block">
                Rp {grandTotalHonor.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Treasury Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Daftar Rincian Pengawas & Honorarium per Mata Pelajaran
              </h3>
              <span className="text-[11px] text-slate-500">
                {treasuryReport.length} guru pengawas terdaftar
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4 w-28">Kode Pengawas</th>
                    <th className="py-3 px-4">Nama Lengkap Guru</th>
                    <th className="py-3 px-4">Rincian Mata Pelajaran Diawasi</th>
                    <th className="py-3 px-4 text-center">Total Sesi</th>
                    <th className="py-3 px-4 text-right">Honor / Sesi</th>
                    <th className="py-3 px-4 text-right">Total Diterima</th>
                    <th className="py-3 px-4 text-center">Verifikasi</th>
                    <th className="py-3 px-4 w-28 text-center">Tanda Tangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {treasuryReport.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <DollarSign className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold">Belum ada data kehadiran pengawas yang terkonfirmasi</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Gunakan tab "Pengawas Hari Ini" untuk melakukan ceklist kehadiran terlebih dahulu.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    treasuryReport.map((item, idx) => (
                      <tr key={item.teacherId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-black tracking-wider">
                            {item.invigilatorCode}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.teacherName}</div>
                          <div className="text-[10px] text-slate-400">NIP/Kode: {item.employeeNumber}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {item.subjectBreakdowns.map((sb) => (
                              <span
                                key={sb.subjectId}
                                className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-100 rounded text-[10px] font-semibold"
                              >
                                {sb.subjectName}: <strong>{sb.count}x</strong>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-black text-slate-800">
                          {item.totalSessionsAttended}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 font-mono">
                          Rp {(settings?.honor_per_session || honorPerSession).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700 font-mono text-sm">
                          Rp {item.totalHonor.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.allConfirmed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.allConfirmed ? 'Diverifikasi' : 'Sebagian'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="h-8 border-b border-dashed border-slate-300"></div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {treasuryReport.length > 0 && (
                  <tfoot>
                    <tr className="bg-emerald-50/70 border-t-2 border-emerald-300 font-bold text-xs text-emerald-950">
                      <td colSpan={4} className="py-3.5 px-4 text-right uppercase tracking-wider">
                        Grand Total Honorarium:
                      </td>
                      <td className="py-3.5 px-4 text-center font-black">{grandTotalSessions} Sesi</td>
                      <td className="py-3.5 px-4"></td>
                      <td className="py-3.5 px-4 text-right font-black text-base text-emerald-900 font-mono">
                        Rp {grandTotalHonor.toLocaleString('id-ID')}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL GANTI GURU PENGAWAS MENDADAK                                        */}
      {/* ========================================================================= */}
      {substitutionModalOpen && targetScheduleForSub && (
        <Modal
          isOpen={substitutionModalOpen}
          onClose={() => setSubstitutionModalOpen(false)}
          title="Ganti Guru Pengawas (Penggantian Darurat)"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                Tugas Pengawasan
              </span>
              <div className="text-xs font-bold text-purple-950">
                Ruang {targetScheduleForSub.room?.name} &bull; Sesi {targetScheduleForSub.exam_schedule?.session} &bull; {targetScheduleForSub.role}
              </div>
              <div className="text-[11px] text-purple-700">
                Guru Berhalangan: <strong>{targetScheduleForSub.teacher?.name || 'Belum ada'}</strong> (
                {targetScheduleForSub.teacher?.invigilator_code || '-'})
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Guru Pengganti *
              </label>
              <select
                value={replacementTeacherId}
                onChange={(e) => setReplacementTeacherId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              >
                <option value="">-- Pilih Guru Pengganti --</option>
                {teachers
                  .filter((t) => t.active && t.id !== targetScheduleForSub.teacher_id)
                  .sort((a, b) => (a.invigilator_code || '').localeCompare(b.invigilator_code || '', undefined, { numeric: true }))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.invigilator_code || 'GURU'}] {t.name} ({t.gender})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alasan Penggantian
              </label>
              <select
                value={replacementReason}
                onChange={(e) => setReplacementReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              >
                <option value="Berhalangan mendadak (Sakit)">Berhalangan mendadak (Sakit)</option>
                <option value="Izin urusan keluarga mendesak">Izin urusan keluarga mendesak</option>
                <option value="Tugas kedinasan / luar sekolah">Tugas kedinasan / luar sekolah</option>
                <option value="Terlambat hadir / tidak ada kabar">Terlambat hadir / tidak ada kabar</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                value={replacementNotes}
                onChange={(e) => setReplacementNotes(e.target.value)}
                placeholder="Contoh: Menggantikan guru jam 07:10 atas instruksi Kepala Sekolah..."
                rows={2}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSubstitutionModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitSubstitution}
                disabled={submittingSub || !replacementTeacherId}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{submittingSub ? 'Memproses...' : 'Tugaskan Pengganti'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
