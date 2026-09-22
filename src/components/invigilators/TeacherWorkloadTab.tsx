import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Download,
  Calendar,
  Clock,
  Printer,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { Teacher, ExamSchedule } from '../../types/database';
import { exportTeacherWorkloadData, TeacherWorkloadStat, isPanitiaTeacher } from '../../lib/invigilatorHelper';

interface TeacherWorkloadTabProps {
  onSelectTeacherForFilter?: (teacherId: string) => void;
  onPrintTeacherSchedule?: (teacherId: string) => void;
}

export const TeacherWorkloadTab: React.FC<TeacherWorkloadTabProps> = ({
  onSelectTeacherForFilter,
  onPrintTeacherSchedule,
}) => {
  const { teachers, examSchedules, invigilatorSchedules, rooms } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  // Compute workload statistics
  const workloadStats = useMemo<TeacherWorkloadStat[]>(() => {
    return teachers
      .filter((t) => t.active)
      .map((t) => {
        const myAssignments = invigilatorSchedules.filter((inv) => inv.teacher_id === t.id);
        const assignedDays: { [day: string]: number } = {};
        const assignedSessions: { [sessionKey: string]: number } = {};
        const roles: { [role: string]: number } = {};

        myAssignments.forEach((inv) => {
          const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
          if (exam) {
            assignedDays[exam.day_name] = (assignedDays[exam.day_name] || 0) + 1;
            const sKey = `${exam.exam_date}_${exam.session}`;
            assignedSessions[sKey] = (assignedSessions[sKey] || 0) + 1;
          }
          roles[inv.role] = (roles[inv.role] || 0) + 1;
        });

        return {
          teacherId: t.id,
          teacherName: t.name,
          employeeNumber: t.employee_number,
          gender: t.gender,
          active: t.active,
          availableDays: t.available_days || [],
          totalAssigned: myAssignments.length,
          assignedDays,
          assignedSessions,
          roles,
          isPanitia: isPanitiaTeacher(t),
          notes: t.notes,
        };
      })
      .sort((a, b) => b.totalAssigned - a.totalAssigned || a.teacherName.localeCompare(b.teacherName));
  }, [teachers, invigilatorSchedules, examSchedules]);

  // Filtered list
  const filteredWorkloads = useMemo(() => {
    return workloadStats.filter((stat) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        stat.teacherName.toLowerCase().includes(q) ||
        (stat.employeeNumber && stat.employeeNumber.includes(q));

      if (!matchSearch) return false;

      if (filterType === 'ASSIGNED') return stat.totalAssigned > 0;
      if (filterType === 'UNASSIGNED') return stat.totalAssigned === 0;
      return true;
    });
  }, [workloadStats, searchTerm, filterType]);

  // Average, Min, Max stats
  const summary = useMemo(() => {
    if (workloadStats.length === 0) return { total: 0, avg: 0, max: 0, min: 0, assignedCount: 0 };
    const total = workloadStats.reduce((acc, curr) => acc + curr.totalAssigned, 0);
    const assignedList = workloadStats.filter((w) => w.totalAssigned > 0);
    const avg = assignedList.length > 0 ? (total / assignedList.length).toFixed(1) : '0';
    const max = Math.max(...workloadStats.map((w) => w.totalAssigned), 0);
    const min = assignedList.length > 0 ? Math.min(...assignedList.map((w) => w.totalAssigned)) : 0;
    return {
      total,
      avg,
      max,
      min,
      assignedCount: assignedList.length,
    };
  }, [workloadStats]);

  const handleExport = (format: 'xlsx' | 'csv') => {
    exportTeacherWorkloadData(filteredWorkloads, format);
  };

  // Detailed assignments for selected teacher
  const selectedTeacherAssignments = useMemo(() => {
    if (!selectedTeacherId) return [];
    return invigilatorSchedules
      .filter((inv) => inv.teacher_id === selectedTeacherId)
      .map((inv) => {
        const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
        const room = rooms.find((r) => r.id === inv.room_id);
        return {
          ...inv,
          exam,
          room,
        };
      })
      .sort((a, b) => {
        if (a.exam && b.exam) {
          if (a.exam.exam_date !== b.exam.exam_date) return a.exam.exam_date.localeCompare(b.exam.exam_date);
          return a.exam.start_time.localeCompare(b.exam.start_time);
        }
        return 0;
      });
  }, [selectedTeacherId, invigilatorSchedules, examSchedules, rooms]);

  return (
    <div className="space-y-5">
      {/* Top metric overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Guru Bertugas
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-slate-900">{summary.assignedCount}</span>
            <span className="text-xs text-slate-400">/ {teachers.filter((t) => t.active).length} guru aktif</span>
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Rata-rata Tugas
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-blue-600">{summary.avg}</span>
            <span className="text-xs text-slate-400">sesi / guru</span>
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Beban Maksimal
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-amber-600">{summary.max}</span>
            <span className="text-xs text-slate-400">sesi</span>
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Beban Minimal
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-teal-600">{summary.min}</span>
            <span className="text-xs text-slate-400">sesi (guru bertugas)</span>
          </div>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama guru / NIP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-52 sm:w-64 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                filterType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Guru ({workloadStats.length})
            </button>
            <button
              onClick={() => setFilterType('ASSIGNED')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                filterType === 'ASSIGNED'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bertugas ({summary.assignedCount})
            </button>
            <button
              onClick={() => setFilterType('UNASSIGNED')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                filterType === 'UNASSIGNED'
                  ? 'bg-white text-slate-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Belum ({workloadStats.length - summary.assignedCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel Rekap</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Main Workload Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Guru & NIP</th>
                <th className="py-3 px-4 text-center">Total Mengawas</th>
                <th className="py-3 px-4">Daftar Hari Bertugas</th>
                <th className="py-3 px-4">Ketersediaan Hari</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWorkloads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    Tidak ada guru yang sesuai dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredWorkloads.map((stat, idx) => {
                  const hasAssigned = stat.totalAssigned > 0;
                  const assignedDaysList = Object.entries(stat.assignedDays);

                  return (
                    <tr
                      key={stat.teacherId}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        selectedTeacherId === stat.teacherId ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-medium text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">
                                {stat.teacherName}
                              </span>
                              {stat.isPanitia && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  ⭐ Panitia (Standby)
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">
                              NIP: {stat.employeeNumber || '-'} &bull; {stat.gender}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {stat.isPanitia && stat.totalAssigned === 0 ? (
                          <span
                            className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                            title="Disiagakan sebagai pengawas pengganti darurat setiap hari"
                          >
                            0 Sesi (Standby)
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black ${
                              stat.totalAssigned >= 4
                                ? 'bg-amber-100 text-amber-800'
                                : stat.totalAssigned > 0
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {stat.totalAssigned} Sesi
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {assignedDaysList.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {assignedDaysList.map(([day, cnt]) => (
                              <span
                                key={day}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700"
                              >
                                {day}
                                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">
                                  {cnt}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : stat.isPanitia ? (
                          <span className="text-amber-800 text-[11px] font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Standby Opsi Pengganti
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Belum bertugas</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {stat.isPanitia ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Tersedia Setiap Hari (Standby)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {stat.availableDays.length > 0 ? (
                              stat.availableDays.map((d) => (
                                <span
                                  key={d}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                >
                                  {d}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">Semua hari</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              setSelectedTeacherId(
                                selectedTeacherId === stat.teacherId ? null : stat.teacherId
                              )
                            }
                            title="Rincian Jadwal Guru"
                            className={`p-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              selectedTeacherId === stat.teacherId
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>Detail</span>
                          </button>

                          {onSelectTeacherForFilter && (
                            <button
                              onClick={() => onSelectTeacherForFilter(stat.teacherId)}
                              title="Tampilkan di Tabel Jadwal Pengawas"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors text-xs font-semibold"
                            >
                              Filter
                            </button>
                          )}

                          {onPrintTeacherSchedule && hasAssigned && (
                            <button
                              onClick={() => onPrintTeacherSchedule(stat.teacherId)}
                              title="Cetak Jadwal Pribadi Guru"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Expanded Teacher Schedule Detail Panel */}
      {selectedTeacherId && (
        <div className="p-4 bg-white border border-blue-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">
                Rincian Jadwal Tugas:{' '}
                {workloadStats.find((w) => w.teacherId === selectedTeacherId)?.teacherName}
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">
                {selectedTeacherAssignments.length} Tugas
              </span>
            </div>

            <button
              onClick={() => setSelectedTeacherId(null)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Tutup Rincian
            </button>
          </div>

          {selectedTeacherAssignments.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              Guru ini belum memiliki jadwal pengawasan ujian yang ditugaskan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Tanggal & Hari</th>
                    <th className="py-2 px-3">Sesi & Jam</th>
                    <th className="py-2 px-3">Mata Pelajaran</th>
                    <th className="py-2 px-3">Ruang & Gedung</th>
                    <th className="py-2 px-3">Peran</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedTeacherAssignments.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {item.exam?.day_name}, {item.exam?.exam_date}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {item.exam?.session} ({item.exam?.start_time.slice(0, 5)} - {item.exam?.end_time.slice(0, 5)})
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {item.exam?.subject?.name || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-semibold">
                        {item.room?.name} ({item.room?.code})
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {item.role}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'Hadir'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'Izin'
                              ? 'bg-rose-50 text-rose-700'
                              : item.status === 'Digantikan'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
