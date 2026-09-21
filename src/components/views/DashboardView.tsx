import React, { useMemo } from 'react';
import {
  Users,
  Building2,
  DoorOpen,
  BookOpen,
  CalendarDays,
  UserCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  BarChart3,
  TrendingUp,
  XCircle,
  Printer,
  DollarSign,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useData } from '../../context/DataContext';
import { MenuItemId } from '../../types/database';

interface DashboardViewProps {
  onNavigate: (menu: MenuItemId) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    teachers,
    buildings,
    rooms,
    subjects,
    examSchedules,
    invigilatorSchedules,
    conflicts,
    emptyScheduleSlotsCount,
    scheduledInvigilatorsCount,
    settings,
  } = useData();

  const activeTeachersCount = useMemo(() => teachers.filter((t) => t.active).length, [teachers]);
  const activeRoomsCount = useMemo(() => rooms.filter((r) => r.active).length, [rooms]);

  // The 9 Essential Primary Metrics Required by Spec:
  const primaryMetrics = [
    {
      id: 'm1',
      label: 'Jumlah Guru',
      value: teachers.length,
      sublabel: `${activeTeachersCount} Guru Aktif`,
      icon: Users,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
      target: 'teachers' as MenuItemId,
    },
    {
      id: 'm2',
      label: 'Jumlah Guru Aktif',
      value: activeTeachersCount,
      sublabel: `${teachers.length - activeTeachersCount} Non-Aktif/Cuti`,
      icon: Users,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      target: 'teachers' as MenuItemId,
    },
    {
      id: 'm3',
      label: 'Jumlah Gedung',
      value: buildings.length,
      sublabel: 'Gedung Utama & Gedung Timur',
      icon: Building2,
      color: 'text-sky-600 bg-sky-50 border-sky-100',
      target: 'buildings' as MenuItemId,
    },
    {
      id: 'm4',
      label: 'Jumlah Ruang',
      value: rooms.length,
      sublabel: `${activeRoomsCount} Ruang Ujian Aktif`,
      icon: DoorOpen,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-100',
      target: 'rooms' as MenuItemId,
    },
    {
      id: 'm5',
      label: 'Jumlah Mata Pelajaran',
      value: subjects.length,
      sublabel: `${subjects.filter((s) => s.active).length} Mapel Aktif`,
      icon: BookOpen,
      color: 'text-teal-600 bg-teal-50 border-teal-100',
      target: 'subjects' as MenuItemId,
    },
    {
      id: 'm6',
      label: 'Jumlah Jadwal Ujian',
      value: examSchedules.length,
      sublabel: 'Total Sesi Pelaksanaan',
      icon: CalendarDays,
      color: 'text-purple-600 bg-purple-50 border-purple-100',
      target: 'exam_schedules' as MenuItemId,
    },
    {
      id: 'm7',
      label: 'Penugasan Pengawas',
      value: scheduledInvigilatorsCount,
      sublabel: 'Guru bertugas di ruang',
      icon: UserCheck,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      target: 'invigilator_schedules' as MenuItemId,
    },
    {
      id: 'm8',
      label: 'Konflik / Bentrok',
      value: conflicts.length,
      sublabel: conflicts.length === 0 ? 'Semua Jadwal Valid' : 'Perlu penanganan panitia',
      icon: AlertTriangle,
      color: conflicts.length > 0 ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-emerald-600 bg-emerald-50 border-emerald-100',
      target: 'invigilator_schedules' as MenuItemId,
    },
    {
      id: 'm9',
      label: 'Jadwal Belum Berpengawas',
      value: emptyScheduleSlotsCount,
      sublabel: emptyScheduleSlotsCount === 0 ? 'Seluruh Slot Terpenuhi' : 'Slot ruang kosong',
      icon: Clock,
      color: emptyScheduleSlotsCount > 0 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200',
      target: 'invigilator_schedules' as MenuItemId,
    },
  ];

  // Visual Statistics 1: Exams and Invigilator slots per Day
  const chartDataPerDay = useMemo(() => {
    const defaultQuota = settings.default_invigilators_per_room || 2;
    const map = new Map<string, { date: string; day: string; sessions: number; required: number; assigned: number }>();

    examSchedules.forEach((es) => {
      const existing = map.get(es.exam_date) || {
        date: es.exam_date,
        day: es.day_name,
        sessions: 0,
        required: 0,
        assigned: 0,
      };

      existing.sessions += 1;
      existing.required += activeRoomsCount * defaultQuota;

      const assignedForExam = invigilatorSchedules.filter(
        (inv) => inv.exam_schedule_id === es.id && !!inv.teacher_id
      ).length;
      existing.assigned += assignedForExam;

      map.set(es.exam_date, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        name: `${item.day.slice(0, 3)} (${item.date.slice(5)})`,
        fullDate: item.date,
        hari: item.day,
        'Sesi Ujian': item.sessions,
        'Pengawas Dibutuhkan': item.required,
        'Pengawas Ditugaskan': item.assigned,
      }));
  }, [examSchedules, activeRoomsCount, settings.default_invigilators_per_room, invigilatorSchedules]);

  // Visual Statistics 2: Teacher Workload Distribution
  const workloadDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    teachers.forEach((t) => {
      counts[t.id] = 0;
    });

    invigilatorSchedules.forEach((inv) => {
      if (inv.teacher_id && counts[inv.teacher_id] !== undefined) {
        counts[inv.teacher_id] += 1;
      }
    });

    // Sort teachers descending by assignment
    const sorted = teachers
      .map((t) => ({
        id: t.id,
        name: t.name,
        active: t.active,
        assignments: counts[t.id] || 0,
      }))
      .sort((a, b) => b.assignments - a.assignments);

    // Top 10 for clean readable Recharts display
    const top10 = sorted.slice(0, 10).map((t) => ({
      name: t.name.length > 15 ? `${t.name.slice(0, 14)}...` : t.name,
      fullName: t.name,
      'Jumlah Jaga': t.assignments,
    }));

    const allValues = sorted.map((s) => s.assignments);
    const max = allValues.length > 0 ? Math.max(...allValues) : 0;
    const min = allValues.length > 0 ? Math.min(...allValues) : 0;
    const avg = allValues.length > 0 ? (allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(1) : 0;

    return { top10, max, min, avg, totalTeachers: sorted.length };
  }, [teachers, invigilatorSchedules]);

  // Upcoming Exams List
  const upcomingExams = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const defaultQuota = settings.default_invigilators_per_room || 2;

    return examSchedules
      .slice()
      .sort((a, b) => a.exam_date.localeCompare(b.exam_date) || a.start_time.localeCompare(b.start_time))
      .slice(0, 6)
      .map((exam) => {
        const subject = subjects.find((s) => s.id === exam.subject_id);
        const assignedCount = invigilatorSchedules.filter(
          (inv) => inv.exam_schedule_id === exam.id && !!inv.teacher_id
        ).length;
        const totalNeeded = activeRoomsCount * defaultQuota;
        const isComplete = totalNeeded > 0 && assignedCount >= totalNeeded;

        return {
          ...exam,
          subjectName: subject?.name || 'Mata Pelajaran',
          subjectCode: subject?.code || '-',
          assignedCount,
          totalNeeded,
          isComplete,
        };
      });
  }, [examSchedules, subjects, invigilatorSchedules, activeRoomsCount, settings.default_invigilators_per_room]);

  // Overall system readiness
  const totalSlotsNeeded = useMemo(() => {
    const defaultQuota = settings.default_invigilators_per_room || 2;
    return examSchedules.length * activeRoomsCount * defaultQuota;
  }, [examSchedules, activeRoomsCount, settings.default_invigilators_per_room]);

  const readinessPercent = totalSlotsNeeded > 0 ? Math.min(100, Math.round((scheduledInvigilatorsCount / totalSlotsNeeded) * 100)) : 100;
  const isSystemClean = conflicts.length === 0 && (emptyScheduleSlotsCount === 0 || scheduledInvigilatorsCount > 0);

  return (
    <div className="space-y-6 max-w-7xl pb-10">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 sm:p-7 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/20 mb-2.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sistem Manajemen Ujian Sekolah</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {settings.school_name || 'SMP BHINNEKA TUNGGAL IKA'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {settings.exam_name} &bull; Tahun Ajaran {settings.academic_year} ({settings.semester || 'Semester Genap'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/15 text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold">Kesiapan</p>
              <div className="flex items-center justify-center gap-1 font-black text-base text-emerald-400">
                <span>{readinessPercent}%</span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('attendance')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition-colors whitespace-nowrap"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Kehadiran & Bendahara</span>
            </button>

            <button
              onClick={() => onNavigate('print_center')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold backdrop-blur-xs border border-white/20 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Pusat Cetak</span>
            </button>

            <button
              onClick={() => onNavigate('invigilator_schedules')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors whitespace-nowrap"
            >
              <span>Jadwal Pengawas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Indikator Status Sistem (Data Lengkap / Ada Masalah) */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
          conflicts.length > 0
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : emptyScheduleSlotsCount > 0
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}
      >
        <div className="flex items-center gap-3">
          {conflicts.length > 0 ? (
            <div className="p-2 bg-rose-100 rounded-xl text-rose-600 shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
          ) : emptyScheduleSlotsCount > 0 ? (
            <div className="p-2 bg-amber-100 rounded-xl text-amber-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="text-xs font-black uppercase tracking-wider">
              {conflicts.length > 0
                ? 'Status Sistem: Ditemukan Bentrok / Masalah Jadwal'
                : emptyScheduleSlotsCount > 0
                ? 'Status Sistem: Masih Ada Slot Ruang Belum Berpenugasan'
                : 'Status Sistem: Data Lengkap & Jadwal Valid'}
            </div>
            <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
              {conflicts.length > 0
                ? `Terdapat ${conflicts.length} bentrok jadwal pengawas yang membutuhkan tindakan koreksi panitia.`
                : emptyScheduleSlotsCount > 0
                ? `Terdapat ${emptyScheduleSlotsCount} penugasan ruang yang belum memiliki guru pengawas.`
                : `Seluruh konfigurasi 45 ruang, 2 gedung, dan jadwal pengawas berada dalam kondisi siap cetak.`}
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('invigilator_schedules')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap self-start sm:self-auto ${
            conflicts.length > 0
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs'
          }`}
        >
          {conflicts.length > 0 ? 'Buka Jadwal Pengawas' : 'Kelola Penugasan'}
        </button>
      </div>

      {/* 9 Summary Metric Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Metrik Operasional Ujian</h2>
          <span className="text-[11px] text-slate-400">9 Indikator Utama Terpantau</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-3.5">
          {primaryMetrics.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => onNavigate(item.target)}
                className="group bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex items-start justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-500 group-hover:text-slate-800 transition-colors">
                    {item.label}
                  </span>
                  <div className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                    {item.value}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.sublabel}</p>
                </div>
                <div className={`p-2 rounded-xl ${item.color} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Charts: Grafik Ujian per Hari & Distribusi Beban Guru */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Ujian & Kebutuhan Pengawas per Hari */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Grafik Ujian & Pengawas per Hari</h3>
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                {chartDataPerDay.length} Tanggal Ujian
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 mb-4">
              Perbandingan jumlah sesi ujian dan kebutuhan slot pengawas per hari
            </p>

            <div className="h-64 w-full">
              {chartDataPerDay.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Belum ada data jadwal ujian
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataPerDay} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        border: 'none',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="Pengawas Dibutuhkan" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pengawas Ditugaskan" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Standar Ruang: 45 Ruang Aktif</span>
            <button
              onClick={() => onNavigate('exam_schedules')}
              className="text-blue-600 font-bold hover:text-blue-700 inline-flex items-center gap-1"
            >
              <span>Lihat Semua Sesi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* CHART 2: Distribusi Beban Pengawas per Guru */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Distribusi Beban Pengawas per Guru</h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <span>Rerata: {workloadDistribution.avg} sesi</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 mb-4">
              Top 10 guru dengan frekuensi penugasan jaga ujian (Min: {workloadDistribution.min}, Max:{' '}
              {workloadDistribution.max})
            </p>

            <div className="h-64 w-full">
              {workloadDistribution.top10.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Belum ada penugasan pengawas
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadDistribution.top10} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        border: 'none',
                      }}
                    />
                    <Bar dataKey="Jumlah Jaga" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Keadilan Beban: Terdistribusi Otomatis</span>
            <button
              onClick={() => onNavigate('teachers')}
              className="text-emerald-700 font-bold hover:text-emerald-800 inline-flex items-center gap-1"
            >
              <span>Master Data Guru</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabel Ringkasan Ujian Mendatang */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Ringkasan Ujian Mendatang</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Jadwal pelaksanaan mata pelajaran berikutnya dan status kelengkapan pengawas ruang
            </p>
          </div>
          <button
            onClick={() => onNavigate('exam_schedules')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <span>Buka Seluruh Jadwal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto mt-3">
          {upcomingExams.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Belum ada jadwal ujian yang didaftarkan.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Tanggal & Hari</th>
                  <th className="py-2.5 px-3">Sesi & Jam</th>
                  <th className="py-2.5 px-3">Mata Pelajaran</th>
                  <th className="py-2.5 px-3 text-center">Ruang Aktif</th>
                  <th className="py-2.5 px-3 text-center">Status Pengawas</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcomingExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>
                          {exam.day_name}, {exam.exam_date}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700 text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {exam.session} ({exam.start_time.slice(0, 5)} - {exam.end_time.slice(0, 5)})
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900">{exam.subjectName}</span>
                      <span className="text-slate-400 text-[11px] ml-1.5 font-mono">({exam.subjectCode})</span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-700">
                      {activeRoomsCount} Ruang
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          exam.isComplete
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {exam.isComplete ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-600" />
                        )}
                        <span>
                          {exam.assignedCount} / {exam.totalNeeded} Slot
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onNavigate('invigilator_schedules')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-lg font-semibold text-[11px] transition-colors"
                      >
                        Atur Pengawas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
