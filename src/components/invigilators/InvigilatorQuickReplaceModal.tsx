import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  DoorOpen,
  UserX,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { InvigilatorSchedule, Teacher } from '../../types/database';
import { isPanitiaTeacher } from '../../lib/invigilatorHelper';

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

  // Find teachers assigned in ANY session on this entire date
  const busyTeacherIdsOnDate = useMemo(() => {
    if (!exam) return new Set<string>();
    const ids = new Set<string>();
    const examsOnDate = examSchedules.filter((e) => e.exam_date === exam.exam_date);
    const examIdsOnDate = new Set(examsOnDate.map((e) => e.id));

    invigilatorSchedules.forEach((inv) => {
      if (!inv.teacher_id || inv.id === assignment?.id) return;
      if (examIdsOnDate.has(inv.exam_schedule_id)) {
        ids.add(inv.teacher_id);
      }
    });

    return ids;
  }, [exam, examSchedules, invigilatorSchedules, assignment]);

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

  // Categorize replacement candidates:
  // 1. Prioritas 1: Guru Bebas Tugas Hari Ini (tidak mendapat jadwal mengawas di hari itu, karena libur / hari tidak tersedia / bebas tugas)
  // 2. Prioritas 2: Panitia Ujian (siaga setiap hari)
  // 3. Guru Lainnya (bebas di sesi ini)
  const { offDutyStandbyList, panitiaStandbyList, otherEligibleList } = useMemo(() => {
    const offDuty: Array<Teacher & { count: number; isUnavailableDay: boolean; isBusy: boolean }> = [];
    const panitia: Array<Teacher & { count: number; isBusy: boolean }> = [];
    const others: Array<Teacher & { count: number; isBusy: boolean; isAvailableDay: boolean }> = [];

    teachers
      .filter((t) => t.active && t.id !== assignment?.teacher_id)
      .forEach((t) => {
        const isPanitia = isPanitiaTeacher(t);
        const isBusy = busyTeacherIds.has(t.id);
        const isAssignedOnDate = busyTeacherIdsOnDate.has(t.id);
        const isAvailableDay = exam ? (t.available_days || []).includes(exam.day_name) : true;
        const count = teacherWorkloadCounts.get(t.id) || 0;

        if (isPanitia) {
          panitia.push({ ...t, count, isBusy });
        } else if (!isAssignedOnDate) {
          // Guru yang tidak ada jadwal mengawas di hari itu (karena libur/hari tidak tersedia atau bebas tugas)
          offDuty.push({
            ...t,
            count,
            isUnavailableDay: !isAvailableDay,
            isBusy,
          });
        } else {
          others.push({
            ...t,
            count,
            isBusy,
            isAvailableDay,
          });
        }
      });

    // Urutkan offDuty: guru tanpa bentrok, libur hari ini, lalu beban mengawas paling sedikit
    offDuty.sort((a, b) => {
      if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
      if (a.isUnavailableDay !== b.isUnavailableDay) return a.isUnavailableDay ? -1 : 1;
      return a.count - b.count || a.name.localeCompare(b.name);
    });

    // Urutkan panitia: tanpa bentrok, lalu beban mengawas
    panitia.sort((a, b) => {
      if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
      return a.count - b.count || a.name.localeCompare(b.name);
    });

    // Urutkan guru lainnya: tanpa bentrok, ketersediaan, lalu beban
    others.sort((a, b) => {
      if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
      if (a.isAvailableDay !== b.isAvailableDay) return a.isAvailableDay ? -1 : 1;
      return a.count - b.count || a.name.localeCompare(b.name);
    });

    return {
      offDutyStandbyList: offDuty,
      panitiaStandbyList: panitia,
      otherEligibleList: others,
    };
  }, [teachers, assignment, busyTeacherIds, busyTeacherIdsOnDate, exam, teacherWorkloadCounts]);

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

        {/* Prioritas 1 Cepat: Guru Bebas Tugas Hari Ini (Libur / Tidak Mengawas Sebelum Panitia) */}
        {offDutyStandbyList.length > 0 && (
          <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Prioritas 1: Guru Bebas Tugas Hari Ini ({offDutyStandbyList.length} Guru):
              </span>
              <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md font-semibold">
                Sebelum Panitia
              </span>
            </div>
            <p className="text-[11px] text-emerald-700">
              Guru berikut tidak memiliki jadwal mengawas pada hari ini (karena hari libur/tidak tersedia atau tidak ada giliran tugas).
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-0.5">
              {offDutyStandbyList.slice(0, 12).map((p) => {
                const isSelected = newTeacherId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={p.isBusy}
                    onClick={() => {
                      setNewTeacherId(p.id);
                      if (!reason) setReason(`Pengawas izin mendadak - digantikan ${p.name} (Bebas tugas hari ini)`);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : p.isBusy
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-white text-emerald-950 border border-emerald-300 hover:bg-emerald-100/80'
                    }`}
                  >
                    <span>{p.isUnavailableDay ? '🏖️' : '☕'} {p.name}</span>
                    <span className="text-[10px] opacity-75 font-normal">
                      {p.isUnavailableDay ? '(Libur)' : `(${p.count}x)`}
                    </span>
                  </button>
                );
              })}
              {offDutyStandbyList.length > 12 && (
                <span className="text-[10px] text-emerald-700 self-center font-medium pl-1">
                  +{offDutyStandbyList.length - 12} guru lainnya (lihat dropdown di bawah)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Prioritas 2 Cepat: Guru Panitia (Standby Pengganti Darurat) */}
        {panitiaStandbyList.length > 0 && (
          <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Prioritas 2: Panitia Ujian (Opsi Darurat):
              </span>
              <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md font-semibold">
                Siaga Darurat
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {panitiaStandbyList.map((p) => {
                const isSelected = newTeacherId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={p.isBusy}
                    onClick={() => {
                      setNewTeacherId(p.id);
                      if (!reason) setReason('Pengawas izin mendadak - digantikan Panitia');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-xs'
                        : p.isBusy
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100/70'
                    }`}
                  >
                    <span>⭐ {p.name}</span>
                    {p.isBusy ? (
                      <span className="text-[10px] text-rose-500 font-normal">(Sedang Mengawas)</span>
                    ) : (
                      <span className="text-[10px] opacity-75 font-normal">({p.count}x)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
            {offDutyStandbyList.length > 0 && (
              <optgroup label="🟢 PRIORITAS 1: Guru Bebas Tugas Hari Ini (Libur / Tidak Ada Jadwal)">
                {offDutyStandbyList.map((t) => {
                  const labelType = t.isUnavailableDay ? 'Libur/Tdk Ada Jadwal' : 'Bebas Tugas Hari Ini';
                  const badge = t.isBusy
                    ? ' [BENTROK: Sedang Mengawas di Sesi Ini]'
                    : ` [${labelType}] (${t.count}x mengawas)`;
                  return (
                    <option key={t.id} value={t.id} disabled={t.isBusy}>
                      🟢 [{t.invigilator_code || 'GURU'}] {t.name} - {badge}
                    </option>
                  );
                })}
              </optgroup>
            )}
            {panitiaStandbyList.length > 0 && (
              <optgroup label="⭐ PRIORITAS 2: Panitia Ujian (Siaga Setiap Hari)">
                {panitiaStandbyList.map((t) => {
                  const badge = t.isBusy
                    ? ' [BENTROK: Sedang Mengawas di Sesi Ini]'
                    : ` [SIAGA PANITIA] (${t.count}x mengawas)`;
                  return (
                    <option key={t.id} value={t.id} disabled={t.isBusy}>
                      ⭐ [{t.invigilator_code || 'PANITIA'}] {t.name} - {badge}
                    </option>
                  );
                })}
              </optgroup>
            )}
            {otherEligibleList.length > 0 && (
              <optgroup label="Guru Pengawas Lainnya (Tersedia di Sesi Ini)">
                {otherEligibleList.map((t) => {
                  const badge = t.isBusy
                    ? ' [BENTROK: Sedang Mengawas di Sesi Ini]'
                    : !t.isAvailableDay
                    ? ` [Tdk Ada Hari ${exam.day_name}] (${t.count}x)`
                    : ` [Tersedia di Sesi Ini] (${t.count}x mengawas)`;

                  return (
                    <option key={t.id} value={t.id} disabled={t.isBusy}>
                      [{t.invigilator_code || 'GURU'}] {t.name} - {badge}
                    </option>
                  );
                })}
              </optgroup>
            )}
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            * SOP Penggantian: Utamakan guru yang bebas tugas/libur hari ini terlebih dahulu (Prioritas 1) sebelum menugaskan Panitia Ujian (Prioritas 2).
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
