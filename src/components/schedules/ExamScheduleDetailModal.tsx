import React from 'react';
import { Modal } from '../common/Modal';
import { ExamSchedule, MenuItemId } from '../../types/database';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import {
  formatIndonesianDate,
  calculateScheduleMetrics,
  getSubjectGradeLevels,
  formatGradeLevelsLabel,
} from '../../lib/scheduleHelper';
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  DoorOpen,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Edit2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface ExamScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ExamSchedule | null;
  onEdit?: (schedule: ExamSchedule) => void;
  onNavigate?: (menu: MenuItemId) => void;
}

export const ExamScheduleDetailModal: React.FC<ExamScheduleDetailModalProps> = ({
  isOpen,
  onClose,
  schedule,
  onEdit,
  onNavigate,
}) => {
  const { subjects, rooms, invigilatorSchedules, settings } = useData();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  if (!schedule) return null;

  const subject = subjects.find((s) => s.id === schedule.subject_id);
  const activeRooms = rooms.filter((r) => r.active);
  const invigilatorsPerRoom = settings.default_invigilators_per_room || 2;

  // Invigilator assignments for this schedule
  const scheduleInvigilators = invigilatorSchedules.filter(
    (inv) => inv.exam_schedule_id === schedule.id
  );
  const filledAssignments = scheduleInvigilators.filter((inv) => !!inv.teacher_id);

  const metrics = calculateScheduleMetrics(
    activeRooms.length,
    invigilatorsPerRoom,
    filledAssignments.length
  );

  const percent = metrics.totalRequired > 0
    ? Math.min(100, Math.round((metrics.totalFilled / metrics.totalRequired) * 100))
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detail Jadwal Ujian"
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Header Hero Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-sm border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {schedule.session}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {formatGradeLevelsLabel(getSubjectGradeLevels(subject))}
                </span>
                <span className="text-xs text-slate-300 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)} WIB
                </span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400 shrink-0" />
                <span>{subject?.name || 'Mata Pelajaran'}</span>
                {subject?.code && (
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                    {subject.code}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">{schedule.day_name}</span>, {formatIndonesianDate(schedule.exam_date)}
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold shadow-xs ${
                  metrics.status === 'Lengkap'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : metrics.status === 'Sebagian Terjadwal'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {metrics.status === 'Lengkap' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {metrics.status === 'Sebagian Terjadwal' && <Clock3 className="w-3.5 h-3.5" />}
                {metrics.status === 'Belum Dijadwalkan' && <AlertCircle className="w-3.5 h-3.5" />}
                {metrics.status}
              </span>

              {isAdmin && onEdit && (
                <button
                  onClick={() => {
                    onClose();
                    onEdit(schedule);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Jadwal</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5 pt-4 border-t border-slate-700/60">
            <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
              <span className="text-slate-300">Kelengkapan Pengawas Ruang</span>
              <span className="font-mono font-bold text-white">
                {metrics.totalFilled} / {metrics.totalRequired} Pengawas ({percent}%)
              </span>
            </div>
            <div className="w-full bg-slate-700/60 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  percent === 100
                    ? 'bg-emerald-500'
                    : percent > 0
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <DoorOpen className="w-4 h-4 text-blue-600" />
              <span>Ruang Aktif</span>
            </div>
            <p className="text-xl font-black text-slate-900">{metrics.activeRoomsCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Ruang ujian dipakai</p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Target / Ruang</span>
            </div>
            <p className="text-xl font-black text-slate-900">{metrics.invigilatorsPerRoom} <span className="text-xs font-normal text-slate-500">orang</span></p>
            <p className="text-[11px] text-slate-400 mt-0.5">Sesuai pengaturan</p>
          </div>

          <div className="p-3.5 bg-blue-50/50 border border-blue-200/60 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-blue-700 mb-1 font-semibold">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Kebutuhan Total</span>
            </div>
            <p className="text-xl font-black text-blue-900">{metrics.totalRequired}</p>
            <p className="text-[11px] text-blue-600/80 mt-0.5">{metrics.activeRoomsCount} ruang × {metrics.invigilatorsPerRoom} guru</p>
          </div>

          <div className={`p-3.5 rounded-xl border ${
            metrics.totalMissing === 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-1.5 text-xs mb-1 font-semibold">
              {metrics.totalMissing === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              )}
              <span>{metrics.totalMissing === 0 ? 'Pengawas Lengkap' : 'Masih Kurang'}</span>
            </div>
            <p className="text-xl font-black">
              {metrics.totalMissing === 0 ? '0' : metrics.totalMissing} <span className="text-xs font-normal">orang</span>
            </p>
            <p className="text-[11px] opacity-80 mt-0.5">
              {metrics.totalMissing === 0 ? 'Semua slot terisi' : `${metrics.totalFilled} dari ${metrics.totalRequired} terisi`}
            </p>
          </div>
        </div>

        {/* Catatan if any */}
        {schedule.notes && (
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs">
            <p className="font-bold text-amber-900 mb-0.5">Catatan Teknis Pelaksanaan:</p>
            <p className="text-amber-800 leading-relaxed">{schedule.notes}</p>
          </div>
        )}

        {/* Room Assignments Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-slate-500" />
              <span>Daftar Ruang & Penugasan Pengawas ({activeRooms.length} Ruang)</span>
            </h3>

            {onNavigate && (
              <button
                onClick={() => {
                  onClose();
                  onNavigate('invigilator_schedules');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
              >
                <span>Kelola di Penjadwalan Pengawas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {activeRooms.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Tidak ada ruang yang berstatus aktif di Data Master.
              </div>
            ) : (
              activeRooms.map((room) => {
                const assignments = scheduleInvigilators.filter((a) => a.room_id === room.id);
                return (
                  <div
                    key={room.id}
                    className="p-3 hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-44">
                      <p className="font-bold text-slate-900">{room.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Kode: {room.code} &bull; Kapasitas: {room.capacity} siswa
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 flex-1 sm:justify-end">
                      {Array.from({ length: invigilatorsPerRoom }).map((_, slotIdx) => {
                        const roleLabel = `Pengawas ${slotIdx + 1}`;
                        const assignment = assignments.find((a) => a.role === roleLabel);
                        const hasTeacher = assignment && assignment.teacher && assignment.teacher.name;

                        return (
                          <div
                            key={slotIdx}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                              hasTeacher
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-slate-100 border-dashed border-slate-300 text-slate-500'
                            }`}
                          >
                            <span className="font-semibold text-[10px] text-slate-400">
                              P{slotIdx + 1}:
                            </span>
                            <span className="font-medium truncate max-w-40">
                              {hasTeacher ? assignment.teacher?.name : 'Kosong'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
          >
            Tutup
          </button>

          {onNavigate && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('invigilator_schedules');
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Users className="w-4 h-4" />
              <span>Jadwalkan Pengawas untuk Sesi Ini</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
