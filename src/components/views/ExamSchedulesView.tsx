import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ExamSchedule, MenuItemId, Subject } from '../../types/database';
import { exportToSpreadsheet } from '../../lib/excelHelper';
import {
  INDONESIAN_DAYS,
  formatIndonesianDate,
  calculateScheduleMetrics,
  isTimeOverlap,
  normalizeSession,
} from '../../lib/scheduleHelper';

// Subcomponents
import { ExamScheduleDetailModal } from '../schedules/ExamScheduleDetailModal';
import { ExamScheduleFormModal } from '../schedules/ExamScheduleFormModal';
import { ExamScheduleImportModal } from '../schedules/ExamScheduleImportModal';
import { ExamScheduleCalendarView } from '../schedules/ExamScheduleCalendarView';
import { EmptyState } from '../common/EmptyState';
import { Modal } from '../common/Modal';

// Icons
import {
  CalendarDays,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Calendar,
  Clock,
  BookOpen,
  Users,
  DoorOpen,
  CheckCircle2,
  Clock3,
  AlertCircle,
  AlertTriangle,
  Eye,
  Edit2,
  Trash2,
  ArrowRight,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface ExamSchedulesViewProps {
  onNavigate?: (menu: MenuItemId) => void;
}

export const ExamSchedulesView: React.FC<ExamSchedulesViewProps> = ({ onNavigate }) => {
  const {
    examSchedules,
    subjects,
    rooms,
    teachers,
    invigilatorSchedules,
    settings,
    deleteExamSchedule,
  } = useData();
  const { role } = useAuth();
  const { success, error } = useToast();
  const isAdmin = role === 'ADMIN';

  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterSession, setFilterSession] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ExamSchedule | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ExamSchedule | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<ExamSchedule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Active rooms & settings calculation
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);
  const activeTeachers = useMemo(() => teachers.filter((t) => t.active), [teachers]);
  const invigilatorsPerRoom = settings.default_invigilators_per_room || 2;
  const needsPerSession = activeRooms.length * invigilatorsPerRoom;

  // Available unique dates and sessions for filter dropdowns
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(examSchedules.map((es) => es.exam_date)));
    return dates.sort();
  }, [examSchedules]);

  const availableSessions = useMemo(() => {
    const sessions = Array.from(new Set(examSchedules.map((es) => es.session)));
    return sessions.sort();
  }, [examSchedules]);

  // Global schedule summary metrics
  const summaryMetrics = useMemo(() => {
    const totalSchedules = examSchedules.length;
    const distinctDays = new Set(examSchedules.map((es) => es.exam_date)).size;
    const totalRooms = activeRooms.length;
    const totalInvigilatorNeeds = totalSchedules * needsPerSession;
    
    // Count filled assignments across all schedules
    const totalAssigned = invigilatorSchedules.filter((inv) => !!inv.teacher_id).length;
    const totalMissing = Math.max(0, totalInvigilatorNeeds - totalAssigned);

    return {
      totalSchedules,
      distinctDays,
      totalRooms,
      totalInvigilatorNeeds,
      totalAssigned,
      totalMissing,
    };
  }, [examSchedules, activeRooms, needsPerSession, invigilatorSchedules]);

  // Validation Warnings
  const systemWarnings = useMemo(() => {
    const warnings: { id: string; message: string; type: 'error' | 'warning' }[] = [];

    // 1. Check if active rooms exist
    if (activeRooms.length === 0) {
      warnings.push({
        id: 'no_active_rooms',
        type: 'error',
        message:
          'Peringatan: Belum ada ruang ujian yang berstatus aktif di Data Master. Perhitungan kebutuhan pengawas belum dapat dilakukan dengan akurat.',
      });
    }

    // 2. Check teacher availability vs needs per session
    if (activeRooms.length > 0 && activeTeachers.length < needsPerSession) {
      warnings.push({
        id: 'insufficient_teachers',
        type: 'warning',
        message: `Peringatan: Jumlah guru aktif (${activeTeachers.length} orang) kurang dari kebutuhan penugasan per sesi (${needsPerSession} pengawas: ${activeRooms.length} ruang × ${invigilatorsPerRoom} pengawas).`,
      });
    }

    // 3. Check for exam schedule time/session conflicts
    const dateMap = new Map<string, ExamSchedule[]>();
    examSchedules.forEach((es) => {
      const list = dateMap.get(es.exam_date) || [];
      list.push(es);
      dateMap.set(es.exam_date, list);
    });

    let conflictCount = 0;
    dateMap.forEach((schedulesOnDate) => {
      if (schedulesOnDate.length > 1) {
        for (let i = 0; i < schedulesOnDate.length; i++) {
          for (let j = i + 1; j < schedulesOnDate.length; j++) {
            const a = schedulesOnDate[i];
            const b = schedulesOnDate[j];
            const sameSession =
              normalizeSession(a.session).toLowerCase() ===
              normalizeSession(b.session).toLowerCase();
            const timeOverlap = isTimeOverlap(
              a.start_time,
              a.end_time,
              b.start_time,
              b.end_time
            );

            if (sameSession || timeOverlap) {
              conflictCount++;
            }
          }
        }
      }
    });

    if (conflictCount > 0) {
      warnings.push({
        id: 'schedule_collision',
        type: 'warning',
        message: `Peringatan: Terdapat ${conflictCount} potensi bentrok jadwal ujian pada tanggal atau rentang jam yang sama. Silakan periksa daftar jadwal.`,
      });
    }

    // 4. Incomplete invigilators
    if (examSchedules.length > 0 && summaryMetrics.totalMissing > 0) {
      warnings.push({
        id: 'incomplete_invigilators',
        type: 'warning',
        message: `Perhatian: Masih terdapat kekurangan ${summaryMetrics.totalMissing} penugasan pengawas yang belum terisi. Buka menu Penjadwalan Pengawas untuk melengkapi.`,
      });
    }

    return warnings;
  }, [
    activeRooms,
    activeTeachers,
    needsPerSession,
    invigilatorsPerRoom,
    examSchedules,
    summaryMetrics.totalMissing,
  ]);

  // Filtering Logic
  const filteredSchedules = useMemo(() => {
    return examSchedules.filter((es) => {
      const sub = subjects.find((s) => s.id === es.subject_id);
      const q = searchTerm.toLowerCase().trim();

      // Search match
      const matchSearch =
        !q ||
        es.exam_date.toLowerCase().includes(q) ||
        es.day_name.toLowerCase().includes(q) ||
        es.session.toLowerCase().includes(q) ||
        (sub && sub.name.toLowerCase().includes(q)) ||
        (sub && sub.code.toLowerCase().includes(q)) ||
        (es.notes && es.notes.toLowerCase().includes(q));

      // Filter Date
      const matchDate = !filterDate || es.exam_date === filterDate;

      // Filter Day
      const matchDay = !filterDay || es.day_name === filterDay;

      // Filter Subject
      const matchSubject = !filterSubjectId || es.subject_id === filterSubjectId;

      // Filter Session
      const matchSession =
        !filterSession ||
        normalizeSession(es.session).toLowerCase() ===
          normalizeSession(filterSession).toLowerCase();

      // Filter Status
      let matchStatus = true;
      if (filterStatus) {
        const filled = invigilatorSchedules.filter(
          (inv) => inv.exam_schedule_id === es.id && !!inv.teacher_id
        ).length;
        const metrics = calculateScheduleMetrics(
          activeRooms.length,
          invigilatorsPerRoom,
          filled
        );
        matchStatus = metrics.status === filterStatus;
      }

      return matchSearch && matchDate && matchDay && matchSubject && matchSession && matchStatus;
    });
  }, [
    examSchedules,
    subjects,
    searchTerm,
    filterDate,
    filterDay,
    filterSubjectId,
    filterSession,
    filterStatus,
    invigilatorSchedules,
    activeRooms.length,
    invigilatorsPerRoom,
  ]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredSchedules.length / pageSize) || 1;
  const paginatedSchedules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSchedules.slice(start, start + pageSize);
  }, [filteredSchedules, currentPage, pageSize]);

  // Handlers for Add & Edit
  const handleOpenAdd = () => {
    setEditingSchedule(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (schedule: ExamSchedule) => {
    setEditingSchedule(schedule);
    setIsFormModalOpen(true);
  };

  const handleOpenDetail = (schedule: ExamSchedule) => {
    setSelectedSchedule(schedule);
    setIsDetailModalOpen(true);
  };

  const handleOpenDelete = (schedule: ExamSchedule) => {
    setScheduleToDelete(schedule);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!scheduleToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteExamSchedule(scheduleToDelete.id);
      if (!res.success) throw new Error(res.error || 'Gagal menghapus jadwal');
      success('Jadwal ujian berhasil dihapus');
      setIsDeleteModalOpen(false);
      setScheduleToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan';
      error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterDate('');
    setFilterDay('');
    setFilterSubjectId('');
    setFilterSession('');
    setFilterStatus('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(searchTerm) ||
    Boolean(filterDate) ||
    Boolean(filterDay) ||
    Boolean(filterSubjectId) ||
    Boolean(filterSession) ||
    Boolean(filterStatus);

  // Export handler
  const handleExportData = (format: 'xlsx' | 'csv') => {
    if (filteredSchedules.length === 0) {
      error('Tidak ada data jadwal untuk diekspor');
      return;
    }

    const exportRows = filteredSchedules.map((es) => {
      const sub = subjects.find((s) => s.id === es.subject_id);
      const filled = invigilatorSchedules.filter(
        (inv) => inv.exam_schedule_id === es.id && !!inv.teacher_id
      ).length;
      const metrics = calculateScheduleMetrics(
        activeRooms.length,
        invigilatorsPerRoom,
        filled
      );

      return {
        Tanggal: es.exam_date,
        Hari: es.day_name,
        'Mata Pelajaran': sub?.name || 'Mata Pelajaran',
        'Kode Mapel': sub?.code || '-',
        Sesi: es.session,
        'Jam Mulai': es.start_time.slice(0, 5),
        'Jam Selesai': es.end_time.slice(0, 5),
        'Jumlah Ruang Aktif': metrics.activeRoomsCount,
        'Target Pengawas per Ruang': metrics.invigilatorsPerRoom,
        'Total Kebutuhan Pengawas': metrics.totalRequired,
        'Pengawas Terisi': metrics.totalFilled,
        'Pengawas Masih Kurang': metrics.totalMissing,
        'Status Pengawas': metrics.status,
        Catatan: es.notes || '',
      };
    });

    exportToSpreadsheet(
      exportRows,
      `Jadwal_Ujian_${new Date().toISOString().slice(0, 10)}`,
      format,
      'Jadwal Ujian'
    );
    success(`Berhasil mengunduh jadwal ujian (.${format})`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Main Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Jadwal Ujian Sekolah
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
              {examSchedules.length} Sesi
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola seluruh jadwal sesi mata uji, tanggal pelaksanaan, dan kebutuhan pengawas per ruang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tombol Jadwalkan Pengawas */}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('invigilator_schedules')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              <Users className="w-4 h-4" />
              <span>Jadwalkan Pengawas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Import Jadwal */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-2xs transition-colors"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Import Jadwal</span>
            </button>
          )}

          {/* Export Jadwal Dropdown / Buttons */}
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <button
              type="button"
              onClick={() => handleExportData('xlsx')}
              title="Ekspor Excel (.xlsx)"
              className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 border-r border-slate-200"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportData('csv')}
              title="Ekspor CSV (.csv)"
              className="px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <span>CSV</span>
            </button>
          </div>

          {/* Tambah Jadwal */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jadwal</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] text-slate-400 font-medium">Total Jadwal</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-slate-900">
              {summaryMetrics.totalSchedules}
            </span>
            <span className="text-[11px] text-slate-500">sesi</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Seluruh mata uji</p>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] text-slate-400 font-medium">Hari Ujian</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-slate-900">
              {summaryMetrics.distinctDays}
            </span>
            <span className="text-[11px] text-slate-500">hari</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Tanggal berbeda</p>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] text-slate-400 font-medium">Total Ruang</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-blue-600">
              {summaryMetrics.totalRooms}
            </span>
            <span className="text-[11px] text-slate-500">ruang</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Ruang aktif dipakai</p>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] text-slate-400 font-medium">Total Kebutuhan</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-purple-700">
              {summaryMetrics.totalInvigilatorNeeds}
            </span>
            <span className="text-[11px] text-slate-500">tugas</span>
          </div>
          <p className="text-[10px] text-purple-600 mt-1">
            {invigilatorsPerRoom} pengawas/ruang
          </p>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] text-slate-400 font-medium">Pengawas Terjadwal</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-emerald-600">
              {summaryMetrics.totalAssigned}
            </span>
            <span className="text-[11px] text-slate-500">terisi</span>
          </div>
          <p className="text-[10px] text-emerald-600 mt-1">Slot telah terisi</p>
        </div>

        <div
          className={`p-3.5 rounded-2xl border shadow-2xs ${
            summaryMetrics.totalMissing === 0
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-rose-50/80 border-rose-200 text-rose-900'
          }`}
        >
          <p className="text-[11px] font-medium opacity-80">Kekurangan Pengawas</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black">
              {summaryMetrics.totalMissing}
            </span>
            <span className="text-[11px] opacity-80">slot</span>
          </div>
          <p className="text-[10px] opacity-80 mt-1">
            {summaryMetrics.totalMissing === 0 ? 'Semua sesi terpenuhi' : 'Perlu dilengkapi'}
          </p>
        </div>
      </div>

      {/* Pengaturan Kebutuhan Pengawas info & Calculation note */}
      <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-slate-50 rounded-2xl border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 mt-0.5">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-blue-950 text-sm">
                Rasio Kebutuhan Pengawas: {invigilatorsPerRoom} Orang per Ruang
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-200/70 text-blue-800 text-[10px] font-bold">
                Aktif
              </span>
            </div>
            <p className="text-blue-800/90 mt-0.5 leading-relaxed">
              Rumus Kebutuhan: <span className="font-bold">Jumlah Ruang Aktif ({activeRooms.length} Ruang)</span> ×{' '}
              <span className="font-bold">Jumlah Pengawas per Ruang ({invigilatorsPerRoom} Orang)</span> ={' '}
              <span className="font-black text-blue-900">{needsPerSession} Penugasan Pengawas per Sesi</span>.
            </p>
          </div>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="self-start md:self-auto text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors shrink-0 shadow-2xs"
          >
            Ubah di Pengaturan
          </button>
        )}
      </div>

      {/* Validation Warnings Banner */}
      {systemWarnings.length > 0 && (
        <div className="space-y-2">
          {systemWarnings.map((warn) => (
            <div
              key={warn.id}
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 shadow-2xs ${
                warn.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {warn.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">
                <span>{warn.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari tanggal (2026-09-22), hari, mapel, kode, atau catatan..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tampilan Tabel</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tampilan Kalender</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Filter Tanggal */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Tanggal
            </label>
            <select
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Tanggal</option>
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {date} ({formatIndonesianDate(date)})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Hari */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Hari
            </label>
            <select
              value={filterDay}
              onChange={(e) => {
                setFilterDay(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Hari</option>
              {INDONESIAN_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Mapel */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Mata Pelajaran
            </label>
            <select
              value={filterSubjectId}
              onChange={(e) => {
                setFilterSubjectId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Mapel</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Sesi */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Sesi
            </label>
            <select
              value={filterSession}
              onChange={(e) => {
                setFilterSession(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Sesi</option>
              {availableSessions.map((session) => (
                <option key={session} value={session}>
                  {session}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Status Pengawas
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Status</option>
                <option value="Belum Dijadwalkan">Belum Dijadwalkan</option>
                <option value="Sebagian Terjadwal">Sebagian Terjadwal</option>
                <option value="Lengkap">Lengkap</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  title="Reset Filter"
                  className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Table or Calendar */}
      {viewMode === 'calendar' ? (
        <ExamScheduleCalendarView
          schedules={filteredSchedules}
          onViewDetail={handleOpenDetail}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
          onNavigate={onNavigate}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredSchedules.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Tidak Ada Jadwal Ujian yang Ditemukan"
              description={
                hasActiveFilters
                  ? 'Tidak ada jadwal yang cocok dengan filter atau pencarian Anda.'
                  : 'Belum ada jadwal ujian yang terdaftar. Buat jadwal pertama atau impor berkas Excel.'
              }
              actionLabel={isAdmin ? 'Tambah Jadwal Ujian' : undefined}
              onAction={isAdmin ? handleOpenAdd : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-extrabold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tanggal & Hari</th>
                    <th className="py-3 px-4">Mata Pelajaran</th>
                    <th className="py-3 px-4">Sesi & Jam</th>
                    <th className="py-3 px-4 text-center">Jumlah Ruang</th>
                    <th className="py-3 px-4 text-center">Kebutuhan Pengawas</th>
                    <th className="py-3 px-4 text-center">Pengawas Terisi</th>
                    <th className="py-3 px-4 text-center">Masih Kurang</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedSchedules.map((schedule) => {
                    const subject = subjects.find((s) => s.id === schedule.subject_id);
                    const filled = invigilatorSchedules.filter(
                      (inv) => inv.exam_schedule_id === schedule.id && !!inv.teacher_id
                    ).length;

                    const metrics = calculateScheduleMetrics(
                      activeRooms.length,
                      invigilatorsPerRoom,
                      filled
                    );

                    return (
                      <tr
                        key={schedule.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Tanggal & Hari */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold shrink-0">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">
                                {schedule.day_name}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {schedule.exam_date}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Mata Pelajaran */}
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {subject?.name || 'Mata Pelajaran'}
                            </p>
                            <span className="text-[11px] font-mono text-slate-400">
                              {subject?.code || '-'}
                            </span>
                          </div>
                        </td>

                        {/* Sesi & Jam */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[11px] w-fit">
                              {schedule.session}
                            </span>
                            <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)} WIB
                            </span>
                          </div>
                        </td>

                        {/* Jumlah Ruang */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                          <span className="px-2 py-1 bg-slate-100 rounded-lg text-slate-800">
                            {metrics.activeRoomsCount}
                          </span>
                        </td>

                        {/* Kebutuhan Pengawas */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-blue-900">
                          <span className="px-2 py-1 bg-blue-50 rounded-lg border border-blue-100">
                            {metrics.totalRequired}
                          </span>
                        </td>

                        {/* Pengawas Sudah Terisi */}
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span
                            className={`px-2 py-1 rounded-lg ${
                              metrics.totalFilled >= metrics.totalRequired
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : metrics.totalFilled > 0
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {metrics.totalFilled}
                          </span>
                        </td>

                        {/* Pengawas Masih Kurang */}
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span
                            className={`px-2 py-1 rounded-lg ${
                              metrics.totalMissing === 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}
                          >
                            {metrics.totalMissing}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold shadow-2xs whitespace-nowrap ${
                              metrics.status === 'Lengkap'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : metrics.status === 'Sebagian Terjadwal'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {metrics.status === 'Lengkap' && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )}
                            {metrics.status === 'Sebagian Terjadwal' && (
                              <Clock3 className="w-3 h-3 text-amber-600" />
                            )}
                            {metrics.status === 'Belum Dijadwalkan' && (
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                            )}
                            {metrics.status}
                          </span>
                        </td>

                        {/* Aksi */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(schedule)}
                              title="Lihat Detail Jadwal"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(schedule)}
                                  title="Edit Jadwal"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(schedule)}
                                  title="Hapus Jadwal"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate('invigilator_schedules')}
                                title="Jadwalkan Pengawas"
                                className="ml-1 p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Pagination */}
          {filteredSchedules.length > 0 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>Menampilkan</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span>
                  dari <strong>{filteredSchedules.length}</strong> jadwal
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-slate-700">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Modal (Tambah & Edit) */}
      <ExamScheduleFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingSchedule(null);
        }}
        scheduleToEdit={editingSchedule}
      />

      {/* Detail Modal */}
      <ExamScheduleDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedSchedule(null);
        }}
        schedule={selectedSchedule}
        onEdit={(sch) => handleOpenEdit(sch)}
        onNavigate={onNavigate}
      />

      {/* Import Modal */}
      <ExamScheduleImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setScheduleToDelete(null);
        }}
        title="Konfirmasi Hapus Jadwal Ujian"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-bold">Apakah Anda yakin ingin menghapus jadwal ini?</p>
              <p className="mt-1">
                Jadwal mata uji{' '}
                <strong>
                  {subjects.find((s) => s.id === scheduleToDelete?.subject_id)?.name}
                </strong>{' '}
                pada <strong>{scheduleToDelete?.day_name}</strong> (
                {scheduleToDelete?.exam_date}, {scheduleToDelete?.session}) akan dihapus.
              </p>
              <p className="mt-1.5 text-rose-700 font-semibold">
                Peringatan: Seluruh penugasan pengawas yang terkait dengan jadwal ini akan ikut terhapus.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setScheduleToDelete(null);
              }}
              className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
            >
              {isDeleting ? 'Menghapus...' : 'Ya, Hapus Jadwal'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
