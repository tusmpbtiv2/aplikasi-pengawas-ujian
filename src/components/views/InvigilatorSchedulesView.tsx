import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
  Building2,
  DoorOpen,
  Calendar,
  AlertCircle,
  Sparkles,
  Printer,
  Download,
  Filter,
  Users,
  RotateCw,
  Layers,
  Check,
  ChevronDown,
  X,
  RefreshCw,
  Database,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { InvigilatorSchedule } from '../../types/database';
import { EmptyState } from '../common/EmptyState';
import { InvigilatorGenerateModal } from '../invigilators/InvigilatorGenerateModal';
import { InvigilatorAssignmentModal } from '../invigilators/InvigilatorAssignmentModal';
import { InvigilatorQuickReplaceModal } from '../invigilators/InvigilatorQuickReplaceModal';
import { InvigilatorPrintModal } from '../invigilators/InvigilatorPrintModal';
import { TeacherWorkloadTab } from '../invigilators/TeacherWorkloadTab';
import {
  groupAssignmentsByExamAndRoom,
  ExamRoomSlot,
  exportInvigilatorScheduleData,
} from '../../lib/invigilatorHelper';
import { formatIndonesianDate } from '../../lib/scheduleHelper';

export const InvigilatorSchedulesView: React.FC = () => {
  const {
    invigilatorSchedules,
    examSchedules,
    rooms,
    teachers,
    buildings,
    subjects,
    conflicts,
    settings,
    quickUpdateInvigilatorStatus,
    clearInvigilatorSchedules,
    seedDemo45RoomsAndTeachers,
    refreshAll,
  } = useData();

  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const invigilatorsPerRoom = settings?.default_invigilators_per_room || 2;

  // Active View Tab: 'SCHEDULES' | 'WORKLOAD'
  const [activeTab, setActiveTab] = useState<'SCHEDULES' | 'WORKLOAD'>('SCHEDULES');

  // Modals state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentModalParams, setAssignmentModalParams] = useState<{
    assignment?: InvigilatorSchedule | null;
    defaultExamScheduleId?: string;
    defaultRoomId?: string;
    defaultRole?: 'Pengawas 1' | 'Pengawas 2' | 'Cadangan';
  }>({});

  const [isQuickReplaceModalOpen, setIsQuickReplaceModalOpen] = useState(false);
  const [replacingAssignment, setReplacingAssignment] = useState<InvigilatorSchedule | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printTeacherId, setPrintTeacherId] = useState<string | undefined>(undefined);

  // Filters
  const [filterDate, setFilterDate] = useState<string>('ALL');
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [filterSession, setFilterSession] = useState<string>('ALL');
  const [filterBuilding, setFilterBuilding] = useState<string>('ALL');
  const [filterRoom, setFilterRoom] = useState<string>('ALL');
  const [filterTeacher, setFilterTeacher] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Derived filter options
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(examSchedules.map((es) => es.exam_date))).sort();
  }, [examSchedules]);

  const uniqueDays = useMemo(() => {
    return Array.from(new Set(examSchedules.map((es) => es.day_name)));
  }, [examSchedules]);

  const uniqueSessions = useMemo(() => {
    return Array.from(new Set(examSchedules.map((es) => es.session))).sort();
  }, [examSchedules]);

  // Grouped rows
  const allGroupedSlots = useMemo<ExamRoomSlot[]>(() => {
    return groupAssignmentsByExamAndRoom(
      examSchedules,
      rooms,
      buildings,
      invigilatorSchedules,
      conflicts,
      invigilatorsPerRoom
    );
  }, [examSchedules, rooms, buildings, invigilatorSchedules, conflicts, invigilatorsPerRoom]);

  // Filtered slots
  const filteredSlots = useMemo<ExamRoomSlot[]>(() => {
    return allGroupedSlots.filter((slot) => {
      // Date filter
      if (filterDate !== 'ALL' && slot.examSchedule.exam_date !== filterDate) return false;
      // Day filter
      if (filterDay !== 'ALL' && slot.examSchedule.day_name !== filterDay) return false;
      // Session filter
      if (filterSession !== 'ALL' && slot.examSchedule.session !== filterSession) return false;
      // Building filter
      if (filterBuilding !== 'ALL' && slot.building?.id !== filterBuilding) return false;
      // Room filter
      if (filterRoom !== 'ALL' && slot.room.id !== filterRoom) return false;
      // Teacher filter
      if (filterTeacher !== 'ALL') {
        const hasTeacher =
          slot.invigilators.some((inv) => inv?.teacher_id === filterTeacher) ||
          slot.reserveInvigilators.some((inv) => inv.teacher_id === filterTeacher);
        if (!hasTeacher) return false;
      }
      // Status filter
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'Lengkap') {
          if (!slot.isComplete) return false;
        } else if (filterStatus === 'Belum Lengkap') {
          if (slot.isComplete) return false;
        } else {
          const hasStatus =
            slot.invigilators.some((inv) => inv?.status === filterStatus) ||
            slot.reserveInvigilators.some((inv) => inv.status === filterStatus);
          if (!hasStatus) return false;
        }
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const subject = subjects.find((s) => s.id === slot.examSchedule.subject_id);
        const subjectName = subject?.name?.toLowerCase() || '';
        const roomName = slot.room.name.toLowerCase();
        const roomCode = slot.room.code.toLowerCase();
        const buildingName = slot.building?.name?.toLowerCase() || '';

        const teacherNames = [
          ...slot.invigilators.map((inv) => (inv?.teacher_id ? teachers.find((t) => t.id === inv.teacher_id)?.name.toLowerCase() || '' : '')),
          ...slot.reserveInvigilators.map((inv) => (inv.teacher_id ? teachers.find((t) => t.id === inv.teacher_id)?.name.toLowerCase() || '' : '')),
        ].join(' ');

        const matches =
          subjectName.includes(q) ||
          roomName.includes(q) ||
          roomCode.includes(q) ||
          buildingName.includes(q) ||
          teacherNames.includes(q) ||
          slot.examSchedule.session.toLowerCase().includes(q) ||
          slot.examSchedule.day_name.toLowerCase().includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    allGroupedSlots,
    filterDate,
    filterDay,
    filterSession,
    filterBuilding,
    filterRoom,
    filterTeacher,
    filterStatus,
    searchTerm,
    subjects,
    teachers,
  ]);

  // Count metrics
  const totalSlotsNeeded = allGroupedSlots.length * invigilatorsPerRoom;
  const totalSlotsFilled = invigilatorSchedules.filter((inv) => inv.teacher_id).length;
  const fillPercentage = totalSlotsNeeded > 0 ? Math.round((totalSlotsFilled / totalSlotsNeeded) * 100) : 0;

  // Handlers for quick status change
  const handleQuickStatusChange = async (
    inv: InvigilatorSchedule,
    newStatus: 'Dijadwalkan' | 'Hadir' | 'Izin' | 'Digantikan'
  ) => {
    if (newStatus === 'Digantikan' || newStatus === 'Izin') {
      // Offer replacement modal
      setReplacingAssignment(inv);
      setIsQuickReplaceModalOpen(true);
    } else {
      await quickUpdateInvigilatorStatus(inv.id, newStatus);
      toastSuccess(`Status diubah menjadi: ${newStatus}`);
    }
  };

  const handleOpenAssignModal = (
    examScheduleId?: string,
    roomId?: string,
    role?: 'Pengawas 1' | 'Pengawas 2' | 'Cadangan',
    assignment?: InvigilatorSchedule
  ) => {
    setAssignmentModalParams({
      assignment: assignment || null,
      defaultExamScheduleId: examScheduleId,
      defaultRoomId: roomId,
      defaultRole: role,
    });
    setIsAssignmentModalOpen(true);
  };

  const handleResetFilters = () => {
    setFilterDate('ALL');
    setFilterDay('ALL');
    setFilterSession('ALL');
    setFilterBuilding('ALL');
    setFilterRoom('ALL');
    setFilterTeacher('ALL');
    setFilterStatus('ALL');
    setSearchTerm('');
  };

  const handleClearSchedules = async () => {
    if (invigilatorSchedules.length === 0) return;
    const confirmText =
      filterDate !== 'ALL' || filterBuilding !== 'ALL'
        ? 'Kosongkan seluruh penugasan pengawas yang sedang difilter ini?'
        : 'Kosongkan SELURUH jadwal pengawas yang ada saat ini?';

    if (window.confirm(confirmText)) {
      const examIds = filterDate !== 'ALL' ? examSchedules.filter((e) => e.exam_date === filterDate).map((e) => e.id) : undefined;
      const roomIds = filterBuilding !== 'ALL' ? rooms.filter((r) => r.building_id === filterBuilding).map((r) => r.id) : undefined;
      await clearInvigilatorSchedules(examIds, roomIds);
      toastSuccess('Jadwal pengawas berhasil dikosongkan.');
    }
  };

  const handleSeed45Rooms = async () => {
    if (window.confirm('Siapkan otomatis data 2 Gedung (Gedung Utama A & Gedung Timur B), 45 Ruangan Aktif, dan 55 Guru Pengawas SMP Bhinneka Tunggal Ika?')) {
      const res = await seedDemo45RoomsAndTeachers();
      if (res.success) {
        toastSuccess(res.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Jadwal Pengawas Ujian
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              SMP Bhinneka Tunggal Ika
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan pembagian guru pengawas ujian otomatis & manual (2 Gedung &bull; {rooms.filter((r) => r.active).length} Ruang &bull; {teachers.filter((t) => t.active).length} Guru)
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => setIsGenerateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-xs transition-all hover:shadow"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Jadwal Pengawas</span>
              </button>

              <button
                onClick={() => handleOpenAssignModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Tugaskan Manual</span>
              </button>
            </>
          )}

          <button
            onClick={() => {
              setPrintTeacherId(undefined);
              setIsPrintModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Cetak / Berita Acara</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative group">
            <button className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs">
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 hidden group-hover:block">
              <button
                onClick={() => exportInvigilatorScheduleData(filteredSlots, teachers, 'xlsx')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => exportInvigilatorScheduleData(filteredSlots, teachers, 'csv')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {isAdmin && rooms.length < 40 && (
            <button
              onClick={handleSeed45Rooms}
              title="Siapkan 2 Gedung & 45 Ruang otomatis"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-amber-700" />
              <span>Set Demo 45 Ruang</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Selector & Key Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Tab Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('SCHEDULES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'SCHEDULES'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Matriks Jadwal Pengawas ({filteredSlots.length} Ruang)</span>
          </button>

          <button
            onClick={() => setActiveTab('WORKLOAD')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'WORKLOAD'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Beban Tugas Guru & Statistik</span>
          </button>
        </div>

        {/* Quick status summary chip */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>
              Keterisian Slot:{' '}
              <strong className="text-slate-900">
                {totalSlotsFilled} / {totalSlotsNeeded}
              </strong>{' '}
              ({fillPercentage}%)
            </span>
          </div>

          {conflicts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>{conflicts.length} Konflik</span>
            </div>
          )}
        </div>
      </div>

      {/* Conflict banner if any */}
      {conflicts.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Terdeteksi {conflicts.length} Bentrok Jadwal Pengawasan:</span>
          </div>
          <ul className="list-disc pl-5 text-[11px] text-rose-700 space-y-0.5">
            {conflicts.slice(0, 3).map((c) => (
              <li key={c.id}>{c.description}</li>
            ))}
            {conflicts.length > 3 && (
              <li className="font-semibold">...dan {conflicts.length - 3} bentrok lainnya</li>
            )}
          </ul>
        </div>
      )}

      {/* TAB 1: MAIN SCHEDULE TABLE */}
      {activeTab === 'SCHEDULES' && (
        <div className="space-y-4">
          {/* Comprehensive Filter Panel */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>Filter Jadwal Pengawas:</span>
              </div>

              {(filterDate !== 'ALL' ||
                filterDay !== 'ALL' ||
                filterSession !== 'ALL' ||
                filterBuilding !== 'ALL' ||
                filterRoom !== 'ALL' ||
                filterTeacher !== 'ALL' ||
                filterStatus !== 'ALL' ||
                searchTerm) && (
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            {/* Filter grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
              {/* Tanggal */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Tanggal
                </label>
                <select
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="ALL">Semua Tanggal</option>
                  {uniqueDates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hari */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Hari
                </label>
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="ALL">Semua Hari</option>
                  {uniqueDays.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sesi */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Sesi
                </label>
                <select
                  value={filterSession}
                  onChange={(e) => setFilterSession(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="ALL">Semua Sesi</option>
                  {uniqueSessions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gedung */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Gedung
                </label>
                <select
                  value={filterBuilding}
                  onChange={(e) => {
                    setFilterBuilding(e.target.value);
                    setFilterRoom('ALL');
                  }}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="ALL">Semua Gedung</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ruang */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Ruang
                </label>
                <select
                  value={filterRoom}
                  onChange={(e) => setFilterRoom(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="ALL">Semua Ruang</option>
                  {rooms
                    .filter((r) => r.active && (filterBuilding === 'ALL' || r.building_id === filterBuilding))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} - {r.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Guru */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Guru
                </label>
                <select
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="ALL">Semua Guru</option>
                  {teachers
                    .filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="Lengkap">Pengawas Lengkap</option>
                  <option value="Belum Lengkap">Pengawas Belum Lengkap</option>
                  <option value="Dijadwalkan">Dijadwalkan</option>
                  <option value="Hadir">Hadir</option>
                  <option value="Izin">Izin</option>
                  <option value="Digantikan">Digantikan</option>
                </select>
              </div>
            </div>

            {/* Search Input and bulk action bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari ruang, mapel, pengawas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Menampilkan <strong>{filteredSlots.length}</strong> baris jadwal ruang
                </span>
                {isAdmin && invigilatorSchedules.length > 0 && (
                  <button
                    onClick={handleClearSchedules}
                    className="text-rose-600 hover:text-rose-800 font-bold text-[11px] px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                  >
                    Kosongkan Jadwal
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Grouped Table View */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredSlots.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Tidak Ada Jadwal Pengawas"
                description="Belum ada data penugasan yang sesuai filter atau kriteria pencarian Anda."
                actionLabel={isAdmin ? 'Generate Jadwal Otomatis' : undefined}
                onAction={isAdmin ? () => setIsGenerateModalOpen(true) : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5 w-12 text-center">No</th>
                      <th className="py-3 px-3.5">Tanggal & Hari</th>
                      <th className="py-3 px-3.5">Sesi & Jam</th>
                      <th className="py-3 px-3.5">Gedung & Ruang</th>
                      <th className="py-3 px-3.5">Mata Pelajaran</th>
                      <th className="py-3 px-3.5">Pengawas 1</th>
                      <th className="py-3 px-3.5">Pengawas 2</th>
                      <th className="py-3 px-3.5 text-center">Status</th>
                      {isAdmin && <th className="py-3 px-3.5 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSlots.map((slot, idx) => {
                      const p1 = slot.invigilators[0];
                      const p2 = slot.invigilators[1];
                      const exam = slot.examSchedule;
                      const room = slot.room;
                      const building = slot.building;
                      const subject = subjects.find((s) => s.id === exam.subject_id);

                      const teacher1 = p1?.teacher_id ? teachers.find((t) => t.id === p1.teacher_id) : null;
                      const teacher2 = p2?.teacher_id ? teachers.find((t) => t.id === p2.teacher_id) : null;

                      return (
                        <tr
                          key={slot.key}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            !slot.isComplete ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          {/* No */}
                          <td className="py-3 px-3.5 text-center font-medium text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Tanggal & Hari */}
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-slate-900 block">
                              {exam.day_name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {formatIndonesianDate(exam.exam_date)}
                            </span>
                          </td>

                          {/* Sesi & Jam */}
                          <td className="py-3 px-3.5">
                            <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                              {exam.session}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {exam.start_time.slice(0, 5)} - {exam.end_time.slice(0, 5)}
                            </span>
                          </td>

                          {/* Gedung & Ruang */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-1.5">
                              <DoorOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="font-bold text-slate-900">{room.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono block pl-5">
                              {room.code} &bull; {building?.name || 'Gedung'}
                            </span>
                          </td>

                          {/* Mata Pelajaran */}
                          <td className="py-3 px-3.5">
                            <span className="font-semibold text-slate-900 block">
                              {subject?.name || 'Mata Pelajaran'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {subject?.code || ''}
                            </span>
                          </td>

                          {/* Pengawas 1 */}
                          <td className="py-3 px-3.5">
                            {p1 && teacher1 ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-slate-900">{teacher1.name}</span>
                                  {isAdmin && (
                                    <button
                                      onClick={() => {
                                        setReplacingAssignment(p1);
                                        setIsQuickReplaceModalOpen(true);
                                      }}
                                      title="Ganti Pengawas 1"
                                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      Ganti
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isAdmin ? (
                                    <select
                                      value={p1.status}
                                      onChange={(e) =>
                                        handleQuickStatusChange(
                                          p1,
                                          e.target.value as 'Dijadwalkan' | 'Hadir' | 'Izin' | 'Digantikan'
                                        )
                                      }
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded border focus:outline-hidden ${
                                        p1.status === 'Hadir'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : p1.status === 'Izin'
                                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                                          : p1.status === 'Digantikan'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}
                                    >
                                      <option value="Dijadwalkan">Dijadwalkan</option>
                                      <option value="Hadir">Hadir</option>
                                      <option value="Izin">Izin</option>
                                      <option value="Digantikan">Digantikan</option>
                                    </select>
                                  ) : (
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        p1.status === 'Hadir'
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : p1.status === 'Izin'
                                          ? 'bg-rose-50 text-rose-700'
                                          : 'bg-blue-50 text-blue-700'
                                      }`}
                                    >
                                      {p1.status}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    NIP: {teacher1.employee_number || '-'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                {isAdmin ? (
                                  <button
                                    onClick={() =>
                                      handleOpenAssignModal(exam.id, room.id, 'Pengawas 1', p1)
                                    }
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Tugaskan P1</span>
                                  </button>
                                ) : (
                                  <span className="text-amber-600 italic text-[11px]">
                                    Belum Ada
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Pengawas 2 */}
                          <td className="py-3 px-3.5">
                            {p2 && teacher2 ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-slate-900">{teacher2.name}</span>
                                  {isAdmin && (
                                    <button
                                      onClick={() => {
                                        setReplacingAssignment(p2);
                                        setIsQuickReplaceModalOpen(true);
                                      }}
                                      title="Ganti Pengawas 2"
                                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      Ganti
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isAdmin ? (
                                    <select
                                      value={p2.status}
                                      onChange={(e) =>
                                        handleQuickStatusChange(
                                          p2,
                                          e.target.value as 'Dijadwalkan' | 'Hadir' | 'Izin' | 'Digantikan'
                                        )
                                      }
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded border focus:outline-hidden ${
                                        p2.status === 'Hadir'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : p2.status === 'Izin'
                                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                                          : p2.status === 'Digantikan'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}
                                    >
                                      <option value="Dijadwalkan">Dijadwalkan</option>
                                      <option value="Hadir">Hadir</option>
                                      <option value="Izin">Izin</option>
                                      <option value="Digantikan">Digantikan</option>
                                    </select>
                                  ) : (
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        p2.status === 'Hadir'
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : p2.status === 'Izin'
                                          ? 'bg-rose-50 text-rose-700'
                                          : 'bg-blue-50 text-blue-700'
                                      }`}
                                    >
                                      {p2.status}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    NIP: {teacher2.employee_number || '-'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                {isAdmin ? (
                                  <button
                                    onClick={() =>
                                      handleOpenAssignModal(exam.id, room.id, 'Pengawas 2', p2)
                                    }
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Tugaskan P2</span>
                                  </button>
                                ) : (
                                  <span className="text-amber-600 italic text-[11px]">
                                    Belum Ada
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Status Umum Ruang */}
                          <td className="py-3 px-3.5 text-center">
                            {slot.isComplete ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                Lengkap
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                                <Clock className="w-3 h-3" />
                                {slot.statusText}
                              </span>
                            )}
                          </td>

                          {/* Aksi */}
                          {isAdmin && (
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleOpenAssignModal(exam.id, room.id, 'Pengawas 1', p1)}
                                  title="Edit Slot Pengawas"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TEACHER WORKLOAD & STATS */}
      {activeTab === 'WORKLOAD' && (
        <TeacherWorkloadTab
          onSelectTeacherForFilter={(teacherId) => {
            setFilterTeacher(teacherId);
            setActiveTab('SCHEDULES');
          }}
          onPrintTeacherSchedule={(teacherId) => {
            setPrintTeacherId(teacherId);
            setIsPrintModalOpen(true);
          }}
        />
      )}

      {/* MODALS */}
      {/* 1. Generate Modal */}
      <InvigilatorGenerateModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onSuccess={() => {
          refreshAll();
        }}
      />

      {/* 2. Manual Assignment & Edit Modal */}
      <InvigilatorAssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        assignment={assignmentModalParams.assignment}
        defaultExamScheduleId={assignmentModalParams.defaultExamScheduleId}
        defaultRoomId={assignmentModalParams.defaultRoomId}
        defaultRole={assignmentModalParams.defaultRole}
      />

      {/* 3. Quick Replace Modal */}
      <InvigilatorQuickReplaceModal
        isOpen={isQuickReplaceModalOpen}
        onClose={() => {
          setIsQuickReplaceModalOpen(false);
          setReplacingAssignment(null);
        }}
        assignment={replacingAssignment}
      />

      {/* 4. Print & Official Attendance Sheet Modal */}
      <InvigilatorPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintTeacherId(undefined);
        }}
        defaultTeacherId={printTeacherId}
      />
    </div>
  );
};
