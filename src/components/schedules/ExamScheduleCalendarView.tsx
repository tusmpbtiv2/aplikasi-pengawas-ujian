import React from 'react';
import { ExamSchedule, Subject, MenuItemId } from '../../types/database';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import {
  formatIndonesianDate,
  calculateScheduleMetrics,
} from '../../lib/scheduleHelper';
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  DoorOpen,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Eye,
  Edit2,
  Trash2,
  ArrowRight,
} from 'lucide-react';

interface ExamScheduleCalendarViewProps {
  schedules: ExamSchedule[];
  onViewDetail: (schedule: ExamSchedule) => void;
  onEdit: (schedule: ExamSchedule) => void;
  onDelete: (schedule: ExamSchedule) => void;
  onNavigate?: (menu: MenuItemId) => void;
}

export const ExamScheduleCalendarView: React.FC<ExamScheduleCalendarViewProps> = ({
  schedules,
  onViewDetail,
  onEdit,
  onDelete,
  onNavigate,
}) => {
  const { subjects, rooms, invigilatorSchedules, settings } = useData();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  const activeRooms = rooms.filter((r) => r.active);
  const invigilatorsPerRoom = settings.default_invigilators_per_room || 2;

  // Group schedules by exam_date
  const groupedByDate: Record<string, ExamSchedule[]> = {};
  schedules.forEach((es) => {
    if (!groupedByDate[es.exam_date]) {
      groupedByDate[es.exam_date] = [];
    }
    groupedByDate[es.exam_date].push(es);
  });

  // Sort dates
  const sortedDates = Object.keys(groupedByDate).sort();

  if (sortedDates.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500">
        <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-bold text-slate-700 text-sm">Tidak Ada Jadwal Ujian yang Cocok</p>
        <p className="mt-1">Coba sesuaikan kata kunci pencarian atau filter yang aktif.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((dateStr) => {
        const dateSchedules = groupedByDate[dateStr].sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        );
        const dayName = dateSchedules[0]?.day_name || 'Senin';

        return (
          <div
            key={dateStr}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
          >
            {/* Date Header Ribbon */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex flex-col items-center justify-center font-black leading-tight shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-blue-200">
                    {dayName.slice(0, 3)}
                  </span>
                  <span className="text-sm font-black">
                    {dateStr.split('-')[2]}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>{dayName}</span>
                    <span className="text-slate-400 font-normal">&bull;</span>
                    <span className="text-xs text-slate-600 font-medium">
                      {formatIndonesianDate(dateStr)}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {dateSchedules.length} sesi ujian terjadwal
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-700">
                  {dateSchedules.length} Sesi Ujian
                </span>
              </div>
            </div>

            {/* Session Cards Grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {dateSchedules.map((schedule) => {
                const subject = subjects.find((s) => s.id === schedule.subject_id);
                const assignedCount = invigilatorSchedules.filter(
                  (inv) => inv.exam_schedule_id === schedule.id && !!inv.teacher_id
                ).length;

                const metrics = calculateScheduleMetrics(
                  activeRooms.length,
                  invigilatorsPerRoom,
                  assignedCount
                );

                return (
                  <div
                    key={schedule.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-50 text-blue-700 border border-blue-100">
                            {schedule.session}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            metrics.status === 'Lengkap'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : metrics.status === 'Sebagian Terjadwal'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {metrics.status === 'Lengkap' && <CheckCircle2 className="w-3 h-3" />}
                          {metrics.status === 'Sebagian Terjadwal' && <Clock3 className="w-3 h-3" />}
                          {metrics.status === 'Belum Dijadwalkan' && <AlertCircle className="w-3 h-3" />}
                          {metrics.status}
                        </span>
                      </div>

                      {/* Subject Name */}
                      <div className="mb-3">
                        <p className="font-extrabold text-slate-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">
                          {subject?.name || 'Mata Pelajaran'}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Kode: {subject?.code || '-'}
                        </p>
                      </div>

                      {/* Metrics stats */}
                      <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 rounded-lg text-center text-xs mb-3 border border-slate-100">
                        <div>
                          <p className="text-[10px] text-slate-400">Ruang</p>
                          <p className="font-bold text-slate-800">{metrics.activeRoomsCount}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">Target</p>
                          <p className="font-bold text-blue-700">{metrics.totalRequired}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">Terisi</p>
                          <p className={`font-bold ${
                            metrics.totalFilled >= metrics.totalRequired
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}>
                            {metrics.totalFilled} / {metrics.totalRequired}
                          </p>
                        </div>
                      </div>

                      {schedule.notes && (
                        <p className="text-[11px] text-slate-500 italic truncate mb-3">
                          "{schedule.notes}"
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onViewDetail(schedule)}
                          title="Lihat Detail"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => onEdit(schedule)}
                              title="Edit Jadwal"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDelete(schedule)}
                              title="Hapus Jadwal"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>

                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('invigilator_schedules')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <span>Atur Pengawas</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
