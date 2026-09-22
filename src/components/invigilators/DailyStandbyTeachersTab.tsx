import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  UserCheck,
  ShieldCheck,
  Clock,
  Sparkles,
  Download,
  AlertCircle,
  Coffee,
  CheckCircle2,
  CalendarOff,
  Users,
  ChevronRight,
  ArrowRightLeft,
} from 'lucide-react';
import { Teacher, ExamSchedule, InvigilatorSchedule, Room } from '../../types/database';
import {
  getDailyTeacherStatus,
  DailyOffDutyTeacher,
} from '../../lib/invigilatorHelper';
import { exportToSpreadsheet } from '../../lib/excelHelper';
import { formatIndonesianDate } from '../../lib/scheduleHelper';

interface DailyStandbyTeachersTabProps {
  examSchedules: ExamSchedule[];
  invigilatorSchedules: InvigilatorSchedule[];
  teachers: Teacher[];
  rooms: Room[];
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  onAssignReplacement?: (teacherId: string, date: string) => void;
}

export const DailyStandbyTeachersTab: React.FC<DailyStandbyTeachersTabProps> = ({
  examSchedules,
  invigilatorSchedules,
  teachers,
  rooms,
  selectedDate: initialDate,
  onSelectDate,
  onAssignReplacement,
}) => {
  // Unique exam dates
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(examSchedules.map((es) => es.exam_date))).sort();
  }, [examSchedules]);

  const [currentDate, setCurrentDate] = useState<string>(() => {
    if (initialDate && uniqueDates.includes(initialDate)) return initialDate;
    return uniqueDates[0] || '';
  });

  // Sync if parent date changes
  React.useEffect(() => {
    if (initialDate && uniqueDates.includes(initialDate) && initialDate !== currentDate) {
      setCurrentDate(initialDate);
    }
  }, [initialDate, uniqueDates]);

  const handleDateChange = (newDate: string) => {
    setCurrentDate(newDate);
    if (onSelectDate) onSelectDate(newDate);
  };

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<
    'ALL' | 'UNAVAILABLE_DAY' | 'OFF_DUTY_AVAILABLE' | 'PANITIA' | 'ASSIGNED'
  >('ALL');

  // Compute daily status
  const dailyStatus = useMemo(() => {
    if (!currentDate) return null;
    return getDailyTeacherStatus(currentDate, teachers, invigilatorSchedules, examSchedules);
  }, [currentDate, teachers, invigilatorSchedules, examSchedules]);

  // Exam schedules on current date
  const examsOnDate = useMemo(() => {
    return examSchedules.filter((e) => e.exam_date === currentDate);
  }, [examSchedules, currentDate]);

  // Filtered off-duty teachers (Prioritas 1)
  const filteredOffDuty = useMemo(() => {
    if (!dailyStatus) return [];
    return dailyStatus.offDutyTeachers.filter((item) => {
      if (filterCategory === 'UNAVAILABLE_DAY' && !item.isUnavailableDay) return false;
      if (filterCategory === 'OFF_DUTY_AVAILABLE' && item.isUnavailableDay) return false;
      if (filterCategory === 'PANITIA' || filterCategory === 'ASSIGNED') return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        item.teacher.name.toLowerCase().includes(q) ||
        (item.teacher.employee_number || '').toLowerCase().includes(q) ||
        (item.teacher.invigilator_code || '').toLowerCase().includes(q)
      );
    });
  }, [dailyStatus, filterCategory, searchTerm]);

  // Filtered panitia teachers (Prioritas 2)
  const filteredPanitia = useMemo(() => {
    if (!dailyStatus) return [];
    if (filterCategory !== 'ALL' && filterCategory !== 'PANITIA') return [];
    return dailyStatus.panitiaTeachers.filter((t) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.employee_number || '').toLowerCase().includes(q) ||
        (t.invigilator_code || '').toLowerCase().includes(q)
      );
    });
  }, [dailyStatus, filterCategory, searchTerm]);

  // Filtered assigned teachers
  const filteredAssigned = useMemo(() => {
    if (!dailyStatus) return [];
    if (filterCategory !== 'ALL' && filterCategory !== 'ASSIGNED') return [];
    return dailyStatus.assignedTeachersToday.filter((item) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        item.teacher.name.toLowerCase().includes(q) ||
        (item.teacher.employee_number || '').toLowerCase().includes(q) ||
        (item.teacher.invigilator_code || '').toLowerCase().includes(q)
      );
    });
  }, [dailyStatus, filterCategory, searchTerm]);

  // Export Roster to Excel / CSV
  const handleExportRoster = (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (!dailyStatus) return;

    const rows = [
      ...dailyStatus.offDutyTeachers.map((o, idx) => ({
        Kategori: 'Prioritas 1: Pengawas Pengganti (Bebas Tugas Hari Ini)',
        No: idx + 1,
        'Kode Pengawas': o.teacher.invigilator_code || '-',
        'Nama Guru': o.teacher.name,
        NIP: o.teacher.employee_number || '-',
        'Status Hari Ini': o.reasonLabel,
        'Ketersediaan Mingguan': (o.teacher.available_days || []).join(', ') || '-',
        'Beban Mengawas Terjadwal': `${o.totalWorkload}x`,
        Catatan: o.isUnavailableDay
          ? `Libur mengajar di hari ${dailyStatus.dayName} (Sangat cocok sebagai pengganti)`
          : 'Bebas tugas mengawas pada hari ini',
      })),
      ...dailyStatus.panitiaTeachers.map((p, idx) => ({
        Kategori: 'Prioritas 2: Standby Panitia Ujian',
        No: idx + 1,
        'Kode Pengawas': p.invigilator_code || '-',
        'Nama Guru': p.name,
        NIP: p.employee_number || '-',
        'Status Hari Ini': 'Panitia Standby Darurat',
        'Ketersediaan Mingguan': 'Siaga Setiap Hari',
        'Beban Mengawas Terjadwal': '-',
        Catatan: 'Disiagakan untuk opsi darurat jika pengawas reguler tidak ada',
      })),
    ];

    exportToSpreadsheet(
      rows,
      `Daftar_Pengawas_Pengganti_${dailyStatus.dayName}_${currentDate}`,
      format,
      'Pengawas Pengganti'
    );
  };

  const countLibur = dailyStatus?.offDutyTeachers.filter((t) => t.isUnavailableDay).length || 0;
  const countBebas = dailyStatus?.offDutyTeachers.filter((t) => !t.isUnavailableDay).length || 0;

  return (
    <div className="space-y-5">
      {/* Top Header & Date Navigation Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Coffee className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Guru Bebas Tugas & Calon Pengawas Pengganti Harian
                </h3>
                <p className="text-xs text-slate-500">
                  Menampilkan guru yang tidak mendapat jadwal mengawas pada tanggal ini untuk opsi pengganti sebelum panitia.
                </p>
              </div>
            </div>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 shrink-0">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Pilih Tanggal:</span>
            </label>
            <select
              value={currentDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              {uniqueDates.map((date) => {
                const sampleExam = examSchedules.find((es) => es.exam_date === date);
                const dayName = sampleExam?.day_name || 'Hari';
                return (
                  <option key={date} value={date}>
                    {dayName}, {formatIndonesianDate(date)}
                  </option>
                );
              })}
            </select>

            <button
              onClick={() => handleExportRoster('xlsx')}
              title="Download Daftar Pengawas Pengganti Hari Ini"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
          </div>
        </div>

        {/* SOP Callout Alert */}
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 space-y-1">
            <span className="font-bold block">
              Pedoman Alokasi Pengawas Pengganti (Sebelum Panitia):
            </span>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Jika seorang pengawas izin atau berhalangan hadir mendadak, <strong>Prioritas 1</strong> adalah menugaskan guru yang <strong>bebas tugas atau libur mengajar</strong> pada hari ini ({dailyStatus?.dayName || 'hari ujian'}). Guru <strong>Panitia Ujian (Prioritas 2)</strong> disiagakan sebagai opsi darurat jika seluruh guru bebas tugas berhalangan.
            </p>
          </div>
        </div>

        {/* Status Metrics Cards */}
        {dailyStatus && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {/* Prioritas 1: Bebas Tugas */}
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Prioritas 1: Bebas Tugas
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-emerald-950">
                  {dailyStatus.totalOffDutyToday}
                </span>
                <span className="text-xs font-semibold text-emerald-700">Guru</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                <span className="px-1.5 py-0.5 bg-emerald-200/60 text-emerald-900 rounded font-medium">
                  {countLibur} Libur ({dailyStatus.dayName})
                </span>
                <span className="px-1.5 py-0.5 bg-emerald-200/60 text-emerald-900 rounded font-medium">
                  {countBebas} Bebas Giliran
                </span>
              </div>
            </div>

            {/* Prioritas 2: Panitia Standby */}
            <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Prioritas 2: Panitia Standby
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-amber-950">
                  {dailyStatus.totalPanitia}
                </span>
                <span className="text-xs font-semibold text-amber-700">Guru</span>
              </div>
              <span className="text-[10px] text-amber-700 mt-2 block font-medium">
                Siaga Darurat Setiap Hari
              </span>
            </div>

            {/* Sedang Bertugas */}
            <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                Sedang Bertugas Mengawas
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-blue-950">
                  {dailyStatus.totalAssignedToday}
                </span>
                <span className="text-xs font-semibold text-blue-700">Guru</span>
              </div>
              <span className="text-[10px] text-blue-700 mt-2 block font-medium">
                Terjadwal di {examsOnDate.length} sesi hari ini
              </span>
            </div>

            {/* Total Guru Aktif */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Guru Aktif
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-slate-900">
                  {dailyStatus.totalActiveTeachers}
                </span>
                <span className="text-xs font-semibold text-slate-500">Guru</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 block font-medium">
                Database Guru Terdaftar
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua Kategori
          </button>
          <button
            onClick={() => setFilterCategory('UNAVAILABLE_DAY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'UNAVAILABLE_DAY'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-50'
            }`}
          >
            🏖️ Libur / Hari Tidak Tersedia ({countLibur})
          </button>
          <button
            onClick={() => setFilterCategory('OFF_DUTY_AVAILABLE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'OFF_DUTY_AVAILABLE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            ☕ Bebas Tugas Mengawas ({countBebas})
          </button>
          <button
            onClick={() => setFilterCategory('PANITIA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'PANITIA'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-white text-amber-950 border border-amber-200 hover:bg-amber-50'
            }`}
          >
            ⭐ Panitia Ujian ({dailyStatus?.totalPanitia || 0})
          </button>
          <button
            onClick={() => setFilterCategory('ASSIGNED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'ASSIGNED'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-blue-900 border border-blue-200 hover:bg-blue-50'
            }`}
          >
            📋 Sedang Mengawas ({dailyStatus?.totalAssignedToday || 0})
          </button>
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama / NIP / kode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* SECTION 1: PRIORITAS 1 - GURU BEBAS TUGAS HARI INI */}
      {(filterCategory === 'ALL' ||
        filterCategory === 'UNAVAILABLE_DAY' ||
        filterCategory === 'OFF_DUTY_AVAILABLE') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
              <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                🟢 Prioritas 1: Guru Bebas Tugas Hari Ini ({filteredOffDuty.length} Guru)
              </h4>
            </div>
            <span className="text-[11px] text-emerald-800 font-medium">
              Calon Pengawas Pengganti Utama Sebelum Menugaskan Panitia
            </span>
          </div>

          {filteredOffDuty.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <CalendarOff className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">
                Tidak ada guru bebas tugas yang sesuai dengan kriteria filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4 w-12 text-center">No</th>
                    <th className="py-2.5 px-4 w-28">Kode Pengawas</th>
                    <th className="py-2.5 px-4">Nama Lengkap Guru</th>
                    <th className="py-2.5 px-4">Status Hari Ini</th>
                    <th className="py-2.5 px-4">Hari Ketersediaan Mengajar</th>
                    <th className="py-2.5 px-4 text-center">Beban Mengawas Terjadwal</th>
                    <th className="py-2.5 px-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOffDuty.map((item, idx) => {
                    const days = item.teacher.available_days || [];
                    return (
                      <tr key={item.teacher.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-black tracking-wider">
                            {item.teacher.invigilator_code || 'GURU'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.teacher.name}</div>
                          <div className="text-[10px] text-slate-400">
                            NIP: {item.teacher.employee_number || '-'} &bull; {item.teacher.gender}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {item.isUnavailableDay ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                              <span>🏖️</span>
                              <span>Libur / Tidak Tersedia ({dailyStatus?.dayName})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                              <span>☕</span>
                              <span>Bebas Tugas Hari Ini</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((d) => {
                              const isAvail = days.includes(d);
                              const isToday = d === dailyStatus?.dayName;
                              return (
                                <span
                                  key={d}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    isToday
                                      ? isAvail
                                        ? 'bg-emerald-600 text-white font-black'
                                        : 'bg-rose-100 text-rose-800 border border-rose-200 font-bold'
                                      : isAvail
                                      ? 'bg-slate-100 text-slate-700'
                                      : 'bg-slate-50 text-slate-300'
                                  }`}
                                  title={isToday ? `${d} (Hari Ujian Ini)` : d}
                                >
                                  {d.slice(0, 3)}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md font-bold text-xs">
                            {item.totalWorkload} Sesi
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onAssignReplacement && onAssignReplacement(item.teacher.id, currentDate)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Tugaskan Pengganti</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: PRIORITAS 2 - PANITIA UJIAN STANDBY */}
      {(filterCategory === 'ALL' || filterCategory === 'PANITIA') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-amber-50/60 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
              <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                ⭐ Prioritas 2: Panitia Ujian Standby ({filteredPanitia.length} Guru)
              </h4>
            </div>
            <span className="text-[11px] text-amber-800 font-medium">
              Opsi Pengganti Cadangan Darurat (Jika Pengawas Reguler Berhalangan)
            </span>
          </div>

          {filteredPanitia.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              <p>Tidak ada data panitia yang sesuai.</p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPanitia.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded text-[9px] font-black">
                        PANITIA
                      </span>
                      <span className="font-bold text-slate-900 text-xs">{p.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      NIP: {p.employee_number || '-'} &bull; Catatan: {p.notes || 'Panitia'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAssignReplacement && onAssignReplacement(p.id, currentDate)}
                    className="shrink-0 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors"
                  >
                    Pilih Pengganti
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: DAFTAR GURU BERTUGAS HARI INI */}
      {(filterCategory === 'ALL' || filterCategory === 'ASSIGNED') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                📋 Guru Sedang Bertugas Mengawas Hari Ini ({filteredAssigned.length} Guru)
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">
              {dailyStatus?.dayName}, {formatIndonesianDate(currentDate)}
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filteredAssigned.map((item) => (
              <div
                key={item.teacher.id}
                className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs truncate" title={item.teacher.name}>
                    {item.teacher.name}
                  </span>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-black">
                    {item.assignmentCount}x Sesi
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Sesi: {item.sessions.join(', ') || '-'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
