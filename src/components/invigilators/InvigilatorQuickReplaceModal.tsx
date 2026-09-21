import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  DoorOpen,
  UserX,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { InvigilatorSchedule, Teacher } from '../../types/database';

interface InvigilatorQuickReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: InvigilatorSchedule | null;
}

export const InvigilatorQuickReplaceModal: React.FC<InvigilatorQuickReplaceModalProps> = ({
  isOpen,
  onClose,
  assignment,
}) => {
  const {
    examSchedules,
    rooms,
    teachers,
    subjects,
    invigilatorSchedules,
    quickReplaceInvigilator,
  } = useData();

  const { success: toastSuccess, error: toastError } = useToast();

  const [newTeacherId, setNewTeacherId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const exam = useMemo(() => {
    if (!assignment) return null;
    return examSchedules.find((e) => e.id === assignment.exam_schedule_id);
  }, [assignment, examSchedules]);

  const room = useMemo(() => {
    if (!assignment) return null;
    return rooms.find((r) => r.id === assignment.room_id);
  }, [assignment, rooms]);

  const currentTeacher = useMemo(() => {
    if (!assignment?.teacher_id) return null;
    return teachers.find((t) => t.id === assignment.teacher_id);
  }, [assignment, teachers]);

  const subject = useMemo(() => {
    if (!exam) return null;
    return subjects.find((s) => s.id === exam.subject_id);
  }, [exam, subjects]);

  // Find teachers busy in the same session
  const busyTeacherIds = useMemo(() => {
    if (!exam) return new Set<string>();
    const ids = new Set<string>();

    invigilatorSchedules.forEach((inv) => {
      if (!inv.teacher_id || inv.id === assignment?.id) return;
      const otherExam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
      if (otherExam && otherExam.exam_date === exam.exam_date && otherExam.session === exam.session) {
        ids.add(inv.teacher_id);
      }
    });

    return ids;
  }, [exam, invigilatorSchedules, examSchedules, assignment]);

  // Calculate workloads
  const teacherWorkloadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    invigilatorSchedules.forEach((inv) => {
      if (inv.teacher_id) {
        counts.set(inv.teacher_id, (counts.get(inv.teacher_id) || 0) + 1);
      }
    });
    return counts;
  }, [invigilatorSchedules]);

  // Filter eligible replacement teachers
  const eligibleTeachers = useMemo(() => {
    return teachers
      .filter((t) => t.active)
      .filter((t) => t.id !== assignment?.teacher_id)
      .map((t) => {
        const isBusy = busyTeacherIds.has(t.id);
        const isAvailableDay = exam ? t.available_days?.includes(exam.day_name) : true;
        const count = teacherWorkloadCounts.get(t.id) || 0;
        return {
          ...t,
          isBusy,
          isAvailableDay,
          count,
        };
      })
      .sort((a, b) => {
        // Priority: not busy first, then available day, then lowest workload
        if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
        if (a.isAvailableDay !== b.isAvailableDay) return a.isAvailableDay ? -1 : 1;
        return a.count - b.count;
      });
  }, [teachers, assignment, busyTeacherIds, exam, teacherWorkloadCounts]);

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;

    if (!newTeacherId) {
      toastError('Silakan pilih guru pengganti terlebih dahulu');
      return;
    }

    setSubmitting(true);
    try {
      const res = await quickReplaceInvigilator(assignment.id, newTeacherId, 'Digantikan');
      if (!res.success) throw new Error(res.error);

      const newTeacher = teachers.find((t) => t.id === newTeacherId);
      toastSuccess(`Berhasil mengganti pengawas menjadi ${newTeacher?.name || 'Guru'}`);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengganti pengawas';
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetUnassigned = async () => {
    if (!assignment) return;
    if (window.confirm('Kosongkan penugasan ini sehingga berstatus belum ada guru pengawas?')) {
      setSubmitting(true);
      try {
        await quickReplaceInvigilator(assignment.id, null, 'Izin');
        toastSuccess('Penugasan dikosongkan (status izin)');
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal mengosongkan pengawas';
        toastError(msg);
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (!assignment || !exam || !room) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ganti Guru Pengawas (Penggantian Darurat)"
      maxWidth="lg"
    >
      <form onSubmit={handleReplace} className="space-y-4">
        {/* Info Box */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-900 font-bold">
            <span>{subject?.name || 'Mata Pelajaran'}</span>
            <span className="text-blue-600 font-semibold">{assignment.role}</span>
          </div>
          <p className="text-slate-600">
            {exam.day_name}, {exam.exam_date} &bull; {exam.session} ({exam.start_time.slice(0, 5)} - {exam.end_time.slice(0, 5)})
          </p>
          <p className="text-slate-600">
            Lokasi: <strong>{room.name}</strong> ({room.code})
          </p>
          <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
            <span className="text-slate-500">Pengawas Saat Ini:</span>
            <span className="font-bold text-rose-700">
              {currentTeacher?.name || 'Belum Ada'} ({assignment.status})
            </span>
          </div>
        </div>

        {/* Guru Pengganti */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Pilih Guru Pengganti <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={newTeacherId}
            onChange={(e) => setNewTeacherId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">-- Pilih Guru Pengganti --</option>
            {eligibleTeachers.map((t) => {
              const badge = t.isBusy
                ? ' [BENTROK: Sedang Mengawas di Sesi Ini]'
                : !t.isAvailableDay
                ? ` [Tdk Ada Hari ${exam.day_name}] (${t.count}x)`
                : ` [Tersedia] (${t.count}x mengawas)`;

              return (
                <option key={t.id} value={t.id} disabled={t.isBusy}>
                  {t.name} - {badge}
                </option>
              );
            })}
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            * Rekomendasi guru yang tidak bentrok dan memiliki beban mengawas paling sedikit ditampilkan di urutan teratas.
          </p>
        </div>

        {/* Alasan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Alasan Penggantian (Opsional)
          </label>
          <input
            type="text"
            placeholder="Misal: Sakit, Tugas Luar, Izin Keperluan Keluarga..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSetUnassigned}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors"
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Tandai Izin (Kosongkan)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !newTeacherId}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{submitting ? 'Mengganti...' : 'Ganti Pengawas Sekarang'}</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
